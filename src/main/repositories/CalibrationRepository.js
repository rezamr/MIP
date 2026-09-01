import { canonical, sha256 } from "../../engine.js";
import { json, now } from "../database/db.js";

function decode(row) {
  if (!row) return null;
  return {
    calibrationId: row.calibration_id,
    createdUtc: row.created_utc,
    provider: row.provider,
    providerVersion: row.provider_version,
    sampleCount: row.sample_count,
    counts: json(row.counts_json, {}),
    statistics: json(row.statistics_json, {}),
    metadata: json(row.metadata_json, {}),
    resultHash: row.result_hash,
    integrityStatus: row.integrity_status,
     details: row.detail_hash ? {
       counts: json(row.detail_counts_json, json(row.counts_json, {})),
       statistics: json(row.detail_statistics_json, json(row.statistics_json, {})),
       metadata: json(row.detail_metadata_json, json(row.metadata_json, {})),
       device: json(row.device_json, null),
      environment: json(row.environment_json, null),
      observations: json(row.observations_json, null),
      detailHash: row.detail_hash,
    } : null,
  };
}

export class CalibrationRepository {
  constructor(owner) { this.owner = owner; this.db = owner.db || owner; }

  list(options = {}) {
    const clauses = [], params = [];
    if (options.provider) { clauses.push("c.provider=?"); params.push(options.provider); }
    if (options.integrityStatus) { clauses.push("c.integrity_status=?"); params.push(options.integrityStatus); }
    const rows = this.db.prepare(`SELECT c.*,d.counts_json AS detail_counts_json,d.statistics_json AS detail_statistics_json,d.metadata_json AS detail_metadata_json,d.device_json,d.environment_json,d.observations_json,d.detail_hash FROM calibrations c LEFT JOIN calibration_details d ON d.calibration_id=c.calibration_id ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY c.created_utc DESC`).all(...params);
    return rows.map(decode);
  }

  get(id) {
    return decode(this.db.prepare("SELECT c.*,d.counts_json AS detail_counts_json,d.statistics_json AS detail_statistics_json,d.metadata_json AS detail_metadata_json,d.device_json,d.environment_json,d.observations_json,d.detail_hash FROM calibrations c LEFT JOIN calibration_details d ON d.calibration_id=c.calibration_id WHERE c.calibration_id=?").get(id));
  }

  save(input = {}) {
    const createdUtc = input.createdUtc || now();
    const calibrationId = input.calibrationId || input.id || `C${Date.now()}-${process.hrtime.bigint()}`;
    const result = {
      calibrationId,
      createdUtc,
      provider: input.provider || null,
      providerVersion: input.providerVersion || null,
      sampleCount: Number(input.sampleCount ?? input.samples ?? 0),
      counts: input.counts || {},
      statistics: input.statistics || {},
      metadata: input.metadata || {},
      integrityStatus: input.integrityStatus || "UNVERIFIED",
    };
    const hashInput = { ...result };
    result.resultHash = input.resultHash || sha256(canonical(hashInput));
    const details = { calibrationId, counts: result.counts, statistics: result.statistics, metadata: result.metadata, device: input.device ?? null, environment: input.environment ?? null, observations: input.observations ?? null, createdUtc };
    const tx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO calibrations(calibration_id,created_utc,provider,provider_version,sample_count,counts_json,statistics_json,metadata_json,result_hash,integrity_status) VALUES(?,?,?,?,?,?,?,?,?,?)").run(result.calibrationId, result.createdUtc, result.provider, result.providerVersion, result.sampleCount, JSON.stringify(result.counts), JSON.stringify(result.statistics), JSON.stringify(result.metadata), result.resultHash, result.integrityStatus);
      const detailHash = sha256(canonical(details));
      this.db.prepare("INSERT INTO calibration_details(calibration_id,counts_json,statistics_json,metadata_json,device_json,environment_json,observations_json,detail_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?)").run(calibrationId, JSON.stringify(result.counts), JSON.stringify(result.statistics), JSON.stringify(result.metadata), JSON.stringify(details.device), JSON.stringify(details.environment), JSON.stringify(details.observations), detailHash, createdUtc);
    });
    tx();
    return this.get(calibrationId);
  }

  saveResult(input) { return this.save(input); }

  verify(id) {
    const row = this.db.prepare("SELECT * FROM calibrations WHERE calibration_id=?").get(id);
    if (!row) return { valid: false, errors: ["Calibration not found"], calibrationId: id };
    const value = { calibrationId: row.calibration_id, createdUtc: row.created_utc, provider: row.provider, providerVersion: row.provider_version, sampleCount: row.sample_count, counts: json(row.counts_json, {}), statistics: json(row.statistics_json, {}), metadata: json(row.metadata_json, {}), integrityStatus: row.integrity_status };
    const errors = [];
    if (sha256(canonical(value)) !== row.result_hash) errors.push("Calibration result hash mismatch");
    const detail = this.db.prepare("SELECT * FROM calibration_details WHERE calibration_id=?").get(id);
    if (detail) {
      const detailValue = { calibrationId: id, counts: json(detail.counts_json, {}), statistics: json(detail.statistics_json, {}), metadata: json(detail.metadata_json, {}), device: json(detail.device_json, null), environment: json(detail.environment_json, null), observations: json(detail.observations_json, null), createdUtc: detail.created_utc };
      if (sha256(canonical(detailValue)) !== detail.detail_hash) errors.push("Calibration detail hash mismatch");
    }
    return { valid: errors.length === 0, errors, calibrationId: id };
  }
}
