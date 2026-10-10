import { lookupUnit, splitValueAndUnit } from './parse';
import { QUANTITIES, type QuantityDef } from './units';

export interface SearchHit {
  quantity: QuantityDef;
  /** Why it matched, shown to the user. */
  reason: string;
  /** Present when the query was "value + unit", e.g. "100 uF". */
  carry?: { text: string; unit: string };
}

/**
 * Category search over names, keywords, unit symbols, unit names and
 * aliases. "uF" finds Capacitance; "100 uF" also carries the value over.
 */
export function searchQuantities(raw: string): SearchHit[] {
  const q = raw.trim();
  if (q === '') return QUANTITIES.map((quantity) => ({ quantity, reason: '' }));
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const add = (h: SearchHit) => {
    if (seen.has(h.quantity.id)) return;
    seen.add(h.quantity.id);
    hits.push(h);
  };

  const { numberText, unitText } = splitValueAndUnit(q);
  if (numberText !== '' && unitText !== '') {
    const u = lookupUnit(unitText);
    if (u && !u.paramOnly) {
      const def = QUANTITIES.find((x) => x.id === u.quantity)!;
      add({ quantity: def, reason: `${numberText} ${u.symbol}`, carry: { text: q, unit: u.id } });
    }
  }
  const unit = lookupUnit(q);
  if (unit && !unit.paramOnly) add({ quantity: QUANTITIES.find((x) => x.id === unit.quantity)!, reason: `unit ${unit.symbol} (${unit.name})` });

  const lower = q.toLowerCase();
  for (const def of QUANTITIES) {
    if (def.name.toLowerCase().includes(lower)) add({ quantity: def, reason: '' });
  }
  for (const def of QUANTITIES) {
    const kw = def.keywords.find((k) => k.includes(lower) || (lower.length >= 3 && lower.includes(k)));
    if (kw) add({ quantity: def, reason: `related: ${kw}` });
  }
  for (const def of QUANTITIES) {
    const u = def.units.find(
      (x) => !x.paramOnly && (x.symbol.toLowerCase() === lower || x.name.toLowerCase().includes(lower) || x.aliases.some((a) => a.toLowerCase() === lower)),
    );
    if (u) add({ quantity: def, reason: `unit ${u.symbol}` });
  }
  return hits;
}
