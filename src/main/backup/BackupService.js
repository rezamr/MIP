import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sha256, canonical } from "../../engine.js";
import { applyPragmas, CURRENT_SCHEMA_VERSION, migrateConnection, now } from "../database/db.js";
import { IntegrityService } from "../integrity/IntegrityService.js";

const requiredTables = [
  "schema_migrations", "sessions", "trials", "session_commitments", "evidence_events", "machine_outputs", "raw_reports_locked", "late_annotations", "experiment_profiles", "profile_versions", "audio_recipes", "audio_recipe_versions", "calibrations", "analyses", "analysis_versions", "integrity_metadata", "backups", "session_details", "transition_projections", "transition_evidence", "timing_observations", "output_finalizations", "audio_commits", "profile_identities", "profile_version_metadata", "profile_drafts", "audio_recipe_version_metadata", "audio_recipe_drafts", "calibration_details", "audio_health", "audio_health_observations", "backup_metadata", "legacy_imports", "legacy_source_files", "legacy_sessions", "legacy_events", "legacy_outputs", "legacy_reports", "legacy_analyses", "research_definitions", "session_phase_projections", "target_occurrences", "future_target_events", "cross_session_analyses", "research_defaults",
];

function checkResult(value) {
  return Array.isArray(value) && value.length > 0 ? value.every((row) => String(Object.values(row)[0]).toLowerCase() === "ok") : false;
}

function openChecked(file, readonly = true) {
  const db = new Database(file, { readonly, fileMustExist: true });
  if (!readonly) applyPragmas(db);
  else {
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
  }
  return db;
}

export class BackupService {
  constructor(owner, options = {}) {
    this.owner = owner;
    this.db = owner.db || owner;
    this.file = owner.file || options.file;
    this.backupDir = owner.backupDir || options.backupDir || path.dirname(this.file);
    this.pathTokens = new Map();
    fs.mkdirSync(this.backupDir, { recursive: true });
  }

  registerPathToken(token, resolvedPath) {
    if (!token || !path.isAbsolute(resolvedPath)) throw new Error("A path token requires an absolute resolved path");
    this.pathTokens.set(String(token), path.resolve(resolvedPath));
    return { pathToken: String(token), path: path.resolve(resolvedPath) };
  }

  resolvePath(input = {}) {
    if (input.backupId) {
      const row = this.db.prepare("SELECT path FROM backups WHERE backup_id=?").get(input.backupId);
      if (!row) throw new Error(`Known backup not found: ${input.backupId}`);
      return path.resolve(row.path);
    }
    if (input.pathToken) {
      const value = this.pathTokens.get(String(input.pathToken));
      if (!value) throw new Error("Unknown backup path token");
      return value;
    }
    if (input.path && path.isAbsolute(String(input.path))) return path.resolve(String(input.path));
    throw new Error("Backup restore requires a known backup, path token, or resolved absolute path");
  }

  _schemaCheck(db) {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const names = new Set(rows.map((row) => row.name));
    const missing = requiredTables.filter((name) => !names.has(name));
    const version = Number(db.prepare("SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations").get().version);
    return { valid: missing.length === 0 && version >= CURRENT_SCHEMA_VERSION, version, expectedVersion: CURRENT_SCHEMA_VERSION, missingTables: missing };
  }

  _evidenceCheck(db) {
    const integrity = new IntegrityService({ db });
    const result = integrity.verifyDatabase({ persist: false, allowLegacy: true });
    return { valid: result.valid, schemaVersion: result.schemaVersion, sessionCount: result.sessionCount, foreignKeyViolations: result.foreignKeyViolations, sessions: result.sessions };
  }

  verifyFile(file, options = {}) {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw new Error("Backup file not found");
    const bytes = fs.readFileSync(resolved);
    const actualHash = sha256(bytes);
    if (options.expectedSha256 && String(options.expectedSha256).toLowerCase() !== actualHash) throw new Error("Backup SHA-256 mismatch");
    let db;
    const errors = [];
    let quickCheck = { valid: false, values: [] };
    let integrityCheck = { valid: false, values: [] };
    let schemaCheck = { valid: false };
    let evidenceCheck = { valid: false };
    try {
      db = openChecked(resolved, true);
      const quickValues = db.prepare("PRAGMA quick_check").all();
      const integrityValues = db.prepare("PRAGMA integrity_check").all();
      quickCheck = { valid: checkResult(quickValues), values: quickValues };
      integrityCheck = { valid: checkResult(integrityValues), values: integrityValues };
      schemaCheck = this._schemaCheck(db);
      evidenceCheck = this._evidenceCheck(db);
    } catch (error) {
      errors.push(`SQLite verification failed: ${error.message}`);
    } finally {
      db?.close();
    }
    if (!quickCheck.valid) errors.push("SQLite quick_check failed");
    if (!integrityCheck.valid) errors.push("SQLite integrity_check failed");
    if (!schemaCheck.valid) errors.push("SQLite schema check failed");
    if (!evidenceCheck.valid) errors.push("SQLite evidence verification failed");
    return { valid: errors.length === 0, path: resolved, sha256: actualHash, sizeBytes: bytes.length, quickCheck, integrityCheck, schemaCheck, evidenceCheck, errors };
  }

  verifyBackup(input = {}) {
    const file = typeof input === "string" ? input : this.resolvePath(input);
    const expected = typeof input === "string" ? undefined : input.sha256 || input.expectedSha256;
    return this.verifyFile(file, { expectedSha256: expected });
  }

  async _backupDatabase(destination) {
    if (typeof this.db.backup !== "function") throw new Error("better-sqlite3 online backup API is unavailable");
    await this.db.backup(destination);
  }

  async create(options = {}) {
    const backupId = options.backupId || `B${Date.now()}-${process.hrtime.bigint()}`;
    const target = path.resolve(options.path || path.join(this.backupDir, `${backupId}.sqlite3`));
    if (target === path.resolve(this.file)) throw new Error("Backup destination cannot be the live database");
    const temporary = `${target}.tmp-${process.hrtime.bigint()}`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
      await this._backupDatabase(temporary);
      const verification = this.verifyFile(temporary);
      if (!verification.valid) throw new Error(`Created backup failed verification: ${verification.errors.join("; ")}`);
      fs.renameSync(temporary, target);
      const createdUtc = now();
      this.db.prepare("INSERT INTO backups(backup_id,created_utc,path,sha256,verified) VALUES(?,?,?,?,1)").run(backupId, createdUtc, target, verification.sha256);
      this.db.prepare("INSERT INTO backup_metadata(backup_id,source_path,path_token,size_bytes,sqlite_hash,quick_check_json,integrity_check_json,schema_check_json,evidence_check_json,component_results_json,verified_utc,verification_status,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(backupId, this.file, options.pathToken || null, verification.sizeBytes, verification.sha256, JSON.stringify(verification.quickCheck), JSON.stringify(verification.integrityCheck), JSON.stringify(verification.schemaCheck), JSON.stringify(verification.evidenceCheck), JSON.stringify(verification), createdUtc, "VERIFIED", createdUtc);
      return { backupId, id: backupId, path: target, sha256: verification.sha256, verified: true, verification, schemaVersion: verification.schemaCheck.version, components: verification.evidenceCheck };
    } finally {
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    }
  }

  async createBackup(options = {}) { return this.create(options); }

  async restore(input = {}, options = {}) {
    const request = typeof input === "string" ? { path: input } : input;
    const guard = options.activeSessionGuard || request.activeSessionGuard;
    if (typeof guard === "function") {
      const active = await guard();
      if (active === true || active?.active) throw new Error("Cannot restore while a session is active");
    }
    const source = this.resolvePath(request);
    if (path.resolve(source) === path.resolve(this.file)) throw new Error("Restore source cannot be the live database");
    const sourceVerification = this.verifyFile(source, { expectedSha256: request.sha256 || request.expectedSha256 });
    if (!sourceVerification.valid) throw new Error(`Backup rejected: ${sourceVerification.errors.join("; ")}`);
    const safety = await this.create({ backupId: `PRE-RESTORE-${Date.now()}-${process.hrtime.bigint()}` });
    const stage = `${this.file}.restore-${process.hrtime.bigint()}`;
    const rollback = `${this.file}.rollback-${process.hrtime.bigint()}`;
    let stagedDb;
    try {
      const sourceDb = openChecked(source, true);
      try {
        await sourceDb.backup(stage);
      } finally {
        sourceDb.close();
      }
      stagedDb = openChecked(stage, false);
      migrateConnection(stagedDb);
      const stagedQuick = checkResult(stagedDb.prepare("PRAGMA quick_check").all());
      const stagedIntegrity = checkResult(stagedDb.prepare("PRAGMA integrity_check").all());
      const stagedSchema = this._schemaCheck(stagedDb);
      const stagedEvidence = this._evidenceCheck(stagedDb);
      stagedDb.close();
      stagedDb = null;
      if (!(stagedQuick && stagedIntegrity && stagedSchema.valid && stagedEvidence.valid)) throw new Error("Staged restore verification failed");
      this.db.pragma("wal_checkpoint(TRUNCATE)");
      this.owner.close();
      if (fs.existsSync(`${this.file}-wal`)) fs.rmSync(`${this.file}-wal`, { force: true });
      if (fs.existsSync(`${this.file}-shm`)) fs.rmSync(`${this.file}-shm`, { force: true });
      fs.renameSync(this.file, rollback);
      fs.renameSync(stage, this.file);
      this.owner.reopen();
      this.db = this.owner.db;
      const postRestore = this.owner.integrity.verifyDatabase({ persist: false, allowLegacy: true });
      if (!postRestore.valid) throw new Error("Post-restore verification failed");
      fs.rmSync(rollback, { force: true });
      return { restored: true, source, sha256: sourceVerification.sha256, safetyBackup: safety, rollback: null, schemaVersion: this.owner.schemaVersion, verification: sourceVerification, postRestore, components: postRestore.sessions };
    } catch (error) {
      stagedDb?.close();
      if (!this.owner.db.open) {
        if (fs.existsSync(this.file)) fs.rmSync(this.file, { force: true });
        if (fs.existsSync(rollback)) fs.renameSync(rollback, this.file);
        if (!this.owner.db.open) this.owner.reopen();
        this.db = this.owner.db;
      } else if (fs.existsSync(rollback)) {
        this.owner.close();
        if (fs.existsSync(this.file)) fs.rmSync(this.file, { force: true });
        fs.renameSync(rollback, this.file);
        this.owner.reopen();
        this.db = this.owner.db;
      }
      if (fs.existsSync(stage)) fs.rmSync(stage, { force: true });
      throw error;
    }
  }

  async restoreBackup(input, options = {}) { return this.restore(input, options); }
}

export class BackupManager extends BackupService {}
