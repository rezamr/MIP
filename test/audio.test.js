import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, quickChannelFrequencies, quickRecipe, renderWav, validateRecipe, verifyArtifact } from '../src/audio.js';
test('initial presets preserve exact channel frequencies', () => { assert.deepEqual([PRESETS['A-U396-4'].leftHz, PRESETS['A-U396-4'].rightHz], [394,398]); assert.deepEqual([PRESETS['A-P100-104'].leftHz, PRESETS['A-P100-104'].rightHz], [100,104]); assert.deepEqual([PRESETS['A-SHAM-0'].leftHz, PRESETS['A-SHAM-0'].rightHz], [396,396]); });
test('quick centered generator derives channels', () => { const r = quickRecipe(396); assert.equal(r.leftHz, 394); assert.equal(r.rightHz, 398); });
test('quick generator rejects a beat that would make a channel non-positive', () => {
  assert.throws(() => quickChannelFrequencies(2, 4), /centerHz must be greater than beatHz \/ 2/);
  assert.throws(() => quickRecipe(1, 4), /positive finite channel frequencies/);
  const pair = quickChannelFrequencies(2.01, 4);
  assert.equal(pair.center, 2.01);
  assert.equal(pair.beat, 4);
  assert.ok(pair.left > 0);
  assert.equal(pair.right, 4.01);
});
test('render is deterministic and stereo with manifest hashes', () => { const a=renderWav(PRESETS['A-U396-4'], .02), b=renderWav(PRESETS['A-U396-4'], .02); assert.equal(a.hashes.wav,b.hashes.wav); assert.equal(a.wav.length, 44 + Math.round(.02*44100)*4); assert.equal(a.manifest.channels,2); });
test('layered phased-pink and Septon render deterministically', () => { const r={...PRESETS['A-U396-4'], id:'PHASED_TEST', mode:'PHASED_PINK_PATENT_5356368', developmentFixture:true, noise:{algorithm:'PHASED_PINK_PATENT_5356368',seed:42,gain:.02}, septon:[{leftHz:200,rightHz:204,gain:.03}]}; const a=renderWav(r,.01), b=renderWav(r,.01); assert.equal(a.hashes.wav,b.hashes.wav); assert.equal(validateRecipe(r).valid,true); });
test('invalid Nyquist recipe is rejected', () => { assert.equal(validateRecipe({...PRESETS['A-U396-4'], leftHz:30000, sampleRate:44100}).valid,false); });
test('artifact verifier detects deliberate corruption', () => { const a=renderWav(PRESETS['A-U396-4'], .01), bad=Buffer.from(a.wav); bad[60]^=0xff; assert.equal(verifyArtifact(bad,a.manifest).valid,false); assert.equal(verifyArtifact(a.wav,a.manifest).valid,true); });
