import { esc } from "../core.js";

export function renderDistribution(counts = {}) {
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (!entries.length) return '<div class="empty">No distribution recorded.</div>';
  return `<div class="distribution-chart">${entries.map(([key, value]) => {
    const count = Number(value || 0);
    const width = total ? Math.max(2, Math.round(count / total * 100)) : 2;
    return `<div class="bar-row"><span>${esc(key)}</span><span class="bar" style="width:${width}%" role="img" aria-label="${esc(key)} ${count} of ${total}"></span><strong>${count}</strong></div>`;
  }).join("")}</div>`;
}

export default renderDistribution;
