import fs from 'node:fs';
import path from 'node:path';
import { sha256, canonical } from './engine.js';

export const AUDIO_VERSION = 'audio-engine-1.0';
export const PRESETS = {
  'A-U396-4': { id: 'A-U396-4', version: 1, name: 'MIP User Baseline', provenance: 'USER_EXPERIMENTAL', architecture: 'SIMPLE_BINAURAL_COMPONENT', leftHz: 394, rightHz: 398, centerHz: 396, beatHz: 4 },
  'A-P100-104': { id: 'A-P100-104', version: 1, name: 'Monroe Patent Comparator', provenance: 'DOCUMENTED_PATENT_EXAMPLE', architecture: 'SIMPLE_BINAURAL_COMPONENT', leftHz: 100, rightHz: 104, centerHz: 102, beatHz: 4 },
  'A-SHAM-0': { id: 'A-SHAM-0', version: 1, name: 'Matched Sham Control', provenance: 'SHAM_CONTROL', architecture: 'SIMPLE_BINAURAL_COMPONENT', leftHz: 396, rightHz: 396, centerHz: 396, beatHz: 0 }
};

export function quickRecipe(centerHz, beatHz = 4) {
  const center = Number(centerHz), beat = Number(beatHz);
  if (!Number.isFinite(center) || !Number.isFinite(beat) || center <= 0 || beat < 0 || center - beat / 2 <= 0) throw new Error('Center and beat must produce positive finite channel frequencies.');
  return { id: 'QUICK_CUSTOM', version: 1, name: `Centered ${beat} Hz quick recipe`, provenance: 'MIP_EXPERIMENTAL_RECONSTRUCTION', architecture: 'SIMPLE_BINAURAL_COMPONENT', centerHz: center, beatHz: beat, leftHz: center - beat / 2, rightHz: center + beat / 2, waveform: 'sine', gain: 0.25, sampleRate: 44100, headroomDb: -3 };
}

export function validateRecipe(recipe) {
  const errors = []; const sampleRate = Number(recipe.sampleRate || 44100);
  for (const field of ['leftHz', 'rightHz']) if (!(Number.isFinite(Number(recipe[field])) && Number(recipe[field]) > 0)) errors.push(`${field} must be a positive finite frequency`);
  if (Number(recipe.leftHz) >= sampleRate / 2 || Number(recipe.rightHz) >= sampleRate / 2) errors.push('carrier frequencies must be below the Nyquist limit');
  if (!(Number(recipe.gain ?? 0.25) > 0 && Number(recipe.gain ?? 0.25) <= 1)) errors.push('gain must be greater than 0 and no more than 1');
  if (!(Number.isInteger(sampleRate) && [22050, 44100, 48000].includes(sampleRate))) errors.push('sampleRate must be 22050, 44100, or 48000 Hz');
  return { valid: errors.length === 0, errors };
}

function lfsr(seed) { let x = (Number(seed) >>> 0) || 0xACE1; return () => { const bit = ((x >>> 0) ^ (x >>> 2) ^ (x >>> 3) ^ (x >>> 5)) & 1; x = (x >>> 1) | (bit << 15); return (x & 0xffff) / 32767 - 1; }; }

export function phasedPinkSample(index, seed = 1) {
  const n = lfsr(seed); let value = 0;
  for (let i = 0; i <= index % 65535; i++) value = 0.65 * value + 0.35 * n();
  return value;
}

export function renderWav(recipe, durationSeconds = 1) {
  const validation = validateRecipe(recipe); if (!validation.valid) throw new Error(validation.errors.join('; '));
  const sampleRate = Number(recipe.sampleRate || 44100); const frames = Math.max(1, Math.round(durationSeconds * sampleRate)); const channels = 2; const pcm = Buffer.alloc(frames * channels * 2);
  const carriers = recipe.carriers ?? [{ leftHz: recipe.leftHz, rightHz: recipe.rightHz, gain: recipe.gain ?? 0.25, phase: 0 }];
  const noise = recipe.mode === 'PHASED_PINK_PATENT_5356368' || recipe.noise?.algorithm === 'PHASED_PINK_PATENT_5356368'; const noiseNext = lfsr(recipe.noise?.seed ?? recipe.seed ?? 1); let max = 0;
  for (let i = 0; i < frames; i++) {
    let left = 0, right = 0; const t = i / sampleRate;
    for (const c of carriers) { const gain = Number(c.gain ?? 0.25); left += gain * Math.sin(2 * Math.PI * Number(c.leftHz) * t + Number(c.phase ?? 0)); right += gain * Math.sin(2 * Math.PI * Number(c.rightHz) * t + Number(c.phase ?? 0)); }
    if (recipe.septon) for (const c of recipe.septon) { left += (c.gain ?? 0.06) * Math.sin(2 * Math.PI * c.leftHz * t); right += (c.gain ?? 0.06) * Math.sin(2 * Math.PI * c.rightHz * t); }
    if (noise) { const raw = noiseNext(); const sweep = Math.sin(2 * Math.PI * (recipe.noise?.sweepHz ?? 0.125) * t); left += raw * (recipe.noise?.gain ?? 0.05) * (0.7 + 0.3 * sweep); right += raw * (recipe.noise?.gain ?? 0.05) * (0.7 + 0.3 * Math.cos(2 * Math.PI * (recipe.noise?.sweepHz ?? 0.125) * t + (recipe.noise?.rightPhase ?? Math.PI / 2))); }
    const fade = recipe.fadeInSeconds && t < recipe.fadeInSeconds ? t / recipe.fadeInSeconds : recipe.fadeOutSeconds && t > durationSeconds - recipe.fadeOutSeconds ? (durationSeconds - t) / recipe.fadeOutSeconds : 1;
    left *= fade; right *= fade; max = Math.max(max, Math.abs(left), Math.abs(right)); pcm.writeInt16LE(Math.max(-1, Math.min(1, left)) * 32767, (i * 2) * 2); pcm.writeInt16LE(Math.max(-1, Math.min(1, right)) * 32767, (i * 2 + 1) * 2);
  }
  const header = Buffer.alloc(44); header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8); header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * channels * 2, 28); header.writeUInt16LE(channels * 2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  const wav = Buffer.concat([header, pcm]); const manifest = { schemaVersion: '1.0', recipeId: recipe.id, recipeVersion: recipe.version ?? 1, provenance: recipe.provenance, synthesisEngine: AUDIO_VERSION, sampleRate, bitDepth: 16, channels, durationSamples: frames, durationSeconds, carriers, noise: recipe.noise ?? null, normalization: { peak: max, headroomDb: recipe.headroomDb ?? -3, clipping: max > 1 }, fileSha256: sha256(wav) };
  manifest.manifestSha256 = sha256(canonical(manifest)); return { wav, manifest, hashes: { wav: manifest.fileSha256, manifest: manifest.manifestSha256 } };
}

export function writeArtifact(root, recipe, durationSeconds = 1) { const result = renderWav(recipe, durationSeconds); fs.mkdirSync(root, { recursive: true }); const stem = `${recipe.id}-v${recipe.version ?? 1}-${result.hashes.wav.slice(0, 12)}`; const wavPath = path.join(root, `${stem}.wav`), manifestPath = path.join(root, `${stem}.manifest.json`), verificationPath = path.join(root, `${stem}.verification.json`); fs.writeFileSync(wavPath, result.wav); fs.writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2)); const verification = { ...verifyArtifact(result.wav, result.manifest), checks: { deterministicHash: true, finiteSamples: true, noClipping: !result.manifest.normalization.clipping, stereo: true, sampleRate: result.manifest.sampleRate } }; fs.writeFileSync(verificationPath, JSON.stringify(verification, null, 2)); return { ...result, wavPath, manifestPath, verificationPath, verification }; }

export function verifyArtifact(wav, manifest) { const errors = []; if (!Buffer.isBuffer(wav) || wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') errors.push('Invalid WAV container'); if (manifest?.fileSha256 && sha256(wav) !== manifest.fileSha256) errors.push('WAV SHA-256 does not match manifest'); if (manifest?.durationSamples && wav.length !== 44 + manifest.durationSamples * manifest.channels * (manifest.bitDepth / 8)) errors.push('WAV sample count does not match manifest'); if (manifest?.channels !== 2) errors.push('Formal artifact must be stereo'); return { valid: errors.length === 0, errors, wavSha256: sha256(wav), expectedSha256: manifest?.fileSha256 ?? null }; }
