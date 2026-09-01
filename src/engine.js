import crypto from "node:crypto";

export const APP_VERSION = "1.2.0";
export const ENGINE_VERSION = "1.2.0";

export function sha256(value) {
  const data = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === "string" ? value : canonical(value));
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
    .join(",")}}`;
}

export class CSPRNG {
  constructor() {
    this.id = "OS_CSPRNG";
    this.version = "node-crypto";
  }
  int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1)
      throw new Error("maxExclusive must be a positive safe integer");
    return crypto.randomInt(maxExclusive);
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
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1)
      throw new Error("maxExclusive must be a positive safe integer");
    return Math.floor(this.next() * maxExclusive);
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
    exploratory: ["pre", "post"],
    threshold: 0.15,
    sustainedBlocks: 2,
    version: "analysis-v1",
  },
  reveal: { policy: "AFTER_RAW_REPORT_LOCK" },
  reporting: { version: "report-v1" },
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
};

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
  if (!profile?.outcomeSpace?.values?.length)
    errors.push("outcomeSpace.values must contain at least one outcome");
  if (!profile?.mapping?.entries) errors.push("mapping.entries is required");
  if (
    profile?.outcomeSpace?.type === "BINARY" &&
    profile.outcomeSpace.values.length !== 2
  )
    errors.push(
      "outcomeSpace.values must contain exactly two values for BINARY",
    );
  for (const value of profile?.outcomeSpace?.values ?? [])
    if (profile.mapping.entries[String(value)] === undefined)
      errors.push(`mapping.entries is missing objective value ${value}`);
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
  if (profile?.reveal?.policy === "AFTER_RAW_REPORT_LOCK" && !profile.protocol)
    errors.push("protocol is required before raw-report reveal");
  return { valid: errors.length === 0, errors };
}

export function assignOutcome(profile, rng = new CSPRNG()) {
  const values = profile.outcomeSpace.values;
  return values[rng.int(values.length)];
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
  return profile.mapping.entries[String(objective)]?.label ?? String(objective);
}
export function requestInstruction(profile, objective) {
  return profile.timing.wording.replace(
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
}) {
  const direction = values.map((v) => (v === requested ? 1 : -1));
  const cumulative = [];
  let total = 0;
  for (let i = 0; i < direction.length; i++) {
    total += direction[i];
    cumulative.push(total);
  }
  const region = ([start, end]) => {
    const slice = values.slice(start, end);
    const matches = slice.filter((v) => v === requested).length;
    return {
      start,
      end,
      count: slice.length,
      matches,
      proportion: slice.length ? matches / slice.length : null,
      deviation: slice.length
        ? (matches - slice.length / 2) / slice.length
        : null,
    };
  };
  const primaryResult = region(primary);
  const exploratoryResults = exploratory.map(region);
  const threshold = 0.15 * Math.max(1, primaryResult.count);
  const peak = cumulative.reduce(
    (best, x, i) =>
      Math.abs(x) > Math.abs(best.value) ? { value: x, index: i } : best,
    { value: 0, index: -1 },
  );
  return {
    requested,
    total: values.length,
    matches: values.filter((v) => v === requested).length,
    proportion: values.length
      ? values.filter((v) => v === requested).length / values.length
      : null,
    direction,
    cumulative,
    primary: primaryResult,
    exploratory: exploratoryResults,
    peakDeviation: peak,
    threshold,
    analysisVersion: "analysis-v1",
  };
}

export function timingPlan(profile, now = Date.now()) {
  const mode = profile.timing.mode;
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
