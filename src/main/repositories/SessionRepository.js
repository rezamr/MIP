import { json } from "../database/db.js";

const HIDDEN_KEYS = new Set([
  "objective",
  "hiddenObjective",
  "actualObjective",
  "actualObjectiveState",
  "participantTarget",
  "target",
  "canonicalConfig",
  "manifest",
  "manifestJson",
  "configSnapshot",
  "material",
  "hidden_objective",
  "participant_target",
  "canonical_config",
  "canonical_config_json",
  "manifest_json",
  "config_snapshot",
]);

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !HIDDEN_KEYS.has(key) && !HIDDEN_KEYS.has(String(key).replaceAll("_", "").toLowerCase()))
      .map(([key, child]) => [key, redact(child)]),
  );
}

export class SessionRepository {
  constructor(owner) {
    this.owner = owner;
    this.db = owner.db || owner;
  }

  _rows(where = "", params = []) {
    return this.db
      .prepare(
        `SELECT s.*,c.config_hash,d.timing_json,d.session_snapshot_hash,
                d.output_hash,d.final_fingerprint,d.final_stream_digest,
                d.scheduled_monotonic_ns,d.scheduled_utc,
                d.actual_start_monotonic_ns,d.actual_start_utc,
                d.actual_end_monotonic_ns,d.actual_end_utc,
                d.app_version,d.engine_version,d.audio_version,
                CASE WHEN r.session_id IS NULL THEN 0 ELSE 1 END AS raw_report_locked
           FROM sessions s
           LEFT JOIN session_commitments c ON c.session_id=s.session_id
           LEFT JOIN session_details d ON d.session_id=s.session_id
           LEFT JOIN raw_reports_locked r ON r.session_id=s.session_id
          ${where}
          ORDER BY s.created_utc DESC`,
      )
      .all(...params);
  }

  _dto(row, full = false) {
    const rawReportLocked = Boolean(row.raw_report_locked);
    const revealed = row.status === "REVEALED" || row.status === "COMPLETE";
    const revealEligible = row.status === "REVEAL_ELIGIBLE";
    const snapshot = json(row.manifest_json, null);
    const timing = json(row.timing_json, null);
    const dto = {
      sessionId: row.session_id,
      createdUtc: row.created_utc,
      participantLabel: row.participant_label,
      recordType: row.record_type,
      profileId: row.profile_id,
      profileVersion: row.profile_version,
      status: row.status,
      revealPolicy: row.reveal_policy,
      recoveryState: row.recovery_state,
      configFingerprint: row.config_hash || row.session_snapshot_hash || null,
      rawReportLocked,
      revealEligible,
      revealed,
      // A locked raw report only satisfies the gate.  `hasReveal` means the
      // owner actually completed the separate REVEALED transition.
      hasReveal: revealed,
      timing,
      scheduledMonotonicNs: row.scheduled_monotonic_ns || null,
      scheduledUtc: row.scheduled_utc || null,
      actualStartMonotonicNs: row.actual_start_monotonic_ns || null,
      actualStartUtc: row.actual_start_utc || null,
      actualEndMonotonicNs: row.actual_end_monotonic_ns || null,
      actualEndUtc: row.actual_end_utc || null,
      outputHash: row.output_hash || null,
      finalFingerprint: row.final_fingerprint || null,
      finalStreamDigest: row.final_stream_digest || null,
      appVersion: row.app_version || null,
      engineVersion: row.engine_version || null,
      audioVersion: row.audio_version || null,
    };
    if (full && revealed) {
      dto.manifest = snapshot;
      dto.configSnapshot = snapshot;
      const objective = row.hidden_objective === null ? null : Number(row.hidden_objective);
      dto.hiddenObjective = Number.isNaN(objective) ? row.hidden_objective : objective;
      dto.participantTarget = row.participant_target;
    }
    return dto;
  }

  listRedacted(options = {}) {
    const clauses = [];
    const params = [];
    if (options.profileId) {
      clauses.push("s.profile_id=?");
      params.push(options.profileId);
    }
    if (options.status) {
      clauses.push("s.status=?");
      params.push(options.status);
    }
    if (options.recordType) {
      clauses.push("s.record_type=?");
      params.push(options.recordType);
    }
    if (options.search) {
      clauses.push("(s.session_id LIKE ? OR s.profile_id LIKE ? OR COALESCE(s.participant_label,'') LIKE ?)");
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return this._rows(where, params).map((row) => this._dto(row, false));
  }

  list(options = {}) { return options.full === true ? this.listFull(options) : this.listRedacted(options); }

  listFull(options = {}) {
    return this.listRedacted(options).map((row) => this.getFull(row.sessionId));
  }

  getRedacted(sessionId) {
    const row = this._rows("WHERE s.session_id=?", [sessionId])[0];
    return row ? this._dto(row, false) : null;
  }

  getFull(sessionId) {
    const row = this._rows("WHERE s.session_id=?", [sessionId])[0];
    if (!row) return null;
    if (!["REVEALED", "COMPLETE"].includes(row.status)) return this._dto(row, false);
    return this._dto(row, true);
  }

  get(sessionId, options = {}) {
    return options.full ? this.getFull(sessionId) : this.getRedacted(sessionId);
  }

  setStatus(sessionId, status, recoveryState = null) {
    const result = this.db.prepare("UPDATE sessions SET status=?,recovery_state=? WHERE session_id=?").run(status, recoveryState, sessionId);
    if (!result.changes) throw new Error(`Session not found: ${sessionId}`);
    return this.getRedacted(sessionId);
  }

  trials(sessionId) {
    return this.db.prepare("SELECT * FROM trials WHERE session_id=? ORDER BY trial_seq").all(sessionId).map((row) => ({
      trialId: row.trial_id,
      sessionId: row.session_id,
      trialSeq: row.trial_seq,
      trialType: row.trial_type,
      config: json(row.config_json, {}),
      state: row.state,
    }));
  }

  snapshot(sessionId, options = {}) {
    const row = this.db.prepare("SELECT * FROM session_details WHERE session_id=?").get(sessionId);
    if (!row) return null;
    const revealed = ["REVEALED", "COMPLETE"].includes(this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status);
    const result = { sessionId, sessionSnapshotHash: row.session_snapshot_hash, timing: json(row.timing_json, null), scheduledMonotonicNs: row.scheduled_monotonic_ns, scheduledUtc: row.scheduled_utc, actualStartMonotonicNs: row.actual_start_monotonic_ns, actualStartUtc: row.actual_start_utc, actualEndMonotonicNs: row.actual_end_monotonic_ns, actualEndUtc: row.actual_end_utc, appVersion: row.app_version, engineVersion: row.engine_version, audioVersion: row.audio_version, outputHash: row.output_hash, finalFingerprint: row.final_fingerprint, finalStreamDigest: row.final_stream_digest, finalStreamFrames: row.final_stream_frames, finalStreamFormat: json(row.final_stream_format_json, null) };
    if (options.full === true && revealed) result.snapshot = json(row.session_snapshot_json, null);
    return result;
  }
}

export { redact };
