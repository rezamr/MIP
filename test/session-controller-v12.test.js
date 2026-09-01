import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_STATES,
  SESSION_TRANSITIONS,
  SessionController,
  assertTransition,
  validatePreconditions,
  validateTransition,
} from "../src/main/sessions/session-controller.js";

test("controller graph accepts every declared legal edge", () => {
  for (const [from, destinations] of Object.entries(SESSION_TRANSITIONS)) {
    for (const to of destinations) assert.equal(assertTransition(from, to), to);
  }
});

test("controller rejects every state skip and unknown state", () => {
  const states = Object.values(SESSION_STATES);
  for (const from of states) {
    for (const to of states) {
      if (!SESSION_TRANSITIONS[from].includes(to))
        assert.throws(() => assertTransition(from, to), /Illegal|Unknown/);
    }
  }
  assert.throws(() => new SessionController("NO_SUCH_STATE"), /Unknown/);
});

test("transactional transition persists event and projection before memory mutation", async () => {
  const calls = [];
  const adapter = {
    transaction(callback) {
      calls.push("transaction:start");
      const result = callback();
      calls.push("transaction:end");
      return result;
    },
    appendEvent(event) {
      calls.push(["event", event.from, event.to]);
      return { eventId: "E1" };
    },
    updateProjection(projection) {
      calls.push(["projection", projection.state]);
      return { persisted: true };
    },
  };
  const controller = new SessionController("AUDIO_PREPARING", { adapter, sessionId: "S1" });
  const result = await controller.transitionTransactional("AUDIO_READY", { audioReady: true });
  assert.equal(controller.state, "AUDIO_READY");
  assert.equal(result.state, "AUDIO_READY");
  assert.deepEqual(calls, ["transaction:start", ["event", "AUDIO_PREPARING", "AUDIO_READY"], ["projection", "AUDIO_READY"], "transaction:end"]);
});

test("transaction rollback leaves state, version, and history unchanged", async () => {
  let projectionCalled = false;
  const adapter = {
    transaction(callback) {
      try {
        callback();
      } catch (error) {
        throw error;
      }
    },
    appendEvent() {
      throw new Error("append failed");
    },
    updateProjection() {
      projectionCalled = true;
    },
  };
  const controller = new SessionController("AUDIO_PREPARING", { adapter });
  await assert.rejects(controller.transitionTransactional("AUDIO_READY", { audioReady: true }), /append failed/);
  assert.equal(controller.state, "AUDIO_PREPARING");
  assert.equal(controller.version, 0);
  assert.deepEqual(controller.history, []);
  assert.equal(projectionCalled, false);
});

test("transactional preconditions reject without invoking the adapter", async () => {
  let invoked = false;
  const adapter = { transaction: () => { invoked = true; }, appendEvent() {}, updateProjection() {} };
  const controller = new SessionController("AUDIO_READY", { adapter });
  const validation = validateTransition("AUDIO_READY", "RUNNING", {});
  assert.equal(validation.valid, false);
  assert.equal(validatePreconditions("RUNNING", {}).valid, false);
  await assert.rejects(controller.transitionTransactional("RUNNING", {}), /memoryConfirmed|audioReady/);
  assert.equal(invoked, false);
});

test("legacy transition remains synchronous and graph-compatible", () => {
  const controller = new SessionController();
  for (const state of ["TARGET_ASSIGNED", "READY", "COMMITTED", "AUDIO_PREPARING", "AUDIO_READY", "RUNNING", "RETURNED", "RAW_REPORT_DRAFT", "RAW_REPORT_LOCKED", "REVEAL_ELIGIBLE", "REVEALED", "COMPLETE"])
    controller.transition(state);
  assert.equal(controller.state, "COMPLETE");
});
