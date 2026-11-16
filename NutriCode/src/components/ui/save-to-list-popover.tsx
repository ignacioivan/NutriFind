import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import AnimatedCheck from "../animations/animated-check.tsx";
import SmoothPopover from "../animations/smooth-popover.tsx";
import type { ShoppingListSummary } from "../../lib/lists.ts";

interface SaveToListPopoverProps {
  isAuthenticated: boolean;
}

type AnchorTarget = {
  productId: number;
  productName: string;
  buttonEl: HTMLElement;
  top: number;
  left: number;
  width: number;
  direction: "down" | "up";
  origin: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

const MAX_POPOVER_WIDTH = 324;

export default function SaveToListPopover({ isAuthenticated }: SaveToListPopoverProps) {
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [anchor, setAnchor] = useState<AnchorTarget | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);

  const closePopover = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const syncDomButtons = useCallback((currentLists: ShoppingListSummary[]) => {
    const savedSet = new Set<number>();
    for (const l of currentLists) {
      for (const pid of l.productIds) savedSet.add(pid);
    }

    const buttons = document.querySelectorAll<HTMLElement>("[data-save-product-btn]");
    buttons.forEach((btn) => {
      const pid = Number(btn.dataset.productId);
      btn.dataset.saved = savedSet.has(pid) ? "true" : "false";
    });

    window.dispatchEvent(
      new CustomEvent("nutrifind:lists-updated", {
        detail: { listCount: currentLists.length },
      }),
    );
  }, []);

  const triggerButtonCheckPulse = useCallback((productId: number) => {
    const buttons = document.querySelectorAll<HTMLElement>(
      `[data-save-product-btn][data-product-id="${productId}"]`,
    );
    buttons.forEach((btn) => {
      btn.dataset.saved = "true";
      btn.dataset.justSaved = "true";
      window.setTimeout(() => {
        btn.dataset.justSaved = "false";
      }, 950);
    });
  }, []);

  const fetchLists = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lists", { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        lists?: ShoppingListSummary[];
        schemaReady?: boolean;
      };
      if (data.ok && Array.isArray(data.lists)) {
        setLists(data.lists);
        setSchemaReady(data.schemaReady !== false);
        syncDomButtons(data.lists);
      }
    } catch {
      // Silencioso en precarga
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, syncDomButtons]);

  useEffect(() => {
    fetchLists();
    const onPageLoad = () => {
      setIsOpen(false);
      fetchLists();
    };
    document.addEventListener("astro:page-load", onPageLoad);
    return () => document.removeEventListener("astro:page-load", onPageLoad);
  }, [fetchLists]);

  const computePosition = useCallback(
    (
      btn: HTMLElement,
    ): Pick<AnchorTarget, "top" | "left" | "width" | "direction" | "origin"> => {
      const rect = btn.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const width = Math.min(MAX_POPOVER_WIDTH, Math.max(260, viewportW - 24));
      const estimatedHeight = 280;

      const spaceBelow = viewportH - rect.bottom;
      const direction: "down" | "up" =
        spaceBelow < estimatedHeight && rect.top > estimatedHeight ? "up" : "down";

      // Si el botón está en la mitad izquierda de la pantalla (ej. ficha de producto), alinear a la izquierda del botón
      const alignLeft = rect.left + width <= viewportW - 12 && rect.right < viewportW * 0.65;
      let left = alignLeft ? rect.left : rect.right - width;
      if (left < 12) left = 12;
      if (left + width > viewportW - 12) {
        left = Math.max(12, viewportW - width - 12);
      }

      const btnCenterX = rect.left + rect.width / 2;
      const popoverCenterX = left + width / 2;
      const isRightAnchored = btnCenterX >= popoverCenterX;

      const origin: AnchorTarget["origin"] =
        direction === "up"
          ? isRightAnchored
            ? "bottom-right"
            : "bottom-left"
          : isRightAnchored
            ? "top-right"
            : "top-left";

      const top = direction === "down" ? rect.bottom + 8 : rect.top - 8;
      return { top, left, width, direction, origin };
    },
    [],
  );

  useEffect(() => {
    function handleDocumentPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const saveBtn = target.closest<HTMLElement>("[data-save-product-btn]");
      if (saveBtn) {
        // El click del botón se maneja en handleDocumentClick para evitar doble disparo
        return;
      }

      if (popoverRef.current && !popoverRef.current.contains(target)) {
        closePopover();
      }
    }

    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const saveBtn = target.closest<HTMLElement>("[data-save-product-btn]");
      if (!saveBtn) return;

      e.preventDefault();
      e.stopPropagation();

      const pid = Number(saveBtn.dataset.productId);
      const pname = saveBtn.dataset.productName || "Producto";
      if (!Number.isSafeInteger(pid) || pid <= 0) return;

      setErrorMsg(null);
      setFeedback(null);

      // Si ya estaba abierto en este mismo botón, contraer suavemente en su lugar
      if (isOpen && anchor && anchor.productId === pid && anchor.buttonEl === saveBtn) {
        closePopover();
        return;
      }

      const pos = computePosition(saveBtn);
      const nextAnchor: AnchorTarget = {
        productId: pid,
        productName: pname,
        buttonEl: saveBtn,
        ...pos,
      };

      // Colocar primero en las coordenadas del botón con estado cerrado, y abrir en el siguiente frame
      // para que la transición de entrada se reproduzca siempre suave desde el botón.
      setIsOpen(false);
      setAnchor(nextAnchor);

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = window.requestAnimationFrame(() => {
          setIsOpen(true);
          rafRef.current = null;
        });
      });
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePopover();
    }

    function handleScrollOrResize() {
      if (!isOpen) return;
      setAnchor((prev) => {
        if (!prev) return null;
        if (!document.body.contains(prev.buttonEl)) {
          setIsOpen(false);
          return prev;
        }
        const pos = computePosition(prev.buttonEl);
        return { ...prev, ...pos };
      });
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [anchor, closePopover, computePosition, isOpen]);

  useEffect(() => {
    if (isOpen && isAuthenticated && lists.length === 0 && !loading) {
      window.setTimeout(() => inputRef.current?.focus(), 90);
    }
  }, [isOpen, isAuthenticated, lists.length, loading]);

  async function toggleProductInList(list: ShoppingListSummary) {
    if (!anchor) return;
    const pid = anchor.productId;
    const currentlyIn = list.productIds.includes(pid);
    setErrorMsg(null);

    const optimisticLists = lists.map((l) => {
      if (l.id !== list.id) return l;
      const nextIds = currentlyIn
        ? l.productIds.filter((id) => id !== pid)
        : [...l.productIds, pid];
      return {
        ...l,
        productIds: nextIds,
        itemCount: nextIds.length,
        containsProduct: !currentlyIn,
      };
    });

    setLists(optimisticLists);
    syncDomButtons(optimisticLists);

    if (!currentlyIn) {
      triggerButtonCheckPulse(pid);
      setFeedback(`✓ Guardado en "${list.name}"`);
    } else {
      setFeedback(`Quitado de "${list.name}"`);
    }

    try {
      const res = await fetch("/api/lists/items", {
        method: currentlyIn ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: list.id, productId: pid }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        setLists(lists);
        syncDomButtons(lists);
        setFeedback(null);
        setErrorMsg(err.message || "No pudimos actualizar la lista.");
      }
    } catch {
      setLists(lists);
      syncDomButtons(lists);
      setFeedback(null);
      setErrorMsg("Error de conexión al guardar.");
    }
  }

  const handleCreateList: NonNullable<ComponentProps<"form">["onSubmit"]> = async (e) => {
    e.preventDefault();
    if (!anchor || creating) return;
    const trimmed = newListName.trim();
    if (!trimmed) {
      setErrorMsg("Escribe un nombre para tu lista.");
      return;
    }

    setCreating(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          productId: anchor.productId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        list?: ShoppingListSummary;
        message?: string;
      };

      if (!res.ok || !data.ok || !data.list) {
        setErrorMsg(data.message || "No pudimos crear la lista.");
        return;
      }

      const nextLists = [data.list, ...lists];
      setLists(nextLists);
      setNewListName("");
      syncDomButtons(nextLists);
      triggerButtonCheckPulse(anchor.productId);
      setFeedback(`✓ Lista "${data.list.name}" creada y producto guardado`);
    } catch {
      setErrorMsg("No pudimos conectar con el servidor.");
    } finally {
      setCreating(false);
    }
  };

  if (!anchor) return null;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        width: anchor.width,
        transform: anchor.direction === "up" ? "translateY(-100%)" : "none",
        zIndex: 50,
        pointerEvents: isOpen ? "auto" : "none",
      }}
    >
      <SmoothPopover
        open={isOpen}
        direction={anchor.direction}
        origin={anchor.origin}
        ariaLabel="Guardar producto en lista"
        className="w-full"
      >
        {/* Cabecera estilo Etiqueta */}
        <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-3.5 py-2.5 text-paper">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
            {isAuthenticated ? "Guardar en lista..." : "Guardar producto"}
          </span>
          <button
            type="button"
            onClick={closePopover}
            aria-label="Cerrar selector de listas"
            className="cursor-pointer px-1 font-mono text-xs text-paper transition-colors hover:text-gold"
          >
            ✕
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="p-3.5">
            <p className="text-xs leading-relaxed text-ink">
              Inicia sesión o crea tu cuenta gratuita para armar tus <strong>listas de compras</strong> y calcular tu presupuesto.
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="/ingresar"
                className="flex-1 border-2 border-ink bg-ink py-2 text-center font-mono text-[11px] font-semibold uppercase text-paper transition-colors hover:bg-gold hover:text-ink"
              >
                Ingresar
              </a>
              <a
                href="/registro"
                className="flex-1 border-2 border-ink bg-white py-2 text-center font-mono text-[11px] font-semibold uppercase text-ink transition-colors hover:bg-paper"
              >
                Crear cuenta
              </a>
            </div>
          </div>
        ) : !schemaReady ? (
          <div className="p-3.5 text-xs leading-relaxed text-ink">
            <p className="font-bold">Falta activar las tablas en Supabase</p>
            <p className="mt-1 text-muted">
              Ejecuta los bloques de <code>002_shopping_lists.sql</code> en el SQL Editor para habilitar tus listas.
            </p>
          </div>
        ) : (
          <>
            {/* Feedback rápido de guardado */}
            {feedback && (
              <div
                role="status"
                className="border-b border-ink bg-gold px-3.5 py-1.5 font-mono text-[11px] font-bold text-ink"
              >
                {feedback}
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="border-b border-ink bg-[#fef2f2] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[#991b1b]"
              >
                {errorMsg}
              </div>
            )}

            {/* Listado de Playlists, Skeleton de Carga o Estado Vacío */}
            {loading && lists.length === 0 ? (
              <div className="divide-y divide-[#d6d1c4] bg-white" aria-busy="true" aria-label="Cargando tus listas">
                {[0, 1].map((idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2.5 px-3.5 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <span className="nf-skeleton inline-block size-4.5 border border-ink/25" />
                      <span className="nf-skeleton inline-block h-3.5 w-28 border border-ink/15" />
                    </span>
                    <span className="nf-skeleton inline-block h-4 w-12 border border-ink/15" />
                  </div>
                ))}
              </div>
            ) : lists.length === 0 ? (
              <div className="border-b border-dashed border-ink bg-[#fffdf9] px-3.5 py-3 text-xs leading-relaxed">
                <p className="font-bold text-ink">Aún no tienes listas creadas.</p>
                <p className="mt-0.5 text-muted">
                  Escribe un nombre abajo para crear tu primera lista y guardar este producto:
                </p>
              </div>
            ) : (
              <ul className="max-h-48 overflow-y-auto divide-y divide-[#d6d1c4]" role="group" aria-label="Tus listas">
                {lists.map((list) => {
                  const checked = list.productIds.includes(anchor.productId);
                  return (
                    <li key={list.id}>
                      <button
                        type="button"
                        onClick={() => toggleProductInList(list)}
                        className={[
                          "flex w-full cursor-pointer items-center justify-between gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-ink transition-colors duration-120",
                          checked ? "bg-[#fcf8ee] hover:bg-paper" : "bg-white hover:bg-paper",
                        ].join(" ")}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <AnimatedCheck checked={checked} />
                          <span className="truncate">{list.name}</span>
                        </span>
                        <span className="shrink-0 border border-ink/25 bg-paper px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                          {list.itemCount} {list.itemCount === 1 ? "ítem" : "ítems"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Mini-input para crear nueva lista al instante */}
            <form onSubmit={handleCreateList} className="border-t-2 border-ink bg-paper p-3">
              <label
                htmlFor="quick-new-list-input"
                className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wide text-muted"
              >
                {lists.length === 0 ? "Nombre de tu primera lista" : `+ Crear nueva lista (${lists.length}/20)`}
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  id="quick-new-list-input"
                  type="text"
                  maxLength={60}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Ej: Despensa del mes..."
                  className="h-9 min-w-0 flex-1 border-[1.5px] border-ink bg-white px-2.5 text-xs text-ink placeholder:text-muted focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="h-9 shrink-0 cursor-pointer border-[1.5px] border-ink bg-ink px-3 font-mono text-[11px] font-semibold uppercase text-paper transition-colors hover:bg-gold hover:text-ink disabled:opacity-50"
                >
                  {creating ? "..." : lists.length === 0 ? "Crear y guardar" : "Crear"}
                </button>
              </div>
            </form>
          </>
        )}
      </SmoothPopover>
    </div>
  );
}
