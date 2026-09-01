import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sha256, canonical, profiles } from "../../engine.js";

export class MipDatabase {
  constructor(userData) {
    this.root = path.join(userData, "MIP");
    this.dataDir = path.join(this.root, "data");
    this.backupDir = path.join(this.root, "backups");
    this.exportDir = path.join(this.root, "exports");
    this.logsDir = path.join(this.root, "logs");
    for (const dir of [
      this.dataDir,
      this.backupDir,
      this.exportDir,
      this.logsDir,
    ])
      fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(this.dataDir, "mip.sqlite3");
    this.db = new Database(this.file);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("busy_timeout = 5000");
    this.migrate();
    this.seedProfiles();
  }
  migrate() {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_utc TEXT NOT NULL)",
    );
    const current = this.db
      .prepare("SELECT COALESCE(MAX(version),0) v FROM schema_migrations")
      .get().v;
    if (current < 1) {
      const tx = this.db.transaction(() => {
        this.db.exec(
          `CREATE TABLE sessions(session_id TEXT PRIMARY KEY,created_utc TEXT NOT NULL,participant_label TEXT,record_type TEXT,profile_id TEXT,profile_version INTEGER,status TEXT NOT NULL,reveal_policy TEXT,recovery_state TEXT,manifest_json TEXT,hidden_objective TEXT,participant_target TEXT);CREATE TABLE trials(trial_id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(session_id),trial_seq INTEGER NOT NULL,trial_type TEXT,config_json TEXT,state TEXT);CREATE TABLE session_commitments(session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),canonical_config TEXT NOT NULL,config_hash TEXT NOT NULL,committed_utc TEXT NOT NULL);CREATE TABLE evidence_events(session_id TEXT NOT NULL REFERENCES sessions(session_id),seq INTEGER NOT NULL,event_id TEXT NOT NULL,event_type TEXT NOT NULL,occurred_utc TEXT NOT NULL,monotonic_ns TEXT NOT NULL,payload_json TEXT NOT NULL,previous_hash TEXT NOT NULL,event_hash TEXT NOT NULL,PRIMARY KEY(session_id,seq),UNIQUE(event_id));CREATE TABLE machine_outputs(session_id TEXT NOT NULL REFERENCES sessions(session_id),trial_id TEXT,output_seq INTEGER NOT NULL,generated_utc TEXT NOT NULL,monotonic_ns TEXT NOT NULL,value_json TEXT NOT NULL,region TEXT,record_hash TEXT NOT NULL,PRIMARY KEY(session_id,output_seq));CREATE TABLE raw_report_drafts(session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),saved_utc TEXT NOT NULL,payload_json TEXT NOT NULL);CREATE TABLE raw_reports_locked(session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),locked_utc TEXT NOT NULL,payload_json TEXT NOT NULL,lock_hash TEXT NOT NULL,schema_version TEXT NOT NULL);CREATE TABLE late_annotations(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL REFERENCES sessions(session_id),created_utc TEXT NOT NULL,kind TEXT NOT NULL,payload_json TEXT NOT NULL,annotation_hash TEXT NOT NULL);CREATE TABLE experiment_profiles(profile_id TEXT PRIMARY KEY,name TEXT NOT NULL,provenance TEXT);CREATE TABLE profile_versions(profile_id TEXT NOT NULL REFERENCES experiment_profiles(profile_id),version INTEGER NOT NULL,config_json TEXT NOT NULL,config_hash TEXT NOT NULL,created_utc TEXT NOT NULL,immutable INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(profile_id,version));CREATE TABLE audio_recipes(recipe_id TEXT PRIMARY KEY,provenance TEXT);CREATE TABLE audio_recipe_versions(recipe_id TEXT NOT NULL REFERENCES audio_recipes(recipe_id),version INTEGER NOT NULL,config_json TEXT NOT NULL,config_hash TEXT NOT NULL,created_utc TEXT NOT NULL,immutable INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(recipe_id,version));CREATE TABLE calibrations(calibration_id TEXT PRIMARY KEY,created_utc TEXT NOT NULL,provider TEXT,provider_version TEXT,sample_count INTEGER,counts_json TEXT,statistics_json TEXT,metadata_json TEXT,result_hash TEXT,integrity_status TEXT);CREATE TABLE analyses(session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),analysis_version TEXT,input_hash TEXT,payload_json TEXT,created_utc TEXT);CREATE TABLE integrity_metadata(session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),verified_utc TEXT,valid INTEGER,details_json TEXT);CREATE TABLE backups(backup_id TEXT PRIMARY KEY,created_utc TEXT NOT NULL,path TEXT NOT NULL,sha256 TEXT NOT NULL,verified INTEGER NOT NULL);CREATE INDEX idx_sessions_created ON sessions(created_utc);CREATE INDEX idx_events_session ON evidence_events(session_id,seq);CREATE INDEX idx_outputs_session ON machine_outputs(session_id,output_seq);CREATE INDEX idx_calibration_time ON calibrations(created_utc);`,
        );
        this.db.exec(
          `CREATE TRIGGER immutable_events_update BEFORE UPDATE ON evidence_events BEGIN SELECT RAISE(ABORT,'evidence_events are immutable'); END;CREATE TRIGGER immutable_events_delete BEFORE DELETE ON evidence_events BEGIN SELECT RAISE(ABORT,'evidence_events are immutable'); END;CREATE TRIGGER immutable_commitment_update BEFORE UPDATE ON session_commitments BEGIN SELECT RAISE(ABORT,'session commitments are immutable'); END;CREATE TRIGGER immutable_commitment_delete BEFORE DELETE ON session_commitments BEGIN SELECT RAISE(ABORT,'session commitments are immutable'); END;CREATE TRIGGER immutable_reports_update BEFORE UPDATE ON raw_reports_locked BEGIN SELECT RAISE(ABORT,'locked raw reports are immutable'); END;CREATE TRIGGER immutable_reports_delete BEFORE DELETE ON raw_reports_locked BEGIN SELECT RAISE(ABORT,'locked raw reports are immutable'); END;CREATE TRIGGER immutable_outputs_update BEFORE UPDATE ON machine_outputs BEGIN SELECT RAISE(ABORT,'machine outputs are immutable'); END;CREATE TRIGGER immutable_outputs_delete BEFORE DELETE ON machine_outputs BEGIN SELECT RAISE(ABORT,'machine outputs are immutable'); END;`,
        );
        this.db
          .prepare("INSERT INTO schema_migrations VALUES(?,?)")
          .run(1, new Date().toISOString());
      });
      tx();
    }
    if (current < 2) {
      const tx = this.db.transaction(() => {
        this.db.exec(
          "ALTER TABLE evidence_events ADD COLUMN trial_id TEXT REFERENCES trials(trial_id)",
        );
        this.db
          .prepare(
            "UPDATE evidence_events SET trial_id=(SELECT trial_id FROM trials WHERE trials.session_id=evidence_events.session_id ORDER BY trial_seq LIMIT 1) WHERE trial_id IS NULL",
          )
          .run();
        this.db
          .prepare("INSERT INTO schema_migrations VALUES(?,?)")
          .run(2, new Date().toISOString());
      });
      tx();
    }
  }
  seedProfiles() {
    const insert = this.db.prepare(
        "INSERT OR IGNORE INTO experiment_profiles VALUES(?,?,?)",
      ),
      version = this.db.prepare(
        "INSERT OR IGNORE INTO profile_versions VALUES(?,?,?,?,?,1)",
      );
    for (const p of Object.values(profiles)) {
      insert.run(p.id, p.name, "MIP built-in");
      version.run(
        p.id,
        p.version,
        JSON.stringify(p),
        sha256(canonical(p)),
        new Date().toISOString(),
      );
    }
  }
  nextSessionId() {
    const rows = this.db
      .prepare(
        "SELECT session_id FROM sessions WHERE session_id GLOB 'S[0-9]*'",
      )
      .all();
    let max = 0;
    for (const r of rows) {
      const n = Number(r.session_id.slice(1));
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
    return `S${String(max + 1).padStart(4, "0")}`;
  }
  beginSession(
    profile,
    participant = "Local participant",
    recordType = "dry",
    material = {},
  ) {
    const id = this.nextSessionId(),
      trial = `${id}-T001`,
      now = new Date().toISOString(),
      snapshot = { ...profile, material },
      cfg = JSON.stringify(snapshot),
      hash = sha256(canonical(snapshot)),
      objective = material.objective,
      target = material.participantTarget,
      tx = this.db.transaction(() => {
        this.db
          .prepare("INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
          .run(
            id,
            now,
            participant,
            recordType,
            profile.id,
            profile.version,
            "COMMITTED",
            profile.reveal.policy,
            null,
            cfg,
            String(objective),
            target,
          );
        this.db
          .prepare("INSERT INTO trials VALUES(?,?,?,?,?,?)")
          .run(
            trial,
            id,
            1,
            "REQUEST_IMMEDIATE_STREAM",
            JSON.stringify(profile.output),
            "COMMITTED",
          );
        this.db
          .prepare("INSERT INTO session_commitments VALUES(?,?,?,?)")
          .run(id, cfg, hash, now);
        this.appendEvent(id, trial, "COMMITTED", {
          configHash: hash,
          profileId: profile.id,
          rng: material.rng,
          recipe: material.audio,
        });
      });
    tx();
    return { id, trial, configHash: hash };
  }
  appendEvent(sessionId, trialId, type, payload) {
    payload = JSON.parse(JSON.stringify(payload ?? {}));
    const last = this.db
        .prepare(
          "SELECT seq,event_hash FROM evidence_events WHERE session_id=? ORDER BY seq DESC LIMIT 1",
        )
        .get(sessionId),
      seq = (last?.seq || 0) + 1,
      previous = last?.event_hash || "GENESIS",
      now = new Date().toISOString(),
      base = {
        sessionId,
        seq,
        eventType: type,
        occurredUtc: now,
        monotonicNs: process.hrtime.bigint().toString(),
        payload,
        previousHash: previous,
      },
      hash = sha256(canonical(base));
    this.db
      .prepare(
        "INSERT INTO evidence_events(session_id,seq,event_id,event_type,occurred_utc,monotonic_ns,payload_json,previous_hash,event_hash,trial_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        sessionId,
        seq,
        `${sessionId}-E${String(seq).padStart(5, "0")}`,
        type,
        now,
        base.monotonicNs,
        JSON.stringify(payload),
        previous,
        hash,
        trialId,
      );
    return { ...base, trialId, eventHash: hash };
  }
  listSessions() {
    return this.db
      .prepare("SELECT * FROM sessions ORDER BY created_utc DESC")
      .all()
      .map((s) => {
        const reveal = !!this.db
          .prepare("SELECT 1 FROM raw_reports_locked WHERE session_id=?")
          .get(s.session_id);
        return {
          sessionId: s.session_id,
          createdUtc: s.created_utc,
          participantLabel: s.participant_label,
          recordType: s.record_type,
          profileId: s.profile_id,
          profileVersion: s.profile_version,
          status: s.status,
          revealPolicy: s.reveal_policy,
          recoveryState: s.recovery_state,
          configFingerprint: this.db
            .prepare(
              "SELECT config_hash FROM session_commitments WHERE session_id=?",
            )
            .get(s.session_id)?.config_hash,
          configSnapshot: JSON.parse(
            s.manifest_json ||
              (s.hidden_objective && s.manifest_json) ||
              "null",
          ),
          hasReveal: reveal,
          revealEligible: reveal,
          timing: null,
        };
      });
  }
  events(id) {
    return this.db
      .prepare(
        "SELECT seq,event_id AS eventId,event_type AS type,occurred_utc AS occurredUtc,monotonic_ns AS monotonicNs,payload_json AS payload,previous_hash AS previousHash,event_hash AS hash FROM evidence_events WHERE session_id=? ORDER BY seq",
      )
      .all(id)
      .map((e) => ({ ...e, payload: JSON.parse(e.payload) }));
  }
  verify(id) {
    const events = this.db
        .prepare(
          "SELECT * FROM evidence_events WHERE session_id=? ORDER BY seq",
        )
        .all(id),
      errors = [];
    let prev = "GENESIS";
    for (const e of events) {
      const base = {
        sessionId: e.session_id,
        seq: e.seq,
        eventType: e.event_type,
        occurredUtc: e.occurred_utc,
        monotonicNs: e.monotonic_ns,
        payload: JSON.parse(e.payload_json),
        previousHash: e.previous_hash,
      };
      if (e.previous_hash !== prev || sha256(canonical(base)) !== e.event_hash)
        errors.push(`Event ${e.seq} hash mismatch`);
      prev = e.event_hash;
    }
    const result = {
      valid: errors.length === 0,
      errors,
      eventCount: events.length,
      machineOutputCount: this.db
        .prepare("SELECT COUNT(*) c FROM machine_outputs WHERE session_id=?")
        .get(id).c,
    };
    this.db
      .prepare(
        "INSERT OR REPLACE INTO integrity_metadata(session_id,verified_utc,valid,details_json) VALUES(?,?,?,?)",
      )
      .run(
        id,
        new Date().toISOString(),
        result.valid ? 1 : 0,
        JSON.stringify(result),
      );
    return result;
  }
  close() {
    this.db.close();
  }
}
