import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyzeStream, assignOutcome, sha256, timingPlan } from "../src/engine.js";
import { renderOffline, PCM_CANONICAL_FORMAT, PCM_DIGEST_VERSION, PROCESSOR_VERSION } from "../public/audio-core.js";
import { MipDatabase } from "../src/main/database/db.js";
import { RANDOM_SOURCES, createRandomSources, randomSourcesMetadata } from "../src/main/random/random-domains.js";
import { SCHEDULER_MODES, SessionScheduler } from "../src/main/sessions/session-scheduler.js";

/*
 * Current SQLite/Electron-authority dry-run.
 *
 * This command intentionally does not open an Electron window or wait for
 * wall-clock audio. It exercises the same durable database operations used by
 * the main process: draft -> commitment, authenticated audio metadata, hidden
 * scheduled output, finalization, raw-report lock, reveal, integrity, and
 * export. A real AudioWorklet/device run belongs to the Electron smoke and
 * owner verification workflows, not this deterministic fixture.
 */

function clone(value) {
  return JSON.parse(JSON.stringify(value, (_key, child) => typeof child === "bigint" ? child.toString() : child));
}

function uniqueRoot() {
  const requestedParent = process.env.MIP_DRY_ROOT;
  const parent = requestedParent
    ? path.resolve(requestedParent)
    : fs.mkdtempSync(path.join(os.tmpdir(), "mip-dry-run-"));
  fs.mkdirSync(parent, { recursive: true });
  if (requestedParent) {
    const run = path.join(parent, `run-${Date.now()}-${process.pid}`);
    fs.mkdirSync(run, { recursive: true });
    return run;
  }
  return parent;
}

function stageFixture(db, sessionId, trialId, anchor) {
  const stageTypes = [
    "INDUCTION_START",
    "SETTLING_START",
    "REQUEST_START",
    "REQUEST_END",
    "RELEASE_START",
    "NEUTRAL_OBSERVATION",
    "POST_REQUEST",
    "RETURN_CUE",
    "AUDIO_FINALIZED",
  ];
  let offsetMs = 0;
  for (const stageType of stageTypes) {
    const plannedUtc = new Date(anchor.utcMs + offsetMs).toISOString();
    db.evidence.recordProtocolStage(sessionId, {
      trialId,
      stageType,
      plannedUtc,
      plannedMonotonicNs: (BigInt(anchor.monotonicNs) + BigInt(Math.round(offsetMs * 1e6))).toString(),
      actualUtc: plannedUtc,
      actualMonotonicNs: (BigInt(anchor.monotonicNs) + BigInt(Math.round(offsetMs * 1e6))).toString(),
      status: "FIXTURE_OBSERVED",
      cueId: `dry-${stageType.toLowerCase()}`,
      payload: { anchor: "AUDIO_STARTED", offsetMs },
    });
    offsetMs += stageType === "INDUCTION_START" ? 5 : stageType === "SETTLING_START" ? 5 : stageType === "REQUEST_START" ? 10 : stageType === "RELEASE_START" ? 10 : stageType === "NEUTRAL_OBSERVATION" ? 10 : stageType === "RETURN_CUE" ? 5 : 0;
  }
}

const root = uniqueRoot();
const db = new MipDatabase(root);
try {
  const profile = db.profiles.getVersion("BASELINE_NOW_BINARY_V1", 1);
  if (!profile) throw new Error("The built-in dry-run profile is not available in SQLite.");
  const recipe = db.recipes.getVersion(profile.audio.recipeId, profile.audio.version);
  if (!recipe || recipe.incomplete || recipe.status !== "ACTIVE") throw new Error("The built-in dry-run recipe is not active and complete.");

  const sources = createRandomSources("sqlite-electron-dry-run", { provider: "DETERMINISTIC_PRNG_TEST" });
  const objective = assignOutcome(profile, sources[RANDOM_SOURCES.TARGET_ASSIGNMENT]);
  const participantTarget = `${profile.encoding?.releaseInstruction || "Observe neutrally."} Favor ${objective} now.`;
  const timing = timingPlan(profile, Date.now());
  const audioNonce = "dry-" + sha256("sqlite-electron-audio-challenge");
  const audio = clone(recipe);
  const created = db.beginSession(profile, "SQLite dry-run fixture", "dry", {
    objective,
    participantTarget,
    rng: { sources: randomSourcesMetadata(sources) },
    audio,
    timing,
    audioNonce,
    deferCommit: true,
  });

  db.persistTransition(created.id, "TARGET_ASSIGNED", {
    trialId: created.trial,
    eventType: "TARGET_ASSIGNED",
    targetAssigned: true,
    payload: { targetAssigned: true },
  }, { evidence: { targetAssigned: true } });
  const committed = db.commitDraftSession(created.id, {
    memoryConfirmedUtc: new Date().toISOString(),
    baseline: "Ordinary alertness",
    environment: "Deterministic SQLite dry-run",
    safety: { confirmed: true, note: "No participant; no audible session." },
  });
  db.persistTransition(created.id, "READY", {
    trialId: created.trial,
    eventType: "READY_CONFIRMED",
    ready: true,
    participantReady: true,
    payload: { memoryConfirmed: true, safetyConfirmed: true },
  }, { evidence: { memoryConfirmed: true, safetyConfirmed: true } });
  db.persistTransition(created.id, "COMMITTED", {
    trialId: created.trial,
    eventType: "COMMITMENT_RECORDED",
    committed: true,
    configFingerprint: committed.configHash,
    payload: { configFingerprint: committed.configHash },
  }, { evidence: { configFingerprint: committed.configHash } });
  db.persistTransition(created.id, "AUDIO_PREPARING", {
    trialId: created.trial,
    eventType: "COMMIT_AUDIO_CONFIG",
    audioRequested: true,
    audio: {
      recipeId: audio.recipeId,
      recipeVersion: audio.version,
      sampleRate: audio.sampleRate,
      channels: audio.channels,
      configFingerprint: audio.configFingerprint,
    },
  }, { evidence: { committedAudio: true } });

  const handshake = {
    sessionId: created.id,
    trialId: created.trial,
    audioNonce,
    processorVersion: PROCESSOR_VERSION,
    recipeId: audio.recipeId,
    recipeVersion: audio.version,
    sampleRate: audio.sampleRate,
    configFingerprint: audio.configFingerprint,
    digestVersion: PCM_DIGEST_VERSION,
    pcmFormat: PCM_CANONICAL_FORMAT.body,
    channels: audio.channels,
    processorSequence: 1,
  };
  db.persistTransition(created.id, "AUDIO_READY", {
    trialId: created.trial,
    eventType: "AUDIO_READY",
    audioReady: true,
    payload: { acknowledgement: handshake },
  }, { evidence: { handshake: "PROCESSOR_READY" } });
  db.persistTransition(created.id, "RUNNING", {
    trialId: created.trial,
    eventType: "STARTED",
    memoryConfirmed: true,
    audioReady: true,
    payload: { memoryConfirmed: true, audioReady: true },
  }, { evidence: { ownerConfirmedMemory: true } });

  const audioFixture = renderOffline(audio, { targetFrames: Math.round(Number(audio.sampleRate) * 0.1) });
  const audioAnchor = { name: "AUDIO_STARTED", monotonicNs: "1000000000", utcMs: Date.now() };
  db.db.prepare("UPDATE session_details SET audio_processor_version=?,audio_digest_version=?,audio_pcm_format=?,audio_last_processor_sequence=?,actual_start_monotonic_ns=?,actual_start_utc=?,protocol_anchor_json=? WHERE session_id=?")
    .run(PROCESSOR_VERSION, PCM_DIGEST_VERSION, PCM_CANONICAL_FORMAT.body, 2, audioAnchor.monotonicNs, new Date(audioAnchor.utcMs).toISOString(), JSON.stringify({ ...audioAnchor, monotonicNs: audioAnchor.monotonicNs, utc: new Date(audioAnchor.utcMs).toISOString() }), created.id);
  db.evidence.appendEvent(created.id, created.trial, "AUDIO_STARTED", handshake);
  stageFixture(db, created.id, created.trial, audioAnchor);

  const scheduler = new SessionScheduler({
    ...profile,
    mode: SCHEDULER_MODES.PREGENERATED_HIDDEN,
    timing,
    output: { ...profile.output },
  }, {
    sessionId: created.id,
    trialId: created.trial,
    outputProvider: () => assignOutcome(profile, sources[RANDOM_SOURCES.MACHINE_OUTPUT]),
  });
  await scheduler.start();
  const hiddenOutputs = scheduler.getHiddenOutputsForAuthority();
  for (const record of hiddenOutputs) {
    const generatedUtc = new Date(audioAnchor.utcMs + record.sequence).toISOString();
    db.evidence.recordOutput(created.id, {
      trialId: created.trial,
      outputSeq: record.sequence,
      value: record.value,
      region: record.region,
      generatedUtc,
      monotonicNs: (BigInt(audioAnchor.monotonicNs) + BigInt(record.sequence) * 1_000_000n).toString(),
      scheduledUtc: record.scheduledUtc,
      scheduledMonotonicNs: record.scheduledMonotonicNs.toString(),
      actualUtc: generatedUtc,
      actualMonotonicNs: (BigInt(audioAnchor.monotonicNs) + BigInt(record.sequence) * 1_000_000n).toString(),
      latenessMs: 0,
      timingStatus: "ON_TIME",
    });
  }
  db.evidence.finalizeOutput(created.id, {
    finalStreamDigest: audioFixture.digest,
    frameCount: audioFixture.frames,
    format: {
      digestVersion: PCM_DIGEST_VERSION,
      header: PCM_CANONICAL_FORMAT,
      sampleRate: audioFixture.recipe.sampleRate,
      channels: audioFixture.recipe.channels,
      sampleFormat: "PCM16LE_INTERLEAVED_LR",
      processorVersion: PROCESSOR_VERSION,
    },
  });
  db.evidence.appendEvent(created.id, created.trial, "AUDIO_FINALIZED", {
    ...handshake,
    totalFrames: audioFixture.frames,
    digest: audioFixture.digest,
    continuity: audioFixture.telemetry.continuity,
    clipping: audioFixture.telemetry.clipping,
    processorSequence: 3,
  });
  const analysis = analyzeStream({
    requested: objective,
    values: hiddenOutputs.map((record) => record.value),
    primary: [profile.output.preBlocks * profile.output.blockSize, (profile.output.preBlocks + profile.output.primaryBlocks) * profile.output.blockSize],
    exploratory: [[0, profile.output.preBlocks * profile.output.blockSize], [(profile.output.preBlocks + profile.output.primaryBlocks) * profile.output.blockSize, hiddenOutputs.length]],
  });
  db.analyses.save(created.id, { ...analysis, analysisVersion: profile.analysis?.version || "analysis-v1" }, { input: { requested: objective, values: hiddenOutputs.map((record) => record.value) }, analysisVersion: profile.analysis?.version || "analysis-v1" });
  db.persistTransition(created.id, "RETURNED", {
    trialId: created.trial,
    eventType: "RETURN_CONFIRMED",
    returned: true,
    outputComplete: true,
    payload: { generatedCount: hiddenOutputs.length, schedulerStatus: scheduler.status, audioFinalized: true },
  }, { evidence: { schedulerStatus: scheduler.status } });

  const rawReport = { subjectiveTime: "Unknown", intensity: "0", modality: "none", certainty: "100", notes: "Automated no-participant SQLite dry-run." };
  db.saveReportDraft(created.id, rawReport);
  db.lockRawReportAtomic(created.id, rawReport, profile.reporting?.version || "report-v1");
  db.persistTransition(created.id, "REVEALED", {
    trialId: created.trial,
    eventType: "REVEALED",
    revealAuthorized: true,
    payload: { objective },
  }, { evidence: { ownerAuthorizedReveal: true } });

  const integrity = db.integrity.verifySession(created.id, { persist: false });
  if (!integrity.valid) throw new Error(`SQLite dry-run integrity failed: ${integrity.errors.join("; ")}`);
  const exported = db.exporter.exportSession(created.id, { includeHidden: true });
  const reportPath = path.join(root, "dry-run-report.json");
  const report = {
    command: "npm run dry-run",
    storage: "SQLite / MipDatabase",
    root,
    database: db.file,
    sessionId: created.id,
    trialId: created.trial,
    objective,
    outputCount: hiddenOutputs.length,
    audio: { digest: audioFixture.digest, frames: audioFixture.frames, handshake },
    integrity,
    export: exported,
    timedVerification: "not executed",
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    root,
    database: db.file,
    sessionId: created.id,
    outputCount: hiddenOutputs.length,
    integrity: { valid: integrity.valid, eventCount: integrity.eventCount, machineOutputCount: integrity.machineOutputCount },
    exportDirectory: exported.directory,
    report: reportPath,
  }, null, 2));
} finally {
  db.close();
}
