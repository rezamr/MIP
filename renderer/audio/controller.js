import AudioController from "../../public/audio-controller.js";
import { normalizeRecipe, validateEffectiveRecipe } from "../../public/audio-core.js";

export class RendererAudio {
  constructor(onTelemetry) {
    this.onTelemetry = onTelemetry;
    this.controller = this._newController();
    this.recipe = null;
    this.startedAt = null;
    this.telemetry = null;
  }

  _newController() {
    return new AudioController({ onTelemetry: (message) => {
      this.telemetry = message;
      this.onTelemetry?.(message);
    } });
  }

  get state() { return this.controller.state; }
  get frames() { return Number(this.telemetry?.generatedFrames ?? this.controller.finalization?.totalFrames ?? 0); }

  async prepare(recipe, options = {}) {
    if (this.controller.node || this.controller.context) await this.controller.stop().catch(() => {});
    this.controller = this._newController();
    const effective = normalizeRecipe(recipe, options);
    const validation = validateEffectiveRecipe(effective);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    this.recipe = effective;
    this.telemetry = null;
    return this.controller.prepare(effective, options);
  }

  async start(options = {}) {
    const result = await this.controller.start(options);
    this.startedAt = Date.now();
    return result;
  }

  pause(options = {}) { return this.controller.pause(options); }
  resume(options = {}) { return this.controller.resume(options); }
  setMasterGain(gain, options = {}) { return this.controller.setMasterGain(gain, options); }
  stop(options = {}) { return this.controller.stop(options); }
  diagnostics() { return this.controller.diagnostics(); }

  async dispose() {
    await this.controller.dispose();
  }
}

export default RendererAudio;
