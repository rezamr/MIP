/*
 * Named, deterministic engineering fixtures.
 *
 * These recipes are intentionally kept out of the ordinary Audio Lab preset
 * list.  They are imported by verification tooling and provide a stable
 * vocabulary for source-fidelity, DSP, gain, channel, and shared-core tests.
 */
import {
  BUILTIN_RECIPES,
  EXPERIMENTAL_RECIPES,
  normalizeRecipe,
  renderOffline,
  pcmDigest,
} from "../public/audio-core.js";

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  return value;
};

const reconstructionProvenance = Object.freeze({
  "*": {
    provenanceClass: "MIP_RECONSTRUCTION_PARAMETER",
    reconstructionReason: "This deterministic engineering fixture is not a historical recording; values are explicit test parameters.",
    reconstructionVersion: "AUDIO_ENGINEERING_FIXTURES_V1",
  },
});

function finiteRecipe(source, fixtureId, overrides = {}, targetFrames = 1024) {
  const input = {
    ...clone(source),
    ...clone(overrides),
    recipeId: fixtureId,
    id: fixtureId,
    recipeVersion: 1,
    version: 1,
    name: `${fixtureId} engineering fixture`,
    provenance: "MIP_ENGINEERING_FIXTURE",
    historicalStatus: "ENGINEERING_FIXTURE",
    historicalExactness: "NOT_HISTORICALLY_EXACT",
    durationMode: "finite",
    targetFrames,
    execution: { mode: "finite", targetFrames },
    parameterProvenance: overrides.parameterProvenance || reconstructionProvenance,
    engineeringVerification: {
      verificationVersion: "AUDIO_ENGINEERING_FIXTURES_V1",
      fixtureId,
      configurationValidation: "PASS",
      deterministicFixture: "PASS",
    },
  };
  // Carrier overrides are authoritative.  Remove inherited convenience
  // projections so a fixture cannot accidentally submit stale aliases.
  if (overrides.carriers !== undefined)
    for (const key of ["leftHz", "rightHz", "leftFrequencyHz", "rightFrequencyHz", "frequencyHz", "hz", "centerHz", "beatHz", "gain"]) delete input[key];
  delete input.configFingerprint;
  return Object.freeze(normalizeRecipe(input));
}

const pureSham = finiteRecipe(BUILTIN_RECIPES["A-SHAM-0"], "PURE_SHAM_396_396");
const pure394398 = finiteRecipe(BUILTIN_RECIPES["A-U396-4"], "PURE_394_398");
const pure100104 = finiteRecipe(BUILTIN_RECIPES["A-P100-104"], "PURE_100_104");

const phasedPinkNoCarrier = finiteRecipe(
  BUILTIN_RECIPES["A-SHAM-0"],
  "PHASED_PINK_NO_CARRIER",
  {
    synthesisMode: "PHASED_PINK_PATENT_5356368",
    mode: "PHASED_PINK_PATENT_5356368",
    carriers: [{ id: "disabled-carrier", leftHz: 396, rightHz: 396, gain: 0, phase: { left: 0, right: 0 }, waveform: "sine", am: null, fm: null }],
    noise: {
      algorithm: "PHASED_PINK_PATENT_5356368",
      algorithmVersion: 1,
      updateSemantics: "ONE_ADVANCE_PER_RENDERED_PCM_FRAME_MIP_RECONSTRUCTION",
      updateClock: "rendered PCM frame (engineering fixture; historical clock unresolved)",
      seed: 42,
      gain: 0.2,
      alpha: 0.65,
      minDelaySamples: 4,
      maxDelaySamples: 30,
      sweepHz: 0.125,
      leftSweepPhase: 0,
      rightSweepPhase: Math.PI / 2,
      combMix: 0.5,
    },
  },
);

const layered = finiteRecipe(EXPERIMENTAL_RECIPES.MIP_LAYERED_EXPERIMENTAL_V1, "LAYERED_MIP_EXPERIMENTAL", {
  parameterProvenance: reconstructionProvenance,
});

const amTest = finiteRecipe(BUILTIN_RECIPES["A-U396-4"], "AM_TEST", {
  carriers: [{ id: "am-carrier", leftHz: 394, rightHz: 398, gain: 0.2, phase: { left: 0, right: 0 }, waveform: "sine", am: { rateHz: 5, depth: 0.5, offset: 0.5, phase: { left: 0, right: Math.PI / 2 } }, fm: null }],
});

const fmTest = finiteRecipe(BUILTIN_RECIPES["A-U396-4"], "FM_TEST", {
  carriers: [{ id: "fm-carrier", leftHz: 394, rightHz: 398, gain: 0.2, phase: { left: 0, right: 0 }, waveform: "sine", am: null, fm: { rateHz: 3, depthHz: 12, phase: { left: 0.2, right: 0.7 } } }],
});

const impulseCue = {
  id: "impulse",
  startFrame: 0,
  durationFrames: 1,
  leftHz: 440,
  rightHz: 440,
  gain: { left: 1, right: 1 },
  phase: { left: Math.PI / 2, right: Math.PI / 2 },
  waveform: "sine",
};

const delayImpulse = finiteRecipe(BUILTIN_RECIPES["A-SHAM-0"], "DELAY_IMPULSE_TEST", {
  carriers: [{ id: "silent-carrier", leftHz: 396, rightHz: 396, gain: 0, phase: { left: 0, right: 0 }, waveform: "sine", am: null, fm: null }],
  cues: [impulseCue],
  delay: { delaySamples: 8, mix: 1, feedback: 0 },
});

const combImpulse = finiteRecipe(BUILTIN_RECIPES["A-SHAM-0"], "COMB_IMPULSE_TEST", {
  carriers: [{ id: "silent-carrier", leftHz: 396, rightHz: 396, gain: 0, phase: { left: 0, right: 0 }, waveform: "sine", am: null, fm: null }],
  cues: [impulseCue],
  comb: { delaySamples: 8, mix: 0.5, feedback: 0 },
});

const stereoSweep = finiteRecipe(BUILTIN_RECIPES["A-U396-4"], "STEREO_SWEEP_TEST", {
  lowFrequencySweep: { frequencyHz: 2, depth: 0.3, offset: 0.7, leftPhase: 0, rightPhase: Math.PI / 2 },
});

export const AUDIO_ACCEPTANCE_FIXTURES = Object.freeze({
  PURE_SHAM_396_396: pureSham,
  PURE_394_398: pure394398,
  PURE_100_104: pure100104,
  PHASED_PINK_NO_CARRIER: phasedPinkNoCarrier,
  LAYERED_MIP_EXPERIMENTAL: layered,
  AM_TEST: amTest,
  FM_TEST: fmTest,
  DELAY_IMPULSE_TEST: delayImpulse,
  COMB_IMPULSE_TEST: combImpulse,
  STEREO_SWEEP_TEST: stereoSweep,
});

export const AUDIO_FIXTURE_IDS = Object.freeze(Object.keys(AUDIO_ACCEPTANCE_FIXTURES));

export function renderFixture(fixtureId, options = {}) {
  const recipe = AUDIO_ACCEPTANCE_FIXTURES[fixtureId];
  if (!recipe) throw new Error(`Unknown audio acceptance fixture: ${fixtureId}`);
  const targetFrames = options.targetFrames === undefined ? recipe.targetFrames : Number(options.targetFrames);
  return renderOffline(recipe, { targetFrames, sampleRate: options.sampleRate ?? recipe.sampleRate });
}

export function fixtureReference(fixtureId, options = {}) {
  const rendered = renderFixture(fixtureId, options);
  return {
    fixtureId,
    recipeId: rendered.recipe.recipeId,
    recipeVersion: rendered.recipe.version,
    sampleRate: rendered.recipe.sampleRate,
    frames: rendered.frames,
    configFingerprint: rendered.configFingerprint,
    pcmDigest: rendered.digest,
    firstSamples: Array.from({ length: Math.min(16, rendered.frames) }, (_, index) => ({ left: rendered.left[index], right: rendered.right[index] })),
    peak: Math.max(rendered.telemetry.peaks.left, rendered.telemetry.peaks.right),
    clipping: rendered.telemetry.clipping,
  };
}

export function fixturePcmDigest(fixtureId, targetFrames) {
  const rendered = renderFixture(fixtureId, { targetFrames });
  return pcmDigest(rendered.left, rendered.right, rendered.recipe.sampleRate, rendered.frames);
}
