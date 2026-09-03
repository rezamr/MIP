import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profiles, resolveProfile, validateProfile, assignOutcome, participantTarget, requestInstruction, analyzeStream, timingPlan, sha256 } from './engine.js';
import { RANDOM_SOURCES, createRandomSources } from './main/random/random-domains.js';
import { PRESETS, quickRecipe, validateRecipe, writeArtifact } from './audio.js';
import { Storage } from './storage.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, '..', 'public');
const storage = new Storage();
const sessions = new Map();

const send = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
const body = req => new Promise((resolve, reject) => { let text = ''; req.on('data', chunk => { text += chunk; if (text.length > 2e6) reject(new Error('Request body is too large.')); }); req.on('end', () => { try { resolve(text ? JSON.parse(text) : {}); } catch { reject(new Error('Request body must be valid JSON.')); } }); });

function analysisFor(id, manifest) {
  const memory = sessions.get(id);
  if (memory?.analysis) return memory.analysis;
  if (!storage.revealEligible(id) || manifest.actualObjectiveState === undefined) return null;
  const values = storage.load(id, 'machine-output.jsonl').split('\n').filter(Boolean).map(line => JSON.parse(line).value);
  const state = sessions.get(id);
  const output = state?.profile?.output || manifest.configSnapshot?.output || {};
  const blockSize = Number(output.blockSize || 1);
  const preCount = Number(output.preBlocks || 0) * blockSize;
  const primaryCount = Number(output.primaryBlocks || 0) * blockSize;
  const postCount = Number(output.postBlocks || 0) * blockSize;
  const primaryEnd = preCount + primaryCount;
  const total = preCount + primaryCount + postCount;
  return analyzeStream({ requested: manifest.actualObjectiveState, values, primary: [preCount, primaryEnd], exploratory: [[0, preCount], [primaryEnd, total || values.length]] });
}

function runSession(id) {
  const state = sessions.get(id); if (!state) throw new Error('Session runtime is unavailable; restart from a committed profile.');
  const { profile: p } = state; const rng = state.randomSources[RANDOM_SOURCES.MACHINE_OUTPUT];
  storage.appendEvent(id, 'STARTED', { timing: state.timing }); storage.appendEvent(id, 'AUDIO_START', { recipeId: p.audio.recipeId }); storage.appendEvent(id, 'INDUCTION_CUE', { version: p.protocol.cueVersion }); storage.appendEvent(id, 'REQUEST_ENCODING_START', { instruction: state.instruction });
  const blockSize = Number(p.output?.blockSize || 1);
  const preCount = Number(p.output?.preBlocks || 0) * blockSize;
  const primaryCount = Number(p.output?.primaryBlocks || 0) * blockSize;
  const postCount = Number(p.output?.postBlocks || 0) * blockSize;
  const total = p.output.type === 'SINGLE_OUTCOME' ? 1 : preCount + primaryCount + postCount; const primaryEnd = preCount + primaryCount; const values = [];
  for (let i = 0; i < total; i++) { const value = assignOutcome(p, rng); values.push(value); const region = p.output.type === 'SINGLE_OUTCOME' ? 'primary' : i < preCount ? 'pre' : i < primaryEnd ? 'primary' : 'post'; storage.appendOutput(id, { index: i, value, generatedUtc: new Date().toISOString(), region, rngProvider: rng.provider, rngVersion: rng.version }); }
  storage.appendEvent(id, 'REQUEST_ENCODING_END'); storage.appendEvent(id, 'RELEASE_START'); storage.appendEvent(id, 'RETURN_CUE'); storage.appendEvent(id, 'RETURN_CONFIRMED');
  state.values = values; state.analysis = analyzeStream({ requested: state.objective, values, primary: [preCount, primaryEnd], exploratory: [[0, preCount], [primaryEnd, total]] });
  storage.updateManifest(id, { status: 'Returned', actualObjectiveState: state.objective, timing: { ...state.timing, actualUtc: new Date().toISOString(), latenessMs: 0 }, outputFileSha256: sha256(storage.load(id, 'machine-output.jsonl')), analysis: state.analysis }); storage.appendEvent(id, 'RAW_REPORT_STARTED');
}

async function route(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, appVersion: '1.1.0', runtimeRoot: storage.root });
    if (req.method === 'GET' && url.pathname === '/api/profiles') return send(res, 200, Object.values(profiles).filter(p => p.catalog?.selectableForOwner === true).sort((a, b) => Number(a.catalog?.displayOrder || 99) - Number(b.catalog?.displayOrder || 99)).map(p => ({ ...p, validation: validateProfile(p) })));
    if (req.method === 'POST' && url.pathname === '/api/profiles/validate') return send(res, 200, validateProfile(await body(req)));
    if (req.method === 'GET' && url.pathname === '/api/audio/presets') return send(res, 200, Object.values(PRESETS));
    if (req.method === 'POST' && url.pathname === '/api/audio/quick') { const b = await body(req), recipe = quickRecipe(b.centerHz, b.beatHz); return send(res, 200, { recipe, validation: validateRecipe(recipe) }); }
    if (req.method === 'POST' && url.pathname === '/api/audio/render') { const b = await body(req), artifact = writeArtifact(storage.artifacts, b.recipe || PRESETS['A-U396-4'], Number(b.durationSeconds || 1)); return send(res, 200, { manifest: artifact.manifest, hashes: artifact.hashes, verification: artifact.verification, wavPath: artifact.wavPath }); }
    if (req.method === 'GET' && url.pathname === '/api/sessions') return send(res, 200, storage.listSessions().map(m => ({ ...m, hasReveal: storage.revealEligible(m.sessionId), hiddenOutcome: undefined })));
    if (req.method === 'POST' && url.pathname === '/api/sessions') { const b = await body(req), p = resolveProfile(b.profileId || 'OP_REQUEST_BINARY_V1'), check = validateProfile(p); if (!check.valid) return send(res, 400, { error: 'Profile validation failed.', errors: check.errors }); const provider = p.rng.provider || 'OS_CSPRNG'; const rootSeed = provider === 'DETERMINISTIC_PRNG_TEST' ? String(b.seed || 'session-seed') : crypto.randomBytes(32); const randomSources = createRandomSources(rootSeed, { provider }); const objective = assignOutcome(p, randomSources[RANDOM_SOURCES.TARGET_ASSIGNMENT]); const s = storage.createSession({ profile:p, participantLabel:b.participantLabel || 'Local participant', recordType:b.recordType || 'dry' }); let audioArtifact = null; if (PRESETS[p.audio.recipeId]) audioArtifact = writeArtifact(storage.artifacts, PRESETS[p.audio.recipeId], .1); const state = { ...s, profile:p, objective, instruction:requestInstruction(p, objective), timing:timingPlan(p), randomSources, audioArtifact }; sessions.set(s.sessionId, state); storage.appendEvent(s.sessionId, 'COMMITTED', { configFingerprint:s.manifest.configFingerprint, participantTarget:participantTarget(p, objective), mappingId:p.mapping.id, audioHash:audioArtifact?.hashes.wav || null }); storage.updateManifest(s.sessionId, { status:'Committed', participantTarget:participantTarget(p, objective), timing:state.timing, audioArtifact:audioArtifact ? { hashes:audioArtifact.hashes, verification:audioArtifact.verification, wavPath:audioArtifact.wavPath } : null }); return send(res, 201, { sessionId:s.sessionId, trialId:s.trialId, profile:{id:p.id,name:p.name}, participantTarget:state.instruction, memoryRequired:true, timing:state.timing, audioVerified:audioArtifact?.verification.valid ?? false, status:'Committed' }); }
    const match = /^\/api\/sessions\/([^/]+)(?:\/(.*))?$/.exec(url.pathname); if (match) { const id=match[1], action=match[2] || ''; if (!fs.existsSync(path.join(storage.sessions,id))) return send(res,404,{error:'Session not found.'}); const manifest=storage.readManifest(id); if (req.method==='GET' && !action) { const eligible=storage.revealEligible(id); return send(res,200,{...manifest,revealEligible:eligible,analysis:eligible?analysisFor(id,manifest):undefined}); } if (req.method==='GET' && action==='report') { const eligible=storage.revealEligible(id); return send(res,200,{reportVersion:'report-v1',sessionId:id,profileId:manifest.profileId,status:manifest.status,integrity:storage.verify(id),timing:manifest.timing,audio:manifest.audioArtifact||null,objective:eligible?manifest.actualObjectiveState:undefined,participantTarget:eligible?manifest.participantTarget:undefined,analysis:eligible?analysisFor(id,manifest):undefined}); } if (req.method==='POST' && action==='start') { const b=await body(req); if(!b.memoryConfirmed) return send(res,400,{error:'Explicit memory confirmation is required before START.'}); runSession(id); return send(res,200,{sessionId:id,status:'Returned',hidden:true,reportRequired:true,timeline:storage.load(id,'events.jsonl')}); } if (req.method==='POST' && action==='draft') { const b=await body(req); storage.saveDraft(id,b.report||{}); return send(res,200,{saved:true}); } if (req.method==='POST' && action==='lock-report') { const b=await body(req), locked=storage.lockRawReport(id,b.report||{}); storage.updateManifest(id,{status:'Reveal Eligible'}); return send(res,200,{locked:true,lockHash:locked.lockHash,revealEligible:true}); } if (req.method==='POST' && action==='reveal') { if(!storage.revealEligible(id)) return send(res,403,{error:'Reveal is not eligible until the configured gate is satisfied.'}); const m=storage.readManifest(id), analysis=analysisFor(id,m); storage.appendEvent(id,'REVEALED',{objective:m.actualObjectiveState}); storage.updateManifest(id,{status:'Revealed',revealedUtc:new Date().toISOString()}); return send(res,200,{objective:m.actualObjectiveState,participantTarget:m.participantTarget,analysis,primary:analysis?.primary,integrity:storage.verify(id),status:'Revealed'}); } if (req.method==='GET' && action==='verify') return send(res,200,storage.verify(id)); if (req.method==='GET' && action==='events') return send(res,200,{events:storage.load(id,'events.jsonl').split('\n').filter(Boolean).map(JSON.parse)}); if (req.method==='GET' && action==='output') { if(!storage.revealEligible(id)) return send(res,403,{error:'Machine output remains hidden until reveal eligibility.'}); return send(res,200,{records:storage.load(id,'machine-output.jsonl').split('\n').filter(Boolean).map(JSON.parse)}); } }
    if (req.method === 'GET') { const file=url.pathname==='/'?'index.html':url.pathname.slice(1), full=path.resolve(PUBLIC,file), base=path.resolve(PUBLIC); if (!(full===base || full.startsWith(base+path.sep)) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res,404,{error:'Not found.'}); const ext=path.extname(full); res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[ext]||'application/octet-stream'}); return res.end(fs.readFileSync(full)); }
    return send(res,404,{error:'Not found.'});
  } catch (error) { return send(res,400,{error:error.message}); }
}
const server=http.createServer((req,res)=>route(req,res,new URL(req.url,'http://127.0.0.1'))); const port=Number(process.env.PORT||3210); server.listen(port,'127.0.0.1',()=>console.log(`MIP Local Research Engine listening at http://127.0.0.1:${port}`));
