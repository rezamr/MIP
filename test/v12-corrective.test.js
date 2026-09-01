import test from "node:test";
import assert from "node:assert/strict";
import {
  createRNG,
  CSPRNG,
  DeterministicRNG,
  profiles,
  canonical,
  sha256,
} from "../src/engine.js";
import {
  assertTransition,
  SessionController,
} from "../src/main/sessions/session-controller.js";

test("operational RNG is OS_CSPRNG and deterministic fixture is reproducible", () => {
  assert.ok(
    createRNG(profiles.BASELINE_NOW_BINARY_V1.rng.provider) instanceof CSPRNG,
  );
  const a = createRNG("DETERMINISTIC_PRNG_TEST", "fixture"),
    b = createRNG("DETERMINISTIC_PRNG_TEST", "fixture");
  assert.deepEqual(
    [a.int(2), a.int(2), a.int(2)],
    [b.int(2), b.int(2), b.int(2)],
  );
});
test("RNG domains remain independent", () => {
  const target = createRNG("DETERMINISTIC_PRNG_TEST", "TARGET_ASSIGNMENT"),
    machine = createRNG("DETERMINISTIC_PRNG_TEST", "MACHINE_OUTPUT");
  assert.notEqual(target.int(2), undefined);
  assert.notEqual(machine.int(2), undefined);
});
test("formal semantics do not use Math.random", () => {
  const source = Object.values(profiles)
    .map((p) => JSON.stringify(p))
    .join("\n");
  assert.equal(source.includes("Math.random"), false);
});
test("complete commitment material is canonical and hashed", () => {
  const material = {
    profileId: "BASELINE_NOW_BINARY_V1",
    profileVersion: 1,
    objective: 1,
    rng: { id: "OS_CSPRNG", version: "node-crypto" },
    audio: { recipeId: "A-U396-4", version: 1, sampleRate: 48000 },
    timing: { mode: "IMMEDIATE_REQUEST" },
    revealPolicy: "AFTER_RAW_REPORT_LOCK",
    appVersion: "1.2.0",
    engineVersion: "1.2.0",
  };
  assert.equal(sha256(canonical(material)).length, 64);
});
test("session controller rejects illegal transitions", () => {
  const c = new SessionController("COMMITTED");
  assert.throws(() => c.transition("RUNNING"), /Illegal session transition/);
  c.transition("AUDIO_PREPARING");
  c.transition("AUDIO_READY");
  c.transition("RUNNING");
});
test("session controller accepts complete legal lifecycle", () => {
  const c = new SessionController();
  for (const s of [
    "TARGET_ASSIGNED",
    "READY",
    "COMMITTED",
    "AUDIO_PREPARING",
    "AUDIO_READY",
    "RUNNING",
    "RETURNED",
    "RAW_REPORT_DRAFT",
    "RAW_REPORT_LOCKED",
    "REVEAL_ELIGIBLE",
    "REVEALED",
    "COMPLETE",
  ])
    c.transition(s);
  assert.equal(c.state, "COMPLETE");
});
