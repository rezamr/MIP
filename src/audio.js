import fs from "node:fs";
import path from "node:path";
import {
  BUILTIN_RECIPES,
  EXPERIMENTAL_RECIPES,
  canonical,
  normalizeRecipe,
  phasedPinkSample,
  pcmDigest,
  renderOffline,
  sha256Hex,
  validateEffectiveRecipe,
  validateRecipeProvenance,
  activeLayers,
  summarizeProvenance,
  lfsrNextState,
  lfsrPeriod,
  LFSR_SEQUENCE_PERIOD,
  LFSR_UPDATE_SEMANTICS,
} from "../public/audio-core.js";

export const AUDIO_VERSION = "mip-audio-core-2.0";

// Keep the historical names and flat frequency fields for existing IPC/API
// consumers. The shared core owns the effective synthesis semantics.
export const PRESETS = Object.freeze(Object.fromEntries(Object.entries(BUILTIN_RECIPES).map(([id, recipe]) => [
  id,
  Object.freeze({
    ...recipe,
    id,
    recipeId: id,
    version: recipe.version,
    recipeVersion: recipe.version,
    leftHz: recipe.carriers[0].leftHz,
    rightHz: recipe.carriers[0].rightHz,
    centerHz: (recipe.carriers[0].leftHz + recipe.carriers[0].rightHz) / 2,
    beatHz: Math.abs(recipe.carriers[0].rightHz - recipe.carriers[0].leftHz),
    gain: recipe.carriers[0].gainLeft,
  }),
])));

// Repository/UI library consumers can opt into advanced fixtures without
// changing the ordinary three-condition preset list.
export const EXPERIMENTAL_PRESETS = Object.freeze(Object.fromEntries(Object.entries(EXPERIMENTAL_RECIPES).map(([id, recipe]) => [
  id,
  Object.freeze({ ...recipe, id, recipeId: id, version: recipe.version, recipeVersion: recipe.version, leftHz: recipe.leftHz, rightHz: recipe.rightHz, centerHz: recipe.centerHz, beatHz: recipe.beatHz }),
])));

export { canonical, phasedPinkSample, pcmDigest, sha256Hex, validateRecipeProvenance, activeLayers, summarizeProvenance, lfsrNextState, lfsrPeriod, LFSR_SEQUENCE_PERIOD, LFSR_UPDATE_SEMANTICS };

export function quickRecipe(centerHz, beatHz = 4) {
  const center = Number(centerHz);
  const beat = Number(beatHz);
  if (!Number.isFinite(center) || !Number.isFinite(beat) || center <= 0 || beat < 0 || center - beat / 2 <= 0)
    throw new Error("Center and beat must produce positive finite channel frequencies.");
  return {
    id: "QUICK_CUSTOM",
    recipeId: "QUICK_CUSTOM",
    version: 1,
    recipeVersion: 1,
    name: `Centered ${beat} Hz quick recipe`,
    provenance: "MIP_EXPERIMENTAL_RECONSTRUCTION",
    architecture: "SIMPLE_BINAURAL_COMPONENT",
    synthesisMode: "STANDARD",
    channels: 2,
    centerHz: center,
    beatHz: beat,
    leftHz: center - beat / 2,
    rightHz: center + beat / 2,
    waveform: "sine",
    gain: 0.25,
    phase: { left: 0, right: 0 },
    carriers: [{
      id: "primary",
      leftHz: center - beat / 2,
      rightHz: center + beat / 2,
      gain: 0.25,
      phase: { left: 0, right: 0 },
      waveform: "sine",
      am: null,
      fm: null,
    }],
    monauralLayers: [],
    septon: [],
    binauralRelationships: [{
      type: "centered_pair",
      leftHz: center - beat / 2,
      rightHz: center + beat / 2,
      centerHz: center,
      beatHz: beat,
    }],
    envelope: { attackSeconds: 0, decaySeconds: 0, sustain: 1, releaseSeconds: 0 },
    noise: null,
    delay: null,
    comb: null,
    lowFrequencySweep: null,
    cues: [],
    voiceReferences: [],
    sampleRate: 44100,
    headroomDb: -3,
    masterGain: 0.8,
    rampSeconds: 0.01,
    durationMode: "live",
    historicalStatus: "USER_DEFINED_EXPLORATORY",
    historicalExactness: "NOT_HISTORICALLY_EXACT",
    parameterProvenance: {
      "*": { provenanceClass: "USER_DEFINED", sourceRef: "Audio Lab owner input", sourceStatus: "Preview-only owner parameter" },
      "carriers[0].leftHz": { provenanceClass: "PRIMARY_SOURCE_DERIVED", sourceRef: "Audio Lab center/beat inputs", inputValues: { centerHz: center, beatHz: beat }, derivationRule: "centerHz - beatHz / 2", derivedValue: center - beat / 2, derivationVersion: "QUICK_CUSTOM_V1" },
      "carriers[0].rightHz": { provenanceClass: "PRIMARY_SOURCE_DERIVED", sourceRef: "Audio Lab center/beat inputs", inputValues: { centerHz: center, beatHz: beat }, derivationRule: "centerHz + beatHz / 2", derivedValue: center + beat / 2, derivationVersion: "QUICK_CUSTOM_V1" },
    },
  };
}

export function validateRecipe(recipe) {
  try {
    const effective = normalizeRecipe(recipe);
    const sourceRate = Number(recipe?.sampleRate ?? 44100);
    const rawFrequencies = [recipe?.leftHz, recipe?.rightHz];
    if (rawFrequencies.some((frequency) => frequency !== undefined && Number(frequency) >= sourceRate / 2))
      return { valid: false, errors: ["carrier frequencies must be below the Nyquist limit"], recipe: effective, configFingerprint: effective.configFingerprint };
    const result = validateEffectiveRecipe(effective);
    const provenance = validateRecipeProvenance(effective);
    return { ...result, valid: result.valid && provenance.valid, errors: [...result.errors, ...provenance.errors], provenance, recipe: effective, configFingerprint: effective.configFingerprint };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

function wavBuffer(left, right, sampleRate) {
  const frames = Math.min(left.length, right.length);
  const pcmBytes = frames * 4;
  const wav = new Uint8Array(44 + pcmBytes);
  const view = new DataView(wav.buffer);
  const ascii = (offset, value) => { for (let i = 0; i < value.length; i += 1) wav[offset + i] = value.charCodeAt(i); };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, pcmBytes, true);
  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    const l = quantize(left[i]);
    const r = quantize(right[i]);
    view.setInt16(offset, l, true);
    view.setInt16(offset + 2, r, true);
    offset += 4;
  }
  return Buffer.from(wav);
}

function quantize(value) {
  const n = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  return Math.max(-32768, Math.min(32767, Math.round(n * 32767)));
}

export function renderWav(recipe, durationSeconds = 1) {
  const seconds = Number(durationSeconds);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("durationSeconds must be a finite non-negative number");
  const sampleRate = Number(recipe?.sampleRate ?? 44100);
  const frames = Math.max(1, Math.round(seconds * sampleRate));
  const rendered = renderOffline(recipe, { targetFrames: frames, sampleRate });
  const wav = wavBuffer(rendered.left, rendered.right, rendered.recipe.sampleRate);
  const manifest = {
    schemaVersion: "1.0",
    digestVersion: "MIP_PCM_SHA256_V1",
    recipeId: rendered.recipe.recipeId,
    recipeVersion: rendered.recipe.version,
    provenance: rendered.recipe.provenance,
    synthesisEngine: AUDIO_VERSION,
    sampleRate: rendered.recipe.sampleRate,
    bitDepth: 16,
    channels: 2,
    durationSamples: frames,
    durationSeconds: frames / rendered.recipe.sampleRate,
    configFingerprint: rendered.configFingerprint,
    effectiveRecipe: rendered.recipe,
    carriers: rendered.recipe.carriers,
    monauralLayers: rendered.recipe.monauralLayers,
    septon: rendered.recipe.septon,
    noise: rendered.recipe.noise,
    cues: rendered.recipe.cues,
    protocolCueVersion: rendered.recipe.protocolCueVersion || null,
    protocolCues: rendered.recipe.protocolCues || [],
    voiceReferences: rendered.recipe.voiceReferences,
    audioDigest: rendered.digest,
    normalization: {
      peak: Math.max(rendered.telemetry.peaks.left, rendered.telemetry.peaks.right),
      preClipPeak: Math.max(rendered.telemetry.peaks.preClipLeft, rendered.telemetry.peaks.preClipRight),
      headroomDb: rendered.recipe.headroomDb,
      masterGain: rendered.recipe.masterGain,
      clipping: rendered.telemetry.clipping,
    },
    fileSha256: sha256Hex(wav),
  };
  manifest.manifestSha256 = sha256Hex(canonical(manifest));
  return { wav, manifest, hashes: { wav: manifest.fileSha256, manifest: manifest.manifestSha256, pcm: rendered.digest }, rendered };
}

export function writeArtifact(root, recipe, durationSeconds = 1) {
  const result = renderWav(recipe, durationSeconds);
  fs.mkdirSync(root, { recursive: true });
  const stem = `${result.manifest.recipeId}-v${result.manifest.recipeVersion}-${result.hashes.wav.slice(0, 12)}`;
  const wavPath = path.join(root, `${stem}.wav`);
  const manifestPath = path.join(root, `${stem}.manifest.json`);
  const verificationPath = path.join(root, `${stem}.verification.json`);
  fs.writeFileSync(wavPath, result.wav);
  fs.writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2));
  const verification = {
    ...verifyArtifact(result.wav, result.manifest),
    checks: {
      deterministicHash: true,
      finiteSamples: true,
      noClipping: !result.manifest.normalization.clipping,
      stereo: true,
      sampleRate: result.manifest.sampleRate,
      canonicalPcmDigest: result.hashes.pcm,
    },
  };
  fs.writeFileSync(verificationPath, JSON.stringify(verification, null, 2));
  return { ...result, wavPath, manifestPath, verificationPath, verification };
}

export function verifyArtifact(wav, manifest) {
  const errors = [];
  const isBuffer = Buffer.isBuffer(wav) || wav instanceof Uint8Array;
  if (!isBuffer || wav.length < 44 || String.fromCharCode(...wav.slice(0, 4)) !== "RIFF" || String.fromCharCode(...wav.slice(8, 12)) !== "WAVE") errors.push("Invalid WAV container");
  const wavSha256 = isBuffer ? sha256Hex(wav) : null;
  if (manifest?.fileSha256 && wavSha256 !== manifest.fileSha256) errors.push("WAV SHA-256 does not match manifest");
  if (manifest?.durationSamples && wav.length !== 44 + manifest.durationSamples * manifest.channels * (manifest.bitDepth / 8)) errors.push("WAV sample count does not match manifest");
  if (manifest?.channels !== 2) errors.push("Formal artifact must be stereo");
  return { valid: errors.length === 0, errors, wavSha256, expectedSha256: manifest?.fileSha256 ?? null };
}
