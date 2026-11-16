import { useMemo, useState } from "react";
import { formatCLP } from "../../lib/format.ts";
import type { PriceHistoryPoint } from "../../lib/products.ts";

interface PriceHistoryChartProps {
  productId: number;
  productName: string;
  currentPrice: number;
  store: string;
  updatedAt: string;
  points: PriceHistoryPoint[];
  defaultExpanded?: boolean;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Reciente";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Santiago",
  })
    .format(d)
    .replace(".", "");
}

function fullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Captura reciente";
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Santiago",
  })
    .format(d)
    .replace(".", "");
}

export default function PriceHistoryChart({
  productId,
  currentPrice,
  store,
  updatedAt,
  points,
  defaultExpanded = true,
}: PriceHistoryChartProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [demoMode, setDemoMode] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const realPoints = useMemo<PriceHistoryPoint[]>(() => {
    if (points && points.length > 0) return points;
    return [
      {
        id: 0,
        productId,
        store,
        price: currentPrice,
        capturedAt: updatedAt,
      },
    ];
  }, [currentPrice, points, productId, store, updatedAt]);

  const demoPoints = useMemo<PriceHistoryPoint[]>(() => {
    const baseDate = new Date(updatedAt);
    const anchorMs = Number.isNaN(baseDate.getTime()) ? Date.now() : baseDate.getTime();
    const dayMs = 86_400_000;
    const multipliers = [1.06, 1.06, 1.11, 0.93, 0.98, 1.0];
    const offsetsDays = [35, 28, 21, 14, 7, 0];

    return multipliers.map((mult, idx) => {
      const rawPrice = idx === multipliers.length - 1 ? currentPrice : Math.round((currentPrice * mult) / 10) * 10;
      return {
        id: idx + 1,
        productId,
        store,
        price: Math.max(100, rawPrice),
        capturedAt: new Date(anchorMs - offsetsDays[idx] * dayMs).toISOString(),
      };
    });
  }, [currentPrice, productId, store, updatedAt]);

  const activePoints = demoMode ? demoPoints : realPoints;
  const isSinglePoint = activePoints.length === 1;

  const stats = useMemo(() => {
    const prices = activePoints.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const latest = activePoints[activePoints.length - 1];
    const minPoint = activePoints.find((p) => p.price === minPrice) ?? latest;
    const diffFromMaxPct =
      maxPrice > 0 && maxPrice !== latest.price
        ? (((latest.price - maxPrice) / maxPrice) * 100).toFixed(1).replace(".", ",")
        : "0,0";

    return {
      latest,
      minPrice,
      maxPrice,
      minPoint,
      diffFromMaxPct,
    };
  }, [activePoints]);

  // Geometría del lienzo SVG
  const chartLeft = 72;
  const chartRight = 500;
  const chartTop = 28;
  const chartBottom = 136;
  const baselineY = 152;

  const yBounds = useMemo(() => {
    if (isSinglePoint) {
      const delta = Math.max(500, Math.round((currentPrice * 0.1) / 100) * 100);
      return {
        topPrice: currentPrice + delta,
        midPrice: currentPrice,
        bottomPrice: Math.max(0, currentPrice - delta),
      };
    }
    const min = stats.minPrice;
    const max = stats.maxPrice;
    if (min === max) {
      const delta = Math.max(500, Math.round((min * 0.1) / 100) * 100);
      return {
        topPrice: max + delta,
        midPrice: max,
        bottomPrice: Math.max(0, min - delta),
      };
    }
    const mid = Math.round((min + max) / 20) * 10;
    return {
      topPrice: max,
      midPrice: mid,
      bottomPrice: min,
    };
  }, [currentPrice, isSinglePoint, stats.maxPrice, stats.minPrice]);

  const coords = useMemo(() => {
    if (isSinglePoint) {
      return [
        {
          x: 452,
          y: 82,
          point: activePoints[0],
          isMin: true,
          isLatest: true,
        },
      ];
    }

    const count = activePoints.length;
    const spanX = chartRight - chartLeft - 36;
    const startX = chartLeft + 18;
    const priceSpan = Math.max(1, yBounds.topPrice - yBounds.bottomPrice);

    return activePoints.map((pt, idx) => {
      const x = count === 1 ? 452 : Math.round(startX + (idx / (count - 1)) * spanX);
      const ratio = (yBounds.topPrice - pt.price) / priceSpan;
      const y = Math.round(chartTop + ratio * (chartBottom - chartTop));
      return {
        x,
        y,
        point: pt,
        isMin: pt.price === stats.minPrice,
        isLatest: idx === count - 1,
      };
    });
  }, [activePoints, isSinglePoint, stats.minPrice, yBounds.bottomPrice, yBounds.topPrice]);

  const activeNode =
    hoveredIdx !== null && coords[hoveredIdx]
      ? coords[hoveredIdx]
      : isSinglePoint
        ? coords[0]
        : null;

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPoints =
    coords.length > 1
      ? `${polylinePoints} ${coords[coords.length - 1].x},${baselineY} ${coords[0].x},${baselineY}`
      : "";

  return (
    <section
      className={[
        "border-2 border-ink bg-white",
        expanded ? "flex flex-1 flex-col" : "",
      ].join(" ")}
      aria-labelledby="price-history-heading"
    >
      {/* Cabecera tipo Tarjeta Clickeable (Divulgación Progresiva) */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="price-history-panel"
        className={[
          "group flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors duration-150",
          expanded ? "border-b-8 border-ink bg-white" : "bg-white hover:bg-paper",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="square"
              strokeLinejoin="miter"
              aria-hidden="true"
              className="shrink-0 text-ink"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <h2 id="price-history-heading" className="font-display text-lg font-black uppercase tracking-tight">
              Historial de precios
            </h2>
            <span className="border border-ink bg-paper px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
              {realPoints.length} {realPoints.length === 1 ? "captura" : "capturas"}
            </span>
          </div>
          {!expanded && (
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {store} · Mínimo registrado: <strong className="text-ink">{formatCLP(stats.minPrice)}</strong> · Actual:{" "}
              <strong className="text-ink">{formatCLP(currentPrice)}</strong>
            </p>
          )}
        </div>

        <span className="inline-flex shrink-0 items-center gap-1.5 border-2 border-ink bg-paper px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase text-ink shadow-[2px_2px_0_#111111] transition-[background-color,transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-hover:bg-gold group-hover:shadow-[3px_3px_0_#111111]">
          <span>{expanded ? "Ocultar" : "Ver gráfica"}</span>
          <span
            aria-hidden="true"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            className="inline-block text-[10px]"
          >
            ▾
          </span>
        </span>
      </button>

      {/* Contenedor colapsable con animación suave */}
      <div
        id="price-history-panel"
        className={expanded ? "flex flex-1 flex-col" : ""}
        style={{
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transition:
            "grid-template-rows 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="flex flex-col overflow-hidden">
          {/* Sub-barra compacta en 1 sola línea cuando solo hay 1 captura real */}
          {realPoints.length < 2 && (
            <div className="flex items-center justify-between gap-2 border-b border-ink bg-paper px-3.5 py-2">
              <span className="truncate font-mono text-[11px] text-muted">
                {demoMode
                  ? "Vista previa de 6 capturas"
                  : `Seguimiento activo en ${store} (#${productId})`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setDemoMode((v) => !v);
                  setHoveredIdx(null);
                }}
                className={[
                  "shrink-0 cursor-pointer border-[1.5px] border-ink px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase shadow-[2px_2px_0_#111111] transition-colors",
                  demoMode
                    ? "bg-gold text-ink hover:bg-white"
                    : "bg-white text-ink hover:bg-gold",
                ].join(" ")}
              >
                {demoMode ? "[ ✓ Demo activa · Ver real ]" : "[ Ver curva demo ]"}
              </button>
            </div>
          )}

          {/* 3 Celdas KPI Superiores */}
          <div className="grid grid-cols-3 border-b-2 border-ink">
            <div className="border-r border-ink p-3">
              <span className="block font-mono text-[10px] font-semibold uppercase text-muted">
                Precio actual
              </span>
              <span className="mt-0.5 block font-display text-lg font-black tabular-nums sm:text-xl">
                {formatCLP(stats.latest.price)}
              </span>
              <span className="mt-0.5 block font-mono text-[10px] text-muted">
                {store} · Vigente
              </span>
            </div>

            <div
              className={[
                "border-r border-ink p-3",
                !isSinglePoint ? "bg-[#f0fdf4]" : "bg-white",
              ].join(" ")}
            >
              <span
                className={[
                  "block font-mono text-[10px] font-semibold uppercase",
                  !isSinglePoint ? "text-best-price" : "text-muted",
                ].join(" ")}
              >
                Mínimo registrado
              </span>
              <span
                className={[
                  "mt-0.5 block font-display text-lg font-black tabular-nums sm:text-xl",
                  !isSinglePoint ? "text-best-price" : "text-ink",
                ].join(" ")}
              >
                {formatCLP(stats.minPrice)}
              </span>
              <span
                className={[
                  "mt-0.5 block font-mono text-[10px]",
                  !isSinglePoint ? "text-best-price" : "text-muted",
                ].join(" ")}
              >
                {shortDate(stats.minPoint.capturedAt)}
              </span>
            </div>

            <div className="bg-[#fcfaf5] p-3">
              <span className="block font-mono text-[10px] font-semibold uppercase text-muted">
                {isSinglePoint ? "Variación" : "Máximo registrado"}
              </span>
              <span className="mt-0.5 block font-display text-lg font-black tabular-nums sm:text-xl">
                {isSinglePoint ? "0,0%" : formatCLP(stats.maxPrice)}
              </span>
              <span
                className={[
                  "mt-0.5 block font-mono text-[10px]",
                  !isSinglePoint && stats.latest.price < stats.maxPrice
                    ? "font-semibold text-best-price"
                    : "text-muted",
                ].join(" ")}
              >
                {isSinglePoint
                  ? "1ª captura oficial"
                  : `${stats.diffFromMaxPct}% vs. máximo`}
              </span>
            </div>
          </div>

          {/* Lienzo SVG */}
          <div className="flex flex-1 items-center bg-white px-3.5 pt-4 pb-2.5">
            <svg
              viewBox="0 0 520 185"
              className="block h-auto w-full overflow-visible"
              role="img"
              aria-label={`Gráfico de evolución de precio en ${store}`}
            >
              {/* Líneas horizontales de referencia */}
              <line
                x1={chartLeft}
                y1={chartTop}
                x2={chartRight}
                y2={chartTop}
                stroke="#d8d3c8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={chartLeft}
                y1={82}
                x2={chartRight}
                y2={82}
                stroke={isSinglePoint ? "#111111" : "#d8d3c8"}
                strokeWidth={isSinglePoint ? "1.5" : "1"}
                strokeDasharray={isSinglePoint ? "5 4" : "3 3"}
              />
              <line
                x1={chartLeft}
                y1={chartBottom}
                x2={chartRight}
                y2={chartBottom}
                stroke={isSinglePoint ? "#d8d3c8" : "#15803d"}
                strokeWidth={isSinglePoint ? "1" : "1.2"}
                strokeDasharray="4 3"
              />

              {/* Eje Y ($ CLP) */}
              <text
                x="64"
                y="32"
                textAnchor="end"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="10"
                fill="#5c5c5c"
              >
                {formatCLP(yBounds.topPrice)}
              </text>
              <text
                x="64"
                y="86"
                textAnchor="end"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="10"
                fontWeight={isSinglePoint ? "700" : "500"}
                fill={isSinglePoint ? "#111111" : "#5c5c5c"}
              >
                {formatCLP(yBounds.midPrice)}
              </text>
              <text
                x="64"
                y="140"
                textAnchor="end"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="10"
                fontWeight={isSinglePoint ? "500" : "700"}
                fill={isSinglePoint ? "#5c5c5c" : "#15803d"}
              >
                {formatCLP(yBounds.bottomPrice)}
              </text>

              {/* Eje X base */}
              <line
                x1={chartLeft}
                y1={baselineY}
                x2={chartRight}
                y2={baselineY}
                stroke="#111111"
                strokeWidth="2"
              />

              {isSinglePoint ? (
                <>
                  <text
                    x="110"
                    y="170"
                    textAnchor="middle"
                    fontFamily="IBM Plex Mono, monospace"
                    fontSize="10"
                    fill="#8a8a8a"
                  >
                    Previo (Sin reg.)
                  </text>
                  <text
                    x="275"
                    y="170"
                    textAnchor="middle"
                    fontFamily="IBM Plex Mono, monospace"
                    fontSize="10"
                    fill="#8a8a8a"
                  >
                    Inicio seguimiento
                  </text>
                  <text
                    x="452"
                    y="170"
                    textAnchor="middle"
                    fontFamily="IBM Plex Mono, monospace"
                    fontSize="10"
                    fontWeight="700"
                    fill="#111111"
                  >
                    {fullDate(activePoints[0].capturedAt)}
                  </text>

                  {/* Etiqueta de línea base */}
                  <rect
                    x="82"
                    y="69"
                    width="182"
                    height="22"
                    fill="#f4f1ea"
                    stroke="#111111"
                    strokeWidth="1.2"
                  />
                  <text
                    x="90"
                    y="83"
                    fontFamily="IBM Plex Mono, monospace"
                    fontSize="10"
                    fontWeight="600"
                    fill="#111111"
                  >
                    PRECIO BASE: {formatCLP(currentPrice)}
                  </text>

                  {/* Guía vertical en captura actual */}
                  <line
                    x1="452"
                    y1={chartTop}
                    x2="452"
                    y2={baselineY}
                    stroke="#111111"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />

                  {/* Nodo activo único */}
                  <rect
                    x="444"
                    y="74"
                    width="16"
                    height="16"
                    fill="#d19d38"
                    stroke="#111111"
                    strokeWidth="2"
                  />
                  <rect x="449" y="79" width="6" height="6" fill="#111111" />
                </>
              ) : (
                <>
                  {/* Área bajo la curva */}
                  <polygon points={areaPoints} fill="#d19d38" fillOpacity="0.14" />

                  {/* Polilínea de evolución */}
                  <polyline
                    fill="none"
                    stroke="#111111"
                    strokeWidth="3"
                    strokeLinejoin="miter"
                    points={polylinePoints}
                  />

                  {/* Fechas eje X y nodos interactivos */}
                  {coords.map((c, idx) => {
                    const isHovered = hoveredIdx === idx;
                    const size = c.isLatest || isHovered ? 14 : c.isMin ? 12 : 10;
                    const fill = c.isLatest
                      ? "#d19d38"
                      : c.isMin
                        ? "#15803d"
                        : isHovered
                          ? "#d19d38"
                          : "#ffffff";
                    return (
                      <g
                        key={`${c.point.id}-${idx}`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        <text
                          x={c.x}
                          y="170"
                          textAnchor="middle"
                          fontFamily="IBM Plex Mono, monospace"
                          fontSize="10"
                          fontWeight={c.isLatest || c.isMin || isHovered ? "700" : "500"}
                          fill={c.isMin ? "#15803d" : c.isLatest || isHovered ? "#111111" : "#5c5c5c"}
                        >
                          {shortDate(c.point.capturedAt)}
                        </text>
                        {/* Área táctil invisible ampliada */}
                        <circle cx={c.x} cy={c.y} r="16" fill="transparent" />
                        <rect
                          x={c.x - size / 2}
                          y={c.y - size / 2}
                          width={size}
                          height={size}
                          fill={fill}
                          stroke="#111111"
                          strokeWidth="2"
                        />
                      </g>
                    );
                  })}
                </>
              )}

              {/* Tooltip de inspección (visible al pasar el cursor en curva o fijo en captura única) */}
              {activeNode && (
                <g
                  transform={`translate(${Math.min(Math.max(activeNode.x - 110, 78), 344)}, ${Math.max(activeNode.y - 52, 8)})`}
                >
                  <rect x="0" y="0" width="152" height="38" fill="#111111" />
                  <text
                    x="10"
                    y="15"
                    fontFamily="IBM Plex Mono, monospace"
                    fontSize="10"
                    fill="#d19d38"
                    fontWeight="700"
                  >
                    {activeNode.isLatest ? "ACTUAL" : "CAPTURA"} · {shortDate(activeNode.point.capturedAt).toUpperCase()}
                  </text>
                  <text
                    x="10"
                    y="30"
                    fontFamily="IBM Plex Mono, monospace"
                    fontSize="12"
                    fill="#f4f1ea"
                    fontWeight="700"
                  >
                    {activeNode.point.store}: {formatCLP(activeNode.point.price)}
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Pie del gráfico */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-ink bg-paper px-3.5 py-2 font-mono text-[11px] text-muted">
            <span>
              <span
                className={[
                  "mr-1.5 inline-block size-2 border border-ink",
                  demoMode ? "bg-best-price" : "bg-gold",
                ].join(" ")}
              />
              {demoMode
                ? "Pasa el cursor sobre cada nodo para inspeccionar fecha y precio"
                : isSinglePoint
                  ? "Se registrará un nuevo punto automáticamente con cada barrido del scraper"
                  : `${activePoints.length} capturas históricas almacenadas en Supabase`}
            </span>
            <strong className="text-ink">
              {demoMode ? "MODO DEMO" : "DATO REAL · CLP"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
