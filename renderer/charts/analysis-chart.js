import { esc, numberText } from "../core.js";

const BAND_LABELS = Object.freeze({ pre: "Pre-request", primary: "Primary", post: "Post-request" });

function bandValues(data = {}) {
  return ["pre", "primary", "post"].map((name) => {
    const band = data[name] || {};
    const proportion = band.proportion === null || band.proportion === undefined ? null : Number(band.proportion);
    return {
      name,
      label: BAND_LABELS[name],
      proportion: Number.isFinite(proportion) ? proportion : null,
      deviation: Number.isFinite(proportion) ? Math.abs(proportion - 0.5) * 2 : null,
      expectedCount: band.expectedCount,
      observedCount: band.observedCount,
    };
  });
}

/* Accessible SVG chart: each band is tied to the exact persisted region. */
export function renderAnalysisBands(data = {}) {
  const bands = bandValues(data);
  const width = 620;
  const chartHeight = 180;
  const baseline = chartHeight - 30;
  const step = width / bands.length;
  const points = bands.map((band, index) => {
    const value = band.deviation === null ? 0 : band.deviation;
    return `${(index + 0.5) * step},${baseline - value * (chartHeight - 60)}`;
  }).join(" ");
  const bars = bands.map((band, index) => {
    const x = index * step + 28;
    const height = band.deviation === null ? 0 : band.deviation * (chartHeight - 60);
    const y = baseline - height;
    const aria = band.proportion === null ? "not recorded" : `${(band.proportion * 100).toFixed(1)} percent match proportion`;
    return `<rect x="${x}" y="${y}" width="${Math.max(24, step - 56)}" height="${height}" rx="6" aria-label="${esc(band.label)} ${esc(aria)}" class="analysis-bar"></rect>`;
  }).join("");
  const labels = bands.map((band, index) => `<text x="${(index + 0.5) * step}" y="${chartHeight - 8}" text-anchor="middle">${esc(band.name)}</text>`).join("");
  const legend = bands.map((band) => `<span><strong>${esc(band.label)}</strong>: ${band.proportion === null ? "UNKNOWN" : `${numberText(band.proportion * 100, 1)}%`} · ${band.observedCount ?? 0}/${band.expectedCount ?? 0}</span>`).join("");
  return `<div class="analysis-chart" role="img" aria-label="Cumulative requested-direction deviation across exact pre, primary, and post regions"><svg viewBox="0 0 ${width} ${chartHeight}" preserveAspectRatio="none"><line x1="0" y1="${baseline}" x2="${width}" y2="${baseline}" class="analysis-baseline"></line>${bars}<polyline points="${points}" class="analysis-line"></polyline>${labels}</svg><div class="analysis-legend">${legend}</div></div>`;
}

export default renderAnalysisBands;
