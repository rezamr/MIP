class MipProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.recipe = null; this.frame = 0; this.components = []; this.noise = 0; this.port.postMessage({type:'PROCESSOR_READY'}); this.port.onmessage = e => { if (e.data?.type === 'configure') { this.recipe = e.data.recipe || {}; this.frame = 0; this.noise = 0; this.components = [...(this.recipe.carriers || [{leftHz:this.recipe.leftHz || 394,rightHz:this.recipe.rightHz || 398,gain:1}]), ...(this.recipe.septon || [])].map(c => ({c,left:0,right:0})); this.port.postMessage({type:'PROCESSOR_READY'}); } }; }
  process(inputs, outputs) {
    const out = outputs[0]; if (!out?.length) return true;
    const left = out[0], right = out[1] || out[0], r = this.recipe || {}, sr = sampleRate;
    const carriers = Array.isArray(r.carriers) && r.carriers.length ? r.carriers : [{ leftHz: Number(r.leftHz || 394), rightHz: Number(r.rightHz || 398), gain: 1 }];
    for (let i = 0; i < left.length; i++) {
      let l = 0, rr = 0;
      for (const s of this.components) { const c=s.c; s.left += 2 * Math.PI * Number(c.leftHz || 0) / sr; s.right += 2 * Math.PI * Number(c.rightHz || 0) / sr; const g = Number(c.gain ?? .03); l += Math.sin(s.left + Number(c.phase || 0)) * g; rr += Math.sin(s.right + Number(c.phase || 0)) * g; }
      const n = ((Math.imul((this.frame + i + 1) ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0) / 4294967296 * 2 - 1; this.noise = this.noise * .985 + n * .015; const ng = Number(r.noise?.gain || 0); l += this.noise * ng; rr += this.noise * ng;
      const fade = Math.min(1, (this.frame + i) / (sr * .08), (Number(r.durationSec || 3600) * sr - this.frame - i) / (sr * .08)); left[i] = Math.max(-1, Math.min(1, l * .12 * Math.max(0, fade))); right[i] = Math.max(-1, Math.min(1, rr * .12 * Math.max(0, fade)));
    }
    this.frame += left.length; if (this.frame % 8192 < left.length) this.port.postMessage({ type: 'telemetry', frames: this.frame }); return true;
  }
}
registerProcessor('mip-processor', MipProcessor);
