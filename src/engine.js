import crypto from "node:crypto";
import {
  ANALYSIS_METHOD,
  EXPERIMENT_MODES,
  OUTCOME_SPACE_TYPES,
  PARTICIPANT_PHASES,
  EVIDENCE_PHASES,
  TARGET_ANCHORS,
  OUTPUT_CADENCES,
  PRIMARY_ENDPOINTS,
  REVEAL_POLICIES,
  MAX_OUTCOME_CARDINALITY,
  MAX_ENUMERATED_VALUES,
  MAX_TEMPORAL_WINDOWS,
  MAX_TEMPORAL_WINDOW_MS,
  MAX_PROBABILITY_TRIALS,
  MAX_SCHEDULED_OUTPUTS,
  normalizeOutcomeSpace,
  validateOutcomeSpace,
  outcomeSpaceSize,
  containsOutcome,
  sampleOutcome,
  formatOutcome,
  normalizeExperimentMode,
  normalizeTargetDefinition,
  normalizeTargetOffsetMs,
  isParticipantStopAnchor,
  normalizeExecutionWindow,
  normalizeTemporalWindow,
  normalizeTemporalAnalysisPlan,
  normalizeCrossSessionAnalysis,
  evaluateRevealGate,
  classifyLatency,
  anyHitProbability,
  binomialProbability,
  binomialTail,
  expectedHits,
  singleTargetProbability,
  resolveEffectiveConfiguration,
  createCompatibilityFingerprint,
  OutcomeSpace,
  TargetDefinition,
} from "./domain/research-model.js";

export const APP_VERSION = "1.2.0";
export const ENGINE_VERSION = "1.2.0";

// Public research-model API is re-exported here for existing engine callers.
export {
  ANALYSIS_METHOD,
  EXPERIMENT_MODES,
  OUTCOME_SPACE_TYPES,
  PARTICIPANT_PHASES,
  EVIDENCE_PHASES,
  TARGET_ANCHORS,
  OUTPUT_CADENCES,
  PRIMARY_ENDPOINTS,
  REVEAL_POLICIES,
  MAX_OUTCOME_CARDINALITY,
  MAX_ENUMERATED_VALUES,
  MAX_TEMPORAL_WINDOWS,
  MAX_TEMPORAL_WINDOW_MS,
  MAX_PROBABILITY_TRIALS,
  MAX_SCHEDULED_OUTPUTS,
  normalizeOutcomeSpace,
  validateOutcomeSpace,
  outcomeSpaceSize,
  containsOutcome,
  sampleOutcome,
  formatOutcome,
  normalizeExperimentMode,
  normalizeTargetDefinition,
  normalizeTargetOffsetMs,
  isParticipantStopAnchor,
  normalizeExecutionWindow,
  normalizeTemporalWindow,
  normalizeTemporalAnalysisPlan,
  normalizeCrossSessionAnalysis,
  evaluateRevealGate,
  classifyLatency,
  anyHitProbability,
  binomialProbability,
  binomialTail,
  expectedHits,
  singleTargetProbability,
  resolveEffectiveConfiguration,
  createCompatibilityFingerprint,
  OutcomeSpace,
  TargetDefinition,
};

export function sha256(value) {
  const data = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === "string" ? value : canonical(value));
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function canonical(value) {
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
    .join(",")}}`;
}

export const CSPRNG_MAX_EXCLUSIVE = Number.MAX_SAFE_INTEGER;

export class CSPRNG {
  constructor(cryptoProvider = crypto) {
    this.id = "OS_CSPRNG";
    this.version = "node-crypto";
    this.hasRandomBytesProvider = typeof cryptoProvider?.randomBytes === "function";
    this.cryptoProvider = {
      randomBytes: typeof cryptoProvider?.randomBytes === "function" ? cryptoProvider.randomBytes.bind(cryptoProvider) : crypto.randomBytes,
      randomInt: typeof cryptoProvider?.randomInt === "function" ? cryptoProvider.randomInt.bind(cryptoProvider) : null,
    };
  }
  int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > CSPRNG_MAX_EXCLUSIVE)
      throw new Error(`maxExclusive must be a positive safe integer <= ${CSPRNG_MAX_EXCLUSIVE}`);
    // Rejection sampling over 64 random bits is exact for every supported
    // safe-integer range, including the one-billion-value temporal profile.
    if (this.cryptoProvider.randomInt && !this.hasRandomBytesProvider && maxExclusive < 2 ** 48) {
      const value = this.cryptoProvider.randomInt(maxExclusive);
      if (!Number.isSafeInteger(value) || value < 0 || value >= maxExclusive)
        throw new Error("OS_CSPRNG provider returned an out-of-range integer");
      return value;
    }
    const bound = 1n << 64n;
    const limit = bound - (bound % BigInt(maxExclusive));
    let value;
    do value = this.cryptoProvider.randomBytes(8).readBigUInt64BE(0); while (value >= limit);
    return Number(value % BigInt(maxExclusive));
  }
  bits(n) {
    if (!Number.isInteger(n) || n < 1 || n > 30)
      throw new Error("bit width must be 1..30");
    return this.int(2 ** n);
  }
}

export class DeterministicRNG {
  constructor(seed = "mip-test-seed") {
    this.id = "DETERMINISTIC_PRNG_TEST";
    this.version = "xorshift32-v1";
    this.state =
      crypto
        .createHash("sha256")
        .update(String(seed))
        .digest()
        .readUInt32LE(0) || 0x9e3779b9;
    this.seed = String(seed);
  }
  next() {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }
  int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000)
      throw new Error("deterministic maxExclusive must be a positive safe integer <= 2^32");
    // Use the generated uint32 directly with rejection sampling.  This keeps
    // deterministic fixtures reproducible without floating-point scaling or
    // modulo bias.
    const bound = 0x100000000;
    const limit = bound - (bound % maxExclusive);
    let value;
    do {
      this.next();
      value = this.state >>> 0;
    } while (value >= limit);
    return value % maxExclusive;
  }
  bits(n) {
    if (!Number.isInteger(n) || n < 1 || n > 30)
      throw new Error("bit width must be 1..30");
    return this.int(2 ** n);
  }
}

export function createRNG(provider = "OS_CSPRNG", seed) {
  if (provider === "OS_CSPRNG") return new CSPRNG();
  if (provider === "DETERMINISTIC_PRNG_TEST")
    return new DeterministicRNG(seed ?? "mip-test-seed");
  throw new Error(`Unsupported RNG provider: ${provider}`);
}

export const mappings = {
  LITERAL_BINARY_V1: {
    id: "LITERAL_BINARY_V1",
    version: 1,
    labels: ["0", "1"],
    entries: {
      0: {
        label: "0",
        semantic: "zero",
        visual: "closed loop",
        kinesthetic: "closure / circular movement",
        endpoint: "the machine is in objective state 0",
        affect: "neutral completion",
      },
      1: {
        label: "1",
        semantic: "one",
        visual: "upright stroke",
        kinesthetic: "straight upward movement",
        endpoint: "the machine is in objective state 1",
        affect: "neutral completion",
      },
    },
  },
  BLUE_GOLD_V1: {
    id: "BLUE_GOLD_V1",
    version: 1,
    labels: ["BLUE", "GOLD"],
    entries: { 0: { label: "BLUE" }, 1: { label: "GOLD" } },
  },
  REVERSED_GOLD_BLUE_V1: {
    id: "REVERSED_GOLD_BLUE_V1",
    version: 1,
    labels: ["GOLD", "BLUE"],
    entries: { 0: { label: "GOLD" }, 1: { label: "BLUE" } },
  },
  ARBITRARY_BINARY_V1: {
    id: "ARBITRARY_BINARY_V1",
    version: 1,
    labels: ["NORTH", "SOUTH"],
    entries: { 0: { label: "NORTH" }, 1: { label: "SOUTH" } },
  },
};

const baseProtocol = {
  stageMode: "TIMED_AUTOMATIC",
  cueMode: "TIMED_NONSEMANTIC",
  // Semantic stage records remain timed for these legacy/demo profiles, but
  // only this explicit set is audible.  Zero-duration REQUEST_END and
  // POST_REQUEST boundaries are intentionally non-audible, preventing
  // accidental same-frame double tones.
  audibleStages: [
    "INDUCTION_START",
    "SETTLING_START",
    "REQUEST_START",
    "RELEASE_START",
    "NEUTRAL_OBSERVATION",
    "RETURN_CUE",
  ],
  inductionSeconds: 5,
  settleSeconds: 5,
  requestSeconds: 10,
  releaseSeconds: 10,
  neutralSeconds: 10,
  returnSeconds: 5,
  cueVersion: "CUES_V1",
};
const common = {
  schemaVersion: "1.0",
  mode: EXPERIMENT_MODES.INFLUENCE,
  outcomeSpace: { type: "BINARY", values: [0, 1] },
  mapping: mappings.LITERAL_BINARY_V1,
  encoding: {
    id: "SER-A-V2",
    version: 2,
    modality: "combined",
    repetitionCount: 3,
    releaseInstruction: "Release the request and observe neutrally.",
  },
  output: {
    type: "CONTINUOUS_STREAM",
    blockSize: 128,
    preBlocks: 2,
    primaryBlocks: 4,
    postBlocks: 2,
  },
  rng: { provider: "OS_CSPRNG" },
  protocol: baseProtocol,
  audio: { recipeId: "A-U396-4", version: 1 },
  analysis: {
    primaryWindow: "primary",
    primaryEndpoint: "EXACT_SLOT",
    outputCadence: "FIXED_INTERVAL",
    exploratory: ["pre", "post"],
    threshold: 0.15,
    sustainedBlocks: 2,
    version: "analysis-v1",
  },
  reveal: { policy: "AFTER_RAW_REPORT_LOCK" },
  reporting: { version: "report-v1" },
  // Legacy/demo definitions remain available to the generic engine and to
  // historical reports, but are not part of the owner-facing pilot catalog.
  catalog: { visibility: "INTERNAL_VALIDATION", selectableForOwner: false },
};

const operationalCommon = {
  schemaVersion: "1.0",
  targetAssignment: "SYSTEM_RANDOM_UNIFORM",
  outcomeSpace: { type: "BINARY", values: [0, 1] },
  mapping: mappings.LITERAL_BINARY_V1,
  encoding: common.encoding,
  output: {
    type: "CONTINUOUS_STREAM",
    blockSize: 1,
    preBlocks: 0,
    primaryBlocks: 1,
    postBlocks: 0,
    intervalMs: 100,
    cadence: "FIXED_INTERVAL",
  },
  rng: { provider: "OS_CSPRNG" },
  protocol: {
    ...baseProtocol,
    stageMode: "PARTICIPANT_PACED",
    cueMode: "NONE",
    audibleStages: [],
    participantPaced: true,
    returnSeconds: 0,
    cueVersion: null,
  },
  audio: { recipeId: "A-U396-4", version: 1 },
  analysis: {
    primaryWindow: { id: "primary", enabled: true, preMs: 2_000, postMs: 2_000 },
    windows: [{ id: "primary", enabled: true, preMs: 2_000, postMs: 2_000 }],
    primaryEndpoint: "TARGET_FREQUENCY",
    outputCadence: "FIXED_INTERVAL",
    intervalMs: 100,
    toleranceMs: 100,
    version: "temporal-analysis-v1",
  },
  reveal: { policy: "AFTER_EVIDENCE_COMPLETE" },
  reporting: { version: "report-v1" },
  timing: {
    mode: "PARTICIPANT_STOP_ANCHORED",
    anchorReference: "PARTICIPANT_STOP_RETURN",
    targetOffsetMs: 0,
    wording: "Favor {target}; return when ready.",
  },
  catalog: { visibility: "OPERATIONAL", selectableForOwner: true },
};

export const profiles = {
  BASELINE_NOW_BINARY_V1: {
    id: "BASELINE_NOW_BINARY_V1",
    version: 1,
    name: "Immediate Binary Baseline",
    purpose: "First-use immediate REQUEST with a continuous hidden stream.",
    status: "Validated",
    timing: {
      mode: "IMMEDIATE_REQUEST",
      wording: "Make the system output/favor {target} now.",
    },
    ...common,
  },
  DRY_RELATIVE_5MIN_BINARY_V1: {
    id: "DRY_RELATIVE_5MIN_BINARY_V1",
    version: 1,
    name: "Relative Delay Demonstration",
    purpose: "Validation profile for a five-minute relative target.",
    status: "Validated",
    timing: {
      mode: "RELATIVE_DELAY",
      delaySeconds: 300,
      wording: "At the committed relative target, favor {target}.",
    },
    ...common,
  },
  DRY_ABSOLUTE_TIME_BINARY_V1: {
    id: "DRY_ABSOLUTE_TIME_BINARY_V1",
    version: 1,
    name: "Absolute Time Demonstration",
    purpose: "Validation profile for an explicit UTC target.",
    status: "Validated",
    timing: {
      mode: "ABSOLUTE_DATETIME",
      timezone: "UTC",
      wording: "At the committed UTC target, favor {target}.",
    },
    ...common,
  },
  DRY_ARBITRARY_MAPPING_BINARY_V1: {
    id: "DRY_ARBITRARY_MAPPING_BINARY_V1",
    version: 1,
    name: "Arbitrary Mapping Demonstration",
    purpose: "Binary outcome with a configurable participant-facing mapping.",
    status: "Validated",
    timing: {
      mode: "IMMEDIATE_REQUEST",
      wording: "Make the system output/favor {target} now.",
    },
    ...common,
    mapping: mappings.ARBITRARY_BINARY_V1,
  },
  DRY_REVERSED_MAPPING_BINARY_V1: {
    id: "DRY_REVERSED_MAPPING_BINARY_V1",
    version: 1,
    name: "Reversed Mapping Demonstration",
    purpose: "Reversed arbitrary labels without engine changes.",
    status: "Validated",
    timing: {
      mode: "IMMEDIATE_REQUEST",
      wording: "Make the system output/favor {target} now.",
    },
    ...common,
    mapping: mappings.REVERSED_GOLD_BLUE_V1,
  },
  DRY_SEMANTIC_ONLY_BINARY_V1: {
    id: "DRY_SEMANTIC_ONLY_BINARY_V1",
    version: 1,
    name: "Semantic-Only Encoding",
    purpose: "Encoding factor isolation profile.",
    status: "Validated",
    timing: {
      mode: "IMMEDIATE_REQUEST",
      wording: "Make the system output/favor {target} now.",
    },
    ...common,
    encoding: {
      id: "SEMANTIC_ONLY_V1",
      version: 1,
      modality: "semantic-only",
      repetitionCount: 3,
      releaseInstruction: "Release the semantic request and observe neutrally.",
    },
  },
  DRY_FOUR_OUTCOME_V1: {
    id: "DRY_FOUR_OUTCOME_V1",
    version: 1,
    name: "Four-Outcome Finite Space",
    purpose: "Configuration-only demonstration of a four-state outcome space.",
    status: "Validated",
    timing: {
      mode: "IMMEDIATE_REQUEST",
      wording: "Make the system output/favor {target} now.",
    },
    ...common,
    outcomeSpace: {
      type: "INTEGER_RANGE",
      min: 0,
      max: 3,
      values: [0, 1, 2, 3],
    },
    mapping: {
      id: "FOUR_STATE_LABELS_V1",
      version: 1,
      labels: ["NORTH", "EAST", "SOUTH", "WEST"],
      entries: {
        0: { label: "NORTH" },
        1: { label: "EAST" },
        2: { label: "SOUTH" },
        3: { label: "WEST" },
      },
    },
    output: { type: "SINGLE_OUTCOME", blockSize: 1 },
  },
  DRY_BLOCK_REVEAL_V1: {
    id: "DRY_BLOCK_REVEAL_V1",
    version: 1,
    name: "Block Reveal Demonstration",
    purpose: "Block-level reveal gating demonstration.",
    status: "Validated",
    timing: {
      mode: "IMMEDIATE_REQUEST",
      wording: "Make the system output/favor {target} now.",
    },
    ...common,
    reveal: { policy: "AFTER_BLOCK_LOCK" },
  },
  TEMPORAL_INTEGER_RANGE_V1: {
    id: "TEMPORAL_INTEGER_RANGE_V1",
    version: 1,
    name: "Temporal Integer Range Demonstration",
    purpose: "Generic symbolic integer range with target-anchored temporal evidence.",
    status: "Validated",
    mode: EXPERIMENT_MODES.INFLUENCE,
    timing: {
      mode: "IMMEDIATE_REQUEST",
      wording: "Make the system output/favor {target} now.",
    },
    outcomeSpace: {
      type: "INTEGER_RANGE",
      minInclusive: 0,
      maxInclusive: 999_999_999,
    },
    mapping: {
      id: "INTEGER_IDENTITY_V1",
      version: 1,
      labels: [],
      entries: {},
    },
    output: {
      type: "CONTINUOUS_STREAM",
      blockSize: 1,
      preBlocks: 2,
      primaryBlocks: 4,
      postBlocks: 2,
      intervalMs: 100,
    },
    rng: { provider: "OS_CSPRNG" },
    protocol: baseProtocol,
    audio: { recipeId: "A-U396-4", version: 1 },
    analysis: {
      primaryEndpoint: "FIXED_TIME_WINDOW",
      outputCadence: "FIXED_INTERVAL",
      toleranceMs: 100,
      primaryWindow: { id: "primary", enabled: true, preMs: 2_000, postMs: 2_000 },
      windows: [{ id: "primary", enabled: true, preMs: 2_000, postMs: 2_000 }],
      version: "temporal-analysis-v1",
    },
    reveal: { policy: "AFTER_EVIDENCE_COMPLETE" },
    reporting: { version: "report-v1" },
  },
  STOP_ANCHORED_INTEGER_RANGE_V1: {
    id: "STOP_ANCHORED_INTEGER_RANGE_V1",
    version: 1,
    name: "Participant-Paced Stop-Anchored Integer Range",
    purpose: "Participant-paced integer evidence stream anchored only when Return/Stop is activated.",
    status: "Validated",
    mode: EXPERIMENT_MODES.INFLUENCE,
    timing: {
      mode: "PARTICIPANT_STOP_ANCHORED",
      anchorReference: "PARTICIPANT_STOP_RETURN",
      targetOffsetMs: 0,
      wording: "Make the system output/favor {target}; return when ready.",
    },
    outcomeSpace: {
      type: "INTEGER_RANGE",
      minInclusive: 0,
      maxInclusive: 999_999_999,
    },
    mapping: {
      id: "INTEGER_IDENTITY_V1",
      version: 1,
      labels: [],
      entries: {},
    },
    output: {
      type: "CONTINUOUS_STREAM",
      blockSize: 1,
      preBlocks: 0,
      primaryBlocks: 1,
      postBlocks: 0,
      intervalMs: 100,
      cadence: "FIXED_INTERVAL",
    },
    rng: { provider: "OS_CSPRNG" },
    protocol: {
      ...baseProtocol,
      stageMode: "PARTICIPANT_PACED",
      cueMode: "NONE",
      audibleStages: [],
      participantPaced: true,
      returnSeconds: 0,
      cueVersion: null,
    },
    audio: { recipeId: "A-U396-4", version: 1 },
    analysis: {
      primaryEndpoint: "FIXED_TIME_WINDOW",
      outputCadence: "FIXED_INTERVAL",
      toleranceMs: 100,
      // Owners may override these durations per session.  Keeping a small
      // default makes the profile usable for validation while the execution
      // window remains an explicit owner commitment.
      primaryWindow: { id: "primary", enabled: true, preMs: 2_000, postMs: 2_000 },
      windows: [{ id: "primary", enabled: true, preMs: 2_000, postMs: 2_000 }],
      version: "temporal-analysis-v1",
    },
    reveal: { policy: "AFTER_EVIDENCE_COMPLETE" },
    reporting: { version: "report-v1" },
  },
  OP_REQUEST_BINARY_V1: {
    ...operationalCommon,
    id: "OP_REQUEST_BINARY_V1",
    version: 1,
    name: "Binary Request",
    purpose: "Primary pilot REQUEST / INFLUENCE condition.",
    status: "Validated",
    mode: EXPERIMENT_MODES.INFLUENCE,
    catalog: { visibility: "OPERATIONAL", selectableForOwner: true, condition: "REQUEST", displayOrder: 1 },
  },
  OP_CONTROL_BINARY_V1: {
    ...operationalCommon,
    id: "OP_CONTROL_BINARY_V1",
    version: 1,
    name: "Binary No-Intention Control",
    purpose: "No-intention baseline using the same machine/audio/timing architecture.",
    status: "Validated",
    mode: EXPERIMENT_MODES.CONTROL,
    timing: {
      ...operationalCommon.timing,
      controlWording: "No target request in this session. Follow the neutral procedure and return when ready.",
    },
    catalog: { visibility: "OPERATIONAL", selectableForOwner: true, condition: "CONTROL", displayOrder: 2 },
  },
  OP_AUDIO_SHAM_BINARY_V1: {
    ...operationalCommon,
    id: "OP_AUDIO_SHAM_BINARY_V1",
    version: 1,
    name: "Binary Request — Audio Sham",
    purpose: "Request condition with matched 396/396 carrier and no binaural difference.",
    status: "Validated",
    mode: EXPERIMENT_MODES.SHAM,
    audio: { recipeId: "A-SHAM-0", version: 1 },
    catalog: { visibility: "OPERATIONAL", selectableForOwner: true, condition: "AUDIO_SHAM", displayOrder: 3 },
  },
};

export const OPERATIONAL_PROFILE_IDS = Object.freeze([
  "OP_REQUEST_BINARY_V1",
  "OP_CONTROL_BINARY_V1",
  "OP_AUDIO_SHAM_BINARY_V1",
]);

export function isOperationalProfile(profileOrId) {
  const id = typeof profileOrId === "string" ? profileOrId : profileOrId?.id;
  return OPERATIONAL_PROFILE_IDS.includes(id);
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
export function resolveProfile(id) {
  const p = profiles[id];
  if (!p) throw new Error(`Unknown experiment profile: ${id}`);
  return clone(p);
}
export function validateProfile(profile) {
  const errors = [];
  if (!profile?.id) errors.push("profile.id is required");
  const spaceValidation = validateOutcomeSpace(profile?.outcomeSpace);
  if (!spaceValidation.valid) errors.push(...spaceValidation.errors);
  const normalizedSpace = spaceValidation.normalized;
  if (!profile?.mapping?.entries) errors.push("mapping.entries is required");
  if (normalizedSpace && profile?.mapping?.entries) {
    // Enumerated and binary spaces can be checked exhaustively.  Integer
    // ranges remain symbolic; only explicitly supplied labels are validated.
    const values = normalizedSpace.type === "INTEGER_RANGE"
      ? Object.keys(profile.mapping.entries).map((key) => Number(key))
      : normalizedSpace.values;
    for (const value of values) {
      if (normalizedSpace.type === "INTEGER_RANGE" && !containsOutcome(normalizedSpace, value))
        errors.push(`mapping.entries contains an out-of-range objective value ${value}`);
      else if (profile.mapping.entries[String(value)] === undefined && normalizedSpace.type !== "INTEGER_RANGE")
        errors.push(`mapping.entries is missing objective value ${value}`);
    }
  }
  const mode = profile?.mode || profile?.experimentMode || EXPERIMENT_MODES.INFLUENCE;
  try { if (!Object.values(EXPERIMENT_MODES).includes(String(mode).toUpperCase())) errors.push(`unsupported experiment mode ${mode}`); } catch { errors.push("experiment mode is invalid"); }
  if (
    ![
      "IMMEDIATE_REQUEST",
      "NEXT_ELIGIBLE_OUTPUT",
      "RELATIVE_DELAY",
      "ABSOLUTE_DATETIME",
      "ABSOLUTE_WINDOW",
      "RELATIVE_WINDOW",
      "CONTINUOUS_AROUND_REQUEST",
      "PREGENERATED_HIDDEN",
      "PARTICIPANT_STOP_ANCHORED",
    ].includes(profile?.timing?.mode)
  )
    errors.push("timing.mode is unsupported or missing");
  if (
    profile?.timing?.mode === "RELATIVE_DELAY" &&
    !(profile.timing.delaySeconds >= 0)
  )
    errors.push("timing.delaySeconds must be non-negative");
  if (profile?.timing?.mode === "ABSOLUTE_DATETIME" && !profile.timing.timezone)
    errors.push("timing.timezone is required for absolute timing");
  if (profile?.timing?.mode === "PARTICIPANT_STOP_ANCHORED") {
    try { normalizeTargetOffsetMs(profile.timing.targetOffsetMs ?? 0); }
    catch (error) { errors.push(`timing.targetOffsetMs is invalid: ${error.message}`); }
    if (profile.timing.executionWindow) {
      try { normalizeExecutionWindow(profile.timing.executionWindow); }
      catch (error) { errors.push(`timing.executionWindow is invalid: ${error.message}`); }
    }
  }
  const stageMode = profile?.protocol?.stageMode === undefined || profile?.protocol?.stageMode === null
    ? (profile?.protocol?.participantPaced === true ? "PARTICIPANT_PACED" : "TIMED_AUTOMATIC")
    : String(profile.protocol.stageMode).toUpperCase();
  if (![
    "TIMED_AUTOMATIC",
    "PARTICIPANT_PACED",
  ].includes(stageMode)) errors.push("protocol.stageMode is unsupported or missing");
  const cueMode = profile?.protocol?.cueMode === undefined || profile?.protocol?.cueMode === null
    ? (stageMode === "PARTICIPANT_PACED" ? "NONE" : "TIMED_NONSEMANTIC")
    : String(profile.protocol.cueMode).toUpperCase();
  if (!["TIMED_NONSEMANTIC", "NONE"].includes(cueMode)) errors.push("protocol.cueMode is unsupported or missing");
  if (stageMode === "PARTICIPANT_PACED" && cueMode !== "NONE") errors.push("participant-paced protocols require protocol.cueMode NONE");
  if (profile?.protocol?.audibleStages !== undefined && !Array.isArray(profile.protocol.audibleStages)) errors.push("protocol.audibleStages must be an array");
  if (profile?.reveal?.policy === "AFTER_RAW_REPORT_LOCK" && !profile.protocol)
    errors.push("protocol is required before raw-report reveal");
  if (profile?.analysis?.primaryEndpoint && !["EXACT_SLOT", "FIXED_TIME_WINDOW", "FIXED_SEQUENCE_WINDOW", "TARGET_FREQUENCY"].includes(String(profile.analysis.primaryEndpoint).toUpperCase()))
    errors.push("analysis.primaryEndpoint is unsupported");
  try {
    const output = profile?.output || {};
    const blockSize = Number(output.blockSize ?? 1);
    const preBlocks = Number(output.preBlocks ?? 0);
    const primaryBlocks = Number(output.primaryBlocks ?? 0);
    const postBlocks = Number(output.postBlocks ?? 0);
    if (![blockSize, preBlocks, primaryBlocks, postBlocks].every((value) => Number.isSafeInteger(value) && value >= 0) || blockSize < 1)
      errors.push("output block/count values must be non-negative safe integers (blockSize must be positive)");
    else {
      const configuredTotal = (preBlocks + primaryBlocks + postBlocks) * blockSize;
      const total = configuredTotal === 0 && output.type === "SINGLE_OUTCOME" ? 1 : configuredTotal;
      if (!Number.isSafeInteger(total) || total < 1 || total > MAX_SCHEDULED_OUTPUTS)
        errors.push(`output opportunity count must be in [1, ${MAX_SCHEDULED_OUTPUTS}]`);
    }
    if (output.intervalMs !== undefined) {
      const interval = Number(output.intervalMs);
      if (!Number.isFinite(interval) || interval <= 0 || interval > MAX_TEMPORAL_WINDOW_MS)
        errors.push(`output.intervalMs must be positive and <= ${MAX_TEMPORAL_WINDOW_MS} ms`);
    }
    normalizeTemporalAnalysisPlan(profile?.analysis || {});
  } catch (error) {
    errors.push(`profile timing/analysis is invalid: ${error.message}`);
  }
  return { valid: errors.length === 0, errors };
}

export function assignOutcome(profile, rng = new CSPRNG()) {
  return sampleOutcome(profile.outcomeSpace, rng);
}
export function encodeExactToken(value, width) {
  if (!Number.isInteger(width) || width < 1 || width > 30)
    throw new Error("Token width must be 1..30");
  const max = 2 ** width;
  if (!Number.isInteger(value) || value < 0 || value >= max)
    throw new Error(`Token value must be in [0, ${max - 1}]`);
  return value.toString(2).padStart(width, "0");
}
export function decodeExactToken(token) {
  if (!/^[01]+$/.test(token) || token.length > 30)
    throw new Error("Token must be a binary string of 1..30 bits");
  return parseInt(token, 2);
}
export function participantTarget(profile, objective) {
  return profile?.mapping?.entries?.[String(objective)]?.label ?? formatOutcome(profile?.outcomeSpace || { type: "BINARY" }, objective);
}
export function requestInstruction(profile, objective) {
  const wording = profile?.mode === EXPERIMENT_MODES.CONTROL
    ? profile.timing?.controlWording || "No target request in this session. Follow the neutral procedure and return when ready."
    : profile.timing?.wording || "Favor {target}; return when ready.";
  return wording.replace(
    "{target}",
    participantTarget(profile, objective),
  );
}
export function scoreSingle(requested, generated) {
  return {
    match: requested === generated,
    category: requested === generated ? "Match" : "No Match",
  };
}

export function analyzeStream({
  requested,
  values,
  primary = [0, values.length],
  exploratory = [],
  outcomeSpace = { type: "BINARY", values: [0, 1] },
}) {
  const normalizedSpace = normalizeOutcomeSpace(outcomeSpace);
  const isBinary = normalizedSpace.type === "BINARY" || outcomeSpace?.type === "BINARY";
  const direction = isBinary ? values.map((v) => (v === requested ? 1 : -1)) : undefined;
  const cumulative = isBinary ? [] : undefined;
  let total = 0;
  if (isBinary) for (const value of direction) { total += value; cumulative.push(total); }
  const region = ([start, end]) => {
    const slice = values.slice(start, end);
    const matches = slice.filter((v) => v === requested).length;
    const k = outcomeSpaceSize(normalizedSpace);
    return {
      start,
      end,
      count: slice.length,
      matches,
      proportion: slice.length ? matches / slice.length : null,
      expectedCount: slice.length / k,
      deviation: isBinary && slice.length ? (matches - slice.length / 2) / slice.length : null,
      probability: slice.length ? binomialTail(k, slice.length, matches, "GE").value : null,
    };
  };
  const primaryResult = region(primary);
  const exploratoryResults = exploratory.map(region);
  const threshold = isBinary ? 0.15 * Math.max(1, primaryResult.count) : null;
  const peak = isBinary ? cumulative.reduce(
    (best, x, i) =>
      Math.abs(x) > Math.abs(best.value) ? { value: x, index: i } : best,
    { value: 0, index: -1 },
  ) : null;
  const matches = values.filter((v) => v === requested).length;
  const k = outcomeSpaceSize(normalizedSpace);
  return {
    requested,
    total: values.length,
    matches,
    proportion: values.length ? matches / values.length : null,
    expectedCount: values.length / k,
    cardinality: k,
    direction,
    cumulative,
    primary: primaryResult,
    exploratory: exploratoryResults,
    peakDeviation: peak,
    threshold,
    probability: anyHitProbability(k, values.length),
    expected: expectedHits(k, values.length),
    analysisVersion: isBinary ? "analysis-v1" : ANALYSIS_METHOD.VERSION,
  };
}

export function timingPlan(profile, now = Date.now()) {
  const mode = profile.timing.mode;
  if (mode === "PARTICIPANT_STOP_ANCHORED") {
    const targetOffsetMs = normalizeTargetOffsetMs(profile.timing.targetOffsetMs ?? profile.timing.offsetMs ?? 0);
    return {
      mode,
      scheduledUtc: null,
      scheduledMonotonicNs: null,
      anchor: "PARTICIPANT_STOP_RETURN",
      anchorReference: "PARTICIPANT_STOP_RETURN",
      targetOffsetMs,
      requestedDelayMs: null,
      actualUtc: null,
      latenessMs: null,
    };
  }
  const start = now;
  let target = now;
  if (mode === "RELATIVE_DELAY")
    target = now + profile.timing.delaySeconds * 1000;
  if (mode === "ABSOLUTE_DATETIME")
    target = profile.timing.targetUtc
      ? Date.parse(profile.timing.targetUtc)
      : now;
  return {
    mode,
    scheduledUtc: new Date(target).toISOString(),
    anchor: mode === "RELATIVE_DELAY" ? "START" : "COMMITMENT",
    requestedDelayMs: target - now,
    actualUtc: null,
    latenessMs: null,
  };
}
