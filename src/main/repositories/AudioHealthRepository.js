import { canonical, sha256 } from "../../engine.js";
import { json, now } from "../database/db.js";

function dto(row) {
  return {
    diagnosticId: row.diagnostic_id,
    recipeId: row.recipe_id,
    recipeVersion: row.recipe_version,
    startedUtc: row.started_utc,
    endedUtc: row.ended_utc,
    durationMs: row.duration_ms,
    sampleRate: row.sample_rate,
    baseLatency: row.base_latency,
    outputLatency: row.output_latency,
    generatedFrames: row.generated_frames,
    continuity: json(row.continuity_json, {}),
    clipping: Boolean(row.clipping),
    contextStates: json(row.context_states_json, []),
    ownerResult: row.owner_result,
    ownerNote: row.owner_note,
    resultHash: row.result_hash,
    integrityStatus: row.integrity_status,
    details: row.detail_hash ? {
      telemetry: json(row.telemetry_json, null),
      device: json(row.device_json, null),
      environment: json(row.environment_json, null),
      digest: row.digest,
      format: json(row.format_json, null),
      detailHash: row.detail_hash,
    } : null,
  };
}

export class AudioHealthRepository {
  constructor(owner) { this.owner = owner; this.db = owner.db || owner; }

  list(options = {}) {
    const clauses = [], params = [];
    if (options.recipeId) { clauses.push("h.recipe_id=?"); params.push(options.recipeId); }
    if (options.integrityStatus) { clauses.push("h.integrity_status=?"); params.push(options.integrityStatus); }
    const rows = this.db.prepare(`SELECT h.*,d.telemetry_json,d.device_json,d.environment_json,d.digest,d.format_json,d.detail_hash FROM audio_health h LEFT JOIN audio_health_details d ON d.diagnostic_id=h.diagnostic_id ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY h.started_utc DESC`).all(...params);
    return rows.map((row) => ({ ...dto(row), observations: this.observations(row.diagnostic_id) }));
  }

  get(id) {
    const row = this.db.prepare("SELECT h.*,d.telemetry_json,d.device_json,d.environment_json,d.digest,d.format_json,d.detail_hash FROM audio_health h LEFT JOIN audio_health_details d ON d.diagnostic_id=h.diagnostic_id WHERE h.diagnostic_id=?").get(id);
    return row ? { ...dto(row), observations: this.observations(id) } : null;
  }

  save(input = {}) {
    const started = new Date(input.startedUtc || Date.now());
    const ended = new Date(input.endedUtc || started);
    const result = {
      diagnosticId: input.diagnosticId || input.id || `H${Date.now()}-${process.hrtime.bigint()}`,
      recipeId: input.recipeId || null,
      recipeVersion: input.recipeVersion === undefined ? null : Number(input.recipeVersion),
      startedUtc: started.toISOString(),
      endedUtc: ended.toISOString(),
      durationMs: Math.max(0, ended - started),
      sampleRate: input.sampleRate === undefined ? null : Number(input.sampleRate),
      baseLatency: input.baseLatency ?? null,
      outputLatency: input.outputLatency ?? null,
      generatedFrames: Number(input.generatedFrames || 0),
      continuity: input.continuity || {},
      clipping: Boolean(input.clipping),
      contextStates: input.contextStates || [],
      ownerResult: input.ownerResult || "Uncertain",
      ownerNote: input.ownerNote || "",
      integrityStatus: input.integrityStatus || "UNVERIFIED",
    };
    result.resultHash = input.resultHash || sha256(canonical(result));
    const details = {
      diagnosticId: result.diagnosticId,
      telemetry: input.telemetry ?? null,
      device: input.device ?? null,
      environment: input.environment ?? null,
      digest: input.digest ?? input.streamDigest ?? null,
      format: input.format ?? input.streamFormat ?? null,
      createdUtc: result.startedUtc,
    };
    const tx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO audio_health(diagnostic_id,recipe_id,recipe_version,started_utc,ended_utc,duration_ms,sample_rate,base_latency,output_latency,generated_frames,continuity_json,clipping,context_states_json,owner_result,owner_note,result_hash,integrity_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(result.diagnosticId, result.recipeId, result.recipeVersion, result.startedUtc, result.endedUtc, result.durationMs, result.sampleRate, result.baseLatency, result.outputLatency, result.generatedFrames, JSON.stringify(result.continuity), result.clipping ? 1 : 0, JSON.stringify(result.contextStates), result.ownerResult, result.ownerNote, result.resultHash, result.integrityStatus);
      this.db.prepare("INSERT INTO audio_health_details(diagnostic_id,telemetry_json,device_json,environment_json,digest,format_json,detail_hash,created_utc) VALUES(?,?,?,?,?,?,?,?)").run(result.diagnosticId, JSON.stringify(details.telemetry), JSON.stringify(details.device), JSON.stringify(details.environment), details.digest, JSON.stringify(details.format), sha256(canonical(details)), details.createdUtc);
      for (const observation of input.observations || []) this.addObservation(result.diagnosticId, observation);
    });
    tx();
    return this.get(result.diagnosticId);
  }

  saveResult(input) { return this.save(input); }

  addObservation(diagnosticId, input = {}) {
    if (!this.db.prepare("SELECT 1 FROM audio_health WHERE diagnostic_id=?").get(diagnosticId)) throw new Error(`Audio health diagnostic not found: ${diagnosticId}`);
    const value = { diagnosticId, observedUtc: new Date(input.observedUtc || Date.now()).toISOString(), monotonicNs: input.monotonicNs ?? null, contextState: input.contextState ?? null, observationType: input.observationType || (input.suspended ? "SUSPEND" : input.resumed ? "RESUME" : "OBSERVATION"), suspended: Boolean(input.suspended), resumed: Boolean(input.resumed), frames: input.frames === undefined ? null : Number(input.frames), details: input.details ?? input.payload ?? {} };
    const observationId = input.observationId || `${diagnosticId}-O${Date.now()}-${process.hrtime.bigint()}`;
    const observationHash = sha256(canonical(value));
    this.db.prepare("INSERT INTO audio_health_observations(observation_id,diagnostic_id,observed_utc,monotonic_ns,context_state,observation_type,suspended,resumed,frames,details_json,observation_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(observationId, diagnosticId, value.observedUtc, value.monotonicNs, value.contextState, value.observationType, value.suspended ? 1 : 0, value.resumed ? 1 : 0, value.frames, JSON.stringify(value.details), observationHash, now());
    return { observationId, ...value, observationHash };
  }

  observations(diagnosticId) {
    return this.db.prepare("SELECT * FROM audio_health_observations WHERE diagnostic_id=? ORDER BY observed_utc,observation_id").all(diagnosticId).map((row) => ({ observationId: row.observation_id, diagnosticId: row.diagnostic_id, observedUtc: row.observed_utc, monotonicNs: row.monotonic_ns, contextState: row.context_state, observationType: row.observation_type, suspended: Boolean(row.suspended), resumed: Boolean(row.resumed), frames: row.frames, details: json(row.details_json, {}), observationHash: row.observation_hash }));
  }

  verify(id) {
    const row = this.db.prepare("SELECT * FROM audio_health WHERE diagnostic_id=?").get(id);
    if (!row) return { valid: false, errors: ["Audio health diagnostic not found"], diagnosticId: id };
    const value = dto(row);
    delete value.details;
    delete value.resultHash;
    const errors = [];
    if (sha256(canonical(value)) !== row.result_hash) errors.push("Audio health result hash mismatch");
    for (const observation of this.observations(id)) {
      const copy = { diagnosticId: observation.diagnosticId, observedUtc: observation.observedUtc, monotonicNs: observation.monotonicNs, contextState: observation.contextState, observationType: observation.observationType, suspended: observation.suspended, resumed: observation.resumed, frames: observation.frames, details: observation.details };
      if (sha256(canonical(copy)) !== observation.observationHash) errors.push(`Audio health observation hash mismatch: ${observation.observationId}`);
    }
    const detail = this.db.prepare("SELECT * FROM audio_health_details WHERE diagnostic_id=?").get(id);
    if (detail) {
      const detailValue = { diagnosticId: id, telemetry: json(detail.telemetry_json, null), device: json(detail.device_json, null), environment: json(detail.environment_json, null), digest: detail.digest, format: json(detail.format_json, null), createdUtc: detail.created_utc };
      if (sha256(canonical(detailValue)) !== detail.detail_hash) errors.push("Audio health detail hash mismatch");
    }
    return { valid: errors.length === 0, errors, diagnosticId: id };
  }
}
