import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkAndTrackRequest,
  clearAuthFailures,
  createKVRateLimitStore,
  lockIpImmediately,
  recordAuthFailure,
} from "./rate-limit.ts";

function fakeStore() {
  const data = new Map<string, string>();
  return createKVRateLimitStore({
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value) {
      data.set(key, value);
    },
    async delete(key) {
      data.delete(key);
    },
  });
}

test("register locks IP for 30 minutes after 3 failed attempts and escalates to 60 minutes on repeat", async () => {
  const store = fakeStore();
  const ip = "203.0.113.10";
  const t0 = 1_000_000;

  assert.equal((await checkAndTrackRequest(store, "register", ip, t0)).allowed, true);
  assert.equal((await recordAuthFailure(store, "register", ip, t0)).remainingAttempts, 2);
  assert.equal((await recordAuthFailure(store, "register", ip, t0 + 1000)).remainingAttempts, 1);

  const third = await recordAuthFailure(store, "register", ip, t0 + 2000);
  assert.equal(third.blocked, true);
  assert.equal(third.retryAfterSeconds, 30 * 60);

  const blockedCheck = await checkAndTrackRequest(store, "register", ip, t0 + 5000);
  assert.equal(blockedCheck.allowed, false);

  // Después de expirar los primeros 30 min, reincidir 3 veces escala a 60 min
  const tAfterFirstLock = t0 + 31 * 60 * 1000;
  await recordAuthFailure(store, "register", ip, tAfterFirstLock);
  await recordAuthFailure(store, "register", ip, tAfterFirstLock + 1000);
  const escalated = await recordAuthFailure(store, "register", ip, tAfterFirstLock + 2000);
  assert.equal(escalated.blocked, true);
  assert.equal(escalated.retryAfterSeconds, 60 * 60);

  await clearAuthFailures(store, "register", ip);
  assert.equal((await checkAndTrackRequest(store, "register", ip, tAfterFirstLock + 3000)).allowed, true);
});

test("burst requests and honeypot trigger immediate temporary lock", async () => {
  const store = fakeStore();
  const ip = "203.0.113.20";
  const t0 = 2_000_000;

  for (let i = 0; i < 5; i++) {
    const res = await checkAndTrackRequest(store, "register", ip, t0 + i * 100);
    assert.equal(res.allowed, true);
  }
  const sixth = await checkAndTrackRequest(store, "register", ip, t0 + 600);
  assert.equal(sixth.allowed, false);
  if (!sixth.allowed) {
    assert.equal(sixth.reason, "burst");
    assert.equal(sixth.retryAfterSeconds, 30 * 60);
  }

  const botLock = await lockIpImmediately(store, "register", "203.0.113.30", t0);
  assert.equal(botLock, 60 * 60);
});
