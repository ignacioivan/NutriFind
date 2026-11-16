import { type ComponentProps, useState } from "react";
import { formatCLP, imageUrl } from "../../lib/format.ts";
import type { ShoppingListFull } from "../../lib/lists.ts";

interface ListsManagerProps {
  initialLists: ShoppingListFull[];
  schemaReady: boolean;
}

export default function ListsManager({ initialLists, schemaReady }: ListsManagerProps) {
  const [lists, setLists] = useState<ShoppingListFull[]>(initialLists);
  const [selectedId, setSelectedId] = useState<string>(initialLists[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const selectedList = lists.find((l) => l.id === selectedId) ?? lists[0] ?? null;

  function recomputeListTotals(list: ShoppingListFull): ShoppingListFull {
    let totalPrice = 0;
    let totalUnits = 0;
    for (const item of list.items) {
      totalUnits += item.quantity;
      if (item.product) {
        totalPrice += item.product.price * item.quantity;
      }
    }
    return { ...list, totalPrice, totalUnits };
  }

  const handleCreateList: NonNullable<ComponentProps<"form">["onSubmit"]> = async (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    setErrorMsg(null);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: newDesc.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        list?: { id: string; name: string; description: string | null; createdAt: string; updatedAt: string };
        message?: string;
      };

      if (!res.ok || !data.ok || !data.list) {
        setErrorMsg(data.message || "No pudimos crear la lista.");
        return;
      }

      const createdFull: ShoppingListFull = {
        id: data.list.id,
        name: data.list.name,
        description: data.list.description,
        createdAt: data.list.createdAt,
        updatedAt: data.list.updatedAt,
        items: [],
        totalPrice: 0,
        totalUnits: 0,
      };

      const nextLists = [createdFull, ...lists];
      setLists(nextLists);
      setSelectedId(createdFull.id);
      setNewName("");
      setNewDesc("");
      setStatusMsg(`Lista "${createdFull.name}" creada.`);
      window.dispatchEvent(
        new CustomEvent("nutrifind:lists-updated", { detail: { listCount: nextLists.length } }),
      );
    } catch {
      setErrorMsg("Error de conexión al crear la lista.");
    } finally {
      setCreating(false);
    }
  };

  async function handleDeleteList(listId: string, listName: string) {
    setErrorMsg(null);
    setStatusMsg(null);

    const prevLists = lists;
    const nextLists = lists.filter((l) => l.id !== listId);
    setLists(nextLists);
    if (selectedId === listId) {
      setSelectedId(nextLists[0]?.id ?? "");
    }

    try {
      const res = await fetch("/api/lists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId }),
      });
      if (!res.ok) {
        setLists(prevLists);
        setErrorMsg("No pudimos eliminar la lista.");
        return;
      }
      setStatusMsg(`Lista "${listName}" eliminada.`);
      window.dispatchEvent(
        new CustomEvent("nutrifind:lists-updated", { detail: { listCount: nextLists.length } }),
      );
    } catch {
      setLists(prevLists);
      setErrorMsg("Error de conexión al eliminar la lista.");
    }
  }

  async function handleQuantityChange(listId: string, productId: number, nextQuantity: number) {
    if (nextQuantity < 1 || nextQuantity > 99) return;
    setErrorMsg(null);

    const prevLists = lists;
    const updatedLists = lists.map((l) => {
      if (l.id !== listId) return l;
      const items = l.items.map((item) =>
        item.productId === productId ? { ...item, quantity: nextQuantity } : item,
      );
      return recomputeListTotals({ ...l, items });
    });
    setLists(updatedLists);

    try {
      const res = await fetch("/api/lists/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId, productId, quantity: nextQuantity }),
      });
      if (!res.ok) {
        setLists(prevLists);
        setErrorMsg("No pudimos actualizar la cantidad.");
      }
    } catch {
      setLists(prevLists);
      setErrorMsg("Error de conexión al actualizar la cantidad.");
    }
  }

  async function handleRemoveItem(listId: string, productId: number) {
    setErrorMsg(null);
    const prevLists = lists;
    const updatedLists = lists.map((l) => {
      if (l.id !== listId) return l;
      const items = l.items.filter((item) => item.productId !== productId);
      return recomputeListTotals({ ...l, items });
    });
    setLists(updatedLists);

    try {
      const res = await fetch("/api/lists/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId, productId }),
      });
      if (!res.ok) {
        setLists(prevLists);
        setErrorMsg("No pudimos quitar el producto.");
      }
    } catch {
      setLists(prevLists);
      setErrorMsg("Error de conexión al quitar el producto.");
    }
  }

  if (!schemaReady) {
    return (
      <div className="border-2 border-ink bg-white p-6 shadow-[4px_4px_0_#111111]">
        <p className="label-mono text-muted">Configuración pendiente en Supabase</p>
        <h2 className="mt-1 font-display text-xl font-black uppercase">
          Ejecuta los 3 bloques de 002_shopping_lists.sql
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed">
          Para comenzar a crear y guardar listas de productos en tu cuenta, ejecuta los 3 bloques modulares del archivo{" "}
          <code className="border border-ink bg-paper px-1.5 py-0.5 font-mono text-xs">
            NutriCode/docs/sql/002_shopping_lists.sql
          </code>{" "}
          en el SQL Editor de Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr] lg:gap-8 md:items-start">
      {/* Columna izquierda: Mis Playlists + Crear nueva */}
      <aside className="flex flex-col gap-5">
        <section className="border-2 border-ink bg-white shadow-[4px_4px_0_#111111]" aria-labelledby="my-lists-heading">
          <div className="flex items-center justify-between border-b-4 border-ink bg-ink px-4 py-3 text-paper">
            <h2 id="my-lists-heading" className="font-display text-sm font-black uppercase tracking-wide">
              Tus listas ({lists.length}/20)
            </h2>
            <span className="font-mono text-[11px] text-gold">Playlist</span>
          </div>

          {lists.length === 0 ? (
            <p className="p-4 text-xs leading-relaxed text-muted">
              Aún no has creado ninguna lista. Crea una abajo o pulsa el icono de guardar en cualquier producto del catálogo.
            </p>
          ) : (
            <ul className="divide-y divide-ink">
              {lists.map((list) => {
                const isSelected = selectedList?.id === list.id;
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(list.id)}
                      className={[
                        "flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors duration-150",
                        isSelected ? "bg-gold font-black text-ink" : "bg-white font-semibold hover:bg-paper",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{list.name}</p>
                        <p className="font-mono text-[11px] text-muted">
                          {list.items.length} {list.items.length === 1 ? "producto" : "productos"} ·{" "}
                          {list.totalUnits} {list.totalUnits === 1 ? "ud." : "uds."}
                        </p>
                      </div>
                      <span className="shrink-0 border border-ink bg-white px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">
                        {formatCLP(list.totalPrice)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Formulario para crear nueva lista */}
        <form
          onSubmit={handleCreateList}
          className="border-2 border-ink bg-white p-4 shadow-[4px_4px_0_#111111]"
        >
          <h3 className="font-display text-sm font-black uppercase tracking-tight">
            + Crear nueva lista
          </h3>
          <div className="mt-3 flex flex-col gap-2.5">
            <div>
              <label htmlFor="new-list-name" className="label-mono mb-1 block text-muted">
                Nombre de la lista
              </label>
              <input
                id="new-list-name"
                type="text"
                maxLength={60}
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Compra mensual sin gluten"
                className="h-10 w-full border-[1.5px] border-ink bg-paper px-3 text-sm focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="new-list-desc" className="label-mono mb-1 block text-muted">
                Nota o necesidad (opcional)
              </label>
              <input
                id="new-list-desc"
                type="text"
                maxLength={160}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Ej: Colaciones y desayunos de la semana"
                className="h-10 w-full border-[1.5px] border-ink bg-paper px-3 text-sm focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={creating || lists.length >= 20}
              className="mt-1 inline-flex min-h-11 cursor-pointer items-center justify-center border-2 border-ink bg-ink px-4 font-mono text-xs font-semibold uppercase text-paper transition-colors hover:bg-gold hover:text-ink disabled:opacity-50"
            >
              {creating ? "Creando..." : "Crear lista"}
            </button>
          </div>
        </form>
      </aside>

      {/* Columna derecha: Detalle de la lista seleccionada */}
      <section aria-live="polite">
        {errorMsg && (
          <div
            role="alert"
            className="mb-4 border-2 border-[#dc2626] bg-[#fef2f2] px-4 py-3 font-mono text-xs font-semibold text-[#991b1b]"
          >
            {errorMsg}
          </div>
        )}
        {statusMsg && (
          <div
            role="status"
            className="mb-4 border-2 border-ink bg-gold px-4 py-2.5 font-mono text-xs font-bold text-ink"
          >
            {statusMsg}
          </div>
        )}

        {!selectedList ? (
          <div className="border-2 border-ink bg-white p-8 text-center shadow-[4px_4px_0_#111111]">
            <p className="label-mono text-muted">Sin listas activas</p>
            <h3 className="mt-2 font-display text-2xl font-black uppercase">
              Arma tu primera lista de compras
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Guarda productos desde el catálogo como una playlist para organizar tus compras futuras y comparar cuánto te costará el total.
            </p>
            <a
              href="/"
              className="mt-5 inline-flex min-h-11 items-center border-2 border-ink bg-ink px-5 font-mono text-xs font-semibold uppercase text-paper hover:bg-gold hover:text-ink"
            >
              Explorar catálogo →
            </a>
          </div>
        ) : (
          <div className="border-2 border-ink bg-white shadow-[5px_5px_0_#111111]">
            {/* Encabezado de la Comanda / Etiqueta */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-8 border-ink p-5">
              <div>
                <p className="label-mono text-muted">Lista de productos</p>
                <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight sm:text-3xl">
                  {selectedList.name}
                </h2>
                {selectedList.description && (
                  <p className="mt-1 text-sm text-muted">{selectedList.description}</p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="border-2 border-ink bg-paper px-3.5 py-2 text-right shadow-[2px_2px_0_#111111]">
                  <span className="label-mono block text-[10px] text-muted">
                    Total estimado ({selectedList.totalUnits}{" "}
                    {selectedList.totalUnits === 1 ? "unidad" : "unidades"})
                  </span>
                  <span className="font-display text-2xl font-black tabular-nums text-ink">
                    {formatCLP(selectedList.totalPrice)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteList(selectedList.id, selectedList.name)}
                  className="cursor-pointer font-mono text-[11px] font-semibold uppercase text-[#991b1b] underline-offset-4 hover:underline"
                >
                  [ Eliminar esta lista ]
                </button>
              </div>
            </div>

            {/* Ítems de la lista */}
            {selectedList.items.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-bold">Esta lista aún no tiene productos guardados.</p>
                <p className="mt-1 text-sm text-muted">
                  Navega por el catálogo y pulsa el botón de marcador en los productos que quieras añadir a{" "}
                  <strong>{selectedList.name}</strong>.
                </p>
                <a
                  href="/"
                  className="mt-4 inline-flex min-h-11 items-center border-2 border-ink bg-ink px-4 font-mono text-xs font-semibold uppercase text-paper hover:bg-gold hover:text-ink"
                >
                  Buscar productos →
                </a>
              </div>
            ) : (
              <ul className="divide-y-2 divide-ink">
                {selectedList.items.map((item) => {
                  const p = item.product;
                  const img = p?.images[0];
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col justify-between gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6"
                    >
                      {/* Información del producto (flex-1 min-w-0 agrupa el texto sin empujar los controles) */}
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <a
                          href={`/producto/${item.productId}`}
                          className="grid h-18 w-18 shrink-0 place-items-center border-2 border-ink bg-white p-1.5 transition-transform duration-150 hover:scale-[1.03]"
                        >
                          {img ? (
                            <img
                              src={imageUrl(img, 120)}
                              alt=""
                              width="64"
                              height="64"
                              loading="lazy"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="label-mono text-[10px] text-muted">Sin foto</span>
                          )}
                        </a>
                        <div className="min-w-0 flex-1">
                          <p className="label-mono truncate text-muted">
                            {p ? `${p.brand} · ${p.store}` : `Producto #${item.productId}`}
                          </p>
                          <a
                            href={`/producto/${item.productId}`}
                            title={p?.name}
                            className="mt-0.5 block line-clamp-2 font-bold leading-snug text-balance hover:underline"
                          >
                            {p ? p.name : `Producto ID ${item.productId}`}
                          </a>
                          {p && (
                            <p className="mt-1 font-mono text-xs text-muted">
                              Unitario: <strong className="text-ink">{formatCLP(p.price)}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Barra de controles fija (shrink-0): Cantidad + Subtotal + Acciones alineados en columna */}
                      <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 border-t border-dashed border-ink/25 pt-3 sm:flex-nowrap lg:justify-end lg:gap-5 lg:border-t-0 lg:pt-0">
                        {/* Stepper editorial de 3 celdas con divisores */}
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Cantidad
                          </span>
                          <div
                            role="group"
                            aria-label="Selector de cantidad"
                            className="inline-flex h-9 items-stretch border-2 border-ink bg-white shadow-[2px_2px_0_#111111]"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(selectedList.id, item.productId, item.quantity - 1)
                              }
                              disabled={item.quantity <= 1}
                              aria-label="Disminuir cantidad"
                              className="inline-flex w-9 cursor-pointer items-center justify-center border-r-2 border-ink bg-white font-mono text-sm font-black text-ink transition-colors duration-120 hover:bg-ink hover:text-paper active:bg-ink active:text-paper disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted/50"
                            >
                              −
                            </button>
                            <span
                              aria-live="polite"
                              className="inline-flex min-w-11 items-center justify-center bg-paper px-2.5 font-mono text-xs font-black tabular-nums text-ink"
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(selectedList.id, item.productId, item.quantity + 1)
                              }
                              disabled={item.quantity >= 99}
                              aria-label="Aumentar cantidad"
                              className="inline-flex w-9 cursor-pointer items-center justify-center border-l-2 border-ink bg-white font-mono text-sm font-black text-ink transition-colors duration-120 hover:bg-gold hover:text-ink active:bg-gold disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted/50"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Subtotal de línea */}
                        <div className="min-w-26 text-right">
                          <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Subtotal
                          </span>
                          <span className="font-display text-xl font-black tabular-nums text-ink">
                            {p ? formatCLP(p.price * item.quantity) : "—"}
                          </span>
                        </div>

                        {/* Acciones: Ir a tienda / Quitar */}
                        <div className="flex items-center gap-2 self-end">
                          {p?.sourceUrl && (
                            <a
                              href={p.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-9 items-center gap-1 border-2 border-ink bg-white px-3 font-mono text-[11px] font-semibold uppercase text-ink shadow-[2px_2px_0_#111111] transition-[background-color,color,transform,box-shadow] duration-120 hover:-translate-y-0.5 hover:bg-ink hover:text-paper hover:shadow-[3px_3px_0_#111111] active:translate-y-0 active:shadow-none"
                            >
                              <span>Tienda</span>
                              <span aria-hidden="true">↗</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(selectedList.id, item.productId)}
                            aria-label="Quitar producto de la lista"
                            className="inline-flex h-9 cursor-pointer items-center gap-1.5 border-2 border-ink bg-[#fffafa] px-3 font-mono text-[11px] font-semibold uppercase text-[#991b1b] shadow-[2px_2px_0_#111111] transition-[background-color,color,transform,box-shadow] duration-120 hover:-translate-y-0.5 hover:bg-[#fef2f2] hover:text-[#7f1d1d] hover:shadow-[3px_3px_0_#111111] active:translate-y-0 active:shadow-none"
                          >
                            <span aria-hidden="true">✕</span>
                            <span>Quitar</span>
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
