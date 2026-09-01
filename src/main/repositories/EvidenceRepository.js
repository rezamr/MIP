import { canonical, sha256 } from "../../engine.js";
import { now, json } from "../database/db.js";
import { redact } from "./SessionRepository.js";

function asValue(record) {
  if (Object.prototype.hasOwnProperty.call(record, "value")) return record.value;
  if (Object.prototype.hasOwnProperty.call(record, "value_json")) return json(record.value_json, null);
  return record.payload ?? null;
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
    const base = { sessionId, seq, eventType: type, occurredUtc, monotonicNs, payload: cleanPayload, previousHash: last?.event_hash || "GENESIS" };
    const eventHash = sha256(canonical(base));
    const eventId = `${sessionId}-E${String(seq).padStart(5, "0")}`;
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
    return { ...base, trialId: trialId || null, eventId, eventHash, hash: eventHash };
  }

  listFull(sessionId) {
    return this.db.prepare("SELECT seq,event_id AS eventId,event_type AS type,occurred_utc AS occurredUtc,monotonic_ns AS monotonicNs,payload_json AS payload,previous_hash AS previousHash,event_hash AS hash,trial_id AS trialId FROM evidence_events WHERE session_id=? ORDER BY seq").all(sessionId).map((row) => ({ ...row, payload: json(row.payload, {}) }));
  }

  listRedacted(sessionId) {
    const revealed = ["REVEALED", "COMPLETE"].includes(this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status);
    return this.listFull(sessionId).map((event) => revealed ? event : { ...event, payload: redact(event.payload) });
  }

  list(sessionId, options = {}) { return options.full ? this.listFull(sessionId) : this.listRedacted(sessionId); }

  recordOutput(sessionId, record = {}) {
    const outputSeq = Number(record.outputSeq ?? record.index ?? 0);
    if (!Number.isSafeInteger(outputSeq) || outputSeq < 0) throw new Error("outputSeq must be a non-negative safe integer");
    if (!this.db.prepare("SELECT 1 FROM sessions WHERE session_id=?").get(sessionId)) throw new Error(`Session not found: ${sessionId}`);
    const value = asValue(record);
    const generatedUtc = record.generatedUtc || record.actualUtc || now();
    const monotonicNs = String(record.monotonicNs ?? process.hrtime.bigint());
    const core = { sessionId, outputSeq, value };
    const recordHash = record.recordHash || record.record_hash || sha256(canonical(core));
    const write = this.db.transaction(() => {
      this.db.prepare("INSERT INTO machine_outputs(session_id,trial_id,output_seq,generated_utc,monotonic_ns,value_json,region,record_hash,scheduled_utc,scheduled_monotonic_ns,actual_utc,actual_monotonic_ns,lateness_ms,timing_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(sessionId, record.trialId || record.trial_id || null, outputSeq, generatedUtc, monotonicNs, JSON.stringify(value), record.region || record.block || null, recordHash, record.scheduledUtc || record.scheduled_utc || null, record.scheduledMonotonicNs || record.scheduled_monotonic_ns || null, record.actualUtc || record.actual_utc || generatedUtc, record.actualMonotonicNs || record.actual_monotonic_ns || monotonicNs, record.latenessMs ?? record.lateness_ms ?? null, record.timingStatus || record.timing_status || null);
      if (record.scheduledUtc || record.scheduledMonotonicNs || record.actualUtc || record.actualMonotonicNs) this.recordTiming(sessionId, { ...record, outputSeq });
      this.appendEvent(sessionId, record.trialId || record.trial_id || null, "MACHINE_OUTPUT_RECORDED", { outputSeq, recordHash });
    });
    write();
    return { ...record, sessionId, outputSeq, value, generatedUtc, monotonicNs, recordHash };
  }

  outputs(sessionId, options = {}) {
    const revealed = ["REVEALED", "COMPLETE"].includes(this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status);
    return this.db.prepare("SELECT * FROM machine_outputs WHERE session_id=? ORDER BY output_seq").all(sessionId).map((row) => ({
      sessionId: row.session_id, trialId: row.trial_id, outputSeq: row.output_seq, generatedUtc: row.generated_utc, monotonicNs: row.monotonic_ns, region: row.region, recordHash: row.record_hash, scheduledUtc: row.scheduled_utc, scheduledMonotonicNs: row.scheduled_monotonic_ns, actualUtc: row.actual_utc, actualMonotonicNs: row.actual_monotonic_ns, latenessMs: row.lateness_ms, timingStatus: row.timing_status,
      ...(options.full && revealed ? { value: json(row.value_json, null) } : {}),
    }));
  }

  recordTiming(sessionId, record = {}) {
    const observation = { sessionId, trialId: record.trialId || record.trial_id || null, outputSeq: record.outputSeq ?? record.output_seq ?? null, scheduledMonotonicNs: record.scheduledMonotonicNs ?? record.scheduled_monotonic_ns ?? null, scheduledUtc: record.scheduledUtc ?? record.scheduled_utc ?? null, actualMonotonicNs: record.actualMonotonicNs ?? record.actual_monotonic_ns ?? record.monotonicNs ?? null, actualUtc: record.actualUtc ?? record.actual_utc ?? null, latenessMs: record.latenessMs ?? record.lateness_ms ?? null, timingStatus: record.timingStatus ?? record.timing_status ?? null };
    const observationId = record.observationId || `${sessionId}-TIME-${observation.outputSeq ?? Date.now()}`;
    const observationHash = sha256(canonical(observation));
    this.db.prepare("INSERT INTO timing_observations(observation_id,session_id,trial_id,output_seq,scheduled_monotonic_ns,scheduled_utc,actual_monotonic_ns,actual_utc,lateness_ms,timing_status,observation_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(observationId, sessionId, observation.trialId, observation.outputSeq, observation.scheduledMonotonicNs, observation.scheduledUtc, observation.actualMonotonicNs, observation.actualUtc, observation.latenessMs, observation.timingStatus, observationHash, now());
    this.db.prepare("UPDATE session_details SET scheduled_monotonic_ns=COALESCE(scheduled_monotonic_ns,?),scheduled_utc=COALESCE(scheduled_utc,?),actual_start_monotonic_ns=COALESCE(actual_start_monotonic_ns,?),actual_start_utc=COALESCE(actual_start_utc,?) WHERE session_id=?").run(observation.scheduledMonotonicNs, observation.scheduledUtc, observation.actualMonotonicNs, observation.actualUtc, sessionId);
    return { observationId, ...observation, observationHash };
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

  annotations(sessionId) {
    return this.db.prepare("SELECT id,session_id AS sessionId,created_utc AS createdUtc,kind,payload_json AS payload,annotation_hash AS annotationHash FROM late_annotations WHERE session_id=? ORDER BY id").all(sessionId).map((row) => ({ ...row, payload: json(row.payload, {}) }));
  }
}
