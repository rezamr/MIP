import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUILTIN_RECIPES,
  PROCESSOR_VERSION,
  normalizeRecipe,
} from "../public/audio-core.js";
import { AudioController } from "../public/audio-controller.js";

const SAMPLE_RATE = 44100;
const QUANTUM = 128;
let RegisteredProcessor;

class MockPort {
  constructor() {
    this.onmessage = null;
    this.messages = [];
  }
  postMessage(message) {
    this.messages.push(message);
  }
}

class MockAudioWorkletProcessor {
  constructor() {
    this.port = new MockPort();
  }
}

globalThis.AudioWorkletProcessor = MockAudioWorkletProcessor;
globalThis.sampleRate = SAMPLE_RATE;
globalThis.currentFrame = 0;
globalThis.currentTime = 0;
globalThis.registerProcessor = (name, Processor) => {
  assert.equal(name, "mip-processor");
  RegisteredProcessor = Processor;
};

await import(`../public/mip-processor.js?contract=${Date.now()}`);

function command(processor, type, fields = {}) {
  processor.port.onmessage({ data: { type, ...fields } });
}

function quantum(processor) {
  const left = new Float32Array(QUANTUM);
  const right = new Float32Array(QUANTUM);
  processor.process([], [[left, right]]);
  globalThis.currentFrame += QUANTUM;
  globalThis.currentTime = globalThis.currentFrame / SAMPLE_RATE;
  return [left, right];
}

function messages(processor, type) {
  return processor.port.messages.filter((message) => message.type === type);
}

function resetClock() {
  globalThis.currentFrame = 0;
  globalThis.currentTime = 0;
}

test("processor source uses only the uppercase protocol and no ScriptProcessor", () => {
  const source = fs.readFileSync(new URL("../public/mip-processor.js", import.meta.url), "utf8");
  for (const commandName of ["CONFIGURE", "START", "PAUSE", "RESUME", "SET_MASTER_GAIN", "STOP"])
    assert.match(source, new RegExp(`case ["']${commandName}["']`));
  assert.doesNotMatch(source, /ScriptProcessorNode|createScriptProcessor|onaudioprocess/);
  assert.doesNotMatch(source, /postMessage\([^)]*(left|right|pcm)/i);
});

test("CONFIGURE rejects incomplete and lowercase commands", () => {
  resetClock();
  const processor = new RegisteredProcessor();
  command(processor, "configure", { recipe: BUILTIN_RECIPES["A-U396-4"] });
  assert.match(messages(processor, "PROCESSOR_ERROR")[0].error, /Unsupported processor command/);
  command(processor, "CONFIGURE", { recipe: { recipeId: "INCOMPLETE" } });
  assert.match(messages(processor, "PROCESSOR_ERROR").at(-1).error, /recipeVersion|sampleRate|name/);
});

test("PROCESSOR_READY is emitted only after one silent prewarm quantum with verified fields", () => {
  resetClock();
  const processor = new RegisteredProcessor();
  const recipe = BUILTIN_RECIPES["A-U396-4"];
  command(processor, "CONFIGURE", { recipe });
  assert.equal(messages(processor, "PROCESSOR_READY").length, 0);
  const [left, right] = quantum(processor);
  assert.ok(left.every((sample) => sample === 0));
  assert.ok(right.every((sample) => sample === 0));
  assert.deepEqual(messages(processor, "PROCESSOR_READY")[0], {
    type: "PROCESSOR_READY",
    processorVersion: PROCESSOR_VERSION,
    recipeId: recipe.recipeId,
    recipeVersion: recipe.version,
    sampleRate: recipe.sampleRate,
    configFingerprint: recipe.configFingerprint,
  });
});

test("CONFIGURE recomputes fingerprint and rejects sample-rate mismatch", () => {
  resetClock();
  const processor = new RegisteredProcessor();
  const tampered = { ...BUILTIN_RECIPES["A-U396-4"], masterGain: 0.4, configFingerprint: "0".repeat(64) };
  command(processor, "CONFIGURE", { recipe: tampered });
  quantum(processor);
  assert.notEqual(messages(processor, "PROCESSOR_READY")[0].configFingerprint, tampered.configFingerprint);

  const mismatch = new RegisteredProcessor();
  command(mismatch, "CONFIGURE", { recipe: { ...BUILTIN_RECIPES["A-U396-4"], sampleRate: 48000 } });
  assert.match(messages(mismatch, "PROCESSOR_ERROR")[0].error, /does not match AudioWorklet sampleRate/);
});

test("START acknowledges only after an actually generated frame", () => {
  resetClock();
  const processor = new RegisteredProcessor();
  command(processor, "CONFIGURE", { recipe: BUILTIN_RECIPES["A-U396-4"] });
  quantum(processor);
  command(processor, "START");
  assert.equal(messages(processor, "AUDIO_STARTED").length, 0);
  const [left, right] = quantum(processor);
  assert.ok(left.some((sample) => sample !== 0));
  assert.ok(right.some((sample) => sample !== 0));
  const started = messages(processor, "AUDIO_STARTED")[0];
  assert.ok(started.frame > 0);
  assert.equal(started.contextFrame, QUANTUM);
});

test("pause/resume preserve processor synthesis frame state through ramps", () => {
  resetClock();
  const processor = new RegisteredProcessor();
  command(processor, "CONFIGURE", { recipe: BUILTIN_RECIPES["A-U396-4"] });
  quantum(processor);
  command(processor, "START");
  quantum(processor);
  command(processor, "PAUSE");
  for (let i = 0; i < 4; i += 1) quantum(processor);
  assert.equal(messages(processor, "AUDIO_PAUSED").length, 1);
  const frozenFrame = processor.engine.frame;
  const [silentLeft] = quantum(processor);
  assert.equal(processor.engine.frame, frozenFrame);
  assert.ok(silentLeft.every((sample) => sample === 0));
  command(processor, "RESUME");
  for (let i = 0; i < 4; i += 1) quantum(processor);
  assert.equal(messages(processor, "AUDIO_RESUMED").length, 1);
  assert.ok(processor.engine.frame > frozenFrame);
});

test("SET_MASTER_GAIN and STOP acknowledge after measurable ramps", () => {
  resetClock();
  const processor = new RegisteredProcessor();
  command(processor, "CONFIGURE", { recipe: BUILTIN_RECIPES["A-U396-4"] });
  quantum(processor);
  command(processor, "START");
  quantum(processor);
  command(processor, "SET_MASTER_GAIN", { gain: 0.3 });
  assert.equal(messages(processor, "MASTER_GAIN_SET").length, 0);
  for (let i = 0; i < 4; i += 1) quantum(processor);
  assert.equal(messages(processor, "MASTER_GAIN_SET")[0].gain, 0.3);
  command(processor, "STOP");
  assert.equal(messages(processor, "AUDIO_FINALIZED").length, 0);
  for (let i = 0; i < 4; i += 1) quantum(processor);
  const finalized = messages(processor, "AUDIO_FINALIZED")[0];
  assert.equal(finalized.digest.length, 64);
  assert.ok(finalized.totalFrames > 0);
  assert.ok(finalized.endFrame >= finalized.startFrame);
  assert.ok(finalized.contextFrame >= QUANTUM);
  assert.deepEqual(Object.keys(finalized.continuity).sort(), ["errors", "ok"]);
  assert.equal(typeof finalized.clipping, "boolean");
  assert.equal(typeof finalized.peaks.left, "number");
  assert.ok(Array.isArray(finalized.processorErrors));
  assert.ok(finalized.interruptions >= 0);
});

test("finite formal mode finalizes exactly once at targetFrames", () => {
  resetClock();
  const processor = new RegisteredProcessor();
  const targetFrames = 333;
  const recipe = normalizeRecipe({ ...BUILTIN_RECIPES["A-P100-104"], durationMode: "finite", targetFrames });
  command(processor, "CONFIGURE", { recipe });
  quantum(processor);
  command(processor, "START");
  for (let i = 0; i < 5; i += 1) quantum(processor);
  const finalized = messages(processor, "AUDIO_FINALIZED");
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0].totalFrames, targetFrames);
  assert.equal(processor.engine.frame, targetFrames);
  assert.equal(processor.engine.state, "stopped");
});

test("telemetry is low-rate and never transports PCM arrays", () => {
  resetClock();
  const processor = new RegisteredProcessor();
  command(processor, "CONFIGURE", { recipe: BUILTIN_RECIPES["A-SHAM-0"] });
  quantum(processor);
  command(processor, "START");
  for (let i = 0; i < 80; i += 1) quantum(processor);
  const telemetry = messages(processor, "TELEMETRY");
  assert.ok(telemetry.length <= 3);
  for (const message of processor.port.messages) {
    assert.equal(message.left, undefined);
    assert.equal(message.right, undefined);
    assert.equal(message.pcm, undefined);
  }
});

class FakeAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate ?? SAMPLE_RATE;
    this.state = "suspended";
    this.baseLatency = 0.01;
    this.outputLatency = 0.02;
    this.destination = {};
    this.onstatechange = null;
    this.audioWorklet = { addModule: async () => {} };
  }
  async resume() {
    this.state = "running";
    this.onstatechange?.();
  }
  async close() {
    this.state = "closed";
    this.onstatechange?.();
  }
}

let releaseDelayedModule;
class DelayedAudioContext extends FakeAudioContext {
  constructor(options = {}) {
    super(options);
    this.audioWorklet = {
      addModule: () => new Promise((resolve) => { releaseDelayedModule = resolve; }),
    };
  }
}

class FakeControllerNode {
  static mutateReady = null;
  static ignore = false;
  constructor() {
    this.connected = false;
    this.port = {
      onmessage: null,
      postMessage: (message) => {
        if (FakeControllerNode.ignore) return;
        queueMicrotask(() => {
          let response;
          if (message.type === "CONFIGURE") {
            const recipe = normalizeRecipe(message.recipe);
            response = {
              type: "PROCESSOR_READY",
              processorVersion: PROCESSOR_VERSION,
              recipeId: recipe.recipeId,
              recipeVersion: recipe.version,
              sampleRate: recipe.sampleRate,
              configFingerprint: recipe.configFingerprint,
            };
            FakeControllerNode.mutateReady?.(response);
          } else if (message.type === "START") response = { type: "AUDIO_STARTED", frame: 128 };
          else if (message.type === "PAUSE") response = { type: "AUDIO_PAUSED", frame: 512 };
          else if (message.type === "RESUME") response = { type: "AUDIO_RESUMED", frame: 640 };
          else if (message.type === "SET_MASTER_GAIN") response = { type: "MASTER_GAIN_SET", gain: message.gain, frame: 768 };
          else if (message.type === "STOP") response = { type: "AUDIO_FINALIZED", totalFrames: 1024, digest: "a".repeat(64) };
          if (response) this.port.onmessage?.({ data: response });
        });
      },
    };
  }
  connect() { this.connected = true; }
  disconnect() { this.connected = false; }
}

test("AudioController exposes promise lifecycle, verifies readiness, and records diagnostics", async () => {
  FakeControllerNode.ignore = false;
  FakeControllerNode.mutateReady = null;
  const controller = new AudioController({ AudioContextClass: FakeAudioContext, AudioWorkletNodeClass: FakeControllerNode, timeoutMs: 100 });
  const ready = await controller.prepare(BUILTIN_RECIPES["A-U396-4"]);
  assert.equal(ready.processorVersion, PROCESSOR_VERSION);
  await controller.start();
  await controller.pause();
  await controller.resume();
  assert.equal((await controller.setMasterGain(0.35)).gain, 0.35);
  const firstStop = controller.stop();
  const secondStop = controller.stop();
  const [finalized, repeatedFinalization] = await Promise.all([firstStop, secondStop]);
  assert.equal(finalized.digest, "a".repeat(64));
  assert.deepEqual(repeatedFinalization, finalized);
  const diagnostics = controller.diagnostics();
  assert.equal(diagnostics.state, "stopped");
  assert.equal(diagnostics.sampleRate, SAMPLE_RATE);
  assert.equal(diagnostics.baseLatency, 0.01);
  assert.equal(diagnostics.outputLatency, 0.02);
  assert.ok(diagnostics.contextStateChanges.some((change) => change.state === "running"));
  assert.ok(diagnostics.contextStateChanges.some((change) => change.state === "closed"));
  assert.deepEqual(diagnostics.latencies.map((entry) => entry.command), ["CONFIGURE", "START", "PAUSE", "RESUME", "SET_MASTER_GAIN", "STOP"]);
});

test("AudioController rejects any PROCESSOR_READY field mismatch and cleans up", async () => {
  FakeControllerNode.ignore = false;
  FakeControllerNode.mutateReady = (ready) => { ready.configFingerprint = "bad"; };
  const controller = new AudioController({ AudioContextClass: FakeAudioContext, AudioWorkletNodeClass: FakeControllerNode, timeoutMs: 100 });
  await assert.rejects(controller.prepare(BUILTIN_RECIPES["A-U396-4"]), /configFingerprint mismatch/);
  assert.equal(controller.state, "idle");
  assert.equal(controller.context, null);
  assert.equal(controller.node, null);
  FakeControllerNode.mutateReady = null;
});

test("AudioController timeout rejects and closes resources", async () => {
  FakeControllerNode.ignore = true;
  const controller = new AudioController({ AudioContextClass: FakeAudioContext, AudioWorkletNodeClass: FakeControllerNode, timeoutMs: 10 });
  await assert.rejects(controller.prepare(BUILTIN_RECIPES["A-U396-4"]), /timed out waiting for PROCESSOR_READY/);
  assert.equal(controller.context, null);
  assert.equal(controller.node, null);
  assert.ok(controller.latencies.some((entry) => entry.timeout === true));
  FakeControllerNode.ignore = false;
});

test("AudioController stop cancels preparation before node creation", async () => {
  releaseDelayedModule = null;
  const controller = new AudioController({ AudioContextClass: DelayedAudioContext, AudioWorkletNodeClass: FakeControllerNode, timeoutMs: 100 });
  const preparing = controller.prepare(BUILTIN_RECIPES["A-U396-4"]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller._preparing, true);
  const stopping = controller.stop();
  await stopping;
  releaseDelayedModule?.();
  await assert.rejects(preparing, /cancelled|cleaned up/i);
  assert.equal(controller.context, null);
  assert.equal(controller.node, null);
  assert.equal(controller.state, "idle");
});
