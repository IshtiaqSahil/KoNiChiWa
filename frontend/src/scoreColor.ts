// Shared score -> colour mapping. Thresholds deliberately line up with the
// certification tier bands in backend/src/scoring/weights.ts, so a bar
// dropping a shade on the dashboard means the same thing as the tier label
// dropping out of "Strong". If those bands are retuned, retune these.
// Colour scale is deliberately monochrome-cold rather than a traffic light
// (green/amber/red): --pass/--warn/--fail step from vivid blue down through
// dull grey, so "good" reads as saturated and "bad" reads as lifeless
// without introducing a warm hue anywhere on the page.
export function scoreColor(score: number): string {
  if (score >= 75) return "var(--pass)";
  if (score >= 40) return "var(--warn)";
  return "var(--fail)";
}

export function tierClass(score: number): "pass" | "warn" | "fail" {
  if (score >= 75) return "pass";
  if (score >= 40) return "warn";
  return "fail";
}
