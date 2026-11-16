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

export type ProductSpecAnalysis = {
  packUnits?: number;
  formatValue: string;
  formatSublabel: string;
  unitReferenceLabel: string;
  unitReferenceValue: string;
  unitReferenceSublabel: string;
  attributes: string[];
  presentationSummary: string;
};

export function analyzeProductSpecs(name: string, price: number): ProductSpecAnalysis {
  const packMatch = name.match(/\bpack\s*(?:de\s*)?(\d+)\b/i);
  const packUnits = packMatch ? Number(packMatch[1]) : undefined;
  const validPack = packUnits && Number.isFinite(packUnits) && packUnits > 1 ? packUnits : undefined;

  const sizeMatch = name.match(SIZE_PATTERN);
  const sizeText = extractSize(name);

  let formatValue = sizeText ?? "1 unidad";
  let formatSublabel = sizeText ? "Envase individual" : "Formato estándar";
  let unitReferenceLabel = "Valor unitario";
  let unitReferenceValue = formatCLP(price);
  let unitReferenceSublabel = "Precio por envase";
  let presentationSummary = sizeText ? `Envase individual · ${sizeText}` : "Formato unitario estándar";

  if (validPack) {
    const perUnit = Math.round(price / validPack);
    formatValue = `Pack ${validPack} uds.`;
    formatSublabel = sizeText ? `Formato ${sizeText} c/u` : `${validPack} unidades por pack`;
    unitReferenceLabel = "Valor por unidad";
    unitReferenceValue = `${formatCLP(perUnit)} c/u`;
    unitReferenceSublabel = `Base pack ${validPack} uds.`;
    presentationSummary = sizeText
      ? `Pack ahorro · ${validPack} uds. (${sizeText})`
      : `Pack ahorro · ${validPack} unidades`;
  } else if (sizeMatch) {
    const rawNum = Number(sizeMatch[1].replace(",", "."));
    const unit = sizeMatch[2].toLowerCase();
    const isLiquid = unit === "l" || unit === "ml" || unit === "cc";
    const multiplier = unit === "kg" || unit === "l" ? 1000 : 1;
    const totalBase = rawNum * multiplier;

    if (Number.isFinite(totalBase) && totalBase > 0) {
      const per100 = Math.round((price / totalBase) * 100);
      unitReferenceLabel = isLiquid ? "Ref. por 100 ml" : "Ref. por 100 g";
      unitReferenceValue = formatCLP(per100);
      unitReferenceSublabel = isLiquid ? "Cálculo por 100 ml" : "Cálculo por 100 g";
    }
  }

  const attributes: string[] = ["Sin gluten"];
  if (/\bvegan[oa]s?\b/i.test(name)) attributes.push("Vegano");
  if (/\bsin\s+(?:az[uú]car|endulzar)\b/i.test(name)) attributes.push("Sin endulzar");
  if (/\borg[aá]nic[oa]s?\b/i.test(name)) attributes.push("Orgánico");
  if (/\bintegral(?:es)?\b/i.test(name)) attributes.push("Integral");
  if (/\bsin\s+lactosa\b/i.test(name)) attributes.push("Sin lactosa");

  return {
    packUnits: validPack,
    formatValue,
    formatSublabel,
    unitReferenceLabel,
    unitReferenceValue,
    unitReferenceSublabel,
    attributes,
    presentationSummary,
  };
}
