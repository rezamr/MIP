import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  powerMonitor,
  powerSaveBlocker,
  session,
} from "electron";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MipDatabase, requiresStrictResearchGate } from "./database/db.js";
import {
  analyzeStream,
  APP_VERSION,
  assignOutcome,
  canonical,
  ENGINE_VERSION,
  requestInstruction,
  sampleOutcome,
  normalizeOutcomeSpace,
  outcomeSpaceSize,
  containsOutcome,
  resolveEffectiveConfiguration,
  createCompatibilityFingerprint,
  EXPERIMENT_MODES,
  sha256,
  timingPlan,
  validateProfile,
} from "../engine.js";
import {
  AUDIO_VERSION,
  quickRecipe,
  validateRecipe,
} from "../audio.js";
import {
  PCM_CANONICAL_FORMAT,
  PCM_DIGEST_VERSION,
  PROCESSOR_VERSION,
  normalizeRecipe,
  validateEffectiveRecipe,
  activeLayers,
  summarizeProvenance,
} from "../../public/audio-core.js";
import {
  SESSION_STATES,
  SessionController,
} from "./sessions/session-controller.js";
import {
  SCHEDULER_MODES,
  SessionScheduler,
} from "./sessions/session-scheduler.js";
import { ProtocolStageController } from "./sessions/protocol-stage-controller.js";
import { TemporalEvidenceScheduler } from "./sessions/temporal-evidence-scheduler.js";
import { classifyStartupRecovery } from "./sessions/recovery-policy.js";
import { analyzeTemporalEvidence, findTargetOccurrences, aggregateCrossSession } from "./analysis/temporal-analysis.js";
import {
  RANDOM_SOURCES,
  createRandomSources,
  randomSourcesMetadata,
} from "./random/random-domains.js";
import { PowerManager } from "./power/power-manager.js";
import { runElectronE2E } from "./app/e2e.js";
import { createSecureIpcRouter } from "./ipc/secure-handler.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..", "..");
const rendererFile = path.join(projectRoot, "public", "index.html");
const preloadFile = path.join(projectRoot, "src", "preload", "preload.cjs");
const iconFile = path.join(projectRoot, "build", "icon.ico");
const FORMAL_ACTIVE_STATES = [
  "DRAFT",
  "TARGET_ASSIGNED",
  "READY",
  "COMMITTED",
  "AUDIO_PREPARING",
  "AUDIO_READY",
  "RUNNING",
  "TIMING_DEVIATION",
  "INTERRUPTED",
  "AUDIO_FAILED",
  "RECOVERY_REQUIRED",
];
const ALWAYS_HIDDEN_KEYS = new Set([
  "rootseed",
  "domainseed",
  "seed",
  "secret",
  "secretkey",
  "privatekey",
]);
const PRE_REVEAL_KEYS = new Set([
  "objective",
  "hiddenobjective",
  "hidden_objective",
  "actualobjective",
  "actualobjectivestate",
  "participanttarget",
  "participant_target",
  "target",
  "requested",
  "canonicalconfig",
  "canonical_config",
  "canonical_config_json",
  "configsnapshot",
  "session_snapshot",
  "session_snapshot_json",
  "manifest",
  "manifestjson",
  "manifest_json",
  "material",
  "value",
  "valuejson",
  "value_json",
  "recordhash",
  "record_hash",
  "outputhash",
  "output_hash",
  "finalfingerprint",
  "final_fingerprint",
  "machineoutputfingerprint",
  "streamdigest",
  "finalstreamdigest",
  "final_stream_digest",
  "analysishash",
  "analysis_hash",
  "inputhash",
  "input_hash",
]);

let db = null;
let mainWindow = null;
let powerManager = null;
let settings = {};
let shutdownStarted = false;
const runtimes = new Map();
const healthChallenges = new Map();
const { handle } = createSecureIpcRouter({
  ipcMain,
  getMainWindow: () => mainWindow,
  rendererFile,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseStoredJson(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, jsonSafe(child)]),
  );
}

function assertJsonValue(value, name = "payload", seen = new WeakSet(), depth = 0) {
  if (depth > 20) throw new Error(`${name} is too deeply nested.`);
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${name} contains a non-finite number.`);
    return value;
  }
  if (typeof value !== "object") throw new Error(`${name} contains an unsupported value.`);
  if (seen.has(value)) throw new Error(`${name} must not contain cycles.`);
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 100_000) throw new Error(`${name} contains too many entries.`);
    value.forEach((child, index) => assertJsonValue(child, `${name}[${index}]`, seen, depth + 1));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error(`${name} must contain plain objects only.`);
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error(`${name} contains a forbidden property.`);
      assertJsonValue(child, `${name}.${key}`, seen, depth + 1);
    }
  }
  seen.delete(value);
  return value;
}

function objectPayload(value, name = "payload", options = {}) {
  if (value === undefined && options.optional) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be an object.`);
  assertJsonValue(value, name);
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > (options.maxBytes || 1_000_000))
    throw new Error(`${name} is too large.`);
  return value;
}

function stringValue(value, name, options = {}) {
  if ((value === undefined || value === null) && options.optional) return options.defaultValue;
  if (typeof value !== "string") throw new Error(`${name} must be a string.`);
  const result = options.trim === false ? value : value.trim();
  const minimum = options.min ?? 1;
  const maximum = options.max ?? 256;
  if (result.length < minimum || result.length > maximum)
    throw new Error(`${name} must contain ${minimum}-${maximum} characters.`);
  if (options.pattern && !options.pattern.test(result)) throw new Error(`${name} has an invalid format.`);
  return result;
}

function identifier(value, name) {
  return stringValue(value, name, {
    max: 128,
    pattern: /^[A-Za-z0-9][A-Za-z0-9._:~-]*$/,
  });
}

function positiveInteger(value, name, options = {}) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < (options.min ?? 1) || result > (options.max ?? Number.MAX_SAFE_INTEGER))
    throw new Error(`${name} must be a valid integer.`);
  return result;
}

function finiteNumber(value, name, options = {}) {
  const result = Number(value);
  if (!Number.isFinite(result) || (options.min !== undefined && result < options.min) || (options.max !== undefined && result > options.max))
    throw new Error(`${name} must be a valid number.`);
  return result;
}

function sessionId(payload) {
  const value = objectPayload(payload);
  return identifier(value.id, "session id");
}

function assertSessionExists(id) {
  const row = db.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(id);
  if (!row) throw new Error("Session not found.");
  return row;
}

function sessionStatus(id) {
  return assertSessionExists(id).status;
}

function isRevealed(id) {
  return ["REVEALED", "COMPLETE"].includes(sessionStatus(id));
}

function redactSessionData(value, revealed) {
  if (Array.isArray(value)) return value.map((child) => redactSessionData(child, revealed));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => {
        const normalized = key.replaceAll("-", "").toLowerCase();
        if (ALWAYS_HIDDEN_KEYS.has(normalized) && normalized !== "seedpresent") return false;
        return revealed || !PRE_REVEAL_KEYS.has(normalized);
      })
      .map(([key, child]) => [key, redactSessionData(child, revealed)]),
  );
}

function sessionDto(id) {
  const revealed = isRevealed(id);
  const value = revealed ? db.sessions.getFull(id) : db.sessions.getRedacted(id);
  if (!value) throw new Error("Session not found.");
  // SessionRepository owns the explicit public/private DTO boundary.  The
  // recursive legacy redactor remains only for free-form notes/annotations;
  // it is not used to decide which session fields are exposed.
  const dto = { ...value };
  dto.rawReportLocked = Boolean(value.rawReportLocked);
  dto.revealEligible = value.status === "REVEAL_ELIGIBLE";
  dto.revealed = revealed;
  dto.hasReveal = revealed;
  if (!revealed) delete dto.outputHash;
  return dto;
}

function trialIdFor(id) {
  return db.sessions.trials(id)[0]?.trialId || null;
}

function transitionAdapter(id, trialId, lifecycle = {}) {
  let appended = null;
  return {
    transaction(callback) {
      return db.db.transaction(() => {
        lifecycle.before?.();
        const result = callback();
        lifecycle.after?.();
        return result;
      })();
    },
    appendEvent(event) {
      appended = db.evidence.appendEvent(
        id,
        trialId,
        event.eventType,
        jsonSafe(event.payload),
      );
      return appended;
    },
    updateProjection(projection) {
      const persisted = db.evidence.projectTransition(
        id,
        trialId,
        projection.from,
        projection.to,
        { eventId: appended?.eventId },
      );
      db.sessions.setStatus(id, projection.state, lifecycle.recoveryState ?? null);
      if (trialId)
        db.db.prepare("UPDATE trials SET state=? WHERE trial_id=?").run(projection.state, trialId);
      db.evidence.addTransitionEvidence(id, {
        trialId,
        projectionId: persisted.projectionId,
        evidenceEventId: appended?.eventId || null,
        evidenceType: projection.to,
        evidence: jsonSafe(lifecycle.evidence || {}),
      });
      return persisted;
    },
  };
}

function controllerFor(id) {
  const runtime = runtimes.get(id);
  if (runtime) return runtime.controller;
  const state = sessionStatus(id);
  if (!Object.values(SESSION_STATES).includes(state))
    throw new Error(`Session state is not managed by the formal controller: ${state}`);
  return new SessionController(state, { sessionId: id, trialId: trialIdFor(id) });
}

async function transitionSession(id, to, context = {}, lifecycle = {}) {
  const controller = controllerFor(id);
  const trialId = context.trialId ?? trialIdFor(id);
  const adapter = transitionAdapter(id, trialId, lifecycle);
  return controller.transitionTransactional(to, {
    ...context,
    sessionId: id,
    trialId,
    adapter,
    eventType: context.eventType || `SESSION_${to}`,
  });
}

function activeFormalSession() {
  const placeholders = FORMAL_ACTIVE_STATES.map(() => "?").join(",");
  return db.db
    .prepare(`
      SELECT s.session_id,s.status
      FROM sessions s
      LEFT JOIN session_phase_projections sp ON sp.session_id=s.session_id
      WHERE s.status IN (${placeholders})
       OR (s.status IN ('RETURNED','RAW_REPORT_DRAFT','RAW_REPORT_LOCKED') AND (
            sp.evidence_phase_status IN ('RUNNING','TARGET_PENDING','TARGET_GENERATED','TARGET_OBSERVED','POST_TARGET_MONITORING')
            OR sp.session_lifecycle='RECOVERY_REQUIRED'
          ))
      ORDER BY s.created_utc DESC LIMIT 1
    `)
    .get(...FORMAL_ACTIVE_STATES) || null;
}

function appendPowerEvidence(event) {
  for (const runtime of runtimes.values()) {
    if (!["RUNNING", "TIMING_DEVIATION", "INTERRUPTED"].includes(runtime.controller.state)) continue;
    db.evidence.appendEvent(runtime.id, runtime.trialId, event.type, jsonSafe(event));
  }
}

function requestAudioStop(runtime, reason = "owner_returned") {
  if (!runtime || runtime.audioStopRequested) return false;
  runtime.audioStopRequested = true;
  db.evidence.appendEvent(runtime.id, runtime.trialId, "AUDIO_STOP_REQUESTED", {
    reason,
    requestedUtc: new Date().toISOString(),
    requestedMonotonicNs: process.hrtime.bigint().toString(),
  });
  return true;
}

function rejectAudioFinalization(runtime, reason, payload = {}) {
  try {
    db.evidence.appendEvent(runtime.id, runtime.trialId, "AUDIO_FINALIZATION_REJECTED", {
      classification: "AUDIO_AUTHENTICATION_FAILURE",
      reason,
      ...clone(payload),
    });
  } catch {}
  throw new Error(reason);
}

async function failRuntimeClosed(runtime, reason, payload = {}) {
  if (!runtime) return;
  runtime.failure = { reason, ...clone(payload) };
  try { requestAudioStop(runtime, reason); } catch (error) {
    runtime.failure = { ...runtime.failure, stopEvidenceError: error.message };
  }
  try { runtime.protocolStageController?.stop(reason); } catch (error) {
    runtime.failure = { ...runtime.failure, protocolStopError: error.message };
  }
  try {
    if (runtime.scheduler && ["RUNNING", "COMMITTED"].includes(runtime.scheduler.status))
      runtime.scheduler.interrupt(reason);
  } catch (error) {
    runtime.failure = { ...runtime.failure, schedulerStopError: error.message };
  }
  try { powerManager?.stop(); } catch (error) {
    runtime.failure = { ...runtime.failure, powerStopError: error.message };
  }
  const state = runtime.controller?.state;
  if (["RUNNING", "TIMING_DEVIATION"].includes(state)) {
    try {
      await transitionSession(runtime.id, "RECOVERY_REQUIRED", {
        trialId: runtime.trialId,
        eventType: "LOGGING_FAILURE",
        recoveryRequired: true,
        recoveryReason: reason,
        payload: { classification: "LOGGING_FAILURE", reason, ...clone(payload) },
      }, { recoveryState: "LOGGING_FAILURE", evidence: { classification: "LOGGING_FAILURE", reason } });
      db.research?.updatePhases(runtime.id, {
        sessionLifecycle: "RECOVERY_REQUIRED",
        participantPhaseStatus: "FAILED",
        evidencePhaseStatus: "FAILED",
      });
    } catch (error) {
      try { db.evidence.appendEvent(runtime.id, runtime.trialId, "LOGGING_FAILURE_UNRECOVERED", { reason, error: error.message }); } catch {}
    }
  } else if (["AUDIO_PREPARING", "AUDIO_READY"].includes(state)) {
    // A rejected worklet handshake is a durable audio failure, not merely a
    // renderer error.  Move through AUDIO_FAILED and then require explicit
    // recovery so the session can never remain apparently ready forever.
    try {
      await transitionSession(runtime.id, "AUDIO_FAILED", {
        trialId: runtime.trialId,
        eventType: "AUDIO_AUTHENTICATION_FAILURE",
        audioFailed: true,
        error: reason,
        payload: { classification: "AUDIO_AUTHENTICATION_FAILURE", reason, ...clone(payload) },
      }, { recoveryState: "AUDIO_AUTHENTICATION_FAILURE", evidence: { classification: "AUDIO_AUTHENTICATION_FAILURE", reason } });
      await transitionSession(runtime.id, "RECOVERY_REQUIRED", {
        trialId: runtime.trialId,
        eventType: "RECOVERY_REQUIRED",
        recoveryRequired: true,
        recoveryReason: reason,
        payload: { classification: "AUDIO_AUTHENTICATION_FAILURE", reason },
      }, { recoveryState: "AUDIO_AUTHENTICATION_FAILURE", evidence: { classification: "AUDIO_AUTHENTICATION_FAILURE", reason } });
      db.research?.updatePhases(runtime.id, {
        sessionLifecycle: "RECOVERY_REQUIRED",
        participantPhaseStatus: "FAILED",
        evidencePhaseStatus: "FAILED",
      });
    } catch (error) {
      try { db.evidence.appendEvent(runtime.id, runtime.trialId, "AUDIO_FAILURE_UNRECOVERED", { reason, error: error.message }); } catch {}
    }
  }
}

function protocolCues(protocol = {}, sampleRate) {
  const durations = [
    ["INDUCTION_START", Number(protocol.inductionSeconds || 0)],
    ["SETTLING_START", Number(protocol.settleSeconds || 0)],
    ["REQUEST_START", Number(protocol.requestSeconds || 0)],
    ["REQUEST_END", 0],
    ["RELEASE_START", Number(protocol.releaseSeconds || 0)],
    ["NEUTRAL_OBSERVATION", Number(protocol.neutralSeconds || 0)],
    ["POST_REQUEST", 0],
    ["RETURN_CUE", Number(protocol.returnSeconds || 0)],
  ];
  let elapsed = 0;
  return durations.map(([stageType, duration]) => {
    const cue = {
      id: `protocol-${stageType.toLowerCase()}`,
      startFrame: Math.max(0, Math.round(elapsed * sampleRate)),
      durationFrames: Math.max(1, Math.round(Math.min(0.25, Math.max(0.05, duration || 0.1)) * sampleRate)),
      leftHz: 880,
      rightHz: 884,
      gain: 0.015,
      phase: { left: 0, right: 0 },
      waveform: "sine",
    };
    elapsed += duration;
    return cue;
  });
}

function completeAudioRecipe(recipe, audioSource, requestedSampleRate, protocol = null) {
  const sampleRate = requestedSampleRate === undefined
    ? Number(recipe.sampleRate)
    : positiveInteger(requestedSampleRate, "sampleRate", { min: 8_000, max: 192_000 });
  const input = clone(recipe);
  if (input.noise) input.noise.seed = audioSource.int(65_535) + 1;
  input.sampleRate = sampleRate;
  // Protocol cues are a separately versioned track.  They must not mutate the
  // selected recipe's declared component layers (for example A-U396-4 must
  // remain a pure carrier condition), while the committed effective audio
  // configuration still includes the exact shared cue track and fingerprint.
  if (protocol) {
    input.protocolCueVersion = "MIP_PROTOCOL_CUES_V1";
    input.protocolCues = protocolCues(protocol, sampleRate);
  }
  const effective = normalizeRecipe(input);
  const validation = validateEffectiveRecipe(effective);
  if (!validation.valid) throw new Error(`Committed audio recipe is invalid: ${validation.errors.join("; ")}`);
  return effective;
}

function audioSummary(audio, options = {}) {
  const summary = {
    recipeId: audio.recipeId,
    recipeVersion: audio.version,
    version: audio.version,
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    processorVersion: PROCESSOR_VERSION,
    provenance: audio.provenance,
    historicalStatus: audio.historicalStatus,
    historicalExactness: audio.historicalExactness,
    activeLayers: activeLayers(audio),
    formalEligibility: audio.formalOperationalEligibility === true || audio.formalEligibility === true,
    formalOperationalEligibility: audio.formalOperationalEligibility === true || audio.formalEligibility === true,
    protocolCueVersion: audio.protocolCueVersion || null,
    protocolCueCount: Array.isArray(audio.protocolCues) ? audio.protocolCues.length : 0,
  };
  if (options.includeFingerprint !== false) summary.configFingerprint = audio.configFingerprint;
  if (options.includeProvenance !== false) summary.provenanceSummary = summarizeProvenance(audio);
  return summary;
}

function expectedAudioAck(runtime, type) {
  const expected = {
    type,
    processorVersion: PROCESSOR_VERSION,
    recipeId: runtime.audio.recipeId,
    recipeVersion: runtime.audio.version,
    sampleRate: runtime.audio.sampleRate,
    configFingerprint: runtime.audio.configFingerprint,
  };
  if (runtime.audioNonce) Object.assign(expected, {
    sessionId: runtime.id,
    trialId: runtime.trialId,
    audioNonce: runtime.audioNonce,
    digestVersion: PCM_DIGEST_VERSION,
    pcmFormat: PCM_CANONICAL_FORMAT.body,
    channels: runtime.audio.channels,
  });
  return expected;
}

function validateProcessorReady(runtime, acknowledgement) {
  const ack = objectPayload(acknowledgement, "PROCESSOR_READY acknowledgement", { maxBytes: 128_000 });
  for (const [field, expected] of Object.entries(expectedAudioAck(runtime, "PROCESSOR_READY"))) {
    if (ack[field] !== expected)
      throw new Error(`PROCESSOR_READY ${field} does not match the committed audio configuration.`);
  }
  if (ack.contextState !== undefined)
    stringValue(ack.contextState, "PROCESSOR_READY contextState", { max: 32 });
  for (const field of ["baseLatency", "outputLatency"]) {
    if (ack[field] !== undefined && ack[field] !== null)
      finiteNumber(ack[field], `PROCESSOR_READY ${field}`, { min: 0 });
  }
  if (runtime.audioNonce) {
    if (ack.sessionId !== runtime.id || ack.trialId !== runtime.trialId || ack.audioNonce !== runtime.audioNonce)
      throw new Error("PROCESSOR_READY audio session challenge does not match the main-process challenge.");
    if (ack.digestVersion !== PCM_DIGEST_VERSION || ack.pcmFormat !== PCM_CANONICAL_FORMAT.body || ack.channels !== runtime.audio.channels)
      throw new Error("PROCESSOR_READY canonical PCM identity does not match the committed audio configuration.");
  }
  return clone(ack);
}

function validateTelemetry(runtime, telemetry) {
  const value = objectPayload(telemetry, "audio telemetry", { maxBytes: 256_000 });
  for (const [field, expected] of Object.entries({
    type: "TELEMETRY",
    recipeId: runtime.audio.recipeId,
    recipeVersion: runtime.audio.version,
    sampleRate: runtime.audio.sampleRate,
    configFingerprint: runtime.audio.configFingerprint,
  })) {
    if (value[field] !== expected) throw new Error(`Audio telemetry ${field} does not match the committed configuration.`);
  }
  positiveInteger(value.generatedFrames ?? value.frames, "audio telemetry frames", { min: 0 });
  stringValue(value.state, "audio telemetry state", { max: 32 });
  objectPayload(value.continuity, "audio telemetry continuity", { maxBytes: 32_000 });
  if (typeof value.clipping !== "boolean") throw new Error("Audio telemetry clipping must be boolean.");
  if (runtime.audioNonce) {
    if (typeof value.continuity?.ok !== "boolean" || !Number.isSafeInteger(Number(value.continuity?.errors ?? 0)) || Number(value.continuity?.errors ?? 0) < 0)
      throw new Error("Audio telemetry continuity status is invalid.");
    for (const [field, expected] of Object.entries(expectedAudioAck(runtime, "TELEMETRY"))) {
      if (value[field] !== expected) throw new Error(`Audio telemetry ${field} does not match the main-process audio challenge.`);
    }
    positiveInteger(value.processorSequence, "audio telemetry processorSequence", { min: 1 });
    if (runtime.lastProcessorSequence !== null && value.processorSequence <= runtime.lastProcessorSequence)
      throw new Error("Audio telemetry processorSequence is not strictly increasing.");
    runtime.lastProcessorSequence = value.processorSequence;
    if (value.digestVersion !== PCM_DIGEST_VERSION || value.pcmFormat !== PCM_CANONICAL_FORMAT.body || value.channels !== runtime.audio.channels)
      throw new Error("Audio telemetry canonical PCM identity is invalid.");
  }
  return clone(value);
}

function validateAudioStarted(runtime, acknowledgement) {
  const value = objectPayload(acknowledgement, "AUDIO_STARTED acknowledgement", { maxBytes: 128_000 });
  const expected = expectedAudioAck(runtime, "AUDIO_STARTED");
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (value[field] !== expectedValue)
      throw new Error(`AUDIO_STARTED ${field} does not match the committed audio challenge.`);
  }
  positiveInteger(value.frame, "AUDIO_STARTED frame", { min: 1 });
  if (value.processorSequence !== undefined) positiveInteger(value.processorSequence, "AUDIO_STARTED processorSequence", { min: 1 });
  if (value.contextFrame !== null && value.contextFrame !== undefined) positiveInteger(value.contextFrame, "AUDIO_STARTED contextFrame", { min: 0 });
  if (value.currentTime !== null && value.currentTime !== undefined) finiteNumber(value.currentTime, "AUDIO_STARTED currentTime", { min: 0 });
  if (runtime.audioNonce && value.processorSequence === undefined)
    throw new Error("AUDIO_STARTED processorSequence is required for challenged audio.");
  if (runtime.audioNonce && value.digestVersion !== PCM_DIGEST_VERSION)
    throw new Error("AUDIO_STARTED digestVersion is invalid.");
  return clone(value);
}

function validateAudioFinalization(runtime, finalization) {
  const value = objectPayload(finalization, "AUDIO_FINALIZED acknowledgement", { maxBytes: 512_000 });
  for (const [field, expected] of Object.entries({
    type: "AUDIO_FINALIZED",
    processorVersion: PROCESSOR_VERSION,
    recipeId: runtime.audio.recipeId,
    recipeVersion: runtime.audio.version,
    sampleRate: runtime.audio.sampleRate,
  })) {
    if (value[field] !== expected) throw new Error(`AUDIO_FINALIZED ${field} does not match the committed configuration.`);
  }
  if (typeof value.digest !== "string" || !/^[a-f0-9]{64}$/i.test(value.digest))
    throw new Error("AUDIO_FINALIZED digest must be a SHA-256 digest from the processor.");
  positiveInteger(value.totalFrames, "AUDIO_FINALIZED totalFrames", { min: 0 });
  for (const field of ["startFrame", "endFrame", "startContextFrame", "endContextFrame", "contextFrame"]) {
    if (value[field] !== null && value[field] !== undefined)
      positiveInteger(value[field], `AUDIO_FINALIZED ${field}`, { min: 0 });
  }
  for (const field of ["startContextTime", "endContextTime", "currentTime"]) {
    if (value[field] !== null && value[field] !== undefined)
      finiteNumber(value[field], `AUDIO_FINALIZED ${field}`, { min: 0 });
  }
  objectPayload(value.continuity, "AUDIO_FINALIZED continuity", { maxBytes: 32_000 });
  if (typeof value.clipping !== "boolean") throw new Error("AUDIO_FINALIZED clipping must be boolean.");
  if (!Array.isArray(value.processorErrors)) throw new Error("AUDIO_FINALIZED processorErrors must be an array.");
  if (runtime.audioNonce) {
    if (typeof value.continuity?.ok !== "boolean" || !Number.isSafeInteger(Number(value.continuity?.errors ?? 0)) || Number(value.continuity?.errors ?? 0) < 0)
      throw new Error("AUDIO_FINALIZED continuity status is invalid.");
    for (const [field, expected] of Object.entries(expectedAudioAck(runtime, "AUDIO_FINALIZED"))) {
      if (value[field] !== expected) throw new Error(`AUDIO_FINALIZED ${field} does not match the main-process audio challenge.`);
    }
    if (value.digestVersion !== PCM_DIGEST_VERSION || value.pcmFormat !== PCM_CANONICAL_FORMAT.body || value.channels !== runtime.audio.channels)
      throw new Error("AUDIO_FINALIZED canonical PCM identity is invalid.");
    positiveInteger(value.processorSequence, "AUDIO_FINALIZED processorSequence", { min: 1 });
    if (runtime.lastProcessorSequence !== null && value.processorSequence < runtime.lastProcessorSequence)
      throw new Error("AUDIO_FINALIZED processorSequence regressed.");
    const lastFrames = Number(runtime.latestTelemetry?.generatedFrames ?? runtime.latestTelemetry?.frames ?? 0);
    if (Number(value.totalFrames) < lastFrames) throw new Error("AUDIO_FINALIZED totalFrames is below accepted telemetry.");
  }
  return clone(value);
}

function schedulerIntervalMs(profile) {
  const output = profile.output || {};
  if (output.intervalMs !== undefined)
    return finiteNumber(output.intervalMs, "output.intervalMs", { min: Number.MIN_VALUE });
  const blockSize = positiveInteger(output.blockSize ?? 1, "output.blockSize");
  const total = ["preBlocks", "primaryBlocks", "postBlocks"]
    .reduce((sum, key) => sum + positiveInteger(output[key] ?? 0, `output.${key}`, { min: 0 }), 0) * blockSize;
  if (!total) return 1;
  const durationSeconds = Number(profile.protocol?.requestSeconds || 0) +
    Number(profile.protocol?.releaseSeconds || 0) +
    Number(profile.protocol?.neutralSeconds || 0);
  return durationSeconds > 0 ? durationSeconds * 1_000 / total : 1;
}

function createScheduler(runtime) {
  const profile = runtime.profile;
  const research = runtime.researchDefinition || {};
  const timing = { ...profile.timing };
  const config = {
    ...profile,
    mode: timing.mode,
    timing,
    output: { ...profile.output },
  };
  if (timing.targetUtc) config.absoluteUtc = timing.targetUtc;
  if ([SCHEDULER_MODES.IMMEDIATE_REQUEST, SCHEDULER_MODES.CONTINUOUS_AROUND_REQUEST].includes(timing.mode)) {
    const preCount = Number(profile.output?.preBlocks || 0) * Number(profile.output?.blockSize || 1);
    const leadMs = preCount * schedulerIntervalMs(profile);
    config.requestMonotonicNs = process.hrtime.bigint() + BigInt(Math.round(leadMs * 1e6));
    config.requestUtc = new Date(Date.now() + leadMs).toISOString();
  }
  const temporal = isTemporalResearchDefinition(research);
  if (temporal) {
    const temporalOutput = { ...profile.output };
    const committedWindows = Array.isArray(research.temporalAnalysis?.windows)
      ? research.temporalAnalysis.windows
      : [];
    const hasCommittedTimeWindow = committedWindows.some((window) => window?.enabled !== false && (
      Number(window?.preMs || 0) > 0 || Number(window?.postMs || 0) > 0
    ));
    // For a target-anchored temporal definition the committed duration and
    // cadence define the opportunity set. Profile block counts remain the
    // backwards-compatible fallback for exact-slot/binary sessions that do
    // not declare a duration window; they must not silently override a
    // session-level T-relative timing override.
    if (hasCommittedTimeWindow) {
      for (const key of ["preCount", "primaryCount", "postCount", "preBlocks", "primaryBlocks", "postBlocks"])
        delete temporalOutput[key];
    }
    const scheduler = new TemporalEvidenceScheduler({
      ...profile,
      mode: research.mode || profile.mode || EXPERIMENT_MODES.INFLUENCE,
      outcomeSpace: research.outcomeSpace || profile.outcomeSpace,
      target: runtime.objective,
      prediction: runtime.prediction,
      targetDefinition: research.targetDefinition || {
        mode: research.mode || profile.mode || EXPERIMENT_MODES.INFLUENCE,
        anchor: runtime.protocolAnchor?.name || "PARTICIPANT_REQUEST",
        scheduledUtc: timing.scheduledUtc,
        scheduledMonotonicNs: timing.scheduledMonotonicNs,
      },
      temporalAnalysis: research.temporalAnalysis || profile.analysis,
      analysis: research.temporalAnalysis || profile.analysis,
      output: temporalOutput,
    }, {
      sessionId: runtime.id,
      trialId: runtime.trialId,
      randomSource: runtime.randomSources[RANDOM_SOURCES.FUTURE_TARGET],
      machineRandomSource: runtime.randomSources[RANDOM_SOURCES.MACHINE_OUTPUT],
      target: runtime.objective,
      outputProvider: ({ randomSource }) => sampleOutcome(research.outcomeSpace || profile.outcomeSpace, randomSource),
      onOutput: (record) => {
        db.evidence.recordOutput(runtime.id, {
          trialId: runtime.trialId,
          outputSeq: record.sequence,
          value: record.value,
          region: record.region,
          generatedUtc: record.actualUtc,
          monotonicNs: record.actualMonotonicNs,
          scheduledUtc: record.scheduledUtc,
          scheduledMonotonicNs: record.scheduledMonotonicNs?.toString?.() || record.scheduledMonotonicNs,
          actualUtc: record.actualUtc,
          actualMonotonicNs: record.actualMonotonicNs,
          latenessMs: record.latenessMs,
          timingStatus: record.status,
        });
        if (research.mode === EXPERIMENT_MODES.FUTURE_TARGET && record.targetSlot)
          db.research.updatePhases(runtime.id, { evidencePhaseStatus: runtime.scheduler?.targetMissed ? "MISSED" : record.status === "MISSED" ? "POST_TARGET_MONITORING" : "TARGET_OBSERVED" });
        if (runtime.objective !== null && runtime.objective !== undefined) {
          for (const occurrence of findTargetOccurrences({ outputs: [record], target: runtime.objective, outcomeSpace: research.outcomeSpace || profile.outcomeSpace, window: research.temporalAnalysis?.windows?.[0] || {}, targetScheduledUtc: runtime.scheduler?.plan?.targetUtc, targetScheduledMonotonicNs: runtime.scheduler?.plan?.targetMonotonicNs })) {
            db.research.recordOccurrence(runtime.id, occurrence);
          }
        }
      },
      onTargetGenerated: (event) => {
        runtime.objective = event.target;
        db.research.recordTargetGeneration(runtime.id, event);
        db.research.updatePhases(runtime.id, { evidencePhaseStatus: "TARGET_GENERATED" });
        // FUTURE_TARGET participant prediction is a precommitted observation,
        // not an instruction rewritten with the later machine target.  Keep
        // the prediction text immutable and persist only the hidden objective
        // when the anchor is reached.
        db.db.prepare("UPDATE sessions SET hidden_objective=? WHERE session_id=? AND hidden_objective IS NULL")
          .run(JSON.stringify(event.target), runtime.id);
        // Once the future target exists, classify any already-recorded
        // outputs against it in the authority.  This does not reveal values
        // to the renderer and preserves pre-anchor occurrences for analysis.
        const priorOutputs = db.db.prepare("SELECT session_id,trial_id,output_seq,value_json,region,scheduled_utc,scheduled_monotonic_ns,actual_utc,actual_monotonic_ns,timing_status FROM machine_outputs WHERE session_id=? ORDER BY output_seq").all(runtime.id).map((row) => ({ sessionId: row.session_id, trialId: row.trial_id, sequence: row.output_seq, outputSeq: row.output_seq, value: parseStoredJson(row.value_json), region: row.region, scheduledUtc: row.scheduled_utc, scheduledMonotonicNs: row.scheduled_monotonic_ns, actualUtc: row.actual_utc, actualMonotonicNs: row.actual_monotonic_ns, status: row.timing_status }));
        for (const occurrence of findTargetOccurrences({ outputs: priorOutputs, target: event.target, outcomeSpace: runtime.researchDefinition?.outcomeSpace || runtime.profile.outcomeSpace, window: runtime.researchDefinition?.temporalAnalysis?.windows?.[0] || {}, targetScheduledUtc: event.scheduledUtc, targetScheduledMonotonicNs: event.scheduledMonotonicNs })) db.research.recordOccurrence(runtime.id, occurrence);
      },
      onTargetMissed: (event) => {
        db.research.recordTargetGeneration(runtime.id, event);
        db.research.updatePhases(runtime.id, { evidencePhaseStatus: "MISSED", revealStatus: "BLOCKED" });
        try { powerManager?.stop(); } catch (error) {
          try { db.evidence.appendEvent(runtime.id, runtime.trialId, "POWER_BLOCKER_STOP_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" }); } catch {}
        }
      },
      onParticipantPhase: (phase) => db.research.updatePhases(runtime.id, { participantPhaseStatus: phase.participantPhase }),
      onEvidence: (event) => db.evidence.appendEvent(runtime.id, runtime.trialId, event.type, jsonSafe(event.payload)),
      onComplete: (result) => {
        runtime.schedulerResult = clone(result);
        db.research.updatePhases(runtime.id, { evidencePhaseStatus: result.targetMissed ? "MISSED" : "COMPLETE", revealStatus: result.targetMissed ? "BLOCKED" : undefined });
        db.evidence.appendEvent(runtime.id, runtime.trialId, "SCHEDULER_COMPLETE", jsonSafe(result));
        // The power-save blocker belongs to the evidence lifecycle, not the
        // participant/audio lifecycle.  Keep it active after participant
        // return and release it only when the committed evidence schedule
        // has actually completed.
        try { powerManager?.stop(); } catch (error) {
          try { db.evidence.appendEvent(runtime.id, runtime.trialId, "POWER_BLOCKER_STOP_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" }); } catch {}
        }
        try {
          const derived = persistedAnalysis(runtime);
          // A temporal participant may return and lock the raw report while
          // machine evidence is still running.  Always append the completed
          // temporal analysis here so the final post-target evidence becomes
          // the authoritative latest analysis version; a provisional
          // return-time snapshot must never suppress that update.
          db.analyses.save(runtime.id, derived.analysis, { input: derived.input, analysisVersion: derived.analysis.analysisVersion });
        } catch (error) {
          db.evidence.appendEvent(runtime.id, runtime.trialId, "ANALYSIS_DEFERRED", { classification: "LOGGING_FAILURE", error: error.message });
        }
        try {
          const current = db.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(runtime.id)?.status;
          if (current === "RAW_REPORT_LOCKED" && db.research.revealGate(runtime.id).eligible) {
            void transitionSession(runtime.id, "REVEAL_ELIGIBLE", {
              trialId: runtime.trialId,
              eventType: "REVEAL_ELIGIBLE",
              revealEligible: true,
              payload: { gate: "FULL_RESEARCH_GATE" },
            }, { evidence: { gate: "FULL_RESEARCH_GATE" } }).then(() => {
              db.research.updatePhases(runtime.id, { revealStatus: "ELIGIBLE", sessionLifecycle: "REVEAL_ELIGIBLE" });
              runtime.controller = new SessionController("REVEAL_ELIGIBLE", { sessionId: runtime.id, trialId: runtime.trialId });
            }).catch((error) => db.evidence.appendEvent(runtime.id, runtime.trialId, "REVEAL_GATE_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" }));
          }
        } catch (error) {
          db.evidence.appendEvent(runtime.id, runtime.trialId, "REVEAL_GATE_EVALUATION_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
        }
      },
      onFailure: (failure) => failRuntimeClosed(runtime, "SCHEDULER_EVIDENCE_FAILURE", failure),
    });
    runtime.scheduler = scheduler;
    return scheduler;
  }
  const scheduler = new SessionScheduler(config, {
    sessionId: runtime.id,
    trialId: runtime.trialId,
    outputProvider: () => sampleOutcome(
      runtime.profile.outcomeSpace,
      runtime.randomSources[RANDOM_SOURCES.MACHINE_OUTPUT],
    ),
    onOutput: (record) => db.evidence.recordOutput(runtime.id, {
      trialId: runtime.trialId,
      outputSeq: record.sequence,
      value: record.value,
      region: record.region,
      generatedUtc: record.actualUtc,
      monotonicNs: record.actualMonotonicNs?.toString(),
      scheduledUtc: record.scheduledUtc,
      scheduledMonotonicNs: record.scheduledMonotonicNs?.toString(),
      actualUtc: record.actualUtc,
      actualMonotonicNs: record.actualMonotonicNs?.toString(),
      latenessMs: record.latenessMs,
      timingStatus: record.status,
    }),
    onFailure: (failure) => failRuntimeClosed(runtime, "SCHEDULER_EVIDENCE_FAILURE", failure),
    onEvidence: (evidence) => db.evidence.appendEvent(
      runtime.id,
      runtime.trialId,
      evidence.type,
      jsonSafe(evidence.payload),
    ),
    onComplete: (result) => {
      runtime.schedulerResult = clone(result);
      db.evidence.appendEvent(runtime.id, runtime.trialId, "SCHEDULER_COMPLETE", jsonSafe(result));
    },
  });
  runtime.scheduler = scheduler;
  return scheduler;
}

function isTemporalResearchDefinition(definition = {}) {
  const spaceType = String(definition.outcomeSpace?.type || "BINARY").toUpperCase();
  const windows = Array.isArray(definition.temporalAnalysis?.windows) ? definition.temporalAnalysis.windows : [];
  return definition.mode === EXPERIMENT_MODES.FUTURE_TARGET ||
    String(definition.mode || "INFLUENCE").toUpperCase() !== EXPERIMENT_MODES.INFLUENCE ||
    spaceType !== "BINARY" ||
    (definition.primaryEndpoint && definition.primaryEndpoint !== "EXACT_SLOT") ||
    windows.some((window) => window?.enabled !== false && (
      Number(window?.preMs || 0) > 0 ||
      Number(window?.postMs || 0) > 0 ||
      (window?.exactSequence !== null && window?.exactSequence !== undefined) ||
      (window?.sequenceStart !== null && window?.sequenceStart !== undefined) ||
      (window?.sequenceEnd !== null && window?.sequenceEnd !== undefined) ||
      (window?.sequenceOffsetStart !== null && window?.sequenceOffsetStart !== undefined) ||
      (window?.sequenceOffsetEnd !== null && window?.sequenceOffsetEnd !== undefined)
    ));
}

function persistedAnalysis(runtime) {
  const sessionIdValue = typeof runtime === "string" ? runtime : runtime.id;
  const sessionRow = db.db.prepare("SELECT profile_id,profile_version,hidden_objective FROM sessions WHERE session_id=?").get(sessionIdValue);
  const profile = typeof runtime === "string"
    ? db.profiles.getVersion(sessionRow?.profile_id, sessionRow?.profile_version)
    : runtime.profile;
  const objective = typeof runtime === "string"
    ? parseStoredJson(sessionRow?.hidden_objective, sessionRow?.hidden_objective)
    : runtime.objective;
  const researchDefinition = db.research?.getDefinition(sessionIdValue, { full: true })?.definition ||
    (typeof runtime === "object" ? runtime.researchDefinition : null);
  const rows = db.db
    .prepare("SELECT output_seq,trial_id,region,value_json,scheduled_utc,scheduled_monotonic_ns,actual_utc,actual_monotonic_ns,lateness_ms,timing_status FROM machine_outputs WHERE session_id=? ORDER BY output_seq")
    .all(sessionIdValue);
  const genericSpace = researchDefinition?.outcomeSpace || profile?.outcomeSpace || { type: "BINARY" };
  const genericMode = researchDefinition?.mode || profile?.mode || EXPERIMENT_MODES.INFLUENCE;
  const genericEndpoint = researchDefinition?.primaryEndpoint || profile?.analysis?.primaryEndpoint || "EXACT_SLOT";
  const hasTemporalWindows = Boolean(researchDefinition?.temporalAnalysis?.windows?.some?.((window) =>
    window?.enabled !== false && (
      Number(window?.preMs || 0) > 0 ||
      Number(window?.postMs || 0) > 0 ||
      (window?.exactSequence !== null && window?.exactSequence !== undefined) ||
      (window?.sequenceStart !== null && window?.sequenceStart !== undefined) ||
      (window?.sequenceEnd !== null && window?.sequenceEnd !== undefined) ||
      (window?.sequenceOffsetStart !== null && window?.sequenceOffsetStart !== undefined) ||
      (window?.sequenceOffsetEnd !== null && window?.sequenceOffsetEnd !== undefined)
    )));
  if (genericMode !== EXPERIMENT_MODES.INFLUENCE || genericSpace.type !== "BINARY" || genericEndpoint !== "EXACT_SLOT" || hasTemporalWindows || runtime?.scheduler instanceof TemporalEvidenceScheduler) {
    const outputs = rows.map((row) => ({
      sessionId: sessionIdValue,
      trialId: row.trial_id,
      sequence: row.output_seq,
      outputSeq: row.output_seq,
      value: JSON.parse(row.value_json),
      region: row.region,
      scheduledUtc: row.scheduled_utc,
      scheduledMonotonicNs: row.scheduled_monotonic_ns,
      actualUtc: row.actual_utc,
      actualMonotonicNs: row.actual_monotonic_ns,
      latenessMs: row.lateness_ms,
      status: row.timing_status,
    }));
    const temporal = analyzeTemporalEvidence({
      outputs,
      target: objective,
      outcomeSpace: genericSpace,
      primaryEndpoint: genericEndpoint,
      targetSequence: researchDefinition?.targetDefinition?.targetSequence ?? null,
      targetScheduledUtc: researchDefinition?.targetDefinition?.scheduledUtc || null,
      targetScheduledMonotonicNs: researchDefinition?.targetDefinition?.scheduledMonotonicNs || null,
      primaryWindow: researchDefinition?.temporalAnalysis?.windows?.find?.((window) => window.id === (researchDefinition?.temporalAnalysis?.primaryWindowId || "primary")) || researchDefinition?.temporalAnalysis?.windows?.[0] || {},
      analysisWindows: researchDefinition?.temporalAnalysis?.windows || null,
      plannedCount: Number(runtime?.scheduler?.plan?.totalCount || rows.length),
      eligibleCount: rows.filter((row) => row.timing_status !== "MISSED").length,
      missedCount: rows.filter((row) => row.timing_status === "MISSED").length,
      analysisVersion: researchDefinition?.temporalAnalysis?.version || "temporal-analysis-v1",
    });
    return {
      analysis: temporal,
      input: { requested: objective, outcomeSpace: genericSpace, endpoint: genericEndpoint, outputs },
    };
  }
  const blockSize = Number(profile?.output?.blockSize || 1);
  const preCount = Number(profile?.output?.preBlocks || 0) * blockSize;
  const primaryCount = Number(profile?.output?.primaryBlocks || 0) * blockSize;
  const postCount = Number(profile?.output?.postBlocks || 0) * blockSize;
  const totalCount = preCount + primaryCount + postCount || 1;
  const slots = Array(totalCount).fill(null);
  for (const row of rows) if (row.output_seq < slots.length) slots[row.output_seq] = JSON.parse(row.value_json);
  const observedValues = rows.map((row) => JSON.parse(row.value_json));
  const core = analyzeStream({ requested: objective, values: observedValues });
  const summarize = (start, end, name) => {
    const values = slots.slice(start, end).filter((value) => value !== null);
    const matches = values.filter((value) => value === objective).length;
    return {
      name,
      start,
      end,
      expectedCount: end - start,
      observedCount: values.length,
      missingCount: end - start - values.length,
      matches,
      proportion: values.length ? matches / values.length : null,
    };
  };
  const pre = summarize(0, preCount, "pre");
  const primary = summarize(preCount, preCount + primaryCount, "primary");
  const post = summarize(preCount + primaryCount, totalCount, "post");
  const slotDirection = slots.map((value) => value === null ? 0 : value === objective ? 1 : -1);
  const slotCumulative = [];
  let slotTotal = 0;
  for (const direction of slotDirection) { slotTotal += direction; slotCumulative.push(slotTotal); }
  const threshold = Number(profile?.analysis?.threshold ?? 0.15) * Math.max(1, primaryCount);
  const crossingIndex = slotCumulative.findIndex((value) => Math.abs(value) >= threshold);
  const sustainedLength = Math.max(1, Number(profile?.analysis?.sustainedBlocks || 1) * blockSize);
  let sustainedIndex = -1;
  for (let index = 0; index <= slotCumulative.length - sustainedLength; index += 1) {
    if (slotCumulative.slice(index, index + sustainedLength).every((value) => Math.abs(value) >= threshold)) { sustainedIndex = index; break; }
  }
  const peak = slotCumulative.reduce((best, value, index) => Math.abs(value) > Math.abs(best.value) ? { value, index } : best, { value: 0, index: -1 });
  const peakIndex = peak.index;
  const finalCumulative = slotCumulative.at(-1) ?? 0;
  const peakMagnitude = Math.abs(peak.value);
  const returnTowardBaseline = peakMagnitude > 0 && Math.abs(finalCumulative) < peakMagnitude;
  const scheduledTimes = rows.map((row) => Date.parse(row.scheduled_utc || "")).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const deltas = scheduledTimes.slice(1).map((value, index) => value - scheduledTimes[index]).filter((value) => value > 0);
  const intervalMs = Number(runtime?.scheduler?.plan?.intervalMs || (deltas.length ? deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)] : schedulerIntervalMs(profile)) || 0);
  const firstPrimary = rows.find((row) => row.region === "primary");
  const persistedAnchor = parseStoredJson(db.db.prepare("SELECT protocol_anchor_json FROM session_details WHERE session_id=?").get(sessionIdValue)?.protocol_anchor_json, null);
  const requestAnchor = runtime?.scheduler?.plan?.anchors?.REQUEST
    ? jsonSafe(runtime.scheduler.plan.anchors.REQUEST)
    : firstPrimary ? { name: "PRIMARY_START", utc: firstPrimary.scheduled_utc, monotonicNs: firstPrimary.scheduled_monotonic_ns } : persistedAnchor;
  const series = slotCumulative.map((signedDeviation, index) => ({ index, value: slots[index], signedDirection: slotDirection[index], cumulativeSigned: signedDeviation, region: slots[index] === null ? null : index < preCount ? "pre" : index < preCount + primaryCount ? "primary" : "post" }));
  const stride = Math.max(1, Math.ceil(series.length / 2_000));
  const analysis = {
    ...core,
    cumulative: slotCumulative,
    direction: slotDirection,
    peakDeviation: peak,
    total: totalCount,
    observedCount: rows.length,
    missingCount: totalCount - rows.length,
    pre,
    primary,
    post,
    exploratory: [pre, post],
    scheduler: jsonSafe(runtime?.scheduler?.getResult?.() || null),
    analysisVersion: profile?.analysis?.version || "analysis-v1",
    boundaries: { pre: [0, preCount], primary: [preCount, preCount + primaryCount], post: [preCount + primaryCount, totalCount] },
    requestAnchor,
    timingAnchors: runtime?.scheduler?.plan?.anchors ? jsonSafe(runtime.scheduler.plan.anchors) : { REQUEST: requestAnchor, protocol: persistedAnchor },
    cumulativeSignedSeries: series,
    decimatedCumulativeSignedSeries: series.filter((_point, index) => index % stride === 0 || index === series.length - 1),
    thresholdCrossing: crossingIndex < 0 ? null : { index: crossingIndex, value: slotCumulative[crossingIndex], threshold },
    sustainedCrossing: sustainedIndex < 0 ? null : { index: sustainedIndex, length: sustainedLength, threshold },
    changePoint: peakIndex < 0 ? null : { index: peakIndex, value: core.peakDeviation?.value ?? 0 },
    onsetLatencyMs: crossingIndex < 0 || intervalMs <= 0 ? null : crossingIndex * intervalMs,
    persistence: crossingIndex < 0 ? null : { observedAfterCrossing: core.cumulative.length - crossingIndex, sustained: sustainedIndex >= 0 },
    returnTowardBaseline: { observed: returnTowardBaseline, finalCumulative, peakMagnitude },
  };
  return {
    analysis,
    input: {
      requested: objective,
      slots,
      regions: { pre: [0, preCount], primary: [preCount, preCount + primaryCount], post: [preCount + primaryCount, totalCount] },
    },
  };
}

function streamFormat(runtime, finalization) {
  return {
    digestVersion: PCM_DIGEST_VERSION,
    header: PCM_CANONICAL_FORMAT,
    sampleRate: runtime.audio.sampleRate,
    channels: runtime.audio.channels,
    sampleFormat: "PCM16LE_INTERLEAVED_LR",
    processorVersion: finalization.processorVersion,
  };
}

async function formalReturn(runtime) {
  if (["RETURNED", "RAW_REPORT_DRAFT", "RAW_REPORT_LOCKED", "REVEAL_ELIGIBLE", "REVEALED", "COMPLETE"].includes(runtime.controller.state))
    return sessionDto(runtime.id);
  if (runtime.returnPromise) return runtime.returnPromise;
  runtime.returnPromise = (async () => {
    if (runtime.controller.state !== "RUNNING" && runtime.controller.state !== "TIMING_DEVIATION")
      throw new Error("Formal return requires a running session.");
    if (!runtime.audioFinalization)
      throw new Error("Formal return requires AUDIO_FINALIZED telemetry from the AudioWorklet.");
    if (runtime.protocolStageController && !runtime.protocolStageController.returnCueObserved) {
      db.evidence.appendEvent(runtime.id, runtime.trialId, "EARLY_RETURN_DEVIATION", {
        classification: "EARLY_RETURN_BEFORE_RETURN_CUE",
        status: "TIMING_DEVIATION",
      });
    }
    // Any definition with committed temporal windows (including an
    // EXACT_SLOT primary) keeps machine evidence alive after the participant
    // returns.  Only the legacy non-temporal binary scheduler is allowed to
    // interrupt here, and only because its evidence plan is already tied to
    // the participant interaction.
    const evidenceContinuesAfterReturn = isTemporalResearchDefinition(runtime.researchDefinition) ||
      runtime.scheduler instanceof TemporalEvidenceScheduler;
    requestAudioStop(runtime, "formal_return");
    if (evidenceContinuesAfterReturn) runtime.scheduler?.endParticipantPhase?.("formal_return");
    else if (["RUNNING", "COMMITTED"].includes(runtime.scheduler?.status))
      runtime.scheduler.interrupt("formal return requested");
    const schedulerResult = runtime.scheduler?.getResult?.() || null;
    const schedulerExpected = Number(runtime.scheduler?.plan?.totalCount || 0);
    const schedulerGenerated = Number(schedulerResult?.generatedCount ?? runtime.scheduler?.outputs?.length ?? 0);
    const schedulerDeviation = Boolean(
      runtime.scheduler &&
      !evidenceContinuesAfterReturn &&
      schedulerExpected > 0 &&
      (schedulerResult?.status !== "COMPLETE" || schedulerGenerated < schedulerExpected),
    );
    const earlyReturnDeviation = Boolean(runtime.protocolStageController && !runtime.protocolStageController.returnCueObserved);
    if ((schedulerDeviation || earlyReturnDeviation) && runtime.controller.state === "RUNNING" && !evidenceContinuesAfterReturn) {
      await transitionSession(runtime.id, "TIMING_DEVIATION", {
        trialId: runtime.trialId,
        eventType: "TIMING_DEVIATION",
        timingDeviation: true,
        deviation: earlyReturnDeviation ? "EARLY_RETURN_BEFORE_RETURN_CUE" : "FORMAL_RETURN_BEFORE_SCHEDULER_COMPLETION",
        payload: {
          schedulerStatus: schedulerResult?.status || runtime.scheduler?.status || "UNKNOWN",
          expectedCount: schedulerExpected,
          generatedCount: schedulerGenerated,
          earlyReturnBeforeCue: earlyReturnDeviation,
        },
      }, {
        evidence: {
          schedulerStatus: schedulerResult?.status || runtime.scheduler?.status || "UNKNOWN",
          expectedCount: schedulerExpected,
          generatedCount: schedulerGenerated,
          earlyReturnBeforeCue: earlyReturnDeviation,
        },
      });
    }
    const finalization = runtime.audioFinalization;
    const format = streamFormat(runtime, finalization);
    const derived = persistedAnalysis(runtime);
    const healthId = `${runtime.id}-AUDIO-HEALTH`;
    await transitionSession(runtime.id, "RETURNED", {
      trialId: runtime.trialId,
      eventType: "RETURN_CONFIRMED",
      returned: true,
      outputComplete: true,
      payload: {
        generatedCount: runtime.scheduler?.outputs.length || 0,
        schedulerStatus: runtime.scheduler?.status || "UNKNOWN",
        audioFinalized: true,
      },
    }, {
      evidence: { schedulerStatus: runtime.scheduler?.status || "UNKNOWN" },
      before: () => {
        if (!db.db.prepare("SELECT 1 FROM output_finalizations WHERE session_id=?").get(runtime.id))
          db.evidence.finalizeOutput(runtime.id, {
            finalStreamDigest: finalization.digest,
            frameCount: finalization.totalFrames,
            format,
          });
        if (!evidenceContinuesAfterReturn && !db.analyses.get(runtime.id))
          db.analyses.save(runtime.id, derived.analysis, {
            input: derived.input,
            analysisVersion: derived.analysis.analysisVersion,
          });
        if (!db.audioHealth.get(healthId))
          db.audioHealth.save({
            diagnosticId: healthId,
            recipeId: runtime.audio.recipeId,
            recipeVersion: runtime.audio.version,
            startedUtc: runtime.startedUtc,
            endedUtc: new Date().toISOString(),
            sampleRate: runtime.audio.sampleRate,
            generatedFrames: finalization.totalFrames,
            continuity: finalization.continuity,
            clipping: finalization.clipping,
            contextStates: runtime.contextStates,
            telemetry: { latest: runtime.latestTelemetry, finalization },
            digest: finalization.digest,
            format,
            observations: runtime.audioObservations,
            checkMode: "FORMAL_SESSION",
            intendedDurationMs: Number(runtime.profile.protocol?.inductionSeconds || 0) * 1000 + Number(runtime.profile.protocol?.settleSeconds || 0) * 1000 + Number(runtime.profile.protocol?.requestSeconds || 0) * 1000 + Number(runtime.profile.protocol?.releaseSeconds || 0) * 1000 + Number(runtime.profile.protocol?.neutralSeconds || 0) * 1000 + Number(runtime.profile.protocol?.returnSeconds || 0) * 1000,
            verification: {
              telemetryStructurallyValid: true,
              processorIdentityVerified: finalization.processorVersion === PROCESSOR_VERSION && finalization.recipeId === runtime.audio.recipeId && finalization.recipeVersion === runtime.audio.version && finalization.sampleRate === runtime.audio.sampleRate && finalization.digestVersion === PCM_DIGEST_VERSION && finalization.pcmFormat === PCM_CANONICAL_FORMAT.body && finalization.channels === runtime.audio.channels,
              digestVerified: /^[a-f0-9]{64}$/i.test(String(finalization.digest || "")),
              continuityValid: finalization.continuity?.ok !== false && finalization.processorErrors.length === 0,
              ownerAudibleResult: "Uncertain",
            },
            integrityStatus: finalization.processorErrors.length === 0 && finalization.continuity?.ok !== false && finalization.digestVersion === PCM_DIGEST_VERSION && finalization.pcmFormat === PCM_CANONICAL_FORMAT.body
              ? "VERIFIED"
              : "UNVERIFIED",
          });
        db.evidence.appendEvent(runtime.id, runtime.trialId, "AUDIO_FINALIZED", {
          sessionId: finalization.sessionId || runtime.id,
          trialId: finalization.trialId || runtime.trialId,
          audioNonce: finalization.audioNonce || runtime.audioNonce || null,
          processorVersion: finalization.processorVersion,
          recipeId: finalization.recipeId,
          recipeVersion: finalization.recipeVersion,
          sampleRate: finalization.sampleRate,
          configFingerprint: finalization.configFingerprint,
          digestVersion: finalization.digestVersion,
          pcmFormat: finalization.pcmFormat,
          channels: finalization.channels,
          totalFrames: finalization.totalFrames,
          digest: finalization.digest,
          continuity: finalization.continuity,
          clipping: finalization.clipping,
          processorSequence: finalization.processorSequence,
        });
      },
    });
    if (evidenceContinuesAfterReturn) {
      db.research.updatePhases(runtime.id, { participantPhaseStatus: "ENDED", sessionLifecycle: "RETURNED", evidencePhaseStatus: runtime.scheduler?.evidencePhase || "RUNNING" });
      runtime.participantPhase = "ENDED";
    }
    if (!evidenceContinuesAfterReturn || runtime.scheduler?.status !== "RUNNING")
      powerManager.stop();
    runtime.protocolStageController?.stop("formal_return");
    runtime.returned = true;
    return sessionDto(runtime.id);
  })();
  try {
    return await runtime.returnPromise;
  } catch (error) {
    if (["RUNNING", "TIMING_DEVIATION"].includes(runtime.controller.state))
      await failRuntimeClosed(runtime, "FORMAL_RETURN_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
    throw error;
  } finally {
    runtime.returnPromise = null;
  }
}

function settingsFile() {
  return path.join(app.getPath("userData"), "MIP", "settings.json");
}

function loadSettings() {
  try {
    const value = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    settings = objectPayload(value, "stored settings", { maxBytes: 64_000 });
  } catch {
    settings = {};
  }
}

function persistSettings(value) {
  const file = settingsFile();
  const temporary = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

function reportSchemaVersion(id) {
  const row = db.db.prepare("SELECT profile_id,profile_version FROM sessions WHERE session_id=?").get(id);
  const profile = row ? db.profiles.getVersion(row.profile_id, row.profile_version) : null;
  return String(profile?.reporting?.version || `schema-${db.schemaVersion}`);
}

function validateRawReportForLock(report) {
  const required = ["subjectiveTime", "intensity", "modality", "certainty"];
  const missing = required.filter((key) => report[key] === undefined || report[key] === null || String(report[key]).trim() === "");
  if (missing.length) throw new Error(`Raw report is missing required fields: ${missing.join(", ")}.`);
  finiteNumber(report.intensity, "raw report intensity", { min: 0, max: 10 });
  finiteNumber(report.certainty, "raw report certainty", { min: 0, max: 100 });
  return report;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    show: false,
    icon: fs.existsSync(iconFile) ? iconFile : undefined,
    webPreferences: {
      preload: preloadFile,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.loadFile(rendererFile);
}

function registerLibraryHandlers() {
  handle("profiles:list", (payload) => {
    const options = objectPayload(payload, "profile filters", { optional: true, maxBytes: 32_000 });
    return db.profiles.list({
      allVersions: options.allVersions === true,
      activeOnly: options.activeOnly === true,
      search: options.search ? stringValue(options.search, "profile search", { max: 128 }) : undefined,
    }).map((profile) => ({ ...profile, validation: validateProfile(profile) }));
  });
  handle("profiles:get", (payload) => {
    const value = objectPayload(payload);
    return db.profiles.getVersion(identifier(value.id || value.profileId, "profile id"), value.version === undefined ? undefined : positiveInteger(value.version, "profile version"));
  });
  handle("profiles:versions", (payload) => db.profiles.listVersions(identifier(objectPayload(payload).id, "profile id")));
  handle("profiles:draft:get", (payload) => db.profiles.getDraft(identifier(objectPayload(payload).id, "profile id")));
  handle("profiles:draft", (payload) => {
    const value = objectPayload(payload, "profile draft", { maxBytes: 512_000 });
    if (value.profile) return db.profiles.createDraft(objectPayload(value.profile, "profile"), { baseVersion: value.baseVersion });
    const id = identifier(value.id || value.profileId, "profile id");
    return db.profiles.editDraft(id, objectPayload(value.patch || {}, "profile patch"));
  });
  handle("profiles:diff", (payload) => {
    const value = objectPayload(payload);
    return db.profiles.materialDiff(identifier(value.id || value.profileId, "profile id"), positiveInteger(value.leftVersion, "left profile version"), positiveInteger(value.rightVersion, "right profile version"));
  });
  handle("profiles:save", (payload) => {
    const value = objectPayload(payload, "profile version", { maxBytes: 512_000 });
    return db.profiles.saveNewVersion(objectPayload(value.profile || value, "profile"), {
      activate: value.activate === true,
      parentVersion: value.parentVersion,
      provenance: value.provenance,
    });
  });
  handle("profiles:activate", (payload) => {
    const value = objectPayload(payload);
    return db.profiles.activate(identifier(value.id || value.profileId, "profile id"), positiveInteger(value.version, "profile version"));
  });
  handle("profiles:duplicate", (payload) => {
    const value = objectPayload(payload, "profile duplicate request", { optional: true });
    const source = identifier(value.profileId || value.id || "BASELINE_NOW_BINARY_V1", "profile id");
    const newId = value.newId === undefined ? undefined : identifier(value.newId, "new profile id");
    return db.profiles.duplicate(source, newId, {
      version: value.version === undefined ? undefined : positiveInteger(value.version, "profile version"),
      name: value.name === undefined ? undefined : stringValue(value.name, "profile name", { max: 200 }),
      activate: value.activate === true,
    });
  });

  handle("audio:presets", (payload) => {
    const options = objectPayload(payload, "recipe filters", { optional: true, maxBytes: 32_000 });
    return db.recipes.list({
      allVersions: options.allVersions === true,
      activeOnly: options.activeOnly === true,
      search: options.search ? stringValue(options.search, "recipe search", { max: 128 }) : undefined,
    });
  });
  handle("recipes:get", (payload) => {
    const value = objectPayload(payload);
    return db.recipes.getVersion(identifier(value.id || value.recipeId, "recipe id"), value.version === undefined ? undefined : positiveInteger(value.version, "recipe version"));
  });
  handle("recipes:versions", (payload) => db.recipes.listVersions(identifier(objectPayload(payload).id, "recipe id")));
  handle("recipes:draft:get", (payload) => {
    const id = identifier(objectPayload(payload).id, "recipe id");
    const row = db.db.prepare("SELECT * FROM audio_recipe_drafts WHERE recipe_id=?").get(id);
    return row ? { recipe: JSON.parse(row.draft_json), baseVersion: row.base_version, validation: JSON.parse(row.validation_json || "null"), updatedUtc: row.updated_utc, isDraft: true } : null;
  });
  handle("recipes:draft", (payload) => {
    const value = objectPayload(payload, "recipe draft", { maxBytes: 512_000 });
    if (value.recipe) return db.recipes.createDraft(objectPayload(value.recipe, "recipe"), { baseVersion: value.baseVersion });
    return db.recipes.editDraft(identifier(value.id || value.recipeId, "recipe id"), objectPayload(value.patch || {}, "recipe patch"));
  });
  handle("recipes:diff", (payload) => {
    const value = objectPayload(payload);
    return db.recipes.materialDiff(identifier(value.id || value.recipeId, "recipe id"), positiveInteger(value.leftVersion, "left recipe version"), positiveInteger(value.rightVersion, "right recipe version"));
  });
  handle("recipes:save", (payload) => {
    const value = objectPayload(payload, "recipe version", { maxBytes: 512_000 });
    return db.recipes.saveNewVersion(objectPayload(value.recipe || value, "recipe"), {
      activate: value.activate === true,
      parentVersion: value.parentVersion,
      provenance: value.provenance,
      allowIncomplete: value.allowIncomplete === true,
    });
  });
  handle("recipes:activate", (payload) => {
    const value = objectPayload(payload);
    return db.recipes.activate(identifier(value.id || value.recipeId, "recipe id"), positiveInteger(value.version, "recipe version"));
  });
  handle("audio:duplicate", (payload) => {
    const value = objectPayload(payload, "recipe duplicate request", { optional: true });
    return db.recipes.duplicate(
      identifier(value.recipeId || value.id || "A-U396-4", "recipe id"),
      value.newId === undefined ? undefined : identifier(value.newId, "new recipe id"),
      { version: value.version, activate: value.activate === true },
    );
  });
  handle("audio:quick", (payload) => {
    const value = objectPayload(payload, "quick recipe request");
    const recipe = quickRecipe(
      finiteNumber(value.centerHz, "centerHz", { min: Number.MIN_VALUE }),
      value.beatHz === undefined ? 4 : finiteNumber(value.beatHz, "beatHz", { min: 0 }),
    );
    return { recipe, validation: validateRecipe(recipe) };
  });
}

function registerSessionHandlers() {
  handle("sessions:list", (payload) => {
    const options = objectPayload(payload, "session filters", { optional: true, maxBytes: 32_000 });
    return db.sessions.listRedacted({
      profileId: options.profileId,
      status: options.status,
      recordType: options.recordType,
      search: options.search,
    }).map(({ sessionId: id }) => sessionDto(id));
  });
  handle("sessions:get", (payload) => sessionDto(sessionId(payload)));
  handle("sessions:events", (payload) => {
    const id = sessionId(payload);
    const revealed = isRevealed(id);
    const events = db.evidence.list(id, { full: revealed }).map((event) => redactSessionData(event, revealed));
    return { sessionId: id, events };
  });
  handle("sessions:output", (payload) => {
    const value = objectPayload(payload, "output request");
    const id = sessionId(value);
    if (!isRevealed(id)) throw new Error("Machine output remains hidden until the session is revealed.");
    const options = {
      full: true,
      paginated: value.paginated === true,
      offset: value.offset === undefined ? 0 : positiveInteger(value.offset, "output offset", { min: 0 }),
      // Never allow an IPC caller to materialize an unbounded machine-output
      // result.  Renderer/report consumers must page large evidence ledgers;
      // the same 5,000-row ceiling is used for an omitted limit and an
      // explicit page request.
      limit: value.limit === undefined ? 5_000 : positiveInteger(value.limit, "output page size", { min: 1, max: 5_000 }),
    };
    return db.evidence.outputs(id, options);
  });
  handle("sessions:verify", (payload) => {
    const id = sessionId(payload);
    if (!isRevealed(id)) return redactSessionData(db.integrity.summary(id), false);
    return db.integrity.verifySession(id, { persist: true });
  });
  handle("sessions:create", (payload) => {
    const value = objectPayload(payload, "session request", { optional: true, maxBytes: 128_000 });
    const profileId = identifier(value.profileId || "BASELINE_NOW_BINARY_V1", "profile id");
    const requestedProfileVersion = value.profileVersion === undefined ? undefined : positiveInteger(value.profileVersion, "profile version");
    const profile = db.profiles.getVersion(profileId, requestedProfileVersion);
    if (!profile) throw new Error(`Profile version is not available in SQLite: ${profileId} v${requestedProfileVersion ?? "active"}.`);
    const requestedMode = String(value.mode || value.experimentMode || profile.mode || EXPERIMENT_MODES.INFLUENCE).toUpperCase();
    if (!Object.values(EXPERIMENT_MODES).includes(requestedMode)) throw new Error(`Unsupported experiment mode: ${requestedMode}.`);
    const requestedPrediction = value.prediction ?? value.targetDefinition?.prediction ?? null;
    if (requestedMode === EXPERIMENT_MODES.FUTURE_TARGET && (requestedPrediction === null || requestedPrediction === undefined || String(requestedPrediction).trim() === ""))
      throw new Error("FUTURE_TARGET requires a participant prediction committed before START.");
    let effective;
    try {
      effective = resolveEffectiveConfiguration({
        app: settings.researchDefaults || {},
        // Keep profile values as the middle-precedence layer.  Session
        // overrides are supplied separately below so omitted nested fields
        // (for example a profile cadence) are not erased accidentally.
        profile: { ...profile, mode: profile.mode || requestedMode, outcomeSpace: profile.outcomeSpace, temporalAnalysis: profile.analysis },
        session: {
          mode: requestedMode,
          outcomeSpace: value.outcomeSpace,
          temporalAnalysis: value.temporalAnalysis,
          targetDefinition: {
            ...(value.targetDefinition && typeof value.targetDefinition === "object" ? value.targetDefinition : {}),
            ...(value.target !== undefined ? { target: value.target } : {}),
            prediction: requestedPrediction,
          },
          rng: value.rng,
          primaryEndpoint: value.primaryEndpoint,
          outputCadence: value.outputCadence,
        },
      });
    } catch (error) {
      throw new Error(`Research configuration is invalid: ${error.message}`);
    }
    const profileValidation = db.profiles.validate({ ...profile, mode: requestedMode, outcomeSpace: effective.outcomeSpace });
    if (!profileValidation.valid) throw new Error(`Profile validation failed: ${profileValidation.errors.join("; ")}`);
    if (profile.isDraft || profile.status !== "ACTIVE" || profile.isActive !== true)
      throw new Error(`Formal session requires an active, non-draft profile: ${profile.id} v${profile.version}.`);
    if (profile.reveal?.policy === "AFTER_BLOCK_LOCK")
      throw new Error("AFTER_BLOCK_LOCK is not selectable until block-level commitments are implemented.");
    const recipeId = identifier(profile.audio?.recipeId, "profile audio recipe id");
    const recipeVersion = positiveInteger(profile.audio?.version ?? profile.audio?.recipeVersion, "profile audio recipe version");
    const recipe = db.recipes.getVersion(recipeId, recipeVersion);
    if (!recipe) throw new Error(`Audio recipe version is not available in SQLite: ${recipeId} v${recipeVersion}.`);
    const recipeValidation = db.recipes.validate(recipe);
    if (!recipeValidation.valid) throw new Error(`Audio recipe validation failed: ${recipeValidation.errors.join("; ")}`);
    if (recipe.isDraft || recipe.status !== "ACTIVE" || recipe.isActive !== true || recipe.incomplete)
      throw new Error(`Formal session requires an active, complete recipe: ${recipe.recipeId} v${recipe.version}.`);
    if (recipe.formalOperationalEligibility !== true)
      throw new Error(`Formal session requires an operationally eligible audio recipe: ${recipe.recipeId} v${recipe.version}. ${recipe.formalEligibilityReason || "One or more configuration, provenance, runtime, deterministic, activation, or applicable reference gates are not current."}`);
    // RNG provider is part of the effective (session > profile > app)
    // research definition.  Reading only the profile silently ignored a
    // deliberate session/application override and could make the persisted
    // provenance disagree with the source that actually generated evidence.
    const provider = effective.rng?.provider || profile.rng?.provider || "OS_CSPRNG";
    const rootSeed = provider === "DETERMINISTIC_PRNG_TEST"
      ? stringValue(value.seed, "deterministic root seed", { max: 512 })
      : crypto.randomBytes(32);
    const randomSources = createRandomSources(rootSeed, { provider });
    const requestedTarget = value.target ?? value.targetDefinition?.target;
    let objective = requestedMode === EXPERIMENT_MODES.FUTURE_TARGET
      ? null
      : requestedTarget === undefined || requestedTarget === null
        ? assignOutcome({ ...profile, outcomeSpace: effective.outcomeSpace }, randomSources[RANDOM_SOURCES.TARGET_ASSIGNMENT])
        : requestedTarget;
    if (objective !== null && !containsOutcome(effective.outcomeSpace, objective))
      throw new Error("The committed target must belong to the selected outcome space.");
    const participantTarget = objective === null
      ? (requestedMode === EXPERIMENT_MODES.FUTURE_TARGET ? `Prediction committed: ${String(requestedPrediction)}` : null)
      : requestedMode === EXPERIMENT_MODES.CONTROL
        ? (profile.timing?.controlWording || "Control condition: observe the scheduled protocol neutrally; no participant target is requested.")
        : requestedMode === EXPERIMENT_MODES.SHAM
          ? (profile.timing?.shamWording || "Sham condition: observe the scheduled protocol neutrally.")
          : requestInstruction({ ...profile, outcomeSpace: effective.outcomeSpace }, objective);
    const audio = completeAudioRecipe(recipe, randomSources[RANDOM_SOURCES.AUDIO_NOISE], value.sampleRate, profile.protocol);
    const timing = timingPlan({ ...profile, timing: value.timing || profile.timing });
    const futureTargetUtc = requestedMode === EXPERIMENT_MODES.FUTURE_TARGET
      ? (value.futureTargetUtc || value.targetDefinition?.scheduledUtc || new Date(Date.now() + finiteNumber(value.targetDelayMs === undefined ? 24 * 60 * 60 * 1000 : value.targetDelayMs, "targetDelayMs", { min: 1, max: 365 * 24 * 60 * 60 * 1000 })).toISOString())
      : timing.scheduledUtc;
    if (requestedMode === EXPERIMENT_MODES.FUTURE_TARGET && !Number.isFinite(Date.parse(String(futureTargetUtc))))
      throw new Error("FUTURE_TARGET requires a valid futureTargetUtc.");
    if (requestedMode === EXPERIMENT_MODES.FUTURE_TARGET && Date.parse(String(futureTargetUtc)) <= Date.now())
      throw new Error("FUTURE_TARGET scheduled anchor must be in the future.");
    if (requestedMode === EXPERIMENT_MODES.FUTURE_TARGET && !containsOutcome(effective.outcomeSpace, requestedPrediction))
      throw new Error("The committed future prediction must belong to the selected outcome space.");
    const configuredTargetSequence = value.targetDefinition?.targetSequence ?? effective.targetDefinition.targetSequence;
    const committedTemporalWindows = Array.isArray(effective.temporalAnalysis?.windows)
      ? effective.temporalAnalysis.windows
      : [];
    const hasCommittedDurationWindow = committedTemporalWindows.some((window) => window?.enabled !== false && (
      Number(window?.preMs || 0) > 0 || Number(window?.postMs || 0) > 0
    ));
    const committedPrimaryWindow = committedTemporalWindows.find((window) => window.id === (effective.temporalAnalysis?.primaryWindowId || "primary"))
      || committedTemporalWindows[0]
      || {};
    const committedIntervalMs = Number(effective.temporalAnalysis?.intervalMs ?? profile.output?.intervalMs ?? schedulerIntervalMs(profile));
    const hasRelativeSequenceWindow = committedTemporalWindows.some((window) => window?.enabled !== false && (
      window?.sequenceOffsetStart !== null && window?.sequenceOffsetStart !== undefined ||
      window?.sequenceOffsetEnd !== null && window?.sequenceOffsetEnd !== undefined
    ));
    // With a target-anchored duration window, the exact slot is the explicit
    // anchor after all scheduled pre-target opportunities.  Do not reuse the
    // profile's historical block count when a session override changed the
    // cadence/window geometry.
    const defaultExactTargetSequence = effective.primaryEndpoint === "EXACT_SLOT"
      ? hasCommittedDurationWindow && Number.isFinite(committedIntervalMs) && committedIntervalMs > 0
        ? Math.ceil(Number(committedPrimaryWindow.preMs || 0) / committedIntervalMs)
        : Number(profile.output?.preBlocks || 0) * Number(profile.output?.blockSize || 1)
      : null;
    const defaultTemporalTargetSequence = hasRelativeSequenceWindow && Number.isFinite(committedIntervalMs) && committedIntervalMs > 0
      ? hasCommittedDurationWindow
        ? Math.ceil(Number(committedPrimaryWindow.preMs || 0) / committedIntervalMs)
        : Number(profile.output?.preBlocks || 0) * Number(profile.output?.blockSize || 1)
      : null;
    const researchDefinition = {
      ...effective,
      mode: requestedMode,
      outcomeSpace: effective.outcomeSpace,
      cardinality: outcomeSpaceSize(effective.outcomeSpace),
      targetDefinition: {
        ...effective.targetDefinition,
        target: requestedMode === EXPERIMENT_MODES.FUTURE_TARGET ? null : objective,
        mode: requestedMode,
        anchor: value.targetDefinition?.anchor || effective.targetDefinition.anchor || (requestedMode === EXPERIMENT_MODES.FUTURE_TARGET ? "ABSOLUTE_UTC" : "PARTICIPANT_REQUEST"),
        scheduledUtc: futureTargetUtc,
        scheduledMonotonicNs: value.targetDefinition?.scheduledMonotonicNs ?? null,
        targetSequence: configuredTargetSequence ?? defaultExactTargetSequence ?? defaultTemporalTargetSequence,
        prediction: requestedPrediction ?? effective.targetDefinition.prediction ?? null,
        semantics: requestedMode === EXPERIMENT_MODES.FUTURE_TARGET ? "GENERATE_AT_ANCHOR" : "COMMITTED_BEFORE_PARTICIPATION",
      },
      temporalAnalysis: effective.temporalAnalysis,
      revealPolicy: effective.revealPolicy || profile.reveal?.policy || "AFTER_EVIDENCE_COMPLETE",
      profileId: profile.id,
      profileVersion: profile.version,
      rng: { provider, targetDomain: requestedMode === EXPERIMENT_MODES.FUTURE_TARGET ? RANDOM_SOURCES.FUTURE_TARGET : RANDOM_SOURCES.TARGET_ASSIGNMENT, machineDomain: RANDOM_SOURCES.MACHINE_OUTPUT, audioDomain: RANDOM_SOURCES.AUDIO_NOISE, analysisDomain: RANDOM_SOURCES.ANALYSIS_SIMULATION },
    };
    const audioNonce = crypto.randomBytes(32).toString("hex");
    const deferredCommit = value.deferCommit === true;
    const created = db.beginSession(
      profile,
      value.participantLabel === undefined
        ? "Local participant"
        : stringValue(value.participantLabel, "participant label", { max: 200 }),
      value.recordType === undefined
        ? "dry"
        : stringValue(value.recordType, "record type", { max: 64, pattern: /^[A-Za-z0-9 _-]+$/ }),
      {
        objective,
        participantTarget,
        rng: { sources: randomSourcesMetadata(randomSources) },
        audio,
        timing,
        appVersion: APP_VERSION,
        engineVersion: ENGINE_VERSION,
        audioNonce,
        deferCommit: deferredCommit,
        researchDefinition,
      },
    );
    const runtime = {
      id: created.id,
      trialId: created.trial,
      profile,
      researchDefinition,
      objective,
      participantTarget,
      audio,
      randomSources,
      controller: new SessionController(created.status, { sessionId: created.id, trialId: created.trial }),
      audioNonce,
      lastProcessorSequence: null,
      protocolStageController: null,
      protocolAnchor: null,
      failure: null,
      audioReady: false,
      audioStarted: false,
      latestTelemetry: null,
      audioFinalization: null,
      audioStopRequested: false,
      audioObservations: [],
      contextStates: [],
      scheduler: null,
      schedulerResult: null,
      startedUtc: null,
      participantPhase: "READY",
      evidencePhase: "NOT_STARTED",
      prediction: requestedPrediction,
    };
    runtimes.set(created.id, runtime);
    return {
      sessionId: created.id,
      trialId: created.trial,
      participantTarget,
      ...(requestedMode === EXPERIMENT_MODES.FUTURE_TARGET ? { prediction: requestedPrediction } : {}),
      mode: requestedMode,
      outcomeSpace: effective.outcomeSpace.type === "INTEGER_RANGE" ? effective.outcomeSpace : { type: effective.outcomeSpace.type, values: effective.outcomeSpace.values },
      cardinality: effective.cardinality,
      compatibilityFingerprint: effective.compatibilityFingerprint,
      researchDefinition: {
        mode: requestedMode,
        cardinality: effective.cardinality,
        outcomeSpace: effective.outcomeSpace,
        targetAnchor: researchDefinition.targetDefinition.anchor,
        targetDefinition: {
          anchor: researchDefinition.targetDefinition.anchor,
          target: researchDefinition.targetDefinition.target,
          scheduledUtc: researchDefinition.targetDefinition.scheduledUtc,
          targetSequence: researchDefinition.targetDefinition.targetSequence,
          semantics: researchDefinition.targetDefinition.semantics,
        },
        outputCadence: effective.outputCadence,
        primaryEndpoint: effective.primaryEndpoint,
        temporalAnalysis: effective.temporalAnalysis,
        configHash: effective.configHash,
        compatibilityFingerprint: effective.compatibilityFingerprint,
      },
      timing,
      status: created.status,
      deferredCommit,
      rng: { sources: randomSourcesMetadata(randomSources) },
      audio: audioSummary(audio, { includeFingerprint: false }),
    };
  });
  handle("sessions:commit", async (payload) => {
    const value = objectPayload(payload, "session commit request", { maxBytes: 256_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || runtime.controller.state !== "DRAFT") throw new Error("Only a newly created draft session can be committed.");
    if (value.memoryConfirmed !== true) throw new Error("Explicit memory confirmation is required before commitment.");
    if (value.safetyConfirmed !== true) throw new Error("Explicit safety confirmation is required before commitment.");
    try {
      await transitionSession(id, "TARGET_ASSIGNED", {
        trialId: runtime.trialId,
        eventType: "TARGET_ASSIGNED",
        targetAssigned: true,
        payload: { targetAssigned: true },
      }, { evidence: { targetAssigned: true } });
      const committed = db.commitDraftSession(id, {
        memoryConfirmedUtc: new Date().toISOString(),
        baseline: value.baseline,
        environment: value.environment,
        safety: { confirmed: true, note: value.safetyNote || null },
      });
      await transitionSession(id, "READY", {
        trialId: runtime.trialId,
        eventType: "READY_CONFIRMED",
        ready: true,
        participantReady: true,
        payload: { memoryConfirmed: true, safetyConfirmed: true },
      }, { evidence: { memoryConfirmed: true, safetyConfirmed: true } });
      await transitionSession(id, "COMMITTED", {
        trialId: runtime.trialId,
        eventType: "COMMITMENT_RECORDED",
        committed: true,
        configFingerprint: committed.configHash,
        payload: { configFingerprint: committed.configHash },
      }, { evidence: { configFingerprint: committed.configHash } });
      runtime.committed = true;
      return {
        sessionId: id,
        trialId: runtime.trialId,
        status: "COMMITTED",
        committedUtc: committed.committedUtc,
        audio: audioSummary(runtime.audio, { includeFingerprint: false }),
      };
    } catch (error) {
      const state = runtime.controller.state;
      if (["DRAFT", "TARGET_ASSIGNED", "READY"].includes(state)) {
        try {
          await transitionSession(id, "RECOVERY_REQUIRED", {
            trialId: runtime.trialId,
            eventType: "COMMITMENT_PERSISTENCE_FAILURE",
            recoveryRequired: true,
            recoveryReason: "COMMITMENT_PERSISTENCE_FAILURE",
            payload: { classification: "LOGGING_FAILURE", error: error.message },
          }, { recoveryState: "COMMITMENT_PERSISTENCE_FAILURE", evidence: { classification: "LOGGING_FAILURE", error: error.message } });
        } catch (recoveryError) {
          try { db.evidence.appendEvent(id, runtime.trialId, "COMMITMENT_PERSISTENCE_FAILURE_UNRECOVERED", { classification: "LOGGING_FAILURE", error: error.message, recoveryError: recoveryError.message }); } catch {}
        }
      }
      throw error;
    }
  });
  handle("audio:prepare", async (payload) => {
    const id = sessionId(payload);
    const runtime = runtimes.get(id);
    if (!runtime) throw new Error("Session runtime is unavailable; incomplete sessions cannot be silently reconstructed.");
    if (runtime.controller.state === "COMMITTED") {
      await transitionSession(id, "AUDIO_PREPARING", {
        trialId: runtime.trialId,
        eventType: "COMMIT_AUDIO_CONFIG",
        audioRequested: true,
        audio: audioSummary(runtime.audio),
        payload: audioSummary(runtime.audio),
      }, { evidence: { committedAudio: true } });
    } else if (runtime.controller.state !== "AUDIO_PREPARING") {
      throw new Error(`Audio preparation is not available in state ${runtime.controller.state}.`);
    }
    const handshake = {
      sessionId: id,
      trialId: runtime.trialId,
      audioNonce: runtime.audioNonce,
      digestVersion: PCM_DIGEST_VERSION,
      pcmFormat: PCM_CANONICAL_FORMAT.body,
      channels: runtime.audio.channels,
    };
    runtime.audioHandshake = handshake;
    try {
      db.db.prepare("UPDATE session_details SET audio_session_nonce=?,audio_processor_version=?,audio_digest_version=?,audio_pcm_format=? WHERE session_id=?")
        .run(runtime.audioNonce, PROCESSOR_VERSION, PCM_DIGEST_VERSION, PCM_CANONICAL_FORMAT.body, id);
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_PREPARATION_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
    return { sessionId: id, status: "AUDIO_PREPARING", audio: clone(runtime.audio), handshake };
  });
  handle("audio:ready", async (payload) => {
    const value = objectPayload(payload, "audio ready request", { maxBytes: 256_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || runtime.controller.state !== "AUDIO_PREPARING")
      throw new Error("Audio preparation was not committed.");
    let acknowledgement;
    try {
      acknowledgement = validateProcessorReady(runtime, value.ack);
    } catch (error) {
      await failRuntimeClosed(runtime, "PROCESSOR_READY_REJECTED", { error: error.message, classification: "AUDIO_AUTHENTICATION_FAILURE" });
      throw error;
    }
    try {
      await transitionSession(id, "AUDIO_READY", {
        trialId: runtime.trialId,
        eventType: "AUDIO_READY",
        audioReady: true,
        payload: { acknowledgement },
      }, { evidence: { handshake: "PROCESSOR_READY" } });
      runtime.audioReady = true;
      db.db.prepare("UPDATE session_details SET audio_processor_version=?,audio_digest_version=?,audio_pcm_format=?,audio_last_processor_sequence=? WHERE session_id=?")
        .run(acknowledgement.processorVersion, acknowledgement.digestVersion || null, acknowledgement.pcmFormat || null, acknowledgement.processorSequence || null, id);
    } catch (error) {
      runtime.audioReady = false;
      await failRuntimeClosed(runtime, "AUDIO_READY_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
    if (acknowledgement.contextState) runtime.contextStates.push({ state: acknowledgement.contextState, at: Date.now() });
    return { sessionId: id, status: "AUDIO_READY" };
  });
  handle("sessions:start", async (payload) => {
    const value = objectPayload(payload, "session start request");
    const id = sessionId(value);
    if (value.memoryConfirmed !== true) throw new Error("Explicit memory confirmation is required before START.");
    const runtime = runtimes.get(id);
    if (!runtime) throw new Error("Session runtime is unavailable.");
    if (!runtime.audioReady || runtime.controller.state !== "AUDIO_READY")
      throw new Error("A validated PROCESSOR_READY acknowledgement is required before START.");
    const other = [...runtimes.values()].find((candidate) => candidate.id !== id && candidate.controller.state === "RUNNING");
    if (other) throw new Error(`Another formal session is already running: ${other.id}.`);
    try {
      await transitionSession(id, "RUNNING", {
        trialId: runtime.trialId,
        eventType: "STARTED",
        memoryConfirmed: true,
        audioReady: true,
        payload: { memoryConfirmed: true, audioReady: true },
      }, { evidence: { ownerConfirmedMemory: true } });
      runtime.startedUtc = new Date().toISOString();
      powerManager.start("prevent-app-suspension");
      const scheduler = createScheduler(runtime);
      // Keep the queryable research projection in lock-step with the
      // lifecycle event.  The session controller is authoritative for the
      // persisted lifecycle, while this projection exposes the orthogonal
      // participant/evidence phases to reports and recovery without leaking
      // any hidden objective.
      db.research?.updatePhases(id, {
        sessionLifecycle: "RUNNING",
        participantPhaseStatus: "READY",
        evidencePhaseStatus: "SCHEDULED",
      });
      return {
        sessionId: id,
        status: "RUNNING",
        hidden: true,
        reportRequired: true,
        audioStartRequired: true,
        scheduler: scheduler.toRendererDTO(),
        sourceMode: scheduler.sourceMode,
      };
    } catch (error) {
      try { powerManager.stop(); } catch {}
      await failRuntimeClosed(runtime, "SESSION_START_FAILED", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
  });
  handle("audio:started", async (payload) => {
    const value = objectPayload(payload, "audio started request", { maxBytes: 128_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || runtime.controller.state !== "RUNNING") throw new Error("AUDIO_STARTED requires a running session.");
    let ack;
    try {
      ack = validateAudioStarted(runtime, value.ack);
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_STARTED_REJECTED", { error: error.message, classification: "AUDIO_AUTHENTICATION_FAILURE" });
      throw error;
    }
    if (runtime.lastProcessorSequence !== null && ack.processorSequence <= runtime.lastProcessorSequence) {
      const error = new Error("AUDIO_STARTED processorSequence must advance beyond PROCESSOR_READY telemetry.");
      await failRuntimeClosed(runtime, "AUDIO_STARTED_REJECTED", { error: error.message, classification: "AUDIO_AUTHENTICATION_FAILURE" });
      throw error;
    }
    try {
      runtime.lastProcessorSequence = ack.processorSequence ?? runtime.lastProcessorSequence;
    runtime.audioStarted = true;
    runtime.startedUtc = new Date().toISOString();
    db.db.prepare("UPDATE session_details SET actual_start_monotonic_ns=COALESCE(actual_start_monotonic_ns,?),actual_start_utc=COALESCE(actual_start_utc,?) WHERE session_id=?")
      .run(process.hrtime.bigint().toString(), runtime.startedUtc, id);
    db.evidence.appendEvent(id, runtime.trialId, "AUDIO_STARTED", clone(ack));
    runtime.protocolAnchor = {
      name: "AUDIO_STARTED",
      monotonicNs: process.hrtime.bigint().toString(),
      utc: runtime.startedUtc,
      utcMs: Date.parse(runtime.startedUtc),
    };
    db.db.prepare("UPDATE session_details SET protocol_anchor_json=? WHERE session_id=?")
      .run(JSON.stringify(runtime.protocolAnchor), id);
    runtime.protocolStageController = new ProtocolStageController(runtime.profile.protocol, {
      sessionId: id,
      trialId: runtime.trialId,
      onStage: (stage) => {
        const persisted = db.evidence.recordProtocolStage(id, stage);
        db.evidence.appendEvent(id, runtime.trialId, "PROTOCOL_STAGE", {
          stageType: stage.stageType,
          stageSeq: persisted.stageSeq,
          status: stage.status,
          cueId: stage.cueId,
        });
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("mip:protocol-stage", { ...stage, stageSeq: persisted.stageSeq });
      },
      onReturnCue: (stage) => {
        db.evidence.appendEvent(id, runtime.trialId, "RETURN_CUE_ISSUED", {
          stageType: stage.stageType,
          cueId: stage.cueId,
          plannedUtc: stage.plannedUtc,
          plannedMonotonicNs: stage.plannedMonotonicNs,
        });
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send("mip:protocol-return-cue", { ...stage, sessionId: id, trialId: runtime.trialId });
      },
      onComplete: (completion) => {
        if (completion.status === "FAILED") {
          void failRuntimeClosed(runtime, "PROTOCOL_STAGE_FAILURE", {
            error: completion.error || "Protocol stage controller failed",
            classification: "LOGGING_FAILURE",
          });
          return;
        }
        try {
          runtime.protocolCompleted = true;
          db.evidence.appendEvent(id, runtime.trialId, "PROTOCOL_COMPLETE", { status: completion.status, anchor: completion.anchor });
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("mip:protocol-complete", { sessionId: id, trialId: runtime.trialId, status: completion.status });
        } catch (error) {
          runtime.protocolCompleted = false;
          void failRuntimeClosed(runtime, "PROTOCOL_COMPLETION_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
        }
      },
      });
      runtime.protocolStageController.start(runtime.protocolAnchor);
      const result = await runtime.scheduler?.start();
      runtime.schedulerResult = result ? clone(result) : null;
      db.research?.updatePhases(id, {
        sessionLifecycle: "RUNNING",
        participantPhaseStatus: runtime.scheduler?.participantPhase || "ACTIVE",
        evidencePhaseStatus: runtime.scheduler?.evidencePhase || "RUNNING",
      });
      if (runtime.scheduler?.plan.mode === SCHEDULER_MODES.PREGENERATED_HIDDEN) {
        for (const record of runtime.scheduler.getHiddenOutputsForAuthority()) {
          db.evidence.recordOutput(id, {
            trialId: runtime.trialId,
            outputSeq: record.sequence,
            value: record.value,
            region: record.region,
            generatedUtc: runtime.startedUtc,
            monotonicNs: process.hrtime.bigint().toString(),
            scheduledUtc: record.scheduledUtc,
            scheduledMonotonicNs: record.scheduledMonotonicNs.toString(),
            timingStatus: "PREGENERATED_HIDDEN",
          });
        }
      }
      return { sessionId: id, accepted: true, status: "RUNNING" };
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_STARTED_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
  });
  handle("audio:stop-requested", async (payload) => {
    const value = objectPayload(payload, "audio stop request", { maxBytes: 64_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || !["RUNNING", "TIMING_DEVIATION"].includes(runtime.controller.state))
      throw new Error("AUDIO_STOP_REQUESTED requires a running formal session.");
    const reason = stringValue(value.reason || "owner_returned", "audio stop reason", { max: 256 });
    try {
      requestAudioStop(runtime, reason);
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_STOP_REQUEST_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
    return { sessionId: id, accepted: true, status: runtime.controller.state };
  });
  handle("audio:failed", async (payload) => {
    const value = objectPayload(payload, "audio failure request", { maxBytes: 128_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime) throw new Error("Session runtime is unavailable.");
    const state = runtime.controller.state;
    if (!["AUDIO_PREPARING", "AUDIO_READY", "RUNNING", "TIMING_DEVIATION"].includes(state))
      throw new Error(`Audio failure is not accepted in session state ${state}.`);
    const reason = stringValue(value.error || value.reason || "AudioWorklet failure", "audio failure", { max: 1_000 });
    try {
      if (runtime.scheduler && ["RUNNING", "COMMITTED"].includes(runtime.scheduler.status))
        runtime.scheduler.interrupt(reason);
      powerManager.stop();
      await transitionSession(id, "AUDIO_FAILED", {
        trialId: runtime.trialId,
        eventType: "AUDIO_FAILED",
        audioFailed: true,
        error: reason,
        payload: { error: reason, processorErrors: value.processorErrors || [] },
      }, { recoveryState: "AUDIO_WORKLET_FAILURE", evidence: { error: reason } });
      db.research?.updatePhases(id, {
        sessionLifecycle: "FAILED",
        participantPhaseStatus: "FAILED",
        evidencePhaseStatus: "FAILED",
      });
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_FAILURE_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
    return { sessionId: id, status: "AUDIO_FAILED", recoveryRequired: true };
  });
  handle("audio:telemetry", async (payload) => {
    const value = objectPayload(payload, "audio telemetry request", { maxBytes: 512_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || !["AUDIO_READY", "RUNNING"].includes(runtime.controller.state))
      throw new Error("Audio telemetry is not accepted for this session state.");
    let telemetry;
    try {
      telemetry = validateTelemetry(runtime, value.telemetry);
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_TELEMETRY_REJECTED", { error: error.message, classification: "AUDIO_AUTHENTICATION_FAILURE" });
      throw error;
    }
    try {
      runtime.latestTelemetry = telemetry;
      runtime.audioObservations.push({
        observedUtc: new Date().toISOString(),
        monotonicNs: process.hrtime.bigint().toString(),
        contextState: telemetry.state,
        observationType: "PROCESSOR_TELEMETRY",
        frames: telemetry.generatedFrames ?? telemetry.frames,
        details: telemetry,
      });
      db.evidence.appendEvent(id, runtime.trialId, "AUDIO_TELEMETRY", telemetry);
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_TELEMETRY_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
    return { sessionId: id, accepted: true, frames: telemetry.generatedFrames ?? telemetry.frames };
  });
  const receiveFinalization = async (payload) => {
    const value = objectPayload(payload, "audio finalization request", { maxBytes: 768_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime) throw new Error("Session runtime is unavailable.");
    const state = runtime.controller.state;
    if (!["RUNNING", "TIMING_DEVIATION"].includes(state))
      return rejectAudioFinalization(runtime, `AUDIO_FINALIZED is not accepted in session state ${state}`, { state });
    if (runtime.audioFinalization)
      return rejectAudioFinalization(runtime, "AUDIO_FINALIZED was already accepted for this session", { state });
    let finalization;
    try {
      requestAudioStop(runtime, "audio_finalized");
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_STOP_REQUEST_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
    try {
      finalization = validateAudioFinalization(runtime, value.finalization);
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_FINALIZED_REJECTED", { error: error.message, classification: "AUDIO_AUTHENTICATION_FAILURE" });
      throw error;
    }
    try {
      runtime.audioFinalization = finalization;
      runtime.lastProcessorSequence = finalization.processorSequence ?? runtime.lastProcessorSequence;
      db.db.prepare("UPDATE session_details SET audio_processor_version=?,audio_digest_version=?,audio_pcm_format=?,audio_last_processor_sequence=? WHERE session_id=?")
        .run(finalization.processorVersion, finalization.digestVersion || null, finalization.pcmFormat || null, finalization.processorSequence || null, id);
      runtime.protocolStageController?.notifyAudioFinalized({ processorSequence: finalization.processorSequence });
      return await formalReturn(runtime);
    } catch (error) {
      await failRuntimeClosed(runtime, "AUDIO_FINALIZATION_PERSISTENCE_FAILURE", { error: error.message, classification: "LOGGING_FAILURE" });
      throw error;
    }
  };
  handle("audio:finalized", receiveFinalization);
  handle("sessions:return", async (payload) => {
    const value = objectPayload(payload, "formal return request", { maxBytes: 768_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime) throw new Error("Session runtime is unavailable.");
    if (Object.prototype.hasOwnProperty.call(value, "finalization"))
      return rejectAudioFinalization(runtime, "Submit the AudioWorklet finalization through audioFinalized before requesting return.", { route: "sessions:return" });
    return formalReturn(runtime);
  });
  handle("audio:finalize", async (payload) => {
    const value = objectPayload(payload, "legacy audio finalization request", { maxBytes: 768_000 });
    if (!value.finalization)
      throw new Error("Legacy frame-only finalization is rejected; submit the AudioWorklet AUDIO_FINALIZED acknowledgement through audioFinalized.");
    return receiveFinalization(value);
  });
  handle("audio:block", () => {
    throw new Error("Arbitrary renderer audio bytes are not accepted; the final digest must come from AUDIO_FINALIZED.");
  });
  handle("sessions:end-participant-phase", (payload) => {
    const value = objectPayload(payload, "participant phase end request", { maxBytes: 64_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || !(runtime.scheduler instanceof TemporalEvidenceScheduler)) throw new Error("Participant phase separation is available only for temporal evidence sessions.");
    const phase = runtime.scheduler.endParticipantPhase(stringValue(value.reason || "participant_return", "phase end reason", { max: 256 }));
    db.research.updatePhases(id, { participantPhaseStatus: phase });
    return { sessionId: id, participantPhase: phase, evidencePhase: runtime.scheduler.evidencePhase, evidenceContinues: runtime.scheduler.status === "RUNNING" };
  });
  handle("sessions:abort-evidence", async (payload) => {
    const value = objectPayload(payload, "evidence abort request", { maxBytes: 64_000 });
    const id = sessionId(value);
    if (value.confirmed !== true && value.confirm !== true) throw new Error("Explicit confirmation is required to abort evidence collection.");
    const runtime = runtimes.get(id);
    if (!runtime || !(runtime.scheduler instanceof TemporalEvidenceScheduler)) throw new Error("Evidence abortion is available only for temporal evidence sessions.");
    const currentStatus = sessionStatus(id);
    const evidencePhase = String(runtime.scheduler.evidencePhase || "").toUpperCase();
    // Abort is only meaningful while the committed evidence window is still
    // active.  A late click/race after normal completion must not rewrite a
    // completed/reveal-eligible session's orthogonal projection to ABORTED.
    // Repeated aborts of an already-aborted run remain idempotent.
    if (evidencePhase === "COMPLETE" || evidencePhase === "MISSED" || ["COMPLETE", "REVEAL_ELIGIBLE", "REVEALED"].includes(currentStatus))
      throw new Error("Evidence collection is already complete; abort is unavailable.");
    const result = runtime.scheduler.abortEvidence(stringValue(value.reason || "owner_abort", "evidence abort reason", { max: 256 }));
    // Evidence abortion is an explicit destructive lifecycle action, not a
    // renderer-only scheduler flag.  Persist the orthogonal evidence
    // projection and move the session projection through the authoritative
    // state graph so restart/recovery cannot mistake an aborted run for an
    // active one.  The transition remains legal from RUNNING, RETURNED and
    // report-lock states, preserving evidence already collected.
    if (["RUNNING", "TIMING_DEVIATION", "RETURNED", "RAW_REPORT_DRAFT", "RAW_REPORT_LOCKED"].includes(currentStatus)) {
      await transitionSession(id, "ABORTED", {
        trialId: runtime.trialId,
        eventType: "EVIDENCE_ABORTED",
        aborted: true,
        reason: value.reason || "owner_abort",
        payload: { classification: result.abortClassification, noBackfill: true },
      }, { evidence: { classification: result.abortClassification, noBackfill: true } });
    }
    db.research.updatePhases(id, { evidencePhaseStatus: "ABORTED", sessionLifecycle: "ABORTED", revealStatus: "BLOCKED" });
    runtime.controller = new SessionController("ABORTED", { sessionId: id, trialId: runtime.trialId });
    try { powerManager?.stop(); } catch {}
    return { sessionId: id, status: result.status, evidencePhase: result.evidencePhase, abortClassification: result.abortClassification, noBackfill: true };
  });
  handle("research:definition", (payload) => {
    const id = sessionId(payload);
    return db.research.getDefinition(id, { full: isRevealed(id), revealed: isRevealed(id) });
  });
  handle("research:phases", (payload) => db.research.getPhases(sessionId(payload)));
  handle("future-target:get", (payload) => {
    const id = sessionId(payload);
    return db.research.getTargetGeneration(id, { full: isRevealed(id), revealed: isRevealed(id) });
  });
  handle("research:occurrences", (payload) => {
    const value = objectPayload(payload, "occurrence request", { maxBytes: 32_000 });
    const id = identifier(value.id, "session id");
    if (!isRevealed(id)) return { sessionId: id, redacted: true, records: [] };
    const limit = value.limit === undefined ? 5_000 : positiveInteger(value.limit, "occurrence page size", { min: 1, max: 5_000 });
    const offset = value.offset === undefined ? 0 : positiveInteger(value.offset, "occurrence offset", { min: 0 });
    return { sessionId: id, redacted: false, ...db.research.occurrences(id, { full: true, revealed: true, paginated: true, limit, offset }) };
  });
}

function registerReportHandlers() {
  handle("reports:draft", async (payload) => {
    const value = objectPayload(payload, "report draft request", { maxBytes: 768_000 });
    const id = sessionId(value);
    const report = objectPayload(value.report || {}, "raw report", { maxBytes: 512_000 });
    const state = sessionStatus(id);
    if (!["RETURNED", "RAW_REPORT_DRAFT", "ABORTED"].includes(state))
      throw new Error("A report cannot be drafted before formal return.");
    if (state === "ABORTED") {
      // An evidence abort is terminal for machine collection but must not
      // discard the participant's subjective report. Keep the session
      // lifecycle classification ABORTED and persist the mutable report
      // directly under its orthogonal report projection.
      db.db.transaction(() => {
        db.saveReportDraft(id, report);
        db.evidence.appendEvent(id, null, "RAW_REPORT_DRAFT_SAVED_AFTER_ABORT", { saved: true, evidenceAborted: true });
        db.research.updatePhases(id, { reportStatus: "DRAFT", sessionLifecycle: "ABORTED" });
      })();
    } else if (state === "RETURNED") {
      await transitionSession(id, "RAW_REPORT_DRAFT", {
        eventType: "RAW_REPORT_DRAFT_SAVED",
        reportDraft: true,
        rawReportDraft: true,
        payload: { saved: true },
      }, {
        evidence: { reportDraft: true },
        before: () => db.saveReportDraft(id, report),
      });
    } else {
      db.db.transaction(() => {
        db.saveReportDraft(id, report);
        db.evidence.appendEvent(id, null, "RAW_REPORT_DRAFT_SAVED", { saved: true });
      })();
    }
    return { sessionId: id, saved: true, status: "RAW_REPORT_DRAFT" };
  });
  handle("reports:draft:get", (payload) => {
    const id = sessionId(payload);
    const row = db.db.prepare("SELECT saved_utc,payload_json FROM raw_report_drafts WHERE session_id=?").get(id);
    return row ? { sessionId: id, savedUtc: row.saved_utc, report: redactSessionData(JSON.parse(row.payload_json), isRevealed(id)) } : null;
  });
  handle("reports:get", (payload) => {
    const id = sessionId(payload);
    const revealed = isRevealed(id);
    const report = db.getReport(id, { full: revealed });
    if (!revealed) {
      return report.locked
        ? { locked: true, redacted: true, lockedUtc: report.lockedUtc, schemaVersion: report.schemaVersion }
        : { locked: false };
    }
    return report.locked ? { ...report, payload: report.report } : report;
  });
  handle("reports:lock", async (payload) => {
    const value = objectPayload(payload, "report lock request", { maxBytes: 768_000 });
    const id = sessionId(value);
    const report = objectPayload(value.report || {}, "raw report", { maxBytes: 512_000 });
    validateRawReportForLock(report);
    const schemaVersion = reportSchemaVersion(id);
    const result = db.lockRawReportAtomic(id, report, schemaVersion);
    const runtime = runtimes.get(id);
    if (runtime) {
      const persistedStatus = sessionStatus(id);
      runtime.controller = new SessionController(
        persistedStatus === "ABORTED" ? "ABORTED" : result.revealEligible ? "REVEAL_ELIGIBLE" : "RAW_REPORT_LOCKED",
        { sessionId: id, trialId: runtime.trialId },
      );
    }
    return { sessionId: id, locked: true, rawReportLocked: true, revealEligible: result.revealEligible === true, revealed: false, alreadyLocked: result.alreadyLocked === true, schemaVersion: result.schemaVersion };
  });
  handle("sessions:reveal", async (payload) => {
    const id = sessionId(payload);
    const row = db.db.prepare("SELECT hidden_objective,participant_target,status,(SELECT mode FROM research_definitions WHERE session_id=sessions.session_id) AS research_mode FROM sessions WHERE session_id=?").get(id);
    if (!row) throw new Error("Session not found.");
    if (row.status === "REVEALED" || row.status === "COMPLETE") throw new Error("Session has already been revealed.");
    if (row.status !== "REVEAL_ELIGIBLE") throw new Error("Reveal is not eligible until the raw report is locked.");
    const researchMeta = db.db.prepare("SELECT mode,primary_endpoint,outcome_space_json,temporal_analysis_json FROM research_definitions WHERE session_id=?").get(id);
    const strictResearchGate = requiresStrictResearchGate(researchMeta);
    const researchGate = strictResearchGate ? db.research?.revealGate(id) : null;
    if (researchGate && !researchGate.eligible) throw new Error(`Reveal is blocked until the committed evidence gate is complete: ${researchGate.missing.join(", ")}`);
    await transitionSession(id, "REVEALED", {
      eventType: "REVEALED",
      revealAuthorized: true,
      payload: { objective: row.hidden_objective },
    }, { evidence: { ownerAuthorizedReveal: true } });
    db.research?.updatePhases(id, { revealStatus: "REVEALED", sessionLifecycle: "REVEALED" });
    const analysis = db.analyses.getFull(id)?.analysis || null;
    const objective = parseStoredJson(row.hidden_objective, row.hidden_objective);
    const futureTarget = row.research_mode === "FUTURE_TARGET" ? db.research.getTargetGeneration(id, { full: true, revealed: true }) : null;
    return {
      sessionId: id,
      objective,
      participantTarget: row.participant_target,
      ...(futureTarget ? { prediction: futureTarget.prediction } : {}),
      ...(futureTarget ? { futureTarget } : {}),
      analysis,
      ...(analysis && typeof analysis === "object" ? analysis : {}),
      rawReportLocked: true,
      revealEligible: false,
      revealed: true,
      hasReveal: true,
      integrity: db.integrity.verifySession(id, { persist: true }),
    };
  });
  handle("analysis:get", (payload) => {
    const id = sessionId(payload);
    if (!isRevealed(id)) {
      const metadata = db.analyses.get(id);
      return metadata ? { sessionId: id, present: true, redacted: true, version: metadata.version, analysisVersion: metadata.analysisVersion, createdUtc: metadata.createdUtc } : null;
    }
    return db.analyses.getFull(id);
  });
  handle("analysis:history", (payload) => {
    const id = sessionId(payload);
    const rows = db.analyses.getVersions(id);
    return isRevealed(id)
      ? rows
      : rows.map((row) => ({ sessionId: id, version: row.version, analysisVersion: row.analysisVersion, createdUtc: row.createdUtc, redacted: true }));
  });
  handle("analysis:run", (payload) => {
    const id = sessionId(payload);
    const status = sessionStatus(id);
    if (!["RETURNED", "RAW_REPORT_DRAFT", "RAW_REPORT_LOCKED", "REVEAL_ELIGIBLE", "REVEALED", "COMPLETE", "ABORTED"].includes(status))
      throw new Error("Analysis requires finalized machine output.");
    const runtime = runtimes.get(id);
    const derived = persistedAnalysis(runtime || id);
    const result = db.analyses.save(id, derived.analysis, { input: derived.input, analysisVersion: derived.analysis.analysisVersion });
    return isRevealed(id) ? result : { sessionId: id, present: true, redacted: true, version: result.version, analysisVersion: result.analysisVersion, createdUtc: result.createdUtc };
  });
  handle("aggregate:list", (payload) => {
    const value = objectPayload(payload, "aggregate filters", { optional: true, maxBytes: 32_000 });
    return db.research.listAggregates({ limit: value.limit || 100, offset: value.offset || 0, full: false });
  });
  handle("aggregate:get", (payload) => {
    const value = objectPayload(payload);
    return db.research.getAggregate(identifier(value.aggregateId || value.id, "aggregate id"), { full: true });
  });
  handle("aggregate:run", (payload) => {
    const value = objectPayload(payload, "aggregate request", { maxBytes: 256_000 });
    if (!Array.isArray(value.sessionIds) || value.sessionIds.length < 1 || value.sessionIds.length > 500) throw new Error("sessionIds must contain 1-500 sessions.");
    const sessions = value.sessionIds.map((candidate) => {
      const id = identifier(candidate, "session id");
      if (!isRevealed(id)) throw new Error("Cross-session analysis requires revealed sessions; hidden target/output data cannot enter an aggregate.");
      const definition = db.research.getDefinition(id, { full: true });
      const analysis = db.analyses.getFull(id)?.analysis || persistedAnalysis(id).analysis;
      const phases = db.research.getPhases(id);
      const evidencePhase = phases?.evidencePhaseStatus || null;
      return {
        sessionId: id,
        definition: definition?.definition || null,
        compatibilityFingerprint: definition?.compatibilityFingerprint || null,
        analysis,
        phases,
        evidencePhase,
        completed: evidencePhase === "COMPLETE" || isRevealed(id),
        deviated: ["ABORTED", "MISSED", "INCOMPLETE", "FAILED"].includes(String(evidencePhase || "").toUpperCase()),
        committedDefinition: definition?.committed !== false,
      };
    });
    const aggregate = aggregateCrossSession(sessions, {
      workflow: value.workflow || "AGGREGATE",
      compatibilityFingerprint: value.compatibilityFingerprint,
      requireCompatible: value.requireCompatible !== false,
      exploratory: value.exploratory === true,
    });
    return db.research.saveAggregate({ ...aggregate, definition: { sessionIds: value.sessionIds, compatibilityFingerprint: aggregate.compatibilityFingerprint } });
  });
  handle("annotations:add", (payload) => {
    const value = objectPayload(payload, "late annotation request", { maxBytes: 512_000 });
    const id = sessionId(value);
    if (!["RAW_REPORT_LOCKED", "REVEAL_ELIGIBLE", "REVEALED", "COMPLETE"].includes(sessionStatus(id)))
      throw new Error("Late annotations are available only after the raw report is locked.");
    const kind = stringValue(value.kind || "NOTE", "annotation kind", { max: 64, pattern: /^[A-Za-z0-9 _-]+$/ });
    const annotation = db.evidence.addLateAnnotation(id, kind, objectPayload(value.annotation || value.payload || {}, "annotation", { maxBytes: 256_000 }));
    db.evidence.appendEvent(id, null, "LATE_ANNOTATION_ADDED", { annotationId: annotation.id, kind, annotationHash: annotation.annotationHash });
    return redactSessionData(annotation, isRevealed(id));
  });
  handle("annotations:list", (payload) => {
    const id = sessionId(payload);
    return db.evidence.annotations(id).map((annotation) => redactSessionData(annotation, isRevealed(id)));
  });
}

async function selectedBackupInput(payload, title) {
  const value = objectPayload(payload, "backup request", { optional: true, maxBytes: 64_000 });
  if (value.path !== undefined) throw new Error("Renderer-supplied backup paths are not accepted.");
  if (value.backupId) return { backupId: identifier(value.backupId, "backup id"), sha256: value.sha256 };
  if (value.pathToken) return { pathToken: identifier(value.pathToken, "backup path token"), sha256: value.sha256 };
  const selection = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ["openFile"],
    filters: [
      { name: "SQLite backup", extensions: ["sqlite3", "sqlite", "db"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (selection.canceled || !selection.filePaths[0]) return null;
  const token = `PATH-${crypto.randomBytes(16).toString("hex")}`;
  db.backups.registerPathToken(token, path.resolve(selection.filePaths[0]));
  return { pathToken: token, sha256: value.sha256 };
}

function registerServiceHandlers() {
  handle("settings:get", () => {
    const lastBackup = db.db.prepare("SELECT backup_id AS backupId,created_utc AS createdUtc,sha256,verified FROM backups ORDER BY created_utc DESC LIMIT 1").get() || null;
    const persistedResearchDefaults = db.db.prepare("SELECT defaults_json,defaults_hash,updated_utc FROM research_defaults WHERE defaults_id=1").get() || null;
    return {
      ...settings,
      researchDefaults: settings.researchDefaults || parseStoredJson(persistedResearchDefaults?.defaults_json, {}),
      researchDefaultsHash: persistedResearchDefaults?.defaults_hash || null,
      appVersion: app.getVersion(),
      engineVersion: ENGINE_VERSION,
      audioVersion: AUDIO_VERSION,
      processorVersion: PROCESSOR_VERSION,
      schemaVersion: db.schemaVersion,
      databasePath: db.file,
      databaseSize: fs.existsSync(db.file) ? fs.statSync(db.file).size : 0,
      lastBackup,
      power: powerManager.toRendererDTO(),
    };
  });
  handle("settings:update", (payload) => {
    const value = objectPayload(payload, "settings", { maxBytes: 64_000 });
    const allowed = new Set(["defaultProfileId", "theme", "telemetryHistory", "audioOutputLabel", "researchDefaults"]);
    for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`Unsupported setting: ${key}.`);
    const next = { ...settings };
    if (value.defaultProfileId !== undefined) next.defaultProfileId = identifier(value.defaultProfileId, "default profile id");
    if (value.theme !== undefined) next.theme = stringValue(value.theme, "theme", { max: 32, pattern: /^[A-Za-z0-9_-]+$/ });
    if (value.telemetryHistory !== undefined) {
      if (typeof value.telemetryHistory !== "boolean") throw new Error("telemetryHistory must be boolean.");
      next.telemetryHistory = value.telemetryHistory;
    }
    if (value.audioOutputLabel !== undefined) next.audioOutputLabel = stringValue(value.audioOutputLabel, "audio output label", { max: 200, min: 0 });
    if (value.researchDefaults !== undefined) {
      const defaults = objectPayload(value.researchDefaults, "research defaults", { maxBytes: 128_000 });
      let effective;
      try { effective = resolveEffectiveConfiguration({ app: defaults }); } catch (error) { throw new Error(`Invalid research defaults: ${error.message}`); }
      next.researchDefaults = clone(defaults);
      db.db.prepare("INSERT INTO research_defaults(defaults_id,defaults_json,defaults_hash,updated_utc) VALUES(1,?,?,?) ON CONFLICT(defaults_id) DO UPDATE SET defaults_json=excluded.defaults_json,defaults_hash=excluded.defaults_hash,updated_utc=excluded.updated_utc").run(JSON.stringify(next.researchDefaults), effective.configHash, new Date().toISOString());
    }
    persistSettings(next);
    settings = next;
    return clone(settings);
  });
  handle("backup:create", async (payload) => {
    objectPayload(payload, "backup create request", { optional: true, maxBytes: 16_000 });
    return db.backups.create();
  });
  handle("backup:history", (payload) => {
    const value = objectPayload(payload, "backup history filters", { optional: true, maxBytes: 16_000 });
    const limit = value.limit === undefined ? 100 : positiveInteger(value.limit, "backup history limit", { min: 1, max: 500 });
    return db.db.prepare("SELECT backup_id AS backupId,created_utc AS createdUtc,path,sha256,verified FROM backups ORDER BY created_utc DESC LIMIT ?").all(limit).map((row) => ({ ...row, verified: Boolean(row.verified) }));
  });
  handle("backup:verify", async (payload) => {
    const input = await selectedBackupInput(payload, "Select a MIP backup to verify");
    return input ? db.backups.verifyBackup(input) : { cancelled: true };
  });
  handle("backup:restore", async (payload) => {
    const active = activeFormalSession();
    if (active) throw new Error(`Cannot restore while formal session ${active.session_id} is active.`);
    const input = await selectedBackupInput(payload, "Select a MIP backup to restore");
    if (!input) return { cancelled: true };
    const result = await db.backups.restore(input, {
      activeSessionGuard: () => ({ active: Boolean(activeFormalSession()) }),
    });
    runtimes.clear();
    return { ...result, schemaVersion: db.schemaVersion };
  });
  handle("exports:session", (payload) => {
    const value = objectPayload(payload, "session export request", { maxBytes: 32_000 });
    const id = sessionId(value);
    if (!isRevealed(id)) throw new Error("A complete session export is available only after actual reveal.");
    return db.exporter.exportSession(id, { includeHidden: true });
  });
  handle("exports:aggregate", (payload) => {
    const value = objectPayload(payload, "aggregate export request", { maxBytes: 32_000 });
    return db.exporter.exportAggregate(identifier(value.aggregateId || value.id, "aggregate id"));
  });
  handle("legacy:import", async (payload) => {
    const value = objectPayload(payload, "legacy import request", { optional: true, maxBytes: 10_000_000 });
    if (value.path !== undefined) throw new Error("Renderer-supplied legacy import paths are not accepted.");
    let source;
    if (value.data !== undefined) source = { data: value.data };
    else {
      const selection = await dialog.showOpenDialog(mainWindow, {
        title: "Select legacy MIP data",
        properties: ["openFile", "openDirectory"],
        filters: [
          { name: "Legacy MIP data", extensions: ["json", "jsonl", "ndjson"] },
          { name: "All files", extensions: ["*"] },
        ],
      });
      if (selection.canceled || !selection.filePaths[0]) return { cancelled: true };
      source = path.resolve(selection.filePaths[0]);
    }
    return db.legacyImporter.import(source, { allowDuplicate: value.allowDuplicate === true });
  });
  handle("diagnostics:export", async (payload) => {
    objectPayload(payload, "diagnostics export request", { optional: true, maxBytes: 16_000 });
    const selection = await dialog.showSaveDialog(mainWindow, {
      title: "Export MIP diagnostics",
      defaultPath: path.join(app.getPath("downloads"), `mip-diagnostics-${Date.now()}.json`),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (selection.canceled || !selection.filePath) return { cancelled: true };
    const integrity = db.integrity.verifyDatabase({ persist: false });
    const payloadValue = {
      exportedUtc: new Date().toISOString(),
      appVersion: app.getVersion(),
      engineVersion: ENGINE_VERSION,
      audioVersion: AUDIO_VERSION,
      processorVersion: PROCESSOR_VERSION,
      schemaVersion: db.schemaVersion,
      databasePath: db.file,
      databaseSize: fs.existsSync(db.file) ? fs.statSync(db.file).size : 0,
      integrity: { valid: integrity.valid, sessionCount: integrity.sessionCount, foreignKeyViolations: integrity.foreignKeyViolations },
      audioHealth: db.audioHealth.list({}),
      backupHistory: db.db.prepare("SELECT backup_id AS backupId,created_utc AS createdUtc,sha256,verified FROM backups ORDER BY created_utc DESC LIMIT 100").all(),
    };
    fs.writeFileSync(path.resolve(selection.filePath), JSON.stringify(payloadValue, null, 2), "utf8");
    return { exported: true, path: path.resolve(selection.filePath), schemaVersion: db.schemaVersion };
  });
  handle("audio:health:prepare", (payload) => {
    const value = objectPayload(payload, "audio health preparation", { maxBytes: 64_000 });
    const nowMs = Date.now();
    for (const [id, challenge] of healthChallenges) if (nowMs - challenge.createdAt > 15 * 60_000) healthChallenges.delete(id);
    const recipeId = identifier(value.recipeId, "audio health recipe id");
    const recipeVersion = positiveInteger(value.recipeVersion, "audio health recipe version");
    const recipe = db.recipes.getVersion(recipeId, recipeVersion);
    if (!recipe || recipe.isDraft || recipe.status !== "ACTIVE" || recipe.isActive !== true || recipe.incomplete)
      throw new Error("Audio health requires an active, complete recipe version.");
    const requestedSampleRate = value.sampleRate === undefined ? Number(recipe.sampleRate) : positiveInteger(value.sampleRate, "audio health sample rate", { min: 8_000, max: 192_000 });
    if (requestedSampleRate !== Number(recipe.sampleRate)) throw new Error("Audio health sample rate must match the recipe.");
    const channels = value.channels === undefined ? Number(recipe.channels || 2) : positiveInteger(value.channels, "audio health channels", { min: 1, max: 2 });
    if (channels !== Number(recipe.channels || 2)) throw new Error("Audio health channel count must match the recipe.");
    const challengeId = `HEALTH-${crypto.randomBytes(16).toString("hex")}`;
    const handshake = {
      sessionId: challengeId,
      trialId: `${challengeId}-T001`,
      audioNonce: crypto.randomBytes(32).toString("hex"),
      digestVersion: PCM_DIGEST_VERSION,
      pcmFormat: PCM_CANONICAL_FORMAT.body,
      channels,
    };
    healthChallenges.set(challengeId, {
      ...handshake,
      recipeId,
      recipeVersion,
      sampleRate: requestedSampleRate,
      configFingerprint: recipe.configFingerprint,
      createdAt: Date.now(),
    });
    return { challengeId, handshake, recipe: audioSummary(recipe) };
  });
  handle("audio:health", (payload) => {
    const value = objectPayload(payload, "audio health diagnostic", { maxBytes: 768_000 });
    const ownerResult = value.ownerResult === undefined ? "Uncertain" : stringValue(value.ownerResult, "audio health owner result", { max: 64 });
    if (!["Clean", "Artifact heard", "Left-right issue", "Uncertain"].includes(ownerResult))
      throw new Error("audio health owner result must be Clean, Artifact heard, Left-right issue, or Uncertain.");
    const checkMode = value.checkMode === undefined ? "CUSTOM" : stringValue(value.checkMode, "audio health check mode", { max: 32, pattern: /^[A-Za-z0-9_-]+$/ });
    const intendedDurationMs = value.intendedDurationMs === undefined || value.intendedDurationMs === null
      ? null
      : positiveInteger(value.intendedDurationMs, "audio health intended duration", { min: 1, max: 3_600_000 });
    if (!["QUICK_60S", "STABILITY_10M", "OWNER_SOAK_60M", "CUSTOM"].includes(checkMode))
      throw new Error("Unsupported audio health check mode.");
    const telemetry = value.telemetry === undefined ? null : objectPayload(value.telemetry, "audio health telemetry", { maxBytes: 512_000 });
    const challengeId = value.challengeId === undefined ? null : identifier(value.challengeId, "audio health challenge id");
    const challenge = challengeId ? healthChallenges.get(challengeId) : null;
    if (challengeId) healthChallenges.delete(challengeId);
    const telemetryStructurallyValid = Boolean(
      telemetry &&
      Number.isFinite(Number(telemetry.sampleRate)) &&
      Number.isSafeInteger(Number(telemetry.generatedFrames ?? telemetry.frames)) &&
      typeof (telemetry.digest ?? value.digest) === "string" &&
      /^[a-f0-9]{64}$/i.test(telemetry.digest ?? value.digest),
    );
    const processorIdentityVerified = Boolean(
      telemetryStructurallyValid &&
      telemetry.processorVersion === PROCESSOR_VERSION &&
      telemetry.recipeId && telemetry.recipeVersion !== undefined &&
      typeof telemetry.configFingerprint === "string" && /^[a-f0-9]{64}$/i.test(telemetry.configFingerprint) &&
      telemetry.digestVersion === PCM_DIGEST_VERSION &&
      telemetry.pcmFormat === PCM_CANONICAL_FORMAT.body &&
      Number(telemetry.channels || 0) === 2 &&
      (!challenge || (
        telemetry.sessionId === challenge.sessionId &&
        telemetry.trialId === challenge.trialId &&
        telemetry.audioNonce === challenge.audioNonce &&
        telemetry.recipeId === challenge.recipeId &&
        Number(telemetry.recipeVersion) === challenge.recipeVersion &&
        Number(telemetry.sampleRate) === challenge.sampleRate &&
        telemetry.configFingerprint === challenge.configFingerprint
      )),
    );
    const digestVerified = telemetryStructurallyValid;
    const continuityValid = telemetry?.continuity?.ok !== false && !telemetry?.processorErrors?.length;
    const verification = {
      telemetryStructurallyValid,
      processorIdentityVerified,
      digestVerified,
      continuityValid,
      ownerAudibleResult: ownerResult,
      challengeId,
      challengeVerified: Boolean(challenge && processorIdentityVerified),
      verificationNote: challenge && processorIdentityVerified ? "AudioWorklet identity and canonical stream metadata matched the main-process challenge." : "A main-process AudioWorklet challenge was missing or did not match; telemetry is unverified.",
    };
    const actualTelemetry = Boolean(challenge && telemetryStructurallyValid && processorIdentityVerified && digestVerified && continuityValid);
    return db.audioHealth.save({
      ...clone(value),
      telemetry,
      checkMode,
      intendedDurationMs,
      verification,
      sampleRate: telemetry?.sampleRate ?? value.sampleRate,
      generatedFrames: telemetry?.generatedFrames ?? telemetry?.frames ?? value.generatedFrames,
      continuity: telemetry?.continuity ?? value.continuity ?? {},
      clipping: telemetry?.clipping ?? value.clipping ?? false,
      digest: telemetry?.digest ?? value.digest ?? null,
      integrityStatus: actualTelemetry ? "VERIFIED" : "UNVERIFIED",
      ownerResult,
    });
  });
  handle("audio:health-history", (payload) => db.audioHealth.list(objectPayload(payload, "audio health filters", { optional: true, maxBytes: 32_000 })));
  handle("audio:health-detail", (payload) => db.audioHealth.get(identifier(objectPayload(payload).id, "audio health diagnostic id")));
  handle("audio:health-verify", (payload) => db.audioHealth.verify(identifier(objectPayload(payload).id, "audio health diagnostic id")));
  handle("calibration:history", (payload) => db.calibrations.list(objectPayload(payload, "calibration filters", { optional: true, maxBytes: 32_000 })));
  handle("calibration:detail", (payload) => db.calibrations.get(identifier(objectPayload(payload).id, "calibration id")));
  handle("calibration:verify", (payload) => db.calibrations.verify(identifier(objectPayload(payload).id, "calibration id")));
  handle("calibration:save", (payload) => {
    const value = objectPayload(payload, "calibration result", { maxBytes: 512_000 });
    return db.calibrations.save({ ...clone(value), integrityStatus: "UNVERIFIED" });
  });
  handle("calibration:run", (payload) => {
    const value = objectPayload(payload, "calibration request", { optional: true, maxBytes: 64_000 });
    const provider = value.provider === undefined ? "OS_CSPRNG" : stringValue(value.provider, "random provider", { max: 64 });
    if (!["OS_CSPRNG", "DETERMINISTIC_PRNG_TEST"].includes(provider)) throw new Error("Unsupported calibration random provider.");
    const samples = positiveInteger(value.samples ?? 256, "calibration sample count", { min: 2, max: 1_000_000 });
    const rootSeed = provider === "DETERMINISTIC_PRNG_TEST"
      ? stringValue(value.seed ?? "mip-calibration-fixture", "calibration seed", { max: 512 })
      : crypto.randomBytes(32);
    const source = createRandomSources(rootSeed, { provider })[RANDOM_SOURCES.MACHINE_OUTPUT];
    const outcomeSpace = normalizeOutcomeSpace(value.outcomeSpace || { type: "BINARY", values: [0, 1] });
    const cardinality = outcomeSpaceSize(outcomeSpace);
    const counts = Object.create(null);
    const started = process.hrtime.bigint();
    const observations = [];
    const seenOutcomes = new Set();
    let min = null;
    let max = null;
    for (let index = 0; index < samples; index += 1) {
      const outcome = sampleOutcome(outcomeSpace, source);
      // Preserve type identity for enumerated values such as `1` and `"1"`,
      // while retaining the historical `"0"`/`"1"` keys for binary and
      // numeric-range calibration output.
      const key = outcomeSpace.type === "ENUMERATED_VALUES"
        ? `${typeof outcome}:${String(outcome)}`
        : String(outcome);
      counts[key] = (counts[key] || 0) + 1;
      seenOutcomes.add(key);
      if (typeof outcome === "number" && Number.isFinite(outcome)) {
        min = min === null ? outcome : Math.min(min, outcome);
        max = max === null ? outcome : Math.max(max, outcome);
      }
      if (observations.length < 10_000) observations.push(outcome);
    }
    const unique = seenOutcomes.size;
    const duplicateCount = samples - unique;
    const result = db.calibrations.save({
      provider,
      providerVersion: source.version,
      samples,
      counts,
      statistics: {
        outcomeSpace,
        cardinality,
        duplicateCount,
        uniqueCount: unique,
        min,
        max,
        bucketCount: Object.keys(counts).length,
        proportionOne: outcomeSpace.type === "BINARY" ? (counts["1"] || 0) / samples : undefined,
      },
      metadata: {
        appVersion: APP_VERSION,
        engineVersion: ENGINE_VERSION,
        randomSource: source.metadata(),
        elapsedMonotonicNs: (process.hrtime.bigint() - started).toString(),
        randomDomain: RANDOM_SOURCES.MACHINE_OUTPUT,
        observationsHash: sha256(canonical({ preview: observations, previewCount: observations.length, samples, counts })),
        observationsPreviewCount: observations.length,
      },
      integrityStatus: "VERIFIED",
    });
    return { ...result, samples: result.sampleCount };
  });
}

function registerHandlers() {
  registerLibraryHandlers();
  registerSessionHandlers();
  registerReportHandlers();
  registerServiceHandlers();
}

async function recoverIncompleteSessions(reason = "application startup") {
  if (!db?.db?.open) return;
  const temporalStates = ["RETURNED", "RAW_REPORT_DRAFT", "RAW_REPORT_LOCKED"];
  const formalPlaceholders = FORMAL_ACTIVE_STATES.map(() => "?").join(",");
  const rows = db.db
    .prepare(`
      SELECT s.session_id,s.status
      FROM sessions s
      LEFT JOIN research_definitions rd ON rd.session_id=s.session_id
      WHERE s.status IN (${formalPlaceholders})
         OR (rd.session_id IS NOT NULL AND s.status IN (?,?,?))
      ORDER BY s.created_utc
    `)
    .all(...FORMAL_ACTIVE_STATES, ...temporalStates);
  for (const row of rows) {
    const id = row.session_id;
    try {
      const researchDefinition = db.research?.getDefinition(id, { full: true })?.definition || null;
      const researchTarget = researchDefinition?.targetDefinition || {};
      const futureTarget = db.research?.getTargetGeneration(id, { full: true }) || null;
      const temporal = Boolean(researchDefinition && isTemporalResearchDefinition(researchDefinition));
      const phaseProjection = db.research?.getPhases(id) || {};
      if (["RETURNED", "RAW_REPORT_DRAFT", "RAW_REPORT_LOCKED"].includes(row.status) && !temporal)
        continue;
      const futureScheduleStillPending = temporal &&
        researchDefinition.mode === EXPERIMENT_MODES.FUTURE_TARGET &&
        !futureTarget &&
        researchTarget.scheduledUtc &&
        Date.parse(researchTarget.scheduledUtc) > Date.now();
      // A process restart must never backfill a future target. If its
      // committed anchor has already passed and no generation event exists,
      // persist one explicit MISSED event and leave the session incomplete.
      if (researchDefinition?.mode === EXPERIMENT_MODES.FUTURE_TARGET && !futureTarget && researchTarget.scheduledUtc && Date.parse(researchTarget.scheduledUtc) <= Date.now()) {
        db.research.recordTargetGeneration(id, {
          prediction: researchTarget.prediction,
          target: null,
          scheduledUtc: researchTarget.scheduledUtc,
          scheduledMonotonicNs: researchTarget.scheduledMonotonicNs,
          actualUtc: new Date().toISOString(),
          actualMonotonicNs: process.hrtime.bigint().toString(),
          status: "MISSED_FUTURE_TARGET_GENERATION",
        });
        db.evidence.appendEvent(id, trialIdFor(id), "MISSED_FUTURE_TARGET_GENERATION", {
          classification: "TARGET_MISSED_DURING_APPLICATION_UNAVAILABLE",
          scheduledUtc: researchTarget.scheduledUtc,
          actualUtc: new Date().toISOString(),
          toleranceMs: researchDefinition?.temporalAnalysis?.toleranceMs ?? null,
          noBackfill: true,
        });
        db.research.updatePhases(id, { evidencePhaseStatus: "MISSED" });
      } else if (researchDefinition?.mode === EXPERIMENT_MODES.FUTURE_TARGET && !futureTarget) {
        db.research.updatePhases(id, { evidencePhaseStatus: "TARGET_PENDING" });
      }
      const evidencePhaseAfterClockCheck = String(db.research?.getPhases(id)?.evidencePhaseStatus || phaseProjection.evidencePhaseStatus || "").toUpperCase();
      const recoveryDecision = classifyStartupRecovery({
        status: row.status,
        temporal,
        evidencePhaseStatus: evidencePhaseAfterClockCheck,
        futureScheduleStillPending,
      });
      const integrity = db.integrity.verifySession(id, { persist: false });
      db.evidence.appendEvent(id, trialIdFor(id), "RECOVERY_CHECK", {
        classification: integrity.valid ? "PERSISTED_EVIDENCE_VALID" : "PERSISTED_EVIDENCE_REQUIRES_REVIEW",
        errorCount: integrity.errors.length,
      });
      if (!integrity.valid && !["DRAFT", "TARGET_ASSIGNED", "READY"].includes(row.status) && row.status !== "RECOVERY_REQUIRED") {
        await transitionSession(id, "INTEGRITY_FAILED", {
          eventType: "RECOVERY_INTEGRITY_FAILED",
          integrityFailed: true,
          integrityError: integrity.errors.join("; "),
          payload: { classification: "PERSISTED_EVIDENCE_REQUIRES_REVIEW", errorCount: integrity.errors.length },
        }, { recoveryState: "INTEGRITY_FAILED", evidence: { classification: "PERSISTED_EVIDENCE_REQUIRES_REVIEW" } });
        continue;
      }
      // A process restart is an evidence interruption boundary.  Startup
      // recovery may inspect and classify the persisted SQLite ledger, but it
      // must never recreate an in-memory scheduler or silently resume formal
      // collection.  This keeps the next output opportunity explicit and
      // prevents wall-clock downtime from becoming an implicit backfill.
      if (row.status === "RUNNING") {
        await transitionSession(id, "INTERRUPTED", {
          eventType: "RUNTIME_INTERRUPTED",
          interrupted: true,
          interruption: reason,
          payload: { reason },
        }, { recoveryState: "PROCESS_INTERRUPTED", evidence: { reason } });
        await transitionSession(id, "RECOVERY_REQUIRED", {
          eventType: "RECOVERY_REQUIRED",
          recoveryRequired: true,
          recoveryReason: reason,
          payload: { reason },
        }, { recoveryState: "RECOVERY_REQUIRED", evidence: { reason } });
        if (temporal) {
          db.research?.updatePhases(id, {
            sessionLifecycle: "RECOVERY_REQUIRED",
            // A future-target generation miss is a terminal, explicit
            // evidence classification. Preserve MISSED through the restart
            // interruption instead of relabelling it as an indeterminate
            // incomplete run.
            evidencePhaseStatus: evidencePhaseAfterClockCheck === "MISSED" ? "MISSED" : "INCOMPLETE",
            revealStatus: "BLOCKED",
            integrityStatus: integrity.valid ? "VERIFIED" : "FAILED",
          });
        }
      } else if (row.status === "TIMING_DEVIATION" || row.status === "INTERRUPTED" || row.status === "AUDIO_FAILED") {
        await transitionSession(id, "RECOVERY_REQUIRED", {
          eventType: "RECOVERY_REQUIRED",
          recoveryRequired: true,
          recoveryReason: reason,
          payload: { reason },
        }, { recoveryState: "RECOVERY_REQUIRED", evidence: { reason } });
        if (temporal) {
          db.research?.updatePhases(id, {
            sessionLifecycle: "RECOVERY_REQUIRED",
            evidencePhaseStatus: "INCOMPLETE",
            revealStatus: "BLOCKED",
            integrityStatus: integrity.valid ? "VERIFIED" : "FAILED",
          });
        }
      } else if (row.status === "AUDIO_PREPARING") {
        await transitionSession(id, "AUDIO_FAILED", {
          eventType: "AUDIO_RUNTIME_LOST",
          audioFailed: true,
          error: reason,
          payload: { reason },
        }, { recoveryState: "AUDIO_RUNTIME_LOST", evidence: { reason } });
        await transitionSession(id, "RECOVERY_REQUIRED", {
          eventType: "RECOVERY_REQUIRED",
          recoveryRequired: true,
          recoveryReason: reason,
          payload: { reason },
        }, { recoveryState: "RECOVERY_REQUIRED", evidence: { reason } });
        if (temporal) {
          db.research?.updatePhases(id, {
            sessionLifecycle: "RECOVERY_REQUIRED",
            participantPhaseStatus: "FAILED",
            evidencePhaseStatus: "FAILED",
            revealStatus: "BLOCKED",
            integrityStatus: integrity.valid ? "VERIFIED" : "FAILED",
          });
        }
      } else if (["COMMITTED", "AUDIO_READY"].includes(row.status) && !futureScheduleStillPending) {
        await transitionSession(id, "ABORTED", {
          eventType: "RUNTIME_ABORTED",
          aborted: true,
          reason,
          payload: { reason },
        }, { recoveryState: "RUNTIME_NOT_RECONSTRUCTED", evidence: { reason } });
      } else if (["DRAFT", "TARGET_ASSIGNED", "READY"].includes(row.status)) {
        await transitionSession(id, "RECOVERY_REQUIRED", {
          eventType: "DRAFT_RECOVERY_REQUIRED",
          recoveryRequired: true,
          recoveryReason: reason,
          payload: { classification: "DRAFT_NOT_COMMITTED", reason },
        }, { recoveryState: "DRAFT_NOT_COMMITTED", evidence: { classification: "DRAFT_NOT_COMMITTED" } });
      }
      const recoveredProjection = db.research?.getPhases(id) || {};
      if (recoveryDecision.action === "MARK_INCOMPLETE_REVIEW") {
        // Participant return/report entry is a valid orthogonal phase, but a
        // process restart while evidence was active cannot be resumed without
        // an explicit owner-controlled recovery action. Preserve every SQLite
        // row, mark the evidence incomplete, and keep reveal hard-blocked.
        const persistedOutputCount = Number(db.db.prepare("SELECT COUNT(*) AS count FROM machine_outputs WHERE session_id=?").get(id)?.count || 0);
        const targetGeneration = db.research?.getTargetGeneration(id, { full: false }) || null;
        db.db.transaction(() => {
          db.sessions.setStatus(id, row.status, "PROCESS_INTERRUPTED");
          db.research.updatePhases(id, {
            sessionLifecycle: "RECOVERY_REQUIRED",
            evidencePhaseStatus: "INCOMPLETE",
            revealStatus: "BLOCKED",
            integrityStatus: integrity.valid ? "VERIFIED" : "FAILED",
          });
          db.evidence.appendEvent(id, trialIdFor(id), "EVIDENCE_RECOVERY_REQUIRED", {
            classification: "PERSISTED_TEMPORAL_RUNTIME_NOT_RESUMED",
            reason,
            resumed: false,
            noBackfill: true,
            persistedOutputCount,
            targetGenerationStatus: targetGeneration?.status || null,
          });
        })();
      } else if (recoveryDecision.action === "PRESERVE_SCHEDULE_METADATA") {
        // A committed future-target schedule is retained as metadata only. No
        // target or scheduler is materialized before an explicit START action.
        db.db.transaction(() => {
          db.sessions.setStatus(id, row.status, "SCHEDULE_PRESERVED_AFTER_RESTART");
          db.research.updatePhases(id, {
            sessionLifecycle: "COMMITTED",
            evidencePhaseStatus: "TARGET_PENDING",
            revealStatus: "BLOCKED",
          });
          db.evidence.appendEvent(id, trialIdFor(id), "FUTURE_TARGET_SCHEDULE_PRESERVED", {
            classification: "SCHEDULE_METADATA_ONLY",
            reason,
            targetGenerated: false,
            noBackfill: true,
          });
        })();
      }
      // If evidence completed just before a process loss, the scheduler's
      // asynchronous reveal-eligibility edge may not have been persisted.
      // Re-evaluate the complete gate during startup rather than leaving a
      // permanently locked report that requires an unrelated user action.
      const recoveredPhases = db.research?.getPhases(id) || {};
      const recoveredStatus = db.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(id)?.status;
      if (temporal && recoveredStatus === "RAW_REPORT_LOCKED" && recoveredPhases.evidencePhaseStatus === "COMPLETE") {
        const gate = db.research.revealGate(id);
        if (gate.eligible) {
          await transitionSession(id, "REVEAL_ELIGIBLE", {
            trialId: trialIdFor(id),
            eventType: "REVEAL_ELIGIBLE_RECOVERED",
            revealEligible: true,
            payload: { gate: "FULL_RESEARCH_GATE", recovered: true },
          }, { evidence: { gate: "FULL_RESEARCH_GATE", recovered: true } });
          db.research.updatePhases(id, { revealStatus: "ELIGIBLE", sessionLifecycle: "REVEAL_ELIGIBLE" });
        }
      }
    } catch (error) {
      db.evidence.appendEvent(id, trialIdFor(id), "RECOVERY_ATTEMPT_FAILED", { reason, error: error.message });
    }
  }
}

async function stopForShutdown() {
  for (const runtime of runtimes.values()) {
    if (runtime.scheduler instanceof TemporalEvidenceScheduler && runtime.scheduler.status === "RUNNING") {
      // Shutdown is an authority boundary for every temporal scheduler. Pause
      // the timer and persist the fact that the evidence clock stopped; the
      // next process must classify the persisted session for explicit owner
      // recovery and may not silently resume or backfill elapsed slots.
      runtime.scheduler._clearTimer?.();
      db.evidence.appendEvent(runtime.id, runtime.trialId, "EVIDENCE_SCHEDULER_PAUSED_FOR_SHUTDOWN", {
        reason: "application shutdown",
        participantPhase: runtime.scheduler.participantPhase,
        evidencePhase: runtime.scheduler.evidencePhase,
        resumed: false,
        noBackfill: true,
      });
      continue;
    }
    if (["RUNNING", "COMMITTED"].includes(runtime.scheduler?.status)) runtime.scheduler.interrupt("application shutdown");
  }
  powerManager?.stop();
  powerManager?.detach();
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    if (process.env.MIP_E2E_USER_DATA) {
      const e2eUserData = path.resolve(process.env.MIP_E2E_USER_DATA);
      fs.mkdirSync(e2eUserData, { recursive: true });
      app.setPath("userData", e2eUserData);
    }
    db = new MipDatabase(app.getPath("userData"));
    loadSettings();
    powerManager = new PowerManager({
      powerSaveBlocker,
      powerMonitor,
      onEvidence: appendPowerEvidence,
    }).attach();
    await recoverIncompleteSessions();
    registerHandlers();
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        ],
      },
    }));
    createWindow();
    if (process.env.MIP_E2E_RESULT) {
      const run = () => runElectronE2E(mainWindow, {
        resultPath: process.env.MIP_E2E_RESULT,
        phase: process.env.MIP_E2E_PHASE || "initial",
        expectedSessionId: process.env.MIP_E2E_EXPECT_SESSION || null,
        expectedRecipeId: process.env.MIP_E2E_EXPECT_RECIPE || null,
      }).catch((error) => {
        console.error("Electron E2E failed", error);
      }).finally(() => app.quit());
      if (mainWindow.webContents.isLoading()) mainWindow.webContents.once("did-finish-load", run);
      else run();
    }
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }).catch((error) => {
    console.error(error);
    app.quit();
  });

  app.on("before-quit", (event) => {
    if (shutdownStarted) return;
    event.preventDefault();
    shutdownStarted = true;
    stopForShutdown()
      .catch((error) => console.error(error))
      .finally(() => {
        db?.close();
        app.quit();
      });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
