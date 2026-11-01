const clp = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Santiago",
});

export function formatCLP(n: number): string {
  return `$${clp.format(n)}`;
}

const SIZE_PATTERN = /(\d+(?:[.,]\d+)?)\s?(kg|gr|g|ml|cc|l)\b/i;

export function extractSize(name: string): string | undefined {
  const m = name.match(SIZE_PATTERN);
  if (!m) return undefined;
  const unit = m[2].toLowerCase();
  return `${m[1]} ${unit === "gr" ? "g" : unit}`;
}

export function imageUrl(url: string, px: number): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.hostname !== "i5.walmartimages.cl") return url;
  u.searchParams.set("odnHeight", String(px));
  u.searchParams.set("odnWidth", String(px));
  return u.toString();
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso)).replaceAll(".", "");
}
