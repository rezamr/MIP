import {
  PRIMARY_ENDPOINTS,
  TARGET_ANCHORS,
  normalizeOutcomeSpace,
  outcomeSpaceSize,
  containsOutcome,
  normalizeTemporalWindow,
  anyHitProbability,
  binomialProbability,
  binomialTail,
  expectedHits,
  MAX_PROBABILITY_TRIALS,
  classifyLatency,
  createCompatibilityFingerprint,
  normalizeCrossSessionAnalysis,
} from "../../domain/research-model.js";

function number(value, fallback = null) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function utcMs(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function signedMonotonicMs(actual, scheduled) {
  if (actual === null || scheduled === null || actual === undefined || scheduled === undefined) return null;
  try { return Number(BigInt(actual) - BigInt(scheduled)) / 1e6; } catch { return null; }
}

function outputActualUtc(record) { return utcMs(record.actualUtc ?? record.generatedUtc); }
function outputScheduledUtc(record) { return utcMs(record.scheduledUtc); }

function outputSequence(record) {
  const sequence = Number(record.sequence ?? record.outputSeq);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

function isMissedStatus(value) {
  return ["MISSED", "UNAVAILABLE", "ABORTED", "FAILED"].includes(String(value || "").toUpperCase());
}

function scheduledLatencyMs(record, targetUtcMs, targetMonotonicNs) {
  const scheduledUtcMs = outputScheduledUtc(record);
  if (scheduledUtcMs !== null && targetUtcMs !== null) return scheduledUtcMs - targetUtcMs;
  return signedMonotonicMs(record.scheduledMonotonicNs, targetMonotonicNs);
}

function isWithinCommittedTimeWindow(record, targetUtcMs, targetMonotonicNs, window) {
  if (window.enabled === false) return false;
  const latency = scheduledLatencyMs(record, targetUtcMs, targetMonotonicNs);
  if (latency === null) return false;
  const pre = latency < 0 && window.preMs > 0 && Math.abs(latency) <= window.preMs;
  const post = latency >= 0 && window.postMs > 0 && latency <= window.postMs;
  return pre || post || (latency === 0 && (window.preMs > 0 || window.postMs > 0));
}

function sequenceBounds(window, targetSequence) {
  const anchor = targetSequence === undefined || targetSequence === null ? null : Number(targetSequence);
  const start = window.exactSequence !== null
    ? window.exactSequence
    : window.sequenceOffsetStart !== null && anchor !== null
      ? anchor + window.sequenceOffsetStart
      : window.sequenceStart;
  const end = window.exactSequence !== null
    ? window.exactSequence
    : window.sequenceOffsetEnd !== null && anchor !== null
      ? anchor + window.sequenceOffsetEnd
      : window.sequenceEnd;
  return { start: start === null || start === undefined ? null : Number(start), end: end === null || end === undefined ? null : Number(end) };
}

function recordMatchesWindow(record, occurrence, window, targetUtcMs, targetMonotonicNs, targetSequence) {
  if (window.enabled === false) return false;
  const { start, end } = sequenceBounds(window, targetSequence);
  const sequence = outputSequence(record);
  if (start !== null || end !== null)
    return sequence !== null && start !== null && end !== null && sequence >= start && sequence <= end;
  const actualUtcMs = outputActualUtc(record);
  const actualLatency = actualUtcMs !== null && targetUtcMs !== null
    ? actualUtcMs - targetUtcMs
    : signedMonotonicMs(record.actualMonotonicNs, targetMonotonicNs);
  if (actualLatency === null || window.enabled === false) return false;
  const pre = actualLatency < 0 && window.preMs > 0 && Math.abs(actualLatency) <= window.preMs;
  const post = actualLatency >= 0 && window.postMs > 0 && actualLatency <= window.postMs;
  return pre || post || (actualLatency === 0 && (window.preMs > 0 || window.postMs > 0));
}

function windowEligibleCount(outputs, window, targetUtcMs, targetMonotonicNs, targetSequence) {
  const normalized = normalizeTemporalWindow(window);
  const { start, end } = sequenceBounds(normalized, targetSequence);
  return outputs.filter((record) => {
    if (isMissedStatus(record.status || record.timingStatus)) return false;
    // Eligibility is determined from the committed schedule.  Actual timing
    // remains available for occurrence classification, but a late callback
    // must not silently move an opportunity into/out of a confirmatory window.
    if (start !== null || end !== null)
      return recordMatchesWindow(record, null, normalized, targetUtcMs, targetMonotonicNs, targetSequence);
    return isWithinCommittedTimeWindow(record, targetUtcMs, targetMonotonicNs, normalized);
  }).length;
}

/**
 * Keep every occurrence of the target.  The exact primary slot is selected
 * separately by analyzeTemporalEvidence; early/late observations are never
 * silently promoted to the primary endpoint.
 */
export function findTargetOccurrences({ outputs = [], target, outcomeSpace = { type: "BINARY" }, window = {}, targetScheduledUtc = null, targetScheduledMonotonicNs = null } = {}) {
  const space = normalizeOutcomeSpace(outcomeSpace);
  const normalizedWindow = normalizeTemporalWindow(window);
  const targetUtcMs = utcMs(targetScheduledUtc);
  const targetMono = targetScheduledMonotonicNs === null || targetScheduledMonotonicNs === undefined ? null : targetScheduledMonotonicNs;
  const occurrences = [];
  for (const record of outputs) {
    const status = String(record.status || record.timingStatus || "OBSERVED").toUpperCase();
    // A missed/failed opportunity is represented by an authoritative row, but
    // it cannot also count as an observed target occurrence even if a caller
    // supplied a stale value alongside the deviation status.
    if (isMissedStatus(status)) continue;
    const value = record.value ?? record.output ?? record.result;
    if (!containsOutcome(space, value) || value !== target && String(value) !== String(target)) continue;
    const scheduledUtcMs = outputScheduledUtc(record);
    const actualUtcValue = outputActualUtc(record);
    const scheduledLatencyMs = scheduledUtcMs === null || targetUtcMs === null ? signedMonotonicMs(record.scheduledMonotonicNs, targetMono) : scheduledUtcMs - targetUtcMs;
    const actualLatencyMs = actualUtcValue === null || targetUtcMs === null ? signedMonotonicMs(record.actualMonotonicNs, targetMono) : actualUtcValue - targetUtcMs;
    const latency = actualLatencyMs === null
      ? { latencyMs: null, signedLatencyMs: scheduledLatencyMs, classification: "SCHEDULED_ONLY" }
      : classifyLatency(actualLatencyMs, 0, normalizedWindow);
    occurrences.push(Object.freeze({
      sessionId: record.sessionId || null,
      trialId: record.trialId || null,
      sequence: record.sequence ?? record.outputSeq ?? null,
      outputSeq: record.outputSeq ?? record.sequence ?? null,
      value,
      region: record.region || null,
      scheduledUtc: record.scheduledUtc || null,
      actualUtc: record.actualUtc || record.generatedUtc || null,
      scheduledMonotonicNs: record.scheduledMonotonicNs ?? null,
      actualMonotonicNs: record.actualMonotonicNs ?? null,
      scheduledLatencyMs,
      signedLatencyMs: latency.signedLatencyMs,
      latencyMs: latency.latencyMs,
      timingClassification: latency.classification,
      status,
    }));
  }
  return Object.freeze(occurrences);
}

function endpointPrimary({ outputs, target, outcomeSpace, endpoint, targetSequence, targetScheduledUtc, targetScheduledMonotonicNs, window }) {
  const normalizedEndpoint = String(endpoint || PRIMARY_ENDPOINTS.EXACT_SLOT).toUpperCase();
  if (normalizedEndpoint === PRIMARY_ENDPOINTS.EXACT_SLOT) {
    const sequence = targetSequence === undefined || targetSequence === null ? null : Number(targetSequence);
    const row = outputs.find((record) => sequence !== null && Number(record.sequence ?? record.outputSeq) === sequence)
      || (targetScheduledUtc ? outputs.find((record) => outputScheduledUtc(record) !== null && outputScheduledUtc(record) === utcMs(targetScheduledUtc)) : null);
    if (!row) return { resolved: false, status: "UNAVAILABLE", hit: false, slot: null };
    const value = row.value ?? row.output ?? row.result;
    const targetIsValid = target !== null && target !== undefined && containsOutcome(outcomeSpace, target);
    const rawStatus = String(row.status || row.timingStatus || "OBSERVED").toUpperCase();
    const status = isMissedStatus(rawStatus) ? "MISSED" : rawStatus;
    return { resolved: true, status, hit: !isMissedStatus(status) && targetIsValid && (value === target || String(value) === String(target)), slot: row };
  }
  const occurrences = findTargetOccurrences({ outputs, target, outcomeSpace, window, targetScheduledUtc, targetScheduledMonotonicNs });
  if (normalizedEndpoint === PRIMARY_ENDPOINTS.FIXED_SEQUENCE_WINDOW) {
    const normalizedWindow = normalizeTemporalWindow(window);
    const anchorSequence = targetSequence === undefined || targetSequence === null ? null : Number(targetSequence);
    const sequenceStart = normalizedWindow.exactSequence !== null
      ? normalizedWindow.exactSequence
      : normalizedWindow.sequenceOffsetStart !== null
      ? (anchorSequence === null ? Number.POSITIVE_INFINITY : anchorSequence + normalizedWindow.sequenceOffsetStart)
      : Number(normalizedWindow.sequenceStart ?? 0);
    const sequenceEnd = normalizedWindow.exactSequence !== null
      ? normalizedWindow.exactSequence
      : normalizedWindow.sequenceOffsetEnd !== null
      ? (anchorSequence === null ? Number.NEGATIVE_INFINITY : anchorSequence + normalizedWindow.sequenceOffsetEnd)
      : Number(normalizedWindow.sequenceEnd ?? Number.MAX_SAFE_INTEGER);
    const sequenceAnchorResolved = normalizedWindow.enabled !== false && (normalizedWindow.exactSequence !== null || normalizedWindow.sequenceOffsetStart === null || anchorSequence !== null);
    const selected = sequenceAnchorResolved
      ? outputs.filter((record) => {
        if (normalizedWindow.enabled === false) return false;
        const sequence = outputSequence(record);
        return sequence !== null && sequence >= sequenceStart && sequence <= sequenceEnd;
      })
      : [];
    const missed = selected.some((record) => isMissedStatus(record.status || record.timingStatus));
    return {
      resolved: sequenceAnchorResolved && selected.length > 0,
      status: !sequenceAnchorResolved ? "UNAVAILABLE" : missed ? "MISSED" : selected.length > 0 ? "RESOLVED" : "UNAVAILABLE",
       // Sequence-window boundaries are committed opportunity numbers and are
       // inclusive at both ends (e.g. target-10 through target-1).
      hit: sequenceAnchorResolved && !missed && occurrences.some((item) => Number(item.sequence) >= sequenceStart && Number(item.sequence) <= sequenceEnd),
      slot: null,
    };
  }
  if (normalizedEndpoint === PRIMARY_ENDPOINTS.FIXED_TIME_WINDOW) {
    const normalizedWindow = normalizeTemporalWindow(window);
    const targetUtcMs = utcMs(targetScheduledUtc);
    const eligible = outputs.filter((record) => !isMissedStatus(record.status || record.timingStatus) && isWithinCommittedTimeWindow(record, targetUtcMs, targetScheduledMonotonicNs, normalizedWindow)).length;
    return {
      resolved: eligible > 0,
      status: eligible > 0 ? "RESOLVED" : "UNAVAILABLE",
      hit: occurrences.some((item) => ["EXACT", "PRE_WINDOW", "POST_WINDOW"].includes(item.timingClassification)),
      slot: null,
    };
  }
  const eligible = outputs.filter((record) => !isMissedStatus(record.status || record.timingStatus)).length;
  return { resolved: eligible > 0, status: eligible > 0 ? "RESOLVED" : "UNAVAILABLE", hit: occurrences.length > 0, slot: null };
}

export function analyzeTemporalEvidence({
  outputs = [],
  target,
  outcomeSpace = { type: "BINARY" },
  primaryEndpoint = PRIMARY_ENDPOINTS.EXACT_SLOT,
  targetSequence = null,
  targetScheduledUtc = null,
  targetScheduledMonotonicNs = null,
  primaryWindow = {},
  plannedCount = outputs.length,
  eligibleCount = outputs.filter((record) => !isMissedStatus(record.status || record.timingStatus)).length,
  missedCount = outputs.filter((record) => isMissedStatus(record.status || record.timingStatus)).length,
  analysisWindows = null,
  analysisVersion = "temporal-analysis-v1",
} = {}) {
  const space = normalizeOutcomeSpace(outcomeSpace);
  const cardinality = outcomeSpaceSize(space);
  if (target !== null && target !== undefined && !containsOutcome(space, target))
    throw new TypeError("analysis target must belong to the committed outcome space");
  const normalizedWindow = normalizeTemporalWindow(primaryWindow);
  // EXACT_SLOT definitions from legacy profiles sometimes persisted only the
  // target sequence.  Resolve the anchor from that authoritative scheduled
  // row for backwards-compatible analysis, while still preferring the
  // explicitly committed target anchor whenever it is present.
  const anchorRow = targetSequence === null || targetSequence === undefined
    ? null
    : outputs.find((record) => Number(record.sequence ?? record.outputSeq) === Number(targetSequence));
  const effectiveTargetScheduledUtc = targetScheduledUtc ?? anchorRow?.scheduledUtc ?? null;
  const effectiveTargetScheduledMonotonicNs = targetScheduledMonotonicNs ?? anchorRow?.scheduledMonotonicNs ?? null;
  const occurrences = findTargetOccurrences({ outputs, target, outcomeSpace: space, window: normalizedWindow, targetScheduledUtc: effectiveTargetScheduledUtc, targetScheduledMonotonicNs: effectiveTargetScheduledMonotonicNs });
  const endpoint = endpointPrimary({ outputs, target, outcomeSpace: space, endpoint: primaryEndpoint, targetSequence, targetScheduledUtc: effectiveTargetScheduledUtc, targetScheduledMonotonicNs: effectiveTargetScheduledMonotonicNs, window: normalizedWindow });
  const nPlanned = number(plannedCount, outputs.length);
  const nEligible = number(eligibleCount, outputs.length);
  const nMissed = number(missedCount, Math.max(0, nPlanned - nEligible));
  if (![nPlanned, nEligible, nMissed].every((value) => Number.isSafeInteger(value) && value >= 0))
    throw new TypeError("planned, eligible, and missed opportunity counts must be non-negative safe integers");
  if (nPlanned > MAX_PROBABILITY_TRIALS || nEligible > MAX_PROBABILITY_TRIALS)
    throw new RangeError(`opportunity counts must not exceed ${MAX_PROBABILITY_TRIALS}`);
  if (nEligible > nPlanned) throw new RangeError("eligible opportunities cannot exceed planned opportunities");
  if (nMissed > nPlanned || nEligible + nMissed > nPlanned)
    throw new RangeError("missed and eligible opportunities cannot exceed planned opportunities");
  const hits = occurrences.length;
  const normalizedEndpoint = String(primaryEndpoint || PRIMARY_ENDPOINTS.EXACT_SLOT).toUpperCase();
  const primaryEligibleCount = normalizedEndpoint === PRIMARY_ENDPOINTS.EXACT_SLOT
    ? (endpoint.slot && !isMissedStatus(endpoint.slot.status || endpoint.slot.timingStatus) ? 1 : 0)
    : normalizedEndpoint === PRIMARY_ENDPOINTS.FIXED_SEQUENCE_WINDOW
      ? outputs.filter((record) => {
        if (normalizedWindow.enabled === false) return false;
        const sequence = outputSequence(record);
        const start = normalizedWindow.exactSequence !== null
          ? normalizedWindow.exactSequence
          : normalizedWindow.sequenceOffsetStart !== null && targetSequence !== null && targetSequence !== undefined
          ? Number(targetSequence) + normalizedWindow.sequenceOffsetStart
          : Number(normalizedWindow.sequenceStart ?? 0);
        const end = normalizedWindow.exactSequence !== null
          ? normalizedWindow.exactSequence
          : normalizedWindow.sequenceOffsetEnd !== null && targetSequence !== null && targetSequence !== undefined
          ? Number(targetSequence) + normalizedWindow.sequenceOffsetEnd
          : Number(normalizedWindow.sequenceEnd ?? Number.MAX_SAFE_INTEGER);
        return sequence !== null && sequence >= start && sequence <= end && !isMissedStatus(record.status || record.timingStatus);
      }).length
      : normalizedEndpoint === PRIMARY_ENDPOINTS.FIXED_TIME_WINDOW
        ? outputs.filter((record) => {
          if (isMissedStatus(record.status || record.timingStatus)) return false;
          return isWithinCommittedTimeWindow(record, utcMs(effectiveTargetScheduledUtc), effectiveTargetScheduledMonotonicNs, normalizedWindow);
        }).length
        : nEligible;
  const primaryProbability = endpoint.resolved && endpoint.status !== "MISSED"
    ? normalizedEndpoint === PRIMARY_ENDPOINTS.EXACT_SLOT ? 1 / cardinality : anyHitProbability(cardinality, Math.min(nEligible, primaryEligibleCount)).value
    : null;
  const committedWindows = Array.isArray(analysisWindows) && analysisWindows.length
    ? analysisWindows.map(normalizeTemporalWindow)
    : [normalizedWindow];
  const occurrenceBySequence = new Map(outputs.map((record) => [outputSequence(record), record]));
  const windowResults = committedWindows.map((window) => {
    const windowOccurrences = occurrences.filter((occurrence) => {
      const record = occurrenceBySequence.get(outputSequence(occurrence));
      return recordMatchesWindow(record || occurrence, occurrence, window, utcMs(effectiveTargetScheduledUtc), effectiveTargetScheduledMonotonicNs, targetSequence);
    });
    const eligible = windowEligibleCount(outputs, window, utcMs(effectiveTargetScheduledUtc), effectiveTargetScheduledMonotonicNs, targetSequence);
    return {
      id: window.id,
      exploratory: window.exploratory === true,
      enabled: window.enabled,
      observedHits: windowOccurrences.length,
      eligibleCount: eligible,
      expectedHits: eligible / cardinality,
      anyHitProbability: anyHitProbability(cardinality, eligible).value,
    };
  });
  const chronologicalOccurrences = [...occurrences].sort((left, right) => {
    const leftSequence = outputSequence(left);
    const rightSequence = outputSequence(right);
    if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence)
      return leftSequence - rightSequence;
    const leftUtc = outputActualUtc(left);
    const rightUtc = outputActualUtc(right);
    if (leftUtc !== null && rightUtc !== null && leftUtc !== rightUtc)
      return leftUtc - rightUtc;
    const leftLatency = Number(left.signedLatencyMs);
    const rightLatency = Number(right.signedLatencyMs);
    return (Number.isFinite(leftLatency) ? leftLatency : Number.POSITIVE_INFINITY)
      - (Number.isFinite(rightLatency) ? rightLatency : Number.POSITIVE_INFINITY);
  });
  const preTargetOccurrences = chronologicalOccurrences.filter((occurrence) => Number(occurrence.signedLatencyMs) < 0);
  const postTargetOccurrences = chronologicalOccurrences.filter((occurrence) => Number(occurrence.signedLatencyMs) > 0);
  const nearestOccurrence = chronologicalOccurrences
    .filter((occurrence) => Number.isFinite(Number(occurrence.signedLatencyMs)))
    .reduce((nearest, occurrence) => {
      if (!nearest || Math.abs(Number(occurrence.signedLatencyMs)) < Math.abs(Number(nearest.signedLatencyMs))) return occurrence;
      return nearest;
    }, null);
  const firstPreTargetOccurrence = preTargetOccurrences[0] || null;
  const firstPostTargetOccurrence = postTargetOccurrences[0] || null;
  const firstOccurrence = chronologicalOccurrences[0] || null;
  const result = {
    analysisVersion,
    methodVersion: "probability-v1",
    endpoint: String(primaryEndpoint || PRIMARY_ENDPOINTS.EXACT_SLOT).toUpperCase(),
    outcomeSpace: space,
    cardinality,
    target: target ?? null,
    plannedCount: nPlanned,
    eligibleCount: nEligible,
    missedCount: nMissed,
    hits,
    // These are descriptive occurrence fields, deliberately separate from
    // the confirmatory primary endpoint.  A late/early occurrence never
    // rewrites an exact-slot primary result.
    firstPreTargetOccurrence,
    firstPostTargetOccurrence,
    nearestOccurrence,
    firstPreTargetLatencyMs: firstPreTargetOccurrence?.signedLatencyMs ?? null,
    firstPostTargetLatencyMs: firstPostTargetOccurrence?.signedLatencyMs ?? null,
    nearestOccurrenceLatencyMs: nearestOccurrence?.signedLatencyMs ?? null,
    firstHitLatencyMs: firstOccurrence?.signedLatencyMs ?? null,
    primary: {
      resolved: endpoint.resolved,
      status: endpoint.status,
      hit: endpoint.hit,
      targetSequence,
      targetScheduledUtc: effectiveTargetScheduledUtc,
      eligibleCount: primaryEligibleCount,
      probability: primaryProbability,
      classification: endpoint.hit ? "PRIMARY_HIT" : endpoint.status === "MISSED" ? "MISSED_OR_UNAVAILABLE" : endpoint.resolved ? "PRIMARY_NO_HIT" : "MISSED_OR_UNAVAILABLE",
      observedHits: normalizedEndpoint === PRIMARY_ENDPOINTS.TARGET_FREQUENCY ? hits : undefined,
      expectedHits: normalizedEndpoint === PRIMARY_ENDPOINTS.TARGET_FREQUENCY ? nEligible / cardinality : undefined,
      observedFrequency: normalizedEndpoint === PRIMARY_ENDPOINTS.TARGET_FREQUENCY && nEligible ? hits / nEligible : undefined,
      expectedFrequency: normalizedEndpoint === PRIMARY_ENDPOINTS.TARGET_FREQUENCY ? 1 / cardinality : undefined,
    },
    occurrences,
    temporalWindow: normalizedWindow,
    windowResults,
    anyHitProbability: anyHitProbability(cardinality, nEligible),
    expectedHits: expectedHits(cardinality, nEligible),
    hitProbability: binomialProbability(cardinality, nEligible, Math.min(hits, nEligible)),
    binomialTail: binomialTail(cardinality, nEligible, Math.min(hits, nEligible), "GE"),
    nullModel: { p0: 1 / cardinality, distribution: "BINOMIAL", cardinality, methodVersion: "probability-v1" },
  };
  return Object.freeze(result);
}

function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function compareOccurrences(left, right) {
  const leftSequence = outputSequence(left);
  const rightSequence = outputSequence(right);
  if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence)
    return leftSequence - rightSequence;
  const leftUtc = outputActualUtc(left);
  const rightUtc = outputActualUtc(right);
  if (leftUtc !== null && rightUtc !== null && leftUtc !== rightUtc)
    return leftUtc - rightUtc;
  const leftLatency = Number(left.signedLatencyMs);
  const rightLatency = Number(right.signedLatencyMs);
  return (Number.isFinite(leftLatency) ? leftLatency : Number.POSITIVE_INFINITY)
    - (Number.isFinite(rightLatency) ? rightLatency : Number.POSITIVE_INFINITY);
}

function aggregateAnyHitProbability(cardinality, trials) {
  const k = Number(cardinality);
  const n = Number(trials);
  if (!Number.isSafeInteger(k) || k < 1 || !Number.isSafeInteger(n) || n < 0)
    throw new TypeError("invalid aggregate probability arguments");
  if (n === 0) return 0;
  if (k === 1) return 1;
  return -Math.expm1(n * Math.log1p(-1 / k));
}

function sessionCompletion(session, analysis) {
  const evidencePhase = String(session.evidencePhase || session.evidencePhaseStatus || analysis.evidencePhase || "").toUpperCase();
  const complete = session.completed === true || session.evidenceComplete === true || ["COMPLETE", "COMPLETED", "REVEALED"].includes(evidencePhase);
  const deviated = session.deviated === true || session.timingDeviation === true || ["ABORTED", "MISSED", "INCOMPLETE", "FAILED"].includes(evidencePhase) || Number(analysis.missedCount || 0) > 0;
  return { complete, deviated };
}

/** Aggregate only compatible, explicitly committed sessions. */
export function aggregateCrossSession(sessions = [], options = {}) {
  const cross = normalizeCrossSessionAnalysis(options);
  const eligible = sessions.filter((session) => {
    // Callers that already queried the reveal gate may omit `revealed`; an
    // explicit false value is authoritative and must never enter an aggregate.
    if (session.revealed === false || session.hidden === true) return false;
    if (session.compatibilityFingerprint && options.compatibilityFingerprint && session.compatibilityFingerprint !== options.compatibilityFingerprint) return false;
    return session.committedDefinition !== false && session.analysis;
  });
  const fingerprints = [...new Set(eligible.map((session) => session.compatibilityFingerprint || createCompatibilityFingerprint(session.definition || session)))];
  const cardinalities = [...new Set(eligible.map((session) => Number(session.analysis?.cardinality ?? session.definition?.cardinality ?? 0)).filter((value) => Number.isFinite(value) && value > 0))];
  const compatible = fingerprints.length <= 1 && cardinalities.length <= 1;
  if (!compatible && options.requireCompatible !== false) throw new Error("Cross-session definitions are incompatible");
  const analyses = eligible.map((session) => session.analysis);
  const totalPlanned = analyses.reduce((sum, analysis) => sum + Number(analysis.plannedCount || 0), 0);
  const totalEligible = analyses.reduce((sum, analysis) => sum + Number(analysis.eligibleCount || 0), 0);
  const totalMissed = analyses.reduce((sum, analysis) => sum + Number(analysis.missedCount || 0), 0);
  const totalHits = analyses.reduce((sum, analysis) => sum + Number(analysis.hits || 0), 0);
  const primaryHits = analyses.filter((analysis) => analysis.primary?.hit === true).length;
  const perSession = eligible.map((session) => {
    const analysis = session.analysis;
    const occurrences = (analysis.occurrences || []).map((occurrence) => ({
      ...occurrence,
      signedLatencyMs: Number(occurrence.signedLatencyMs ?? occurrence.latencyMs),
    })).filter((occurrence) => Number.isFinite(occurrence.signedLatencyMs));
    const chronological = [...occurrences].sort(compareOccurrences);
    const preTargetOccurrences = chronological.filter((occurrence) => occurrence.signedLatencyMs < 0);
    const postTargetOccurrences = chronological.filter((occurrence) => occurrence.signedLatencyMs > 0);
    const nearestOccurrence = chronological.reduce((nearest, occurrence) => {
      if (!nearest || Math.abs(occurrence.signedLatencyMs) < Math.abs(nearest.signedLatencyMs)) return occurrence;
      return nearest;
    }, null);
    const firstHit = chronological[0] || null;
    const firstHitLatencyMs = firstHit?.signedLatencyMs ?? null;
    const preTargetHitCount = preTargetOccurrences.length;
    const postTargetHitCount = postTargetOccurrences.length;
    const completion = sessionCompletion(session, analysis);
    return {
      sessionId: session.sessionId,
      primaryHit: analysis.primary?.hit === true,
      hits: analysis.hits || 0,
      plannedCount: analysis.plannedCount || 0,
      eligibleCount: analysis.eligibleCount || 0,
      missedCount: analysis.missedCount || 0,
      firstHitLatencyMs,
      firstPreTargetLatencyMs: preTargetOccurrences[0]?.signedLatencyMs ?? null,
      firstPostTargetLatencyMs: postTargetOccurrences[0]?.signedLatencyMs ?? null,
      nearestOccurrenceLatencyMs: nearestOccurrence?.signedLatencyMs ?? null,
      preTargetHitCount,
      primaryHitCount: analysis.primary?.hit === true ? 1 : 0,
      postTargetHitCount,
      noHit: occurrences.length === 0,
      completed: completion.complete,
      deviated: completion.deviated,
      occurrences,
    };
  });
  const latencies = perSession.flatMap((session) => session.occurrences.map((occurrence) => occurrence.signedLatencyMs));
  const firstHitLatencies = perSession.map((session) => session.firstHitLatencyMs).filter(Number.isFinite);
  const firstPreTargetLatencies = perSession.map((session) => session.firstPreTargetLatencyMs).filter(Number.isFinite);
  const firstPostTargetLatencies = perSession.map((session) => session.firstPostTargetLatencyMs).filter(Number.isFinite);
  const nearestOccurrenceLatencies = perSession.map((session) => session.nearestOccurrenceLatencyMs).filter(Number.isFinite);
  const preTargetHitCount = perSession.reduce((sum, session) => sum + session.preTargetHitCount, 0);
  const postTargetHitCount = perSession.reduce((sum, session) => sum + session.postTargetHitCount, 0);
  const completedSessionCount = perSession.filter((session) => session.completed).length;
  const deviatedSessionCount = perSession.filter((session) => session.deviated).length;
  const noHitSessionCount = perSession.filter((session) => session.noHit).length;
  const histogram = Object.create(null);
  let minLatencyMs = null;
  let maxLatencyMs = null;
  for (const latency of latencies) {
    const bucket = Math.floor(latency / 1000);
    histogram[bucket] = (histogram[bucket] || 0) + 1;
    minLatencyMs = minLatencyMs === null ? latency : Math.min(minLatencyMs, latency);
    maxLatencyMs = maxLatencyMs === null ? latency : Math.max(maxLatencyMs, latency);
  }
  const cardinality = Number(options.cardinality || analyses[0]?.cardinality || cardinalities[0] || 1);
  if (!Number.isSafeInteger(cardinality) || cardinality < 1)
    throw new TypeError("aggregate cardinality must be a positive safe integer");
  const expectedPrimaryHits = analyses.reduce((sum, analysis) => {
    const endpoint = String(analysis.endpoint || PRIMARY_ENDPOINTS.EXACT_SLOT).toUpperCase();
    const eligiblePrimary = Number(analysis.primary?.eligibleCount ?? (endpoint === PRIMARY_ENDPOINTS.EXACT_SLOT ? 1 : analysis.eligibleCount || 0));
    return sum + (Number.isFinite(eligiblePrimary) && eligiblePrimary > 0 ? eligiblePrimary / cardinality : 0);
  }, 0);
  let cumulativeHits = 0;
  let cumulativeEligible = 0;
  const cumulativeObservedVsNull = perSession.map((session) => {
    cumulativeHits += Number(session.hits || 0);
    cumulativeEligible += Number(session.eligibleCount || 0);
    return {
      sessionId: session.sessionId,
      observedHits: cumulativeHits,
      expectedHits: cumulativeEligible / cardinality,
      eligibleOpportunities: cumulativeEligible,
    };
  });
  const aggregateLabel = compatible ? "compatible committed sessions" : "heterogeneous comparison (explicitly allowed)";
  return Object.freeze({
    version: cross.version,
    workflow: cross.workflow,
    exploratory: cross.exploratory,
    compatibilityFingerprint: compatible ? (fingerprints[0] || options.compatibilityFingerprint || null) : null,
    compatible,
    sessionCount: eligible.length,
    excludedSessionCount: sessions.length - eligible.length,
    completedSessionCount,
    incompleteSessionCount: eligible.length - completedSessionCount,
    deviatedSessionCount,
    plannedCount: totalPlanned,
    eligibleCount: totalEligible,
    missedCount: totalMissed,
    hits: totalHits,
    primaryHits,
    primaryHitRate: eligible.length ? primaryHits / eligible.length : null,
    expectedPrimaryHits,
    expectedExactPrimaryMatches: analyses.reduce((sum, analysis) => {
      const endpoint = String(analysis.endpoint || PRIMARY_ENDPOINTS.EXACT_SLOT).toUpperCase();
      if (endpoint !== PRIMARY_ENDPOINTS.EXACT_SLOT) return sum;
      const eligiblePrimary = Number(analysis.primary?.eligibleCount ?? 1);
      return sum + (Number.isFinite(eligiblePrimary) && eligiblePrimary > 0 ? eligiblePrimary / cardinality : 0);
    }, 0),
    expectedHits: totalEligible / cardinality,
    p0: 1 / cardinality,
    anyHitProbability: { value: aggregateAnyHitProbability(cardinality, totalEligible), method: "ANY_HIT_EXACT_UNIFORM", version: "probability-v1", cardinality, trials: totalEligible },
    noHitSessionCount,
    preTargetHitCount,
    primaryHitCount: primaryHits,
    postTargetHitCount,
    firstHitLatency: { count: firstHitLatencies.length, meanMs: mean(firstHitLatencies), medianMs: median(firstHitLatencies), valuesMs: firstHitLatencies },
    firstPreTargetLatency: { count: firstPreTargetLatencies.length, meanMs: mean(firstPreTargetLatencies), medianMs: median(firstPreTargetLatencies), valuesMs: firstPreTargetLatencies },
    firstPostTargetLatency: { count: firstPostTargetLatencies.length, meanMs: mean(firstPostTargetLatencies), medianMs: median(firstPostTargetLatencies), valuesMs: firstPostTargetLatencies },
    nearestOccurrenceLatency: { count: nearestOccurrenceLatencies.length, meanMs: mean(nearestOccurrenceLatencies), medianMs: median(nearestOccurrenceLatencies), valuesMs: nearestOccurrenceLatencies },
    latency: { count: latencies.length, meanMs: mean(latencies), medianMs: median(latencies), minMs: minLatencyMs, maxMs: maxLatencyMs, valuesMs: latencies },
    latencyHistogram: Object.freeze(Object.fromEntries(Object.entries(histogram).map(([bucket, count]) => [Number(bucket), count]))),
    targetAlignedRaster: perSession.map((session) => ({ sessionId: session.sessionId, latenciesMs: session.occurrences.map((occurrence) => occurrence.signedLatencyMs) })),
    cumulativeObservedVsNull,
    temporalHitDensity: { targetOccurrences: totalHits, eligibleOpportunities: totalEligible, hitsPerEligibleOpportunity: totalEligible ? totalHits / totalEligible : null },
    perWindow: analyses.flatMap((analysis, index) => {
      const windows = Array.isArray(analysis.windowResults) && analysis.windowResults.length
        ? analysis.windowResults
        : [{ id: analysis.temporalWindow?.id || "primary", window: analysis.temporalWindow || null, observedHits: analysis.hits || 0, eligibleCount: analysis.eligibleCount || 0, expectedHits: Number(analysis.eligibleCount || 0) / Number(analysis.cardinality || cardinality), exploratory: analysis.temporalWindow?.exploratory === true }];
      return windows.map((window) => ({
        sessionId: eligible[index].sessionId,
        window: window.window || (window.id === analysis.temporalWindow?.id ? analysis.temporalWindow : null),
        id: window.id || "primary",
        observedHits: Number(window.observedHits ?? 0),
        eligibleCount: Number(window.eligibleCount ?? 0),
        expectedHits: Number(window.expectedHits ?? (Number(window.eligibleCount || 0) / Number(analysis.cardinality || cardinality))),
        exploratory: cross.exploratory === true || window.exploratory === true,
      }));
    }),
    perSession,
    labels: { primary: "PRECOMMITTED_PRIMARY", secondary: "PRECOMMITTED_SECONDARY", occurrences: cross.exploratory ? "EXPLORATORY / POST-HOC" : "target-relative occurrences", aggregate: aggregateLabel, firstHitLatency: "signed milliseconds from committed target anchor T" },
  });
}

export const TemporalAnalysis = Object.freeze({ analyze: analyzeTemporalEvidence, occurrences: findTargetOccurrences, aggregate: aggregateCrossSession });
export default TemporalAnalysis;
