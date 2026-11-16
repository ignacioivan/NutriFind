import type { CSSProperties, ReactNode } from "react";

interface SmoothPopoverProps {
  open: boolean;
  direction?: "down" | "up";
  origin?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  className?: string;
  style?: CSSProperties;
  role?: string;
  ariaLabel?: string;
  children: ReactNode;
}

const ORIGIN_MAP: Record<NonNullable<SmoothPopoverProps["origin"]>, string> = {
  "top-right": "top right",
  "top-left": "top left",
  "bottom-right": "bottom right",
  "bottom-left": "bottom left",
};

export default function SmoothPopover({
  open,
  direction = "down",
  origin,
  className = "",
  style,
  role = "dialog",
  ariaLabel,
  children,
}: SmoothPopoverProps) {
  const resolvedOrigin =
    origin ?? (direction === "up" ? "bottom-right" : "top-right");

  const closedOffsetY = direction === "up" ? "8px" : "-8px";

  const combinedStyle: CSSProperties = {
    transformOrigin: ORIGIN_MAP[resolvedOrigin],
    transform: open
      ? "translate3d(0, 0, 0) scale(1)"
      : `translate3d(0, ${closedOffsetY}, 0) scale(0.94)`,
    opacity: open ? 1 : 0,
    visibility: open ? "visible" : "hidden",
    transition: open
      ? "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), visibility 0ms linear 0ms"
      : "transform 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 130ms cubic-bezier(0.4, 0, 0.2, 1), visibility 0ms linear 150ms",
    willChange: "transform, opacity",
    ...style,
  };

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      aria-hidden={!open}
      style={combinedStyle}
      className={[
        "border-2 border-ink bg-white shadow-[5px_5px_0_#111111] motion-reduce:!transition-none",
        open ? "pointer-events-auto" : "pointer-events-none",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
