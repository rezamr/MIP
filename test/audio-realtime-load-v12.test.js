import test from "node:test";
import assert from "node:assert/strict";
import { FORMAL_TELEMETRY_INTERVAL_MS, FormalTelemetryThrottle } from "../renderer/audio/telemetry-throttle.js";

function fakeClock() {
  let current = 0;
  let nextId = 1;
  const timers = new Map();
  const clock = {
    now: () => current,
    setTimeoutFn: (callback, delay) => {
      const id = nextId++;
      timers.set(id, { at: current + Math.max(0, delay), callback });
      return id;
    },
    clearTimeoutFn: (id) => timers.delete(id),
    advance: (milliseconds) => {
      const target = current + milliseconds;
      while (true) {
        let next = null;
        for (const [id, timer] of timers) {
          if (timer.at > target) continue;
          if (!next || timer.at < next.timer.at) next = { id, timer };
        }
        if (!next) break;
        timers.delete(next.id);
        current = next.timer.at;
        next.timer.callback();
      }
      current = target;
    },
  };
  return clock;
}

function createThrottle(clock, forwarded) {
  return new FormalTelemetryThrottle((message) => forwarded.push({ at: clock.now(), message }), {
    intervalMs: FORMAL_TELEMETRY_INTERVAL_MS,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
  });
}

test("formal telemetry forwards at most one newest ordinary packet per second", () => {
  const clock = fakeClock();
  const forwarded = [];
  const throttle = createThrottle(clock, forwarded);
  for (let sequence = 0; sequence < 20; sequence += 1) {
    if (sequence > 0) clock.advance(100);
    throttle.accept({ type: "TELEMETRY", processorSequence: sequence });
  }
  clock.advance(200);
  assert.equal(forwarded.length, 3, "the 20 packets over two seconds collapse to one packet per interval");
  assert.deepEqual(forwarded.map(({ message }) => message.processorSequence), [0, 9, 19]);
  assert.equal(throttle.latest.processorSequence, 19);
  clock.advance(800);
  assert.equal(forwarded.length, 3);
  assert.equal(forwarded.at(-1).message.processorSequence, 19, "the newest pending packet is retained");
  assert.equal(throttle.pending, null);
});

test("processor errors and finalization bypass ordinary telemetry throttling", () => {
  const clock = fakeClock();
  const forwarded = [];
  const throttle = createThrottle(clock, forwarded);
  throttle.accept({ type: "TELEMETRY", processorSequence: 1 });
  throttle.accept({ type: "PROCESSOR_ERROR", error: "underrun" });
  throttle.accept({ type: "AUDIO_FINALIZED", totalFrames: 128 });
  assert.deepEqual(forwarded.map(({ message }) => message.type), ["TELEMETRY", "PROCESSOR_ERROR", "AUDIO_FINALIZED"]);
  assert.deepEqual(forwarded.map(({ at }) => at), [0, 0, 0]);
  assert.equal(throttle.immediateForwarded, 2);
  clock.advance(500);
  throttle.accept({ type: "TELEMETRY", processorSequence: 2 });
  assert.equal(throttle.flushIfDue(), false, "ordinary telemetry is not flushed before its interval");
  clock.advance(500);
  assert.equal(forwarded.at(-1).message.processorSequence, 2);
});
