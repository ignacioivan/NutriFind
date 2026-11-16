interface AnimatedCheckProps {
  checked: boolean;
  size?: number;
  className?: string;
}

export default function AnimatedCheck({ checked, size = 14, className = "" }: AnimatedCheckProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-grid place-items-center border-2 border-ink transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        checked ? "scale-105 bg-ink text-gold" : "scale-100 bg-white text-transparent",
        className,
      ].join(" ")}
      style={{ width: size + 4, height: size + 4 }}
    >
      <svg
        width={size - 2}
        height={size - 2}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        className={[
          "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
          checked ? "scale-100 opacity-100" : "scale-50 opacity-0",
        ].join(" ")}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
