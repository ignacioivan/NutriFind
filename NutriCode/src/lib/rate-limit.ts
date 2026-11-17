export type AuthAction = "register" | "login" | "dev_gate";

export type RateLimitStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export type CloudflareKVLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

type RateRecord = {
  failures: number;
  strikes: number;
  blockedUntil: number;
  windowStart: number;
  burstStart: number;
  burstCount: number;
};

const POLICY: Record<
  AuthAction,
  {
    maxFailures: number;
    failureWindowMs: number;
    burstLimit: number;
    burstWindowMs: number;
    baseLockMs: number;
    escalatedLockMs: number;
    recordTtlSeconds: number;
  }
> = {
  // Registro: máximo 3 intentos erróneos -> bloqueo 30 min; ráfaga/reincidencia -> 60 min
  register: {
    maxFailures: 3,
    failureWindowMs: 15 * 60 * 1000,
    burstLimit: 5,
    burstWindowMs: 20 * 1000,
    baseLockMs: 30 * 60 * 1000,
    escalatedLockMs: 60 * 60 * 1000,
    recordTtlSeconds: 2 * 60 * 60,
  },
  // Login: máximo 5 intentos erróneos -> bloqueo 30 min; ráfaga/reincidencia -> 60 min
  login: {
    maxFailures: 5,
    failureWindowMs: 15 * 60 * 1000,
    burstLimit: 8,
    burstWindowMs: 20 * 1000,
    baseLockMs: 30 * 60 * 1000,
    escalatedLockMs: 60 * 60 * 1000,
    recordTtlSeconds: 2 * 60 * 60,
  },
  // Gate staging dev: máximo 5 claves erróneas -> bloqueo 30 min; ráfaga/reincidencia -> 60 min
  dev_gate: {
    maxFailures: 5,
    failureWindowMs: 15 * 60 * 1000,
    burstLimit: 10,
    burstWindowMs: 20 * 1000,
    baseLockMs: 30 * 60 * 1000,
    escalatedLockMs: 60 * 60 * 1000,
    recordTtlSeconds: 2 * 60 * 60,
  },
};

const KEY_PREFIX = "rl:auth:";

function keyFor(action: AuthAction, ip: string): string {
  const safeIp = ip.trim().slice(0, 128) || "unknown";
  return `${KEY_PREFIX}${action}:${safeIp}`;
}

function emptyRecord(nowMs: number): RateRecord {
  return {
    failures: 0,
    strikes: 0,
    blockedUntil: 0,
    windowStart: nowMs,
    burstStart: nowMs,
    burstCount: 0,
  };
}

async function readRecord(store: RateLimitStore, key: string, nowMs: number): Promise<RateRecord> {
  const raw = await store.get(key);
  if (!raw) return emptyRecord(nowMs);
  try {
    const parsed = JSON.parse(raw) as Partial<RateRecord>;
    return {
      failures: typeof parsed.failures === "number" ? parsed.failures : 0,
      strikes: typeof parsed.strikes === "number" ? parsed.strikes : 0,
      blockedUntil: typeof parsed.blockedUntil === "number" ? parsed.blockedUntil : 0,
      windowStart: typeof parsed.windowStart === "number" ? parsed.windowStart : nowMs,
      burstStart: typeof parsed.burstStart === "number" ? parsed.burstStart : nowMs,
      burstCount: typeof parsed.burstCount === "number" ? parsed.burstCount : 0,
    };
  } catch {
    return emptyRecord(nowMs);
  }
}

export async function checkAndTrackRequest(
  store: RateLimitStore,
  action: AuthAction,
  ip: string,
  nowMs = Date.now(),
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number; reason: "locked" | "burst" }> {
  const cfg = POLICY[action];
  const key = keyFor(action, ip);
  const rec = await readRecord(store, key, nowMs);

  if (rec.blockedUntil > nowMs) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((rec.blockedUntil - nowMs) / 1000)),
      reason: "locked",
    };
  }

  if (nowMs - rec.burstStart > cfg.burstWindowMs) {
    rec.burstStart = nowMs;
    rec.burstCount = 1;
  } else {
    rec.burstCount += 1;
  }

  if (rec.burstCount > cfg.burstLimit) {
    rec.strikes += 1;
    const lockMs = rec.strikes >= 2 ? cfg.escalatedLockMs : cfg.baseLockMs;
    rec.blockedUntil = nowMs + lockMs;
    await store.put(key, JSON.stringify(rec), { expirationTtl: cfg.recordTtlSeconds });
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(lockMs / 1000),
      reason: "burst",
    };
  }

  await store.put(key, JSON.stringify(rec), { expirationTtl: cfg.recordTtlSeconds });
  return { allowed: true };
}

export async function recordAuthFailure(
  store: RateLimitStore,
  action: AuthAction,
  ip: string,
  nowMs = Date.now(),
): Promise<{ blocked: boolean; retryAfterSeconds: number; remainingAttempts: number }> {
  const cfg = POLICY[action];
  const key = keyFor(action, ip);
  const rec = await readRecord(store, key, nowMs);

  if (nowMs - rec.windowStart > cfg.failureWindowMs) {
    rec.windowStart = nowMs;
    rec.failures = 1;
  } else {
    rec.failures += 1;
  }

  if (rec.failures >= cfg.maxFailures) {
    rec.strikes += 1;
    rec.failures = 0;
    const lockMs = rec.strikes >= 2 ? cfg.escalatedLockMs : cfg.baseLockMs;
    rec.blockedUntil = nowMs + lockMs;
    await store.put(key, JSON.stringify(rec), { expirationTtl: cfg.recordTtlSeconds });
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(lockMs / 1000),
      remainingAttempts: 0,
    };
  }

  await store.put(key, JSON.stringify(rec), { expirationTtl: cfg.recordTtlSeconds });
  return {
    blocked: false,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, cfg.maxFailures - rec.failures),
  };
}

export async function lockIpImmediately(
  store: RateLimitStore,
  action: AuthAction,
  ip: string,
  nowMs = Date.now(),
): Promise<number> {
  const cfg = POLICY[action];
  const key = keyFor(action, ip);
  const rec = await readRecord(store, key, nowMs);
  rec.strikes += 1;
  const lockMs = cfg.escalatedLockMs;
  rec.blockedUntil = nowMs + lockMs;
  await store.put(key, JSON.stringify(rec), { expirationTtl: cfg.recordTtlSeconds });
  return Math.ceil(lockMs / 1000);
}

export async function clearAuthFailures(store: RateLimitStore, action: AuthAction, ip: string): Promise<void> {
  await store.delete(keyFor(action, ip));
}

export function createKVRateLimitStore(kv: CloudflareKVLike): RateLimitStore {
  return {
    get: (key) => kv.get(key),
    put: (key, value, options) => kv.put(key, value, options),
    delete: (key) => kv.delete(key),
  };
}

const memoryFallbackMap = new Map<string, { value: string; expiresAt: number }>();

export function createMemoryRateLimitStore(): RateLimitStore {
  return {
    async get(key) {
      const entry = memoryFallbackMap.get(key);
      if (!entry) return null;
      if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
        memoryFallbackMap.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key, value, options) {
      const expiresAt = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : 0;
      memoryFallbackMap.set(key, { value, expiresAt });
    },
    async delete(key) {
      memoryFallbackMap.delete(key);
    },
  };
}

export function formatRetryMinutes(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}
