import { useId, useState, type ComponentProps } from "react";
import { navigate } from "astro:transitions/client";
import { validateRegistrationPayload, type FieldErrors } from "../lib/auth-validation.ts";

const DISABLED_PRIORITIES = ["Sin lactosa", "Vegano", "Sin azúcar", "Sin sál"] as const;

type SubmitState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string; fieldErrors: FieldErrors; locked: boolean }
  | { kind: "success"; email: string; immediateLogin: boolean };

export default function RegisterForm() {
  const nameId = useId();
  const emailId = useId();
  const passId = useId();
  const confirmId = useId();
  const termsId = useId();
  const honeypotId = useId();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  const errors = state.kind === "error" ? state.fieldErrors : {};
  const isLoading = state.kind === "loading";

  const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const payload = {
      fullName,
      email,
      password,
      confirmPassword,
      priority: "sin_gluten" as const,
      termsAccepted,
      honeypot,
    };

    const clientCheck = validateRegistrationPayload(payload);
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: FieldErrors;
        requiresEmailConfirmation?: boolean;
      };

      if (!res.ok) {
        setState({
          kind: "error",
          message: data.error || "No pudimos crear tu cuenta. Intenta nuevamente.",
          fieldErrors: data.fieldErrors ?? {},
          locked: res.status === 429,
        });
        return;
      }

      const immediateLogin = !data.requiresEmailConfirmation;
      setState({
        kind: "success",
        email: clientCheck.data.email,
        immediateLogin,
      });

      if (immediateLogin) {
        setTimeout(() => {
          navigate("/");
        }, 1200);
      }
    } catch {
      setState({
        kind: "error",
        message: "Error de conexión. Verifica tu internet e intenta de nuevo.",
        fieldErrors: {},
        locked: false,
      });
    }
  }

  if (state.kind === "success") {
    return (
      <section className="border-2 border-ink bg-white" aria-live="polite">
        <div className="label-mono border-b-8 border-best-price px-4 py-3 font-semibold text-best-price">
          [ Cuenta lista ]
        </div>
        <div className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-2xl font-black uppercase leading-tight">
            {state.immediateLogin ? "Bienvenido a NutriFind" : "Revisa tu correo"}
          </h2>
          <p className="text-base leading-relaxed">
            {state.immediateLogin ? (
              <>
                Tu cuenta para <strong>{state.email}</strong> ya está activa y con sesión iniciada.
              </>
            ) : (
              <>
                Enviamos un enlace de confirmación a <strong>{state.email}</strong> para activar tu cuenta.
              </>
            )}
          </p>
          <a
            href={state.immediateLogin ? "/" : "/ingresar"}
            className="label-mono inline-flex min-h-12 w-full items-center justify-center border-2 border-ink bg-ink px-5 font-semibold text-paper hover:bg-ink/85"
          >
            {state.immediateLogin ? "[ Ir a buscar productos ]" : "[ Ir a ingresar ]"}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="border-2 border-ink bg-white">
      <div className="flex items-center justify-between gap-3 border-b-8 border-ink px-4 py-3">
        <h2 className="font-display text-xl font-black uppercase">Crear cuenta</h2>
        <a href="/ingresar" className="label-mono font-semibold underline underline-offset-4">
          Ya tengo cuenta →
        </a>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-4 sm:p-5">
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
          <label htmlFor={nameId} className="label-mono font-semibold">
            Nombre y Apellido
          </label>
          <div className={`flex min-h-11 border-2 border-ink bg-white ${errors.fullName ? "border-l-[6px]" : ""}`}>
            <input
              id={nameId}
              name="fullName"
              type="text"
              autoComplete="name"
              required
              maxLength={80}
              placeholder="Ej. Sofía Rojas"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={Boolean(errors.fullName)}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-ink placeholder:text-muted focus-visible:outline-offset-[-3px]"
            />
          </div>
          {errors.fullName && <p className="label-mono font-semibold text-ink">{errors.fullName}</p>}
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
              autoComplete="new-password"
              required
              maxLength={128}
              placeholder="Mínimo 8 caracteres"
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
          <p className="label-mono text-muted">
            Contraseña con un mínimo de 8 caracteres, incluyendo al menos un carácter especial, una mayúscula, una minúscula y un número.
          </p>
          {errors.password && <p className="label-mono font-semibold text-ink">{errors.password}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={confirmId} className="label-mono font-semibold">
            Repetir contraseña
          </label>
          <div className={`flex min-h-11 border-2 border-ink bg-white ${errors.confirmPassword ? "border-l-[6px]" : ""}`}>
            <input
              id={confirmId}
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              required
              maxLength={128}
              placeholder="Vuelve a escribir tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={Boolean(errors.confirmPassword)}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-ink placeholder:text-muted focus-visible:outline-offset-[-3px]"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-pressed={showConfirm}
              className="label-mono min-h-11 shrink-0 border-l-2 border-ink bg-paper px-3 font-semibold text-ink hover:bg-ink hover:text-paper focus-visible:outline-offset-[-3px]"
            >
              {showConfirm ? "[ Ocultar ]" : "[ Ver ]"}
            </button>
          </div>
          {errors.confirmPassword && <p className="label-mono font-semibold text-ink">{errors.confirmPassword}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono font-semibold">Tu prioridad (opcional)</span>
          <div className="flex flex-wrap gap-2">
            <span className="label-mono inline-flex min-h-11 items-center border-[1.5px] border-ink bg-ink px-3 font-semibold text-paper">
              Sin gluten ✓
            </span>
            {DISABLED_PRIORITIES.map((label) => (
              <button
                key={label}
                type="button"
                disabled
                aria-disabled="true"
                title="Disponible próximamente"
                className="label-mono inline-flex min-h-11 cursor-not-allowed select-none items-center border-[1.5px] border-ink bg-white px-3 font-semibold opacity-45 grayscale"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={termsId} className="flex min-h-11 cursor-pointer items-start gap-2.5 py-1 text-sm leading-snug">
            <span className="relative mt-0.5 inline-flex size-5 shrink-0 items-center justify-center border-2 border-ink bg-white">
              <input
                id={termsId}
                name="termsAccepted"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="peer absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <span
                aria-hidden="true"
                className="label-mono hidden size-full place-items-center bg-ink font-semibold text-paper peer-checked:grid"
              >
                ✓
              </span>
            </span>
            <span>Acepto el uso de mis datos para guardar mi lista de compras y preferencias.</span>
          </label>
          {errors.termsAccepted && <p className="label-mono font-semibold text-ink">{errors.termsAccepted}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="label-mono inline-flex min-h-12 w-full cursor-pointer items-center justify-center border-2 border-ink bg-ink px-5 font-semibold text-paper hover:bg-ink/85 disabled:cursor-wait disabled:opacity-75"
        >
          {isLoading ? "[ Creando cuenta… ]" : "[ Crear cuenta ]"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink bg-paper px-4 py-3.5 text-sm">
        <span>¿Ya estás registrado?</span>
        <a href="/ingresar" className="label-mono font-semibold underline underline-offset-4">
          Iniciar sesión
        </a>
      </div>
    </section>
  );
}
