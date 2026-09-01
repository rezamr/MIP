import test from "node:test";
import assert from "node:assert/strict";
import { ProtocolStageController } from "../src/main/sessions/protocol-stage-controller.js";

class FakeClock {
  constructor() { this.mono = 1_000_000_000n; this.utc = Date.parse("2026-09-01T00:00:00.000Z"); this.queue = []; this.nextId = 1; }
  monotonicNs = () => this.mono;
  utcMs = () => this.utc;
  timer = {
    setTimeout: (callback, delay) => {
      const item = { id: this.nextId++, target: this.mono + BigInt(Math.round(delay * 1e6)), callback, cancelled: false };
      this.queue.push(item);
      return item;
    },
    clearTimeout: (item) => { if (item) item.cancelled = true; },
  };
  advance(milliseconds) {
    this.mono += BigInt(Math.round(milliseconds * 1e6));
    this.utc += milliseconds;
    this.queue.sort((a, b) => a.target < b.target ? -1 : a.target > b.target ? 1 : 0);
    for (;;) {
      const item = this.queue.find((candidate) => !candidate.cancelled && candidate.target <= this.mono);
      if (!item) break;
      item.cancelled = true;
      item.callback();
    }
  }
}

test("authoritative protocol stages are anchored and complete after return cue plus audio finalization", () => {
  const clock = new FakeClock();
  const stages = [];
  const returnCues = [];
  const completions = [];
  const controller = new ProtocolStageController({
    inductionSeconds: 0.001,
    settleSeconds: 0.001,
    requestSeconds: 0.002,
    releaseSeconds: 0.001,
    neutralSeconds: 0.001,
    returnSeconds: 0.001,
    cueVersion: "TEST_CUES",
  }, {
    sessionId: "S0003",
    trialId: "S0003-T001",
    timer: clock.timer,
    monotonicNs: clock.monotonicNs,
    utcMs: clock.utcMs,
    onStage: (stage) => stages.push(stage),
    onReturnCue: (stage) => returnCues.push(stage),
    onComplete: (completion) => completions.push(completion),
  });
  controller.start({ name: "AUDIO_STARTED", monotonicNs: clock.mono, utcMs: clock.utc });
  clock.advance(8);
  assert.deepEqual(stages.map((stage) => stage.stageType), [
    "INDUCTION_START", "SETTLING_START", "REQUEST_START", "REQUEST_END",
    "RELEASE_START", "NEUTRAL_OBSERVATION", "POST_REQUEST", "RETURN_CUE",
  ]);
  assert.equal(returnCues.length, 1);
  assert.equal(controller.returnCueObserved, true);
  assert.equal(completions.length, 0);
  controller.notifyAudioFinalized({ processorSequence: 9 });
  assert.equal(completions.length, 1);
  assert.equal(completions[0].status, "COMPLETE");
  assert.equal(stages.at(-1).stageType, "AUDIO_FINALIZED");
  assert.equal(controller.toDTO().anchor.name, "AUDIO_STARTED");
});
