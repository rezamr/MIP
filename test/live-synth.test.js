import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveSynth } from '../public/live-synth.js';

test('live synthesizer is stateful and phase-continuous across blocks', () => {
  const recipe = { leftHz: 394, rightHz: 398, gain: 0.2 };
  const synth = new LiveSynth(recipe, 44100, 7);
  const first = synth.generate(512); const frameAfterFirst = synth.frame; const firstDigest = synth.lastBlockDigest;
  const second = synth.generate(512);
  assert.equal(frameAfterFirst, 512); assert.equal(synth.frame, 1024); assert.notEqual(firstDigest, synth.lastBlockDigest); assert.notEqual(first[0][511], second[0][0]);
  const snap = synth.snapshot(); assert.equal(snap.frame, 1024); assert.equal(snap.seed, 7);
});

test('live layered mode produces stereo blocks without a persisted file', () => {
  const synth = new LiveSynth({ mode:'PHASED_PINK_PATENT_5356368', carriers:[{leftHz:394,rightHz:398,gain:.15},{leftHz:200,rightHz:204,gain:.05}], septon:[{leftHz:100,rightHz:101.5,gain:.03}], noise:{algorithm:'PHASED_PINK_PATENT_5356368',seed:42,gain:.02} }, 44100, 42);
  const [left,right] = synth.generate(1024); assert.equal(left.length,1024); assert.equal(right.length,1024); assert.ok(left.some(v=>v!==0)); assert.ok(right.some(v=>v!==0));
});
