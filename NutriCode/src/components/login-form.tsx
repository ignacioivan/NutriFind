import { useEffect, useId, useState, type ComponentProps } from "react";
import { navigate } from "astro:transitions/client";
import { sanitizeRedirectPath, validateLoginPayload, type FieldErrors } from "../lib/auth-validation.ts";

type Props = {
  redirectTo?: string;
  initialVerified?: boolean;
  initialEmail?: string;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string; fieldErrors: FieldErrors; locked: boolean };

export default function LoginForm({
  redirectTo = "/",
  initialVerified = false,
  initialEmail = "",
}: Props) {
  const emailId = useId();
  const passId = useId();
  const honeypotId = useId();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifiedBanner, setVerifiedBanner] = useState(initialVerified);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("verificado") === "1") {
      setVerifiedBanner(true);
    }
    const qEmail = search.get("correo");
    if (qEmail && !email) {
      setEmail(qEmail);
    }

    if (window.location.hash && window.location.hash.includes("access_token=")) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const type = hashParams.get("type");
      if (type === "signup" || type === "email") {
        setVerifiedBanner(true);
        try {
          const token = hashParams.get("access_token") ?? "";
          const part = token.split(".")[1];
          if (part) {
            const parsed = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string };
            if (parsed.email) setEmail(parsed.email);
          }
        } catch {
          // Ignorar si el token no se puede decodificar localmente
        }
        window.history.replaceState(null, "", "/ingresar?verificado=1");
      }
    }
  }, []);

  const errors = state.kind === "error" ? state.fieldErrors : {};
  const isLoading = state.kind === "loading";

  const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const payload = { email, password, honeypot };
    const clientCheck = validateLoginPayload(payload);
    if (!clientCheck.ok) {
      setState({
        kind: "error",
        message: clientCheck.message,
        fieldErrors: clientCheck.fieldErrors,
        locked: false,
      });
      return;
    }

    setState({ kind: "loading" });

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: FieldErrors;
      };

      if (!res.ok) {
        setState({
          kind: "error",
          message: data.error || "Correo o contraseña incorrectos.",
          fieldErrors: data.fieldErrors ?? {},
          locked: res.status === 429,
        });
        return;
      }

      navigate(sanitizeRedirectPath(redirectTo, "/"));
    } catch {
      setState({
        kind: "error",
        message: "Error de conexión. Intenta nuevamente.",
        fieldErrors: {},
        locked: false,
      });
    }
  }

  return (
    <section className="border-2 border-ink bg-white">
      <div className="flex items-center justify-between gap-3 border-b-8 border-ink px-4 py-3">
        <h2 className="font-display text-xl font-black uppercase">Ingresar</h2>
        <a href="/registro" className="label-mono font-semibold underline underline-offset-4">
          Crear cuenta →
        </a>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-4 sm:p-5">
        {verifiedBanner && state.kind !== "error" && (
          <div role="status" className="border-2 border-ink bg-[#f0fdf4] p-3 text-sm leading-snug text-ink">
            <span className="label-mono mr-2 inline-block border border-ink bg-best-price px-1.5 py-0.5 text-[10px] font-bold text-paper">
              ✓ Correo confirmado
            </span>
            Tu cuenta fue verificada correctamente. Ingresa tu contraseña para iniciar sesión.
          </div>
        )}

        {state.kind === "error" && (
          <div role="alert" className="border-2 border-ink bg-gold p-3 text-sm leading-snug">
            <span className="label-mono mr-2 font-semibold">
              {state.locked ? "[ Límite alcanzado ]" : "[ Error ]"}
            </span>
            {state.message}
          </div>
        )}

        <div className="sr-only" aria-hidden="true">
          <label htmlFor={honeypotId}>Sitio web</label>
          <input
            id={honeypotId}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="label-mono font-semibold">
            Correo electrónico
          </label>
          <div className={`flex min-h-11 border-2 border-ink bg-white ${errors.email ? "border-l-[6px]" : ""}`}>
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="sofia@ejemplo.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-ink placeholder:text-muted focus-visible:outline-offset-[-3px]"
            />
          </div>
          {errors.email && <p className="label-mono font-semibold text-ink">{errors.email}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={passId} className="label-mono font-semibold">
            Contraseña
          </label>
          <div className={`flex min-h-11 border-2 border-ink bg-white ${errors.password ? "border-l-[6px]" : ""}`}>
            <input
              id={passId}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={128}
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-ink placeholder:text-muted focus-visible:outline-offset-[-3px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="label-mono min-h-11 shrink-0 border-l-2 border-ink bg-paper px-3 font-semibold text-ink hover:bg-ink hover:text-paper focus-visible:outline-offset-[-3px]"
            >
              {showPassword ? "[ Ocultar ]" : "[ Ver ]"}
            </button>
          </div>
          {errors.password && <p className="label-mono font-semibold text-ink">{errors.password}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="label-mono inline-flex min-h-12 w-full cursor-pointer items-center justify-center border-2 border-ink bg-ink px-5 font-semibold text-paper hover:bg-ink/85 disabled:cursor-wait disabled:opacity-75"
        >
          {isLoading ? "[ Ingresando… ]" : "[ Ingresar ]"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink bg-paper px-4 py-3.5 text-sm">
        <span>¿Todavía no tienes cuenta?</span>
        <a href="/registro" className="label-mono font-semibold underline underline-offset-4">
          Crear cuenta
        </a>
      </div>
    </section>
  );
}
