import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AudioEngine,
  BUILTIN_RECIPES,
  EXPERIMENTAL_RECIPES,
  LFSR_SEQUENCE_PERIOD,
  activeLayers,
  lfsrNextState,
  lfsrPeriod,
  normalizeRecipe,
  renderOffline,
  summarizeProvenance,
  validateRecipeProvenance,
} from "../public/audio-core.js";
import { AUDIO_ACCEPTANCE_FIXTURES, AUDIO_FIXTURE_IDS, fixtureReference } from "../src/audio-fixtures.js";
import { MipDatabase } from "../src/main/database/db.js";
import { FIELD_HELP, NAVIGATION_PAGE_IDS, PAGE_HELP } from "../renderer/help-registry.js";
import { PAGE_DEFINITIONS, pageTitle } from "../renderer/pages/index.js";

const fixtureReferencePath = path.resolve("engineering", "AUDIO_REFERENCE_FIXTURES_V1.json");

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mip-audio-provenance-v12-"));
}

function closeAndRemove(db, root) {
  db?.close();
  fs.rmSync(root, { recursive: true, force: true });
}

test("named acceptance fixtures are complete, deterministic, and reference-backed", () => {
  const reference = JSON.parse(fs.readFileSync(fixtureReferencePath, "utf8"));
  assert.equal(reference.schemaVersion, "AUDIO_ENGINEERING_REFERENCE_V1");
  assert.equal(reference.algorithmVersion, "mip-audio-worklet-2.0");
  assert.deepEqual(AUDIO_FIXTURE_IDS, Object.keys(reference.fixtures));
  for (const fixtureId of AUDIO_FIXTURE_IDS) {
    const recipe = AUDIO_ACCEPTANCE_FIXTURES[fixtureId];
    const expected = reference.fixtures[fixtureId];
    const actual = fixtureReference(fixtureId, { targetFrames: reference.targetFrames });
    assert.equal(recipe.recipeId, fixtureId);
    assert.equal(recipe.execution.mode, "finite");
    assert.equal(recipe.targetFrames, reference.targetFrames);
    assert.equal(actual.configFingerprint, expected.configFingerprint, fixtureId);
    assert.equal(actual.pcmDigest, expected.pcmDigest, fixtureId);
    assert.equal(actual.frames, expected.frames, fixtureId);
    assert.ok(Math.abs(actual.peak - expected.peak) < 1e-12, fixtureId);
    assert.equal(actual.clipping, expected.clipping, fixtureId);
    for (const [index, sample] of expected.firstSamples.entries()) {
      assert.ok(Math.abs(actual.firstSamples[index].left - sample[0]) < 1e-12, `${fixtureId} left sample ${index}`);
      assert.ok(Math.abs(actual.firstSamples[index].right - sample[1]) < 1e-12, `${fixtureId} right sample ${index}`);
    }
  }
});

test("simple built-in presets remain pure component conditions", () => {
  const expected = {
    "A-U396-4": [394, 398],
    "A-P100-104": [100, 104],
    "A-SHAM-0": [396, 396],
  };
  for (const [id, [left, right]] of Object.entries(expected)) {
    const recipe = BUILTIN_RECIPES[id];
    assert.deepEqual([recipe.leftHz, recipe.rightHz], [left, right]);
    assert.equal(recipe.noise, null, id);
    assert.equal(recipe.delay, null, id);
    assert.equal(recipe.comb, null, id);
    assert.equal(recipe.lowFrequencySweep, null, id);
    assert.deepEqual(recipe.monauralLayers, [], id);
    assert.deepEqual(recipe.septon, [], id);
    assert.deepEqual(recipe.cues, [], id);
    assert.equal(recipe.protocolCues, undefined, id);
    assert.equal(recipe.carriers.length, 1, id);
    assert.equal(recipe.carriers[0].am, null, id);
    assert.equal(recipe.carriers[0].fm, null, id);
    const layers = activeLayers(recipe);
    assert.equal(layers.primaryCarrier, true, id);
    for (const key of ["additionalCarriers", "monauralLayers", "septon", "whitePinkRedNoise", "phasedPink", "am", "fm", "delay", "comb", "lowFrequencySweep", "envelope", "cues", "protocolCues", "voiceReferences"])
      assert.equal(layers[key], false, `${id} ${key}`);
  }
});

test("formal protocol cues are separately versioned and do not rewrite simple recipe layers", () => {
  const recipe = normalizeRecipe({
    ...BUILTIN_RECIPES["A-U396-4"],
    protocolCueVersion: "MIP_PROTOCOL_CUES_V1",
    protocolCues: [{ id: "request", startFrame: 32, durationFrames: 16, leftHz: 880, rightHz: 884, gain: 0.015, phase: { left: 0, right: 0 }, waveform: "sine" }],
  });
  assert.deepEqual(recipe.cues, []);
  assert.equal(recipe.protocolCueVersion, "MIP_PROTOCOL_CUES_V1");
  assert.equal(recipe.protocolCues.length, 1);
  assert.equal(activeLayers(recipe).cues, false);
  assert.equal(activeLayers(recipe).protocolCues, true);
  const rendered = renderOffline(recipe, { targetFrames: 128 });
  assert.equal(rendered.telemetry.cues, 1);
  assert.ok(rendered.left.slice(32, 48).some((sample) => sample !== 0));
});

test("pure 394/398 time-domain output follows the declared sine equation", () => {
  const sampleRate = 44_100;
  const recipe = normalizeRecipe({
    ...BUILTIN_RECIPES["A-U396-4"],
    recipeId: "PURE_VECTOR",
    id: "PURE_VECTOR",
    sampleRate,
    rampSeconds: 1 / sampleRate,
    masterGain: 1,
    headroomDb: 0,
  });
  const engine = new AudioEngine(recipe).start();
  const left = new Float32Array(32);
  const right = new Float32Array(32);
  engine.renderInto(left, right);
  for (let index = 0; index < left.length; index += 1) {
    const expectedLeft = Math.sin(2 * Math.PI * 394 * index / sampleRate) * 0.25;
    const expectedRight = Math.sin(2 * Math.PI * 398 * index / sampleRate) * 0.25;
    assert.ok(Math.abs(left[index] - expectedLeft) < 2e-7, `left sample ${index}`);
    assert.ok(Math.abs(right[index] - expectedRight) < 2e-7, `right sample ${index}`);
  }
});

test("gain stages change PCM amplitude without changing configured frequencies", () => {
  const low = renderOffline(BUILTIN_RECIPES["A-U396-4"], { targetFrames: 2048, masterGain: 0.4 });
  const high = renderOffline(BUILTIN_RECIPES["A-U396-4"], { targetFrames: 2048, masterGain: 0.8 });
  assert.notEqual(low.digest, high.digest);
  assert.deepEqual([low.recipe.leftHz, low.recipe.rightHz], [394, 398]);
  assert.deepEqual([high.recipe.leftHz, high.recipe.rightHz], [394, 398]);
  for (const index of [500, 700, 900, 1200]) {
    if (Math.abs(high.left[index]) > 1e-5) assert.ok(Math.abs(low.left[index] / high.left[index] - 0.5) < 1e-5, `left ratio ${index}`);
    if (Math.abs(high.right[index]) > 1e-5) assert.ok(Math.abs(low.right[index] / high.right[index] - 0.5) < 1e-5, `right ratio ${index}`);
  }
  assert.equal(low.recipe.carriers[0].gainLeft, high.recipe.carriers[0].gainLeft);
  assert.equal(low.recipe.carriers[0].gainRight, high.recipe.carriers[0].gainRight);
});

test("pure 394/398 stream has no configured/generated noise or DSP layers", () => {
  const rendered = renderOffline(AUDIO_ACCEPTANCE_FIXTURES.PURE_394_398, { targetFrames: 1024 });
  const recipe = rendered.recipe;
  assert.equal(recipe.noise, null);
  assert.equal(recipe.delay, null);
  assert.equal(recipe.comb, null);
  assert.equal(recipe.lowFrequencySweep, null);
  assert.equal(recipe.cues.length, 0);
  assert.equal(recipe.monauralLayers.length, 0);
  assert.equal(recipe.septon.length, 0);
  assert.ok(rendered.left.some((sample) => sample !== 0));
  assert.ok(rendered.right.some((sample) => sample !== 0));
});

test("LFSR period is maximal for supported non-zero seeds and zero is a lock", () => {
  for (const seed of [1, 2, 42, 0x1234, 0xffff]) assert.equal(lfsrPeriod(seed), LFSR_SEQUENCE_PERIOD, seed);
  // One complete cycle visiting every non-zero state proves that every
  // supported non-zero seed belongs to the same maximal cycle.
  const visited = new Set();
  let state = 1;
  for (let index = 0; index < LFSR_SEQUENCE_PERIOD; index += 1) {
    assert.notEqual(state, 0);
    visited.add(state);
    state = lfsrNextState(state);
  }
  assert.equal(visited.size, LFSR_SEQUENCE_PERIOD);
  assert.equal(state, 1);
  assert.equal(lfsrNextState(0), 0);
  assert.throws(() => lfsrPeriod(0), /non-zero|seed/i);
});

test("phased-pink, modulation, effects, and stereo sweep fixtures are deterministic and exercised", () => {
  const phasedA = renderOffline(AUDIO_ACCEPTANCE_FIXTURES.PHASED_PINK_NO_CARRIER, { targetFrames: 4096 });
  const phasedB = renderOffline(AUDIO_ACCEPTANCE_FIXTURES.PHASED_PINK_NO_CARRIER, { targetFrames: 4096 });
  assert.equal(phasedA.digest, phasedB.digest);
  assert.equal(phasedA.recipe.carriers[0].gainLeft, 0);
  assert.equal(phasedA.recipe.carriers[0].gainRight, 0);
  assert.equal(phasedA.recipe.noise.algorithm, "PHASED_PINK_PATENT_5356368");
  assert.ok(phasedA.left.some((sample) => sample !== 0));
  assert.notEqual(renderOffline(AUDIO_ACCEPTANCE_FIXTURES.AM_TEST, { targetFrames: 1024 }).digest, renderOffline(AUDIO_ACCEPTANCE_FIXTURES.PURE_394_398, { targetFrames: 1024 }).digest);
  assert.notEqual(renderOffline(AUDIO_ACCEPTANCE_FIXTURES.FM_TEST, { targetFrames: 1024 }).digest, renderOffline(AUDIO_ACCEPTANCE_FIXTURES.PURE_394_398, { targetFrames: 1024 }).digest);
  const delayed = renderOffline(AUDIO_ACCEPTANCE_FIXTURES.DELAY_IMPULSE_TEST, { targetFrames: 64 });
  const combed = renderOffline(AUDIO_ACCEPTANCE_FIXTURES.COMB_IMPULSE_TEST, { targetFrames: 64 });
  assert.equal(delayed.left.slice(0, 8).some((sample) => sample !== 0), false);
  assert.notEqual(delayed.digest, combed.digest);
  assert.ok(combed.left[0] !== 0);
  const swept = renderOffline(AUDIO_ACCEPTANCE_FIXTURES.STEREO_SWEEP_TEST, { targetFrames: 1024 });
  assert.notDeepEqual(Array.from(swept.left), Array.from(swept.right));
});

test("repository DTO preserves provenance, engineering verification, and layered resolution across restart", () => {
  const root = tempRoot();
  let db = new MipDatabase(root);
  try {
    const simple = db.recipes.getVersion("A-U396-4", 1);
    const layered = db.recipes.getVersion("MIP_LAYERED_EXPERIMENTAL_V1", 1);
    assert.ok(simple.parameterProvenance["carriers[0].leftHz"]);
    assert.equal(simple.engineeringVerification.fixtureId, "PURE_394_398");
    assert.equal(layered.recipeId, "MIP_LAYERED_EXPERIMENTAL_V1");
    assert.equal(layered.status, "ACTIVE");
    assert.equal(layered.incomplete, false);
    assert.equal(layered.engineeringVerification.fixtureId, "LAYERED_MIP_EXPERIMENTAL");
    assert.equal(layered.activeLayers.phasedPink, true);
    assert.equal(layered.activeLayers.delay, true);
    assert.equal(layered.activeLayers.comb, true);
    assert.equal(layered.activeLayers.protocolCues, false);
    const version = db.recipes.saveNewVersion({ ...simple, recipeId: "PROVENANCE_RESTART_FIXTURE", id: "PROVENANCE_RESTART_FIXTURE", name: "Provenance restart fixture" });
    assert.equal(version.version, 1);
    db.close();
    db = new MipDatabase(root);
    const reopened = db.recipes.getVersion("PROVENANCE_RESTART_FIXTURE", 1);
    assert.equal(reopened.parameterProvenance["carriers[0].leftHz"].provenanceClass, "MIP_OPERATIONAL_DEFINED");
    assert.equal(reopened.engineeringVerification.verificationVersion, "AUDIO_ENGINEERING_FIXTURES_V1");
  } finally {
    closeAndRemove(db, root);
  }
});

test("UNKNOWN_BLOCKED historical values cannot activate and mixed provenance cannot claim primary verification", () => {
  const root = tempRoot();
  const db = new MipDatabase(root);
  try {
    const base = db.recipes.getVersion("A-U396-4", 1);
    const unknown = { ...base, recipeId: "HISTORICAL_UNKNOWN_FIXTURE", id: "HISTORICAL_UNKNOWN_FIXTURE", provenance: "HISTORICAL_CANDIDATE", parameterProvenance: { "*": { provenanceClass: "UNKNOWN_BLOCKED" } } };
    assert.throws(() => db.recipes.saveNewVersion(unknown, { activate: true }), /incomplete|activate|validation/i);
    const draft = db.recipes.saveNewVersion(unknown, { allowIncomplete: true });
    assert.equal(draft.incomplete, true);
    const mixed = normalizeRecipe({ ...base, recipeId: "MIXED_PRIMARY_FIXTURE", id: "MIXED_PRIMARY_FIXTURE", provenance: "PRIMARY_SOURCE_VERIFIED", parameterProvenance: { "*": { provenanceClass: "PRIMARY_SOURCE_VERIFIED" }, "masterGain": { provenanceClass: "MIP_RECONSTRUCTION_PARAMETER", reconstructionReason: "Test-only mixed value", reconstructionVersion: "TEST" } } });
    const validation = validateRecipeProvenance(mixed);
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join("; "), /overstates mixed/i);
  } finally {
    closeAndRemove(db, root);
  }
});

test("owner listening result is separate from immutable recipe provenance", () => {
  const root = tempRoot();
  const db = new MipDatabase(root);
  try {
    const before = db.recipes.getVersion("A-U396-4", 1);
    const health = db.saveAudioHealth({ diagnosticId: "OWNER_RESULT_FIXTURE", recipeId: "A-U396-4", recipeVersion: 1, ownerResult: "Artifact heard", ownerNote: "Device hiss", integrityStatus: "VERIFIED", generatedFrames: 128 });
    assert.equal(health.ownerResult, "Artifact heard");
    assert.equal(health.details?.digest, null);
    const after = db.recipes.getVersion("A-U396-4", 1);
    assert.deepEqual(after.parameterProvenance, before.parameterProvenance);
    assert.equal(after.configFingerprint, before.configFingerprint);
  } finally {
    closeAndRemove(db, root);
  }
});

test("page help covers every navigation page and all field-help entries are rendered without hidden evidence", () => {
  const html = fs.readFileSync(path.resolve("public", "index.html"), "utf8");
  const navigationIds = [...html.matchAll(/data-page="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(navigationIds, NAVIGATION_PAGE_IDS);
  for (const pageId of NAVIGATION_PAGE_IDS) {
    assert.ok(PAGE_HELP[pageId], pageId);
    assert.equal(PAGE_HELP[pageId].title, pageTitle(pageId));
    assert.ok(PAGE_DEFINITIONS[pageId], pageId);
  }
  const appSource = fs.readFileSync(path.resolve("public", "app.js"), "utf8");
  assert.match(appSource, /Object\.entries\(FIELD_HELP\)/);
  for (const [fieldId, explanation] of Object.entries(FIELD_HELP)) {
    assert.ok(explanation.length > 20, fieldId);
    assert.match(appSource, /FIELD_HELP/);
  }
  const helpText = JSON.stringify(PAGE_HELP);
  for (const forbidden of ["hiddenObjective", "machineOutputFingerprint", "finalStreamDigest"]) assert.equal(helpText.includes(forbidden), false, forbidden);
  assert.match(PAGE_HELP.reports.boundary, /not prove|does not prove/i);
  assert.match(PAGE_HELP.reports.statuses, /reveal/i);
});

test("layered demo is repository-backed rather than renderer-hardcoded", () => {
  const source = fs.readFileSync(path.resolve("public", "app.js"), "utf8");
  assert.equal(source.includes("LAYERED_LIVE"), false);
  assert.match(source, /repository-backed layered demo/);
  assert.ok(EXPERIMENTAL_RECIPES.MIP_LAYERED_EXPERIMENTAL_V1);
  assert.equal(summarizeProvenance(EXPERIMENTAL_RECIPES.MIP_LAYERED_EXPERIMENTAL_V1).formalEligible, true);
});

test("offline and AudioWorklet paths are proven to share the normalized core", () => {
  const workletSource = fs.readFileSync(path.resolve("public", "mip-processor.js"), "utf8");
  assert.match(workletSource, /from ["']\.\/audio-core\.js["']/);
  assert.match(workletSource, /new AudioEngine\(recipe\)/);
  assert.match(workletSource, /normalizeRecipe\(message\.recipe/);
  const fixture = AUDIO_ACCEPTANCE_FIXTURES.PURE_394_398;
  const offline = renderOffline(fixture, { targetFrames: 1024 });
  const normalizedAgain = normalizeRecipe(fixture);
  const direct = new AudioEngine(normalizedAgain).start();
  const left = new Float32Array(1024);
  const right = new Float32Array(1024);
  direct.renderInto(left, right);
  assert.equal(direct.finalize(), offline.digest);
});
