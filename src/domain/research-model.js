import crypto from "node:crypto";

/**
 * Generic research contracts shared by the engine, persistence and renderer.
 * The module deliberately keeps integer ranges symbolic: a billion-value
 * space is represented by two endpoints and is never expanded into an array.
 */

export const EXPERIMENT_MODES = Object.freeze({
  INFLUENCE: "INFLUENCE",
  FUTURE_TARGET: "FUTURE_TARGET",
  CONTROL: "CONTROL",
  SHAM: "SHAM",
});
export const ExperimentMode = EXPERIMENT_MODES;

export const OUTCOME_SPACE_TYPES = Object.freeze({
  BINARY: "BINARY",
  INTEGER_RANGE: "INTEGER_RANGE",
  ENUMERATED_VALUES: "ENUMERATED_VALUES",
});
export const OutcomeSpaceType = OUTCOME_SPACE_TYPES;

export const PARTICIPANT_PHASES = Object.freeze({
  DRAFT: "DRAFT",
  PRECOMMIT: "PRECOMMIT",
  READY: "READY",
  ACTIVE: "ACTIVE",
  RETURNED: "RETURNED",
  ENDED: "ENDED",
});
export const ParticipantPhase = PARTICIPANT_PHASES;

export const EVIDENCE_PHASES = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  PLANNED: "PLANNED",
  SCHEDULED: "SCHEDULED",
  RUNNING: "RUNNING",
  TARGET_PENDING: "TARGET_PENDING",
  TARGET_GENERATED: "TARGET_GENERATED",
  TARGET_OBSERVED: "TARGET_OBSERVED",
  POST_TARGET_MONITORING: "POST_TARGET_MONITORING",
  COMPLETE: "COMPLETE",
  ABORTED: "ABORTED",
  MISSED: "MISSED",
  INCOMPLETE: "INCOMPLETE",
  FAILED: "FAILED",
});
export const EvidencePhase = EVIDENCE_PHASES;

export const TARGET_ANCHORS = Object.freeze({
  START: "START",
  PARTICIPANT_REQUEST: "PARTICIPANT_REQUEST",
  COMMITMENT: "COMMITMENT",
  AUDIO_STARTED: "AUDIO_STARTED",
  ABSOLUTE_UTC: "ABSOLUTE_UTC",
  EVIDENCE_SEQUENCE: "EVIDENCE_SEQUENCE",
});
export const TargetAnchor = TARGET_ANCHORS;

export const OUTPUT_CADENCES = Object.freeze({
  FIXED_INTERVAL: "FIXED_INTERVAL",
  FIXED_COUNT: "FIXED_COUNT",
  EVENT_DRIVEN: "EVENT_DRIVEN",
});
export const OutputCadence = OUTPUT_CADENCES;

export const PRIMARY_ENDPOINTS = Object.freeze({
  EXACT_SLOT: "EXACT_SLOT",
  FIXED_TIME_WINDOW: "FIXED_TIME_WINDOW",
  FIXED_SEQUENCE_WINDOW: "FIXED_SEQUENCE_WINDOW",
  TARGET_FREQUENCY: "TARGET_FREQUENCY",
});
export const PrimaryEndpoint = PRIMARY_ENDPOINTS;

export const REVEAL_POLICIES = Object.freeze({
  AFTER_EVIDENCE_COMPLETE: "AFTER_EVIDENCE_COMPLETE",
  AFTER_RAW_REPORT_LOCK: "AFTER_RAW_REPORT_LOCK",
});
export const RevealPolicy = REVEAL_POLICIES;

export const ANALYSIS_METHOD = Object.freeze({
  VERSION: "probability-v1",
  NULL_MODEL: "UNIFORM_OUTCOME_SPACE",
});

export const MAX_ENUMERATED_VALUES = 100_000;
export const MAX_OUTCOME_CARDINALITY = Number.MAX_SAFE_INTEGER;
export const MAX_TEMPORAL_WINDOWS = 128;
export const MAX_TEMPORAL_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
export const MAX_PROBABILITY_TRIALS = 1_000_000;
export const MAX_SCHEDULED_OUTPUTS = 1_000_000;

function fail(message) {
  throw new TypeError(message);
}

function integer(value, name) {
  if (typeof value === "bigint") {
    if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${name} must be a safe integer`);
    return Number(value);
  }
  // Parse integer strings through BigInt first so a value just beyond the
  // IEEE-754 safe range cannot round down/up and then appear safe as a
  // Number.  JSON callers commonly provide form values as strings.
  if (typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) {
    try {
      const parsed = BigInt(value.trim());
      if (parsed < BigInt(Number.MIN_SAFE_INTEGER) || parsed > BigInt(Number.MAX_SAFE_INTEGER)) fail(`${name} must be a safe integer`);
      return Number(parsed);
    } catch {
      fail(`${name} must be a safe integer`);
    }
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result)) fail(`${name} must be a safe integer`);
  return result;
}

function scalar(value, index) {
  if (value === null || value === undefined || typeof value === "boolean")
    fail(`outcome value ${index} must be a non-null scalar`);
  if (typeof value === "number" && !Number.isFinite(value))
    fail(`outcome value ${index} must be finite`);
  if (!["string", "number", "bigint"].includes(typeof value))
    fail(`outcome value ${index} must be a string, number, or bigint`);
  return value;
}

function uniqueValues(values) {
  const seen = new Set(values.map((value) => `${typeof value}:${String(value)}`));
  return seen.size === values.length;
}

/** Return a canonical, immutable representation of an outcome space. */
export function normalizeOutcomeSpace(input, options = {}) {
  const value = input || { type: OUTCOME_SPACE_TYPES.BINARY };
  const rawType = String(value.type || "BINARY").toUpperCase();
  const type = rawType === "ENUMERATED" || rawType === "ENUM"
    ? OUTCOME_SPACE_TYPES.ENUMERATED_VALUES
    : rawType;
  if (type === OUTCOME_SPACE_TYPES.BINARY) {
    // BINARY is the historical spelling.  A caller may provide labels or
    // values, but objective identity remains the two canonical values.
    const values = Array.isArray(value.values) && value.values.length === 2
      ? value.values.map((item, index) => scalar(item, index))
      : [0, 1];
    if (!uniqueValues(values)) fail("BINARY outcome values must be unique");
    return Object.freeze({ type: OUTCOME_SPACE_TYPES.BINARY, values: Object.freeze(values) });
  }
  if (type === OUTCOME_SPACE_TYPES.INTEGER_RANGE) {
    const minInclusive = integer(value.minInclusive ?? value.min, "minInclusive");
    const maxInclusive = integer(value.maxInclusive ?? value.max, "maxInclusive");
    if (maxInclusive < minInclusive) fail("maxInclusive must be >= minInclusive");
    const cardinality = BigInt(maxInclusive) - BigInt(minInclusive) + 1n;
    if (cardinality > BigInt(MAX_OUTCOME_CARDINALITY)) fail("integer range cardinality exceeds supported maximum");
    return Object.freeze({ type, minInclusive, maxInclusive });
  }
  if (type === OUTCOME_SPACE_TYPES.ENUMERATED_VALUES) {
    if (!Array.isArray(value.values) || value.values.length < 1)
      fail("ENUMERATED_VALUES requires a non-empty values array");
    if (value.values.length > MAX_ENUMERATED_VALUES)
      fail(`ENUMERATED_VALUES is limited to ${MAX_ENUMERATED_VALUES} values`);
    const values = Object.freeze(value.values.map(scalar));
    if (!uniqueValues(values)) fail("ENUMERATED_VALUES must not contain duplicates");
    return Object.freeze({ type, values });
  }
  fail(`Unsupported outcome space type ${rawType}`);
}

export function validateOutcomeSpace(input) {
  try {
    const normalized = normalizeOutcomeSpace(input);
    return { valid: true, errors: [], normalized, cardinality: outcomeSpaceSize(normalized) };
  } catch (error) {
    return { valid: false, errors: [error.message], normalized: null, cardinality: null };
  }
}

export function outcomeSpaceSize(input) {
  const space = normalizeOutcomeSpace(input);
  if (space.type === OUTCOME_SPACE_TYPES.INTEGER_RANGE)
    return Number(BigInt(space.maxInclusive) - BigInt(space.minInclusive) + 1n);
  return space.values.length;
}

export function containsOutcome(input, outcome) {
  const space = normalizeOutcomeSpace(input);
  if (space.type === OUTCOME_SPACE_TYPES.INTEGER_RANGE) {
    if (typeof outcome === "bigint") {
      return outcome >= BigInt(space.minInclusive) && outcome <= BigInt(space.maxInclusive);
    }
    const numeric = Number(outcome);
    return Number.isSafeInteger(numeric) && numeric >= space.minInclusive && numeric <= space.maxInclusive;
  }
  return space.values.some((value) => value === outcome || String(value) === String(outcome));
}

function randomIndex(source, size) {
  if (!source || typeof source.int !== "function") fail("A random source with int(maxExclusive) is required");
  const index = source.int(size);
  if (!Number.isSafeInteger(index) || index < 0 || index >= size)
    fail("random source returned an out-of-range index");
  return index;
}

export function sampleOutcome(input, source) {
  const space = normalizeOutcomeSpace(input);
  const index = randomIndex(source, outcomeSpaceSize(space));
  return space.type === OUTCOME_SPACE_TYPES.INTEGER_RANGE
    ? space.minInclusive + index
    : space.values[index];
}

export function formatOutcome(input, outcome) {
  const space = normalizeOutcomeSpace(input);
  if (!containsOutcome(space, outcome)) return String(outcome);
  return space.type === OUTCOME_SPACE_TYPES.INTEGER_RANGE ? String(outcome) : String(outcome);
}

export function normalizeExperimentMode(value) {
  const mode = String(value || EXPERIMENT_MODES.INFLUENCE).toUpperCase();
  if (!Object.values(EXPERIMENT_MODES).includes(mode)) fail(`Unsupported experiment mode ${mode}`);
  return mode;
}

export function normalizeTargetDefinition(value = {}, options = {}) {
  const mode = normalizeExperimentMode(options.mode || value.mode || EXPERIMENT_MODES.INFLUENCE);
  const requestedAnchor = value.anchor || (mode === EXPERIMENT_MODES.FUTURE_TARGET ? TARGET_ANCHORS.ABSOLUTE_UTC : TARGET_ANCHORS.PARTICIPANT_REQUEST);
  const target = {
    mode,
    assignmentDomain: value.assignmentDomain || "TARGET_ASSIGNMENT",
    // A future target is anchored to a committed wall-clock instant unless
    // the caller explicitly selects another supported anchor.  Keeping this
    // default here (rather than only in the Electron handler) means every
    // integration and persistence path applies the same protocol semantics.
    anchor: String(requestedAnchor).toUpperCase(),
    targetSequence: value.targetSequence === undefined || value.targetSequence === null ? null : integer(value.targetSequence, "targetSequence"),
    // Influence/control/sham definitions carry the committed target in the
    // immutable definition.  FUTURE_TARGET intentionally keeps this field
    // null until the anchor event is generated and persisted separately.
    target: value.target === undefined || value.target === null ? null : scalar(value.target, "target"),
    prediction: value.prediction === undefined || value.prediction === null ? null : scalar(value.prediction, "prediction"),
    scheduledUtc: value.scheduledUtc || value.scheduledTargetUtc || null,
    scheduledMonotonicNs: value.scheduledMonotonicNs === undefined || value.scheduledMonotonicNs === null ? null : String(value.scheduledMonotonicNs),
    semantics: value.semantics || (mode === EXPERIMENT_MODES.FUTURE_TARGET ? "GENERATE_AT_ANCHOR" : "COMMITTED_BEFORE_PARTICIPATION"),
  };
  if (!Object.values(TARGET_ANCHORS).includes(target.anchor)) fail(`Unsupported target anchor ${target.anchor}`);
  if (target.scheduledUtc !== null && !Number.isFinite(Date.parse(String(target.scheduledUtc))))
    fail("scheduledUtc must be a valid UTC datetime");
  if (target.scheduledMonotonicNs !== null) {
    try {
      if (BigInt(target.scheduledMonotonicNs) < 0n) throw new Error();
    } catch {
      fail("scheduledMonotonicNs must be a non-negative integer");
    }
  }
  if (mode === EXPERIMENT_MODES.FUTURE_TARGET && value.target !== undefined)
    if (value.target !== null) fail("FUTURE_TARGET must not contain an actual target before its anchor");
  if (mode === EXPERIMENT_MODES.FUTURE_TARGET && target.target !== null)
    fail("FUTURE_TARGET must not contain an actual target before its anchor");
  if (target.targetSequence !== null && (target.targetSequence < 0 || target.targetSequence >= MAX_SCHEDULED_OUTPUTS)) fail(`targetSequence must be in [0, ${MAX_SCHEDULED_OUTPUTS - 1}]`);
  return Object.freeze(target);
}

export function normalizeTemporalWindow(value = {}) {
  const source = value || {};
  const id = source.id === undefined || source.id === null ? "primary" : String(source.id);
  if (!id || id.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id))
    fail("temporal window id must contain 1-128 safe identifier characters");
  const enabled = source.enabled !== false;
  const preMs = Number(source.preMs ?? source.preDurationMs ?? source.beforeMs ?? 0);
  const postMs = Number(source.postMs ?? source.postDurationMs ?? source.afterMs ?? 0);
  if (!Number.isFinite(preMs) || preMs < 0 || !Number.isFinite(postMs) || postMs < 0)
    fail("temporal window durations must be non-negative finite numbers");
  if (preMs > MAX_TEMPORAL_WINDOW_MS || postMs > MAX_TEMPORAL_WINDOW_MS)
    fail(`temporal window durations must not exceed ${MAX_TEMPORAL_WINDOW_MS} ms`);
  const exactSequence = source.exactSequence === undefined || source.exactSequence === null
    ? null
    : integer(source.exactSequence, "exactSequence");
  if (exactSequence !== null && (exactSequence < 0 || exactSequence >= MAX_SCHEDULED_OUTPUTS)) fail(`exactSequence must be in [0, ${MAX_SCHEDULED_OUTPUTS - 1}]`);
  const rawSequenceStart = source.sequenceStart === undefined || source.sequenceStart === null ? null : integer(source.sequenceStart, "sequenceStart");
  const rawSequenceEnd = source.sequenceEnd === undefined || source.sequenceEnd === null ? null : integer(source.sequenceEnd, "sequenceEnd");
  // Non-negative sequenceStart/End values are absolute output sequence
  // numbers.  Negative values are a concise relative form for committed
  // windows such as target slot -10 .. -1; the explicit offset fields below
  // preserve that distinction in the canonical definition.
  const relativeSequenceStart = source.sequenceOffsetStart ?? source.relativeSequenceStart ?? (rawSequenceStart !== null && rawSequenceStart < 0 ? rawSequenceStart : null);
  const relativeSequenceEnd = source.sequenceOffsetEnd ?? source.relativeSequenceEnd ?? (rawSequenceEnd !== null && rawSequenceEnd < 0 ? rawSequenceEnd : null);
  const sequenceStart = rawSequenceStart !== null && rawSequenceStart >= 0 ? rawSequenceStart : null;
  const sequenceEnd = rawSequenceEnd !== null && rawSequenceEnd >= 0 ? rawSequenceEnd : null;
  if (sequenceStart !== null && sequenceStart >= MAX_SCHEDULED_OUTPUTS) fail(`sequenceStart must be in [0, ${MAX_SCHEDULED_OUTPUTS - 1}]`);
  if (sequenceEnd !== null && (sequenceEnd >= MAX_SCHEDULED_OUTPUTS || (sequenceStart !== null && sequenceEnd < sequenceStart))) fail("sequenceEnd must be >= sequenceStart and within the scheduled-output limit");
  if ((sequenceStart === null) !== (sequenceEnd === null))
    fail("sequenceStart and sequenceEnd must be provided together");
  const relativeStart = relativeSequenceStart === null || relativeSequenceStart === undefined ? null : integer(relativeSequenceStart, "sequenceOffsetStart");
  const relativeEnd = relativeSequenceEnd === null || relativeSequenceEnd === undefined ? null : integer(relativeSequenceEnd, "sequenceOffsetEnd");
  if (exactSequence !== null && (sequenceStart !== null || sequenceEnd !== null || relativeStart !== null || relativeEnd !== null))
    fail("exactSequence cannot be combined with sequence bounds or offsets");
  if (exactSequence !== null && (preMs !== 0 || postMs !== 0))
    fail("exactSequence cannot be combined with non-zero temporal durations");
  if (source.preOnly === true && source.postOnly === true)
    fail("temporal window cannot be both preOnly and postOnly");
  if ((relativeStart === null) !== (relativeEnd === null) || (relativeStart !== null && (relativeEnd < relativeStart || Math.abs(relativeStart) >= MAX_SCHEDULED_OUTPUTS || Math.abs(relativeEnd) >= MAX_SCHEDULED_OUTPUTS)))
    fail("sequence offsets must be provided as an ordered pair within the scheduled-output limit");
  if ((sequenceStart !== null || sequenceEnd !== null) && (relativeStart !== null || relativeEnd !== null))
    fail("sequence absolute bounds and relative offsets are mutually exclusive");
  const normalized = {
    id,
    enabled,
    preMs,
    postMs,
    preOnly: source.preOnly === true,
    postOnly: source.postOnly === true,
    exactSequence,
    sequenceStart,
    sequenceEnd,
    sequenceOffsetStart: relativeStart,
    sequenceOffsetEnd: relativeEnd,
    exploratory: source.exploratory === true,
  };
  if (normalized.preOnly) normalized.postMs = 0;
  if (normalized.postOnly) normalized.preMs = 0;
  return Object.freeze(normalized);
}

export function normalizeTemporalAnalysisPlan(value = {}, options = {}) {
  const endpoint = String(value.primaryEndpoint || value.endpoint || PRIMARY_ENDPOINTS.EXACT_SLOT).toUpperCase();
  if (!Object.values(PRIMARY_ENDPOINTS).includes(endpoint)) fail(`Unsupported primary endpoint ${endpoint}`);
  const rawWindows = Array.isArray(value.windows) ? value.windows : null;
  if (rawWindows && (rawWindows.length < 1 || rawWindows.length > MAX_TEMPORAL_WINDOWS))
    fail(`temporal analysis windows must contain 1-${MAX_TEMPORAL_WINDOWS} entries`);
  const windows = rawWindows
    ? rawWindows.map(normalizeTemporalWindow)
    : [normalizeTemporalWindow(value.primaryWindow || value.window || {})];
  if (new Set(windows.map((window) => window.id)).size !== windows.length)
    fail("temporal analysis window ids must be unique");
  const intervalMs = value.intervalMs === undefined || value.intervalMs === null ? null : Number(value.intervalMs);
  if (intervalMs !== null && (!Number.isFinite(intervalMs) || intervalMs <= 0 || intervalMs > MAX_TEMPORAL_WINDOW_MS))
    fail(`intervalMs must be positive and <= ${MAX_TEMPORAL_WINDOW_MS} ms`);
  const outputCadence = String(value.outputCadence || OUTPUT_CADENCES.FIXED_INTERVAL).toUpperCase();
  if (!Object.values(OUTPUT_CADENCES).includes(outputCadence)) fail(`Unsupported output cadence ${outputCadence}`);
  if (!windows.some((window) => window.id === (value.primaryWindowId || windows[0].id)))
    fail("primaryWindowId must identify one configured temporal window");
  return Object.freeze({
    version: value.version || "temporal-analysis-v1",
    primaryEndpoint: endpoint,
    primaryWindowId: value.primaryWindowId || windows[0].id,
    windows: Object.freeze(windows),
    outputCadence,
    intervalMs,
    plannedBeforeCommit: options.plannedBeforeCommit !== false && value.plannedBeforeCommit !== false,
    exploratoryPostHoc: value.exploratoryPostHoc === true,
  });
}

function deepMerge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override === undefined ? base : override;
  const result = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  for (const [key, value] of Object.entries(override)) {
    // An omitted override must not erase a lower-precedence default.  `null`
    // remains an intentional explicit value, while `undefined` means the
    // caller did not provide that setting.
    if (value === undefined) continue;
    result[key] = value && typeof value === "object" && !Array.isArray(value) ? deepMerge(result[key], value) : value;
  }
  return result;
}

function objectLayer(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/**
 * Convert historical aliases to one canonical shape before precedence is
 * applied.  This is important for nested settings: a profile's `analysis`
 * must still override an application's `temporalAnalysis`, while a session's
 * explicit `analysisPlan` must override both.
 */
function canonicalizeConfigLayer(value) {
  const layer = objectLayer(value);
  const result = { ...layer };
  const analysis = deepMerge(
    deepMerge(objectLayer(layer.analysis), objectLayer(layer.analysisPlan)),
    objectLayer(layer.temporalAnalysis),
  );
  if (Object.keys(analysis).length) result.temporalAnalysis = analysis;
  delete result.analysis;
  delete result.analysisPlan;
  const target = deepMerge(objectLayer(layer.target), objectLayer(layer.targetDefinition));
  if (Object.keys(target).length) result.targetDefinition = target;
  delete result.target;
  return result;
}

function canonical(value) {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

export function canonicalResearchDefinition(value) { return canonical(value); }
export function hashResearchDefinition(value) { return crypto.createHash("sha256").update(canonical(value)).digest("hex"); }

export function resolveEffectiveConfiguration({ session = {}, profile = {}, app = {} } = {}) {
  const merged = deepMerge(
    deepMerge(deepMerge({}, canonicalizeConfigLayer(app)), canonicalizeConfigLayer(profile)),
    canonicalizeConfigLayer(session),
  );
  const mode = normalizeExperimentMode(merged.mode || merged.experimentMode);
  const outcomeSpace = normalizeOutcomeSpace(merged.outcomeSpace || { type: "BINARY" });
  const target = normalizeTargetDefinition(merged.targetDefinition || merged.target || {}, { mode });
  if (target.prediction !== null && !containsOutcome(outcomeSpace, target.prediction))
    fail("target prediction must belong to the committed outcome space");
  const analysisBase = merged.temporalAnalysis || {};
  // Endpoint/cadence are valid session-level overrides even when the profile
  // stores them inside its analysis object.  Merge them explicitly so the
  // documented session > profile > application precedence applies to every
  // material analysis dimension.
  const analysis = normalizeTemporalAnalysisPlan(deepMerge(analysisBase, {
    primaryEndpoint: merged.primaryEndpoint,
    outputCadence: merged.outputCadence ?? merged.output?.cadence,
  }));
  const definition = {
    version: merged.definitionVersion || "research-definition-v1",
    mode,
    outcomeSpace,
    cardinality: outcomeSpaceSize(outcomeSpace),
    rng: { provider: merged.rng?.provider || "OS_CSPRNG", targetDomain: mode === EXPERIMENT_MODES.FUTURE_TARGET ? "FUTURE_TARGET" : "TARGET_ASSIGNMENT", machineDomain: "MACHINE_OUTPUT", audioDomain: "AUDIO_NOISE", analysisDomain: "ANALYSIS_SIMULATION" },
    targetDefinition: target,
    participantPhase: merged.participantPhase || PARTICIPANT_PHASES.DRAFT,
    evidencePhase: merged.evidencePhase || EVIDENCE_PHASES.NOT_STARTED,
    outputCadence: merged.outputCadence || merged.output?.cadence || analysis.outputCadence,
    primaryEndpoint: analysis.primaryEndpoint,
    temporalAnalysis: analysis,
    revealPolicy: merged.revealPolicy || REVEAL_POLICIES.AFTER_EVIDENCE_COMPLETE,
    profileId: merged.profileId || profile.id || null,
    profileVersion: merged.profileVersion || profile.version || null,
  };
  const canonicalDefinition = canonicalResearchDefinition(definition);
  return Object.freeze({
    ...definition,
    canonicalDefinition,
    configHash: hashResearchDefinition(definition),
    compatibilityFingerprint: createCompatibilityFingerprint(definition),
  });
}

export function createCompatibilityFingerprint(definition = {}) {
  const rng = definition.rng || {};
  const source = {
    version: definition.definitionVersion || definition.version || "research-definition-v1",
    mode: definition.mode || definition.experimentMode,
    outcomeSpace: normalizeOutcomeSpace(definition.outcomeSpace || { type: "BINARY" }),
    cardinality: definition.cardinality || outcomeSpaceSize(definition.outcomeSpace || { type: "BINARY" }),
    rng: {
      provider: rng.provider || "OS_CSPRNG",
      targetDomain: rng.targetDomain || (definition.mode === EXPERIMENT_MODES.FUTURE_TARGET ? "FUTURE_TARGET" : "TARGET_ASSIGNMENT"),
      machineDomain: rng.machineDomain || "MACHINE_OUTPUT",
      audioDomain: rng.audioDomain || "AUDIO_NOISE",
      analysisDomain: rng.analysisDomain || "ANALYSIS_SIMULATION",
    },
    outputCadence: definition.outputCadence || definition.temporalAnalysis?.outputCadence || null,
    endpoint: definition.primaryEndpoint || definition.temporalAnalysis?.primaryEndpoint || null,
    windows: definition.temporalAnalysis?.windows || definition.windows || [],
    profileId: definition.profileId || null,
    profileVersion: definition.profileVersion || null,
    targetSemantics: definition.targetDefinition?.semantics || null,
    analysisVersion: definition.temporalAnalysis?.version || definition.analysisVersion || ANALYSIS_METHOD.VERSION,
  };
  return hashResearchDefinition(source);
}

export function precommitReview(definition) {
  const config = definition?.mode ? definition : resolveEffectiveConfiguration({ session: definition });
  const target = config.targetDefinition || {};
  const space = normalizeOutcomeSpace(config.outcomeSpace);
  const k = outcomeSpaceSize(space);
  const spaceText = space.type === OUTCOME_SPACE_TYPES.INTEGER_RANGE
    ? `${space.minInclusive}..${space.maxInclusive}`
    : space.values.map(String).join(", ");
  return Object.freeze({
    mode: config.mode,
    outcomeSpace: spaceText,
    cardinality: k,
    chanceText: `1/${k}`,
    targetAnchor: target.anchor,
    target: target.target,
    targetSemantics: target.semantics,
    participantPhase: config.participantPhase,
    evidencePhase: config.evidencePhase,
    outputCadence: config.outputCadence,
    primaryEndpoint: config.primaryEndpoint,
    windows: config.temporalAnalysis?.windows || [],
    configHash: config.configHash || hashResearchDefinition(config),
    compatibilityFingerprint: config.compatibilityFingerprint || createCompatibilityFingerprint(config),
  });
}

function logGamma(value) {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.99999999999980993;
  const z = value - 1;
  for (let i = 0; i < coefficients.length; i += 1) x += coefficients[i] / (z + i + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export function singleTargetProbability(cardinality) {
  const k = Number(cardinality);
  if (!Number.isSafeInteger(k) || k < 1) fail("cardinality must be a positive safe integer");
  return { value: 1 / k, method: ANALYSIS_METHOD.NULL_MODEL, version: ANALYSIS_METHOD.VERSION };
}

export function anyHitProbability(cardinality, trials) {
  const k = Number(cardinality);
  const n = Number(trials);
  if (!Number.isSafeInteger(k) || k < 1) fail("cardinality must be a positive safe integer");
  if (!Number.isSafeInteger(n) || n < 0) fail("trials must be a non-negative safe integer");
  if (n > MAX_PROBABILITY_TRIALS) fail(`trials must not exceed ${MAX_PROBABILITY_TRIALS}`);
  const p = 1 / k;
  const value = n === 0 ? 0 : -Math.expm1(n * Math.log1p(-p));
  return { value, method: "ANY_HIT_EXACT_UNIFORM", version: ANALYSIS_METHOD.VERSION, cardinality: k, trials: n };
}

export function expectedHits(cardinality, trials) {
  const k = Number(cardinality); const n = Number(trials);
  if (!Number.isSafeInteger(k) || k < 1 || !Number.isSafeInteger(n) || n < 0) fail("invalid cardinality or trials");
  if (n > MAX_PROBABILITY_TRIALS) fail(`trials must not exceed ${MAX_PROBABILITY_TRIALS}`);
  return { value: n / k, method: "EXPECTED_BINOMIAL_COUNT", version: ANALYSIS_METHOD.VERSION, cardinality: k, trials: n };
}

function logBinomial(n, hit) {
  if (hit < 0 || hit > n) return -Infinity;
  return logGamma(n + 1) - logGamma(hit + 1) - logGamma(n - hit + 1);
}

export function binomialProbability(cardinality, trials, hits) {
  const k = Number(cardinality); const n = Number(trials); const h = Number(hits);
  if (!Number.isSafeInteger(k) || k < 1 || !Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(h) || h < 0 || h > n)
    fail("invalid binomial arguments");
  if (n > MAX_PROBABILITY_TRIALS) fail(`trials must not exceed ${MAX_PROBABILITY_TRIALS}`);
  if (k === 1) return { value: h === n ? 1 : 0, method: "BINOMIAL_PMF", version: ANALYSIS_METHOD.VERSION, cardinality: k, trials: n, hits: h };
  const p = 1 / k;
  const logP = h * Math.log(p) + (n - h) * Math.log1p(-p);
  return { value: Math.exp(logBinomial(n, h) + logP), method: "BINOMIAL_PMF", version: ANALYSIS_METHOD.VERSION, cardinality: k, trials: n, hits: h };
}

export function binomialTail(cardinality, trials, hits, side = "GE") {
  const k = Number(cardinality); const n = Number(trials); const h = Number(hits);
  if (!Number.isSafeInteger(k) || k < 1 || !Number.isSafeInteger(n) || n < 0 || !Number.isSafeInteger(h) || h < 0 || h > n)
    fail("invalid binomial arguments");
  if (n > MAX_PROBABILITY_TRIALS) fail(`trials must not exceed ${MAX_PROBABILITY_TRIALS}`);
  const normalizedSide = String(side).toUpperCase();
  if (!["GE", "LE"].includes(normalizedSide)) fail("binomial tail side must be GE or LE");
  if (k === 1) {
    const value = normalizedSide === "LE" ? (h >= n ? 1 : 0) : (h <= n ? 1 : 0);
    return { value, method: `BINOMIAL_TAIL_${normalizedSide === "LE" ? "LE" : "GE"}`, version: ANALYSIS_METHOD.VERSION, cardinality: k, trials: n, hits: h };
  }
  const start = normalizedSide === "LE" ? 0 : h;
  const end = normalizedSide === "LE" ? h : n;
  let value = 0;
  for (let i = start; i <= end; i += 1) value += binomialProbability(k, n, i).value;
  return { value: Math.min(1, Math.max(0, value)), method: `BINOMIAL_TAIL_${normalizedSide === "LE" ? "LE" : "GE"}`, version: ANALYSIS_METHOD.VERSION, cardinality: k, trials: n, hits: h };
}

export function classifyLatency(actualUtcMs, scheduledUtcMs, window = {}) {
  const latencyMs = Number(actualUtcMs) - Number(scheduledUtcMs);
  const normalized = normalizeTemporalWindow(window);
  const inPre = normalized.enabled && normalized.preMs > 0 && latencyMs < 0 && Math.abs(latencyMs) <= normalized.preMs;
  const inPost = normalized.enabled && normalized.postMs > 0 && latencyMs >= 0 && latencyMs <= normalized.postMs;
  return { latencyMs, signedLatencyMs: latencyMs, classification: latencyMs === 0 ? "EXACT" : inPre ? "PRE_WINDOW" : inPost ? "POST_WINDOW" : latencyMs < 0 ? "EARLY_EXPLORATORY" : "LATE_EXPLORATORY" };
}

export function evaluateRevealGate(status = {}) {
  const required = ["rawReportLocked", "evidenceComplete", "primaryResolved", "postTargetComplete", "integrityAcceptable"];
  const futureRequired = status.mode === EXPERIMENT_MODES.FUTURE_TARGET ? ["futureTargetGenerated", "predictionCommitted"] : [];
  const missing = [...required, ...futureRequired].filter((key) => status[key] !== true);
  return Object.freeze({ eligible: missing.length === 0, missing });
}

export function normalizeCrossSessionAnalysis(value = {}) {
  const workflow = String(value.workflow || "DISCOVER").toUpperCase();
  if (!["DISCOVER", "PRECOMMIT", "REPLICATE", "AGGREGATE"].includes(workflow)) fail(`Unsupported cross-session workflow ${workflow}`);
  const anchor = String(value.anchor || TARGET_ANCHORS.PARTICIPANT_REQUEST).toUpperCase();
  if (!Object.values(TARGET_ANCHORS).includes(anchor)) fail(`Unsupported cross-session anchor ${anchor}`);
  return Object.freeze({
    version: value.version || "cross-session-analysis-v1",
    workflow,
    anchor,
    compatibilityFingerprint: value.compatibilityFingerprint || null,
    exploratory: value.exploratory === true,
    multipleTesting: value.multipleTesting || "NONE",
    nullSimulationSeedDomain: value.nullSimulationSeedDomain || "ANALYSIS_SIMULATION",
  });
}

export const TemporalWindow = Object.freeze({ normalize: normalizeTemporalWindow });
export const TemporalAnalysisPlan = Object.freeze({ normalize: normalizeTemporalAnalysisPlan });
export const CrossSessionAnalysis = Object.freeze({ normalize: normalizeCrossSessionAnalysis });
export const OutcomeSpace = Object.freeze({
  normalize: normalizeOutcomeSpace,
  validate: validateOutcomeSpace,
  size: outcomeSpaceSize,
  contains: containsOutcome,
  sample: sampleOutcome,
  format: formatOutcome,
});
export const TargetDefinition = Object.freeze({ normalize: normalizeTargetDefinition });

export default Object.freeze({
  EXPERIMENT_MODES,
  OUTCOME_SPACE_TYPES,
  PARTICIPANT_PHASES,
  EVIDENCE_PHASES,
  TARGET_ANCHORS,
  OUTPUT_CADENCES,
  PRIMARY_ENDPOINTS,
  REVEAL_POLICIES,
  normalizeOutcomeSpace,
  validateOutcomeSpace,
  outcomeSpaceSize,
  containsOutcome,
  sampleOutcome,
  formatOutcome,
  OutcomeSpace,
  TargetDefinition,
  TemporalWindow,
  TemporalAnalysisPlan,
  CrossSessionAnalysis,
});
