import { esc } from "../core.js";

export function renderDistribution(counts = {}) {
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (!entries.length) return '<div class="empty">No distribution recorded.</div>';
  // Calibration may legitimately cover a large enumerated space.  Keep the
  // authoritative counts intact but cap DOM rows to avoid turning a report
  // into a 100k-node render; the remainder is represented transparently.
  const MAX_VISIBLE_BARS = 64;
  const visible = entries.length > MAX_VISIBLE_BARS
    ? (() => {
      const ranked = [...entries].sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0));
      const head = ranked.slice(0, MAX_VISIBLE_BARS - 1);
      const remainder = ranked.slice(MAX_VISIBLE_BARS - 1).reduce((sum, [, value]) => sum + Number(value || 0), 0);
      return [...head, ["OTHER (truncated)", remainder]];
    })()
    : entries;
  return `<div class="distribution-chart">${visible.map(([key, value]) => {
    const count = Number(value || 0);
    const width = total ? Math.max(2, Math.round(count / total * 100)) : 2;
    return `<div class="bar-row"><span>${esc(key)}</span><span class="bar" style="width:${width}%" role="img" aria-label="${esc(key)} ${count} of ${total}"></span><strong>${count}</strong></div>`;
  }).join("")}</div>`;
}

export default renderDistribution;
