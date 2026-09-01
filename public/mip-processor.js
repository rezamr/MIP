import {
  AudioEngine,
  PROCESSOR_VERSION,
  normalizeRecipe,
  validateEffectiveRecipe,
} from "./audio-core.js";

const TELEMETRY_FRAMES = 8192;

class MipProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = null;
    this.readyPending = false;
    this.readySent = false;
    this.startedSent = false;
    this.resumePending = false;
    this.pausePending = false;
    this.stopPending = false;
    this.gainPending = false;
    this.finalizedSent = false;
    this.lastTelemetryFrame = 0;
    this.processorSequence = 0;
    this.expectedContextFrame = null;
    this.processorErrors = [];
    this.interruptions = 0;
    this.audioStartContextFrame = null;
    this.audioStartContextTime = null;
    this.lastQuantumFrames = 0;
    this.port.onmessage = (event) => this._message(event?.data || {});
  }

  _error(error, command) {
    const message = error instanceof Error ? error.message : String(error);
    this.processorErrors.push({ command: command || null, error: message, frame: this.engine?.frame ?? 0 });
    this.port.postMessage({ type: "PROCESSOR_ERROR", command: command || null, error: message, frame: this.engine?.frame ?? 0 });
  }

  _message(message) {
    try {
      switch (message.type) {
        case "CONFIGURE": {
          // A failed reconfiguration must never leave the previous plan live.
          this.engine = null;
          this.readyPending = false;
          this.readySent = false;
          const recipe = normalizeRecipe(message.recipe, { sampleRate });
          if (recipe.sampleRate !== sampleRate)
            throw new Error(`Committed sampleRate ${recipe.sampleRate} does not match AudioWorklet sampleRate ${sampleRate}`);
          const check = validateEffectiveRecipe(recipe);
          if (!check.valid) throw new Error(check.errors.join("; "));
          this.engine = new AudioEngine(recipe);
          this.readyPending = true;
          this.readySent = false;
          this.startedSent = false;
          this.resumePending = false;
          this.pausePending = false;
          this.stopPending = false;
          this.gainPending = false;
          this.finalizedSent = false;
          this.lastTelemetryFrame = 0;
          this.processorSequence = 0;
          this.expectedContextFrame = null;
          this.processorErrors = [];
          this.interruptions = 0;
          this.audioStartContextFrame = null;
          this.audioStartContextTime = null;
          this.lastQuantumFrames = 0;
          break;
        }
        case "START":
          this._requireEngine(message.type);
          this.engine.start();
          break;
        case "PAUSE":
          this._requireEngine(message.type);
          this.engine.pause();
          this.pausePending = true;
          this.interruptions += 1;
          break;
        case "RESUME":
          this._requireEngine(message.type);
          this.engine.resume();
          this.resumePending = true;
          break;
        case "SET_MASTER_GAIN":
          this._requireEngine(message.type);
          this.engine.setMasterGain(message.gain);
          this.gainPending = true;
          break;
        case "STOP":
          this._requireEngine(message.type);
          this.engine.stop();
          this.stopPending = true;
          break;
        default:
          throw new Error(`Unsupported processor command: ${String(message.type)}`);
      }
    } catch (error) {
      this._error(error, message.type);
    }
  }

  _requireEngine(command) {
    if (!this.engine) throw new Error(`${command} requires CONFIGURE first`);
    if (!this.readySent) throw new Error(`${command} requires PROCESSOR_READY first`);
  }

  _postTelemetry(force = false) {
    if (!this.engine) return;
    const frames = this.engine.frame;
    if (!force && frames - this.lastTelemetryFrame < TELEMETRY_FRAMES) return;
    this.lastTelemetryFrame = frames;
    this.port.postMessage({ type: "TELEMETRY", ...this.engine.getTelemetry(), processorSequence: this.processorSequence, currentTime: typeof currentTime === "number" ? currentTime : frames / sampleRate });
  }

  _finalize() {
    if (!this.engine || this.finalizedSent) return;
    const finiteEnded = this.engine.recipe.execution.mode === "finite" && this.engine.state === "stopped";
    if (!this.stopPending && !finiteEnded) return;
    if (this.engine.state !== "stopped") return;
    const telemetry = this.engine.getTelemetry();
    this.port.postMessage({
      type: "AUDIO_FINALIZED",
      processorVersion: PROCESSOR_VERSION,
      recipeId: this.engine.recipe.recipeId,
      recipeVersion: this.engine.recipe.version,
      sampleRate: this.engine.sampleRate,
      startFrame: telemetry.startedFrame ?? null,
      endFrame: this.engine.frame,
      startContextFrame: this.audioStartContextFrame,
      startContextTime: this.audioStartContextTime,
      endContextFrame: typeof currentFrame === "number" ? currentFrame + this.lastQuantumFrames : null,
      endContextTime: typeof currentTime === "number" ? currentTime + this.lastQuantumFrames / sampleRate : this.engine.frame / sampleRate,
      contextFrame: typeof currentFrame === "number" ? currentFrame : null,
      currentTime: typeof currentTime === "number" ? currentTime : this.engine.frame / sampleRate,
      totalFrames: this.engine.totalFrames,
      digest: this.engine.finalize(),
      cues: telemetry.cueEvents,
      continuity: telemetry.continuity,
      clipping: telemetry.clipping,
      clippingSamples: telemetry.clippingSamples,
      peaks: telemetry.peaks,
      masterGain: telemetry.masterGain,
      headroomDb: telemetry.headroomDb,
      processorErrors: this.processorErrors,
      interruptions: this.interruptions,
    });
    this.stopPending = false;
    this.finalizedSent = true;
  }

  process(_inputs, outputs) {
    const output = outputs?.[0];
    if (!output?.length) return true;
    const left = output[0];
    const right = output[1] || output[0];
    this.lastQuantumFrames = left.length;
    this.processorSequence += 1;
    if (typeof currentFrame === "number") {
      if (this.expectedContextFrame !== null && currentFrame !== this.expectedContextFrame) {
        this.interruptions += 1;
        if (this.engine) this.engine.continuityErrors += 1;
      }
      this.expectedContextFrame = currentFrame + left.length;
    }
    if (!this.engine) {
      left.fill(0);
      if (right !== left) right.fill(0);
      return true;
    }
    if (this.readyPending) {
      // Prewarm with a genuinely silent render quantum before declaring ready.
      left.fill(0);
      if (right !== left) right.fill(0);
      this.readyPending = false;
      this.readySent = true;
      this.port.postMessage({
        type: "PROCESSOR_READY",
        processorVersion: PROCESSOR_VERSION,
        recipeId: this.engine.recipe.recipeId,
        recipeVersion: this.engine.recipe.version,
        sampleRate: this.engine.sampleRate,
        configFingerprint: this.engine.recipe.configFingerprint,
      });
      this._postTelemetry(true);
      return true;
    }
    const wasRunning = this.engine.state === "running" || this.engine.state === "resuming" || this.engine.state === "pausing" || this.engine.state === "stopping";
    this.engine.renderInto(left, right);
    if (!this.startedSent && this.engine.frame > 0 && wasRunning) {
      this.startedSent = true;
      this.audioStartContextFrame = typeof currentFrame === "number" ? currentFrame : null;
      this.audioStartContextTime = typeof currentTime === "number" ? currentTime : this.engine.frame / sampleRate;
      this.port.postMessage({ type: "AUDIO_STARTED", frame: this.engine.frame, contextFrame: typeof currentFrame === "number" ? currentFrame : null, currentTime: typeof currentTime === "number" ? currentTime : this.engine.frame / sampleRate });
    }
    if (this.pausePending && this.engine.state === "paused") {
      this.pausePending = false;
      this.port.postMessage({ type: "AUDIO_PAUSED", frame: this.engine.frame, contextFrame: typeof currentFrame === "number" ? currentFrame : null, currentTime: typeof currentTime === "number" ? currentTime : this.engine.frame / sampleRate });
    }
    if (this.resumePending && this.engine.state === "running" && this.startedSent) {
      this.resumePending = false;
      this.port.postMessage({ type: "AUDIO_RESUMED", frame: this.engine.frame, contextFrame: typeof currentFrame === "number" ? currentFrame : null, currentTime: typeof currentTime === "number" ? currentTime : this.engine.frame / sampleRate });
    }
    if (this.gainPending && this.engine.masterGainRemaining === 0) {
      this.gainPending = false;
      this.port.postMessage({ type: "MASTER_GAIN_SET", gain: this.engine.masterGain, frame: this.engine.frame });
    }
    this._postTelemetry();
    this._finalize();
    return true;
  }
}

registerProcessor("mip-processor", MipProcessor);
