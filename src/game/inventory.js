// Ryggsäcken: enkel lista med föremål (staplas per typ).
export const INV = { slots: [], max: 18 };

export function invAdd(type, extra = {}) {
  const s = INV.slots.find((x) => x.type === type && !extra.lore);
  if (s) { s.n++; return true; }
  if (INV.slots.length >= INV.max) return false;
  INV.slots.push({ type, n: 1, extra });
  return true;
}
export function invCount(type) { const s = INV.slots.find((x) => x.type === type); return s ? s.n : 0; }
export function invHas(type, n = 1) { return invCount(type) >= n; }
export function invTake(type, n = 1) {
  const s = INV.slots.find((x) => x.type === type);
  if (!s || s.n < n) return false;
  s.n -= n;
  if (s.n <= 0) INV.slots.splice(INV.slots.indexOf(s), 1);
  return true;
}
