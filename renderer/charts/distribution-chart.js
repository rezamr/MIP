import { esc } from "../core.js";

function numberLabel(value) {
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat().format(Number(value)) : String(value ?? "—");
}

function rangeBuckets(entries, statistics) {
  const space = statistics?.outcomeSpace;
  if (space?.type !== "INTEGER_RANGE") return null;
  const min = Number(space.minInclusive);
  const max = Number(space.maxInclusive);
  const cardinality = Number(statistics?.cardinality);
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min || !Number.isFinite(cardinality)) return null;
  // A sparse sample from a very large range is not a categorical frequency
  // chart. Aggregate observed values into a small, deterministic range
  // histogram so the UI never implies that every possible value should recur.
  const bucketCount = Math.min(16, Math.max(4, Math.ceil(Math.sqrt(entries.length))));
  const span = BigInt(max) - BigInt(min) + 1n;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  for (const [key, value] of entries) {
    const outcome = Number(key);
    if (!Number.isSafeInteger(outcome) || outcome < min || outcome > max) continue;
    const offset = BigInt(outcome) - BigInt(min);
    const index = Math.min(bucketCount - 1, Number((offset * BigInt(bucketCount)) / span));
    buckets[index] += Number(value || 0);
  }
  return buckets.map((count, index) => {
    const start = min + Number((span * BigInt(index)) / BigInt(bucketCount));
    const end = index === bucketCount - 1
      ? max
      : min + Number((span * BigInt(index + 1)) / BigInt(bucketCount)) - 1;
    return [`${numberLabel(start)}..${numberLabel(end)}`, count];
  });
}

export function renderDistribution(counts = {}, options = {}) {
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  if (!entries.length) return '<div class="empty">No distribution recorded.</div>';
  const cardinality = Number(options.statistics?.cardinality);
  const largeIntegerRange = options.statistics?.outcomeSpace?.type === "INTEGER_RANGE" && Number.isFinite(cardinality) && cardinality > Math.max(64, entries.length * 4);
  const bucketed = largeIntegerRange ? rangeBuckets(entries, options.statistics) : null;
  // Calibration may legitimately cover a large enumerated space.  Keep the
  // authoritative counts intact but cap DOM rows to avoid turning a report
  // into a 100k-node render; the remainder is represented transparently.
  const MAX_VISIBLE_BARS = 64;
  const visible = bucketed || (entries.length > MAX_VISIBLE_BARS
    ? (() => {
      const ranked = [...entries].sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0));
      const head = ranked.slice(0, MAX_VISIBLE_BARS - 1);
      const remainder = ranked.slice(MAX_VISIBLE_BARS - 1).reduce((sum, [, value]) => sum + Number(value || 0), 0);
      return [...head, ["OTHER (truncated)", remainder]];
    })()
    : entries);
  const note = bucketed
    ? `<div class="subtle">Sparse INTEGER_RANGE sample: ${esc(numberLabel(total))} observations across K=${esc(numberLabel(cardinality))}; individual outcomes omitted and ${visible.length} range buckets shown.</div>`
    : entries.length > MAX_VISIBLE_BARS
      ? `<div class="subtle">${esc(numberLabel(entries.length - (MAX_VISIBLE_BARS - 1)))} low-frequency categories omitted from the chart; exact counts remain persisted.</div>`
      : "";
  return `<div class="distribution-chart">${note}${visible.map(([key, value]) => {
    const count = Number(value || 0);
    const width = total ? Math.max(2, Math.round(count / total * 100)) : 2;
    return `<div class="bar-row"><span>${esc(key)}</span><span class="bar" style="width:${width}%" role="img" aria-label="${esc(key)} ${count} of ${total}"></span><strong>${count}</strong></div>`;
  }).join("")}</div>`;
}

export default renderDistribution;
