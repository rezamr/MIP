import { canonical, sha256 } from "../../engine.js";
import { json, now } from "../database/db.js";

export class AnalysisRepository {
  constructor(owner) { this.owner = owner; this.db = owner.db || owner; }

  save(sessionId, analysis, options = {}) {
    if (!this.db.prepare("SELECT 1 FROM sessions WHERE session_id=?").get(sessionId)) throw new Error(`Session not found: ${sessionId}`);
    const payload = JSON.parse(JSON.stringify(analysis ?? {}));
    const input = options.input ?? options.inputData ?? payload.input ?? null;
    const inputJson = JSON.stringify(input);
    const inputHash = options.inputHash || sha256(canonical(input));
    const analysisVersion = options.analysisVersion || payload.version || "analysis-v1";
    const createdUtc = options.createdUtc || now();
    const existing = this.db.prepare("SELECT * FROM analyses WHERE session_id=?").get(sessionId);
    const analysisHash = options.analysisHash || sha256(canonical(payload));
    if (!existing) {
      const tx = this.db.transaction(() => {
        this.db.prepare("INSERT INTO analyses(session_id,analysis_version,input_hash,input_json,payload_json,created_utc,analysis_hash) VALUES(?,?,?,?,?,?,?)").run(sessionId, analysisVersion, inputHash, inputJson, JSON.stringify(payload), createdUtc, analysisHash);
        this.db.prepare("INSERT INTO analysis_versions(analysis_id,session_id,version,analysis_version,input_hash,input_json,payload_json,analysis_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?)").run(options.analysisId || `${sessionId}-A1`, sessionId, 1, analysisVersion, inputHash, inputJson, JSON.stringify(payload), analysisHash, createdUtc);
      });
      tx();
    } else {
      const latest = this.db.prepare("SELECT COALESCE(MAX(version),0) AS version FROM analysis_versions WHERE session_id=?").get(sessionId).version;
      this.db.prepare("INSERT INTO analysis_versions(analysis_id,session_id,version,analysis_version,input_hash,input_json,payload_json,analysis_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?)").run(options.analysisId || `${sessionId}-A${Number(latest) + 1}`, sessionId, Number(latest) + 1, analysisVersion, inputHash, inputJson, JSON.stringify(payload), analysisHash, createdUtc);
    }
    return this.get(sessionId, { full: true });
  }

  get(sessionId, options = {}) {
    const row = this.db.prepare("SELECT * FROM analysis_versions WHERE session_id=? ORDER BY version DESC LIMIT 1").get(sessionId) || this.db.prepare("SELECT *,NULL AS version FROM analyses WHERE session_id=?").get(sessionId);
    if (!row) return null;
    const result = { sessionId: row.session_id, version: row.version ?? null, analysisVersion: row.analysis_version, inputHash: row.input_hash, input: json(row.input_json, null), analysisHash: row.analysis_hash, analysis: json(row.payload_json, null), createdUtc: row.created_utc };
    if (!options.full) delete result.analysis;
    return result;
  }

  getFull(sessionId) { return this.get(sessionId, { full: true }); }
  getVersions(sessionId) { return this.db.prepare("SELECT analysis_id AS analysisId,session_id AS sessionId,version,analysis_version AS analysisVersion,input_hash AS inputHash,input_json AS input,payload_json AS payload,analysis_hash AS analysisHash,created_utc AS createdUtc FROM analysis_versions WHERE session_id=? ORDER BY version").all(sessionId).map((row) => ({ ...row, input: json(row.input, null), payload: json(row.payload, {}) })); }
  list() { return this.db.prepare("SELECT session_id AS sessionId,analysis_version AS analysisVersion,input_hash AS inputHash,created_utc AS createdUtc FROM analyses ORDER BY created_utc DESC").all(); }

  verify(sessionId, input) {
    const row = this.db.prepare("SELECT * FROM analysis_versions WHERE session_id=? ORDER BY version DESC LIMIT 1").get(sessionId) || this.db.prepare("SELECT *,NULL AS version FROM analyses WHERE session_id=?").get(sessionId);
    if (!row) return { valid: false, errors: ["Analysis not found"], sessionId };
    const storedInput = json(row.input_json, undefined);
    const actualInputHash = input === undefined ? row.input_hash : sha256(canonical(input));
    const payload = json(row.payload_json, undefined);
    const errors = [];
    if (actualInputHash !== row.input_hash) errors.push("Analysis input hash mismatch");
    if (payload === undefined || sha256(canonical(payload)) !== row.analysis_hash) errors.push("Analysis result hash mismatch");
    if (storedInput !== undefined && sha256(canonical(storedInput)) !== row.input_hash) errors.push("Stored analysis input hash mismatch");
    return { valid: errors.length === 0, errors, sessionId, version: row.version ?? null, inputHash: row.input_hash, analysisHash: row.analysis_hash };
  }
}
