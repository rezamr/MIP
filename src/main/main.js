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
import { MipDatabase } from "./database/db.js";
import {
  analyzeStream,
  APP_VERSION,
  assignOutcome,
  canonical,
  ENGINE_VERSION,
  requestInstruction,
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
} from "../../public/audio-core.js";
import {
  SESSION_STATES,
  SessionController,
} from "./sessions/session-controller.js";
import {
  SCHEDULER_MODES,
  SessionScheduler,
} from "./sessions/session-scheduler.js";
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
const { handle } = createSecureIpcRouter({
  ipcMain,
  getMainWindow: () => mainWindow,
  rendererFile,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
  const dto = redactSessionData(value, revealed);
  dto.rawReportLocked = Boolean(value.rawReportLocked);
  dto.revealEligible = value.status === "REVEAL_ELIGIBLE";
  dto.revealed = revealed;
  dto.hasReveal = revealed;
  if (!revealed) {
    delete dto.outputHash;
    delete dto.finalFingerprint;
    delete dto.finalStreamDigest;
  }
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
    .prepare(`SELECT session_id,status FROM sessions WHERE status IN (${placeholders}) ORDER BY created_utc DESC LIMIT 1`)
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

function completeAudioRecipe(recipe, audioSource, requestedSampleRate) {
  const sampleRate = requestedSampleRate === undefined
    ? Number(recipe.sampleRate)
    : positiveInteger(requestedSampleRate, "sampleRate", { min: 8_000, max: 192_000 });
  const input = clone(recipe);
  if (input.noise) input.noise.seed = audioSource.int(65_535) + 1;
  input.sampleRate = sampleRate;
  const effective = normalizeRecipe(input);
  const validation = validateEffectiveRecipe(effective);
  if (!validation.valid) throw new Error(`Committed audio recipe is invalid: ${validation.errors.join("; ")}`);
  return effective;
}

function audioSummary(audio) {
  return {
    recipeId: audio.recipeId,
    recipeVersion: audio.version,
    version: audio.version,
    sampleRate: audio.sampleRate,
    channels: audio.channels,
    processorVersion: PROCESSOR_VERSION,
    configFingerprint: audio.configFingerprint,
  };
}

function expectedAudioAck(runtime, type) {
  return {
    type,
    processorVersion: PROCESSOR_VERSION,
    recipeId: runtime.audio.recipeId,
    recipeVersion: runtime.audio.version,
    sampleRate: runtime.audio.sampleRate,
    configFingerprint: runtime.audio.configFingerprint,
  };
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
  const scheduler = new SessionScheduler(config, {
    sessionId: runtime.id,
    trialId: runtime.trialId,
    outputProvider: () => assignOutcome(
      runtime.profile,
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

function persistedAnalysis(runtime) {
  const rows = db.db
    .prepare("SELECT output_seq,region,value_json FROM machine_outputs WHERE session_id=? ORDER BY output_seq")
    .all(runtime.id);
  const blockSize = Number(runtime.profile.output?.blockSize || 1);
  const preCount = Number(runtime.profile.output?.preBlocks || 0) * blockSize;
  const primaryCount = Number(runtime.profile.output?.primaryBlocks || 0) * blockSize;
  const postCount = Number(runtime.profile.output?.postBlocks || 0) * blockSize;
  const totalCount = preCount + primaryCount + postCount || 1;
  const slots = Array(totalCount).fill(null);
  for (const row of rows) if (row.output_seq < slots.length) slots[row.output_seq] = JSON.parse(row.value_json);
  const observedValues = rows.map((row) => JSON.parse(row.value_json));
  const core = analyzeStream({ requested: runtime.objective, values: observedValues });
  const summarize = (start, end, name) => {
    const values = slots.slice(start, end).filter((value) => value !== null);
    const matches = values.filter((value) => value === runtime.objective).length;
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
  const analysis = {
    ...core,
    total: totalCount,
    observedCount: rows.length,
    missingCount: totalCount - rows.length,
    pre,
    primary,
    post,
    exploratory: [pre, post],
    scheduler: jsonSafe(runtime.scheduler?.getResult() || null),
    analysisVersion: runtime.profile.analysis?.version || "analysis-v1",
  };
  return {
    analysis,
    input: {
      requested: runtime.objective,
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
    requestAudioStop(runtime, "formal_return");
    if (["RUNNING", "COMMITTED"].includes(runtime.scheduler?.status))
      runtime.scheduler.interrupt("formal return requested");
    const schedulerResult = runtime.scheduler?.getResult?.() || null;
    const schedulerExpected = Number(runtime.scheduler?.plan?.totalCount || 0);
    const schedulerGenerated = Number(schedulerResult?.generatedCount ?? runtime.scheduler?.outputs?.length ?? 0);
    const schedulerDeviation = Boolean(
      runtime.scheduler &&
      schedulerExpected > 0 &&
      (schedulerResult?.status !== "COMPLETE" || schedulerGenerated < schedulerExpected),
    );
    if (schedulerDeviation && runtime.controller.state === "RUNNING") {
      await transitionSession(runtime.id, "TIMING_DEVIATION", {
        trialId: runtime.trialId,
        eventType: "TIMING_DEVIATION",
        timingDeviation: true,
        deviation: "FORMAL_RETURN_BEFORE_SCHEDULER_COMPLETION",
        payload: {
          schedulerStatus: schedulerResult?.status || runtime.scheduler?.status || "UNKNOWN",
          expectedCount: schedulerExpected,
          generatedCount: schedulerGenerated,
        },
      }, {
        evidence: {
          schedulerStatus: schedulerResult?.status || runtime.scheduler?.status || "UNKNOWN",
          expectedCount: schedulerExpected,
          generatedCount: schedulerGenerated,
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
        if (!db.analyses.get(runtime.id))
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
            integrityStatus: finalization.processorErrors.length === 0 && finalization.continuity?.ok !== false
              ? "VERIFIED"
              : "UNVERIFIED",
          });
        db.evidence.appendEvent(runtime.id, runtime.trialId, "AUDIO_FINALIZED", {
          recipeId: finalization.recipeId,
          recipeVersion: finalization.recipeVersion,
          sampleRate: finalization.sampleRate,
          totalFrames: finalization.totalFrames,
          digest: finalization.digest,
          continuity: finalization.continuity,
          clipping: finalization.clipping,
        });
      },
    });
    powerManager.stop();
    runtime.returned = true;
    return sessionDto(runtime.id);
  })();
  try {
    return await runtime.returnPromise;
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
    const id = sessionId(payload);
    if (!isRevealed(id)) throw new Error("Machine output remains hidden until the session is revealed.");
    return db.evidence.outputs(id, { full: true });
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
    const profileValidation = db.profiles.validate(profile);
    if (!profileValidation.valid) throw new Error(`Profile validation failed: ${profileValidation.errors.join("; ")}`);
    const recipeId = identifier(profile.audio?.recipeId, "profile audio recipe id");
    const recipeVersion = positiveInteger(profile.audio?.version ?? profile.audio?.recipeVersion, "profile audio recipe version");
    const recipe = db.recipes.getVersion(recipeId, recipeVersion);
    if (!recipe) throw new Error(`Audio recipe version is not available in SQLite: ${recipeId} v${recipeVersion}.`);
    const provider = profile.rng?.provider || "OS_CSPRNG";
    const rootSeed = provider === "DETERMINISTIC_PRNG_TEST"
      ? stringValue(value.seed, "deterministic root seed", { max: 512 })
      : crypto.randomBytes(32);
    const randomSources = createRandomSources(rootSeed, { provider });
    const objective = assignOutcome(profile, randomSources[RANDOM_SOURCES.TARGET_ASSIGNMENT]);
    const participantTarget = requestInstruction(profile, objective);
    const audio = completeAudioRecipe(recipe, randomSources[RANDOM_SOURCES.AUDIO_NOISE], value.sampleRate);
    const timing = timingPlan(profile);
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
      },
    );
    const runtime = {
      id: created.id,
      trialId: created.trial,
      profile,
      objective,
      participantTarget,
      audio,
      randomSources,
      controller: new SessionController("COMMITTED", { sessionId: created.id, trialId: created.trial }),
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
    };
    runtimes.set(created.id, runtime);
    return {
      sessionId: created.id,
      trialId: created.trial,
      participantTarget,
      timing,
      status: "COMMITTED",
      rng: { sources: randomSourcesMetadata(randomSources) },
      audio: audioSummary(audio),
      configFingerprint: created.configHash,
    };
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
    return { sessionId: id, status: "AUDIO_PREPARING", audio: clone(runtime.audio) };
  });
  handle("audio:ready", async (payload) => {
    const value = objectPayload(payload, "audio ready request", { maxBytes: 256_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || runtime.controller.state !== "AUDIO_PREPARING")
      throw new Error("Audio preparation was not committed.");
    const acknowledgement = validateProcessorReady(runtime, value.ack);
    await transitionSession(id, "AUDIO_READY", {
      trialId: runtime.trialId,
      eventType: "AUDIO_READY",
      audioReady: true,
      payload: { acknowledgement },
    }, { evidence: { handshake: "PROCESSOR_READY" } });
    runtime.audioReady = true;
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
    await transitionSession(id, "RUNNING", {
      trialId: runtime.trialId,
      eventType: "STARTED",
      memoryConfirmed: true,
      audioReady: true,
      payload: { memoryConfirmed: true, audioReady: true },
    }, { evidence: { ownerConfirmedMemory: true } });
    try {
      runtime.startedUtc = new Date().toISOString();
      powerManager.start("prevent-app-suspension");
      const scheduler = createScheduler(runtime);
      const result = await scheduler.start();
      if (scheduler.plan.mode === SCHEDULER_MODES.PREGENERATED_HIDDEN) {
        for (const record of scheduler.getHiddenOutputsForAuthority()) {
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
      return {
        sessionId: id,
        status: "RUNNING",
        hidden: true,
        reportRequired: true,
        audioStartRequired: true,
        scheduler: scheduler.toRendererDTO(),
        sourceMode: result.sourceMode,
      };
    } catch (error) {
      powerManager.stop();
      await transitionSession(id, "AUDIO_FAILED", {
        trialId: runtime.trialId,
        eventType: "SESSION_START_FAILED",
        error: error.message,
        payload: { error: error.message },
      }, { recoveryState: "START_FAILED", evidence: { error: error.message } });
      throw error;
    }
  });
  handle("audio:started", (payload) => {
    const value = objectPayload(payload, "audio started request", { maxBytes: 128_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || runtime.controller.state !== "RUNNING") throw new Error("AUDIO_STARTED requires a running session.");
    const ack = objectPayload(value.ack, "AUDIO_STARTED acknowledgement", { maxBytes: 64_000 });
    if (ack.type !== "AUDIO_STARTED") throw new Error("AUDIO_STARTED acknowledgement type is invalid.");
    positiveInteger(ack.frame, "AUDIO_STARTED frame", { min: 1 });
    if (ack.contextFrame !== null && ack.contextFrame !== undefined)
      positiveInteger(ack.contextFrame, "AUDIO_STARTED contextFrame", { min: 0 });
    if (ack.currentTime !== null && ack.currentTime !== undefined)
      finiteNumber(ack.currentTime, "AUDIO_STARTED currentTime", { min: 0 });
    runtime.audioStarted = true;
    runtime.startedUtc = new Date().toISOString();
    db.db.prepare("UPDATE session_details SET actual_start_monotonic_ns=COALESCE(actual_start_monotonic_ns,?),actual_start_utc=COALESCE(actual_start_utc,?) WHERE session_id=?")
      .run(process.hrtime.bigint().toString(), runtime.startedUtc, id);
    db.evidence.appendEvent(id, runtime.trialId, "AUDIO_STARTED", clone(ack));
    return { sessionId: id, accepted: true, status: "RUNNING" };
  });
  handle("audio:stop-requested", (payload) => {
    const value = objectPayload(payload, "audio stop request", { maxBytes: 64_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || !["RUNNING", "TIMING_DEVIATION"].includes(runtime.controller.state))
      throw new Error("AUDIO_STOP_REQUESTED requires a running formal session.");
    const reason = stringValue(value.reason || "owner_returned", "audio stop reason", { max: 256 });
    requestAudioStop(runtime, reason);
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
    return { sessionId: id, status: "AUDIO_FAILED", recoveryRequired: true };
  });
  handle("audio:telemetry", (payload) => {
    const value = objectPayload(payload, "audio telemetry request", { maxBytes: 512_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime || !["AUDIO_READY", "RUNNING"].includes(runtime.controller.state))
      throw new Error("Audio telemetry is not accepted for this session state.");
    const telemetry = validateTelemetry(runtime, value.telemetry);
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
    return { sessionId: id, accepted: true, frames: telemetry.generatedFrames ?? telemetry.frames };
  });
  const receiveFinalization = async (payload) => {
    const value = objectPayload(payload, "audio finalization request", { maxBytes: 768_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime) throw new Error("Session runtime is unavailable.");
    requestAudioStop(runtime, "audio_finalized");
    const finalization = validateAudioFinalization(runtime, value.finalization);
    runtime.audioFinalization = finalization;
    return formalReturn(runtime);
  };
  handle("audio:finalized", receiveFinalization);
  handle("sessions:return", async (payload) => {
    const value = objectPayload(payload, "formal return request", { maxBytes: 768_000 });
    const id = sessionId(value);
    const runtime = runtimes.get(id);
    if (!runtime) throw new Error("Session runtime is unavailable.");
    if (value.finalization) runtime.audioFinalization = validateAudioFinalization(runtime, value.finalization);
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
}

function registerReportHandlers() {
  handle("reports:draft", async (payload) => {
    const value = objectPayload(payload, "report draft request", { maxBytes: 768_000 });
    const id = sessionId(value);
    const report = objectPayload(value.report || {}, "raw report", { maxBytes: 512_000 });
    const state = sessionStatus(id);
    if (!["RETURNED", "RAW_REPORT_DRAFT"].includes(state))
      throw new Error("A report cannot be drafted before formal return.");
    if (state === "RETURNED") {
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
    return revealed && report.locked ? { ...report, payload: report.report } : report;
  });
  handle("reports:lock", async (payload) => {
    const value = objectPayload(payload, "report lock request", { maxBytes: 768_000 });
    const id = sessionId(value);
    const report = objectPayload(value.report || {}, "raw report", { maxBytes: 512_000 });
    const state = sessionStatus(id);
    if (!["RETURNED", "RAW_REPORT_DRAFT"].includes(state))
      throw new Error("A report cannot be locked before formal return.");
    if (db.db.prepare("SELECT 1 FROM raw_reports_locked WHERE session_id=?").get(id))
      throw new Error("Raw report is already locked.");
    const payloadJson = JSON.stringify(clone(report));
    const lockHash = sha256(payloadJson);
    const lockedUtc = new Date().toISOString();
    const schemaVersion = reportSchemaVersion(id);
    await transitionSession(id, "RAW_REPORT_LOCKED", {
      eventType: "RAW_REPORT_LOCKED",
      rawReportLocked: true,
      lockHash,
      payload: { lockHash, schemaVersion },
    }, {
      evidence: { lockHash },
      before: () => {
        db.db.prepare("INSERT INTO raw_reports_locked(session_id,locked_utc,payload_json,lock_hash,schema_version) VALUES(?,?,?,?,?)")
          .run(id, lockedUtc, payloadJson, lockHash, schemaVersion);
        db.db.prepare("DELETE FROM raw_report_drafts WHERE session_id=?").run(id);
      },
    });
    await transitionSession(id, "REVEAL_ELIGIBLE", {
      eventType: "REVEAL_ELIGIBLE",
      revealEligible: true,
      payload: { rawReportLocked: true },
    }, { evidence: { gate: "RAW_REPORT_LOCKED" } });
    return { sessionId: id, locked: true, rawReportLocked: true, revealEligible: true, revealed: false, lockHash, schemaVersion };
  });
  handle("sessions:reveal", async (payload) => {
    const id = sessionId(payload);
    const row = db.db.prepare("SELECT hidden_objective,participant_target,status FROM sessions WHERE session_id=?").get(id);
    if (!row) throw new Error("Session not found.");
    if (row.status === "REVEALED" || row.status === "COMPLETE") throw new Error("Session has already been revealed.");
    if (row.status !== "REVEAL_ELIGIBLE") throw new Error("Reveal is not eligible until the raw report is locked.");
    await transitionSession(id, "REVEALED", {
      eventType: "REVEALED",
      revealAuthorized: true,
      payload: { objective: row.hidden_objective },
    }, { evidence: { ownerAuthorizedReveal: true } });
    const analysis = db.analyses.getFull(id)?.analysis || null;
    return {
      sessionId: id,
      objective: row.hidden_objective === null ? null : Number(row.hidden_objective),
      participantTarget: row.participant_target,
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
    if (!["RETURNED", "RAW_REPORT_DRAFT", "RAW_REPORT_LOCKED", "REVEAL_ELIGIBLE", "REVEALED", "COMPLETE"].includes(status))
      throw new Error("Analysis requires finalized machine output.");
    const runtime = runtimes.get(id);
    if (!runtime) throw new Error("Authoritative analysis runtime is unavailable for this session.");
    const derived = persistedAnalysis(runtime);
    const result = db.analyses.save(id, derived.analysis, { input: derived.input, analysisVersion: derived.analysis.analysisVersion });
    return isRevealed(id) ? result : { sessionId: id, present: true, redacted: true, version: result.version, analysisVersion: result.analysisVersion, createdUtc: result.createdUtc };
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
    return {
      ...settings,
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
    const allowed = new Set(["defaultProfileId", "theme", "telemetryHistory", "audioOutputLabel"]);
    for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`Unsupported setting: ${key}.`);
    const next = { ...settings };
    if (value.defaultProfileId !== undefined) next.defaultProfileId = identifier(value.defaultProfileId, "default profile id");
    if (value.theme !== undefined) next.theme = stringValue(value.theme, "theme", { max: 32, pattern: /^[A-Za-z0-9_-]+$/ });
    if (value.telemetryHistory !== undefined) {
      if (typeof value.telemetryHistory !== "boolean") throw new Error("telemetryHistory must be boolean.");
      next.telemetryHistory = value.telemetryHistory;
    }
    if (value.audioOutputLabel !== undefined) next.audioOutputLabel = stringValue(value.audioOutputLabel, "audio output label", { max: 200, min: 0 });
    persistSettings(next);
    settings = next;
    return clone(settings);
  });
  handle("backup:create", async (payload) => {
    objectPayload(payload, "backup create request", { optional: true, maxBytes: 16_000 });
    return db.backups.create();
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
  handle("audio:health", (payload) => {
    const value = objectPayload(payload, "audio health diagnostic", { maxBytes: 768_000 });
    const ownerResult = value.ownerResult === undefined ? "Uncertain" : stringValue(value.ownerResult, "audio health owner result", { max: 64 });
    if (!["Clean", "Artifact heard", "Left-right issue", "Uncertain"].includes(ownerResult))
      throw new Error("audio health owner result must be Clean, Artifact heard, Left-right issue, or Uncertain.");
    const telemetry = value.telemetry === undefined ? null : objectPayload(value.telemetry, "audio health telemetry", { maxBytes: 512_000 });
    const actualTelemetry = Boolean(
      telemetry &&
      Number.isFinite(Number(telemetry.sampleRate)) &&
      Number.isSafeInteger(Number(telemetry.generatedFrames ?? telemetry.frames)) &&
      typeof (telemetry.digest ?? value.digest) === "string" &&
      /^[a-f0-9]{64}$/i.test(telemetry.digest ?? value.digest),
    );
    return db.audioHealth.save({
      ...clone(value),
      telemetry,
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
    const counts = { 0: 0, 1: 0 };
    const started = process.hrtime.bigint();
    for (let index = 0; index < samples; index += 1) counts[source.int(2)] += 1;
    const result = db.calibrations.save({
      provider,
      providerVersion: source.version,
      samples,
      counts,
      statistics: { proportionOne: counts[1] / samples },
      metadata: {
        appVersion: APP_VERSION,
        engineVersion: ENGINE_VERSION,
        randomSource: source.metadata(),
        elapsedMonotonicNs: (process.hrtime.bigint() - started).toString(),
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
  const rows = db.db
    .prepare(`SELECT session_id,status FROM sessions WHERE status IN (${FORMAL_ACTIVE_STATES.map(() => "?").join(",")}) ORDER BY created_utc`)
    .all(...FORMAL_ACTIVE_STATES);
  for (const row of rows) {
    const id = row.session_id;
    try {
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
      } else if (row.status === "TIMING_DEVIATION" || row.status === "INTERRUPTED" || row.status === "AUDIO_FAILED") {
        await transitionSession(id, "RECOVERY_REQUIRED", {
          eventType: "RECOVERY_REQUIRED",
          recoveryRequired: true,
          recoveryReason: reason,
          payload: { reason },
        }, { recoveryState: "RECOVERY_REQUIRED", evidence: { reason } });
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
      } else if (["COMMITTED", "AUDIO_READY"].includes(row.status)) {
        await transitionSession(id, "ABORTED", {
          eventType: "RUNTIME_ABORTED",
          aborted: true,
          reason,
          payload: { reason },
        }, { recoveryState: "RUNTIME_NOT_RECONSTRUCTED", evidence: { reason } });
      }
    } catch (error) {
      db.evidence.appendEvent(id, trialIdFor(id), "RECOVERY_ATTEMPT_FAILED", { reason, error: error.message });
    }
  }
}

async function stopForShutdown() {
  for (const runtime of runtimes.values()) {
    if (["RUNNING", "COMMITTED"].includes(runtime.scheduler?.status)) runtime.scheduler.interrupt("application shutdown");
  }
  await recoverIncompleteSessions("application shutdown");
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
