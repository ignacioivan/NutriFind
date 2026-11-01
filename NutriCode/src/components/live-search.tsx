import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { navigate } from "astro:transitions/client";
import { formatCLP, imageUrl } from "../lib/format.ts";

type Suggestion = { id: number; name: string; price: number; images: string[] };

type Props = {
  initialValue?: string;
  placeholder: string;
  inputClass: string;
};

const MAX_SUGGESTIONS = 5;
const DEBOUNCE_MS = 250;

export default function LiveSearch({ initialValue = "", placeholder, inputClass }: Props) {
  const [q, setQ] = useState(initialValue);
  const [edited, setEdited] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const open = suggestions !== null;

  useEffect(() => {
    const text = q.trim();
    if (!edited || text.length < 2) {
      setSuggestions(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/productos?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data: { items: Suggestion[] } = await res.json();
        setSuggestions(data.items.slice(0, MAX_SUGGESTIONS));
        setActive(-1);
      } catch {
        // Without suggestions the form still works with Enter.
        if (!controller.signal.aborted) setSuggestions(null);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, edited]);

  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (e: PointerEvent) => {
      if (!root.current?.closest("form")?.contains(e.target as Node)) setSuggestions(null);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    return () => document.removeEventListener("pointerdown", closeIfOutside);
  }, [open]);

  function goTo(s: Suggestion) {
    setSuggestions(null);
    navigate(`/producto/${s.id}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!suggestions) return;
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      goTo(suggestions[active]);
    } else if (e.key === "Escape") {
      // type="search" clears the text on Escape; the first Escape should only close the list.
      e.preventDefault();
      setSuggestions(null);
    }
  }

  return (
    <div ref={root} className="contents">
      <input
        id="q"
        name="q"
        type="search"
        value={q}
        required
        maxLength={80}
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setEdited(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setSuggestions(null)}
        className={inputClass}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label="Sugerencias" className="absolute -inset-x-0.5 top-full z-20 mt-0.5 border-2 border-ink bg-white">
          {suggestions.length === 0 ? (
            <li role="option" aria-selected={false} aria-disabled="true" className="label-mono px-3 py-3 text-muted">
              Sin coincidencias — presiona Enter para buscar
            </li>
          ) : (
            suggestions.map((s, i) => (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => goTo(s)}
                onPointerEnter={() => setActive(i)}
                className={`flex min-h-14 cursor-pointer items-center gap-3 border-b border-ink px-3 py-2 last:border-b-0 ${i === active ? "bg-ink text-paper" : ""}`}
              >
                <span className="grid size-10 shrink-0 place-items-center bg-white">
                  {s.images[0] && <img src={imageUrl(s.images[0], 96)} alt="" width={40} height={40} className="size-10 object-contain" />}
                </span>
                <span className="line-clamp-1 flex-1 text-sm font-bold">{s.name}</span>
                <span className="shrink-0 font-black tabular-nums">{formatCLP(s.price)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
