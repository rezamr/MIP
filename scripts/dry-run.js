import fs from 'node:fs';
import path from 'node:path';
import { assignOutcome, analyzeStream, resolveProfile } from '../src/engine.js';
import { RANDOM_SOURCES, createRandomSources } from '../src/main/random/random-domains.js';
import { PRESETS, renderWav, writeArtifact } from '../src/audio.js';
import { Storage } from '../src/storage.js';

const root = path.resolve(process.env.MIP_DRY_ROOT || './runtime/dry-run'); fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root, { recursive: true });
const storage = new Storage(root); const artifacts = {};
for (const [id, recipe] of Object.entries(PRESETS)) artifacts[id] = writeArtifact(storage.artifacts, recipe, 0.1);
const layered = {
  ...PRESETS['A-U396-4'],
  id: 'LAYERED_HEMISYNC_DEMO_V1',
  recipeId: 'LAYERED_HEMISYNC_DEMO_V1',
  version: 1,
  recipeVersion: 1,
  provenance: 'PATENT_GROUNDED_RECONSTRUCTION',
  architecture: 'LAYERED_STEREO_DSP',
  mode: 'PHASED_PINK_PATENT_5356368',
  synthesisMode: 'PHASED_PINK_PATENT_5356368',
  durationMode: 'live',
  carriers: [
    { id: 'primary', leftHz: 394, rightHz: 398, gain: 0.2, phase: { left: 0, right: 0 }, waveform: 'sine', am: null, fm: null },
    { id: 'secondary', leftHz: 200, rightHz: 204, gain: 0.08, phase: { left: 0.25, right: 0.25 }, waveform: 'sine', am: null, fm: null },
  ],
  septon: [
    { id: 'septon-100', leftHz: 100, rightHz: 101.5, gain: 0.04, phase: { left: 0, right: 0 }, waveform: 'sine', am: null, fm: null },
    { id: 'septon-200', leftHz: 200, rightHz: 204, gain: 0.04, phase: { left: 0, right: 0 }, waveform: 'sine', am: null, fm: null },
  ],
  noise: {
    algorithm: 'PHASED_PINK_PATENT_5356368',
    algorithmVersion: 1,
    seed: 5356368,
    gain: 0.03,
    alpha: 0.65,
    minDelaySamples: 44,
    maxDelaySamples: 662,
    sweepHz: 0.125,
    leftSweepPhase: 0,
    rightSweepPhase: Math.PI / 2,
    combMix: 0.5,
  },
};
artifacts.layered = writeArtifact(storage.artifacts, layered, 0.1);
const base = resolveProfile('BASELINE_NOW_BINARY_V1');
const p = { ...base, output: { ...base.output, preBlocks: 5, primaryBlocks: 6, postBlocks: 5, blockSize: 2 } };
const session = storage.createSession({ profile:p, participantLabel:'Dry-run harness', recordType:'dry' });
const sources = createRandomSources('dry-immediate', { provider:'DETERMINISTIC_PRNG_TEST' });
const objective = assignOutcome(p, sources[RANDOM_SOURCES.TARGET_ASSIGNMENT]);
const rng = sources[RANDOM_SOURCES.MACHINE_OUTPUT];
const preCount = p.output.preBlocks * p.output.blockSize;
const primaryCount = p.output.primaryBlocks * p.output.blockSize;
const total = preCount + primaryCount + p.output.postBlocks * p.output.blockSize;
storage.appendEvent(session.sessionId,'COMMITTED',{objective,configFingerprint:session.manifest.configFingerprint,output:p.output});
storage.appendEvent(session.sessionId,'STARTED');
const values = Array.from({length:total}, () => assignOutcome(p, rng));
values.forEach((value,index) => storage.appendOutput(session.sessionId,{index,value,region:index < preCount ? 'pre' : index < preCount + primaryCount ? 'primary' : 'post',scheduledUtc:new Date().toISOString()}));
const analysis = analyzeStream({requested:objective,values,primary:[preCount,preCount + primaryCount],exploratory:[[0,preCount],[preCount + primaryCount,total]]});
storage.appendEvent(session.sessionId,'RETURN_CONFIRMED',{analysis});
storage.lockRawReport(session.sessionId,{subjectiveDuration:'Unknown',stateIntensity:'5',modality:'combined',notes:'Automated no-participant dry run'});
storage.updateManifest(session.sessionId,{status:'Revealed',actualObjectiveState:objective,participantTarget:String(objective),analysis});
storage.appendEvent(session.sessionId,'REVEALED',{objective});
const integrity=storage.verify(session.sessionId);
const report={reportVersion:'report-v1',sessionId:session.sessionId,profileId:p.id,status:'Revealed',objective,analysis,integrity,audioFixtures:Object.fromEntries(Object.entries(artifacts).map(([k,v])=>[k,{wav:v.wavPath,manifest:v.manifestPath,verification:v.verificationPath,hashes:v.hashes}]))};
fs.writeFileSync(path.join(root,'dry-run-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({root,sessionId:session.sessionId,integrity,audioFixtures:Object.keys(artifacts),report:path.join(root,'dry-run-report.json')},null,2));
