import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEDULER_MODES,
  SessionScheduler,
  createSchedulePlan,
} from "../src/main/sessions/session-scheduler.js";
import { PowerManager } from "../src/main/power/power-manager.js";

class FakeClock {
  constructor(utcMs = 1_700_000_000_000) {
    this.utc = utcMs;
    this.mono = 0n;
  }
  monotonicNs() { return this.mono; }
  utcMs() { return this.utc; }
  advance(ms, wallMs = ms) { this.mono += BigInt(Math.round(ms * 1e6)); this.utc += wallMs; }
}

class FakeTimer {
  constructor(clock) { this.clock = clock; this.queue = []; this.id = 0; }
  setTimeout(callback, delay) {
    const handle = { id: ++this.id, due: this.clock.mono + BigInt(Math.max(0, Math.ceil(delay)) * 1e6), callback, cancelled: false };
    this.queue.push(handle);
    return handle;
  }
  clearTimeout(handle) { if (handle) handle.cancelled = true; }
  async runNext({ advance = true, wallMs } = {}) {
    const pending = this.queue.filter((item) => !item.cancelled).sort((a, b) => a.due < b.due ? -1 : 1);
    if (!pending.length) return false;
    const item = pending[0];
    this.queue = this.queue.filter((entry) => entry !== item);
    if (advance) {
      const delta = Number(item.due - this.clock.mono) / 1e6;
      if (delta > 0) this.clock.advance(delta, wallMs === undefined ? delta : wallMs);
    }
    await item.callback();
    await new Promise((resolve) => setImmediate(resolve));
    return true;
  }
  async drain() { while (await this.runNext()) {} }
}

function streamConfig(mode, extra = {}) {
  return {
    mode,
    output: { preBlocks: 1, primaryBlocks: 2, postBlocks: 1, blockSize: 2, intervalMs: 10 },
    ...extra,
  };
}

test("plan counts are exact and asymmetric boundaries use named anchors", () => {
  const clock = new FakeClock();
  const plan = createSchedulePlan(streamConfig(SCHEDULER_MODES.IMMEDIATE_REQUEST), clock);
  assert.deepEqual(plan.counts, { blockSize: 2, preBlocks: 1, primaryBlocks: 2, postBlocks: 1, preCount: 2, primaryCount: 4, postCount: 2, totalCount: 8 });
  assert.equal(plan.outputs.filter((output) => output.region === "pre").length, 2);
  assert.equal(plan.outputs.filter((output) => output.region === "primary").length, 4);
  assert.equal(plan.outputs.filter((output) => output.region === "post").length, 2);
  assert.equal(plan.outputs[1].scheduledMonotonicNs, -10_000_000n);
  assert.equal(plan.outputs[2].scheduledMonotonicNs, 0n);
  assert.equal(plan.outputs[5].scheduledMonotonicNs, 30_000_000n);
  assert.equal(plan.anchors.PRE_START.monotonicNs, -20_000_000n);
  assert.equal(plan.anchors.PRIMARY_START.monotonicNs, 0n);
  assert.equal(plan.anchors.PRIMARY_END.monotonicNs, 40_000_000n);
  assert.equal(plan.anchors.POST_START.monotonicNs, 40_000_000n);
  assert.equal(plan.outputs.at(-1).scheduledMonotonicNs, 50_000_000n);
  assert.equal(plan.anchors.STREAM_END.monotonicNs, 60_000_000n);
});

test("interval derives from stream duration and not thirds", () => {
  const plan = createSchedulePlan({ mode: "IMMEDIATE_REQUEST", output: { preBlocks: 1, primaryBlocks: 1, postBlocks: 2, blockSize: 1, streamDurationMs: 80 } }, { monotonicNs: () => 0n, utcMs: () => 1000 });
  assert.equal(plan.totalCount, 4);
  assert.equal(plan.intervalMs, 20);
  assert.deepEqual(plan.outputs.map((output) => output.region), ["pre", "primary", "post", "post"]);
});

for (const mode of ["IMMEDIATE_REQUEST", "RELATIVE_DELAY", "ABSOLUTE_DATETIME", "NEXT_ELIGIBLE_OUTPUT", "CONTINUOUS_AROUND_REQUEST"]) {
  test(`real mode schedules ${mode} with fixed UTC correlation`, async () => {
    const clock = new FakeClock(1_700_000_000_000);
    const timer = new FakeTimer(clock);
    const values = [];
    const config = streamConfig(mode, mode === "RELATIVE_DELAY" ? { delayMs: 100 } : mode === "ABSOLUTE_DATETIME" ? { absoluteUtc: new Date(1_700_000_000_100).toISOString() } : mode === "NEXT_ELIGIBLE_OUTPUT" ? { nextEligibleDelayMs: 100 } : {});
    const scheduler = new SessionScheduler(config, { clock, timer, outputProvider: ({ sequence }) => { values.push(sequence); return `v${sequence}`; }, toleranceMs: 1_000 });
    await scheduler.start();
    await timer.drain();
    assert.equal(scheduler.status, "COMPLETE");
    assert.deepEqual(values, [0, 1, 2, 3, 4, 5, 6, 7]);
    const expectedRequestUtc = mode === "RELATIVE_DELAY" || mode === "ABSOLUTE_DATETIME" || mode === "NEXT_ELIGIBLE_OUTPUT"
      ? new Date(1_700_000_000_100).toISOString()
      : new Date(1_700_000_000_000).toISOString();
    assert.equal(scheduler.records[2].scheduledUtc, expectedRequestUtc);
    assert.equal(scheduler.records[2].scheduledMonotonicNs, scheduler.plan.anchors.REQUEST.monotonicNs);
    assert.ok(scheduler.fingerprint);
  });
}

test("pre-generated mode generates only at commitment and stays hidden", async () => {
  const clock = new FakeClock();
  const timer = new FakeTimer(clock);
  let calls = 0;
  const completed = [];
  const scheduler = new SessionScheduler(streamConfig("PREGENERATED_HIDDEN"), {
    clock, timer, outputProvider: ({ sequence }) => { calls += 1; return { sequence }; }, onComplete: (result) => completed.push(result),
  });
  assert.equal(calls, 0);
  const committed = await scheduler.commit();
  assert.equal(calls, 8);
  assert.equal(committed.hidden, true);
  assert.equal(scheduler.toRendererDTO().fingerprint, scheduler.fingerprint);
  assert.equal(scheduler.toRendererDTO().records, undefined);
  assert.equal(scheduler.getResult().records[0].value, undefined);
  assert.equal(completed.length, 1);
});

test("lateness is recorded and jumped-over outputs are not backfilled", async () => {
  const clock = new FakeClock();
  const timer = new FakeTimer(clock);
  const values = [];
  const scheduler = new SessionScheduler(streamConfig("IMMEDIATE_REQUEST"), {
    clock, timer, toleranceMs: 3, outputProvider: ({ sequence }) => { values.push(sequence); return sequence; },
  });
  await scheduler.start();
  await timer.runNext({ advance: false });
  clock.advance(100, 100);
  await timer.runNext({ advance: false });
  await timer.drain();
  assert.equal(scheduler.status, "COMPLETE");
  assert.deepEqual(values, [2]);
  assert.equal(scheduler.records.filter((record) => record.status === "MISSED").length, 7);
  assert.ok(scheduler.records[0].latenessMs >= 0);
});

test("missed output policy can abort and pause is an interruption, not a pause", async () => {
  const clock = new FakeClock();
  const timer = new FakeTimer(clock);
  const evidence = [];
  const scheduler = new SessionScheduler(streamConfig("IMMEDIATE_REQUEST"), { clock, timer, toleranceMs: 1, missedOutputPolicy: "ABORT", onEvidence: (event) => evidence.push(event) });
  await scheduler.start();
  clock.advance(100, 100);
  await timer.runNext({ advance: false });
  assert.equal(scheduler.status, "ABORTED");
  assert.ok(evidence.some((event) => event.type === "TIMING_DEVIATION"));

  const second = new SessionScheduler(streamConfig("IMMEDIATE_REQUEST"), { clock: new FakeClock(), timer: new FakeTimer(new FakeClock()) });
  await second.start();
  assert.equal(second.pause("test pause"), "INTERRUPTED");
});

test("monotonic and wall clock discontinuities become evidence", async () => {
  let mono = 0n;
  let utc = 1_700_000_000_000;
  const evidence = [];
  const clock = { monotonicNs: () => mono, utcMs: () => utc };
  const timer = { setTimeout: (callback) => { mono = 0n; utc += 10_000; return callback(); }, clearTimeout() {} };
  const scheduler = new SessionScheduler({ mode: "IMMEDIATE_REQUEST", output: { preBlocks: 0, primaryBlocks: 1, postBlocks: 0, blockSize: 1, intervalMs: 1 } }, { clock, timer, onEvidence: (event) => evidence.push(event) });
  await scheduler.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(evidence.some((event) => event.type === "CLOCK_DISCONTINUITY"));
});

test("power blocker and suspend/resume observations are injected", () => {
  const calls = [];
  const evidence = [];
  const manager = new PowerManager({ blocker: { start: (reason) => { calls.push(["start", reason]); return 42; }, stop: (id) => calls.push(["stop", id]) }, onEvidence: (event) => evidence.push(event) });
  manager.start();
  manager.observe("suspend", { source: "fake" });
  manager.observe("resume");
  manager.stop();
  assert.deepEqual(calls, [["start", "prevent-app-suspension"], ["stop", 42]]);
  assert.deepEqual(evidence.map((event) => event.type), ["POWER_BLOCKER_STARTED", "POWER_SUSPEND_OBSERVED", "POWER_RESUME_OBSERVED", "POWER_BLOCKER_STOPPED"]);
});
