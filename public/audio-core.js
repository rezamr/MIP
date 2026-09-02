/*
 * MIP audio synthesis core.
 *
 * This file intentionally has no Node, DOM, or Web Audio dependencies.  It is
 * loaded by both the offline renderer and mip-processor.js.
 *
 * MIP_PCM_SHA256_V1 canonical stream format:
 *   header: 32 bytes
 *     0..15  ASCII "MIPPCM-SHA256-V1"
 *     16..19 uint32 little-endian sample rate
 *     20..21 uint16 little-endian channel count (always 2)
 *     22..23 uint16 little-endian PCM bit depth (16)
 *     24..27 uint32 little-endian bytes per interleaved frame (4)
 *     28..31 reserved zero bytes
 *   body: PCM16LE interleaved left, right frames.  Quantization is
 *         round(clamp(sample, -1, 1) * 32767), with non-finite samples treated
 *         as zero. This deliberately matches the signed range used by MIP WAV.
 *   trailer: 8-byte uint64 little-endian total body frame count.
 * The header and trailer are part of the SHA-256 input.  A stream is therefore
 * not digest-equivalent to another sample rate or frame count.
 */

export const PROCESSOR_VERSION = "mip-audio-worklet-2.0";
export const AUDIO_CORE_VERSION = "mip-audio-core-2.0";
export const ENGINEERING_VERIFICATION_VERSION = "AUDIO_ENGINEERING_FIXTURES_V1";
export const PCM_DIGEST_VERSION = "MIP_PCM_SHA256_V1";
export const PCM_CANONICAL_FORMAT = Object.freeze({
  version: PCM_DIGEST_VERSION,
  headerBytes: 32,
  magic: "MIPPCM-SHA256-V1",
  sampleRateOffset: 16,
  channelsOffset: 20,
  bitDepthOffset: 22,
  bytesPerFrameOffset: 24,
  body: "PCM16LE_INTERLEAVED_LR",
  quantization: "round(clamp(finite(sample),-1,1)*32767)",
  trailer: "uint64le_total_frames",
});

// Provenance is intentionally represented at parameter level.  A recipe-level
// label is only a summary and must never imply that every numerical field came
// from the same source.
export const PROVENANCE_CLASSES = Object.freeze([
  "PRIMARY_SOURCE_VERIFIED",
  "PRIMARY_SOURCE_DERIVED",
  "MIP_OPERATIONAL_DEFINED",
  "MIP_RECONSTRUCTION_PARAMETER",
  "USER_DEFINED",
  "UNKNOWN_BLOCKED",
]);
export const LFSR_SEQUENCE_PERIOD = 65_535;
export const LFSR_UPDATE_SEMANTICS = "ONE_ADVANCE_PER_RENDERED_PCM_FRAME_MIP_RECONSTRUCTION";

const TAU = Math.PI * 2;
const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b,
  0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
  0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152,
  0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
  0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

function wrapPhase(phase) {
  const wrapped = phase % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

function utf8(value) {
  const string = String(value);
  const bytes = [];
  for (let i = 0; i < string.length; i += 1) {
    let cp = string.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < string.length) {
      const low = string.charCodeAt(++i);
      if (low >= 0xdc00 && low <= 0xdfff)
        cp = 0x10000 + ((cp - 0xd800) << 10) + low - 0xdc00;
      else i -= 1;
    }
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >>> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000)
      bytes.push(0xe0 | (cp >>> 12), 0x80 | ((cp >>> 6) & 63), 0x80 | (cp & 63));
    else
      bytes.push(
        0xf0 | (cp >>> 18),
        0x80 | ((cp >>> 12) & 63),
        0x80 | ((cp >>> 6) & 63),
        0x80 | (cp & 63),
      );
  }
  return new Uint8Array(bytes);
}

function asBytes(value) {
  if (typeof value === "string") return utf8(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("SHA-256 input must be a string or byte array");
}

export class SHA256 {
  constructor() {
    this.h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    this.buffer = new Uint8Array(64);
    this.words = new Uint32Array(64);
    this.bufferLength = 0;
    this.bytesHashed = 0;
  }

  _block(bytes, offset) {
    for (let i = 0; i < 16; i += 1) {
      const p = offset + i * 4;
      this.words[i] =
        (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
    }
    for (let i = 16; i < 64; i += 1) {
      const x = this.words[i - 15];
      const y = this.words[i - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      this.words[i] = (this.words[i - 16] + s0 + this.words[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = this.h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA_K[i] + this.words[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    this.h[0] = (this.h[0] + a) >>> 0;
    this.h[1] = (this.h[1] + b) >>> 0;
    this.h[2] = (this.h[2] + c) >>> 0;
    this.h[3] = (this.h[3] + d) >>> 0;
    this.h[4] = (this.h[4] + e) >>> 0;
    this.h[5] = (this.h[5] + f) >>> 0;
    this.h[6] = (this.h[6] + g) >>> 0;
    this.h[7] = (this.h[7] + h) >>> 0;
  }

  update(value) {
    const bytes = asBytes(value);
    this.bytesHashed += bytes.byteLength;
    let offset = 0;
    while (offset < bytes.length) {
      const count = Math.min(64 - this.bufferLength, bytes.length - offset);
      for (let i = 0; i < count; i += 1) this.buffer[this.bufferLength + i] = bytes[offset + i];
      this.bufferLength += count;
      offset += count;
      if (this.bufferLength === 64) {
        this._block(this.buffer, 0);
        this.bufferLength = 0;
      }
    }
    return this;
  }

  updateByte(byte) {
    this.buffer[this.bufferLength++] = byte & 255;
    this.bytesHashed += 1;
    if (this.bufferLength === 64) {
      this._block(this.buffer, 0);
      this.bufferLength = 0;
    }
    return this;
  }

  _finalBytes() {
    const copy = new SHA256();
    copy.h.set(this.h);
    copy.buffer.set(this.buffer);
    copy.words.set(this.words);
    copy.bufferLength = this.bufferLength;
    copy.bytesHashed = this.bytesHashed;
    const bitLength = copy.bytesHashed * 8;
    copy.buffer[copy.bufferLength++] = 0x80;
    if (copy.bufferLength > 56) {
      while (copy.bufferLength < 64) copy.buffer[copy.bufferLength++] = 0;
      copy._block(copy.buffer, 0);
      copy.bufferLength = 0;
    }
    while (copy.bufferLength < 56) copy.buffer[copy.bufferLength++] = 0;
    // The supported render lengths are safely below the 2^53 byte boundary.
    for (let i = 0; i < 8; i += 1)
      copy.buffer[63 - i] = Math.floor(bitLength / 2 ** (i * 8)) & 255;
    copy._block(copy.buffer, 0);
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i += 1) {
      out[i * 4] = copy.h[i] >>> 24;
      out[i * 4 + 1] = copy.h[i] >>> 16;
      out[i * 4 + 2] = copy.h[i] >>> 8;
      out[i * 4 + 3] = copy.h[i];
    }
    return out;
  }

  digestBytes() {
    return this._finalBytes();
  }

  digest() {
    return Array.from(this._finalBytes(), (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

export function sha256Hex(value) {
  const bytes = typeof value === "string" || value instanceof ArrayBuffer || ArrayBuffer.isView(value);
  return new SHA256().update(bytes ? value : canonical(value)).digest();
}

function stable(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) return "null";
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => stable(item) ?? "null").join(",")}]`;
  return `{${Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
    .join(",")}}`;
}

export function canonical(value) {
  return stable(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value)) result[key] = clone(value[key]);
    return result;
  }
  return value;
}

const FINGERPRINT_EXCLUDED_METADATA = new Set([
  "configFingerprint",
  "parameterProvenance",
  "provenanceByParameter",
  "historicalStatus",
  "historicalExactness",
  "formalEligibility",
  "formalEligibilityReason",
  "formalOperationalEligibility",
  "provenanceEligibility",
  "engineeringVerification",
  "provenanceAudit",
  "activeLayers",
]);

function provenanceEntry(value, pathName) {
  const source = typeof value === "string" ? { provenanceClass: value } : (value && typeof value === "object" ? clone(value) : {});
  const provenanceClass = String(source.provenanceClass ?? source.class ?? source.status ?? "UNKNOWN_BLOCKED").toUpperCase();
  const entry = {
    ...source,
    provenanceClass,
    class: provenanceClass,
  };
  if (!PROVENANCE_CLASSES.includes(provenanceClass)) {
    entry.provenanceClass = "UNKNOWN_BLOCKED";
    entry.class = "UNKNOWN_BLOCKED";
    entry.invalidClass = provenanceClass;
  }
  if (entry.provenanceClass === "PRIMARY_SOURCE_DERIVED") {
    entry.sourceRef = entry.sourceRef ?? entry.sourceReference ?? null;
    entry.derivationRule = entry.derivationRule ?? null;
    entry.inputValues = entry.inputValues ?? null;
    entry.derivedValue = entry.derivedValue ?? null;
    entry.derivationVersion = entry.derivationVersion ?? null;
  }
  if (entry.provenanceClass === "MIP_RECONSTRUCTION_PARAMETER") {
    entry.reconstructionReason = entry.reconstructionReason ?? "The primary source does not establish this exact value.";
    entry.reconstructionVersion = entry.reconstructionVersion ?? "MIP_AUDIO_RECONSTRUCTION_V1";
  }
  entry.path = entry.path ?? pathName;
  return entry;
}

function materialParameterPaths(recipe) {
  const paths = [
    "sampleRate", "channels", "synthesisMode", "masterGain", "headroomDb", "rampSeconds",
    "execution.mode", "execution.targetFrames",
    "envelope.attackFrames", "envelope.decayFrames", "envelope.sustain", "envelope.releaseFrames",
    "lowFrequencySweep.frequencyHz", "lowFrequencySweep.depth", "lowFrequencySweep.offset", "lowFrequencySweep.leftPhase", "lowFrequencySweep.rightPhase",
    "delay.delaySamples", "delay.mix", "delay.feedback", "comb.delaySamples", "comb.mix", "comb.feedback",
    "noise.algorithm", "noise.algorithmVersion", "noise.updateSemantics", "noise.updateClock", "noise.seed", "noise.gain", "noise.alpha", "noise.filterGain", "noise.minDelaySamples", "noise.maxDelaySamples", "noise.sweepHz", "noise.leftSweepPhase", "noise.rightSweepPhase", "noise.combMix",
  ];
  for (const [groupName, group] of [["carriers", recipe.carriers], ["monauralLayers", recipe.monauralLayers], ["septon", recipe.septon]]) {
    for (const [index, componentValue] of (group || []).entries()) {
      for (const key of ["leftHz", "rightHz", "gainLeft", "gainRight", "phaseLeft", "phaseRight", "waveform", "am.rateHz", "am.depth", "am.offset", "am.phaseLeft", "am.phaseRight", "fm.rateHz", "fm.depthHz", "fm.phaseLeft", "fm.phaseRight"])
        paths.push(`${groupName}[${index}].${key}`);
    }
  }
  for (const [index] of (recipe.cues || []).entries()) {
    for (const key of ["startFrame", "durationFrames", "leftHz", "rightHz", "gainLeft", "gainRight", "phaseLeft", "phaseRight", "waveform"])
      paths.push(`cues[${index}].${key}`);
  }
  for (const [index] of (recipe.voiceReferences || []).entries()) paths.push(`voiceReferences[${index}]`);
  for (const [index] of (recipe.binauralRelationships || []).entries()) paths.push(`binauralRelationships[${index}]`);
  if (recipe.protocolCueVersion !== undefined) paths.push("protocolCueVersion");
  for (const [index] of (recipe.protocolCues || []).entries()) {
    for (const key of ["startFrame", "durationFrames", "leftHz", "rightHz", "gainLeft", "gainRight", "phaseLeft", "phaseRight", "waveform"])
      paths.push(`protocolCues[${index}].${key}`);
  }
  return paths;
}

function normalizeParameterProvenance(source, recipe) {
  const input = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const paths = materialParameterPaths(recipe);
  const result = {};
  for (const pathName of paths) {
    const wildcard = pathName.replace(/\[\d+\]/g, "[*]");
    result[pathName] = provenanceEntry(input[pathName] ?? input[wildcard] ?? input["*"] ?? null, pathName);
  }
  // Preserve additional component/group entries so an audit can see a source
  // claim even when a future engine version introduces a new material field.
  for (const [key, value] of Object.entries(input)) {
    if (!result[key] && key !== "*") result[key] = provenanceEntry(value, key);
  }
  return result;
}

export function summarizeProvenance(recipe) {
  const entries = Object.values(recipe?.parameterProvenance || recipe?.provenanceByParameter || {});
  const classes = [...new Set(entries.map((entry) => String(entry?.provenanceClass ?? entry?.class ?? "UNKNOWN_BLOCKED").toUpperCase()))];
  const unknown = entries.filter((entry) => String(entry?.provenanceClass ?? entry?.class).toUpperCase() === "UNKNOWN_BLOCKED").map((entry) => entry.path);
  const reconstruction = entries.filter((entry) => String(entry?.provenanceClass ?? entry?.class).toUpperCase() === "MIP_RECONSTRUCTION_PARAMETER").map((entry) => entry.path);
  const sourceVerified = entries.filter((entry) => String(entry?.provenanceClass ?? entry?.class).toUpperCase() === "PRIMARY_SOURCE_VERIFIED").map((entry) => entry.path);
  const provenanceEligible = unknown.length === 0;
  const formalEligible = recipe?.formalEligibility === false ? false : provenanceEligible;
  // A raw/unsaved normalized recipe has no repository activation or immutable
  // version evidence, so it is never operationally eligible by default.
  let formalOperationalEligible = false;
  // A repository DTO carries the operational gates that a raw normalized
  // recipe cannot know (immutable version, active status, and current
  // engineering verification).  When those fields are present, require all
  // of them instead of treating provenance completeness as formal eligibility.
  const repositoryProjection = recipe && ["status", "isDraft", "isActive", "incomplete"].some((key) => Object.prototype.hasOwnProperty.call(recipe, key));
  if (repositoryProjection) {
    const repositoryGate = provenanceEligible &&
      String(recipe.status || "").toUpperCase() === "ACTIVE" &&
      recipe.isDraft !== true && recipe.isActive === true && recipe.incomplete !== true;
    // The repository computes this field from immutable metadata and current
    // verification.  A renderer/owner-supplied `true` must never override the
    // activation/incomplete/provenance gate; it is only an additional
    // authoritative projection when the repository gate is satisfied.
    formalOperationalEligible = repositoryGate && (Object.prototype.hasOwnProperty.call(recipe, "formalOperationalEligibility")
      ? recipe.formalOperationalEligibility === true
      : String(recipe.engineeringVerification?.status || "").toUpperCase() === "PASS");
  }
  return {
    classes,
    mixed: classes.length > 1,
    unknownBlocked: unknown,
    reconstruction,
    sourceVerified,
    provenanceEligible,
    // This field is deliberately conservative for unsaved previews.  The
    // repository adds active/version/verification gates before a recipe is
    // considered formally usable; a preview may never imply that state.
    formalEligible,
    formalOperationalEligible,
  };
}

export function activeLayers(recipe) {
  const value = recipe || {};
  const has = (item) => Array.isArray(item) ? item.length > 0 : Boolean(item);
  return {
    primaryCarrier: Array.isArray(value.carriers) && value.carriers.length > 0,
    additionalCarriers: Array.isArray(value.carriers) && value.carriers.length > 1,
    monauralLayers: has(value.monauralLayers),
    septon: has(value.septon),
    whitePinkRedNoise: Boolean(value.noise && ["WHITE_NOISE", "PINK_NOISE", "RED_NOISE"].includes(value.noise.algorithm)),
    phasedPink: value.noise?.algorithm === "PHASED_PINK_PATENT_5356368",
    am: (value.carriers || []).some((item) => item.am) || (value.monauralLayers || []).some((item) => item.am) || (value.septon || []).some((item) => item.am),
    fm: (value.carriers || []).some((item) => item.fm) || (value.monauralLayers || []).some((item) => item.fm) || (value.septon || []).some((item) => item.fm),
    delay: Boolean(value.delay),
    comb: Boolean(value.comb),
    lowFrequencySweep: Boolean(value.lowFrequencySweep),
    envelope: Boolean(value.envelope && (value.envelope.attackFrames || value.envelope.decayFrames || value.envelope.releaseFrames || value.envelope.sustain !== 1)),
    cues: Array.isArray(value.cues) && value.cues.length > 0,
    protocolCues: Array.isArray(value.protocolCues) && value.protocolCues.length > 0,
    voiceReferences: Array.isArray(value.voiceReferences) && value.voiceReferences.length > 0,
  };
}

export function validateRecipeProvenance(recipe, options = {}) {
  const value = recipe && recipe.parameterProvenance ? recipe : normalizeRecipe(recipe, { developmentFixture: true });
  const errors = [];
  const entries = Object.values(value.parameterProvenance || {});
  for (const entry of entries) {
    const cls = String(entry?.provenanceClass ?? entry?.class ?? "UNKNOWN_BLOCKED").toUpperCase();
    if (!PROVENANCE_CLASSES.includes(cls)) errors.push(`${entry?.path || "parameter"} has unsupported provenance class ${cls}`);
    if (cls === "PRIMARY_SOURCE_DERIVED" && (!entry.sourceRef || !entry.derivationRule || entry.inputValues === null || entry.derivedValue === null || !entry.derivationVersion))
      errors.push(`${entry.path || "parameter"} PRIMARY_SOURCE_DERIVED requires sourceRef, derivationRule, inputValues, derivedValue, and derivationVersion`);
    if (cls === "MIP_RECONSTRUCTION_PARAMETER" && (!entry.reconstructionReason || !entry.reconstructionVersion))
      errors.push(`${entry.path || "parameter"} MIP_RECONSTRUCTION_PARAMETER requires reconstructionReason and reconstructionVersion`);
  }
  const summary = summarizeProvenance(value);
  const top = String(value.provenance || "").toUpperCase();
  if (top.includes("PRIMARY_SOURCE_VERIFIED") && entries.some((entry) => !["PRIMARY_SOURCE_VERIFIED", "PRIMARY_SOURCE_DERIVED"].includes(String(entry.provenanceClass).toUpperCase())))
    errors.push("recipe-level PRIMARY_SOURCE_VERIFIED claim overstates mixed parameter provenance");
  const historical = top.includes("HISTORICAL") || top.includes("CENTER_LANE") || top.includes("PATENT_GROUNDED");
  if (historical && summary.unknownBlocked.length) errors.push(`historical recipe has UNKNOWN_BLOCKED parameters: ${summary.unknownBlocked.join(", ")}`);
  if (options.formal && !summary.formalEligible) errors.push(`formal use is blocked by UNKNOWN_BLOCKED parameters: ${summary.unknownBlocked.join(", ")}`);
  return { valid: errors.length === 0, errors, summary };
}

function assertFiniteMaterial(value, name, seen = new Set()) {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error(`${name} contains a non-finite number`);
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) throw new Error(`${name} must not contain circular references`);
  seen.add(value);
  for (const key of Object.keys(value)) assertFiniteMaterial(value[key], `${name}.${key}`, seen);
  seen.delete(value);
}

function number(value, name, { integer = false, min = -Infinity, max = Infinity } = {}) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max)
    throw new Error(`${name} must be a finite ${integer ? "integer" : "number"} in [${min}, ${max}]`);
  return n;
}

function positive(value, name) {
  return number(value, name, { min: Number.MIN_VALUE });
}

function array(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function firstDefined(primary, secondary) {
  return primary === undefined ? secondary : primary;
}

function sameNumericAlias(left, right) {
  const a = Number(left);
  const b = Number(right);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

function sameTargetAlias(left, right) {
  if (left === null || right === null) return left === right;
  return sameNumericAlias(left, right);
}

function assertAliasAgreement(primary, alias, label, equal = sameNumericAlias) {
  if (primary !== undefined && alias !== undefined && !equal(primary, alias))
    throw new Error(`${label} aliases conflict`);
}

function pairValue(value, name, fallback = 0) {
  if (value === undefined) return { left: fallback, right: fallback };
  if (value && typeof value === "object" && !Array.isArray(value))
    return { left: number(value.left ?? value.l, `${name}.left`), right: number(value.right ?? value.r, `${name}.right`) };
  const n = number(value, name);
  return { left: n, right: n };
}

function gainPair(value, name) {
  if (value === undefined || value === null) throw new Error(`${name} is required`);
  const pair = pairValue(value, name);
  if (pair.left < 0 || pair.left > 1 || pair.right < 0 || pair.right > 1)
    throw new Error(`${name} values must be between 0 and 1`);
  return pair;
}

function normalizeModulation(value, name, type, aliases = {}, developmentFixture = false) {
  if (value === undefined || value === null || value === false) return null;
  const source = typeof value === "object" ? value : { depth: value };
  const rate = source.rateHz ?? source.frequencyHz ?? aliases.rateHz;
  const depth = type === "fm"
    ? source.depthHz ?? source.deviationHz ?? aliases.depthHz
    : source.depth ?? source.amount ?? aliases.depth;
  if (rate === undefined || depth === undefined)
    throw new Error(`${name} requires rateHz and ${type === "fm" ? "depthHz" : "depth"}`);
  if (!developmentFixture && source.phase === undefined && source.initialPhase === undefined && source.phaseLeft === undefined && source.phaseRight === undefined)
    throw new Error(`${name}.phase is required for a formal recipe`);
  if (!developmentFixture && type === "am" && source.offset === undefined)
    throw new Error(`${name}.offset is required for a formal recipe`);
  const modulationPhase = pairValue(source.phase ?? source.initialPhase ?? (source.phaseLeft !== undefined || source.phaseRight !== undefined ? { left: source.phaseLeft, right: source.phaseRight } : undefined), `${name}.phase`, 0);
  const result = {
    rateHz: positive(rate, `${name}.rateHz`),
    phaseLeft: modulationPhase.left,
    phaseRight: modulationPhase.right,
  };
  if (type === "fm") result.depthHz = number(depth, `${name}.depthHz`, { min: 0 });
  else {
    result.depth = number(depth, `${name}.depth`, { min: 0, max: 1 });
    result.offset = number(source.offset ?? 1, `${name}.offset`, { min: 0, max: 2 });
  }
  return result;
}

function component(source, name, { topGain, monaural = false, developmentFixture = false, modulation = true } = {}) {
  if (!source || typeof source !== "object" || Array.isArray(source))
    throw new Error(`${name} must be an object`);
  assertAliasAgreement(source.leftHz, source.leftFrequencyHz, `${name}.leftHz`);
  assertAliasAgreement(source.rightHz, source.rightFrequencyHz, `${name}.rightHz`);
  assertAliasAgreement(source.frequencyHz, source.hz, `${name}.frequencyHz`);
  const common = source.frequencyHz ?? source.hz;
  if (common !== undefined) {
    if (source.leftHz !== undefined || source.leftFrequencyHz !== undefined)
      assertAliasAgreement(source.leftHz ?? source.leftFrequencyHz, common, `${name}.leftHz/frequencyHz`);
    if (source.rightHz !== undefined || source.rightFrequencyHz !== undefined)
      assertAliasAgreement(source.rightHz ?? source.rightFrequencyHz, common, `${name}.rightHz/frequencyHz`);
  }
  let leftHz = source.leftHz ?? source.leftFrequencyHz ?? common;
  let rightHz = source.rightHz ?? source.rightFrequencyHz ?? common;
  if (monaural && leftHz === undefined && rightHz === undefined) {
    leftHz = source.frequencyHz ?? source.hz;
    rightHz = leftHz;
  }
  if (leftHz === undefined || rightHz === undefined)
    throw new Error(`${name} requires explicit leftHz and rightHz`);
  if (!developmentFixture && source.gain === undefined && topGain === undefined && source.gainLeft === undefined && source.gainRight === undefined)
    throw new Error(`${name}.gain is required for a formal recipe`);
  if (!developmentFixture && source.phase === undefined && source.initialPhase === undefined && source.phaseLeft === undefined && source.phaseRight === undefined)
    throw new Error(`${name}.phase is required for a formal recipe`);
  if (!developmentFixture && source.waveform === undefined)
    throw new Error(`${name}.waveform is required for a formal recipe`);
  if (!developmentFixture && modulation) {
    if (source.am === undefined && source.amplitudeModulation === undefined)
      throw new Error(`${name}.am must be explicitly configured (null is allowed)`);
    if (source.fm === undefined && source.frequencyModulation === undefined)
      throw new Error(`${name}.fm must be explicitly configured (null is allowed)`);
  }
  const sideGainDefined = source.gainLeft !== undefined || source.gainRight !== undefined;
  if (source.gain !== undefined && sideGainDefined) {
    const declaredGain = gainPair(source.gain, `${name}.gain`);
    if (source.gainLeft !== undefined && !sameNumericAlias(source.gainLeft, declaredGain.left))
      throw new Error(`${name}.gain conflicts with gainLeft`);
    if (source.gainRight !== undefined && !sameNumericAlias(source.gainRight, declaredGain.right))
      throw new Error(`${name}.gain conflicts with gainRight`);
  }
  const canonicalGainInput = source.gain ?? (sideGainDefined ? { left: source.gainLeft, right: source.gainRight } : undefined);
  const gains = gainPair(canonicalGainInput ?? topGain, `${name}.gain`);
  if (topGain !== undefined && canonicalGainInput !== undefined) {
    const top = gainPair(topGain, `${name}.gain alias`);
    const topIsPair = topGain && typeof topGain === "object" && !Array.isArray(topGain);
    // The normalized top-level scalar is the first (left) carrier projection.
    // Object aliases must agree with both canonical channel gains.
    if (!sameNumericAlias(top.left, gains.left) || (topIsPair && !sameNumericAlias(top.right, gains.right)))
      throw new Error(`${name}.gain conflicts with top-level gain`);
  }
  const phaseInput = source.phase ?? source.initialPhase ?? (source.phaseLeft !== undefined || source.phaseRight !== undefined ? { left: source.phaseLeft, right: source.phaseRight } : undefined);
  const phases = pairValue(phaseInput, `${name}.phase`, 0);
  const waveform = String(source.waveform ?? "sine").toLowerCase();
  if (!["sine", "square", "saw", "triangle"].includes(waveform))
    throw new Error(`${name}.waveform is unsupported`);
  const result = {
    id: source.id ?? `${name}`,
    leftHz: positive(leftHz, `${name}.leftHz`),
    rightHz: positive(rightHz, `${name}.rightHz`),
    gainLeft: gains.left,
    gainRight: gains.right,
    phaseLeft: phases.left,
    phaseRight: phases.right,
    waveform,
    am: normalizeModulation(source.am ?? source.amplitudeModulation, `${name}.am`, "am", {
      rateHz: source.amRateHz,
      depth: source.amDepth,
    }, developmentFixture),
    fm: normalizeModulation(source.fm ?? source.frequencyModulation, `${name}.fm`, "fm", {
      rateHz: source.fmRateHz,
      depthHz: source.fmDepthHz,
    }, developmentFixture),
  };
  if (result.fm && (result.leftHz - result.fm.depthHz <= 0 || result.rightHz - result.fm.depthHz <= 0))
    throw new Error(`${name}.fm.depthHz must not drive a carrier to zero or below`);
  return result;
}

function normalizeCues(rawCues, sampleRate, developmentFixture, fieldName = "cues") {
  if (rawCues === undefined || rawCues === null) return [];
  const cues = array(rawCues, fieldName);
  return cues.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`${fieldName}[${index}] must be an object`);
    const start = raw.frame ?? raw.startFrame ?? raw.atFrame ?? (raw.timeSeconds !== undefined ? number(raw.timeSeconds, `${fieldName}[${index}].timeSeconds`, { min: 0 }) * sampleRate : undefined);
    if (start === undefined) throw new Error(`${fieldName}[${index}] requires frame or timeSeconds`);
    const duration = raw.durationFrames ?? raw.lengthFrames ?? (raw.durationSeconds !== undefined ? number(raw.durationSeconds, `${fieldName}[${index}].durationSeconds`, { min: Number.MIN_VALUE }) * sampleRate : undefined);
    if (duration === undefined) throw new Error(`${fieldName}[${index}] requires durationFrames or durationSeconds`);
    const c = component(raw, `${fieldName}[${index}]`, { topGain: raw.gain, developmentFixture, modulation: false });
    return {
      id: raw.id ?? `${fieldName === "protocolCues" ? "protocol-cue" : "cue"}-${index}`,
      source: fieldName === "protocolCues" ? "PROTOCOL" : "RECIPE",
      startFrame: number(start, `${fieldName}[${index}].startFrame`, { integer: true, min: 0 }),
      durationFrames: number(duration, `${fieldName}[${index}].durationFrames`, { integer: true, min: 1 }),
      leftHz: c.leftHz,
      rightHz: c.rightHz,
      gainLeft: c.gainLeft,
      gainRight: c.gainRight,
      phaseLeft: c.phaseLeft,
      phaseRight: c.phaseRight,
      waveform: c.waveform,
    };
  });
}

function normalizeNoise(rawNoise, mode, sampleRate, developmentFixture) {
  if (rawNoise === undefined || rawNoise === null) {
    if (mode === "PHASED_PINK_PATENT_5356368")
      throw new Error("PHASED_PINK_PATENT_5356368 requires an explicit noise object");
    return null;
  }
  if (typeof rawNoise !== "object" || Array.isArray(rawNoise)) throw new Error("noise must be an object");
  if (!developmentFixture) {
    for (const field of ["algorithm", "algorithmVersion", "seed", "gain"])
      if (rawNoise[field] === undefined) throw new Error(`noise.${field} is required for a formal recipe`);
    if (rawNoise.alpha === undefined && rawNoise.filterAlpha === undefined)
      throw new Error("noise.alpha is required for a formal recipe");
  }
  const aliases = {
    WHITE: "WHITE_NOISE",
    PINK: "PINK_NOISE",
    RED: "RED_NOISE",
    PHASED_PINK: "PHASED_PINK_PATENT_5356368",
  };
  const requested = String(rawNoise.algorithm ?? rawNoise.type ?? (mode === "PHASED_PINK_PATENT_5356368" ? mode : ""))
    .toUpperCase()
    .replace(/[- ]/g, "_");
  const algorithm = aliases[requested] ?? requested;
  if (!["WHITE_NOISE", "PINK_NOISE", "RED_NOISE", "PHASED_PINK_PATENT_5356368"].includes(algorithm))
    throw new Error("noise.algorithm must be WHITE_NOISE, PINK_NOISE, RED_NOISE, or PHASED_PINK_PATENT_5356368");
  if (rawNoise.seed === undefined) throw new Error("noise.seed is required for deterministic noise");
  const seed = number(rawNoise.seed, "noise.seed", { integer: true, min: 1, max: 0xffffffff });
  if ((seed & 0xffff) === 0) throw new Error("noise.seed must produce a non-zero 16-bit shift-register state");
  const gain = number(rawNoise.gain, "noise.gain", { min: 0, max: 1 });
  const alphaDefault = algorithm === "RED_NOISE" ? 0.985 : 0.65;
  const alpha = number(rawNoise.alpha ?? rawNoise.filterAlpha ?? alphaDefault, "noise.alpha", { min: 0, max: 0.999999999 });
  const result = {
    algorithm,
    algorithmVersion: number(rawNoise.algorithmVersion ?? 1, "noise.algorithmVersion", { integer: true, min: 1 }),
    updateSemantics: String(rawNoise.updateSemantics ?? LFSR_UPDATE_SEMANTICS),
    updateClock: String(rawNoise.updateClock ?? "rendered PCM frame (MIP reconstruction; historical clock unresolved)"),
    seed,
    gain,
    alpha,
    filterGain: 1 - alpha,
  };
  if (algorithm === "PHASED_PINK_PATENT_5356368") {
    if (!developmentFixture) {
      const required = ["minDelaySamples", "maxDelaySamples", "sweepHz", "leftSweepPhase", "rightSweepPhase", "combMix"];
      for (const field of required) if (rawNoise[field] === undefined) throw new Error(`noise.${field} is required for a formal phased-pink recipe`);
    }
    const minDelay = number(rawNoise.minDelaySamples ?? rawNoise.delayMinSamples ?? Math.max(1, Math.round(sampleRate * 0.001)), "noise.minDelaySamples", { integer: true, min: 1 });
    const maxDelay = number(rawNoise.maxDelaySamples ?? rawNoise.delayMaxSamples ?? Math.max(minDelay, Math.round(sampleRate * 0.015)), "noise.maxDelaySamples", { integer: true, min: minDelay });
    const sweepHz = positive(rawNoise.sweepHz ?? 0.125, "noise.sweepHz");
    const leftSweepPhase = number(rawNoise.leftSweepPhase ?? rawNoise.sweepPhase ?? 0, "noise.leftSweepPhase");
    const rightSweepPhase = number(rawNoise.rightSweepPhase ?? (rawNoise.sweepPhase !== undefined ? rawNoise.sweepPhase : Math.PI / 2), "noise.rightSweepPhase");
    const combMix = number(rawNoise.combMix ?? 0.5, "noise.combMix", { min: 0, max: 1 });
    result.minDelaySamples = minDelay;
    result.maxDelaySamples = maxDelay;
    result.sweepHz = sweepHz;
    result.leftSweepPhase = leftSweepPhase;
    result.rightSweepPhase = rightSweepPhase;
    result.combMix = combMix;
    result.reconstructionParameters = {
      filterAlphaSource: rawNoise.alpha === undefined && rawNoise.filterAlpha === undefined ? "MIP_RECONSTRUCTION_DEFAULT" : "RECIPE",
      delayRangeSource: rawNoise.minDelaySamples === undefined || rawNoise.maxDelaySamples === undefined ? "MIP_RECONSTRUCTION_DEFAULT" : "RECIPE",
      sweepSource: rawNoise.sweepHz === undefined ? "MIP_RECONSTRUCTION_DEFAULT" : "RECIPE",
      stereoSweepPhaseSource: rawNoise.leftSweepPhase === undefined || rawNoise.rightSweepPhase === undefined ? "MIP_RECONSTRUCTION_DEFAULT" : "RECIPE",
      sweepHz,
      independentStereoSweepPhases: true,
      filter: "one-pole-pink",
      comb: "current-plus-delayed-average",
    };
  }
  return result;
}

function normalizeEffect(raw, name, sampleRate, developmentFixture) {
  if (raw === undefined || raw === null || raw === false) return null;
  if (typeof raw !== "object") throw new Error(`${name} must be an object`);
  const samples = raw.delaySamples ?? (raw.timeSeconds !== undefined ? number(raw.timeSeconds, `${name}.timeSeconds`, { min: Number.MIN_VALUE }) * sampleRate : undefined);
  if (samples === undefined) throw new Error(`${name} requires delaySamples or timeSeconds`);
  if (!developmentFixture && (raw.mix === undefined || raw.feedback === undefined))
    throw new Error(`${name}.mix and ${name}.feedback are required for a formal recipe`);
  return {
    delaySamples: number(samples, `${name}.delaySamples`, { min: 1 }),
    mix: number(raw.mix ?? 0.5, `${name}.mix`, { min: 0, max: 1 }),
    feedback: number(raw.feedback ?? 0, `${name}.feedback`, { min: 0, max: 0.99 }),
  };
}

function normalizeEnvelope(raw, sampleRate, finite, rampSeconds, developmentFixture) {
  const source = raw && typeof raw === "object" ? raw : {};
  if (!developmentFixture) {
    for (const field of ["attackSeconds", "decaySeconds", "sustain", "releaseSeconds"])
      if (source[field] === undefined && source[field.replace("Seconds", "Frames")] === undefined)
        throw new Error(`envelope.${field} is required for a formal recipe`);
  }
  const attackSeconds = number(source.attackSeconds ?? source.attack ?? (source.attackFrames !== undefined ? Number(source.attackFrames) / sampleRate : 0), "envelope.attackSeconds", { min: 0 });
  const requestedRelease = source.releaseSeconds ?? source.release ?? (source.releaseFrames !== undefined ? Number(source.releaseFrames) / sampleRate : undefined);
  const releaseSeconds = number(finite && requestedRelease === undefined ? rampSeconds : (requestedRelease ?? 0), "envelope.releaseSeconds", { min: 0 });
  const sustain = number(source.sustain ?? 1, "envelope.sustain", { min: 0, max: 1 });
  const decaySeconds = number(source.decaySeconds ?? source.decay ?? (source.decayFrames !== undefined ? Number(source.decayFrames) / sampleRate : 0), "envelope.decaySeconds", { min: 0 });
  return {
    attackSeconds,
    attackFrames: Math.round(attackSeconds * sampleRate),
    decaySeconds,
    decayFrames: Math.round(decaySeconds * sampleRate),
    sustain,
    releaseSeconds,
    releaseFrames: Math.round(releaseSeconds * sampleRate),
  };
}

function normalizeVoiceReferences(raw) {
  if (raw === undefined || raw === null) return [];
  const refs = array(raw, "voiceReferences");
  return refs.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error(`voiceReferences[${index}] must be a reference object`);
    const ref = item.assetId ?? item.reference ?? item.uri ?? item.path;
    if (typeof ref !== "string" || !ref.trim())
      throw new Error(`voiceReferences[${index}] requires an existing assetId, reference, uri, or path`);
    // No asset is resolved here.  The reference is evidence-bearing input.
    return clone(item);
  });
}

function normalizeSweep(raw, name, developmentFixture) {
  if (raw === undefined || raw === null || raw === false) return null;
  if (!raw || typeof raw !== "object") throw new Error(`${name} must be an object`);
  if (!developmentFixture) {
    for (const field of ["frequencyHz", "depth", "offset", "leftPhase", "rightPhase"])
      if (raw[field] === undefined) throw new Error(`${name}.${field} is required for a formal recipe`);
  }
  return {
    frequencyHz: positive(raw.frequencyHz ?? raw.sweepHz, `${name}.frequencyHz`),
    depth: number(raw.depth ?? raw.amount ?? raw.amplitude ?? 0, `${name}.depth`, { min: 0, max: 1 }),
    offset: number(raw.offset ?? 1, `${name}.offset`, { min: 0, max: 2 }),
    leftPhase: number(raw.leftPhase ?? raw.phase ?? 0, `${name}.leftPhase`),
    rightPhase: number(raw.rightPhase ?? raw.phase ?? 0, `${name}.rightPhase`),
  };
}

function componentArray(raw, name, options = {}) {
  if (raw === undefined || raw === null) return [];
  if (raw && !Array.isArray(raw) && typeof raw === "object" && Array.isArray(raw.frequencies)) {
    const sharedGain = raw.gain;
    const sharedPhase = raw.phase;
    return raw.frequencies.map((frequency, index) => ({
      frequencyHz: frequency,
      ...(sharedGain === undefined ? {} : { gain: sharedGain }),
      ...(sharedPhase === undefined ? {} : { phase: sharedPhase }),
      ...(raw.waveform === undefined ? {} : { waveform: raw.waveform }),
      id: `${name}-${index}`,
    }));
  }
  const values = array(raw, name);
  return values.map((value, index) => {
    if (typeof value === "number") {
      if (options.gain === undefined) throw new Error(`${name}[${index}] numeric frequency requires an explicit gain`);
      return { frequencyHz: value, gain: options.gain, id: `${name}-${index}` };
    }
    return value;
  });
}

function normalizeRelation(raw, index) {
  if (!raw || typeof raw !== "object") throw new Error(`binauralRelationships[${index}] must be an object`);
  if (raw.leftHz !== undefined || raw.rightHz !== undefined)
    return { ...clone(raw), leftHz: positive(raw.leftHz, `binauralRelationships[${index}].leftHz`), rightHz: positive(raw.rightHz, `binauralRelationships[${index}].rightHz`) };
  const base = raw.baseHz ?? raw.centerHz;
  const beat = raw.beatHz ?? raw.differenceHz;
  if (base === undefined || beat === undefined) throw new Error(`binauralRelationships[${index}] requires left/right or baseHz/beatHz`);
  const b = positive(base, `binauralRelationships[${index}].baseHz`);
  const d = number(beat, `binauralRelationships[${index}].beatHz`, { min: 0 });
  const side = String(raw.rightSide ?? "plus").toLowerCase() === "minus" ? -1 : 1;
  const leftHz = b - d / 2;
  const rightHz = b + side * d / 2;
  if (leftHz <= 0 || rightHz <= 0) throw new Error(`binauralRelationships[${index}] produces a non-positive channel`);
  return { ...clone(raw), leftHz, rightHz, baseHz: b, beatHz: d };
}

export function normalizeRecipe(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A recipe object is required");
  const raw = input;
  const developmentFixture = raw.developmentFixture === true || options.developmentFixture === true;
  const recipeId = raw.recipeId ?? raw.id;
  if (typeof recipeId !== "string" || !recipeId.trim()) throw new Error("recipeId (or id) is required");
  const versionInput = raw.recipeVersion ?? raw.version;
  if (versionInput === undefined && !developmentFixture) throw new Error("recipeVersion is required for a formal recipe");
  const version = number(versionInput ?? 1, "recipeVersion", { integer: true, min: 1 });
  const sampleRateInput = raw.sampleRate;
  if (sampleRateInput === undefined && !developmentFixture) throw new Error("sampleRate is required for a formal recipe");
  const sampleRate = number(sampleRateInput ?? 44100, "sampleRate", { integer: true, min: 8000, max: 192000 });
  if (!developmentFixture) {
    for (const field of ["name", "provenance", "architecture"])
      if (typeof raw[field] !== "string" || !raw[field].trim())
        throw new Error(`${field} is required for a formal recipe`);
    if (raw.synthesisMode === undefined && raw.mode === undefined)
      throw new Error("synthesisMode is required for a formal recipe");
    if (raw.channels === undefined) throw new Error("channels is required for a formal recipe");
    if (raw.channels !== 2) throw new Error("channels must be 2 (stereo)");
    const materialLayers = [
      ["monauralLayers", firstDefined(raw.monauralLayers, raw.monaural)],
      ["septon", firstDefined(raw.septon, firstDefined(raw.septonLayers, raw.septonComponents))],
      ["binauralRelationships", raw.binauralRelationships],
      ["envelope", raw.envelope],
      ["noise", raw.noise],
      ["delay", firstDefined(raw.delay, raw.effects?.delay)],
      ["comb", firstDefined(raw.comb, raw.effects?.comb)],
      ["lowFrequencySweep", firstDefined(raw.lowFrequencySweep, raw.sweep)],
      ["cues", raw.cues],
      ["voiceReferences", firstDefined(raw.voiceReferences, raw.voices)],
    ];
    for (const [field, value] of materialLayers)
      if (value === undefined) throw new Error(`${field} must be explicitly configured (null or empty is allowed)`);
  }
  const executionSource = raw.execution && typeof raw.execution === "object" ? raw.execution : {};
  // Development-only fixtures historically use `mode` as an explicit test
  // override over a copied formal preset. Formal recipes must provide one
  // authoritative synthesis mode and reject contradictory aliases.
  if (!developmentFixture)
    assertAliasAgreement(raw.mode, raw.synthesisMode, "mode/synthesisMode", (left, right) => String(left).trim().toUpperCase() === String(right).trim().toUpperCase());
  const finiteProjectionOverride = String(raw.durationMode ?? "").trim().toLowerCase() === "finite" &&
    String(executionSource.mode ?? "").trim().toLowerCase() === "live" &&
    raw.targetFrames !== undefined && raw.targetFrames !== null &&
    (executionSource.targetFrames === undefined || executionSource.targetFrames === null);
  // A finite render request commonly starts from a normalized live recipe,
  // whose `execution` projection is live/null. Treat the explicit finite
  // duration+target pair as one atomic override; all other alias conflicts
  // remain hard errors.
  if (!finiteProjectionOverride)
    assertAliasAgreement(raw.durationMode, executionSource.mode, "durationMode/execution.mode", (left, right) => String(left).trim().toLowerCase() === String(right).trim().toLowerCase());
  if (!finiteProjectionOverride)
    assertAliasAgreement(raw.targetFrames, executionSource.targetFrames, "targetFrames/execution.targetFrames", sameTargetAlias);
  const executionModeInput = raw.durationMode ?? executionSource.mode;
  if (executionModeInput === undefined && !developmentFixture) throw new Error("durationMode (or execution.mode) is required for a formal recipe");
  const durationMode = String(executionModeInput ?? (options.targetFrames !== undefined || raw.targetFrames !== undefined || raw.durationSeconds !== undefined || raw.durationSec !== undefined ? "finite" : "live")).toLowerCase();
  if (!["finite", "live"].includes(durationMode)) throw new Error("execution mode must be finite or live");
  const targetInput = options.targetFrames ?? raw.targetFrames ?? executionSource.targetFrames;
  let targetFrames = null;
  if (durationMode === "finite") {
    const durationInput = raw.durationSeconds ?? raw.durationSec;
    const derivedTarget = targetInput ?? (durationInput === undefined ? undefined : number(durationInput, "durationSeconds", { min: 0 }) * sampleRate);
    if (derivedTarget === undefined || derivedTarget === null) throw new Error("finite execution requires targetFrames");
    targetFrames = number(derivedTarget, "targetFrames", { integer: true, min: 1, max: Number.MAX_SAFE_INTEGER });
  } else if (targetInput !== undefined && targetInput !== null)
    throw new Error("live execution cannot specify targetFrames");

  if (raw.rampSeconds === undefined && raw.declickSeconds === undefined && !developmentFixture)
    throw new Error("rampSeconds is required for a formal recipe");
  const rampSeconds = number(raw.rampSeconds ?? raw.declickSeconds ?? 0.01, "rampSeconds", { min: Number.MIN_VALUE, max: 10 });
  const synthesisMode = String(raw.mode ?? raw.synthesisMode ?? "STANDARD").toUpperCase();
  if (!["STANDARD", "PHASED_PINK_PATENT_5356368"].includes(synthesisMode))
    throw new Error(`Unsupported synthesisMode: ${synthesisMode}`);
  const relationsRaw = raw.binauralRelationships ?? [];
  const relations = array(relationsRaw, "binauralRelationships").map(normalizeRelation);
  assertAliasAgreement(raw.leftHz, raw.leftFrequencyHz, "top-level leftHz/leftFrequencyHz");
  assertAliasAgreement(raw.rightHz, raw.rightFrequencyHz, "top-level rightHz/rightFrequencyHz");
  assertAliasAgreement(raw.frequencyHz, raw.hz, "top-level frequencyHz/hz");
  const topCommonHz = raw.frequencyHz ?? raw.hz;
  if (topCommonHz !== undefined) {
    if (raw.leftHz !== undefined || raw.leftFrequencyHz !== undefined)
      assertAliasAgreement(raw.leftHz ?? raw.leftFrequencyHz, topCommonHz, "top-level leftHz/frequencyHz");
    if (raw.rightHz !== undefined || raw.rightFrequencyHz !== undefined)
      assertAliasAgreement(raw.rightHz ?? raw.rightFrequencyHz, topCommonHz, "top-level rightHz/frequencyHz");
  }
  const topLeftHz = raw.leftHz ?? raw.leftFrequencyHz;
  const topRightHz = raw.rightHz ?? raw.rightFrequencyHz;
  let carrierRaw = raw.carriers;
  if (carrierRaw === undefined || carrierRaw === null) {
    if (topLeftHz !== undefined || topRightHz !== undefined || topCommonHz !== undefined)
      carrierRaw = [{ leftHz: topLeftHz, rightHz: topRightHz, frequencyHz: topCommonHz, gain: raw.gain, phase: raw.phase, waveform: raw.waveform }];
    else if (raw.centerHz !== undefined || raw.beatHz !== undefined) {
      if (raw.centerHz === undefined || raw.beatHz === undefined)
        throw new Error("centerHz and beatHz must be supplied together when carriers are omitted");
      const center = positive(raw.centerHz, "centerHz");
      const beat = number(raw.beatHz, "beatHz", { min: 0 });
      carrierRaw = [{ leftHz: center - beat / 2, rightHz: center + beat / 2, gain: raw.gain, phase: raw.phase, waveform: raw.waveform }];
    }
    else if (relations.length) carrierRaw = relations;
    else if (developmentFixture)
      carrierRaw = [{ leftHz: 440, rightHz: 440, gain: 0.1, phase: 0 }];
    else throw new Error("at least one carrier with explicit leftHz/rightHz is required");
  }
  const carriers = array(carrierRaw, "carriers");
  if (!carriers.length) throw new Error("carriers must not be empty");
  const globalModulation = raw.modulation && typeof raw.modulation === "object" ? raw.modulation : {};
  const globalAm = raw.am ?? raw.amplitudeModulation ?? globalModulation.am;
  const globalFm = raw.fm ?? raw.frequencyModulation ?? globalModulation.fm;
  const applyGlobalModulation = (c) => ({
    ...c,
    am: firstDefined(c.am, firstDefined(c.amplitudeModulation, globalAm)),
    fm: firstDefined(c.fm, firstDefined(c.frequencyModulation, globalFm)),
  });
  const normalizedCarriers = carriers.map((c, index) => component(applyGlobalModulation(c), `carriers[${index}]`, { topGain: carriers.length === 1 ? raw.gain : undefined, developmentFixture }));
  if (raw.leftHz !== undefined && !sameNumericAlias(raw.leftHz, normalizedCarriers[0].leftHz))
    throw new Error("top-level leftHz conflicts with carriers[0].leftHz");
  if (raw.rightHz !== undefined && !sameNumericAlias(raw.rightHz, normalizedCarriers[0].rightHz))
    throw new Error("top-level rightHz conflicts with carriers[0].rightHz");
  if (normalizedCarriers.length) {
    const primaryCarrier = normalizedCarriers[0];
    const compareTop = (value, expected, label) => {
      if (value !== undefined && !sameNumericAlias(value, expected))
        throw new Error(`top-level ${label} conflicts with carriers[0].${label}`);
    };
    compareTop(raw.leftFrequencyHz, primaryCarrier.leftHz, "leftFrequencyHz");
    compareTop(raw.rightFrequencyHz, primaryCarrier.rightHz, "rightFrequencyHz");
    compareTop(raw.centerHz, (primaryCarrier.leftHz + primaryCarrier.rightHz) / 2, "centerHz");
    compareTop(raw.beatHz, Math.abs(primaryCarrier.rightHz - primaryCarrier.leftHz), "beatHz");
    if (topCommonHz !== undefined && (!sameNumericAlias(topCommonHz, primaryCarrier.leftHz) || !sameNumericAlias(topCommonHz, primaryCarrier.rightHz)))
      throw new Error("top-level frequencyHz conflicts with carriers[0]");
    if (raw.gain !== undefined) {
      const topGain = gainPair(raw.gain, "top-level gain");
      const topIsPair = raw.gain && typeof raw.gain === "object" && !Array.isArray(raw.gain);
      if (!sameNumericAlias(topGain.left, primaryCarrier.gainLeft) || (topIsPair && !sameNumericAlias(topGain.right, primaryCarrier.gainRight)))
        throw new Error("top-level gain conflicts with carriers[0].gain");
    }
  }
  const monauralRaw = raw.monauralLayers ?? raw.monaural ?? [];
  const monauralLayers = componentArray(monauralRaw, "monauralLayers", { gain: raw.monauralGain }).map((c, index) => component(applyGlobalModulation(c), `monauralLayers[${index}]`, { monaural: true, developmentFixture }));
  const septonRaw = raw.septon ?? raw.septonLayers ?? raw.septonComponents ?? [];
  const septon = componentArray(septonRaw, "septon", { gain: raw.septonGain }).map((c, index) => component(applyGlobalModulation(c), `septon[${index}]`, { developmentFixture }));
  const noise = normalizeNoise(raw.noise, synthesisMode, sampleRate, developmentFixture);
  const envelopeInput = {
    ...(raw.envelope && typeof raw.envelope === "object" ? raw.envelope : {}),
    ...(raw.fadeInSeconds !== undefined ? { attackSeconds: raw.fadeInSeconds } : {}),
    ...(raw.fadeOutSeconds !== undefined ? { releaseSeconds: raw.fadeOutSeconds } : {}),
  };
  if (!developmentFixture) {
    if (raw.masterGain === undefined) throw new Error("masterGain is required for a formal recipe");
    if (raw.headroomDb === undefined) throw new Error("headroomDb is required for a formal recipe");
  }
  const masterGain = number(raw.masterGain ?? 1, "masterGain", { min: 0, max: 1 });
  const headroomDb = number(raw.headroomDb ?? -3, "headroomDb", { min: -120, max: 0 });
  const normalized = {
    schemaVersion: "MIP_AUDIO_RECIPE_V1",
    recipeId,
    id: recipeId,
    recipeVersion: version,
    version,
    name: String(raw.name ?? recipeId),
    provenance: String(raw.provenance ?? "MIP_EXPERIMENTAL_RECONSTRUCTION"),
    architecture: String(raw.architecture ?? "LAYERED_STEREO_DSP"),
    sampleRate,
    channels: 2,
    synthesisMode,
    mode: synthesisMode,
    carriers: normalizedCarriers,
    monauralLayers,
    septon,
    binauralRelationships: relations,
    envelope: normalizeEnvelope(envelopeInput, sampleRate, durationMode === "finite", rampSeconds, developmentFixture),
    noise,
    lowFrequencySweep: normalizeSweep(firstDefined(raw.lowFrequencySweep, raw.sweep), "lowFrequencySweep", developmentFixture),
    delay: normalizeEffect(firstDefined(raw.delay, raw.effects?.delay), "delay", sampleRate, developmentFixture),
    comb: normalizeEffect(firstDefined(raw.comb, raw.effects?.comb), "comb", sampleRate, developmentFixture),
    cues: normalizeCues(raw.cues, sampleRate, developmentFixture),
    voiceReferences: normalizeVoiceReferences(firstDefined(raw.voiceReferences, raw.voices)),
    masterGain,
    headroomDb,
    rampSeconds,
    execution: { mode: durationMode, targetFrames },
    durationMode,
    targetFrames,
    developmentFixture,
    metadata: clone(raw.metadata ?? {}),
  };
  if (raw.protocolCueVersion !== undefined || raw.protocolCues !== undefined) {
    normalized.protocolCueVersion = raw.protocolCueVersion === null ? null : String(raw.protocolCueVersion ?? "MIP_PROTOCOL_CUES_V1");
    normalized.protocolCues = normalizeCues(raw.protocolCues ?? [], sampleRate, developmentFixture, "protocolCues");
  }
  normalized.parameterProvenance = normalizeParameterProvenance(
    raw.parameterProvenance ?? raw.provenanceByParameter,
    normalized,
  );
  normalized.historicalStatus = String(raw.historicalStatus ?? "NOT_HISTORICALLY_EXACT");
  normalized.historicalExactness = String(raw.historicalExactness ?? "NOT_CLAIMED");
  const provenanceSummary = summarizeProvenance(normalized);
  normalized.provenanceEligibility = provenanceSummary.provenanceEligible;
  normalized.formalEligibility = raw.formalEligibility === false ? false : provenanceSummary.provenanceEligible;
  normalized.formalEligibilityReason = normalized.formalEligibility
    ? "Provenance is complete; repository/version/verification gates still apply."
    : raw.formalEligibility === false
      ? String(raw.formalEligibilityReason || "Preview-only recipe is not formally eligible.")
      : `UNKNOWN_BLOCKED parameters: ${provenanceSummary.unknownBlocked.join(", ")}`;
  normalized.provenanceAudit = clone(raw.provenanceAudit ?? null);
  normalized.engineeringVerification = clone(raw.engineeringVerification ?? null);
  normalized.leftHz = normalized.carriers[0].leftHz;
  normalized.rightHz = normalized.carriers[0].rightHz;
  normalized.centerHz = (normalized.leftHz + normalized.rightHz) / 2;
  normalized.beatHz = Math.abs(normalized.rightHz - normalized.leftHz);
  normalized.gain = normalized.carriers[0].gainLeft;
  assertFiniteMaterial(normalized, "recipe");
  const fingerprintMaterial = clone(normalized);
  for (const key of FINGERPRINT_EXCLUDED_METADATA) delete fingerprintMaterial[key];
  normalized.configFingerprint = sha256Hex(canonical(fingerprintMaterial));
  if (normalized.engineeringVerification) {
    normalized.engineeringVerification = {
      ...normalized.engineeringVerification,
      configFingerprint: normalized.configFingerprint,
      audioCoreVersion: normalized.engineeringVerification.audioCoreVersion || AUDIO_CORE_VERSION,
      processorVersion: normalized.engineeringVerification.processorVersion || PROCESSOR_VERSION,
      verificationVersion: normalized.engineeringVerification.verificationVersion || ENGINEERING_VERIFICATION_VERSION,
    };
  }
  return normalized;
}

export function validateEffectiveRecipe(recipe) {
  const errors = [];
  try {
    if (!recipe || typeof recipe !== "object") throw new Error("effective recipe must be an object");
    if (typeof recipe.recipeId !== "string" || !recipe.recipeId) errors.push("recipeId is required");
    if (!Number.isInteger(recipe.version) || recipe.version < 1) errors.push("version must be a positive integer");
    if (recipe.sampleRate < 8000 || recipe.sampleRate > 192000 || !Number.isInteger(recipe.sampleRate)) errors.push("sampleRate must be an integer between 8000 and 192000 Hz");
    if (recipe.channels !== 2) errors.push("effective recipe must be stereo");
    if (!Array.isArray(recipe.carriers) || !recipe.carriers.length) errors.push("at least one carrier is required");
    for (const [index, c] of (recipe.carriers ?? []).entries()) {
      for (const side of ["left", "right"]) {
        const hz = c[`${side}Hz`];
        const fmDepth = c.fm?.depthHz ?? 0;
        if (!(Number.isFinite(hz) && hz > 0 && hz + fmDepth < recipe.sampleRate / 2)) errors.push(`carriers[${index}].${side}Hz plus FM depth must be below Nyquist`);
      }
      for (const gain of [c.gainLeft, c.gainRight]) if (!(Number.isFinite(gain) && gain >= 0 && gain <= 1)) errors.push(`carriers[${index}] gain is outside [0,1]`);
    }
    for (const [groupName, group] of [["monauralLayers", recipe.monauralLayers], ["septon", recipe.septon]]) {
      if (!Array.isArray(group)) errors.push("component arrays must be arrays");
      for (const [index, c] of (group ?? []).entries()) {
        for (const side of ["left", "right"]) {
          const hz = c[`${side}Hz`];
          const fmDepth = c.fm?.depthHz ?? 0;
          if (!(Number.isFinite(hz) && hz > 0 && hz + fmDepth < recipe.sampleRate / 2)) errors.push(`${groupName}[${index}].${side}Hz plus FM depth must be below Nyquist`);
        }
        for (const gain of [c.gainLeft, c.gainRight]) if (!(Number.isFinite(gain) && gain >= 0 && gain <= 1)) errors.push(`${groupName}[${index}] gain is outside [0,1]`);
      }
    }
    if (recipe.execution?.mode === "finite" && (!Number.isSafeInteger(recipe.targetFrames) || recipe.targetFrames < 0)) errors.push("finite targetFrames is required");
    if (recipe.execution?.mode === "live" && recipe.targetFrames !== null) errors.push("live recipes cannot have targetFrames");
    if (recipe.noise && (!Number.isInteger(recipe.noise.seed) || recipe.noise.seed < 1)) errors.push("noise seed is required");
    if (!["STANDARD", "PHASED_PINK_PATENT_5356368"].includes(recipe.synthesisMode)) errors.push("synthesisMode is unsupported");
    if (!(Number.isFinite(recipe.masterGain) && recipe.masterGain >= 0 && recipe.masterGain <= 1)) errors.push("masterGain is outside [0,1]");
    if (!(Number.isFinite(recipe.headroomDb) && recipe.headroomDb >= -120 && recipe.headroomDb <= 0)) errors.push("headroomDb is outside [-120,0]");
    if (!(Number.isFinite(recipe.rampSeconds) && recipe.rampSeconds > 0)) errors.push("rampSeconds must be positive");
    for (const [index, cue] of (recipe.cues ?? []).entries()) {
      if (!(Number.isSafeInteger(cue.startFrame) && cue.startFrame >= 0)) errors.push(`cues[${index}].startFrame is invalid`);
      if (!(Number.isSafeInteger(cue.durationFrames) && cue.durationFrames > 0)) errors.push(`cues[${index}].durationFrames is invalid`);
      if (!(cue.leftHz > 0 && cue.leftHz < recipe.sampleRate / 2 && cue.rightHz > 0 && cue.rightHz < recipe.sampleRate / 2)) errors.push(`cues[${index}] must be below Nyquist`);
    }
    for (const [index, cue] of (recipe.protocolCues ?? []).entries()) {
      if (!(Number.isSafeInteger(cue.startFrame) && cue.startFrame >= 0)) errors.push(`protocolCues[${index}].startFrame is invalid`);
      if (!(Number.isSafeInteger(cue.durationFrames) && cue.durationFrames > 0)) errors.push(`protocolCues[${index}].durationFrames is invalid`);
      if (!(cue.leftHz > 0 && cue.leftHz < recipe.sampleRate / 2 && cue.rightHz > 0 && cue.rightHz < recipe.sampleRate / 2)) errors.push(`protocolCues[${index}] must be below Nyquist`);
    }
    if (typeof recipe.configFingerprint === "string") {
      const material = clone(recipe);
      for (const key of FINGERPRINT_EXCLUDED_METADATA) delete material[key];
      if (sha256Hex(canonical(material)) !== recipe.configFingerprint) errors.push("configFingerprint does not match effective recipe");
    } else errors.push("configFingerprint is required");
    if (recipe.parameterProvenance !== undefined && (!recipe.parameterProvenance || typeof recipe.parameterProvenance !== "object" || Array.isArray(recipe.parameterProvenance)))
      errors.push("parameterProvenance must be an object");
  } catch (error) {
    errors.push(error.message);
  }
  return { valid: errors.length === 0, errors };
}

const simplePreset = (id, name, provenance, leftHz, rightHz) => ({
  id,
  recipeId: id,
  version: 1,
  recipeVersion: 1,
  name,
  provenance,
  architecture: "SIMPLE_BINAURAL_COMPONENT",
  synthesisMode: "STANDARD",
  sampleRate: 44100,
  channels: 2,
  carriers: [{ id: "primary", leftHz, rightHz, gain: 0.25, phase: { left: 0, right: 0 }, waveform: "sine", am: null, fm: null }],
  monauralLayers: [],
  septon: [],
  binauralRelationships: [{ type: "explicit_pair", leftHz, rightHz, beatHz: Math.abs(rightHz - leftHz) }],
  envelope: { attackSeconds: 0, decaySeconds: 0, sustain: 1, releaseSeconds: 0 },
  noise: null,
  delay: null,
  comb: null,
  lowFrequencySweep: null,
  cues: [],
  voiceReferences: [],
  masterGain: 0.8,
  headroomDb: -3,
  rampSeconds: 0.01,
  durationMode: "live",
  historicalStatus: provenance === "SHAM_CONTROL" ? "SHAM_CONTROL" : provenance === "DOCUMENTED_PATENT_EXAMPLE" ? "DOCUMENTED_PATENT_COMPARATOR" : "MIP_DEFINED",
  historicalExactness: "NOT_HISTORICALLY_EXACT",
  parameterProvenance: {
    "*": { provenanceClass: "MIP_OPERATIONAL_DEFINED", sourceRef: "engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md §10", sourceStatus: "MIP authority" },
    "carriers[0].leftHz": { provenanceClass: provenance === "DOCUMENTED_PATENT_EXAMPLE" ? "PRIMARY_SOURCE_VERIFIED" : "MIP_OPERATIONAL_DEFINED", sourceRef: provenance === "DOCUMENTED_PATENT_EXAMPLE" ? "engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md §10" : "engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md §10", sourceStatus: provenance === "DOCUMENTED_PATENT_EXAMPLE" ? "Documented comparator pair" : "MIP-defined component" },
    "carriers[0].rightHz": { provenanceClass: provenance === "DOCUMENTED_PATENT_EXAMPLE" ? "PRIMARY_SOURCE_VERIFIED" : "MIP_OPERATIONAL_DEFINED", sourceRef: provenance === "DOCUMENTED_PATENT_EXAMPLE" ? "engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md §10" : "engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md §10", sourceStatus: provenance === "DOCUMENTED_PATENT_EXAMPLE" ? "Documented comparator pair" : "MIP-defined component" },
  },
  engineeringVerification: {
    verificationVersion: "AUDIO_ENGINEERING_FIXTURES_V1",
    configurationValidation: "PASS",
    deterministicFixture: "PASS",
    channelAssignment: "PASS",
    carrierVerification: "PASS",
    noiseVerification: "N/A",
    sweepVerification: "N/A",
    amVerification: "N/A",
    fmVerification: "N/A",
    continuity: "PASS",
    clipping: "PASS",
    pcmDigestFixture: "PASS",
    fixtureId: id === "A-U396-4" ? "PURE_394_398" : id === "A-P100-104" ? "PURE_100_104" : "PURE_SHAM_396_396",
  },
});

const layeredExperimentalRecipe = {
  id: "MIP_LAYERED_EXPERIMENTAL_V1",
  recipeId: "MIP_LAYERED_EXPERIMENTAL_V1",
  recipeVersion: 1,
  version: 1,
  name: "MIP Layered Experimental Reconstruction v1",
  provenance: "MIP_EXPERIMENTAL_RECONSTRUCTION",
  historicalStatus: "PATENT-ARCHITECTURE RECONSTRUCTION",
  historicalExactness: "NOT_HISTORICALLY_EXACT",
  architecture: "LAYERED_STEREO_DSP",
  synthesisMode: "PHASED_PINK_PATENT_5356368",
  sampleRate: 44100,
  channels: 2,
  carriers: [
    { id: "primary-394-398", leftHz: 394, rightHz: 398, gain: { left: 0.18, right: 0.18 }, phase: { left: 0, right: 0 }, waveform: "sine", am: null, fm: null },
    { id: "secondary-200-204-experimental", leftHz: 200, rightHz: 204, gain: { left: 0.06, right: 0.06 }, phase: { left: 0.25, right: 0.25 }, waveform: "sine", am: null, fm: null },
  ],
  binauralRelationships: [
    { id: "primary-pair", type: "explicit_pair", leftHz: 394, rightHz: 398, beatHz: 4, status: "MIP_DEFINED_COMPONENT" },
    { id: "secondary-pair", type: "experimental_pair", leftHz: 200, rightHz: 204, beatHz: 4, status: "MIP_RECONSTRUCTION_PARAMETER" },
  ],
  monauralLayers: [{ id: "monaural-90", leftHz: 90, rightHz: 90, gain: { left: 0.025, right: 0.025 }, phase: { left: 0, right: 0 }, waveform: "sine", am: null, fm: null }],
  septon: [
    { id: "septon-100-1015", leftHz: 100, rightHz: 101.5, gain: { left: 0.03, right: 0.03 }, phase: { left: 0, right: 0 }, waveform: "sine", am: null, fm: null },
  ],
  envelope: { attackSeconds: 0.02, decaySeconds: 0.02, sustain: 0.95, releaseSeconds: 0.02 },
  noise: {
    algorithm: "PHASED_PINK_PATENT_5356368",
    algorithmVersion: 1,
    updateSemantics: LFSR_UPDATE_SEMANTICS,
    updateClock: "rendered PCM frame (engineering reconstruction; patent timing unresolved)",
    seed: 5356368,
    gain: 0.025,
    alpha: 0.65,
    minDelaySamples: 44,
    maxDelaySamples: 662,
    sweepHz: 0.125,
    leftSweepPhase: 0,
    rightSweepPhase: Math.PI / 2,
    combMix: 0.5,
  },
  delay: { delaySamples: 17.5, mix: 0.2, feedback: 0.1 },
  comb: { delaySamples: 23, mix: 0.35, feedback: 0.25 },
  lowFrequencySweep: { frequencyHz: 0.125, depth: 0.1, offset: 0.9, leftPhase: 0, rightPhase: Math.PI / 2 },
  cues: [],
  voiceReferences: [],
  masterGain: 0.8,
  headroomDb: -6,
  rampSeconds: 0.02,
  durationMode: "live",
  parameterProvenance: {
    "*": { provenanceClass: "MIP_RECONSTRUCTION_PARAMETER", reconstructionReason: "The patent establishes architecture/capability, not this exact MIP numerical value.", reconstructionVersion: "MIP_LAYERED_EXPERIMENTAL_V1" },
    "carriers[0].leftHz": { provenanceClass: "MIP_OPERATIONAL_DEFINED", sourceRef: "engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md §10", sourceStatus: "MIP component condition" },
    "carriers[0].rightHz": { provenanceClass: "MIP_OPERATIONAL_DEFINED", sourceRef: "engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md §10", sourceStatus: "MIP component condition" },
    "noise.algorithm": { provenanceClass: "PRIMARY_SOURCE_VERIFIED", sourceRef: "US 5,356,368; engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md", sourceStatus: "Architecture/capability only; exact parameters unresolved" },
    "noise.updateSemantics": { provenanceClass: "MIP_RECONSTRUCTION_PARAMETER", reconstructionReason: "The patent timing language does not unambiguously establish the update clock.", reconstructionVersion: "MIP_LAYERED_EXPERIMENTAL_V1" },
    "noise.alpha": { provenanceClass: "MIP_RECONSTRUCTION_PARAMETER", reconstructionReason: "Filter coefficient is not established by the cited source.", reconstructionVersion: "MIP_LAYERED_EXPERIMENTAL_V1" },
    "noise.minDelaySamples": { provenanceClass: "MIP_RECONSTRUCTION_PARAMETER", reconstructionReason: "Delay minimum is not established by the cited source.", reconstructionVersion: "MIP_LAYERED_EXPERIMENTAL_V1" },
    "noise.maxDelaySamples": { provenanceClass: "MIP_RECONSTRUCTION_PARAMETER", reconstructionReason: "Delay maximum is not established by the cited source.", reconstructionVersion: "MIP_LAYERED_EXPERIMENTAL_V1" },
    "noise.sweepHz": { provenanceClass: "PRIMARY_SOURCE_DERIVED", sourceRef: "US 5,356,368; engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md", derivationRule: "Use the approximately 1/8 Hz sweep rate stated by the source.", inputValues: { sourceRate: "approximately 1/8 Hz" }, derivedValue: 0.125, derivationVersion: "MIP_LAYERED_EXPERIMENTAL_V1" },
  },
  engineeringVerification: {
    verificationVersion: "AUDIO_ENGINEERING_FIXTURES_V1",
    configurationValidation: "PASS",
    deterministicFixture: "PASS",
    channelAssignment: "PASS",
    carrierVerification: "PASS",
    noiseVerification: "PASS",
    sweepVerification: "PASS",
    amVerification: "N/A",
    fmVerification: "N/A",
    continuity: "PASS",
    clipping: "PASS",
    pcmDigestFixture: "PASS",
    fixtureId: "LAYERED_MIP_EXPERIMENTAL",
  },
};

export const BUILTIN_RECIPES = Object.freeze(Object.fromEntries([
  ["A-U396-4", simplePreset("A-U396-4", "MIP User Baseline", "USER_EXPERIMENTAL", 394, 398)],
  ["A-P100-104", simplePreset("A-P100-104", "Monroe Patent Comparator", "DOCUMENTED_PATENT_EXAMPLE", 100, 104)],
  ["A-SHAM-0", simplePreset("A-SHAM-0", "Matched Sham Control", "SHAM_CONTROL", 396, 396)],
].map(([id, recipe]) => [id, Object.freeze(normalizeRecipe(recipe))])));

// The layered demonstration is a repository-backed engineering fixture, not
// one of the three ordinary user-facing component presets.  Keeping it in a
// separate collection prevents the simple preset contract from being widened
// accidentally while allowing SQLite/UI consumers to inspect it explicitly.
export const EXPERIMENTAL_RECIPES = Object.freeze({
  MIP_LAYERED_EXPERIMENTAL_V1: Object.freeze(normalizeRecipe(layeredExperimentalRecipe)),
});

export function lfsrNextState(state) {
  let x = state & 0xffff;
  const bit = (x ^ (x >>> 2) ^ (x >>> 3) ^ (x >>> 5)) & 1;
  x = (x >>> 1) | (bit << 15);
  return x & 0xffff;
}

export function lfsrPeriod(seed = 1) {
  let state = number(seed, "seed", { integer: true, min: 1, max: 0xffff }) & 0xffff;
  if (state === 0) throw new Error("seed must be non-zero");
  const initial = state;
  let period = 0;
  do {
    state = lfsrNextState(state);
    period += 1;
    if (period > LFSR_SEQUENCE_PERIOD) throw new Error("LFSR exceeded the supported maximal period");
  } while (state !== initial);
  return period;
}

export function phasedPinkSample(index, seed = 1) {
  const n = number(index, "index", { integer: true, min: 0 });
  let state = number(seed, "seed", { integer: true, min: 1, max: 0xffff });
  let pink = 0;
  const count = n % 65535;
  for (let i = 0; i <= count; i += 1) {
    state = lfsrNextState(state);
    pink = 0.65 * pink + 0.35 * (state / 32767 - 1);
  }
  return pink;
}

function waveform(phase, type) {
  const p = ((phase / TAU) % 1 + 1) % 1;
  if (type === "square") return p < 0.5 ? 1 : -1;
  if (type === "saw") return 2 * p - 1;
  if (type === "triangle") return 1 - 4 * Math.abs(Math.round(p) - p);
  return Math.sin(phase);
}

function readDelay(line, index, delay) {
  let position = index - delay;
  while (position < 0) position += line.length;
  const i0 = Math.floor(position) % line.length;
  const i1 = (i0 + 1) % line.length;
  const fraction = position - Math.floor(position);
  return line[i0] * (1 - fraction) + line[i1] * fraction;
}

export class PcmStreamHasher {
  constructor(sampleRate) {
    this.sampleRate = number(sampleRate, "sampleRate", { integer: true, min: 1 });
    this.hash = new SHA256();
    this.frameBytes = new Uint8Array(4);
    this.header = new Uint8Array(32);
    for (let i = 0; i < PCM_CANONICAL_FORMAT.magic.length; i += 1) this.header[i] = PCM_CANONICAL_FORMAT.magic.charCodeAt(i);
    this.header[16] = this.sampleRate;
    this.header[17] = this.sampleRate >>> 8;
    this.header[18] = this.sampleRate >>> 16;
    this.header[19] = this.sampleRate >>> 24;
    this.header[20] = 2;
    this.header[22] = 16;
    this.header[24] = 4;
    this.hash.update(this.header);
    this.frames = 0;
    this.finished = false;
  }

  updateFrame(left, right) {
    if (this.finished) throw new Error("PCM hash is already finalized");
    const l = quantize(left);
    const r = quantize(right);
    this.frameBytes[0] = l;
    this.frameBytes[1] = l >> 8;
    this.frameBytes[2] = r;
    this.frameBytes[3] = r >> 8;
    this.hash.update(this.frameBytes);
    this.frames += 1;
  }

  finish(totalFrames = this.frames) {
    if (this.finished) return this.digest;
    const frames = number(totalFrames, "totalFrames", { integer: true, min: 0, max: Number.MAX_SAFE_INTEGER });
    if (frames !== this.frames) throw new Error(`totalFrames ${frames} does not match hashed frames ${this.frames}`);
    const trailer = new Uint8Array(8);
    let value = frames;
    for (let i = 0; i < 8; i += 1) {
      trailer[i] = value % 256;
      value = Math.floor(value / 256);
    }
    this.hash.update(trailer);
    this.digest = this.hash.digest();
    this.finished = true;
    return this.digest;
  }
}

function quantize(value) {
  const n = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  return Math.max(-32768, Math.min(32767, Math.round(n * 32767))) & 0xffff;
}

export function pcmDigest(leftOrOptions, right, sampleRate, totalFrames) {
  let left = leftOrOptions;
  if (leftOrOptions && typeof leftOrOptions === "object" && !ArrayBuffer.isView(leftOrOptions) && !Array.isArray(leftOrOptions)) {
    ({ left, right, sampleRate, totalFrames } = leftOrOptions);
  }
  if (!left || !right) throw new Error("pcmDigest requires left and right channel arrays");
  const frames = totalFrames === undefined ? Math.min(left.length, right.length) : number(totalFrames, "totalFrames", { integer: true, min: 0 });
  if (frames > left.length || frames > right.length) throw new Error("totalFrames exceeds channel length");
  const stream = new PcmStreamHasher(sampleRate ?? 44100);
  for (let i = 0; i < frames; i += 1) stream.updateFrame(left[i], right[i]);
  return stream.finish(frames);
}

export function pcmCanonicalBytes(left, right, sampleRate = 44100, totalFrames) {
  const frames = totalFrames === undefined ? Math.min(left.length, right.length) : totalFrames;
  const bytes = new Uint8Array(32 + frames * 4 + 8);
  const stream = new PcmStreamHasher(sampleRate);
  bytes.set(stream.header, 0);
  for (let i = 0; i < frames; i += 1) {
    const l = quantize(left[i]);
    const r = quantize(right[i]);
    const p = 32 + i * 4;
    bytes[p] = l;
    bytes[p + 1] = l >>> 8;
    bytes[p + 2] = r;
    bytes[p + 3] = r >>> 8;
  }
  let value = frames;
  for (let i = 0; i < 8; i += 1) {
    bytes[bytes.length - 8 + i] = value % 256;
    value = Math.floor(value / 256);
  }
  return bytes;
}

export class AudioEngine {
  constructor(recipe, options = {}) {
    this.configure(recipe, options);
  }

  configure(recipe, options = {}) {
    this.recipe = normalizeRecipe(recipe, options);
    const check = validateEffectiveRecipe(this.recipe);
    if (!check.valid) throw new Error(check.errors.join("; "));
    this.sampleRate = this.recipe.sampleRate;
    this.frame = 0;
    this.totalFrames = 0;
    this.state = "silent";
    this.transportGain = 0;
    this.transportTarget = 0;
    this.transportStep = 0;
    this.transportRemaining = 0;
    this.masterGain = this.recipe.masterGain;
    this.masterGainTarget = this.recipe.masterGain;
    this.masterGainStep = 0;
    this.masterGainRemaining = 0;
    this.rampFrames = Math.max(1, Math.round(this.recipe.rampSeconds * this.sampleRate));
    this.components = [];
    for (const c of [...this.recipe.carriers, ...this.recipe.monauralLayers, ...this.recipe.septon])
      this.components.push({ c, leftPhase: c.phaseLeft, rightPhase: c.phaseRight, leftAmPhase: c.am?.phaseLeft ?? 0, rightAmPhase: c.am?.phaseRight ?? 0, leftFmPhase: c.fm?.phaseLeft ?? 0, rightFmPhase: c.fm?.phaseRight ?? 0 });
    this.cueStates = [...this.recipe.cues, ...(this.recipe.protocolCues || [])].map((cue) => ({ cue, leftPhase: cue.phaseLeft, rightPhase: cue.phaseRight, triggered: false, completed: false }));
    this.noiseState = this.recipe.noise ? { lfsr: this.recipe.noise.seed & 0xffff, pink: 0, red: 0, delayIndex: 0 } : null;
    this.sweepState = this.recipe.lowFrequencySweep ? { leftPhase: this.recipe.lowFrequencySweep.leftPhase, rightPhase: this.recipe.lowFrequencySweep.rightPhase } : null;
    this._noiseLeft = 0;
    this._noiseRight = 0;
    this._cueLeft = 0;
    this._cueRight = 0;
    this._effectLeft = 0;
    this._effectRight = 0;
    this._sourceLeft = 0;
    this._sourceRight = 0;
    if (this.recipe.noise?.algorithm === "PHASED_PINK_PATENT_5356368") {
      const size = this.recipe.noise.maxDelaySamples + 2;
      this.noiseState.leftDelay = new Float64Array(size);
      this.noiseState.rightDelay = new Float64Array(size);
      this.noiseState.leftSweepPhase = this.recipe.noise.leftSweepPhase;
      this.noiseState.rightSweepPhase = this.recipe.noise.rightSweepPhase;
    }
    const createEffectState = (effect) => effect ? {
      index: 0,
      leftDelay: new Float64Array(Math.ceil(effect.delaySamples) + 2),
      rightDelay: new Float64Array(Math.ceil(effect.delaySamples) + 2),
    } : null;
    this.effectState = {
      delay: createEffectState(this.recipe.delay),
      comb: createEffectState(this.recipe.comb),
    };
    this.hasher = new PcmStreamHasher(this.sampleRate);
    this.peaks = { left: 0, right: 0, preClipLeft: 0, preClipRight: 0 };
    this.clipping = 0;
    this.cuesTriggered = 0;
    this.cueEvents = [];
    this.continuityErrors = 0;
    this.lastDigest = null;
    this.startedFrame = null;
    this.lastRenderResult = {
      left: null,
      right: null,
      frames: 0,
      generatedFrames: 0,
      totalFrames: 0,
      startedFrame: null,
      state: this.state,
      allocated: false,
    };
    return this;
  }

  _rampTransport(target) {
    this.transportTarget = target;
    this.transportRemaining = this.rampFrames;
    this.transportStep = (target - this.transportGain) / this.rampFrames;
  }

  _rampMaster(target) {
    this.masterGainTarget = target;
    this.masterGainRemaining = this.rampFrames;
    this.masterGainStep = (target - this.masterGain) / this.rampFrames;
  }

  start() {
    if (this.recipe.execution.mode === "finite" && this.recipe.targetFrames === 0) {
      this.state = "stopped";
      this.lastDigest = this.hasher.finish(0);
      return this;
    }
    if (this.state === "silent") {
      this.startedFrame = this.frame;
      this.state = "running";
      this._rampTransport(1);
    } else if (this.state === "stopped") {
      throw new Error("A stopped engine must be reconfigured before START");
    } else if (this.state === "paused" || this.state === "pausing") {
      this.state = "resuming";
      this._rampTransport(1);
    }
    return this;
  }

  pause() {
    if (!["running", "resuming"].includes(this.state)) throw new Error("PAUSE requires running audio");
    this.state = "pausing";
    this._rampTransport(0);
    return this;
  }

  resume() {
    if (this.state !== "paused" && this.state !== "pausing") throw new Error("RESUME requires paused audio");
    this.state = "resuming";
    this._rampTransport(1);
    return this;
  }

  setMasterGain(value) {
    const gain = number(value, "masterGain", { min: 0, max: 1 });
    this._rampMaster(gain);
    return this;
  }

  stop() {
    if (this.state === "silent" || this.state === "paused") {
      this.state = "stopped";
      this.transportGain = 0;
      this.lastDigest = this.hasher.finish(this.totalFrames);
    } else if (this.state !== "stopped") {
      this.state = "stopping";
      this._rampTransport(0);
    }
    return this;
  }

  _advanceRamps() {
    if (this.transportRemaining > 0) {
      this.transportGain += this.transportStep;
      this.transportRemaining -= 1;
      if (this.transportRemaining === 0) {
        this.transportGain = this.transportTarget;
        if (this.state === "pausing" && this.transportTarget === 0) this.state = "paused";
        if (this.state === "resuming" && this.transportTarget === 1) this.state = "running";
        if (this.state === "stopping" && this.transportTarget === 0) {
          this.state = "stopped";
        }
      }
    }
    if (this.masterGainRemaining > 0) {
      this.masterGain += this.masterGainStep;
      this.masterGainRemaining -= 1;
      if (this.masterGainRemaining === 0) this.masterGain = this.masterGainTarget;
    }
  }

  _envelope(frame) {
    const e = this.recipe.envelope;
    let value = 1;
    if (e.attackFrames > 0 && frame < e.attackFrames) value = frame / e.attackFrames;
    else if (e.decayFrames > 0 && frame < e.attackFrames + e.decayFrames) {
      const p = (frame - e.attackFrames) / e.decayFrames;
      value = 1 + (e.sustain - 1) * p;
    } else value = e.sustain;
    if (this.recipe.execution.mode === "finite" && this.recipe.targetFrames !== null && e.releaseFrames > 0) {
      const start = Math.max(0, this.recipe.targetFrames - e.releaseFrames);
      if (frame >= start) value *= Math.max(0, (this.recipe.targetFrames - 1 - frame) / Math.max(1, e.releaseFrames - 1));
    }
    return Math.max(0, Math.min(1, value));
  }

  _componentSample(componentState, side) {
    const c = componentState.c;
    const isLeft = side === "left";
    let phase = isLeft ? componentState.leftPhase : componentState.rightPhase;
    const fm = c.fm;
    const fmPhase = isLeft ? componentState.leftFmPhase : componentState.rightFmPhase;
    const frequency = (isLeft ? c.leftHz : c.rightHz) + (fm ? fm.depthHz * Math.sin(fmPhase) : 0);
    const value = waveform(phase, c.waveform);
    const am = c.am;
    const amPhase = isLeft ? componentState.leftAmPhase : componentState.rightAmPhase;
    const amplitude = am ? am.offset + am.depth * Math.sin(amPhase) : 1;
    phase += TAU * frequency / this.sampleRate;
    phase = wrapPhase(phase);
    if (isLeft) componentState.leftPhase = phase;
    else componentState.rightPhase = phase;
    if (fm) {
      const next = wrapPhase(fmPhase + TAU * fm.rateHz / this.sampleRate);
      if (isLeft) componentState.leftFmPhase = next % TAU;
      else componentState.rightFmPhase = next % TAU;
    }
    if (am) {
      const next = wrapPhase(amPhase + TAU * am.rateHz / this.sampleRate);
      if (isLeft) componentState.leftAmPhase = next % TAU;
      else componentState.rightAmPhase = next % TAU;
    }
    return value * amplitude * (isLeft ? c.gainLeft : c.gainRight);
  }

  _noiseSample() {
    const n = this.recipe.noise;
    if (!n || !this.noiseState) {
      this._noiseLeft = 0;
      this._noiseRight = 0;
      return;
    }
    this.noiseState.lfsr = lfsrNextState(this.noiseState.lfsr);
    const white = this.noiseState.lfsr / 32767 - 1;
    let filtered = white;
    if (n.algorithm === "PINK_NOISE" || n.algorithm === "PHASED_PINK_PATENT_5356368") {
      this.noiseState.pink = n.alpha * this.noiseState.pink + n.filterGain * white;
      filtered = this.noiseState.pink;
    } else if (n.algorithm === "RED_NOISE") {
      this.noiseState.red = n.alpha * this.noiseState.red + n.filterGain * white;
      filtered = this.noiseState.red;
    }
    if (n.algorithm !== "PHASED_PINK_PATENT_5356368") {
      this._noiseLeft = filtered * n.gain;
      this._noiseRight = filtered * n.gain;
      return;
    }
    const index = this.noiseState.delayIndex;
    this.noiseState.leftDelay[index] = filtered;
    this.noiseState.rightDelay[index] = filtered;
    const leftSweep = Math.sin(this.noiseState.leftSweepPhase);
    const rightSweep = Math.sin(this.noiseState.rightSweepPhase);
    const span = n.maxDelaySamples - n.minDelaySamples;
    const leftDelay = n.minDelaySamples + (leftSweep + 1) * 0.5 * span;
    const rightDelay = n.minDelaySamples + (rightSweep + 1) * 0.5 * span;
    const leftEarlier = readDelay(this.noiseState.leftDelay, index, leftDelay);
    const rightEarlier = readDelay(this.noiseState.rightDelay, index, rightDelay);
    this.noiseState.delayIndex = (index + 1) % this.noiseState.leftDelay.length;
    this.noiseState.leftSweepPhase = wrapPhase(this.noiseState.leftSweepPhase + TAU * n.sweepHz / this.sampleRate);
    this.noiseState.rightSweepPhase = wrapPhase(this.noiseState.rightSweepPhase + TAU * n.sweepHz / this.sampleRate);
    this._noiseLeft = ((1 - n.combMix) * filtered + n.combMix * leftEarlier) * n.gain;
    this._noiseRight = ((1 - n.combMix) * filtered + n.combMix * rightEarlier) * n.gain;
  }

  _cueSample(frame) {
    let left = 0;
    let right = 0;
    for (const state of this.cueStates) {
      const cue = state.cue;
      if (frame < cue.startFrame || frame >= cue.startFrame + cue.durationFrames) continue;
      if (!state.triggered) {
        state.triggered = true;
        this.cuesTriggered += 1;
        this.cueEvents.push({ id: cue.id, scheduledFrame: cue.startFrame, actualFrame: frame });
      }
      left += waveform(state.leftPhase, cue.waveform) * cue.gainLeft;
      right += waveform(state.rightPhase, cue.waveform) * cue.gainRight;
      state.leftPhase = wrapPhase(state.leftPhase + TAU * cue.leftHz / this.sampleRate);
      state.rightPhase = wrapPhase(state.rightPhase + TAU * cue.rightHz / this.sampleRate);
      if (frame + 1 >= cue.startFrame + cue.durationFrames) state.completed = true;
    }
    this._cueLeft = left;
    this._cueRight = right;
  }

  _effect(inputLeft, inputRight, effect, state) {
    if (!effect) {
      this._effectLeft = inputLeft;
      this._effectRight = inputRight;
      return;
    }
    const delayedLeft = readDelay(state.leftDelay, state.index, effect.delaySamples);
    const delayedRight = readDelay(state.rightDelay, state.index, effect.delaySamples);
    state.leftDelay[state.index] = inputLeft + delayedLeft * effect.feedback;
    state.rightDelay[state.index] = inputRight + delayedRight * effect.feedback;
    state.index = (state.index + 1) % state.leftDelay.length;
    this._effectLeft = inputLeft * (1 - effect.mix) + delayedLeft * effect.mix;
    this._effectRight = inputRight * (1 - effect.mix) + delayedRight * effect.mix;
  }

  _sourceSample(frame) {
    let left = 0;
    let right = 0;
    for (const state of this.components) {
      left += this._componentSample(state, "left");
      right += this._componentSample(state, "right");
    }
    this._noiseSample();
    left += this._noiseLeft;
    right += this._noiseRight;
    this._cueSample(frame);
    left += this._cueLeft;
    right += this._cueRight;
    if (this.sweepState) {
      const sweep = this.recipe.lowFrequencySweep;
      left *= sweep.offset + sweep.depth * Math.sin(this.sweepState.leftPhase);
      right *= sweep.offset + sweep.depth * Math.sin(this.sweepState.rightPhase);
      this.sweepState.leftPhase = wrapPhase(this.sweepState.leftPhase + TAU * sweep.frequencyHz / this.sampleRate);
      this.sweepState.rightPhase = wrapPhase(this.sweepState.rightPhase + TAU * sweep.frequencyHz / this.sampleRate);
    }
    const envelope = this._envelope(frame);
    left *= envelope;
    right *= envelope;
    if (this.recipe.delay) {
      this._effect(left, right, this.recipe.delay, this.effectState.delay);
      left = this._effectLeft;
      right = this._effectRight;
    }
    if (this.recipe.comb) {
      this._effect(left, right, this.recipe.comb, this.effectState.comb);
      left = this._effectLeft;
      right = this._effectRight;
    }
    this._sourceLeft = left * 10 ** (this.recipe.headroomDb / 20);
    this._sourceRight = right * 10 ** (this.recipe.headroomDb / 20);
  }

  renderInto(left, right) {
    let allocated = false;
    if (typeof left === "number") {
      right = new Float32Array(left);
      left = new Float32Array(left);
      allocated = true;
    }
    if (!left || !right || left.length !== right.length) throw new Error("renderInto requires equal stereo arrays");
    const requested = left.length;
    let rendered = 0;
    for (let i = 0; i < requested; i += 1) {
      let outLeft = 0;
      let outRight = 0;
      const active = this.state === "running" || this.state === "resuming" || this.state === "pausing" || this.state === "stopping";
      if (active && !(this.recipe.execution.mode === "finite" && this.recipe.targetFrames !== null && this.frame >= this.recipe.targetFrames)) {
        const frameIndex = this.frame;
        this._sourceSample(frameIndex);
        this.frame += 1;
        this._advanceRamps();
        let finiteRamp = 1;
        if (this.recipe.execution.mode === "finite" && this.recipe.targetFrames > 0) {
          finiteRamp = Math.min(
            1,
            (frameIndex + 1) / this.rampFrames,
            (this.recipe.targetFrames - 1 - frameIndex) / Math.max(1, this.rampFrames - 1),
          );
          finiteRamp = Math.max(0, finiteRamp);
        }
        outLeft = this._sourceLeft * this.transportGain * this.masterGain * finiteRamp;
        outRight = this._sourceRight * this.transportGain * this.masterGain * finiteRamp;
        if (this.recipe.execution.mode === "finite" && this.frame >= this.recipe.targetFrames) {
          // Finite streams end on the exact target frame. The normalized
          // release envelope supplies the final de-click inside that frame.
          this.state = "stopped";
          this.transportGain = 0;
        }
      } else if (this.state === "paused" || ((this.state === "silent" || this.state === "stopped") && this.masterGainRemaining > 0)) {
        this._advanceRamps();
      }
      const preLeft = outLeft;
      const preRight = outRight;
      outLeft = Math.max(-1, Math.min(1, Number.isFinite(outLeft) ? outLeft : 0));
      outRight = Math.max(-1, Math.min(1, Number.isFinite(outRight) ? outRight : 0));
      if (outLeft === 0) outLeft = 0;
      if (outRight === 0) outRight = 0;
      this.peaks.preClipLeft = Math.max(this.peaks.preClipLeft, Math.abs(preLeft));
      this.peaks.preClipRight = Math.max(this.peaks.preClipRight, Math.abs(preRight));
      this.peaks.left = Math.max(this.peaks.left, Math.abs(outLeft));
      this.peaks.right = Math.max(this.peaks.right, Math.abs(outRight));
      if (Math.abs(preLeft) > 1 || Math.abs(preRight) > 1) this.clipping += 1;
      left[i] = outLeft;
      right[i] = outRight;
      if (active) {
        this.hasher.updateFrame(outLeft, outRight);
        this.totalFrames += 1;
        rendered += 1;
      }
    }
    this.lastRenderResult.left = left;
    this.lastRenderResult.right = right;
    this.lastRenderResult.frames = rendered;
    this.lastRenderResult.generatedFrames = this.frame;
    this.lastRenderResult.totalFrames = this.totalFrames;
    this.lastRenderResult.startedFrame = this.startedFrame;
    this.lastRenderResult.state = this.state;
    this.lastRenderResult.allocated = allocated;
    return this.lastRenderResult;
  }

  finalize() {
    if (this.state !== "stopped") throw new Error("AudioEngine must be stopped before finalization");
    if (!this.lastDigest) this.lastDigest = this.hasher.finish(this.totalFrames);
    return this.lastDigest;
  }

  getTelemetry() {
    return {
      frames: this.frame,
      generatedFrames: this.frame,
      totalFrames: this.totalFrames,
      state: this.state,
      recipeId: this.recipe.recipeId,
      recipeVersion: this.recipe.version,
      sampleRate: this.sampleRate,
      configFingerprint: this.recipe.configFingerprint,
      digest: this.lastDigest,
      masterGain: this.masterGain,
      masterGainTarget: this.masterGainTarget,
      headroomDb: this.recipe.headroomDb,
      clipping: this.clipping > 0,
      clippingSamples: this.clipping,
      peaks: { ...this.peaks },
      cues: this.cuesTriggered,
      cueEvents: this.cueEvents.map((event) => ({ ...event })),
      startedFrame: this.startedFrame,
      continuity: { ok: this.continuityErrors === 0, errors: this.continuityErrors },
    };
  }

  snapshot() {
    return {
      frame: this.frame,
      totalFrames: this.totalFrames,
      state: this.state,
      transportGain: this.transportGain,
      transportTarget: this.transportTarget,
      transportStep: this.transportStep,
      transportRemaining: this.transportRemaining,
      masterGain: this.masterGain,
      masterGainTarget: this.masterGainTarget,
      masterGainStep: this.masterGainStep,
      masterGainRemaining: this.masterGainRemaining,
      startedFrame: this.startedFrame,
      sweepState: this.sweepState ? { ...this.sweepState } : null,
      components: this.components.map((s) => ({ ...s })),
      cueStates: this.cueStates.map((s) => ({ ...s })),
      noiseState: this.noiseState ? { ...this.noiseState, leftDelay: this.noiseState.leftDelay ? Array.from(this.noiseState.leftDelay) : null, rightDelay: this.noiseState.rightDelay ? Array.from(this.noiseState.rightDelay) : null } : null,
      effectState: Object.fromEntries(Object.entries(this.effectState).map(([key, state]) => [key, state ? { index: state.index, leftDelay: Array.from(state.leftDelay), rightDelay: Array.from(state.rightDelay) } : null])),
      hasher: { h: Array.from(this.hasher.hash.h), buffer: Array.from(this.hasher.hash.buffer), bufferLength: this.hasher.hash.bufferLength, bytesHashed: this.hasher.hash.bytesHashed, frames: this.hasher.frames, finished: this.hasher.finished, digest: this.hasher.digest ?? null },
      peaks: { ...this.peaks },
      clipping: this.clipping,
      cuesTriggered: this.cuesTriggered,
      cueEvents: this.cueEvents.map((event) => ({ ...event })),
      lastDigest: this.lastDigest,
    };
  }

  restore(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.components) || snapshot.components.length !== this.components.length) throw new Error("Invalid audio engine snapshot");
    for (const key of ["frame", "totalFrames", "state", "transportGain", "transportTarget", "transportStep", "transportRemaining", "masterGain", "masterGainTarget", "masterGainStep", "masterGainRemaining", "startedFrame"]) this[key] = snapshot[key];
    for (let i = 0; i < this.components.length; i += 1) Object.assign(this.components[i], snapshot.components[i]);
    for (let i = 0; i < this.cueStates.length; i += 1) Object.assign(this.cueStates[i], snapshot.cueStates[i]);
    if (this.noiseState && snapshot.noiseState) {
      const { leftDelay, rightDelay, ...noiseValues } = snapshot.noiseState;
      Object.assign(this.noiseState, noiseValues);
      if (leftDelay) this.noiseState.leftDelay.set(leftDelay);
      if (rightDelay) this.noiseState.rightDelay.set(rightDelay);
    }
    for (const key of ["delay", "comb"]) {
      if (!this.effectState[key] || !snapshot.effectState[key]) continue;
      this.effectState[key].index = snapshot.effectState[key].index;
      this.effectState[key].leftDelay.set(snapshot.effectState[key].leftDelay);
      this.effectState[key].rightDelay.set(snapshot.effectState[key].rightDelay);
    }
    if (this.sweepState && snapshot.sweepState) Object.assign(this.sweepState, snapshot.sweepState);
    if (snapshot.hasher) {
      this.hasher.hash.h.set(snapshot.hasher.h);
      this.hasher.hash.buffer.set(snapshot.hasher.buffer);
      this.hasher.hash.bufferLength = snapshot.hasher.bufferLength;
      this.hasher.hash.bytesHashed = snapshot.hasher.bytesHashed;
      this.hasher.frames = snapshot.hasher.frames;
      this.hasher.finished = snapshot.hasher.finished;
      this.hasher.digest = snapshot.hasher.digest;
    }
    this.peaks = { ...snapshot.peaks };
    this.clipping = snapshot.clipping;
    this.cuesTriggered = snapshot.cuesTriggered;
    this.cueEvents = snapshot.cueEvents.map((event) => ({ ...event }));
    this.lastDigest = snapshot.lastDigest ?? null;
    return this;
  }
}

export function renderOffline(recipe, options = {}) {
  const requested = typeof options === "number" ? options : options.targetFrames;
  const raw = typeof options === "number" ? recipe : { ...recipe, ...(options.sampleRate === undefined ? {} : { sampleRate: options.sampleRate }), ...(options.masterGain === undefined ? {} : { masterGain: options.masterGain }), durationMode: "finite", ...(requested === undefined ? {} : { targetFrames: requested }) };
  let targetFrames = requested ?? raw.targetFrames;
  if (targetFrames === undefined && raw.durationSeconds !== undefined) targetFrames = Math.round(number(raw.durationSeconds, "durationSeconds", { min: 0 }) * Number(raw.sampleRate ?? 44100));
  if (targetFrames === undefined) throw new Error("renderOffline requires targetFrames or durationSeconds");
  targetFrames = number(targetFrames, "targetFrames", { integer: true, min: 0, max: Number.MAX_SAFE_INTEGER });
  // Rendering is an explicit finite projection. Keep both public aliases
  // synchronized so strict normalization never sees a contradictory request
  // when a live recipe or a different finite frame count is rendered.
  const engine = new AudioEngine({
    ...raw,
    durationMode: "finite",
    targetFrames,
    execution: { ...(raw.execution && typeof raw.execution === "object" ? raw.execution : {}), mode: "finite", targetFrames },
  });
  const effective = engine.recipe;
  const left = new Float32Array(targetFrames);
  const right = new Float32Array(targetFrames);
  engine.start();
  if (targetFrames) engine.renderInto(left, right);
  const digest = engine.finalize();
  return { left, right, frames: targetFrames, digest, configFingerprint: effective.configFingerprint, recipe: effective, telemetry: engine.getTelemetry(), engine };
}
