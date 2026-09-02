import { canonical, sha256 } from "../../engine.js";
import {
  normalizeOutcomeSpace,
  outcomeSpaceSize,
  containsOutcome,
  normalizeExperimentMode,
  normalizeTargetDefinition,
  normalizeExecutionWindow,
  normalizeTargetOffsetMs,
  isParticipantStopAnchor,
  normalizeTemporalAnalysisPlan,
  normalizeCrossSessionAnalysis,
  evaluateRevealGate,
  createCompatibilityFingerprint,
  PRIMARY_ENDPOINTS,
  TARGET_ANCHORS,
} from "../../domain/research-model.js";
import { json, now } from "../database/db.js";

function copy(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value, (_key, child) => typeof child === "bigint" ? `${child}n` : child));
}

function unavailableStatus(value) {
  return ["MISSED", "UNAVAILABLE", "ABORTED", "FAILED"].includes(String(value || "").toUpperCase());
}

function safeUtc(value, name) {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isFinite(Date.parse(String(value)))) throw new TypeError(`${name} must be a valid UTC datetime`);
  return String(value);
}

function safeMonotonic(value, name) {
  if (value === null || value === undefined || value === "") return null;
  try {
    const normalized = BigInt(value);
    if (normalized < 0n) throw new Error();
    return normalized.toString();
  } catch {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
}

function safeOutputSequence(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) throw new TypeError("occurrence outputSeq must be a non-negative safe integer");
  return normalized;
}

export class ResearchRepository {
  constructor(owner) { this.owner = owner; this.db = owner.db || owner; }

  _atomic(callback) {
    // better-sqlite3 exposes `inTransaction`; repository methods are used both
    // directly by IPC/tests and from the larger begin/commit transactions.
    // Reuse an active transaction so nested calls remain part of the same
    // all-or-nothing commit, while direct calls still get rollback safety.
    if (this.db.inTransaction) return callback();
    return this.db.transaction(callback)();
  }

  _definitionRow(sessionId) { return this.db.prepare("SELECT * FROM research_definitions WHERE session_id=?").get(sessionId); }

  saveDefinition(sessionId, input = {}, options = {}) {
    const committed = options.committed === true || input.committed === true;
    const mode = normalizeExperimentMode(input.mode || input.experimentMode);
    const outcomeSpace = normalizeOutcomeSpace(input.outcomeSpace || { type: "BINARY" });
    const temporalAnalysis = normalizeTemporalAnalysisPlan(input.temporalAnalysis || input.analysisPlan || input.analysis || {}, { plannedBeforeCommit: true });
    const targetDefinition = normalizeTargetDefinition(input.targetDefinition || input.target || {}, { mode });
    const executionWindow = input.executionWindow === undefined || input.executionWindow === null
      ? null
      : normalizeExecutionWindow(input.executionWindow);
    if (targetDefinition.prediction !== null && !containsOutcome(outcomeSpace, targetDefinition.prediction))
      throw new TypeError("target prediction must belong to the selected outcome space");
    if (targetDefinition.target !== null && targetDefinition.target !== undefined && !containsOutcome(outcomeSpace, targetDefinition.target))
      throw new TypeError("target must belong to the selected outcome space");
    const definition = {
      version: input.version || "research-definition-v1",
      mode,
      outcomeSpace,
      cardinality: outcomeSpaceSize(outcomeSpace),
      rng: copy(input.rng || { provider: "OS_CSPRNG", targetDomain: "TARGET_ASSIGNMENT", machineDomain: "MACHINE_OUTPUT", analysisDomain: "ANALYSIS_SIMULATION" }),
      targetDefinition,
      participantPhase: input.participantPhase || (committed ? "READY" : "DRAFT"),
      evidencePhase: input.evidencePhase || "NOT_STARTED",
      outputCadence: input.outputCadence || temporalAnalysis.outputCadence,
      primaryEndpoint: input.primaryEndpoint || temporalAnalysis.primaryEndpoint,
      temporalAnalysis,
      revealPolicy: input.revealPolicy || "AFTER_EVIDENCE_COMPLETE",
      profileId: input.profileId || null,
      profileVersion: input.profileVersion || null,
      targetSemantics: input.targetSemantics || targetDefinition.semantics,
      timingMode: input.timingMode || input.timing?.mode || null,
      timing: copy(input.timing || null),
      executionWindow,
    };
    const canonicalDefinition = canonical(definition);
    const configHash = sha256(canonicalDefinition);
    const compatibilityFingerprint = createCompatibilityFingerprint(definition);
    const existing = this._definitionRow(sessionId);
    if (existing) {
      if (existing.committed) {
        if (existing.config_hash !== configHash) throw new Error(`Research definition is already committed or differs for ${sessionId}`);
      } else if (existing.config_hash !== configHash) {
        // Draft definitions remain editable before commitment.  Once the
        // committed bit is set, the database trigger makes this same update
        // path immutable and a hash mismatch is rejected above.
        this._atomic(() => {
          this.db.prepare(`UPDATE research_definitions SET definition_json=?,config_hash=?,mode=?,outcome_space_json=?,cardinality=?,target_definition_json=?,participant_phase=?,evidence_phase=?,output_cadence=?,primary_endpoint=?,temporal_analysis_json=?,reveal_policy=?,compatibility_fingerprint=? WHERE session_id=? AND committed=0`).run(
            JSON.stringify(definition), configHash, mode, JSON.stringify(outcomeSpace), definition.cardinality,
            JSON.stringify(targetDefinition), definition.participantPhase, definition.evidencePhase, definition.outputCadence,
            definition.primaryEndpoint, JSON.stringify(temporalAnalysis), definition.revealPolicy, compatibilityFingerprint, sessionId,
          );
          // Keep the queryable projection synchronized with the editable
          // draft.  The lifecycle itself remains DRAFT until commit.
          this.updatePhases(sessionId, {
            participantPhaseStatus: definition.participantPhase,
            evidencePhaseStatus: definition.evidencePhase,
          });
        });
      }
      return this.getDefinition(sessionId, { full: true });
    }
    const created = now();
    this.db.prepare(`INSERT INTO research_definitions(session_id,definition_json,config_hash,mode,outcome_space_json,cardinality,target_definition_json,participant_phase,evidence_phase,output_cadence,primary_endpoint,temporal_analysis_json,reveal_policy,compatibility_fingerprint,committed,committed_utc,created_utc)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      sessionId, JSON.stringify(definition), configHash, mode, JSON.stringify(outcomeSpace), definition.cardinality,
      JSON.stringify(targetDefinition), definition.participantPhase, definition.evidencePhase, definition.outputCadence,
      definition.primaryEndpoint, JSON.stringify(temporalAnalysis), definition.revealPolicy, compatibilityFingerprint,
      committed ? 1 : 0, committed ? created : null, created,
    );
    this.db.prepare(`INSERT OR IGNORE INTO session_phase_projections(session_id,session_lifecycle,participant_phase_status,evidence_phase_status,report_status,reveal_status,integrity_status,updated_utc,projection_hash)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(sessionId, committed ? "COMMITTED" : "DRAFT", definition.participantPhase, definition.evidencePhase, "NOT_READY", "HIDDEN", "UNKNOWN", created, sha256(canonical({ sessionId, definition, created })));
    return this.getDefinition(sessionId, { full: true });
  }

  commitDefinition(sessionId, details = {}) {
    const row = this._definitionRow(sessionId);
    if (!row) throw new Error(`Research definition not found: ${sessionId}`);
    if (row.committed) return this.getDefinition(sessionId, { full: true });
    const committedUtc = details.committedUtc || now();
    this._atomic(() => {
      this.db.prepare("UPDATE research_definitions SET committed=1,committed_utc=? WHERE session_id=? AND committed=0").run(committedUtc, sessionId);
      this.updatePhases(sessionId, { sessionLifecycle: "COMMITTED", participantPhaseStatus: "READY" });
    });
    return this.getDefinition(sessionId, { full: true });
  }

  updatePhases(sessionId, values = {}) {
    const current = this.db.prepare("SELECT * FROM session_phase_projections WHERE session_id=?").get(sessionId);
    if (!current) throw new Error(`Research phase projection not found: ${sessionId}`);
    const allowed = ["sessionLifecycle", "participantPhaseStatus", "evidencePhaseStatus", "reportStatus", "revealStatus", "integrityStatus"];
    const next = {
      sessionLifecycle: values.sessionLifecycle || current.session_lifecycle,
      participantPhaseStatus: values.participantPhaseStatus || current.participant_phase_status,
      evidencePhaseStatus: values.evidencePhaseStatus || current.evidence_phase_status,
      reportStatus: values.reportStatus || current.report_status,
      revealStatus: values.revealStatus || current.reveal_status,
      integrityStatus: values.integrityStatus || current.integrity_status,
    };
    const changed = Object.fromEntries(allowed.map((key) => [key, next[key]]));
    const projectionHash = sha256(canonical({ sessionId, ...changed, previous: current.projection_hash }));
    this.db.prepare(`UPDATE session_phase_projections SET session_lifecycle=?,participant_phase_status=?,evidence_phase_status=?,report_status=?,reveal_status=?,integrity_status=?,updated_utc=?,projection_hash=? WHERE session_id=?`).run(
      next.sessionLifecycle, next.participantPhaseStatus, next.evidencePhaseStatus, next.reportStatus, next.revealStatus, next.integrityStatus, now(), projectionHash, sessionId,
    );
    return this.getPhases(sessionId);
  }

  getPhases(sessionId) {
    const row = this.db.prepare("SELECT * FROM session_phase_projections WHERE session_id=?").get(sessionId);
    if (!row) return null;
    const anchor = this.getParticipantStopAnchor(sessionId);
    return { sessionId, sessionLifecycle: row.session_lifecycle, participantPhaseStatus: row.participant_phase_status, evidencePhaseStatus: row.evidence_phase_status, reportStatus: row.report_status, revealStatus: row.reveal_status, integrityStatus: row.integrity_status, updatedUtc: row.updated_utc, projectionHash: row.projection_hash, participantStopAnchor: anchor };
  }

  /**
   * Atomically commit the one authoritative participant Return/Stop anchor.
   * Replays are idempotent only when every captured field is identical; a
   * second/different anchor is rejected so the original evidence cannot be
   * rewritten.
   */
  commitParticipantStopAnchor(sessionId, input = {}) {
    const definitionRow = this._definitionRow(sessionId);
    if (!definitionRow) throw new Error(`Research definition not found: ${sessionId}`);
    if (!definitionRow.committed) throw new Error("Participant stop anchor requires a committed research definition.");
    const definition = json(definitionRow.definition_json, {}) || {};
    const anchor = String(definition.targetDefinition?.anchor || "").toUpperCase();
    const timingMode = String(definition.timing?.mode || definition.timingMode || input.timingMode || "").toUpperCase();
    if (!isParticipantStopAnchor(anchor) && timingMode !== "PARTICIPANT_STOP_ANCHORED")
      throw new Error("Participant stop anchor is only valid for PARTICIPANT_STOP_ANCHORED sessions.");
    const utc = safeUtc(input.utc || input.actualUtc, "participant stop utc");
    const monotonicNs = safeMonotonic(input.monotonicNs ?? input.actualMonotonicNs, "participant stop monotonicNs");
    if (!utc || !monotonicNs) throw new TypeError("Participant stop anchor requires authoritative UTC and monotonic timestamps.");
    const temporal = normalizeTemporalAnalysisPlan(definition.temporalAnalysis || {});
    const primaryWindow = temporal.windows.find((window) => window.id === temporal.primaryWindowId) || temporal.windows[0] || {};
    const preTargetMs = Number(input.preTargetMs ?? primaryWindow.preMs ?? 0);
    const postTargetMs = Number(input.postTargetMs ?? primaryWindow.postMs ?? 0);
    if (!Number.isFinite(preTargetMs) || preTargetMs < 0 || !Number.isFinite(postTargetMs) || postTargetMs < 0)
      throw new TypeError("Participant stop pre/post windows must be non-negative finite numbers.");
    const executionWindow = definition.executionWindow || null;
    const committedOffset = normalizeTargetOffsetMs(
      definition.targetDefinition?.targetOffsetMs ?? definition.timing?.targetOffsetMs ?? 0,
    );
    if (input.targetOffsetMs !== undefined && normalizeTargetOffsetMs(input.targetOffsetMs) !== committedOffset)
      throw new Error("Participant stop target offset does not match the precommitted research definition.");
    const anchorReference = definition.targetDefinition?.anchorReference || definition.timing?.anchorReference || TARGET_ANCHORS.PARTICIPANT_STOP_RETURN;
    if (!isParticipantStopAnchor(anchorReference)) throw new Error("Participant stop anchor reference is invalid.");
    const stopUtcMs = Date.parse(utc);
    const targetUtc = new Date(stopUtcMs + committedOffset).toISOString();
    const targetMonotonicNs = (BigInt(monotonicNs) + BigInt(committedOffset) * 1_000_000n).toString();
    let derivedInsufficient = input.insufficientPreTargetEvidence === true;
    const startRow = this.db.prepare("SELECT actual_start_monotonic_ns FROM session_details WHERE session_id=?").get(sessionId);
    if (startRow?.actual_start_monotonic_ns !== null && startRow?.actual_start_monotonic_ns !== undefined && startRow.actual_start_monotonic_ns !== "") {
      try {
        const requiredPreStartNs = BigInt(targetMonotonicNs) - BigInt(Math.round(preTargetMs * 1e6));
        derivedInsufficient = derivedInsufficient || BigInt(startRow.actual_start_monotonic_ns) > requiredPreStartNs;
      } catch { /* the authoritative scheduler flag remains the fallback */ }
    }
    const payload = {
      sessionId,
      trialId: input.trialId || null,
      // Keep the table-level discriminator compatible with the original
      // v1.2 schema (whose CHECK constraint allowed only PARTICIPANT_STOP);
      // the canonical semantic reference is carried separately below.
      anchor: TARGET_ANCHORS.PARTICIPANT_STOP,
      anchorReference,
      utc,
      monotonicNs,
      stopUtc: utc,
      stopMonotonicNs: monotonicNs,
      targetOffsetMs: committedOffset,
      targetUtc,
      targetMonotonicNs,
      preTargetMs,
      postTargetMs,
      executionWindowStartUtc: input.executionWindowStartUtc || executionWindow?.startUtc || null,
      executionWindowEndUtc: input.executionWindowEndUtc || executionWindow?.endUtc || null,
      timezone: input.timezone || executionWindow?.timezone || "UTC",
      insufficientPreTargetEvidence: derivedInsufficient,
    };
    const hash = sha256(canonical(payload));
    const existing = this.db.prepare("SELECT * FROM participant_stop_anchors WHERE session_id=?").get(sessionId);
    if (existing) {
      if (existing.anchor_hash !== hash) throw new Error(`Participant stop anchor is already recorded for ${sessionId}; replay is rejected.`);
      return this.getParticipantStopAnchor(sessionId);
    }
    const createdUtc = now();
    this._atomic(() => {
      this.db.prepare(`INSERT INTO participant_stop_anchors(session_id,trial_id,anchor,anchor_reference,utc,monotonic_ns,target_offset_ms,target_utc,target_monotonic_ns,pre_target_ms,post_target_ms,execution_window_start_utc,execution_window_end_utc,timezone,insufficient_pre_target_evidence,anchor_hash,created_utc)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        sessionId, payload.trialId, payload.anchor, payload.anchorReference, payload.utc, payload.monotonicNs, payload.targetOffsetMs, payload.targetUtc, payload.targetMonotonicNs, payload.preTargetMs, payload.postTargetMs,
        payload.executionWindowStartUtc, payload.executionWindowEndUtc, payload.timezone, payload.insufficientPreTargetEvidence ? 1 : 0, hash, createdUtc,
      );
      this.owner.evidence?.appendEvent(sessionId, payload.trialId, "PARTICIPANT_STOP_ANCHOR_COMMITTED", payload);
      this.updatePhases(sessionId, {
        evidencePhaseStatus: "POST_TARGET_MONITORING",
        revealStatus: "BLOCKED",
      });
    });
    return this.getParticipantStopAnchor(sessionId);
  }

  getParticipantStopAnchor(sessionId) {
    const row = this.db.prepare("SELECT * FROM participant_stop_anchors WHERE session_id=?").get(sessionId);
    if (!row) return null;
    return {
      sessionId: row.session_id,
      trialId: row.trial_id,
      anchor: row.anchor,
      anchorReference: row.anchor_reference || row.anchor || "PARTICIPANT_STOP_RETURN",
      utc: row.utc,
      monotonicNs: row.monotonic_ns,
      stopUtc: row.utc,
      stopMonotonicNs: row.monotonic_ns,
      targetOffsetMs: Number(row.target_offset_ms ?? 0),
      targetUtc: row.target_utc || new Date(Date.parse(row.utc) + Number(row.target_offset_ms ?? 0)).toISOString(),
      targetMonotonicNs: row.target_monotonic_ns || (BigInt(row.monotonic_ns) + BigInt(Number(row.target_offset_ms ?? 0)) * 1_000_000n).toString(),
      preTargetMs: row.pre_target_ms,
      postTargetMs: row.post_target_ms,
      executionWindow: row.execution_window_start_utc || row.execution_window_end_utc || row.timezone
        ? { startUtc: row.execution_window_start_utc, endUtc: row.execution_window_end_utc, timezone: row.timezone || "UTC" }
        : null,
      insufficientPreTargetEvidence: Boolean(row.insufficient_pre_target_evidence),
      anchorHash: row.anchor_hash,
      createdUtc: row.created_utc,
    };
  }

  getDefinition(sessionId, options = {}) {
    const row = this._definitionRow(sessionId);
    if (!row) return null;
    const revealed = options.full === true || options.revealed === true;
    const definition = json(row.definition_json, {});
    const targetDefinition = json(row.target_definition_json, {}) || {};
    const result = { sessionId, mode: row.mode, cardinality: row.cardinality, outcomeSpace: json(row.outcome_space_json, null), targetAnchor: targetDefinition.anchor || null, anchorReference: targetDefinition.anchorReference || null, targetOffsetMs: targetDefinition.targetOffsetMs ?? null, outputCadence: row.output_cadence, primaryEndpoint: row.primary_endpoint, compatibilityFingerprint: row.compatibility_fingerprint, committed: Boolean(row.committed), committedUtc: row.committed_utc, configHash: row.config_hash, executionWindow: definition.executionWindow || null, timingMode: definition.timingMode || definition.timing?.mode || null };
    if (revealed) { result.definition = definition; result.targetDefinition = json(row.target_definition_json, null); result.temporalAnalysis = json(row.temporal_analysis_json, null); result.revealPolicy = row.reveal_policy; }
    return result;
  }

  recordTargetGeneration(sessionId, event = {}) {
    const definitionRow = this._definitionRow(sessionId);
    if (!definitionRow) throw new Error(`Research definition not found: ${sessionId}`);
    if (!definitionRow.committed) throw new Error("Future target generation requires a committed research definition.");
    if (String(definitionRow.mode).toUpperCase() !== "FUTURE_TARGET")
      throw new Error("Future target generation is only valid for FUTURE_TARGET sessions.");
    const committedSpace = normalizeOutcomeSpace(json(definitionRow.outcome_space_json, null));
    const committedTargetDefinition = json(definitionRow.target_definition_json, {}) || {};
    const prediction = event.prediction ?? committedTargetDefinition.prediction ?? null;
    const scheduledUtc = safeUtc(event.scheduledUtc ?? committedTargetDefinition.scheduledUtc, "scheduledUtc");
    const scheduledMonotonicNs = safeMonotonic(event.scheduledMonotonicNs ?? committedTargetDefinition.scheduledMonotonicNs, "scheduledMonotonicNs");
    const actualUtc = safeUtc(event.actualUtc ?? now(), "actualUtc");
    const actualMonotonicNs = safeMonotonic(event.actualMonotonicNs, "actualMonotonicNs");
    if (!scheduledUtc) throw new TypeError("scheduledUtc is required for a future target event");
    if (prediction !== null && !containsOutcome(committedSpace, prediction))
      throw new TypeError("future target prediction must belong to the committed outcome space");
    const generated = event.target !== undefined && event.target !== null;
    const requestedStatus = String(event.status || (generated ? "GENERATED" : "MISSED")).toUpperCase();
    if (generated && !containsOutcome(committedSpace, event.target))
      throw new TypeError("future target must belong to the committed outcome space");
    // Persistence is a second authority boundary: even if a caller bypasses
    // the scheduler, a generated future target may not be recorded before its
    // committed UTC anchor.  The target remains absent until that instant;
    // missed events are allowed to describe an unavailable anchor explicitly.
    if (generated && Date.parse(actualUtc) < Date.parse(scheduledUtc))
      throw new Error("future target cannot be generated before its scheduled anchor");
    if (generated && requestedStatus === "MISSED")
      throw new Error("A generated future target cannot be classified MISSED.");
    const missedGenerationStatus = ["MISSED", "MISSED_FUTURE_TARGET_GENERATION"].includes(requestedStatus);
    if (!generated && !missedGenerationStatus)
      throw new Error("A future target event without a target must be explicitly classified MISSED.");
    // The scheduler may classify timing as ON_TIME/LATE, but persistence
    // needs one stable lifecycle vocabulary for the reveal gate. Keep the
    // timing classification in the evidence event; store GENERATED here.
    const status = generated ? "GENERATED" : "MISSED";
    const rng = event.rng || event.randomSourceMetadata || null;
    const payload = { sessionId, prediction, target: event.target ?? null, scheduledUtc, scheduledMonotonicNs, actualUtc, actualMonotonicNs, rng: copy(rng), status, generated };
    const hash = sha256(canonical(payload));
    this._atomic(() => {
      const existing = this.db.prepare("SELECT event_hash FROM future_target_events WHERE session_id=?").get(sessionId);
      if (existing) throw new Error(`Future target generation is already recorded for ${sessionId}; replay is rejected.`);
      this.db.prepare("INSERT INTO future_target_events(session_id,prediction_json,target_json,scheduled_utc,scheduled_monotonic_ns,actual_utc,actual_monotonic_ns,rng_metadata_json,status,event_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(sessionId, payload.prediction === null ? null : JSON.stringify(payload.prediction), payload.target === null ? null : JSON.stringify(payload.target), payload.scheduledUtc, payload.scheduledMonotonicNs, payload.actualUtc, payload.actualMonotonicNs, payload.rng === null ? null : JSON.stringify(payload.rng), payload.status, hash, now());
      this.updatePhases(sessionId, { evidencePhaseStatus: payload.status === "MISSED" ? "MISSED" : "TARGET_GENERATED" });
    });
    return this.getTargetGeneration(sessionId, { full: true });
  }

  getTargetGeneration(sessionId, options = {}) {
    const row = this.db.prepare("SELECT * FROM future_target_events WHERE session_id=?").get(sessionId);
    if (!row) return null;
    const revealed = options.full === true || options.revealed === true;
    // Before reveal, expose only gate-safe scheduling metadata.  Actual
    // generation timing and RNG metadata are evidence details and stay out of
    // renderer memory until the owner has authorized the full result.
    const result = revealed
      ? { sessionId, scheduledUtc: row.scheduled_utc, scheduledMonotonicNs: row.scheduled_monotonic_ns, actualUtc: row.actual_utc, actualMonotonicNs: row.actual_monotonic_ns, status: row.status, rng: json(row.rng_metadata_json, null) }
      : { sessionId, scheduledUtc: row.scheduled_utc, status: row.status };
    if (revealed) { result.prediction = json(row.prediction_json, null); result.target = json(row.target_json, null); result.match = result.prediction !== null && result.prediction !== undefined && result.target !== null && result.target !== undefined && String(result.prediction) === String(result.target); }
    if (revealed) result.eventHash = row.event_hash;
    return result;
  }

  recordOccurrence(sessionId, occurrence = {}) {
    const definitionRow = this._definitionRow(sessionId);
    if (!definitionRow) throw new Error(`Research definition not found: ${sessionId}`);
    const value = occurrence.value;
    const committedSpace = normalizeOutcomeSpace(json(definitionRow.outcome_space_json, null));
    if (!containsOutcome(committedSpace, value)) throw new TypeError("target occurrence value must belong to the committed outcome space");
    const outputSeq = safeOutputSequence(occurrence.outputSeq ?? occurrence.sequence);
    if (!definitionRow.committed) throw new Error("Target occurrences require a committed research definition.");
    // The occurrence index is derived from the immutable machine-output
    // ledger.  A legacy import may record an occurrence before its output
    // rows exist, but once a ledger is present an orphan or value mismatch is
    // rejected rather than creating a second source of truth.
    if (outputSeq !== null) {
      const outputCount = Number(this.db.prepare("SELECT COUNT(*) AS count FROM machine_outputs WHERE session_id=?").get(sessionId)?.count || 0);
      if (outputCount > 0) {
        const output = this.db.prepare("SELECT value_json,scheduled_utc,scheduled_monotonic_ns,actual_utc,actual_monotonic_ns FROM machine_outputs WHERE session_id=? AND output_seq=?").get(sessionId, outputSeq);
        if (!output) throw new Error(`Target occurrence outputSeq ${outputSeq} is not present in the machine-output ledger.`);
        if (canonical(json(output.value_json, null)) !== canonical(value))
          throw new Error(`Target occurrence outputSeq ${outputSeq} does not match the authoritative machine output.`);
      }
    }
    const scheduledUtc = safeUtc(occurrence.scheduledUtc, "scheduledUtc");
    const actualUtc = safeUtc(occurrence.actualUtc, "actualUtc");
    const scheduledMonotonicNs = safeMonotonic(occurrence.scheduledMonotonicNs, "scheduledMonotonicNs");
    const actualMonotonicNs = safeMonotonic(occurrence.actualMonotonicNs, "actualMonotonicNs");
    const core = { sessionId, trialId: occurrence.trialId || null, outputSeq, value, region: occurrence.region || null, scheduledUtc, scheduledMonotonicNs, actualUtc, actualMonotonicNs, scheduledLatencyMs: occurrence.scheduledLatencyMs ?? null, signedLatencyMs: occurrence.signedLatencyMs ?? occurrence.latencyMs ?? null, timingClassification: occurrence.timingClassification || null };
    const hash = sha256(canonical(core));
    const occurrenceId = occurrence.occurrenceId || `${sessionId}-O-${core.outputSeq ?? Date.now()}`;
    const existing = this.db.prepare("SELECT record_hash FROM target_occurrences WHERE occurrence_id=?").get(occurrenceId);
    if (existing && existing.record_hash !== hash) throw new Error(`Target occurrence ${occurrenceId} is immutable and already contains different data.`);
    if (existing) return { occurrenceId, ...core, recordHash: existing.record_hash };
    this._atomic(() => {
      this.db.prepare("INSERT OR IGNORE INTO target_occurrences(occurrence_id,session_id,trial_id,output_seq,value_json,region,scheduled_utc,scheduled_monotonic_ns,actual_utc,actual_monotonic_ns,scheduled_latency_ms,signed_latency_ms,timing_classification,record_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(occurrenceId, sessionId, core.trialId, core.outputSeq, JSON.stringify(value), core.region, core.scheduledUtc, core.scheduledMonotonicNs, core.actualUtc, core.actualMonotonicNs, core.scheduledLatencyMs, core.signedLatencyMs, core.timingClassification, hash, now());
    });
    return { occurrenceId, ...core, recordHash: hash };
  }

  occurrences(sessionId, options = {}) {
    const requestedLimit = options.limit === undefined ? 5_000 : Number(options.limit);
    const requestedOffset = options.offset === undefined ? 0 : Number(options.offset);
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) throw new TypeError("occurrence limit must be a positive safe integer");
    if (!Number.isSafeInteger(requestedOffset) || requestedOffset < 0) throw new TypeError("occurrence offset must be a non-negative safe integer");
    const limit = Math.min(5_000, requestedLimit);
    const offset = requestedOffset;
    const rows = this.db.prepare("SELECT * FROM target_occurrences WHERE session_id=? ORDER BY output_seq,occurrence_id LIMIT ? OFFSET ?").all(sessionId, limit, offset);
    const revealed = options.full === true || options.revealed === true;
    const records = rows.map((row) => ({ occurrenceId: row.occurrence_id, sessionId: row.session_id, trialId: row.trial_id, outputSeq: row.output_seq, ...(revealed ? { value: json(row.value_json, null) } : {}), region: row.region, scheduledUtc: row.scheduled_utc, scheduledMonotonicNs: row.scheduled_monotonic_ns, actualUtc: row.actual_utc, actualMonotonicNs: row.actual_monotonic_ns, scheduledLatencyMs: row.scheduled_latency_ms, signedLatencyMs: row.signed_latency_ms, timingClassification: row.timing_classification, recordHash: row.record_hash }));
    return options.paginated ? {
      sessionId,
      offset,
      limit,
      total: Number(this.db.prepare("SELECT COUNT(*) AS count FROM target_occurrences WHERE session_id=?").get(sessionId).count),
      records,
    } : records;
  }

  saveAggregate(aggregate = {}, options = {}) {
    const normalized = normalizeCrossSessionAnalysis(aggregate);
    const payload = { ...copy(aggregate), version: normalized.version, workflow: normalized.workflow, compatibilityFingerprint: aggregate.compatibilityFingerprint || null };
    const hash = sha256(canonical(payload));
    const aggregateId = aggregate.aggregateId || `AGG-${hash.slice(0, 16)}`;
    const existing = this.db.prepare("SELECT aggregate_id,analysis_hash FROM cross_session_analyses WHERE aggregate_id=?").get(aggregateId);
    if (existing) {
      if (existing.analysis_hash !== hash) throw new Error(`Cross-session aggregate ${aggregateId} is immutable and already contains different data.`);
      return this.getAggregate(aggregateId, { full: true });
    }
    this.db.prepare("INSERT INTO cross_session_analyses(aggregate_id,compatibility_fingerprint,definition_json,analysis_json,workflow,exploratory,analysis_hash,created_utc) VALUES(?,?,?,?,?,?,?,?)").run(aggregateId, payload.compatibilityFingerprint, JSON.stringify(aggregate.definition || null), JSON.stringify(payload), normalized.workflow, normalized.exploratory ? 1 : 0, hash, now());
    return this.getAggregate(aggregateId, { full: true });
  }

  getAggregate(aggregateId, options = {}) {
    const row = this.db.prepare("SELECT * FROM cross_session_analyses WHERE aggregate_id=?").get(aggregateId);
    if (!row) return null;
    const revealed = options.full === true || options.revealed === true;
    return { aggregateId: row.aggregate_id, compatibilityFingerprint: row.compatibility_fingerprint, workflow: row.workflow, exploratory: Boolean(row.exploratory), analysisHash: row.analysis_hash, createdUtc: row.created_utc, ...(revealed ? { definition: json(row.definition_json, null), analysis: json(row.analysis_json, null) } : {}) };
  }

  listAggregates(options = {}) {
    const rows = this.db.prepare("SELECT aggregate_id FROM cross_session_analyses ORDER BY created_utc DESC LIMIT ? OFFSET ?").all(Math.min(500, Math.max(1, Number(options.limit || 100))), Math.max(0, Number(options.offset || 0)));
    return rows.map((row) => this.getAggregate(row.aggregate_id, options));
  }

  revealGate(sessionId, extra = {}) {
    const phases = this.getPhases(sessionId) || {};
    const definition = this._definitionRow(sessionId);
    const future = this.getTargetGeneration(sessionId, { full: true });
    const definitionValue = json(definition?.definition_json, {});
    const targetSequence = definitionValue?.targetDefinition?.targetSequence;
    const participantStopAnchor = this.getParticipantStopAnchor(sessionId);
    const participantStop = isParticipantStopAnchor(definitionValue?.targetDefinition?.anchor || definitionValue?.targetDefinition?.anchorReference || definition?.target_definition_json && json(definition.target_definition_json, {})?.anchor);
    const endpoint = definition?.primary_endpoint || definitionValue?.primaryEndpoint;
    const committedPrediction = future?.prediction !== undefined && future?.prediction !== null
      ? future.prediction
      : definitionValue?.targetDefinition?.prediction;
    const primaryResolved = extra.primaryResolved !== undefined
      ? extra.primaryResolved
      : (() => {
        const normalizedEndpoint = String(endpoint || PRIMARY_ENDPOINTS.EXACT_SLOT).toUpperCase();
        const rows = this.db.prepare("SELECT output_seq,scheduled_utc,scheduled_monotonic_ns,timing_status,value_json FROM machine_outputs WHERE session_id=? ORDER BY output_seq").all(sessionId);
        if (normalizedEndpoint === PRIMARY_ENDPOINTS.EXACT_SLOT) {
          const scheduledTargetUtc = participantStopAnchor?.targetUtc || participantStopAnchor?.utc || definitionValue?.targetDefinition?.scheduledUtc;
          const scheduledTargetMs = scheduledTargetUtc ? Date.parse(String(scheduledTargetUtc)) : NaN;
          const row = targetSequence === null || targetSequence === undefined
            ? (Number.isFinite(scheduledTargetMs)
              ? rows.find((candidate) => Number.isFinite(Date.parse(String(candidate.scheduled_utc || ""))) && Date.parse(String(candidate.scheduled_utc)) === scheduledTargetMs)
              : null)
            : rows.find((candidate) => Number(candidate.output_seq) === Number(targetSequence));
          return Boolean(row && !unavailableStatus(row.timing_status));
        }
        const temporal = normalizeTemporalAnalysisPlan(json(definition?.temporal_analysis_json, {}));
        const window = temporal.windows.find((candidate) => candidate.id === temporal.primaryWindowId) || temporal.windows[0];
        const targetUtcMs = definitionValue?.targetDefinition?.scheduledUtc
          ? Date.parse(definitionValue.targetDefinition.scheduledUtc)
          : participantStopAnchor?.targetUtc ? Date.parse(participantStopAnchor.targetUtc) : participantStopAnchor?.utc ? Date.parse(participantStopAnchor.utc) : null;
        const targetIndex = targetSequence === null || targetSequence === undefined ? null : Number(targetSequence);
        const selected = rows.filter((row) => {
          if (normalizedEndpoint === PRIMARY_ENDPOINTS.FIXED_SEQUENCE_WINDOW) {
            const sequence = Number(row.output_seq);
            const start = window.exactSequence !== null
              ? window.exactSequence
              : window.sequenceOffsetStart !== null && targetIndex !== null
                ? targetIndex + window.sequenceOffsetStart
                : window.sequenceStart;
            const end = window.exactSequence !== null
              ? window.exactSequence
              : window.sequenceOffsetEnd !== null && targetIndex !== null
                ? targetIndex + window.sequenceOffsetEnd
                : window.sequenceEnd;
            return Number.isSafeInteger(sequence) && start !== null && end !== null && sequence >= start && sequence <= end;
          }
          if (normalizedEndpoint === PRIMARY_ENDPOINTS.FIXED_TIME_WINDOW) {
            if (!Number.isFinite(targetUtcMs)) return false;
            const scheduled = Date.parse(String(row.scheduled_utc || ""));
            if (!Number.isFinite(scheduled)) return false;
            const latency = scheduled - targetUtcMs;
            return (latency < 0 && window.preMs > 0 && Math.abs(latency) <= window.preMs)
              || (latency >= 0 && window.postMs > 0 && latency <= window.postMs)
              || (latency === 0 && (window.preMs > 0 || window.postMs > 0));
          }
          // TARGET_FREQUENCY evaluates only the committed scheduled primary
          // window.  A window-less legacy definition retains its historical
          // all-output behavior; operational profiles always commit a
          // bounded ±2 second window.
          if (normalizedEndpoint !== PRIMARY_ENDPOINTS.TARGET_FREQUENCY) return false;
          const hasBoundary = window.enabled === false || Number(window.preMs || 0) > 0 || Number(window.postMs || 0) > 0;
          if (!hasBoundary) return true;
          if (!Number.isFinite(targetUtcMs)) return false;
          const scheduled = Date.parse(String(row.scheduled_utc || ""));
          if (!Number.isFinite(scheduled)) return false;
          const latency = scheduled - targetUtcMs;
          return (latency < 0 && window.preMs > 0 && Math.abs(latency) <= window.preMs)
            || (latency >= 0 && window.postMs > 0 && latency <= window.postMs)
            || (latency === 0 && (window.preMs > 0 || window.postMs > 0));
        });
        return selected.length > 0 && selected.every((row) => !unavailableStatus(row.timing_status));
      })();
    const stopAnchorReady = !participantStop || Boolean(participantStopAnchor);
    const stopPreEvidenceReady = !participantStop || participantStopAnchor?.insufficientPreTargetEvidence !== true;
    const effectivePrimaryResolved = stopAnchorReady && stopPreEvidenceReady && primaryResolved;
    const integrityAcceptable = extra.integrityAcceptable !== undefined
      ? extra.integrityAcceptable
      : (this.owner.integrity?.verifySession ? this.owner.integrity.verifySession(sessionId, { persist: false }).valid : true);
    const audioFinalizationRequired = extra.audioFinalizationRequired !== undefined
      ? extra.audioFinalizationRequired === true
      : Boolean(this.db.prepare("SELECT 1 FROM audio_commits WHERE session_id=?").get(sessionId));
    const audioFinalized = extra.audioFinalized !== undefined
      ? extra.audioFinalized === true
      : Boolean(this.db.prepare("SELECT 1 FROM output_finalizations WHERE session_id=?").get(sessionId));
    return evaluateRevealGate({
      mode: definition?.mode,
      rawReportLocked: Boolean(this.db.prepare("SELECT 1 FROM raw_reports_locked WHERE session_id=?").get(sessionId)),
      evidenceComplete: phases.evidencePhaseStatus === "COMPLETE",
      primaryResolved: effectivePrimaryResolved,
      postTargetComplete: extra.postTargetComplete ?? phases.evidencePhaseStatus === "COMPLETE",
      integrityAcceptable,
      audioFinalizationRequired,
      audioFinalized: audioFinalizationRequired ? audioFinalized : true,
      futureTargetGenerated: definition?.mode === "FUTURE_TARGET" ? ["GENERATED", "ON_TIME", "LATE"].includes(future?.status) : true,
      predictionCommitted: definition?.mode === "FUTURE_TARGET" ? committedPrediction !== undefined && committedPrediction !== null : true,
      additionalGates: extra.additionalGates,
    });
  }
}

export default ResearchRepository;
