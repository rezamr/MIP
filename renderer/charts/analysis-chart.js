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

function cumulativeSeries(data = {}) {
  const source = data.decimatedCumulativeSignedSeries || data.cumulativeSignedSeries || [];
  return Array.isArray(source)
    ? source.map((point, fallbackIndex) => ({
      index: Number(point?.index ?? fallbackIndex),
      value: Number(point?.cumulativeSigned ?? point?.signedDeviation ?? point?.value ?? 0),
    })).filter((point) => Number.isFinite(point.index) && Number.isFinite(point.value))
    : [];
}

function cumulativeChart(data = {}) {
  const width = 760;
  const height = 270;
  const left = 46;
  const right = 18;
  const top = 24;
  const bottom = 42;
  const series = cumulativeSeries(data);
  const boundaries = data.boundaries || {};
  const finalIndex = Math.max(1, Number(data.total || series.at(-1)?.index || 1) - 1);
  const threshold = Math.abs(Number(data.thresholdCrossing?.threshold ?? data.threshold ?? 0));
  const maxAbs = Math.max(1, threshold, ...series.map((point) => Math.abs(point.value)));
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const mid = top + plotHeight / 2;
  const x = (index) => left + Math.max(0, Math.min(finalIndex, index)) / finalIndex * plotWidth;
  const y = (value) => mid - (value / maxAbs) * (plotHeight / 2 - 8);
  const points = series.map((point) => `${x(point.index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const thresholdLines = threshold > 0
    ? `<line x1="${left}" y1="${y(threshold)}" x2="${width - right}" y2="${y(threshold)}" class="analysis-threshold"></line><line x1="${left}" y1="${y(-threshold)}" x2="${width - right}" y2="${y(-threshold)}" class="analysis-threshold"></line>`
    : "";
  const boundaryLines = ["pre", "primary", "post"].flatMap((name) => {
    const range = boundaries[name];
    if (!Array.isArray(range) || range.length < 2) return [];
    const boundary = Number(range[0]);
    return boundary > 0 ? [`<line x1="${x(boundary)}" y1="${top}" x2="${x(boundary)}" y2="${height - bottom}" class="analysis-boundary"></line><text x="${x(boundary) + 4}" y="${top + 14}" class="analysis-boundary-label">${esc(BAND_LABELS[name])}</text>`] : [];
  }).join("");
  const labels = [
    `<text x="${left - 8}" y="${y(maxAbs) + 4}" text-anchor="end">+${numberText(maxAbs, 1)}</text>`,
    `<text x="${left - 8}" y="${mid + 4}" text-anchor="end">0</text>`,
    `<text x="${left - 8}" y="${y(-maxAbs) + 4}" text-anchor="end">-${numberText(maxAbs, 1)}</text>`,
    `<text x="${left}" y="${height - 10}">output sequence</text>`,
  ].join("");
  const aria = series.length
    ? `Cumulative signed requested-direction deviation from ${series[0].index} through ${series.at(-1).index}; positive values favor the requested direction.`
    : "Cumulative signed requested-direction deviation is not recorded.";
  return `<div class="analysis-series" role="img" aria-label="${esc(aria)}"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><line x1="${left}" y1="${mid}" x2="${width - right}" y2="${mid}" class="analysis-baseline"></line>${thresholdLines}${boundaryLines}${points ? `<polyline points="${points}" class="analysis-line"></polyline>` : ""}${labels}</svg><div class="analysis-series-legend"><span>Signed cumulative deviation</span><span>Positive = requested direction</span><span>Threshold ±${numberText(threshold, 1)}</span></div></div>`;
}

function regionSummary(data = {}) {
  const bands = bandValues(data);
  const width = 620;
  const chartHeight = 170;
  const baseline = chartHeight - 28;
  const step = width / bands.length;
  const bars = bands.map((band, index) => {
    const x = index * step + 28;
    const height = band.deviation === null ? 0 : band.deviation * (chartHeight - 62);
    const y = baseline - height;
    const aria = band.proportion === null ? "not recorded" : `${(band.proportion * 100).toFixed(1)} percent match proportion`;
    return `<rect x="${x}" y="${y}" width="${Math.max(24, step - 56)}" height="${height}" rx="6" aria-label="${esc(band.label)} ${esc(aria)}" class="analysis-bar"></rect>`;
  }).join("");
  const labels = bands.map((band, index) => `<text x="${(index + 0.5) * step}" y="${chartHeight - 8}" text-anchor="middle">${esc(band.name)}</text>`).join("");
  const legend = bands.map((band) => `<span><strong>${esc(band.label)}</strong>: ${band.proportion === null ? "UNKNOWN" : `${numberText(band.proportion * 100, 1)}%`} · ${band.observedCount ?? 0}/${band.expectedCount ?? 0}</span>`).join("");
  return `<div class="analysis-regions" aria-label="Region match proportions"><svg viewBox="0 0 ${width} ${chartHeight}" preserveAspectRatio="none"><line x1="0" y1="${baseline}" x2="${width}" y2="${baseline}" class="analysis-baseline"></line>${bars}${labels}</svg><div class="analysis-legend">${legend}</div></div>`;
}

/*
 * The previous chart called a three-bar region summary “cumulative”. Keep the
 * summary for review, but make the primary chart a genuine output-over-time
 * cumulative signed series with exact persisted boundaries and threshold
 * markers. Raw evidence is never transformed in storage; only the persisted
 * decimated series is drawn here.
 */
export function renderAnalysisBands(data = {}) {
  return `<div class="analysis-chart"><h4>Cumulative requested-direction deviation</h4>${cumulativeChart(data)}<h4 style="margin-top:16px">Region match proportions</h4>${regionSummary(data)}</div>`;
}

export default renderAnalysisBands;
