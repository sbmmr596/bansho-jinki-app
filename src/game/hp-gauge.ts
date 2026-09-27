/** 100% is green, 0% is red. Hue only — saturation stays steady. */
export function hpGaugeColor(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  const hue = Math.round(122 * t);
  return `hsl(${hue} 72% 42%)`;
}
