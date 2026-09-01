import fs from "node:fs";
import path from "node:path";
import { canonical, sha256 } from "../../engine.js";
import { now } from "../database/db.js";

const text = (value) => Buffer.isBuffer(value) ? value.toString("utf8") : String(value ?? "");
const first = (object, keys, fallback = undefined) => {
  for (const key of keys) if (object && object[key] !== undefined && object[key] !== null) return object[key];
  return fallback;
};
const asObject = (value) => value && typeof value === "object" ? value : {};
const asArray = (value) => Array.isArray(value) ? value : value ? [value] : [];

function filesInDirectory(root, current = root) {
  const result = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...filesInDirectory(root, full));
    else result.push({ relativeName: path.relative(root, full).replaceAll(path.sep, "/"), content: fs.readFileSync(full) });
  }
  return result.sort((a, b) => a.relativeName.localeCompare(b.relativeName));
}

function parseJsonLines(content) {
  const rows = [];
  for (const line of text(content).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { rows.push({ __parseError: true, raw: line }); }
  }
  return rows;
}

function parseFiles(files) {
  const documents = [];
  for (const file of files) {
    const name = file.relativeName.toLowerCase();
    const content = text(file.content);
    let parsed = null;
    if (name.endsWith(".jsonl") || name.endsWith(".ndjson")) parsed = parseJsonLines(content);
    else if (name.endsWith(".json")) {
      try { parsed = JSON.parse(content); } catch { parsed = { __parseError: true, raw: content }; }
    }
    documents.push({ ...file, parsed });
  }
  return documents;
}

function unknown(value) {
  return value === undefined || value === null || value === "" ? "UNKNOWN" : value;
}

function collectSessions(documents, input) {
  const sessions = [];
  const events = [];
  const outputs = [];
  const reports = [];
  const analyses = [];
  const add = (value, source) => {
    if (!value || typeof value !== "object" || value.__parseError) return;
    const nested = first(value, ["sessions", "sessionRecords", "records"]);
    if (Array.isArray(nested)) nested.forEach((row) => add(row, source));
    const sessionId = first(value, ["sessionId", "session_id", "id"]);
    const looksLikeSession = sessionId !== undefined && (value.profileId !== undefined || value.profile_id !== undefined || value.createdUtc !== undefined || value.created_utc !== undefined || value.events !== undefined || value.manifest !== undefined || value.status !== undefined);
    if (looksLikeSession) sessions.push({ value, source });
    for (const key of ["events", "evidence", "timeline"]) if (Array.isArray(value[key])) events.push(...value[key].map((row) => ({ ...asObject(row), __sessionId: sessionId, __source: source })));
    for (const key of ["outputs", "machineOutputs", "machine_output"]) if (Array.isArray(value[key])) outputs.push(...value[key].map((row) => ({ ...asObject(row), __sessionId: sessionId, __source: source })));
    for (const key of ["reports", "rawReport", "raw_report", "report"]) if (value[key] !== undefined) reports.push({ value: value[key], __sessionId: sessionId, __source: source });
    for (const key of ["analysis", "analyses"]) if (value[key] !== undefined) analyses.push({ value: value[key], __sessionId: sessionId, __source: source });
  };
  if (input?.sessions) asArray(input.sessions).forEach((row) => add(row, "input"));
  for (const document of documents) {
    if (input?.sessions && document.relativeName === "bundle.json") continue;
    if (Array.isArray(document.parsed)) {
      for (const row of document.parsed) {
        if (row?.eventType || row?.type === "event" || row?.event_hash || row?.eventHash) events.push({ ...row, __sessionId: first(row, ["sessionId", "session_id"]), __source: document.relativeName });
        else if (row?.outputSeq !== undefined || row?.output_seq !== undefined || row?.recordHash) outputs.push({ ...row, __sessionId: first(row, ["sessionId", "session_id"]), __source: document.relativeName });
        else add(row, document.relativeName);
      }
    } else add(document.parsed, document.relativeName);
  }
  const byName = (names) => documents.filter((document) => names.some((name) => document.relativeName.toLowerCase().includes(name))).flatMap((document) => Array.isArray(document.parsed) ? document.parsed : [document.parsed]).filter(Boolean);
  const unique = (rows, key) => {
    const seen = new Set();
    return rows.filter((row) => {
      const value = JSON.stringify(Object.fromEntries(Object.entries(row).filter(([name]) => !name.startsWith("__"))));
      if (seen.has(`${key}:${value}`)) return false;
      seen.add(`${key}:${value}`);
      return true;
    });
  };
  events.push(...byName(["event", "timeline"]).filter((row) => row && (row.eventType || row.type || row.event_hash)).map((row) => ({ ...row, __sessionId: first(row, ["sessionId", "session_id"]), __source: "named-file" })));
  outputs.push(...byName(["output"]).filter((row) => row && (row.outputSeq !== undefined || row.output_seq !== undefined || row.recordHash)).map((row) => ({ ...row, __sessionId: first(row, ["sessionId", "session_id"]), __source: "named-file" })));
  reports.push(...byName(["report", "raw-report"]).filter(Boolean).map((row) => ({ value: row, __sessionId: first(row, ["sessionId", "session_id"]), __source: "named-file" })));
  analyses.push(...byName(["analys"]).filter(Boolean).map((row) => ({ value: row, __sessionId: first(row, ["sessionId", "session_id"]), __source: "named-file" })));
  collectedUnique(events, unique, "events");
  collectedUnique(outputs, unique, "outputs");
  collectedUnique(reports, unique, "reports");
  collectedUnique(analyses, unique, "analyses");
  if (sessions.length === 1) {
    const onlySessionId = first(sessions[0].value, ["sessionId", "session_id", "id"]);
    for (const rows of [events, outputs, reports, analyses]) {
      for (const row of rows) if (row.__sessionId === undefined || row.__sessionId === null) row.__sessionId = onlySessionId;
    }
  }
  return { sessions, events, outputs, reports, analyses };
}

function collectedUnique(rows, unique, key) {
  const result = unique(rows, key);
  rows.splice(0, rows.length, ...result);
}

function sourceChain(events) {
  if (!events.length) return { status: "NO_EVENTS", valid: true, hashesPresent: false, errors: [] };
  const errors = [];
  let previous = "GENESIS";
  let hashesPresent = true;
  for (const [index, event] of events.entries()) {
    const hash = first(event, ["hash", "eventHash", "event_hash"]);
    const previousHash = first(event, ["previousHash", "previous_hash", "prevHash"]);
    if (!hash) { hashesPresent = false; continue; }
    if (previousHash !== undefined && previousHash !== previous) errors.push(`event ${index + 1} previous hash mismatch`);
    const copy = { ...event };
    delete copy.hash; delete copy.eventHash; delete copy.event_hash; delete copy.__sessionId; delete copy.__source;
    const candidates = [sha256(canonical(copy)), sha256(canonical({ ...copy, previousHash: previousHash ?? previous }))];
    if (!candidates.includes(hash)) errors.push(`event ${index + 1} hash mismatch`);
    previous = hash;
  }
  if (!hashesPresent) return { status: "UNVERIFIED_MISSING_HASHES", valid: false, hashesPresent: false, errors };
  return { status: errors.length ? "SOURCE_HASH_CHAIN_INVALID" : "VERIFIED_SOURCE_CHAIN", valid: errors.length === 0, hashesPresent: true, errors };
}

export class LegacyImporter {
  constructor(owner) { this.owner = owner; this.db = owner.db || owner; }

  _input(source) {
    if (typeof source === "string") {
      const resolved = path.resolve(source);
      if (!fs.existsSync(resolved)) throw new Error("Legacy source path not found");
      const files = fs.statSync(resolved).isDirectory() ? filesInDirectory(resolved) : [{ relativeName: path.basename(resolved), content: fs.readFileSync(resolved) }];
      return { files, sourceKind: fs.statSync(resolved).isDirectory() ? "DIRECTORY" : "FILE", sourcePath: resolved };
    }
    if (source?.path) return this._input(source.path);
    if (source?.files) {
      const files = Object.entries(source.files).map(([relativeName, content]) => ({ relativeName, content: Buffer.isBuffer(content) ? content : text(content) })).sort((a, b) => a.relativeName.localeCompare(b.relativeName));
      return { files, sourceKind: "PARSED_BUNDLE", sourcePath: null, input: source };
    }
    const value = source?.data ?? source ?? {};
    const content = JSON.stringify(value);
    return { files: [{ relativeName: "bundle.json", content }], sourceKind: "PARSED_BUNDLE", sourcePath: null, input: value };
  }

  _ensureUnknownProfile() {
    const config = { id: "UNKNOWN", version: 1, name: "UNKNOWN", status: "UNKNOWN", provenance: "LEGACY_IMPORT" };
    this.db.prepare("INSERT OR IGNORE INTO experiment_profiles(profile_id,name,provenance) VALUES('UNKNOWN','UNKNOWN','LEGACY_IMPORT')").run();
    this.db.prepare("INSERT OR IGNORE INTO profile_versions(profile_id,version,config_json,config_hash,created_utc,immutable) VALUES('UNKNOWN',1,?,?,?,1)").run(JSON.stringify(config), sha256(canonical(config)), now());
    this.db.prepare("INSERT OR IGNORE INTO profile_identities(profile_id,identity_type,identity_label,provenance_json,source_kind,source_ref,created_utc) VALUES('UNKNOWN','UNKNOWN','UNKNOWN',?,'LEGACY_IMPORT','UNKNOWN',?)").run(JSON.stringify({ source: "legacy" }), now());
    this.db.prepare("INSERT OR IGNORE INTO profile_version_metadata(profile_id,version,identity_id,provenance_json,status,is_draft,is_active,parent_version,validation_json,created_utc) VALUES('UNKNOWN',1,'UNKNOWN',?,'ACTIVE',0,1,NULL,?,?)").run(JSON.stringify({ source: "legacy" }), JSON.stringify({ valid: false, errors: ["Unknown legacy profile"] }), now());
  }

  _allocateSessionId(legacyId, importId, index) {
    const original = legacyId === undefined || legacyId === null || legacyId === "" ? `LEGACY-${importId.slice(-10)}-${index + 1}` : String(legacyId);
    if (!this.db.prepare("SELECT 1 FROM sessions WHERE session_id=?").get(original)) return original;
    let candidate = `${original}~LEGACY-${importId.slice(-8)}`;
    let suffix = 2;
    while (this.db.prepare("SELECT 1 FROM sessions WHERE session_id=?").get(candidate)) candidate = `${original}~LEGACY-${importId.slice(-8)}-${suffix++}`;
    return candidate;
  }

  _rowForSession(sessions, legacyId) {
    return sessions.find(({ value }) => String(first(value, ["sessionId", "session_id", "id"], "")) === String(legacyId));
  }

  import(source, options = {}) {
    const input = this._input(source);
    const documents = parseFiles(input.files);
    const collected = collectSessions(documents, input.input);
    const importId = options.importId || `I${Date.now()}-${process.hrtime.bigint()}`;
    const sourceDescriptor = input.files.map((file) => ({ name: file.relativeName, sha256: sha256(file.content), sizeBytes: Buffer.byteLength(file.content) }));
    const sourceSha256 = sourceDescriptor.length === 1 ? sha256(input.files[0].content) : sha256(canonical(sourceDescriptor));
    const previous = this.db.prepare("SELECT import_id,source_integrity_status,report_json FROM legacy_imports WHERE source_sha256=? ORDER BY imported_utc DESC LIMIT 1").get(sourceSha256);
    if (previous && options.allowDuplicate !== true) {
      return { importId: previous.import_id, imported: 0, duplicate: true, source: input.sourceKind, sourceSha256, sourceIntegrityStatus: previous.source_integrity_status, sessions: [], report: JSON.parse(previous.report_json || "{}") };
    }
    const parseErrors = documents
      .filter((document) => document.parsed?.__parseError)
      .map((document) => `${document.relativeName}: invalid JSON/JSONL`) ;
    const report = { importId, sourceKind: input.sourceKind, sourcePath: input.sourcePath, sourceSha256, files: sourceDescriptor.length, sessions: [], warnings: parseErrors.slice(), importedUtc: now() };
    this._ensureUnknownProfile();
    const tx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO legacy_imports(import_id,imported_utc,source_kind,source_path,source_sha256,source_integrity_status,metadata_json,report_json) VALUES(?,?,?,?,?,?,?,?)").run(importId, report.importedUtc, input.sourceKind, input.sourcePath, sourceSha256, "PENDING", JSON.stringify({ schemaVersions: ["1.0", "1.1"], files: sourceDescriptor }), JSON.stringify(report));
      for (const file of input.files) this.db.prepare("INSERT INTO legacy_source_files(file_id,import_id,relative_name,sha256,size_bytes,content_type,content_text,content_blob,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)").run(`${importId}-${sha256(file.relativeName).slice(0, 16)}`, importId, file.relativeName, sha256(file.content), Buffer.byteLength(file.content), path.extname(file.relativeName).slice(1) || "unknown", text(file.content), file.content, JSON.stringify({ imported: true }));
      const mappings = new Map();
      collected.sessions.forEach(({ value }, index) => {
        const legacyId = first(value, ["sessionId", "session_id", "id"], `LEGACY-${index + 1}`);
        if (mappings.has(String(legacyId))) return;
        const importedId = this._allocateSessionId(legacyId, importId, index);
        mappings.set(String(legacyId), importedId);
        const createdUtc = unknown(first(value, ["createdUtc", "created_utc", "startedUtc", "started_utc"], report.importedUtc));
        const profileId = unknown(first(value, ["profileId", "profile_id"], undefined));
        const profileVersion = first(value, ["profileVersion", "profile_version"], undefined);
        const objective = first(value, ["objective", "hiddenObjective", "actualObjective", "actualObjectiveState"], undefined);
        const target = first(value, ["participantTarget", "target", "instruction"], undefined);
        const original = JSON.stringify(value);
        this.db.prepare("INSERT INTO sessions(session_id,created_utc,participant_label,record_type,profile_id,profile_version,status,reveal_policy,recovery_state,manifest_json,hidden_objective,participant_target) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(importedId, createdUtc, unknown(first(value, ["participantLabel", "participant_label"], undefined)), "legacy", profileId, profileVersion === undefined ? null : profileVersion, "LEGACY_IMPORTED", unknown(first(value, ["revealPolicy", "reveal_policy"], undefined)), "LEGACY_SOURCE_ONLY", original, objective === undefined ? null : String(objective), target === undefined ? null : String(target));
        this.db.prepare("INSERT INTO session_details(session_id,session_snapshot_json,session_snapshot_hash,timing_json,app_version,engine_version,audio_version,created_utc) VALUES(?,?,?,?,?,?,?,?)").run(importedId, original, sha256(canonical(value)), value.timing ? JSON.stringify(value.timing) : null, first(value, ["appVersion", "app_version"], "UNKNOWN"), first(value, ["engineVersion", "engine_version"], "UNKNOWN"), first(value, ["audioVersion", "audio_version"], "UNKNOWN"), createdUtc);
        const eventRows = collected.events.filter((event) => String(event.__sessionId ?? first(event, ["sessionId", "session_id"], legacyId)) === String(legacyId)).sort((a, b) => Number(first(a, ["seq", "sequence"], 0)) - Number(first(b, ["seq", "sequence"], 0)));
        const chain = sourceChain(eventRows);
        for (const [eventIndex, event] of eventRows.entries()) {
          const eventHash = first(event, ["hash", "eventHash", "event_hash"], null);
          const previousHash = first(event, ["previousHash", "previous_hash", "prevHash"], null);
          const status = !eventHash ? "MISSING" : chain.status === "VERIFIED_SOURCE_CHAIN" ? "VERIFIED_SOURCE" : "UNVERIFIED_SOURCE";
          this.db.prepare("INSERT INTO legacy_events(import_id,legacy_session_id,seq,event_id,event_type,occurred_utc,monotonic_value,payload_json,previous_hash,event_hash,source_json,hash_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(importId, String(legacyId), Number(first(event, ["seq", "sequence"], eventIndex + 1)), unknown(first(event, ["eventId", "event_id", "id"], undefined)), unknown(first(event, ["eventType", "event_type", "type"], undefined)), unknown(first(event, ["occurredUtc", "occurred_utc", "timestamp"], undefined)), unknown(first(event, ["monotonicNs", "monotonic_ns", "monotonicMs", "monotonic"], undefined)), JSON.stringify(first(event, ["payload", "data", "details"], {})), previousHash || "UNKNOWN", eventHash || "UNKNOWN", JSON.stringify(event), status);
        }
        const outputRows = collected.outputs.filter((output) => String(output.__sessionId ?? first(output, ["sessionId", "session_id"], legacyId)) === String(legacyId));
        for (const [outputIndex, output] of outputRows.entries()) this.db.prepare("INSERT INTO legacy_outputs(import_id,legacy_session_id,output_seq,output_json,output_hash) VALUES(?,?,?,?,?)").run(importId, String(legacyId), Number(first(output, ["outputSeq", "output_seq", "index"], outputIndex)), JSON.stringify(output), first(output, ["recordHash", "record_hash", "hash"], null));
        const rowReports = collected.reports.filter((item) => String(item.__sessionId ?? legacyId) === String(legacyId));
        for (const item of rowReports) {
          const reportValue = item.value;
          const kind = reportValue?.lockedUtc || reportValue?.lockHash ? "LOCKED" : "RAW";
          this.db.prepare("INSERT OR REPLACE INTO legacy_reports(import_id,legacy_session_id,report_kind,report_json,report_hash) VALUES(?,?,?,?,?)").run(importId, String(legacyId), kind, JSON.stringify(reportValue), reportValue?.lockHash || reportValue?.lock_hash || sha256(canonical(reportValue)));
        }
        const rowAnalyses = collected.analyses.filter((item) => String(item.__sessionId ?? legacyId) === String(legacyId));
        for (const item of rowAnalyses) this.db.prepare("INSERT OR REPLACE INTO legacy_analyses(import_id,legacy_session_id,analysis_json,analysis_hash) VALUES(?,?,?,?)").run(importId, String(legacyId), JSON.stringify(item.value), item.value?.inputHash || item.value?.input_hash || sha256(canonical(item.value)));
        const originalObjective = objective === undefined || objective === null ? null : String(objective);
        const originalTarget = target === undefined || target === null ? null : String(target);
        this.db.prepare("INSERT INTO legacy_sessions(import_id,legacy_session_id,imported_session_id,original_json,original_metadata_json,original_objective,original_target,source_integrity_status) VALUES(?,?,?,?,?,?,?,?)").run(importId, String(legacyId), importedId, original, JSON.stringify(first(value, ["metadata", "meta"], {})), originalObjective, originalTarget, chain.status);
        report.sessions.push({ legacySessionId: String(legacyId), importedSessionId: importedId, sourceIntegrityStatus: chain.status, eventCount: eventRows.length, outputCount: outputRows.length });
        if (!chain.valid) report.warnings.push(`${legacyId}: ${chain.status}`);
      });
      const status = report.sessions.length === 0 ? "NO_SESSIONS" : parseErrors.length === 0 && report.sessions.every((session) => session.sourceIntegrityStatus === "VERIFIED_SOURCE_CHAIN") ? "VERIFIED_SOURCE_DATA" : "PARTIAL_UNVERIFIED";
      this.db.prepare("UPDATE legacy_imports SET source_integrity_status=?,report_json=? WHERE import_id=?").run(status, JSON.stringify(report), importId);
    });
    tx();
    return { importId, imported: report.sessions.length, source: input.sourceKind, sourceSha256, sourceIntegrityStatus: this.db.prepare("SELECT source_integrity_status FROM legacy_imports WHERE import_id=?").get(importId).source_integrity_status, sessions: report.sessions, report };
  }

  importBundle(source, options = {}) { return this.import(source, options); }
  importDirectory(directory, options = {}) { return this.import(directory, options); }
}

export class LegacyImportService extends LegacyImporter {}
