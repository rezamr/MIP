import { canonical, sha256 } from "../../engine.js";
import { normalizeOutcomeSpace, containsOutcome } from "../../domain/research-model.js";
import { now, json } from "../database/db.js";
import { redact } from "./SessionRepository.js";

function asValue(record) {
  if (Object.prototype.hasOwnProperty.call(record, "value")) return record.value;
  if (Object.prototype.hasOwnProperty.call(record, "value_json")) return json(record.value_json, null);
  return record.payload ?? null;
}

const SAFE_PRE_REVEAL_PAYLOAD_KEYS = new Set([
  "reason", "error", "status", "stage", "stageType", "classification",
  "deviation", "recoveryRequired", "recoveryReason", "source", "saved",
  "gate", "ownerAuthorizedReveal", "ownerConfirmedMemory", "timingDeviation",
  "audioFailed", "interrupted", "aborted", "reportDraft", "rawReportLocked",
  "scheduledUtc", "actualUtc", "latenessMs", "toleranceMs", "noBackfill",
  "anchor", "anchorReference", "stopUtc", "stopMonotonicNs", "targetOffsetMs", "targetUtc", "targetMonotonicNs", "preTargetMs", "postTargetMs", "insufficientPreTargetEvidence",
]);

const PRE_REVEAL_TIMING_SENSITIVE_EVENTS = new Set([
  "MACHINE_OUTPUT_RECORDED",
  "OUTPUT_RECORDED",
  "OUTPUT_MISSED",
  "FUTURE_TARGET_GENERATED",
  "FUTURE_TARGET_MISSED",
  "MISSED_FUTURE_TARGET_GENERATION",
  "MACHINE_OUTPUT_FINALIZED",
]);

function safePreRevealPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => SAFE_PRE_REVEAL_PAYLOAD_KEYS.has(key))
    .map(([key, child]) => [key, child && typeof child === "object" && !Array.isArray(child) ? safePreRevealPayload(child) : child]));
}

export class EvidenceRepository {
  constructor(owner) {
    this.owner = owner;
    this.db = owner.db || owner;
  }

  appendEvent(sessionId, trialId, type, payload = {}) {
    const cleanPayload = JSON.parse(JSON.stringify(payload ?? {}));
    const last = this.db.prepare("SELECT seq,event_hash FROM evidence_events WHERE session_id=? ORDER BY seq DESC LIMIT 1").get(sessionId);
    const seq = (last?.seq || 0) + 1;
    const occurredUtc = now();
    const monotonicNs = process.hrtime.bigint().toString();
    const eventId = `${sessionId}-E${String(seq).padStart(5, "0")}`;
    const base = { sessionId, trialId: trialId || null, seq, eventId, eventType: type, occurredUtc, monotonicNs, payload: cleanPayload, previousHash: last?.event_hash || "GENESIS" };
    const eventHash = sha256(canonical(base));
    this.db.prepare("INSERT INTO evidence_events(session_id,seq,event_id,event_type,occurred_utc,monotonic_ns,payload_json,previous_hash,event_hash,trial_id) VALUES(?,?,?,?,?,?,?,?,?,?)").run(sessionId, seq, eventId, type, occurredUtc, monotonicNs, JSON.stringify(cleanPayload), base.previousHash, eventHash, trialId || null);
    // Transactional SessionController transitions project the state through
    // their adapter after the evidence row has been appended.  Do not create a
    // second projection here: duplicate projections make the audit timeline
    // ambiguous and break the one-event/one-projection invariant.  The legacy
    // STATE_TRANSITION/TRANSITION event forms remain self-projecting for
    // callers that use EvidenceRepository directly.
    if (type === "STATE_TRANSITION" || type === "TRANSITION") {
      const fromState = cleanPayload.fromState ?? cleanPayload.from ?? null;
      const toState = cleanPayload.toState ?? cleanPayload.to ?? cleanPayload.state;
      if (toState) this.projectTransition(sessionId, trialId, fromState, toState, { eventId, occurredUtc, monotonicNs });
    }
    return { ...base, eventHash, hash: eventHash };
  }

  listFull(sessionId) {
    return this.db.prepare("SELECT session_id AS sessionId,seq,event_id AS eventId,event_type AS type,occurred_utc AS occurredUtc,monotonic_ns AS monotonicNs,payload_json AS payload,previous_hash AS previousHash,event_hash AS hash,trial_id AS trialId FROM evidence_events WHERE session_id=? ORDER BY seq").all(sessionId).map((row) => ({ ...row, payload: json(row.payload, {}) }));
  }

  listRedacted(sessionId) {
    const revealed = ["REVEALED", "COMPLETE"].includes(this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status);
    return this.listFull(sessionId).map((event) => revealed ? event : {
      sessionId: event.sessionId,
      seq: event.seq,
      eventId: event.eventId,
      type: event.type,
      // Output/target event timestamps are themselves target-relative evidence
      // and stay hidden until reveal.  Lifecycle/protocol timestamps remain
      // available for an honest pre-reveal audit timeline.
      occurredUtc: PRE_REVEAL_TIMING_SENSITIVE_EVENTS.has(event.type) ? null : event.occurredUtc,
      payload: safePreRevealPayload(event.payload),
    });
  }

  list(sessionId, options = {}) {
    if (options.paginated !== true) return options.full ? this.listFull(sessionId) : this.listRedacted(sessionId);
    const requestedLimit = options.limit === undefined ? 100 : Number(options.limit);
    const requestedOffset = options.offset === undefined ? 0 : Number(options.offset);
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) throw new TypeError("event limit must be a positive safe integer");
    if (!Number.isSafeInteger(requestedOffset) || requestedOffset < 0) throw new TypeError("event offset must be a non-negative safe integer");
    const limit = Math.min(500, requestedLimit);
    const clauses = ["session_id=?"];
    const params = [sessionId];
    if (options.type) { clauses.push("event_type=?"); params.push(String(options.type)); }
    if (Array.isArray(options.types) && options.types.length) {
      const types = options.types.map((type) => String(type)).filter(Boolean).slice(0, 64);
      if (types.length) {
        clauses.push(`event_type IN (${types.map(() => "?").join(",")})`);
        params.push(...types);
      }
    }
    if (options.search) {
      const term = `%${String(options.search)}%`;
      clauses.push("(event_type LIKE ? OR payload_json LIKE ? OR event_id LIKE ?)");
      params.push(term, term, term);
    }
    const where = clauses.join(" AND ");
    const rows = this.db.prepare(`SELECT session_id AS sessionId,seq,event_id AS eventId,event_type AS type,occurred_utc AS occurredUtc,monotonic_ns AS monotonicNs,payload_json AS payload,previous_hash AS previousHash,event_hash AS hash,trial_id AS trialId FROM evidence_events WHERE ${where} ORDER BY seq LIMIT ? OFFSET ?`).all(...params, limit, requestedOffset);
    const revealed = ["REVEALED", "COMPLETE"].includes(this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status);
    const events = rows.map((row) => {
      const event = { ...row, payload: json(row.payload, {}) };
      return options.full && revealed ? event : {
        sessionId: event.sessionId,
        seq: event.seq,
        eventId: event.eventId,
        type: event.type,
        occurredUtc: PRE_REVEAL_TIMING_SENSITIVE_EVENTS.has(event.type) ? null : event.occurredUtc,
        payload: safePreRevealPayload(event.payload),
      };
    });
    const total = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM evidence_events WHERE ${where}`).get(...params).count);
    return { sessionId, offset: requestedOffset, limit, total, events };
  }

  recordOutput(sessionId, record = {}) {
    const outputSeq = Number(record.outputSeq ?? record.index ?? 0);
    if (!Number.isSafeInteger(outputSeq) || outputSeq < 0) throw new Error("outputSeq must be a non-negative safe integer");
    if (!this.db.prepare("SELECT 1 FROM sessions WHERE session_id=?").get(sessionId)) throw new Error(`Session not found: ${sessionId}`);
    const value = asValue(record);
    // Machine output is an authoritative evidence ledger.  When a committed
    // research definition exists, reject values outside its finite outcome
    // space at this boundary as well as in the scheduler.  Missed slots use a
    // deliberate null value and remain valid; legacy/imported sessions without
    // a normalized definition retain their historical write compatibility.
    const definitionRow = this.db.prepare("SELECT outcome_space_json,committed FROM research_definitions WHERE session_id=?").get(sessionId);
    if (definitionRow?.committed && value !== null && !containsOutcome(normalizeOutcomeSpace(json(definitionRow.outcome_space_json, null)), value))
      throw new TypeError("machine output value must belong to the committed outcome space");
    const generatedUtc = record.generatedUtc || record.actualUtc || now();
    const monotonicNs = String(record.monotonicNs ?? process.hrtime.bigint());
    const trialId = record.trialId || record.trial_id || null;
    const region = record.region || record.block || null;
    const scheduledUtc = record.scheduledUtc || record.scheduled_utc || null;
    const scheduledMonotonicNs = record.scheduledMonotonicNs ?? record.scheduled_monotonic_ns ?? null;
    const actualUtc = record.actualUtc || record.actual_utc || generatedUtc;
    const actualMonotonicNs = record.actualMonotonicNs ?? record.actual_monotonic_ns ?? monotonicNs;
    const latenessMs = record.latenessMs ?? record.lateness_ms ?? null;
    const timingStatus = record.timingStatus || record.timing_status || null;
    const core = { sessionId, trialId, outputSeq, generatedUtc, monotonicNs, value, region, scheduledUtc, scheduledMonotonicNs, actualUtc, actualMonotonicNs, latenessMs, timingStatus };
    const calculatedRecordHash = sha256(canonical(core));
    const suppliedRecordHash = record.recordHash || record.record_hash;
    if (suppliedRecordHash !== undefined && suppliedRecordHash !== null && suppliedRecordHash !== calculatedRecordHash)
      throw new Error("recordHash does not match the canonical machine-output record.");
    const recordHash = calculatedRecordHash;
    const write = this.db.transaction(() => {
      this.db.prepare("INSERT INTO machine_outputs(session_id,trial_id,output_seq,generated_utc,monotonic_ns,value_json,region,record_hash,scheduled_utc,scheduled_monotonic_ns,actual_utc,actual_monotonic_ns,lateness_ms,timing_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(sessionId, trialId, outputSeq, generatedUtc, monotonicNs, JSON.stringify(value), region, recordHash, scheduledUtc, scheduledMonotonicNs, actualUtc, actualMonotonicNs, latenessMs, timingStatus);
      if (record.scheduledUtc || record.scheduledMonotonicNs || record.actualUtc || record.actualMonotonicNs) this.recordTiming(sessionId, { ...record, outputSeq });
      this.appendEvent(sessionId, trialId, "MACHINE_OUTPUT_RECORDED", { outputSeq, recordHash });
    });
    write();
    return { ...record, sessionId, trialId, outputSeq, value, generatedUtc, monotonicNs, region, scheduledUtc, scheduledMonotonicNs, actualUtc, actualMonotonicNs, latenessMs, timingStatus, recordHash };
  }

  outputs(sessionId, options = {}) {
    const revealed = ["REVEALED", "COMPLETE"].includes(this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status);
    const requestedLimit = options.limit === undefined ? 5_000 : Number(options.limit);
    const requestedOffset = options.offset === undefined ? 0 : Number(options.offset);
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) throw new TypeError("output limit must be a positive safe integer");
    if (!Number.isSafeInteger(requestedOffset) || requestedOffset < 0) throw new TypeError("output offset must be a non-negative safe integer");
    const limit = Math.min(5_000, requestedLimit);
    const offset = requestedOffset;
    const clauses = ["session_id=?"];
    const params = [sessionId];
    if (options.scheduledFromUtc !== undefined && options.scheduledFromUtc !== null) {
      clauses.push("scheduled_utc>=?");
      params.push(String(options.scheduledFromUtc));
    }
    if (options.scheduledToUtc !== undefined && options.scheduledToUtc !== null) {
      clauses.push("scheduled_utc<=?");
      params.push(String(options.scheduledToUtc));
    }
    const where = clauses.join(" AND ");
    const rows = this.db.prepare(`SELECT * FROM machine_outputs WHERE ${where} ORDER BY output_seq LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const records = rows.map((row) => ({
      sessionId: row.session_id, trialId: row.trial_id, outputSeq: row.output_seq, generatedUtc: row.generated_utc, monotonicNs: row.monotonic_ns, region: row.region, recordHash: row.record_hash, scheduledUtc: row.scheduled_utc, scheduledMonotonicNs: row.scheduled_monotonic_ns, actualUtc: row.actual_utc, actualMonotonicNs: row.actual_monotonic_ns, latenessMs: row.lateness_ms, timingStatus: row.timing_status,
      ...(options.full && revealed ? { value: json(row.value_json, null) } : {}),
    }));
    return options.paginated ? {
      sessionId,
      offset,
      limit,
      total: Number(this.db.prepare(`SELECT COUNT(*) AS count FROM machine_outputs WHERE ${where}`).get(...params).count),
      records,
    } : records;
  }

  recordTiming(sessionId, record = {}) {
    const observation = { sessionId, trialId: record.trialId || record.trial_id || null, outputSeq: record.outputSeq ?? record.output_seq ?? null, scheduledMonotonicNs: record.scheduledMonotonicNs ?? record.scheduled_monotonic_ns ?? null, scheduledUtc: record.scheduledUtc ?? record.scheduled_utc ?? null, actualMonotonicNs: record.actualMonotonicNs ?? record.actual_monotonic_ns ?? record.monotonicNs ?? null, actualUtc: record.actualUtc ?? record.actual_utc ?? null, latenessMs: record.latenessMs ?? record.lateness_ms ?? null, timingStatus: record.timingStatus ?? record.timing_status ?? null };
    const observationId = record.observationId || `${sessionId}-TIME-${observation.outputSeq ?? Date.now()}`;
    const observationHash = sha256(canonical(observation));
    this.db.prepare("INSERT INTO timing_observations(observation_id,session_id,trial_id,output_seq,scheduled_monotonic_ns,scheduled_utc,actual_monotonic_ns,actual_utc,lateness_ms,timing_status,observation_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(observationId, sessionId, observation.trialId, observation.outputSeq, observation.scheduledMonotonicNs, observation.scheduledUtc, observation.actualMonotonicNs, observation.actualUtc, observation.latenessMs, observation.timingStatus, observationHash, now());
    this.db.prepare("UPDATE session_details SET scheduled_monotonic_ns=COALESCE(scheduled_monotonic_ns,?),scheduled_utc=COALESCE(scheduled_utc,?),actual_start_monotonic_ns=COALESCE(actual_start_monotonic_ns,?),actual_start_utc=COALESCE(actual_start_utc,?) WHERE session_id=?").run(observation.scheduledMonotonicNs, observation.scheduledUtc, observation.actualMonotonicNs, observation.actualUtc, sessionId);
    return { observationId, ...observation, observationHash };
  }

  recordProtocolStage(sessionId, stage = {}) {
    const stageType = String(stage.stageType || stage.type || "UNKNOWN");
    const next = Number(this.db.prepare("SELECT COALESCE(MAX(stage_seq),0)+1 AS seq FROM protocol_stage_events WHERE session_id=?").get(sessionId).seq);
    const actualUtc = stage.actualUtc || now();
    const actualMonotonicNs = String(stage.actualMonotonicNs ?? process.hrtime.bigint());
    const payload = JSON.parse(JSON.stringify(stage.payload || {}));
    const core = {
      sessionId,
      trialId: stage.trialId || null,
      stageSeq: next,
      stageType,
      plannedUtc: stage.plannedUtc || null,
      plannedMonotonicNs: stage.plannedMonotonicNs === undefined || stage.plannedMonotonicNs === null ? null : String(stage.plannedMonotonicNs),
      actualUtc,
      actualMonotonicNs,
      status: stage.status || "OBSERVED",
      cueId: stage.cueId || null,
      payload,
    };
    const stageHash = sha256(canonical(core));
    this.db.prepare("INSERT INTO protocol_stage_events(session_id,trial_id,stage_seq,stage_type,planned_utc,planned_monotonic_ns,actual_utc,actual_monotonic_ns,status,cue_id,payload_json,stage_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(sessionId, core.trialId, next, stageType, core.plannedUtc, core.plannedMonotonicNs, actualUtc, actualMonotonicNs, core.status, core.cueId, JSON.stringify(payload), stageHash);
    return { ...core, stageHash };
  }

  protocolStages(sessionId) {
    return this.db.prepare("SELECT * FROM protocol_stage_events WHERE session_id=? ORDER BY stage_seq").all(sessionId).map((row) => ({
      sessionId: row.session_id,
      trialId: row.trial_id,
      stageSeq: row.stage_seq,
      stageType: row.stage_type,
      plannedUtc: row.planned_utc,
      plannedMonotonicNs: row.planned_monotonic_ns,
      actualUtc: row.actual_utc,
      actualMonotonicNs: row.actual_monotonic_ns,
      status: row.status,
      cueId: row.cue_id,
      payload: json(row.payload_json, {}),
      stageHash: row.stage_hash,
    }));
  }

  projectTransition(sessionId, trialId, fromState, toState, evidence = {}) {
    const next = this.db.prepare("SELECT COALESCE(MAX(seq),0)+1 AS seq FROM transition_projections WHERE session_id=?").get(sessionId).seq;
    const projection = { sessionId, trialId: trialId || null, seq: next, fromState: fromState || null, toState, projectedUtc: evidence.occurredUtc || now(), projectedMonotonicNs: evidence.monotonicNs || process.hrtime.bigint().toString(), evidenceEventId: evidence.eventId || null };
    const projectionId = evidence.projectionId || `${sessionId}-P${String(next).padStart(5, "0")}`;
    const projectionHash = sha256(canonical(projection));
    this.db.prepare("INSERT INTO transition_projections(projection_id,session_id,trial_id,seq,from_state,to_state,projected_utc,projected_monotonic_ns,projection_hash,evidence_event_id) VALUES(?,?,?,?,?,?,?,?,?,?)").run(projectionId, sessionId, projection.trialId, next, projection.fromState, toState, projection.projectedUtc, projection.projectedMonotonicNs, projectionHash, projection.evidenceEventId);
    return { projectionId, ...projection, projectionHash };
  }

  addTransitionEvidence(sessionId, data = {}) {
    const evidence = { sessionId, trialId: data.trialId || null, projectionId: data.projectionId || null, evidenceEventId: data.evidenceEventId || null, evidenceType: data.evidenceType || "OBSERVATION", evidence: data.evidence ?? data.payload ?? {} };
    const evidenceId = data.evidenceId || `${sessionId}-TE-${Date.now()}-${process.hrtime.bigint()}`;
    const evidenceHash = sha256(canonical(evidence));
    this.db.prepare("INSERT INTO transition_evidence(evidence_id,session_id,trial_id,projection_id,evidence_event_id,evidence_type,evidence_json,evidence_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?)").run(evidenceId, sessionId, evidence.trialId, evidence.projectionId, evidence.evidenceEventId, evidence.evidenceType, JSON.stringify(evidence.evidence), evidenceHash, now());
    return { evidenceId, ...evidence, evidenceHash };
  }

  finalizeOutput(sessionId, details = {}) {
    const rows = this.db.prepare("SELECT output_seq,record_hash,value_json FROM machine_outputs WHERE session_id=? ORDER BY output_seq").all(sessionId);
    const outputHash = details.outputHash || sha256(canonical(rows.map((row) => ({ outputSeq: row.output_seq, recordHash: row.record_hash }))));
    const finalFingerprint = details.finalFingerprint || sha256(rows.map((row) => row.record_hash).join(""));
    const finalStreamDigest = details.finalStreamDigest || details.streamSha256 || details.digest || null;
    const frameCount = details.frameCount ?? details.frames ?? rows.length;
    const format = details.format || details.finalStreamFormat || null;
    const finalization = { sessionId, outputHash, finalFingerprint, finalStreamDigest, frameCount, format, finalizedUtc: now() };
    const finalizationHash = sha256(canonical(finalization));
    if (finalStreamDigest !== null && !/^[a-f0-9]{64}$/i.test(String(finalStreamDigest))) throw new Error("finalStreamDigest must be a SHA-256 hex digest");
    if (this.db.prepare("SELECT 1 FROM output_finalizations WHERE session_id=?").get(sessionId)) throw new Error("Machine output is already finalized");
    const write = this.db.transaction(() => {
      this.db.prepare("INSERT INTO output_finalizations(session_id,output_hash,final_fingerprint,final_stream_digest,frame_count,format_json,finalized_utc,finalization_hash) VALUES(?,?,?,?,?,?,?,?)").run(sessionId, outputHash, finalFingerprint, finalStreamDigest, frameCount, format ? JSON.stringify(format) : null, finalization.finalizedUtc, finalizationHash);
      this.db.prepare("UPDATE session_details SET output_hash=?,final_fingerprint=?,final_stream_digest=?,final_stream_frames=?,final_stream_format_json=?,actual_end_monotonic_ns=?,actual_end_utc=? WHERE session_id=?").run(outputHash, finalFingerprint, finalStreamDigest, frameCount, format ? JSON.stringify(format) : null, process.hrtime.bigint().toString(), finalization.finalizedUtc, sessionId);
      this.appendEvent(sessionId, null, "MACHINE_OUTPUT_FINALIZED", { outputHash, finalFingerprint, finalStreamDigest, frameCount });
    });
    write();
    return { ...finalization, finalizationHash };
  }

  addLateAnnotation(sessionId, kind, payload = {}) {
    const createdUtc = now();
    const annotationHash = sha256(canonical({ sessionId, kind, payload, createdUtc }));
    const result = this.db.prepare("INSERT INTO late_annotations(session_id,created_utc,kind,payload_json,annotation_hash) VALUES(?,?,?,?,?)").run(sessionId, createdUtc, kind, JSON.stringify(payload), annotationHash);
    return { id: Number(result.lastInsertRowid), sessionId, createdUtc, kind, payload, annotationHash };
  }

  annotations(sessionId, options = {}) {
    const query = "SELECT id,session_id AS sessionId,created_utc AS createdUtc,kind,payload_json AS payload,annotation_hash AS annotationHash FROM late_annotations WHERE session_id=? ORDER BY id";
    if (options.paginated !== true)
      return this.db.prepare(query).all(sessionId).map((row) => ({ ...row, payload: json(row.payload, {}) }));
    const limit = Math.min(500, Math.max(1, Number(options.limit ?? 100)));
    const offset = Math.max(0, Number(options.offset ?? 0));
    const rows = this.db.prepare(`${query} LIMIT ? OFFSET ?`).all(sessionId, limit, offset).map((row) => ({ ...row, payload: json(row.payload, {}) }));
    const total = Number(this.db.prepare("SELECT COUNT(*) AS count FROM late_annotations WHERE session_id=?").get(sessionId).count);
    return { sessionId, offset, limit, total, records: rows };
  }
}
