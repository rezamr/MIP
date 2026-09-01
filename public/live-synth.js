/*
 * Compatibility facade for the original LiveSynth API.
 *
 * The active renderer and AudioWorklet use AudioEngine directly. Keeping this
 * small facade lets older offline tests exercise the same stateful DSP while
 * using the shared canonical PCM SHA-256 implementation.
 */
import { AudioEngine, normalizeRecipe, pcmDigest } from "./audio-core.js";

export class LiveSynth {
  constructor(recipe, sampleRate = 44100, seed = 1) {
    this.seed = Number(seed) || 1;
    const raw = {
      ...(recipe || {}),
      id: recipe?.id ?? recipe?.recipeId ?? "LIVE_SYNTH_COMPAT",
      sampleRate: Number(recipe?.sampleRate ?? sampleRate),
      durationMode: "live",
      developmentFixture: true,
    };
    if (raw.noise && raw.noise.seed === undefined) raw.noise.seed = this.seed;
    this.recipe = normalizeRecipe(raw, { sampleRate: raw.sampleRate, developmentFixture: true });
    this.engine = new AudioEngine(this.recipe);
    this.engine.start();
    this.frame = 0;
    this.lastBlockDigest = null;
  }

  generate(frames) {
    const count = Number(frames);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("frames must be a non-negative safe integer");
    const left = new Float32Array(count);
    const right = new Float32Array(count);
    this.engine.renderInto(left, right);
    this.frame = this.engine.frame;
    this.lastBlockDigest = pcmDigest(left, right, this.recipe.sampleRate, count);
    return [left, right];
  }

  stop() {
    this.engine.stop();
    while (this.engine.state !== "stopped") {
      const remaining = Math.max(1, this.engine.rampFrames);
      this.engine.renderInto(new Float32Array(remaining), new Float32Array(remaining));
    }
    return this.engine.finalize();
  }

  snapshot() {
    return {
      frame: this.frame,
      seed: this.seed,
      state: this.engine.snapshot(),
      lastBlockDigest: this.lastBlockDigest,
    };
  }
}

export default LiveSynth;
