import test from "node:test";
import assert from "node:assert/strict";
import { BUILTIN_RECIPES, normalizeRecipe, renderOffline } from "../public/audio-core.js";
import { protocolCues } from "../src/main/sessions/protocol-cues.js";

const timedProtocol = {
  stageMode: "TIMED_AUTOMATIC",
  cueMode: "TIMED_NONSEMANTIC",
  audibleStages: ["INDUCTION_START", "SETTLING_START", "REQUEST_START", "RELEASE_START", "NEUTRAL_OBSERVATION", "RETURN_CUE"],
  inductionSeconds: 5,
  settleSeconds: 5,
  requestSeconds: 10,
  releaseSeconds: 10,
  neutralSeconds: 10,
  returnSeconds: 5,
};

test("participant-paced cueMode NONE produces no fixed protocol cues", () => {
  assert.deepEqual(protocolCues({
    ...timedProtocol,
    stageMode: "PARTICIPANT_PACED",
    cueMode: "NONE",
    audibleStages: [],
  }, 44_100), []);
});

test("timed cue policy emits only declared audible stages with unique start frames", () => {
  const cues = protocolCues(timedProtocol, 44_100);
  assert.deepEqual(cues.map((cue) => cue.stageType), [
    "INDUCTION_START", "SETTLING_START", "REQUEST_START", "RELEASE_START", "NEUTRAL_OBSERVATION", "RETURN_CUE",
  ]);
  assert.equal(new Set(cues.map((cue) => cue.startFrame)).size, cues.length);
  assert.equal(cues.some((cue) => cue.stageType === "REQUEST_END" || cue.stageType === "POST_REQUEST"), false);
});

test("same-frame audible boundary collisions are rejected explicitly", () => {
  assert.throws(() => protocolCues({
    ...timedProtocol,
    audibleStages: ["REQUEST_END", "RELEASE_START"],
  }, 44_100), /protocol cue collision/);
  assert.throws(() => protocolCues({
    ...timedProtocol,
    audibleStages: ["POST_REQUEST", "RETURN_CUE"],
  }, 44_100), /protocol cue collision/);
});

test("participant-paced effective A-U396-4 keeps the pure PCM stream unchanged", () => {
  const base = BUILTIN_RECIPES["A-U396-4"];
  const participant = normalizeRecipe({ ...base, protocolCueVersion: null, protocolCues: [] });
  assert.equal(participant.protocolCueVersion, null);
  assert.deepEqual(participant.protocolCues, []);
  const frames = 4_096;
  const reference = renderOffline(base, { targetFrames: frames });
  const effective = renderOffline(participant, { targetFrames: frames });
  assert.equal(effective.digest, reference.digest);
  assert.equal(effective.recipe.leftHz, 394);
  assert.equal(effective.recipe.rightHz, 398);
  assert.equal(effective.recipe.protocolCues.length, 0);
});
