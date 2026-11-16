import { useEffect, useRef, useState } from "react";
import SmoothPopover from "../animations/smooth-popover.tsx";

interface UserMenuDropdownProps {
  fullName: string;
  email: string;
  initialListCount?: number;
}

export default function UserMenuDropdown({
  fullName,
  email,
  initialListCount = 0,
}: UserMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const [listCount, setListCount] = useState<number>(initialListCount);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsidePointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleListsUpdated(e: Event) {
      const detail = (e as CustomEvent<{ listCount?: number }>).detail;
      if (typeof detail?.listCount === "number") {
        setListCount(detail.listCount);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("nutrifind:lists-updated", handleListsUpdated);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("nutrifind:lists-updated", handleListsUpdated);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={[
          "group inline-flex min-h-11 cursor-pointer items-center gap-2.5 border-2 border-ink px-3.5 font-mono text-xs font-semibold uppercase tracking-tight transition-[background-color,transform,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open
            ? "bg-paper translate-y-0 shadow-[1px_1px_0_#111111]"
            : "bg-white shadow-[2px_2px_0_#111111] hover:-translate-y-0.5 hover:bg-paper hover:shadow-[3px_3px_0_#111111] active:translate-y-0 active:shadow-none",
        ].join(" ")}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
        </svg>
        <span className="max-w-36 truncate">{fullName}</span>
        <span
          aria-hidden="true"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          className="inline-block text-[11px]"
        >
          ▾
        </span>
      </button>

      <SmoothPopover
        open={open}
        direction="down"
        origin="top-right"
        role="menu"
        ariaLabel="Opciones de cuenta de usuario"
        className="absolute right-0 top-[calc(100%+8px)] z-40 w-68"
      >
        {/* Cabecera de cuenta */}
        <div className="border-b-2 border-ink bg-paper px-3.5 py-2.5">
          <p className="truncate font-display text-xs font-black uppercase tracking-tight">
            {fullName}
          </p>
          <p className="truncate font-mono text-[11px] text-muted">{email}</p>
        </div>

        {/* Opción 1: Mis listas de productos */}
        <a
          href="/listas"
          role="menuitem"
          onClick={() => setOpen(false)}
          className="flex w-full items-center justify-between gap-2.5 border-b border-ink bg-white px-3.5 py-3 text-left text-[13px] font-bold text-ink transition-colors duration-120 hover:bg-ink hover:text-paper"
        >
          <span className="flex items-center gap-2.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="square"
              strokeLinejoin="miter"
              aria-hidden="true"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span>Mis listas de productos</span>
          </span>
          <span className="border border-ink bg-gold px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink">
            {listCount}
          </span>
        </a>

        {/* Opción 2: Ajustes de perfil (Gris e incliqueable) */}
        <div
          role="menuitem"
          aria-disabled="true"
          title="Disponible próximamente"
          className="flex w-full cursor-not-allowed select-none items-center justify-between gap-2.5 border-b border-ink bg-[#f0ede6] px-3.5 py-3 text-left text-[13px] font-bold text-[#8a8a8a]"
        >
          <span className="flex items-center gap-2.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
              strokeLinejoin="miter"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Ajustes de perfil</span>
          </span>
          <span className="border border-[#9ca3af] bg-[#e5e7eb] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#6b7280]">
            Pronto
          </span>
        </div>

        {/* Opción 3: Cerrar sesión en rojo sutil con icono de salida */}
        <form method="post" action="/api/auth/logout">
          <button
            type="submit"
            role="menuitem"
            className="flex w-full cursor-pointer items-center justify-between gap-2.5 bg-[#fffafa] px-3.5 py-3 text-left text-[13px] font-bold text-[#991b1b] transition-colors duration-120 hover:bg-[#fef2f2] hover:text-[#7f1d1d]"
          >
            <span className="flex items-center gap-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="square"
                strokeLinejoin="miter"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Cerrar sesión</span>
            </span>
            <span className="font-mono text-[10px] uppercase opacity-80">Salir</span>
          </button>
        </form>
      </SmoothPopover>
    </div>
  );
}
