import {
  PROCESSOR_VERSION,
  normalizeRecipe,
  validateEffectiveRecipe,
} from "./audio-core.js";

const DEFAULT_TIMEOUT_MS = 5000;

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, jsonSafe(child)]));
}

export class AudioController {
  constructor(options = {}) {
    this.AudioContextClass = options.AudioContextClass ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.AudioWorkletNodeClass = options.AudioWorkletNodeClass ?? globalThis.AudioWorkletNode;
    this.moduleUrl = options.moduleUrl ?? new URL("./mip-processor.js", import.meta.url);
    this.processorName = options.processorName ?? "mip-processor";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.onTelemetry = options.onTelemetry ?? null;
    this.context = null;
    this.node = null;
    this.recipe = null;
    this.state = "idle";
    this.telemetry = null;
    this.finalization = null;
    this.contextStateChanges = [];
    this.latencies = [];
    this.processorErrors = [];
    this.contextMetrics = { sampleRate: null, baseLatency: null, outputLatency: null };
    this._pending = new Map();
  }

  _recordContextState() {
    if (!this.context) return;
    this.contextStateChanges.push({ state: this.context.state, at: now() });
  }

  _settle(type, message, reject = false) {
    const pending = this._pending.get(type);
    if (!pending) return false;
    this._pending.delete(type);
    clearTimeout(pending.timer);
    const elapsedMs = now() - pending.startedAt;
    this.latencies.push({ command: pending.command, acknowledgement: type, elapsedMs });
    if (reject) pending.reject(message instanceof Error ? message : new Error(String(message)));
    else pending.resolve(message);
    return true;
  }

  _rejectAll(error) {
    for (const [type, pending] of this._pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this._pending.delete(type);
    }
  }

  _onMessage = (event) => {
    const message = jsonSafe(event?.data ?? event);
    if (!message || typeof message.type !== "string") return;
    if (message.type === "TELEMETRY") {
      this.telemetry = message;
      this.onTelemetry?.(message);
      return;
    }
    if (message.type === "PROCESSOR_ERROR") {
      const error = new Error(message.error || "Audio processor error");
      error.processorMessage = message;
      this.processorErrors.push(message);
      this._rejectAll(error);
      this._cleanup().catch(() => {});
      return;
    }
    if (message.type === "AUDIO_FINALIZED") {
      this.finalization = message;
      this.state = "stopped";
    }
    this._settle(message.type, message);
  };

  _wait(command, acknowledgement, payload = {}, timeoutMs = this.timeoutMs) {
    if (!this.node) return Promise.reject(new Error(`${command} requires a prepared AudioWorklet`));
    if (this._pending.has(acknowledgement)) return Promise.reject(new Error(`${acknowledgement} is already pending`));
    return new Promise((resolve, reject) => {
      const startedAt = now();
      const timer = setTimeout(() => {
        this._pending.delete(acknowledgement);
        const error = new Error(`${command} timed out waiting for ${acknowledgement}`);
        this.latencies.push({ command, acknowledgement, elapsedMs: now() - startedAt, timeout: true });
        reject(error);
        this._cleanup().catch(() => {});
      }, timeoutMs);
      this._pending.set(acknowledgement, { command, startedAt, timer, resolve, reject });
      this.node.port.postMessage({ type: command, ...payload });
    });
  }

  async prepare(recipe, options = {}) {
    await this._cleanup();
    if (!this.AudioContextClass || !this.AudioWorkletNodeClass) throw new Error("AudioWorklet is unavailable in this environment");
    const desiredRate = recipe?.sampleRate === undefined ? undefined : Number(recipe.sampleRate);
    const contextOptions = desiredRate ? { sampleRate: desiredRate } : undefined;
    try {
      this.context = options.context ?? new this.AudioContextClass(contextOptions);
      this.contextMetrics = {
        sampleRate: this.context.sampleRate,
        baseLatency: this.context.baseLatency ?? null,
        outputLatency: this.context.outputLatency ?? null,
      };
      this._recordContextState();
      this.context.onstatechange = () => this._recordContextState();
      const effective = normalizeRecipe(recipe, { sampleRate: this.context.sampleRate, targetFrames: options.targetFrames, developmentFixture: options.developmentFixture });
      const check = validateEffectiveRecipe(effective);
      if (!check.valid) throw new Error(check.errors.join("; "));
      if (effective.sampleRate !== this.context.sampleRate)
        throw new Error(`AudioContext sample rate ${this.context.sampleRate} does not match committed rate ${effective.sampleRate}`);
      this.recipe = effective;
      await this.context.audioWorklet.addModule(this.moduleUrl);
      this.node = new this.AudioWorkletNodeClass(this.context, this.processorName, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.node.port.onmessage = this._onMessage;
      this.node.onprocessorerror = () => {
        const error = new Error("AudioWorklet processorerror event");
        this.processorErrors.push({ type: "processorerror", at: now() });
        this._rejectAll(error);
        this._cleanup().catch(() => {});
      };
      this.node.connect(this.context.destination);
      if (this.context.state !== "running") await this.context.resume();
      const acknowledgement = await this._wait("CONFIGURE", "PROCESSOR_READY", { recipe: effective }, options.timeoutMs);
      const expected = {
        processorVersion: PROCESSOR_VERSION,
        recipeId: effective.recipeId,
        recipeVersion: effective.version,
        sampleRate: effective.sampleRate,
        configFingerprint: effective.configFingerprint,
      };
      for (const [field, value] of Object.entries(expected)) {
        if (acknowledgement[field] !== value)
          throw new Error(`PROCESSOR_READY ${field} mismatch: expected ${String(value)}, received ${String(acknowledgement[field])}`);
      }
      this.state = "ready";
      return { ...acknowledgement, contextState: this.context.state, ...this.contextMetrics, latencyRecords: this.latencies.slice() };
    } catch (error) {
      await this._cleanup();
      throw error;
    }
  }

  async start(options = {}) {
    if (this.state !== "ready") throw new Error("start requires a prepared controller");
    const acknowledgement = await this._wait("START", "AUDIO_STARTED", {}, options.timeoutMs);
    if (!this.finalization) this.state = "running";
    return acknowledgement;
  }

  async pause(options = {}) {
    if (this.state !== "running") throw new Error("pause requires running audio");
    const acknowledgement = await this._wait("PAUSE", "AUDIO_PAUSED", {}, options.timeoutMs);
    this.state = "paused";
    return acknowledgement;
  }

  async resume(options = {}) {
    if (this.state !== "paused") throw new Error("resume requires paused audio");
    const acknowledgement = await this._wait("RESUME", "AUDIO_RESUMED", {}, options.timeoutMs);
    this.state = "running";
    return acknowledgement;
  }

  async setMasterGain(gain, options = {}) {
    if (!["ready", "running", "paused"].includes(this.state)) throw new Error("setMasterGain requires prepared audio");
    const acknowledgement = await this._wait("SET_MASTER_GAIN", "MASTER_GAIN_SET", { gain }, options.timeoutMs);
    return acknowledgement;
  }

  async stop(options = {}) {
    if (!this.node) return this.finalization;
    if (this.finalization) {
      const finalized = this.finalization;
      await this._cleanup({ preserveState: true });
      return finalized;
    }
    try {
      const acknowledgement = await this._wait("STOP", "AUDIO_FINALIZED", {}, options.timeoutMs);
      this.state = "stopped";
      this.finalization = acknowledgement;
      await this._cleanup({ preserveState: true });
      return acknowledgement;
    } catch (error) {
      await this._cleanup();
      throw error;
    }
  }

  diagnostics() {
    return {
      state: this.state,
      contextState: this.context?.state ?? "closed",
      contextStateChanges: this.contextStateChanges.slice(),
      latencies: this.latencies.slice(),
      sampleRate: this.contextMetrics.sampleRate,
      baseLatency: this.contextMetrics.baseLatency,
      outputLatency: this.contextMetrics.outputLatency,
      telemetry: this.telemetry,
      finalization: this.finalization,
      processorErrors: this.processorErrors.slice(),
    };
  }

  /** Explicit lifecycle disposal for UI transitions and failed starts. */
  async dispose() {
    await this._cleanup();
  }

  async _cleanup(options = {}) {
    this._rejectAll(new Error("Audio controller cleaned up"));
    const node = this.node;
    const context = this.context;
    this.node = null;
    this.context = null;
    if (node) {
      node.port.onmessage = null;
      node.onprocessorerror = null;
      try { node.disconnect(); } catch {}
    }
    if (context && context.state !== "closed") {
      try {
        await context.close();
        this.contextStateChanges.push({ state: context.state, at: now() });
      } catch {}
    }
    if (!options.preserveState) {
      this.state = "idle";
      this.recipe = null;
    }
  }
}

export default AudioController;
