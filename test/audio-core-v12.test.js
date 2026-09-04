import test from "node:test";
import assert from "node:assert/strict";
import {
  AudioEngine,
  BUILTIN_RECIPES,
  EXPERIMENTAL_RECIPES,
  PCM_CANONICAL_FORMAT,
  PCM_DIGEST_VERSION,
  PcmStreamHasher,
  SHA256,
  canonical,
  normalizeRecipe,
  pcmCanonicalBytes,
  pcmDigest,
  renderOffline,
  sha256Hex,
  validateEffectiveRecipe,
} from "../public/audio-core.js";
import {
  PRESETS,
  quickRecipe,
  renderWav,
  validateRecipe,
  phasedPinkSample,
} from "../src/audio.js";

const SAMPLE_RATE = 44100;

function completeRecipe(overrides = {}) {
  const base = {
    recipeId: "TEST-COMPLETE",
    recipeVersion: 1,
    name: "Complete deterministic fixture",
    provenance: "DETERMINISTIC_TEST_FIXTURE",
    architecture: "LAYERED_STEREO_DSP",
    synthesisMode: "STANDARD",
    sampleRate: SAMPLE_RATE,
    channels: 2,
    carriers: [{
      id: "primary",
      leftHz: 394,
      rightHz: 398,
      gain: { left: 0.2, right: 0.2 },
      phase: { left: 0, right: 0 },
      waveform: "sine",
      am: null,
      fm: null,
    }],
    monauralLayers: [],
    septon: [],
    binauralRelationships: [{ type: "explicit_pair", leftHz: 394, rightHz: 398, beatHz: 4 }],
    envelope: { attackSeconds: 0, decaySeconds: 0, sustain: 1, releaseSeconds: 0 },
    noise: null,
    delay: null,
    comb: null,
    lowFrequencySweep: null,
    cues: [],
    voiceReferences: [],
    masterGain: 0.8,
    headroomDb: -3,
    rampSeconds: 16 / SAMPLE_RATE,
    durationMode: "live",
    metadata: { fixture: true },
  };
  return { ...base, ...overrides };
}

function component(overrides = {}) {
  return {
    id: "component",
    leftHz: 200,
    rightHz: 204,
    gain: { left: 0.08, right: 0.07 },
    phase: { left: 0.1, right: 0.2 },
    waveform: "sine",
    am: null,
    fm: null,
    ...overrides,
  };
}

function renderFinite(recipe, targetFrames = 1024) {
  return renderOffline(recipe, { targetFrames });
}

function concatenate(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

test("required shared-core exports and canonical PCM version are stable", () => {
  assert.equal(PCM_DIGEST_VERSION, "MIP_PCM_SHA256_V1");
  assert.equal(PCM_CANONICAL_FORMAT.headerBytes, 32);
  assert.equal(PCM_CANONICAL_FORMAT.body, "PCM16LE_INTERLEAVED_LR");
  for (const name of ["A-U396-4", "A-P100-104", "A-SHAM-0"])
    assert.ok(BUILTIN_RECIPES[name]);
});

test("pure incremental SHA-256 matches known vectors and arbitrary partitions", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const hash = new SHA256().update("a").update("b").update("c");
  assert.equal(hash.digest(), sha256Hex("abc"));
});

test("MIP PCM bytes contain the fixed header, interleaved PCM16LE, and uint64 trailer", () => {
  const left = new Float32Array([0, 1, -1]);
  const right = new Float32Array([0.5, -0.5, 0]);
  const bytes = pcmCanonicalBytes(left, right, 44100);
  assert.equal(bytes.length, 32 + 12 + 8);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 16)), "MIPPCM-SHA256-V1");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(16, true), 44100);
  assert.equal(view.getUint16(20, true), 2);
  assert.equal(view.getUint16(22, true), 16);
  assert.equal(view.getUint32(24, true), 4);
  assert.deepEqual([view.getInt16(32, true), view.getInt16(34, true)], [0, 16384]);
  assert.equal(view.getUint32(bytes.length - 8, true), 3);
  assert.equal(view.getUint32(bytes.length - 4, true), 0);
});

test("known canonical PCM stream digest is reproducible incrementally", () => {
  const left = new Float32Array([0, 0.25, -0.25, 1]);
  const right = new Float32Array([0, -0.5, 0.5, -1]);
  const direct = pcmDigest({ left, right, sampleRate: 48000 });
  const stream = new PcmStreamHasher(48000);
  for (let i = 0; i < left.length; i += 1) stream.updateFrame(left[i], right[i]);
  assert.equal(stream.finish(), direct);
  assert.equal(direct, "3c45cfafff5105288de80bd30ac559119c52df51d23b2ca6f9638d764b51e181");
});

test("stereo block hashing is byte-for-byte equivalent to per-frame hashing", () => {
  const lengths = [0, 1, 127, 128, 129, 4097];
  for (const length of lengths) {
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      left[i] = Math.sin(i * 0.071) * 0.93;
      right[i] = ((i * 37) % 101) / 100 - 0.5;
    }
    const perFrame = new PcmStreamHasher(SAMPLE_RATE);
    for (let i = 0; i < length; i += 1) perFrame.updateFrame(left[i], right[i]);
    const block = new PcmStreamHasher(SAMPLE_RATE);
    let bodyUpdates = 0;
    const update = block.hash.update.bind(block.hash);
    block.hash.update = (bytes) => {
      bodyUpdates += 1;
      return update(bytes);
    };
    for (let offset = 0; offset < length; offset += 128) {
      const end = Math.min(length, offset + 128);
      block.updateStereoBlock(left.subarray(offset, end), right.subarray(offset, end));
    }
    if (length === 0) block.updateStereoBlock(left, right, 0);
    assert.equal(block.frames, length);
    assert.equal(block.finish(length), perFrame.finish(length), `length ${length}`);
    assert.ok(bodyUpdates <= Math.ceil(length / 128) + 1, `block update count for ${length}`);
  }
});

test("existing deterministic fixture PCM digests remain unchanged", () => {
  const expected = {
    "A-U396-4": "2805792803105de190cfe6daad9f9e33f09584c34a3ce67a5892985c85d4a0ea",
    "A-P100-104": "a294b6ef2eb0f1b7d3a7e568b12ec691b4fb6c5c1782ecde410ca41b267508cb",
    "A-SHAM-0": "6102a16105fffd13e91411fafeaac33f4e585f9517518dc195c830f85f0a2d60",
    "MIP_LAYERED_EXPERIMENTAL_V1": "489d589462f3444e7e204f3b6b504fad8684ff29a3b773165b7348d1d3124b86",
  };
  const recipes = { ...BUILTIN_RECIPES, ...EXPERIMENTAL_RECIPES };
  for (const [recipeId, digest] of Object.entries(expected)) {
    const rendered = renderFinite(recipes[recipeId], 2048);
    assert.equal(rendered.digest, digest, recipeId);
    const legacy = new PcmStreamHasher(rendered.recipe.sampleRate);
    for (let i = 0; i < rendered.frames; i += 1) legacy.updateFrame(rendered.left[i], rendered.right[i]);
    assert.equal(rendered.digest, legacy.finish(rendered.frames), `${recipeId} legacy digest`);
  }
});

test("canonical configuration serialization is key-order independent", () => {
  assert.equal(canonical({ z: 1, a: { y: 2, x: 3 } }), canonical({ a: { x: 3, y: 2 }, z: 1 }));
  assert.equal(sha256Hex({ b: 2, a: 1 }), sha256Hex({ a: 1, b: 2 }));
});

test("formal normalization rejects missing material fields without frequency fallback", () => {
  assert.throws(() => normalizeRecipe({ recipeId: "INCOMPLETE", recipeVersion: 1, sampleRate: SAMPLE_RATE }), /name is required/);
  const missingCarrier = completeRecipe({ carriers: undefined, binauralRelationships: [] });
  assert.throws(() => normalizeRecipe(missingCarrier), /at least one carrier/);
  const missingPhase = completeRecipe({ carriers: [{ ...component(), phase: undefined }] });
  assert.throws(() => normalizeRecipe(missingPhase), /phase is required/);
});

test("development fixture mode is explicit and is the only mode with defaults", () => {
  const recipe = normalizeRecipe({ recipeId: "DEV-ONLY", developmentFixture: true, durationMode: "live" });
  assert.equal(recipe.developmentFixture, true);
  assert.deepEqual([recipe.leftHz, recipe.rightHz], [440, 440]);
  assert.equal(recipe.sampleRate, 44100);
});

test("voice asset references are validated and preserved without asset invention", () => {
  const refs = [{ assetId: "voice:existing:1", offsetFrames: 4410, gain: 0.2 }];
  const recipe = normalizeRecipe(completeRecipe({ voiceReferences: refs }));
  assert.deepEqual(recipe.voiceReferences, refs);
  assert.throws(() => normalizeRecipe(completeRecipe({ voiceReferences: [{ gain: 0.2 }] })), /requires an existing/);
});

test("built-in presets preserve the three authoritative channel pairs", () => {
  assert.deepEqual([PRESETS["A-U396-4"].leftHz, PRESETS["A-U396-4"].rightHz], [394, 398]);
  assert.deepEqual([PRESETS["A-P100-104"].leftHz, PRESETS["A-P100-104"].rightHz], [100, 104]);
  assert.deepEqual([PRESETS["A-SHAM-0"].leftHz, PRESETS["A-SHAM-0"].rightHz], [396, 396]);
  for (const preset of Object.values(BUILTIN_RECIPES)) assert.equal(validateEffectiveRecipe(preset).valid, true);
});

test("quick recipe is complete, centered, strict-valid, and uses the shared renderer", () => {
  const recipe = quickRecipe(396, 4);
  assert.deepEqual([recipe.leftHz, recipe.rightHz], [394, 398]);
  assert.equal(validateRecipe(recipe).valid, true);
  const wav = renderWav(recipe, 0.01);
  assert.equal(wav.manifest.audioDigest, wav.hashes.pcm);
  assert.equal(wav.manifest.configFingerprint.length, 64);
});

test("offline rendering is bit-partition invariant", () => {
  const frames = 2048;
  const plan = normalizeRecipe({ ...completeRecipe(), durationMode: "finite", targetFrames: frames });
  const whole = new AudioEngine(plan).start();
  const wholeLeft = new Float32Array(frames);
  const wholeRight = new Float32Array(frames);
  whole.renderInto(wholeLeft, wholeRight);

  const split = new AudioEngine(plan).start();
  const leftParts = [];
  const rightParts = [];
  for (const size of [1, 31, 128, 7, 511, 1370]) {
    const left = new Float32Array(size);
    const right = new Float32Array(size);
    split.renderInto(left, right);
    leftParts.push(left);
    rightParts.push(right);
  }
  assert.deepEqual(concatenate(leftParts), wholeLeft);
  assert.deepEqual(concatenate(rightParts), wholeRight);
  assert.equal(split.finalize(), whole.finalize());
});

test("stereo oscillators maintain independent phase and frequency", () => {
  const recipe = completeRecipe({
    carriers: [component({ leftHz: 300, rightHz: 500, gain: 0.3, phase: { left: 0, right: Math.PI / 2 } })],
  });
  const engine = new AudioEngine(recipe).start();
  const left = new Float32Array(32);
  const right = new Float32Array(32);
  engine.renderInto(left, right);
  assert.equal(left[0], 0);
  assert.notEqual(right[0], 0);
  assert.notEqual(engine.components[0].leftPhase, engine.components[0].rightPhase);
});

test("phase accumulators remain wrapped after a long simulated run", () => {
  const engine = new AudioEngine(BUILTIN_RECIPES["A-U396-4"]).start();
  const left = new Float32Array(1024);
  const right = new Float32Array(1024);
  for (let i = 0; i < 512; i += 1) engine.renderInto(left, right);
  for (const state of engine.components) {
    assert.ok(state.leftPhase >= 0 && state.leftPhase < Math.PI * 2);
    assert.ok(state.rightPhase >= 0 && state.rightPhase < Math.PI * 2);
  }
  assert.equal(engine.frame, 524288);
});

test("multi-carrier, monaural, binaural, and Septon layers all affect output", () => {
  const layered = completeRecipe({
    carriers: [component({ id: "c1", leftHz: 394, rightHz: 398, gain: 0.12 }), component({ id: "c2", leftHz: 200, rightHz: 204, gain: 0.05 })],
    monauralLayers: [component({ id: "m1", leftHz: 90, rightHz: 90, gain: 0.03 })],
    septon: [component({ id: "s1", leftHz: 100, rightHz: 101.5, gain: 0.02 }), component({ id: "s2", leftHz: 300, rightHz: 304, gain: 0.02 })],
    binauralRelationships: [{ type: "explicit_pair", leftHz: 394, rightHz: 398, beatHz: 4 }],
  });
  const a = renderFinite(layered, 1024);
  const b = renderFinite(completeRecipe(), 1024);
  assert.notEqual(a.digest, b.digest);
  assert.equal(a.recipe.carriers.length, 2);
  assert.equal(a.recipe.monauralLayers.length, 1);
  assert.equal(a.recipe.septon.length, 2);
});

test("per-component gain and phase are independently effective", () => {
  const a = renderFinite(completeRecipe({ carriers: [component({ phase: { left: 0, right: 0 }, gain: { left: 0.2, right: 0.1 } })] }), 512);
  const b = renderFinite(completeRecipe({ carriers: [component({ phase: { left: 0.5, right: 1 }, gain: { left: 0.1, right: 0.2 } })] }), 512);
  assert.notEqual(a.digest, b.digest);
  assert.notDeepEqual(a.left, a.right);
});

test("ADSR envelope changes the deterministic stream", () => {
  const plain = renderFinite(completeRecipe(), 2048);
  const shaped = renderFinite(completeRecipe({ envelope: { attackSeconds: 0.01, decaySeconds: 0.01, sustain: 0.4, releaseSeconds: 0.01 } }), 2048);
  assert.notEqual(plain.digest, shaped.digest);
  assert.ok(Math.abs(shaped.left[10]) < Math.abs(plain.left[10]));
});

test("AM and FM maintain independent state and alter output", () => {
  const modulated = completeRecipe({
    carriers: [component({
      am: { rateHz: 7, depth: 0.5, offset: 0.5, phase: { left: 0, right: Math.PI / 2 } },
      fm: { rateHz: 3, depthHz: 12, phase: { left: 0.2, right: 0.7 } },
    })],
  });
  const a = renderFinite(modulated, 2048);
  const b = renderFinite(completeRecipe({ carriers: [component()] }), 2048);
  assert.notEqual(a.digest, b.digest);
  assert.notEqual(a.engine.components[0].leftAmPhase, a.engine.components[0].rightAmPhase);
  assert.notEqual(a.engine.components[0].leftFmPhase, a.engine.components[0].rightFmPhase);
});

test("seeded white, pink, and red noise are deterministic and distinct", () => {
  const renderNoise = (algorithm, alpha) => renderFinite(completeRecipe({
    carriers: [component({ gain: 0 })],
    noise: { algorithm, algorithmVersion: 1, seed: 42, gain: 0.2, alpha },
  }), 2048);
  for (const [algorithm, alpha] of [["WHITE_NOISE", 0], ["PINK_NOISE", 0.65], ["RED_NOISE", 0.985]]) {
    const a = renderNoise(algorithm, alpha);
    const b = renderNoise(algorithm, alpha);
    assert.equal(a.digest, b.digest);
  }
  assert.notEqual(renderNoise("WHITE_NOISE", 0).digest, renderNoise("PINK_NOISE", 0.65).digest);
  assert.notEqual(renderNoise("PINK_NOISE", 0.65).digest, renderNoise("RED_NOISE", 0.985).digest);
});

test("patent phased-pink uses deterministic independent stereo delay sweeps", () => {
  const recipe = completeRecipe({
    synthesisMode: "PHASED_PINK_PATENT_5356368",
    mode: "PHASED_PINK_PATENT_5356368",
    carriers: [component({ gain: 0 })],
    noise: {
      algorithm: "PHASED_PINK_PATENT_5356368",
      algorithmVersion: 1,
      seed: 5356368,
      gain: 0.2,
      alpha: 0.65,
      minDelaySamples: 4,
      maxDelaySamples: 30,
      sweepHz: 0.125,
      leftSweepPhase: 0,
      rightSweepPhase: Math.PI / 2,
      combMix: 0.5,
    },
  });
  const a = renderFinite(recipe, 4096);
  const b = renderFinite(recipe, 4096);
  assert.equal(a.digest, b.digest);
  assert.notDeepEqual(a.left, a.right);
  assert.notEqual(a.engine.noiseState.leftSweepPhase, a.engine.noiseState.rightSweepPhase);
  assert.equal(phasedPinkSample(100, 42), phasedPinkSample(100, 42));
});

test("delay and comb each maintain state and change the stream", () => {
  const base = renderFinite(completeRecipe(), 1024);
  const delayed = renderFinite(completeRecipe({ delay: { delaySamples: 17.5, mix: 0.4, feedback: 0.2 } }), 1024);
  const combed = renderFinite(completeRecipe({ comb: { delaySamples: 23, mix: 0.5, feedback: 0.6 } }), 1024);
  const both = renderFinite(completeRecipe({ delay: { delaySamples: 17.5, mix: 0.4, feedback: 0.2 }, comb: { delaySamples: 23, mix: 0.5, feedback: 0.6 } }), 1024);
  assert.notEqual(base.digest, delayed.digest);
  assert.notEqual(base.digest, combed.digest);
  assert.notEqual(delayed.digest, both.digest);
  assert.notEqual(both.engine.effectState.delay, both.engine.effectState.comb);
});

test("low-frequency stereo sweep is phase-configurable", () => {
  const swept = renderFinite(completeRecipe({ lowFrequencySweep: { frequencyHz: 0.125, depth: 0.3, offset: 0.7, leftPhase: 0, rightPhase: Math.PI / 2 } }), 2048);
  const plain = renderFinite(completeRecipe(), 2048);
  assert.notEqual(swept.digest, plain.digest);
  assert.notDeepEqual(swept.left, swept.right);
});

test("scheduled cues fire on exact generated frames and are telemetered", () => {
  const recipe = completeRecipe({
    carriers: [component({ gain: 0 })],
    cues: [{ id: "return", startFrame: 32, durationFrames: 16, leftHz: 600, rightHz: 700, gain: { left: 0.2, right: 0.2 }, phase: { left: Math.PI / 2, right: Math.PI / 2 }, waveform: "sine" }],
  });
  const rendered = renderFinite(recipe, 128);
  assert.equal(rendered.telemetry.cues, 1);
  assert.deepEqual(rendered.telemetry.cueEvents, [{ id: "return", scheduledFrame: 32, actualFrame: 32 }]);
  assert.ok(rendered.left.slice(0, 32).every((sample) => sample === 0));
  assert.ok(rendered.left.slice(32, 48).some((sample) => sample !== 0));
});

test("pause freezes oscillator/noise/frame state and resume continues it", () => {
  const engine = new AudioEngine(completeRecipe({ noise: { algorithm: "PINK_NOISE", algorithmVersion: 1, seed: 99, gain: 0.02, alpha: 0.65 } })).start();
  engine.renderInto(new Float32Array(64), new Float32Array(64));
  engine.pause();
  engine.renderInto(new Float32Array(16), new Float32Array(16));
  assert.equal(engine.state, "paused");
  const frozen = engine.snapshot();
  const silentLeft = new Float32Array(128);
  const silentRight = new Float32Array(128);
  engine.renderInto(silentLeft, silentRight);
  assert.equal(engine.frame, frozen.frame);
  assert.equal(engine.totalFrames, frozen.totalFrames);
  assert.deepEqual(engine.components.map((state) => [state.leftPhase, state.rightPhase]), frozen.components.map((state) => [state.leftPhase, state.rightPhase]));
  assert.equal(engine.noiseState.lfsr, frozen.noiseState.lfsr);
  assert.ok(silentLeft.every((sample) => sample === 0));
  engine.resume();
  engine.renderInto(new Float32Array(16), new Float32Array(16));
  assert.equal(engine.state, "running");
  assert.equal(engine.frame, frozen.frame + 16);
});

test("start, pause, resume, stop, and master gain use measurable de-click ramps", () => {
  const engine = new AudioEngine(completeRecipe()).start();
  assert.equal(engine.transportRemaining, 16);
  engine.renderInto(new Float32Array(8), new Float32Array(8));
  assert.ok(engine.transportGain > 0 && engine.transportGain < 1);
  engine.setMasterGain(0.2);
  const gainBefore = engine.masterGain;
  engine.renderInto(new Float32Array(1), new Float32Array(1));
  assert.ok(engine.masterGain < gainBefore && engine.masterGain > 0.2);
  engine.renderInto(new Float32Array(15), new Float32Array(15));
  assert.equal(engine.masterGain, 0.2);
  engine.pause();
  assert.equal(engine.state, "pausing");
  engine.renderInto(new Float32Array(16), new Float32Array(16));
  assert.equal(engine.state, "paused");
  engine.resume();
  engine.renderInto(new Float32Array(16), new Float32Array(16));
  assert.equal(engine.state, "running");
  engine.stop();
  engine.renderInto(new Float32Array(16), new Float32Array(16));
  assert.equal(engine.state, "stopped");
  assert.equal(engine.transportGain, 0);
  assert.equal(engine.finalize().length, 64);
});

test("live preview remains indefinite beyond one-hour frame semantics", () => {
  const engine = new AudioEngine(BUILTIN_RECIPES["A-U396-4"]).start();
  engine.frame = SAMPLE_RATE * 3601;
  engine.renderInto(new Float32Array(8), new Float32Array(8));
  assert.equal(engine.recipe.execution.mode, "live");
  assert.equal(engine.recipe.targetFrames, null);
  assert.equal(engine.state, "running");
  assert.equal(engine.frame, SAMPLE_RATE * 3601 + 8);
});

test("live A-U396-4 stays continuous across 180 seconds of 128-frame blocks", { timeout: 30000 }, () => {
  const engine = new AudioEngine(BUILTIN_RECIPES["A-U396-4"]).start();
  const left = new Float32Array(128);
  const right = new Float32Array(128);
  const blocks = Math.ceil((180 * SAMPLE_RATE) / left.length);
  engine.renderInto(left, right);
  const firstBlock = left.slice();
  const phaseAfterFirstBlock = engine.components.map((state) => [state.leftPhase, state.rightPhase]);
  engine.renderInto(left, right);
  assert.notEqual(left[0], firstBlock[0], "carrier phase must continue into the next block");
  assert.notDeepEqual(engine.components.map((state) => [state.leftPhase, state.rightPhase]), phaseAfterFirstBlock);
  for (let block = 2; block < blocks; block += 1) engine.renderInto(left, right);
  assert.equal(engine.state, "running");
  assert.equal(engine.recipe.execution.mode, "live");
  assert.equal(engine.recipe.targetFrames, null);
  assert.equal(engine.frame, blocks * left.length);
  assert.equal(engine.totalFrames, engine.frame);
  assert.equal(engine.cuesTriggered, 0);
  assert.equal(engine.clipping, 0);
  engine.stop();
  while (engine.state !== "stopped") engine.renderInto(left, right);
  assert.equal(engine.finalize().length, 64);
});

test("finite formal mode stops at exact targetFrames and hashes all ramps/master gain", () => {
  const a = renderFinite(completeRecipe({ masterGain: 0.8 }), 333);
  const b = renderFinite(completeRecipe({ masterGain: 0.4 }), 333);
  assert.equal(a.engine.frame, 333);
  assert.equal(a.engine.totalFrames, 333);
  assert.equal(a.engine.state, "stopped");
  assert.equal(a.left[0], 0);
  assert.equal(a.left[332], 0);
  assert.notEqual(a.digest, b.digest);
  assert.equal(a.digest, pcmDigest(a.left, a.right, SAMPLE_RATE));
});

test("telemetry records clipping, peaks, headroom, and continuity", () => {
  const hot = completeRecipe({
    carriers: [component({ id: "hot1", gain: 1, phase: Math.PI / 2 }), component({ id: "hot2", gain: 1, phase: Math.PI / 2 })],
    masterGain: 1,
    headroomDb: 0,
  });
  const rendered = renderFinite(hot, 128);
  assert.equal(rendered.telemetry.clipping, true);
  assert.ok(rendered.telemetry.clippingSamples > 0);
  assert.ok(rendered.telemetry.peaks.preClipLeft > 1);
  assert.equal(rendered.telemetry.peaks.left, 1);
  assert.deepEqual(rendered.telemetry.continuity, { ok: true, errors: 0 });
});

test("allocation-conscious renderInto reuses caller buffers and result object", () => {
  const engine = new AudioEngine(BUILTIN_RECIPES["A-SHAM-0"]).start();
  const left = new Float32Array(128);
  const right = new Float32Array(128);
  const first = engine.renderInto(left, right);
  const second = engine.renderInto(left, right);
  assert.equal(first, second);
  assert.equal(second.left, left);
  assert.equal(second.right, right);
  assert.equal(second.allocated, false);
});

test("material recipe changes alter both config fingerprint and PCM digest", () => {
  const a = renderFinite(completeRecipe(), 512);
  const b = renderFinite(completeRecipe({ carriers: [component({ leftHz: 395, rightHz: 399 })] }), 512);
  assert.notEqual(a.configFingerprint, b.configFingerprint);
  assert.notEqual(a.digest, b.digest);
});

test("built-in config fingerprints are deterministic fixtures", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(BUILTIN_RECIPES).map(([id, recipe]) => [id, recipe.configFingerprint])),
    {
      "A-U396-4": "ffe0c15eeacb7af02baf2bc8eca2c19ecdd9ef379edbae502c9f600d4ac663c0",
      "A-P100-104": "efeab7c5ddecd4825a7a6574eb036ca6d5d10d27ee9c5d84af4348a0c5bf30d2",
      "A-SHAM-0": "fa71bb942137a512bd40df3132defb53ba35a352b68d645a1e314645477c969e",
    },
  );
});
