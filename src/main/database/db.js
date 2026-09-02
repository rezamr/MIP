import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sha256, canonical, profiles, APP_VERSION, ENGINE_VERSION, normalizeTemporalAnalysisPlan } from "../../engine.js";
import { PRESETS, EXPERIMENTAL_PRESETS, AUDIO_VERSION, validateRecipe } from "../../audio.js";
import { activeLayers, validateRecipeProvenance, normalizeRecipe } from "../../../public/audio-core.js";
import { IntegrityService } from "../integrity/IntegrityService.js";
import { SessionRepository } from "../repositories/SessionRepository.js";
import { EvidenceRepository } from "../repositories/EvidenceRepository.js";
import { ProfileRepository } from "../repositories/ProfileRepository.js";
import { AudioRecipeRepository } from "../repositories/AudioRecipeRepository.js";
import { CalibrationRepository } from "../repositories/CalibrationRepository.js";
import { AudioHealthRepository } from "../repositories/AudioHealthRepository.js";
import { AnalysisRepository } from "../repositories/AnalysisRepository.js";
import { BackupService } from "../backup/BackupService.js";
import { LegacyImporter } from "../import/LegacyImporter.js";
import { SessionExporter } from "../export/SessionExporter.js";
import { SessionController } from "../sessions/session-controller.js";
import { ResearchRepository } from "../repositories/ResearchRepository.js";
import {
  resolveEngineeringVerification,
  bindEngineeringVerification,
} from "../repositories/AudioRecipeVersionPolicy.js";

export const CURRENT_SCHEMA_VERSION = 14;

const now = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const json = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const sqlDb = (owner) => owner?.db?.prepare ? owner.db : owner;

export function requiresStrictResearchGate(researchMeta) {
  if (!researchMeta) return false;
  // New schema-14 research definitions are governed by the orthogonal
  // evidence/reveal projections.  Legacy binary sessions without a research
  // definition retain their historical raw-report facade, but a committed
  // non-binary definition must never become reveal-eligible merely because a
  // raw report was locked.
  const outcomeSpace = json(researchMeta.outcome_space_json, null);
  if (outcomeSpace?.type && String(outcomeSpace.type).toUpperCase() !== "BINARY") return true;
  if (researchMeta.mode !== "INFLUENCE" || researchMeta.primary_endpoint !== "EXACT_SLOT") return true;
  const analysis = json(researchMeta.temporal_analysis_json, {});
  return Array.isArray(analysis?.windows) && analysis.windows.some((window) => {
    const preMs = Number(window?.preMs ?? 0);
    const postMs = Number(window?.postMs ?? 0);
    return window?.enabled !== false && (
      (Number.isFinite(preMs) && preMs > 0) ||
      (Number.isFinite(postMs) && postMs > 0) ||
      (window?.exactSequence !== null && window?.exactSequence !== undefined) ||
      (window?.sequenceStart !== null && window?.sequenceStart !== undefined) ||
      (window?.sequenceEnd !== null && window?.sequenceEnd !== undefined) ||
      (window?.sequenceOffsetStart !== null && window?.sequenceOffsetStart !== undefined) ||
      (window?.sequenceOffsetEnd !== null && window?.sequenceOffsetEnd !== undefined)
    );
  });
}

function tableExists(db, name) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name),
  );
}

function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function addColumn(db, table, column, definition) {
  if (!columnExists(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function immutableTrigger(db, name, table, action, message, when = "") {
  db.exec(
    `CREATE TRIGGER IF NOT EXISTS ${name} BEFORE ${action} ON ${table}${when} BEGIN SELECT RAISE(ABORT, '${message}'); END;`,
  );
}

export function applyPragmas(db) {
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("busy_timeout = 5000");
}

function createBaseTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions(
      session_id TEXT PRIMARY KEY,
      created_utc TEXT NOT NULL,
      participant_label TEXT,
      record_type TEXT,
      profile_id TEXT,
      profile_version INTEGER,
      status TEXT NOT NULL,
      reveal_policy TEXT,
      recovery_state TEXT,
      manifest_json TEXT,
      hidden_objective TEXT,
      participant_target TEXT
    );
    CREATE TABLE IF NOT EXISTS trials(
      trial_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      trial_seq INTEGER NOT NULL,
      trial_type TEXT,
      config_json TEXT,
      state TEXT
    );
    CREATE TABLE IF NOT EXISTS session_commitments(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      canonical_config TEXT NOT NULL,
      config_hash TEXT NOT NULL,
      committed_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evidence_events(
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      seq INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      occurred_utc TEXT NOT NULL,
      monotonic_ns TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      previous_hash TEXT NOT NULL,
      event_hash TEXT NOT NULL,
      trial_id TEXT REFERENCES trials(trial_id),
      PRIMARY KEY(session_id, seq),
      UNIQUE(event_id)
    );
    CREATE TABLE IF NOT EXISTS machine_outputs(
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      trial_id TEXT,
      output_seq INTEGER NOT NULL,
      generated_utc TEXT NOT NULL,
      monotonic_ns TEXT NOT NULL,
      value_json TEXT NOT NULL,
      region TEXT,
      record_hash TEXT NOT NULL,
      scheduled_utc TEXT,
      scheduled_monotonic_ns TEXT,
      actual_utc TEXT,
      actual_monotonic_ns TEXT,
      lateness_ms REAL,
      timing_status TEXT,
      PRIMARY KEY(session_id, output_seq)
    );
    CREATE TABLE IF NOT EXISTS raw_report_drafts(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      saved_utc TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS raw_reports_locked(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      locked_utc TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      lock_hash TEXT NOT NULL,
      schema_version TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS late_annotations(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      created_utc TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      annotation_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS experiment_profiles(
      profile_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provenance TEXT
    );
    CREATE TABLE IF NOT EXISTS profile_versions(
      profile_id TEXT NOT NULL REFERENCES experiment_profiles(profile_id),
      version INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      config_hash TEXT NOT NULL,
      created_utc TEXT NOT NULL,
      immutable INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(profile_id, version)
    );
     CREATE TABLE IF NOT EXISTS audio_recipes(
       recipe_id TEXT PRIMARY KEY,
       provenance TEXT
     );
     CREATE TABLE IF NOT EXISTS audio_recipe_identities(
       recipe_id TEXT PRIMARY KEY REFERENCES audio_recipes(recipe_id),
       identity_type TEXT,
       identity_label TEXT,
       provenance_json TEXT,
       source_kind TEXT,
       source_ref TEXT,
       created_utc TEXT NOT NULL
     );
    CREATE TABLE IF NOT EXISTS audio_recipe_versions(
      recipe_id TEXT NOT NULL REFERENCES audio_recipes(recipe_id),
      version INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      config_hash TEXT NOT NULL,
      created_utc TEXT NOT NULL,
      immutable INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(recipe_id, version)
    );
    CREATE TABLE IF NOT EXISTS calibrations(
      calibration_id TEXT PRIMARY KEY,
      created_utc TEXT NOT NULL,
      provider TEXT,
      provider_version TEXT,
      sample_count INTEGER,
      counts_json TEXT,
      statistics_json TEXT,
      metadata_json TEXT,
      result_hash TEXT,
      integrity_status TEXT
    );
    CREATE TABLE IF NOT EXISTS analyses(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      analysis_version TEXT,
       input_hash TEXT,
       input_json TEXT,
       payload_json TEXT,
      created_utc TEXT,
      analysis_hash TEXT
    );
     CREATE TABLE IF NOT EXISTS analysis_versions(
       analysis_id TEXT PRIMARY KEY,
       session_id TEXT NOT NULL REFERENCES sessions(session_id),
       version INTEGER NOT NULL,
       analysis_version TEXT,
       input_hash TEXT,
       input_json TEXT,
       payload_json TEXT,
      analysis_hash TEXT,
      created_utc TEXT NOT NULL,
      UNIQUE(session_id, version)
    );
    CREATE TABLE IF NOT EXISTS integrity_metadata(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      verified_utc TEXT,
      valid INTEGER,
      details_json TEXT
    );
    CREATE TABLE IF NOT EXISTS backups(
      backup_id TEXT PRIMARY KEY,
      created_utc TEXT NOT NULL,
      path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      verified INTEGER NOT NULL
    );
  `);
}

function ensureV12Tables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_details(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      session_snapshot_json TEXT,
      session_snapshot_hash TEXT,
      timing_json TEXT,
      scheduled_monotonic_ns TEXT,
      scheduled_utc TEXT,
      actual_start_monotonic_ns TEXT,
      actual_start_utc TEXT,
      actual_end_monotonic_ns TEXT,
      actual_end_utc TEXT,
      app_version TEXT,
      engine_version TEXT,
      audio_version TEXT,
      output_hash TEXT,
      final_fingerprint TEXT,
      committed_audio_config_json TEXT,
      committed_audio_config_hash TEXT,
      final_stream_digest TEXT,
      final_stream_frames INTEGER,
      final_stream_format_json TEXT,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transition_projections(
      projection_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      trial_id TEXT REFERENCES trials(trial_id),
      seq INTEGER NOT NULL,
      from_state TEXT,
      to_state TEXT NOT NULL,
      projected_utc TEXT NOT NULL,
      projected_monotonic_ns TEXT,
      projection_hash TEXT NOT NULL,
      evidence_event_id TEXT,
      UNIQUE(session_id, seq)
    );
    CREATE TABLE IF NOT EXISTS transition_evidence(
      evidence_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      trial_id TEXT REFERENCES trials(trial_id),
      projection_id TEXT REFERENCES transition_projections(projection_id),
      evidence_event_id TEXT,
      evidence_type TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      evidence_hash TEXT NOT NULL,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS timing_observations(
      observation_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      trial_id TEXT REFERENCES trials(trial_id),
      output_seq INTEGER,
      scheduled_monotonic_ns TEXT,
      scheduled_utc TEXT,
      actual_monotonic_ns TEXT,
      actual_utc TEXT,
      lateness_ms REAL,
      timing_status TEXT,
      observation_hash TEXT NOT NULL,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS output_finalizations(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      output_hash TEXT,
      final_fingerprint TEXT,
      final_stream_digest TEXT,
      frame_count INTEGER,
      format_json TEXT,
      finalized_utc TEXT NOT NULL,
      finalization_hash TEXT NOT NULL
    );
     CREATE TABLE IF NOT EXISTS audio_commits(
       session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
       recipe_id TEXT,
       recipe_version INTEGER,
       config_json TEXT NOT NULL,
       config_hash TEXT NOT NULL,
       audio_version TEXT,
       engine_version TEXT,
       telemetry_json TEXT,
       stream_digest TEXT,
       frame_count INTEGER,
       format_json TEXT,
       committed_utc TEXT NOT NULL
     );
    CREATE TABLE IF NOT EXISTS profile_identities(
      profile_id TEXT PRIMARY KEY REFERENCES experiment_profiles(profile_id),
      identity_type TEXT,
      identity_label TEXT,
      provenance_json TEXT,
      source_kind TEXT,
      source_ref TEXT,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profile_version_metadata(
      profile_id TEXT NOT NULL REFERENCES experiment_profiles(profile_id),
      version INTEGER NOT NULL,
      identity_id TEXT,
      provenance_json TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      is_draft INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 0,
      parent_version INTEGER,
      validation_json TEXT,
      created_utc TEXT NOT NULL,
      PRIMARY KEY(profile_id, version),
      FOREIGN KEY(profile_id, version) REFERENCES profile_versions(profile_id, version)
    );
    CREATE TABLE IF NOT EXISTS profile_drafts(
      profile_id TEXT PRIMARY KEY REFERENCES experiment_profiles(profile_id),
      base_version INTEGER,
      draft_json TEXT NOT NULL,
      validation_json TEXT,
      updated_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audio_recipe_version_metadata(
      recipe_id TEXT NOT NULL REFERENCES audio_recipes(recipe_id),
      version INTEGER NOT NULL,
      identity_id TEXT,
      provenance_json TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      is_draft INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 0,
      incomplete INTEGER NOT NULL DEFAULT 0,
      parent_version INTEGER,
      validation_json TEXT,
      created_utc TEXT NOT NULL,
      PRIMARY KEY(recipe_id, version),
      FOREIGN KEY(recipe_id, version) REFERENCES audio_recipe_versions(recipe_id, version)
    );
    CREATE TABLE IF NOT EXISTS audio_recipe_drafts(
      recipe_id TEXT PRIMARY KEY REFERENCES audio_recipes(recipe_id),
      base_version INTEGER,
      draft_json TEXT NOT NULL,
      validation_json TEXT,
      updated_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calibration_details(
      calibration_id TEXT PRIMARY KEY REFERENCES calibrations(calibration_id),
      counts_json TEXT,
      statistics_json TEXT,
      metadata_json TEXT,
      device_json TEXT,
      environment_json TEXT,
      observations_json TEXT,
      detail_hash TEXT NOT NULL,
      created_utc TEXT NOT NULL
    );
     CREATE TABLE IF NOT EXISTS audio_health_observations(
      observation_id TEXT PRIMARY KEY,
      diagnostic_id TEXT NOT NULL REFERENCES audio_health(diagnostic_id),
      observed_utc TEXT NOT NULL,
      monotonic_ns TEXT,
      context_state TEXT,
      observation_type TEXT NOT NULL,
      suspended INTEGER NOT NULL DEFAULT 0,
      resumed INTEGER NOT NULL DEFAULT 0,
      frames INTEGER,
      details_json TEXT,
       observation_hash TEXT NOT NULL,
       created_utc TEXT NOT NULL
     );
     CREATE TABLE IF NOT EXISTS audio_health_details(
       diagnostic_id TEXT PRIMARY KEY REFERENCES audio_health(diagnostic_id),
       telemetry_json TEXT,
       device_json TEXT,
       environment_json TEXT,
       digest TEXT,
       format_json TEXT,
       detail_hash TEXT NOT NULL,
       created_utc TEXT NOT NULL
     );
    CREATE TABLE IF NOT EXISTS backup_metadata(
      backup_id TEXT PRIMARY KEY REFERENCES backups(backup_id),
      source_path TEXT,
      path_token TEXT,
      size_bytes INTEGER,
      sqlite_hash TEXT NOT NULL,
      quick_check_json TEXT,
      integrity_check_json TEXT,
      schema_check_json TEXT,
      evidence_check_json TEXT,
      component_results_json TEXT,
      verified_utc TEXT,
      verification_status TEXT NOT NULL,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS legacy_imports(
      import_id TEXT PRIMARY KEY,
      imported_utc TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_path TEXT,
      source_sha256 TEXT NOT NULL,
      source_integrity_status TEXT NOT NULL,
      metadata_json TEXT,
      report_json TEXT
    );
    CREATE TABLE IF NOT EXISTS legacy_source_files(
      file_id TEXT PRIMARY KEY,
      import_id TEXT NOT NULL REFERENCES legacy_imports(import_id),
      relative_name TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
       content_type TEXT,
       content_text TEXT,
       content_blob BLOB,
       metadata_json TEXT,
      UNIQUE(import_id, relative_name)
    );
    CREATE TABLE IF NOT EXISTS legacy_sessions(
      import_id TEXT NOT NULL REFERENCES legacy_imports(import_id),
      legacy_session_id TEXT NOT NULL,
      imported_session_id TEXT NOT NULL REFERENCES sessions(session_id),
      original_json TEXT NOT NULL,
      original_metadata_json TEXT,
      original_objective TEXT,
      original_target TEXT,
      source_integrity_status TEXT NOT NULL,
      PRIMARY KEY(import_id, legacy_session_id)
    );
    CREATE TABLE IF NOT EXISTS legacy_events(
      import_id TEXT NOT NULL REFERENCES legacy_imports(import_id),
      legacy_session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      event_id TEXT,
      event_type TEXT,
      occurred_utc TEXT,
      monotonic_value TEXT,
      payload_json TEXT,
      previous_hash TEXT,
      event_hash TEXT,
      source_json TEXT NOT NULL,
      hash_status TEXT NOT NULL,
      PRIMARY KEY(import_id, legacy_session_id, seq)
    );
    CREATE TABLE IF NOT EXISTS legacy_outputs(
      import_id TEXT NOT NULL REFERENCES legacy_imports(import_id),
      legacy_session_id TEXT NOT NULL,
      output_seq INTEGER NOT NULL,
      output_json TEXT NOT NULL,
      output_hash TEXT,
      PRIMARY KEY(import_id, legacy_session_id, output_seq)
    );
    CREATE TABLE IF NOT EXISTS legacy_reports(
      import_id TEXT NOT NULL REFERENCES legacy_imports(import_id),
      legacy_session_id TEXT NOT NULL,
      report_kind TEXT NOT NULL,
      report_json TEXT NOT NULL,
      report_hash TEXT,
      PRIMARY KEY(import_id, legacy_session_id, report_kind)
    );
    CREATE TABLE IF NOT EXISTS legacy_analyses(
      import_id TEXT NOT NULL REFERENCES legacy_imports(import_id),
      legacy_session_id TEXT NOT NULL,
      analysis_json TEXT NOT NULL,
      analysis_hash TEXT,
      PRIMARY KEY(import_id, legacy_session_id)
    );
  `);
}

function ensureV13Tables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_id_sequence(
      sequence_id INTEGER PRIMARY KEY CHECK(sequence_id=1),
      next_value INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS protocol_stage_events(
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      trial_id TEXT REFERENCES trials(trial_id),
      stage_seq INTEGER NOT NULL,
      stage_type TEXT NOT NULL,
      planned_utc TEXT,
      planned_monotonic_ns TEXT,
      actual_utc TEXT NOT NULL,
      actual_monotonic_ns TEXT NOT NULL,
      status TEXT NOT NULL,
      cue_id TEXT,
      payload_json TEXT NOT NULL,
      stage_hash TEXT NOT NULL,
      PRIMARY KEY(session_id, stage_seq)
    );
    INSERT OR IGNORE INTO session_id_sequence(sequence_id,next_value)
      VALUES(1, 3);
  `);
}

function ensureV13Columns(db) {
  const columns = {
    session_details: [
      ["audio_session_nonce", "TEXT"],
      ["audio_processor_version", "TEXT"],
      ["audio_digest_version", "TEXT"],
      ["audio_pcm_format", "TEXT"],
      ["audio_last_processor_sequence", "INTEGER"],
      ["memory_confirmed_utc", "TEXT"],
      ["baseline_json", "TEXT"],
      ["environment_json", "TEXT"],
      ["safety_json", "TEXT"],
      ["protocol_anchor_json", "TEXT"],
    ],
    audio_health: [
      ["check_mode", "TEXT"],
      ["intended_duration_ms", "INTEGER"],
      ["verification_json", "TEXT"],
    ],
  };
  for (const [table, fields] of Object.entries(columns)) {
    if (!tableExists(db, table)) continue;
    for (const [column, definition] of fields) addColumn(db, table, column, definition);
  }
}

function ensureV14Tables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_definitions(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      definition_json TEXT NOT NULL,
      config_hash TEXT NOT NULL,
      mode TEXT NOT NULL,
      outcome_space_json TEXT NOT NULL,
      cardinality INTEGER NOT NULL,
      target_definition_json TEXT NOT NULL,
      participant_phase TEXT NOT NULL,
      evidence_phase TEXT NOT NULL,
      output_cadence TEXT NOT NULL,
      primary_endpoint TEXT NOT NULL,
      temporal_analysis_json TEXT NOT NULL,
      reveal_policy TEXT NOT NULL,
      compatibility_fingerprint TEXT NOT NULL,
      committed INTEGER NOT NULL DEFAULT 0,
      committed_utc TEXT,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session_phase_projections(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      session_lifecycle TEXT NOT NULL,
      participant_phase_status TEXT NOT NULL,
      evidence_phase_status TEXT NOT NULL,
      report_status TEXT NOT NULL,
      reveal_status TEXT NOT NULL,
      integrity_status TEXT NOT NULL,
      updated_utc TEXT NOT NULL,
      projection_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS target_occurrences(
      occurrence_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(session_id),
      trial_id TEXT REFERENCES trials(trial_id),
      output_seq INTEGER,
      value_json TEXT NOT NULL,
      region TEXT,
      scheduled_utc TEXT,
      scheduled_monotonic_ns TEXT,
      actual_utc TEXT,
      actual_monotonic_ns TEXT,
      scheduled_latency_ms REAL,
      signed_latency_ms REAL,
      timing_classification TEXT,
      record_hash TEXT NOT NULL,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS future_target_events(
      session_id TEXT PRIMARY KEY REFERENCES sessions(session_id),
      prediction_json TEXT,
      target_json TEXT,
      scheduled_utc TEXT,
      scheduled_monotonic_ns TEXT,
      actual_utc TEXT,
      actual_monotonic_ns TEXT,
      rng_metadata_json TEXT,
      status TEXT NOT NULL,
      event_hash TEXT NOT NULL,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cross_session_analyses(
      aggregate_id TEXT PRIMARY KEY,
      compatibility_fingerprint TEXT,
      definition_json TEXT,
      analysis_json TEXT NOT NULL,
      workflow TEXT NOT NULL,
      exploratory INTEGER NOT NULL DEFAULT 0,
      analysis_hash TEXT NOT NULL,
      created_utc TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS research_defaults(
      defaults_id INTEGER PRIMARY KEY CHECK(defaults_id=1),
      defaults_json TEXT NOT NULL,
      defaults_hash TEXT NOT NULL,
      updated_utc TEXT NOT NULL
    );
  `);
}

function ensureV14Indexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_research_mode ON research_definitions(mode,created_utc);
    CREATE INDEX IF NOT EXISTS idx_research_fingerprint ON research_definitions(compatibility_fingerprint,created_utc);
    CREATE INDEX IF NOT EXISTS idx_phase_evidence ON session_phase_projections(evidence_phase_status,updated_utc);
    CREATE INDEX IF NOT EXISTS idx_target_occurrences_session ON target_occurrences(session_id,output_seq);
    CREATE INDEX IF NOT EXISTS idx_target_occurrences_class ON target_occurrences(timing_classification,actual_utc);
    CREATE INDEX IF NOT EXISTS idx_outputs_scheduled ON machine_outputs(session_id,scheduled_utc,output_seq);
    CREATE INDEX IF NOT EXISTS idx_outputs_actual ON machine_outputs(session_id,actual_utc,output_seq);
    CREATE INDEX IF NOT EXISTS idx_aggregate_fingerprint ON cross_session_analyses(compatibility_fingerprint,created_utc);
  `);
}

function ensureV14Columns(db) {
  addColumn(db, "target_occurrences", "scheduled_latency_ms", "REAL");
  addColumn(db, "future_target_events", "rng_metadata_json", "TEXT");
}

function backfillSessionIdSequence(db) {
  if (!tableExists(db, "session_id_sequence")) return;
  const rows = db.prepare("SELECT session_id FROM sessions WHERE session_id GLOB 'S[0-9]*'").all();
  let maximum = 2; // S0001 and S0002 are reserved historical identifiers.
  for (const row of rows) {
    const value = Number(String(row.session_id).slice(1));
    if (Number.isSafeInteger(value)) maximum = Math.max(maximum, value);
  }
  const next = db.prepare("SELECT next_value FROM session_id_sequence WHERE sequence_id=1").get()?.next_value;
  if (!Number.isSafeInteger(Number(next)) || Number(next) < maximum + 1)
    db.prepare("INSERT INTO session_id_sequence(sequence_id,next_value) VALUES(1,?) ON CONFLICT(sequence_id) DO UPDATE SET next_value=excluded.next_value").run(maximum + 1);
}

function ensureAudioHealthTable(db) {
  db.exec("CREATE TABLE IF NOT EXISTS audio_health(diagnostic_id TEXT PRIMARY KEY,recipe_id TEXT,recipe_version INTEGER,started_utc TEXT,ended_utc TEXT,duration_ms INTEGER,sample_rate INTEGER,base_latency REAL,output_latency REAL,generated_frames INTEGER,continuity_json TEXT,clipping INTEGER,context_states_json TEXT,owner_result TEXT,owner_note TEXT,result_hash TEXT,integrity_status TEXT)");
}

function ensureBaseColumns(db) {
  const columns = {
    sessions: [
      ["participant_label", "TEXT"], ["record_type", "TEXT"], ["profile_id", "TEXT"], ["profile_version", "INTEGER"],
      ["status", "TEXT"], ["reveal_policy", "TEXT"], ["recovery_state", "TEXT"], ["manifest_json", "TEXT"],
      ["hidden_objective", "TEXT"], ["participant_target", "TEXT"],
    ],
    trials: [["trial_type", "TEXT"], ["config_json", "TEXT"], ["state", "TEXT"]],
    session_commitments: [["canonical_config", "TEXT"], ["config_hash", "TEXT"], ["committed_utc", "TEXT"]],
    evidence_events: [["event_id", "TEXT"], ["event_type", "TEXT"], ["occurred_utc", "TEXT"], ["monotonic_ns", "TEXT"], ["payload_json", "TEXT"], ["previous_hash", "TEXT"], ["event_hash", "TEXT"], ["trial_id", "TEXT REFERENCES trials(trial_id)"]],
    machine_outputs: [["trial_id", "TEXT"], ["generated_utc", "TEXT"], ["monotonic_ns", "TEXT"], ["value_json", "TEXT"], ["region", "TEXT"], ["record_hash", "TEXT"], ["scheduled_utc", "TEXT"], ["scheduled_monotonic_ns", "TEXT"], ["actual_utc", "TEXT"], ["actual_monotonic_ns", "TEXT"], ["lateness_ms", "REAL"], ["timing_status", "TEXT"]],
    raw_report_drafts: [["saved_utc", "TEXT"], ["payload_json", "TEXT"]],
    raw_reports_locked: [["locked_utc", "TEXT"], ["payload_json", "TEXT"], ["lock_hash", "TEXT"], ["schema_version", "TEXT"]],
    late_annotations: [["session_id", "TEXT"], ["created_utc", "TEXT"], ["kind", "TEXT"], ["payload_json", "TEXT"], ["annotation_hash", "TEXT"]],
    profile_versions: [["config_json", "TEXT"], ["config_hash", "TEXT"], ["created_utc", "TEXT"], ["immutable", "INTEGER NOT NULL DEFAULT 1"]],
    audio_recipe_versions: [["config_json", "TEXT"], ["config_hash", "TEXT"], ["created_utc", "TEXT"], ["immutable", "INTEGER NOT NULL DEFAULT 1"]],
    calibrations: [["created_utc", "TEXT"], ["provider", "TEXT"], ["provider_version", "TEXT"], ["sample_count", "INTEGER"], ["counts_json", "TEXT"], ["statistics_json", "TEXT"], ["metadata_json", "TEXT"], ["result_hash", "TEXT"], ["integrity_status", "TEXT"]],
    analyses: [["analysis_version", "TEXT"], ["input_hash", "TEXT"], ["input_json", "TEXT"], ["payload_json", "TEXT"], ["created_utc", "TEXT"], ["analysis_hash", "TEXT"]],
     analysis_versions: [["input_json", "TEXT"]],
    integrity_metadata: [["verified_utc", "TEXT"], ["valid", "INTEGER"], ["details_json", "TEXT"]],
    backups: [["created_utc", "TEXT"], ["path", "TEXT"], ["sha256", "TEXT"], ["verified", "INTEGER"]],
    audio_health: [["recipe_id", "TEXT"], ["recipe_version", "INTEGER"], ["started_utc", "TEXT"], ["ended_utc", "TEXT"], ["duration_ms", "INTEGER"], ["sample_rate", "INTEGER"], ["base_latency", "REAL"], ["output_latency", "REAL"], ["generated_frames", "INTEGER"], ["continuity_json", "TEXT"], ["clipping", "INTEGER"], ["context_states_json", "TEXT"], ["owner_result", "TEXT"], ["owner_note", "TEXT"], ["result_hash", "TEXT"], ["integrity_status", "TEXT"]],
  };
  for (const [table, fields] of Object.entries(columns)) {
    if (!tableExists(db, table)) continue;
    for (const [column, definition] of fields) addColumn(db, table, column, definition);
  }
}

function ensureV12Columns(db) {
  const columns = {
    session_details: [["session_snapshot_json", "TEXT"], ["session_snapshot_hash", "TEXT"], ["timing_json", "TEXT"], ["scheduled_monotonic_ns", "TEXT"], ["scheduled_utc", "TEXT"], ["actual_start_monotonic_ns", "TEXT"], ["actual_start_utc", "TEXT"], ["actual_end_monotonic_ns", "TEXT"], ["actual_end_utc", "TEXT"], ["app_version", "TEXT"], ["engine_version", "TEXT"], ["audio_version", "TEXT"], ["output_hash", "TEXT"], ["final_fingerprint", "TEXT"], ["committed_audio_config_json", "TEXT"], ["committed_audio_config_hash", "TEXT"], ["final_stream_digest", "TEXT"], ["final_stream_frames", "INTEGER"], ["final_stream_format_json", "TEXT"]],
    machine_outputs: [["scheduled_monotonic_ns", "TEXT"], ["actual_monotonic_ns", "TEXT"]],
    analyses: [["analysis_hash", "TEXT"]],
    analysis_versions: [["input_json", "TEXT"]],
    audio_commits: [["telemetry_json", "TEXT"], ["stream_digest", "TEXT"], ["frame_count", "INTEGER"], ["format_json", "TEXT"]],
    audio_recipe_identities: [["identity_type", "TEXT"], ["identity_label", "TEXT"], ["provenance_json", "TEXT"], ["source_kind", "TEXT"], ["source_ref", "TEXT"], ["created_utc", "TEXT"]],
    audio_health_details: [["telemetry_json", "TEXT"], ["device_json", "TEXT"], ["environment_json", "TEXT"], ["digest", "TEXT"], ["format_json", "TEXT"], ["detail_hash", "TEXT"], ["created_utc", "TEXT"]],
    legacy_source_files: [["content_blob", "BLOB"]],
    profile_identities: [["identity_type", "TEXT"], ["identity_label", "TEXT"], ["provenance_json", "TEXT"], ["source_kind", "TEXT"], ["source_ref", "TEXT"], ["created_utc", "TEXT"]],
    profile_version_metadata: [["identity_id", "TEXT"], ["provenance_json", "TEXT"], ["status", "TEXT NOT NULL DEFAULT 'DRAFT'"], ["is_draft", "INTEGER NOT NULL DEFAULT 1"], ["is_active", "INTEGER NOT NULL DEFAULT 0"], ["parent_version", "INTEGER"], ["validation_json", "TEXT"], ["created_utc", "TEXT"]],
    audio_recipe_version_metadata: [["identity_id", "TEXT"], ["provenance_json", "TEXT"], ["status", "TEXT NOT NULL DEFAULT 'DRAFT'"], ["is_draft", "INTEGER NOT NULL DEFAULT 1"], ["is_active", "INTEGER NOT NULL DEFAULT 0"], ["incomplete", "INTEGER NOT NULL DEFAULT 0"], ["parent_version", "INTEGER"], ["validation_json", "TEXT"], ["created_utc", "TEXT"]],
  };
  for (const [table, fields] of Object.entries(columns)) {
    if (!tableExists(db, table)) continue;
    for (const [column, definition] of fields) addColumn(db, table, column, definition);
  }
}

function backfillSessionDetails(db) {
  db.prepare("INSERT OR IGNORE INTO session_details(session_id,session_snapshot_json,session_snapshot_hash,timing_json,app_version,engine_version,audio_version,created_utc) SELECT s.session_id,COALESCE(s.manifest_json,'{}'),?,NULL,'UNKNOWN','UNKNOWN','UNKNOWN',s.created_utc FROM sessions s WHERE s.session_id NOT IN (SELECT session_id FROM session_details)").run(sha256(canonical({})));
  for (const row of db.prepare("SELECT session_id,session_snapshot_json FROM session_details WHERE session_snapshot_hash IS NULL OR session_snapshot_hash='' OR session_snapshot_hash=?").all(sha256(canonical({})))) {
    const snapshot = json(row.session_snapshot_json, {});
    db.prepare("UPDATE session_details SET session_snapshot_hash=? WHERE session_id=?").run(sha256(canonical(snapshot)), row.session_id);
  }
  db.prepare("UPDATE session_details SET app_version=COALESCE(NULLIF(app_version,''),'UNKNOWN'),engine_version=COALESCE(NULLIF(engine_version,''),'UNKNOWN'),audio_version=COALESCE(NULLIF(audio_version,''),'UNKNOWN')").run();
}

function backfillVersionMetadata(db) {
  db.exec(`
    INSERT OR IGNORE INTO profile_identities(profile_id,identity_type,identity_label,provenance_json,source_kind,source_ref,created_utc)
    SELECT profile_id,'LEGACY',profile_id,JSON_OBJECT('source','pre-v12 schema'),'LEGACY_SCHEMA',profile_id,datetime('now') FROM experiment_profiles;
    INSERT OR IGNORE INTO audio_recipe_identities(recipe_id,identity_type,identity_label,provenance_json,source_kind,source_ref,created_utc)
    SELECT recipe_id,'LEGACY',recipe_id,JSON_OBJECT('source','pre-v12 schema'),'LEGACY_SCHEMA',recipe_id,datetime('now') FROM audio_recipes;
    INSERT OR IGNORE INTO profile_version_metadata(profile_id,version,identity_id,provenance_json,status,is_draft,is_active,parent_version,validation_json,created_utc)
    SELECT v.profile_id,v.version,v.profile_id,JSON_OBJECT('source','pre-v12 schema'),
      CASE WHEN v.version=(SELECT MAX(v2.version) FROM profile_versions v2 WHERE v2.profile_id=v.profile_id) THEN 'ACTIVE' ELSE 'INACTIVE' END,
      0,CASE WHEN v.version=(SELECT MAX(v2.version) FROM profile_versions v2 WHERE v2.profile_id=v.profile_id) THEN 1 ELSE 0 END,NULL,NULL,v.created_utc
    FROM profile_versions v;
    INSERT OR IGNORE INTO audio_recipe_version_metadata(recipe_id,version,identity_id,provenance_json,status,is_draft,is_active,incomplete,parent_version,validation_json,created_utc)
    SELECT v.recipe_id,v.version,v.recipe_id,JSON_OBJECT('source','pre-v12 schema'),
      CASE WHEN v.version=(SELECT MAX(v2.version) FROM audio_recipe_versions v2 WHERE v2.recipe_id=v.recipe_id) THEN 'ACTIVE' ELSE 'INACTIVE' END,
      0,CASE WHEN v.version=(SELECT MAX(v2.version) FROM audio_recipe_versions v2 WHERE v2.recipe_id=v.recipe_id) THEN 1 ELSE 0 END,0,NULL,NULL,v.created_utc
    FROM audio_recipe_versions v;
  `);
}

function backfillAnalysisData(db) {
  if (!tableExists(db, "analyses") || !tableExists(db, "analysis_versions")) return;
  const analyses = db.prepare("SELECT * FROM analyses ORDER BY session_id").all();
  const insertVersion = db.prepare("INSERT OR IGNORE INTO analysis_versions(analysis_id,session_id,version,analysis_version,input_hash,input_json,payload_json,analysis_hash,created_utc) VALUES(?,?,?,?,?,?,?,?,?)");
  const updateAnalysis = db.prepare("UPDATE analyses SET input_json=COALESCE(input_json,?),analysis_hash=COALESCE(analysis_hash,?) WHERE session_id=?");
  for (const row of analyses) {
    const payload = json(row.payload_json, null);
    const input = json(row.input_json, payload && Object.prototype.hasOwnProperty.call(payload, "input") ? payload.input : null);
    const analysisHash = row.analysis_hash || (payload === null ? null : sha256(canonical(payload)));
    if (row.input_json === null || row.analysis_hash === null) updateAnalysis.run(JSON.stringify(input), analysisHash, row.session_id);
    if (payload !== null && !db.prepare("SELECT 1 FROM analysis_versions WHERE session_id=?").get(row.session_id)) {
      insertVersion.run(`${row.session_id}-A1`, row.session_id, 1, row.analysis_version || "UNKNOWN", row.input_hash || sha256(canonical(input)), JSON.stringify(input), JSON.stringify(payload), analysisHash, row.created_utc || now());
    }
  }
}

function allowAnalysisBackfill(db) {
  db.exec("DROP TRIGGER IF EXISTS immutable_analysis_update; DROP TRIGGER IF EXISTS immutable_analysis_delete;");
}

function ensureIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_utc);
    CREATE INDEX IF NOT EXISTS idx_events_session ON evidence_events(session_id, seq);
    CREATE INDEX IF NOT EXISTS idx_outputs_session ON machine_outputs(session_id, output_seq);
    CREATE INDEX IF NOT EXISTS idx_calibration_time ON calibrations(created_utc);
    CREATE INDEX IF NOT EXISTS idx_transition_session ON transition_projections(session_id, seq);
    CREATE INDEX IF NOT EXISTS idx_health_observation ON audio_health_observations(diagnostic_id, observed_utc);
    CREATE INDEX IF NOT EXISTS idx_legacy_files_import ON legacy_source_files(import_id);
  `);
}

function ensureV13Indexes(db) {
  if (tableExists(db, "protocol_stage_events"))
    db.exec("CREATE INDEX IF NOT EXISTS idx_protocol_stage_session ON protocol_stage_events(session_id, stage_seq)");
}

function ensureTriggers(db) {
  const immutable = [
    ["immutable_events_update", "evidence_events", "UPDATE", "evidence_events are immutable"],
    ["immutable_events_delete", "evidence_events", "DELETE", "evidence_events are immutable"],
    ["immutable_commitment_update", "session_commitments", "UPDATE", "session commitments are immutable"],
    ["immutable_commitment_delete", "session_commitments", "DELETE", "session commitments are immutable"],
    ["immutable_reports_update", "raw_reports_locked", "UPDATE", "locked raw reports are immutable"],
    ["immutable_reports_delete", "raw_reports_locked", "DELETE", "locked raw reports are immutable"],
    ["immutable_outputs_update", "machine_outputs", "UPDATE", "machine outputs are immutable"],
    ["immutable_outputs_delete", "machine_outputs", "DELETE", "machine outputs are immutable"],
    ["immutable_profile_versions_update", "profile_versions", "UPDATE", "profile versions are immutable"],
    ["immutable_profile_versions_delete", "profile_versions", "DELETE", "profile versions are immutable"],
    ["immutable_recipe_versions_update", "audio_recipe_versions", "UPDATE", "audio recipe versions are immutable"],
    ["immutable_recipe_versions_delete", "audio_recipe_versions", "DELETE", "audio recipe versions are immutable"],
    ["immutable_calibrations_update", "calibrations", "UPDATE", "calibration history is immutable"],
    ["immutable_calibrations_delete", "calibrations", "DELETE", "calibration history is immutable"],
    ["immutable_calibration_details_update", "calibration_details", "UPDATE", "calibration details are immutable"],
    ["immutable_calibration_details_delete", "calibration_details", "DELETE", "calibration details are immutable"],
    ["immutable_audio_health_update", "audio_health", "UPDATE", "audio health history is immutable"],
    ["immutable_audio_health_delete", "audio_health", "DELETE", "audio health history is immutable"],
    ["immutable_health_observation_update", "audio_health_observations", "UPDATE", "audio health observations are immutable"],
    ["immutable_health_observation_delete", "audio_health_observations", "DELETE", "audio health observations are immutable"],
    ["immutable_annotations_update", "late_annotations", "UPDATE", "late annotations are immutable"],
    ["immutable_annotations_delete", "late_annotations", "DELETE", "late annotations are immutable"],
    ["immutable_transition_projection_update", "transition_projections", "UPDATE", "transition projections are immutable"],
    ["immutable_transition_projection_delete", "transition_projections", "DELETE", "transition projections are immutable"],
     ["immutable_transition_evidence_update", "transition_evidence", "UPDATE", "transition evidence is immutable"],
     ["immutable_transition_evidence_delete", "transition_evidence", "DELETE", "transition evidence is immutable"],
     ["immutable_timing_observation_update", "timing_observations", "UPDATE", "timing observations are immutable"],
     ["immutable_timing_observation_delete", "timing_observations", "DELETE", "timing observations are immutable"],
    ["immutable_output_finalization_update", "output_finalizations", "UPDATE", "output finalizations are immutable"],
    ["immutable_output_finalization_delete", "output_finalizations", "DELETE", "output finalizations are immutable"],
    ["immutable_audio_commit_update", "audio_commits", "UPDATE", "committed audio configuration is immutable"],
    ["immutable_audio_commit_delete", "audio_commits", "DELETE", "committed audio configuration is immutable"],
    ["immutable_analysis_update", "analyses", "UPDATE", "analysis results are immutable"],
    ["immutable_analysis_delete", "analyses", "DELETE", "analysis results are immutable"],
     ["immutable_profile_identity_update", "profile_identities", "UPDATE", "profile identities are immutable"],
     ["immutable_profile_identity_delete", "profile_identities", "DELETE", "profile identities are immutable"],
     ["immutable_recipe_identity_update", "audio_recipes", "UPDATE", "audio recipe identities are immutable"],
     ["immutable_recipe_identity_delete", "audio_recipes", "DELETE", "audio recipe identities are immutable"],
     ["immutable_recipe_identity_record_update", "audio_recipe_identities", "UPDATE", "audio recipe identities are immutable"],
     ["immutable_recipe_identity_record_delete", "audio_recipe_identities", "DELETE", "audio recipe identities are immutable"],
     ["immutable_health_details_update", "audio_health_details", "UPDATE", "audio health details are immutable"],
     ["immutable_health_details_delete", "audio_health_details", "DELETE", "audio health details are immutable"],
     ["immutable_backup_update", "backups", "UPDATE", "backup records are immutable"],
    ["immutable_backup_delete", "backups", "DELETE", "backup records are immutable"],
    ["immutable_backup_metadata_update", "backup_metadata", "UPDATE", "backup metadata is immutable"],
    ["immutable_backup_metadata_delete", "backup_metadata", "DELETE", "backup metadata is immutable"],
     ["immutable_legacy_import_delete", "legacy_imports", "DELETE", "legacy import records are immutable"],
     ["immutable_legacy_files_update", "legacy_source_files", "UPDATE", "legacy source files are immutable"],
     ["immutable_legacy_files_delete", "legacy_source_files", "DELETE", "legacy source files are immutable"],
    ["immutable_legacy_events_update", "legacy_events", "UPDATE", "legacy source evidence is immutable"],
    ["immutable_legacy_events_delete", "legacy_events", "DELETE", "legacy source evidence is immutable"],
    ["immutable_legacy_outputs_update", "legacy_outputs", "UPDATE", "legacy source outputs are immutable"],
    ["immutable_legacy_outputs_delete", "legacy_outputs", "DELETE", "legacy source outputs are immutable"],
    ["immutable_legacy_reports_update", "legacy_reports", "UPDATE", "legacy source reports are immutable"],
    ["immutable_legacy_reports_delete", "legacy_reports", "DELETE", "legacy source reports are immutable"],
    ["immutable_legacy_analyses_update", "legacy_analyses", "UPDATE", "legacy source analyses are immutable"],
    ["immutable_legacy_analyses_delete", "legacy_analyses", "DELETE", "legacy source analyses are immutable"],
      ["immutable_analysis_versions_update", "analysis_versions", "UPDATE", "analysis versions are immutable"],
      ["immutable_analysis_versions_delete", "analysis_versions", "DELETE", "analysis versions are immutable"],
      ["immutable_protocol_stage_events_update", "protocol_stage_events", "UPDATE", "protocol stage events are immutable"],
      ["immutable_protocol_stage_events_delete", "protocol_stage_events", "DELETE", "protocol stage events are immutable"],
      ["immutable_research_definition_delete", "research_definitions", "DELETE", "committed research definitions are immutable"],
      ["immutable_target_occurrences_update", "target_occurrences", "UPDATE", "target occurrences are immutable"],
      ["immutable_target_occurrences_delete", "target_occurrences", "DELETE", "target occurrences are immutable"],
      ["immutable_future_target_update", "future_target_events", "UPDATE", "future target events are immutable"],
      ["immutable_future_target_delete", "future_target_events", "DELETE", "future target events are immutable"],
      ["immutable_cross_session_analysis_update", "cross_session_analyses", "UPDATE", "cross-session analyses are immutable"],
      ["immutable_cross_session_analysis_delete", "cross_session_analyses", "DELETE", "cross-session analyses are immutable"],
      ["immutable_research_defaults_delete", "research_defaults", "DELETE", "research defaults are immutable history"],
  ];
  for (const [name, table, action, message] of immutable) {
    if (tableExists(db, table)) immutableTrigger(db, name, table, action, message);
  }
  if (tableExists(db, "research_definitions"))
    immutableTrigger(db, "immutable_research_definition_update", "research_definitions", "UPDATE", "committed research definitions are immutable", " WHEN OLD.committed=1");
  if (tableExists(db, "legacy_imports")) {
    immutableTrigger(db, "immutable_legacy_import_final_update", "legacy_imports", "UPDATE", "legacy import records are immutable", " WHEN OLD.source_integrity_status <> 'PENDING'");
  }
}

export function migrateConnection(db) {
  applyPragmas(db);
  ensureAudioHealthTable(db);
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_utc TEXT NOT NULL)");
  createBaseTables(db);
  ensureBaseColumns(db);
  const migrationVersion = () => Number(db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get().version);
  const migrationApplied = (version) => Boolean(db.prepare("SELECT 1 FROM schema_migrations WHERE version=?").get(version));
  const mark = (version) => db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_utc) VALUES(?, ?)").run(version, now());
  const apply = (version, callback) => {
    if (migrationApplied(version)) return;
    db.transaction(() => {
      callback();
      mark(version);
    })();
  };

  // Each version is recorded independently. This also repairs a database left
  // with a partially populated migration table after a power or process loss.
  apply(1, () => {
    createBaseTables(db);
    ensureBaseColumns(db);
  });
  apply(2, () => {
    addColumn(db, "evidence_events", "trial_id", "TEXT REFERENCES trials(trial_id)");
    db.prepare("UPDATE evidence_events SET trial_id=(SELECT trial_id FROM trials WHERE trials.session_id=evidence_events.session_id ORDER BY trial_seq LIMIT 1) WHERE trial_id IS NULL").run();
  });
  apply(3, () => {
    addColumn(db, "machine_outputs", "scheduled_utc", "TEXT");
    addColumn(db, "machine_outputs", "actual_utc", "TEXT");
    addColumn(db, "machine_outputs", "lateness_ms", "REAL");
    addColumn(db, "machine_outputs", "timing_status", "TEXT");
    db.exec("CREATE TABLE IF NOT EXISTS audio_health(diagnostic_id TEXT PRIMARY KEY,recipe_id TEXT,recipe_version INTEGER,started_utc TEXT,ended_utc TEXT,duration_ms INTEGER,sample_rate INTEGER,base_latency REAL,output_latency REAL,generated_frames INTEGER,continuity_json TEXT,clipping INTEGER,context_states_json TEXT,owner_result TEXT,owner_note TEXT,result_hash TEXT,integrity_status TEXT)");
  });
  apply(4, () => {
    ensureAudioHealthTable(db);
  });
  apply(5, () => ensureV12Tables(db));
  apply(6, () => {
    ensureV12Tables(db);
    ensureV12Columns(db);
  });
  apply(7, () => backfillVersionMetadata(db));
  apply(8, () => ensureIndexes(db));
  apply(9, () => {
    ensureV12Tables(db);
    ensureV12Columns(db);
  });
  apply(10, () => ensureTriggers(db));
  apply(11, () => ensureIndexes(db));
  apply(12, () => {
    ensureV12Tables(db);
    ensureV12Columns(db);
    ensureIndexes(db);
    allowAnalysisBackfill(db);
  });
  apply(13, () => {
    ensureV12Tables(db);
    ensureV12Columns(db);
    ensureV13Tables(db);
    ensureV13Columns(db);
    ensureIndexes(db);
    ensureV13Indexes(db);
  });
  apply(14, () => {
    ensureV14Tables(db);
    ensureV14Columns(db);
    ensureV14Indexes(db);
  });

  // A failed process can leave objects created just before a migration marker.
  ensureV12Tables(db);
  ensureV12Columns(db);
  ensureV13Tables(db);
  ensureV13Columns(db);
  ensureV13Indexes(db);
  ensureV14Tables(db);
  ensureV14Columns(db);
  ensureV14Indexes(db);
  backfillSessionIdSequence(db);
  backfillSessionDetails(db);
  backfillVersionMetadata(db);
  allowAnalysisBackfill(db);
  backfillAnalysisData(db);
  ensureTriggers(db);
  ensureIndexes(db);
  return migrationVersion();
}

function profileDto(row, includeConfig = true) {
  const config = json(row.config_json, {});
  return {
    ...(includeConfig ? config : {}),
    id: row.profile_id,
    version: row.version,
    name: config.name || row.name,
    // Keep the version's material provenance intact.  The identity table's
    // provenance is repository metadata and must not rewrite the immutable
    // configuration (doing so invalidates its canonical hash).
    provenance: config.provenance ?? row.provenance ?? null,
    repositoryProvenance: row.provenance ?? null,
    status: row.status || "ACTIVE",
    isDraft: Boolean(row.is_draft),
    isActive: Boolean(row.is_active),
    configHash: row.config_hash,
    identity: json(row.identity_json, null),
  };
}

function recipeDto(row, includeConfig = true) {
  const config = json(row.config_json, {});
  const versionMetadata = json(row.provenance_json, {});
  let effective = config;
  try {
    effective = normalizeRecipe(config);
  } catch {
    // Preserve a redacted/inspectable DTO for legacy rows that predate the
    // complete recipe contract; validation gates below remain conservative.
    try { effective = normalizeRecipe(config, { developmentFixture: true }); }
    catch { effective = config; }
  }
  const validation = (() => {
    try { return validateRecipe(effective); } catch { return { valid: false, errors: ["recipe normalization failed"] }; }
  })();
  const provenanceValidation = (() => {
    try { return validateRecipeProvenance(effective); } catch { return { valid: false, errors: ["recipe provenance validation failed"], summary: { provenanceEligible: false } }; }
  })();
  const metadataValidation = json(row.validation_json, {}) || {};
  const engineeringVerification = resolveEngineeringVerification(
    effective,
    config.engineeringVerification || versionMetadata.engineeringVerification,
    { valid: validation.valid && provenanceValidation.valid && metadataValidation.valid !== false },
  );
  const repositoryActive = String(row.status || "ACTIVE").toUpperCase() === "ACTIVE" && Boolean(row.is_active) && !Boolean(row.is_draft);
  const formalEligible = repositoryActive && !Boolean(row.incomplete) && validation.valid && provenanceValidation.valid && provenanceValidation.summary.provenanceEligible === true && effective.formalEligibility !== false && engineeringVerification.status === "PASS";
  const formalEligibilityReason = formalEligible
    ? "Immutable active version, valid configuration, complete provenance, and current reference verification gates passed."
    : !repositoryActive
      ? "Version is not active; formal sessions require an active immutable version."
      : row.incomplete || !validation.valid
        ? "Recipe is incomplete or failed configuration validation."
        : !provenanceValidation.valid || provenanceValidation.summary.provenanceEligible !== true
          ? "Recipe provenance is invalid or contains UNKNOWN_BLOCKED parameters."
          : engineeringVerification.status === "STALE"
            ? "Engineering verification is stale after a material recipe change."
            : engineeringVerification.status !== "PASS"
              ? "Current reference verification has not been run for this effective recipe."
              : effective.formalEligibilityReason || "Formal use is blocked by repository policy.";
  return {
    ...(includeConfig ? effective : {}),
    recipeId: row.recipe_id,
    id: row.recipe_id,
    version: row.version,
    // The recipe version is immutable evidence.  Preserve its material
    // provenance; expose the identity-level provenance separately instead of
    // mutating the effective recipe returned to callers.
    provenance: config.provenance ?? row.provenance ?? null,
    repositoryProvenance: row.provenance ?? null,
    status: row.status || "ACTIVE",
    isDraft: Boolean(row.is_draft),
    isActive: Boolean(row.is_active),
    incomplete: Boolean(row.incomplete),
    configHash: row.config_hash,
    parameterProvenance: effective.parameterProvenance || versionMetadata.parameterProvenance || {},
    provenanceEligibility: provenanceValidation.summary?.provenanceEligible === true,
    provenanceAudit: effective.provenanceAudit || versionMetadata.provenanceAudit || null,
    historicalStatus: effective.historicalStatus || "NOT_HISTORICALLY_EXACT",
    historicalExactness: effective.historicalExactness || "NOT_CLAIMED",
    formalEligibility: formalEligible,
    formalEligibilityReason,
    activeLayers: activeLayers(effective),
    engineeringVerification,
  };
}

export class MipDatabase {
  constructor(userData) {
    this.userData = userData;
    this.root = path.join(userData, "MIP");
    this.dataDir = path.join(this.root, "data");
    this.backupDir = path.join(this.root, "backups");
    this.exportDir = path.join(this.root, "exports");
    this.logsDir = path.join(this.root, "logs");
    for (const dir of [this.dataDir, this.backupDir, this.exportDir, this.logsDir]) fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(this.dataDir, "mip.sqlite3");
    this.db = new Database(this.file);
    migrateConnection(this.db);
    this.seedProfiles();
    this.seedRecipes();
    this.sessions = new SessionRepository(this);
    this.evidence = new EvidenceRepository(this);
    this.profiles = new ProfileRepository(this);
    this.recipes = new AudioRecipeRepository(this);
    this.calibrations = new CalibrationRepository(this);
    this.audioHealth = new AudioHealthRepository(this);
    this.analyses = new AnalysisRepository(this);
    this.research = new ResearchRepository(this);
    this.integrity = new IntegrityService(this);
    this.backups = new BackupService(this);
    this.legacyImporter = new LegacyImporter(this);
    this.exporter = new SessionExporter(this);
  }

  migrate() {
    return migrateConnection(this.db);
  }

  get schemaVersion() {
    return Number(this.db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get().version);
  }

  reopen() {
    if (this.db.open) this.db.close();
    this.db = new Database(this.file);
    migrateConnection(this.db);
    this.seedProfiles();
    this.seedRecipes();
    this.sessions = new SessionRepository(this);
    this.evidence = new EvidenceRepository(this);
    this.profiles = new ProfileRepository(this);
    this.recipes = new AudioRecipeRepository(this);
    this.calibrations = new CalibrationRepository(this);
    this.audioHealth = new AudioHealthRepository(this);
    this.analyses = new AnalysisRepository(this);
    this.research = new ResearchRepository(this);
    this.integrity = new IntegrityService(this);
    this.backups = new BackupService(this);
    this.legacyImporter = new LegacyImporter(this);
    this.exporter = new SessionExporter(this);
    return this;
  }

  seedProfiles() {
    const insertProfile = this.db.prepare("INSERT OR IGNORE INTO experiment_profiles(profile_id,name,provenance) VALUES(?,?,?)");
    const insertVersion = this.db.prepare("INSERT OR IGNORE INTO profile_versions(profile_id,version,config_json,config_hash,created_utc,immutable) VALUES(?,?,?,?,?,1)");
    const insertIdentity = this.db.prepare("INSERT OR IGNORE INTO profile_identities(profile_id,identity_type,identity_label,provenance_json,source_kind,source_ref,created_utc) VALUES(?,?,?,?,?,?,?)");
    const insertMeta = this.db.prepare("INSERT OR IGNORE INTO profile_version_metadata(profile_id,version,identity_id,provenance_json,status,is_draft,is_active,parent_version,validation_json,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?)");
    for (const profile of Object.values(profiles)) {
      const config = clone(profile);
      insertProfile.run(profile.id, profile.name, "MIP built-in");
      insertVersion.run(profile.id, profile.version, JSON.stringify(config), sha256(canonical(config)), now());
      insertIdentity.run(profile.id, "BUILT_IN", profile.name, JSON.stringify({ source: "engine.profiles" }), "BUILT_IN", profile.id, now());
      const identity = this.db.prepare("SELECT profile_id FROM profile_identities WHERE profile_id=?").get(profile.id);
      insertMeta.run(profile.id, profile.version, identity?.profile_id || profile.id, JSON.stringify({ source: "engine.profiles" }), "ACTIVE", 0, 1, null, JSON.stringify({ valid: true, errors: [] }), now());
    }
  }

  seedRecipes() {
    const insertRecipe = this.db.prepare("INSERT OR IGNORE INTO audio_recipes(recipe_id,provenance) VALUES(?,?)");
    const insertIdentity = this.db.prepare("INSERT OR IGNORE INTO audio_recipe_identities(recipe_id,identity_type,identity_label,provenance_json,source_kind,source_ref,created_utc) VALUES(?,?,?,?,?,?,?)");
    const insertVersion = this.db.prepare("INSERT OR IGNORE INTO audio_recipe_versions(recipe_id,version,config_json,config_hash,created_utc,immutable) VALUES(?,?,?,?,?,1)");
    const insertMeta = this.db.prepare("INSERT OR IGNORE INTO audio_recipe_version_metadata(recipe_id,version,identity_id,provenance_json,status,is_draft,is_active,parent_version,validation_json,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?)");
    for (const recipe of [...Object.values(PRESETS), ...Object.values(EXPERIMENTAL_PRESETS)]) {
      const config = { ...clone(recipe), recipeId: recipe.id };
      const recipeValidation = validateRecipe(config);
      config.engineeringVerification = bindEngineeringVerification(
        recipeValidation.recipe || config,
        config.engineeringVerification,
        { valid: recipeValidation.valid },
      );
      insertRecipe.run(recipe.id, recipe.provenance || "MIP built-in");
      insertIdentity.run(recipe.id, recipe.id === "MIP_LAYERED_EXPERIMENTAL_V1" ? "EXPERIMENTAL_FIXTURE" : "BUILT_IN", recipe.name || recipe.id, JSON.stringify({ source: recipe.id === "MIP_LAYERED_EXPERIMENTAL_V1" ? "audio.EXPERIMENTAL_PRESETS" : "audio.PRESETS", historicalStatus: recipe.historicalStatus, parameterProvenance: recipe.parameterProvenance }), recipe.id === "MIP_LAYERED_EXPERIMENTAL_V1" ? "MIP_RECONSTRUCTION" : "BUILT_IN", recipe.id, now());
      insertVersion.run(recipe.id, recipe.version, JSON.stringify(config), sha256(canonical(config)), now());
      insertMeta.run(recipe.id, recipe.version, recipe.id, JSON.stringify({ source: recipe.id === "MIP_LAYERED_EXPERIMENTAL_V1" ? "audio.EXPERIMENTAL_PRESETS" : "audio.PRESETS", parameterProvenance: config.parameterProvenance, engineeringVerification: config.engineeringVerification }), "ACTIVE", 0, 1, null, JSON.stringify({ valid: recipeValidation.valid, errors: recipeValidation.errors || [] }), now());
    }
  }

  profileList(options = {}) { return this.profiles.list(options); }
  recipeList(options = {}) { return this.recipes.list(options); }
  calibrationList(options = {}) { return this.calibrations.list(options); }
  audioHealthList(options = {}) { return this.audioHealth.list(options); }
  listSessions(options = {}) { return this.sessions.listRedacted(options); }

  /** Persist a transition through the authoritative session graph. */
  persistTransition(sessionId, to, context = {}, options = {}) {
    const row = this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId);
    if (!row) throw new Error(`Session not found: ${sessionId}`);
    const trialId = context.trialId ?? this.sessions.trials(sessionId)[0]?.trialId ?? null;
    const controller = new SessionController(row.status, { sessionId, trialId });
    if (!controller.canTransition(to, context))
      throw new Error(`Illegal or incomplete session transition ${row.status} -> ${to}`);
    const from = row.status;
    const payload = { ...(context.payload || {}), ...(context.evidence || {}), from, to };
    let event;
    let projection;
    this.db.transaction(() => {
      options.before?.();
      event = this.evidence.appendEvent(sessionId, trialId, context.eventType || `SESSION_${to}`, payload);
      projection = this.evidence.projectTransition(sessionId, trialId, from, to, {
        eventId: event.eventId,
        occurredUtc: event.occurredUtc,
        monotonicNs: event.monotonicNs,
      });
      this.sessions.setStatus(sessionId, to, options.recoveryState ?? null);
      if (trialId) this.db.prepare("UPDATE trials SET state=? WHERE trial_id=?").run(to, trialId);
      this.evidence.addTransitionEvidence(sessionId, {
        trialId,
        projectionId: projection.projectionId,
        evidenceEventId: event.eventId,
        evidenceType: to,
        evidence: options.evidence || {},
      });
    })();
    return { state: to, from, event, projection };
  }
  nextSessionId() {
    const sequence = this.db.prepare("SELECT next_value FROM session_id_sequence WHERE sequence_id=1").get();
    if (sequence && Number.isSafeInteger(Number(sequence.next_value)))
      return `S${String(Math.max(3, Number(sequence.next_value))).padStart(4, "0")}`;
    return "S0003";
  }

  _allocateSessionId() {
    const row = this.db.prepare("UPDATE session_id_sequence SET next_value=next_value+1 WHERE sequence_id=1 RETURNING next_value-1 AS allocated").get();
    const allocated = Number(row?.allocated);
    if (!Number.isSafeInteger(allocated) || allocated < 3) throw new Error("Session ID allocator is unavailable.");
    return `S${String(allocated).padStart(4, "0")}`;
  }

  beginSession(profile, participant = "Local participant", recordType = "dry", material = {}) {
    if (!profile?.id) throw new Error("A persisted profile is required");
    const requestedVersion = profile.version === undefined || profile.version === null ? null : Number(profile.version);
    const profileRow = requestedVersion === null
      ? this.db.prepare("SELECT config_json FROM profile_versions WHERE profile_id=? AND version=(SELECT MAX(version) FROM profile_versions WHERE profile_id=?)").get(profile.id, profile.id)
      : this.db.prepare("SELECT config_json FROM profile_versions WHERE profile_id=? AND version=?").get(profile.id, requestedVersion);
    if (!profileRow) throw new Error(`Profile version is not available in SQLite: ${profile.id} v${requestedVersion ?? "active"}`);
    const persistedProfile = json(profileRow.config_json, null);
    if (!persistedProfile) throw new Error(`Persisted profile is invalid: ${profile.id}`);
    profile = persistedProfile;
    const deferredCommit = material.deferCommit === true;
    const created = now();
    const snapshot = { ...clone(profile), material: clone(material) };
    const config = JSON.stringify(snapshot);
    const configHash = sha256(canonical(snapshot));
    const objective = material.objective === undefined || material.objective === null ? null : JSON.stringify(material.objective);
    const target = material.participantTarget === undefined || material.participantTarget === null ? null : String(material.participantTarget);
    const timing = material.timing || profile.timing || null;
    const scheduledUtc = material.scheduledUtc ?? timing?.scheduledUtc ?? null;
    const scheduledMonotonicNs = material.scheduledMonotonicNs ?? timing?.scheduledMonotonicNs ?? null;
    const suppliedDefinition = material.researchDefinition || {};
    const suppliedEndpoint = suppliedDefinition.primaryEndpoint || profile.analysis?.primaryEndpoint || "EXACT_SLOT";
    const suppliedAnalysis = normalizeTemporalAnalysisPlan(suppliedDefinition.temporalAnalysis || profile.analysis || {});
    const suppliedWindows = suppliedAnalysis.windows || [];
    const suppliedPrimaryWindow = suppliedWindows.find((window) => window.id === suppliedAnalysis.primaryWindowId) || suppliedWindows[0] || {};
    const suppliedHasDuration = suppliedWindows.some((window) => window.enabled !== false && (Number(window.preMs || 0) > 0 || Number(window.postMs || 0) > 0));
    const suppliedIntervalMs = Number(suppliedAnalysis.intervalMs ?? profile.output?.intervalMs ?? 1);
    const fallbackTargetSequence = suppliedEndpoint === "EXACT_SLOT"
      ? suppliedHasDuration && Number.isFinite(suppliedIntervalMs) && suppliedIntervalMs > 0
        ? Math.ceil(Number(suppliedPrimaryWindow.preMs || 0) / suppliedIntervalMs)
        : Number(profile.output?.preBlocks || 0) * Number(profile.output?.blockSize || 1)
      : null;
    let id = null;
    let trial = null;
    const tx = this.db.transaction(() => {
      // Allocation and insertion happen in the same SQLite transaction.  If a
      // historical database already contains the candidate, advance and retry
      // without ever reusing a reserved identifier.
      for (let attempt = 0; attempt < 32; attempt += 1) {
        id = this._allocateSessionId();
        trial = `${id}-T001`;
        try {
          this.db.prepare("INSERT INTO sessions(session_id,created_utc,participant_label,record_type,profile_id,profile_version,status,reveal_policy,recovery_state,manifest_json,hidden_objective,participant_target) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(id, created, participant, recordType, profile.id, profile.version ?? null, deferredCommit ? "DRAFT" : "COMMITTED", profile.reveal?.policy || null, null, config, objective, target);
          break;
        } catch (error) {
          if (!/UNIQUE|PRIMARY KEY|constraint/i.test(String(error?.message || error)) || attempt === 31) throw error;
        }
      }
      this.db.prepare("INSERT INTO trials(trial_id,session_id,trial_seq,trial_type,config_json,state) VALUES(?,?,?,?,?,?)").run(trial, id, 1, "REQUEST_IMMEDIATE_STREAM", JSON.stringify(profile.output || {}), deferredCommit ? "DRAFT" : "COMMITTED");
      this.db.prepare("INSERT INTO session_details(session_id,session_snapshot_json,session_snapshot_hash,timing_json,scheduled_monotonic_ns,scheduled_utc,app_version,engine_version,audio_version,created_utc) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id, config, configHash, timing ? JSON.stringify(timing) : null, scheduledMonotonicNs, scheduledUtc, material.appVersion || APP_VERSION, material.engineVersion || ENGINE_VERSION, material.audio?.audioVersion || AUDIO_VERSION, created);
      this.db.prepare("UPDATE session_details SET audio_session_nonce=?,protocol_anchor_json=? WHERE session_id=?")
        .run(material.audioNonce || null, material.protocolAnchor ? JSON.stringify(material.protocolAnchor) : null, id);
      if (!deferredCommit) {
        this.db.prepare("INSERT INTO session_commitments(session_id,canonical_config,config_hash,committed_utc) VALUES(?,?,?,?)").run(id, config, configHash, created);
        if (material.audio) this.commitAudioConfig(id, material.audio, { withinTransaction: true });
        this.appendEvent(id, trial, "COMMITTED", { configHash, profileId: profile.id, profileVersion: profile.version, rng: material.rng, recipe: material.audio, timing });
      } else {
        this.appendEvent(id, trial, "DRAFT_CREATED", { profileId: profile.id, profileVersion: profile.version });
      }
      // Keep the session row, immutable snapshot, and normalized research
      // definition in one SQLite transaction. A validation or persistence
      // failure must not leave an orphaned session without its protocol
      // definition.
      const persistedDefinition = this.research.saveDefinition(id, {
        ...suppliedDefinition,
        mode: suppliedDefinition.mode || profile.mode || "INFLUENCE",
        outcomeSpace: suppliedDefinition.outcomeSpace || profile.outcomeSpace,
        profileId: profile.id,
        profileVersion: profile.version,
        rng: suppliedDefinition.rng || material.rng,
        targetDefinition: suppliedDefinition.targetDefinition || {
          mode: suppliedDefinition.mode || profile.mode || "INFLUENCE",
          anchor: material.targetAnchor || timing?.anchor || ((suppliedDefinition.mode || profile.mode) === "FUTURE_TARGET" ? "ABSOLUTE_UTC" : "PARTICIPANT_REQUEST"),
          targetSequence: material.targetSequence ?? fallbackTargetSequence,
          scheduledUtc,
          scheduledMonotonicNs,
          semantics: suppliedDefinition.targetSemantics,
        },
        outputCadence: suppliedDefinition.outputCadence || profile.analysis?.outputCadence || "FIXED_INTERVAL",
        primaryEndpoint: suppliedEndpoint,
        temporalAnalysis: suppliedDefinition.temporalAnalysis || profile.analysis || {},
        revealPolicy: suppliedDefinition.revealPolicy || profile.reveal?.policy || "AFTER_RAW_REPORT_LOCK",
      }, { committed: !deferredCommit });
      if (!deferredCommit && persistedDefinition?.mode === "FUTURE_TARGET") {
        const prediction = persistedDefinition.definition?.targetDefinition?.prediction ?? null;
        this.appendEvent(id, trial, "PREDICTION_LOCKED", {
          predictionCommitted: prediction !== null && prediction !== undefined,
          scheduledUtc: persistedDefinition.definition?.targetDefinition?.scheduledUtc || null,
        });
      }
    });
    tx();
    return { id, sessionId: id, trial, trialId: trial, configHash, status: deferredCommit ? "DRAFT" : "COMMITTED", deferredCommit };
  }

  commitDraftSession(sessionId, details = {}) {
    const row = this.db.prepare("SELECT * FROM sessions WHERE session_id=?").get(sessionId);
    if (!row) throw new Error(`Session not found: ${sessionId}`);
    if (!["DRAFT", "TARGET_ASSIGNED"].includes(row.status)) throw new Error(`Session ${sessionId} is not a draft or target-assigned draft.`);
    const sessionDetails = this.db.prepare("SELECT * FROM session_details WHERE session_id=?").get(sessionId);
    const snapshot = json(sessionDetails?.session_snapshot_json, null);
    if (!snapshot) throw new Error(`Session ${sessionId} has no immutable draft snapshot.`);
    const committedUtc = now();
    const configHash = sha256(canonical(snapshot));
    const audio = snapshot.material?.audio || null;
    const tx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO session_commitments(session_id,canonical_config,config_hash,committed_utc) VALUES(?,?,?,?)").run(sessionId, JSON.stringify(snapshot), configHash, committedUtc);
      if (audio) this.commitAudioConfig(sessionId, audio, { withinTransaction: true });
      this.db.prepare("UPDATE session_details SET memory_confirmed_utc=?,baseline_json=?,environment_json=?,safety_json=? WHERE session_id=?")
        .run(details.memoryConfirmedUtc || committedUtc, details.baseline === undefined ? null : JSON.stringify(details.baseline), details.environment === undefined ? null : JSON.stringify(details.environment), details.safety === undefined ? null : JSON.stringify(details.safety), sessionId);
      // Commit the normalized research definition in the same transaction as
      // the immutable session commitment and audio configuration.  A process
      // loss cannot leave a formally committed session with a draft research
      // definition.
      if (this.research) {
        const committedDefinition = this.research.commitDefinition(sessionId, { committedUtc });
        if (committedDefinition?.mode === "FUTURE_TARGET" && !this.db.prepare("SELECT 1 FROM evidence_events WHERE session_id=? AND event_type='PREDICTION_LOCKED'").get(sessionId)) {
          this.appendEvent(sessionId, this.db.prepare("SELECT trial_id FROM trials WHERE session_id=? ORDER BY trial_seq LIMIT 1").get(sessionId)?.trial_id || null, "PREDICTION_LOCKED", {
            predictionCommitted: committedDefinition.definition?.targetDefinition?.prediction !== null && committedDefinition.definition?.targetDefinition?.prediction !== undefined,
            scheduledUtc: committedDefinition.definition?.targetDefinition?.scheduledUtc || null,
          });
        }
      }
    });
    tx();
    return { sessionId, configHash, committedUtc, status: "COMMITTED" };
  }

  saveReportDraft(sessionId, report = {}) {
    const savedUtc = now();
    this.db.prepare("INSERT INTO raw_report_drafts(session_id,saved_utc,payload_json) VALUES(?,?,?) ON CONFLICT(session_id) DO UPDATE SET saved_utc=excluded.saved_utc,payload_json=excluded.payload_json").run(sessionId, savedUtc, JSON.stringify(report));
    return { sessionId, savedUtc, report: clone(report) };
  }

  lockRawReport(sessionId, report = {}, schemaVersion = "1.0") {
    if (this.db.prepare("SELECT 1 FROM raw_reports_locked WHERE session_id=?").get(sessionId)) throw new Error("Raw report is already locked");
    const lockedUtc = now();
    const payloadJson = JSON.stringify(clone(report));
    const lockHash = sha256(payloadJson);
    const current = this.db.prepare("SELECT status,reveal_policy FROM sessions WHERE session_id=?").get(sessionId);
    if (!current) throw new Error(`Session not found: ${sessionId}`);
    const researchMeta = this.db.prepare("SELECT mode,primary_endpoint,outcome_space_json,temporal_analysis_json FROM research_definitions WHERE session_id=?").get(sessionId) || null;
    const temporalGate = requiresStrictResearchGate(researchMeta);
    if (current.reveal_policy && current.reveal_policy !== "AFTER_RAW_REPORT_LOCK" && !temporalGate)
      throw new Error(`Reveal policy ${current.reveal_policy} is not implemented by the report-lock gate.`);
    // The historical synchronous database facade was used by v1 fixtures to
    // lock a report immediately after writing output, without driving the
    // Electron audio lifecycle. Preserve that import/test compatibility path
    // explicitly and mark it as a legacy projection; production IPC always
    // uses the strict RETURNED -> RAW_REPORT_LOCKED transition below.
    if (current.status === "ABORTED") {
      this.db.transaction(() => {
        this.db.prepare("INSERT INTO raw_reports_locked(session_id,locked_utc,payload_json,lock_hash,schema_version) VALUES(?,?,?,?,?)").run(sessionId, lockedUtc, payloadJson, lockHash, schemaVersion);
        this.db.prepare("DELETE FROM raw_report_drafts WHERE session_id=?").run(sessionId);
        this.evidence.appendEvent(sessionId, null, "RAW_REPORT_LOCKED_AFTER_ABORT", { lockHash, schemaVersion, evidenceAborted: true });
        if (temporalGate)
          this.research.updatePhases(sessionId, { reportStatus: "LOCKED", revealStatus: "BLOCKED", sessionLifecycle: "ABORTED" });
      })();
      return { sessionId, lockedUtc, lockHash, schemaVersion, revealEligible: false, compatibility: "evidence-aborted" };
    }
    if (!["RETURNED", "RAW_REPORT_DRAFT"].includes(current.status)) {
      if (temporalGate)
        throw new Error("Temporal research reports must use the strict evidence-aware report-lock transaction.");
      this.db.transaction(() => {
        this.db.prepare("INSERT INTO raw_reports_locked(session_id,locked_utc,payload_json,lock_hash,schema_version) VALUES(?,?,?,?,?)").run(sessionId, lockedUtc, payloadJson, lockHash, schemaVersion);
        this.db.prepare("DELETE FROM raw_report_drafts WHERE session_id=?").run(sessionId);
        this.evidence.appendEvent(sessionId, null, "RAW_REPORT_LOCKED_LEGACY_FACADE", { lockHash, source: "legacy-database-facade" });
        this.sessions.setStatus(sessionId, "REVEAL_ELIGIBLE");
      })();
      return { sessionId, lockedUtc, lockHash, schemaVersion, compatibility: "legacy-database-facade" };
    }
    this.persistTransition(sessionId, "RAW_REPORT_LOCKED", {
      rawReportLocked: true,
      lockHash,
      eventType: "RAW_REPORT_LOCKED",
      payload: { lockHash, schemaVersion },
    }, {
      before: () => {
        this.db.prepare("INSERT INTO raw_reports_locked(session_id,locked_utc,payload_json,lock_hash,schema_version) VALUES(?,?,?,?,?)").run(sessionId, lockedUtc, payloadJson, lockHash, schemaVersion);
        this.db.prepare("DELETE FROM raw_report_drafts WHERE session_id=?").run(sessionId);
      },
      evidence: { lockHash },
    });
    const eligible = !temporalGate || this.research.revealGate(sessionId).eligible;
    if (eligible) {
      this.persistTransition(sessionId, "REVEAL_ELIGIBLE", {
        revealEligible: true,
        eventType: "REVEAL_ELIGIBLE",
        payload: { rawReportLocked: true, gate: temporalGate ? "FULL_RESEARCH_GATE" : "RAW_REPORT_LOCKED" },
      }, { evidence: { gate: temporalGate ? "FULL_RESEARCH_GATE" : "RAW_REPORT_LOCKED" } });
    }
    if (temporalGate) this.research.updatePhases(sessionId, { reportStatus: "LOCKED", revealStatus: eligible ? "ELIGIBLE" : "BLOCKED" });
    return { sessionId, lockedUtc, lockHash, schemaVersion, revealEligible: eligible };
  }

  /**
   * Strict Electron report-lock transaction.  Report insertion, draft
   * deletion, both lifecycle projections, and their evidence events commit as
   * one SQLite unit.  A retry after a completed lock is idempotent and never
   * replaces the immutable payload.
   */
  lockRawReportAtomic(sessionId, report = {}, schemaVersion = "1.0") {
    const session = this.db.prepare("SELECT status,reveal_policy FROM sessions WHERE session_id=?").get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const researchMeta = this.db.prepare("SELECT mode,primary_endpoint,outcome_space_json,temporal_analysis_json FROM research_definitions WHERE session_id=?").get(sessionId) || null;
    const temporalGate = requiresStrictResearchGate(researchMeta);
    if (session.reveal_policy && session.reveal_policy !== "AFTER_RAW_REPORT_LOCK" && !temporalGate)
      throw new Error(`Reveal policy ${session.reveal_policy} is not implemented by the report-lock gate.`);
    const existing = this.db.prepare("SELECT locked_utc,lock_hash,schema_version FROM raw_reports_locked WHERE session_id=?").get(sessionId);
    if (existing) {
      const eligible = ["REVEAL_ELIGIBLE", "REVEALED", "COMPLETE"].includes(session.status);
      // A process can commit the immutable report row and lose power before
      // the projection/event edge is written. Retrying the same lock request
      // repairs only that missing lifecycle edge; it never replaces the
      // locked payload or hash.
      if (!eligible && ["RETURNED", "RAW_REPORT_DRAFT", "RAW_REPORT_LOCKED"].includes(session.status)) {
        const trialId = this.sessions.trials(sessionId)[0]?.trialId || null;
        const appendEdge = (from, to, eventType, payload, evidence) => {
          const event = this.evidence.appendEvent(sessionId, trialId, eventType, payload);
          const projection = this.evidence.projectTransition(sessionId, trialId, from, to, { eventId: event.eventId, occurredUtc: event.occurredUtc, monotonicNs: event.monotonicNs });
          this.sessions.setStatus(sessionId, to);
          if (trialId) this.db.prepare("UPDATE trials SET state=? WHERE trial_id=?").run(to, trialId);
          this.evidence.addTransitionEvidence(sessionId, { trialId, projectionId: projection.projectionId, evidenceEventId: event.eventId, evidenceType: to, evidence });
        };
        this.db.transaction(() => {
          this.db.prepare("DELETE FROM raw_report_drafts WHERE session_id=?").run(sessionId);
          if (["RETURNED", "RAW_REPORT_DRAFT"].includes(session.status))
            appendEdge(session.status, "RAW_REPORT_LOCKED", "RAW_REPORT_LOCKED", { lockHash: existing.lock_hash, schemaVersion: existing.schema_version }, { lockHash: existing.lock_hash, repaired: true });
          const repairedEligible = !temporalGate || this.research.revealGate(sessionId).eligible;
          if (repairedEligible)
            appendEdge("RAW_REPORT_LOCKED", "REVEAL_ELIGIBLE", "REVEAL_ELIGIBLE", { rawReportLocked: true }, { gate: temporalGate ? "FULL_RESEARCH_GATE" : "RAW_REPORT_LOCKED", repaired: true });
          if (temporalGate)
            this.research.updatePhases(sessionId, { reportStatus: "LOCKED", revealStatus: repairedEligible ? "ELIGIBLE" : "BLOCKED" });
        })();
        const currentStatus = this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status;
        return { sessionId, lockedUtc: existing.locked_utc, lockHash: existing.lock_hash, schemaVersion: existing.schema_version, alreadyLocked: true, revealEligible: currentStatus === "REVEAL_ELIGIBLE", repaired: true };
      }
      return { sessionId, lockedUtc: existing.locked_utc, lockHash: existing.lock_hash, schemaVersion: existing.schema_version, alreadyLocked: true, revealEligible: eligible };
    }
    if (!["RETURNED", "RAW_REPORT_DRAFT", "ABORTED"].includes(session.status))
      throw new Error("A report cannot be locked before formal return.");
    const payloadJson = JSON.stringify(clone(report));
    const lockHash = sha256(payloadJson);
    const lockedUtc = now();
    const trialId = this.sessions.trials(sessionId)[0]?.trialId || null;
    if (session.status === "ABORTED") {
      // ABORTED is terminal for machine evidence. Locking the participant
      // report afterward remains useful, but must not rewrite the lifecycle
      // to RAW_REPORT_LOCKED or imply reveal eligibility.
      this.db.transaction(() => {
        this.db.prepare("INSERT INTO raw_reports_locked(session_id,locked_utc,payload_json,lock_hash,schema_version) VALUES(?,?,?,?,?)").run(sessionId, lockedUtc, payloadJson, lockHash, schemaVersion);
        this.db.prepare("DELETE FROM raw_report_drafts WHERE session_id=?").run(sessionId);
        this.evidence.appendEvent(sessionId, trialId, "RAW_REPORT_LOCKED_AFTER_ABORT", { lockHash, schemaVersion, evidenceAborted: true });
        if (temporalGate)
          this.research.updatePhases(sessionId, { reportStatus: "LOCKED", revealStatus: "BLOCKED", sessionLifecycle: "ABORTED" });
      })();
      return { sessionId, lockedUtc, lockHash, schemaVersion, revealEligible: false, alreadyLocked: false, evidenceAborted: true };
    }
    const appendEdge = (from, to, eventType, payload, evidence) => {
      const event = this.evidence.appendEvent(sessionId, trialId, eventType, payload);
      const projection = this.evidence.projectTransition(sessionId, trialId, from, to, { eventId: event.eventId, occurredUtc: event.occurredUtc, monotonicNs: event.monotonicNs });
      this.sessions.setStatus(sessionId, to);
      if (trialId) this.db.prepare("UPDATE trials SET state=? WHERE trial_id=?").run(to, trialId);
      this.evidence.addTransitionEvidence(sessionId, { trialId, projectionId: projection.projectionId, evidenceEventId: event.eventId, evidenceType: to, evidence });
      return { event, projection };
    };
    let eligible = false;
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO raw_reports_locked(session_id,locked_utc,payload_json,lock_hash,schema_version) VALUES(?,?,?,?,?)").run(sessionId, lockedUtc, payloadJson, lockHash, schemaVersion);
      this.db.prepare("DELETE FROM raw_report_drafts WHERE session_id=?").run(sessionId);
      appendEdge(session.status, "RAW_REPORT_LOCKED", "RAW_REPORT_LOCKED", { lockHash, schemaVersion }, { lockHash });
      eligible = !temporalGate || this.research.revealGate(sessionId).eligible;
      if (eligible)
        appendEdge("RAW_REPORT_LOCKED", "REVEAL_ELIGIBLE", "REVEAL_ELIGIBLE", { rawReportLocked: true }, { gate: temporalGate ? "FULL_RESEARCH_GATE" : "RAW_REPORT_LOCKED" });
      if (temporalGate)
        this.research.updatePhases(sessionId, { reportStatus: "LOCKED", revealStatus: eligible ? "ELIGIBLE" : "BLOCKED" });
    })();
    const finalStatus = this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status;
    return { sessionId, lockedUtc, lockHash, schemaVersion, revealEligible: finalStatus === "REVEAL_ELIGIBLE", alreadyLocked: false };
  }

  getReport(sessionId, options = {}) {
    const row = this.db.prepare("SELECT * FROM raw_reports_locked WHERE session_id=?").get(sessionId);
    if (!row) return { locked: false };
    const revealed = ["REVEALED", "COMPLETE"].includes(this.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(sessionId)?.status);
    if (!options.full || !revealed) return { locked: true, redacted: true, lockedUtc: row.locked_utc, lockHash: row.lock_hash, schemaVersion: row.schema_version };
    return { locked: true, lockedUtc: row.locked_utc, lockHash: row.lock_hash, schemaVersion: row.schema_version, report: json(row.payload_json, {}) };
  }

  revealSession(sessionId) {
    const session = this.db.prepare("SELECT * FROM sessions WHERE session_id=?").get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    if (!this.db.prepare("SELECT 1 FROM raw_reports_locked WHERE session_id=?").get(sessionId)) throw new Error("Reveal is not eligible until the raw report is locked");
    const researchMeta = this.db.prepare("SELECT mode,primary_endpoint,outcome_space_json,temporal_analysis_json FROM research_definitions WHERE session_id=?").get(sessionId);
    const strictResearchGate = requiresStrictResearchGate(researchMeta);
    if (strictResearchGate) {
      const gate = this.research.revealGate(sessionId);
      if (!gate.eligible) throw new Error(`Reveal is blocked until research evidence is complete: ${gate.missing.join(", ")}`);
    }
    if (!["REVEALED", "COMPLETE"].includes(session.status)) {
      this.persistTransition(sessionId, "REVEALED", {
        revealAuthorized: true,
        eventType: "REVEALED",
        payload: { objective: session.hidden_objective },
      }, { evidence: { ownerAuthorizedReveal: true } });
    }
    this.research?.updatePhases(sessionId, { revealStatus: "REVEALED", sessionLifecycle: "REVEALED" });
    return this.sessions.getFull(sessionId);
  }

  saveAnalysis(sessionId, analysis, options = {}) { return this.analyses.save(sessionId, analysis, options); }
  saveCalibration(input) { return this.calibrations.save(input); }
  saveAudioHealth(input) { return this.audioHealth.save(input); }
  createBackup(options = {}) { return this.backups.create(options); }
  restoreBackup(input, options = {}) { return this.backups.restore(input, options); }
  importLegacy(source, options = {}) { return this.legacyImporter.import(source, options); }
  exportSession(sessionId, options = {}) { return this.exporter.exportSession(sessionId, options); }
  getSession(sessionId, options = {}) { return this.sessions.get(sessionId, options); }
  getSessionFull(sessionId) { return this.sessions.getFull(sessionId); }
  listEvents(sessionId, options = {}) { return this.evidence.list(sessionId, options); }
  listOutputs(sessionId, options = {}) { return this.evidence.outputs(sessionId, options); }

  appendEvent(sessionId, trialId, type, payload = {}) { return this.evidence.appendEvent(sessionId, trialId, type, payload); }
  recordOutput(sessionId, record) { return this.evidence.recordOutput(sessionId, record); }
  finalizeOutput(sessionId, details = {}) { return this.evidence.finalizeOutput(sessionId, details); }
  commitAudioConfig(sessionId, audio, options = {}) {
    const config = clone(audio);
    // Repository DTOs carry projection-only fields alongside the immutable
    // effective recipe.  Never include those fields in a formal audio commit;
    // the committed fingerprint must describe only recipe material.
    for (const key of ["configHash", "status", "isDraft", "isActive", "incomplete", "repositoryProvenance"])
      delete config[key];
    const hashConfig = { ...config };
    delete hashConfig.configFingerprint;
    const hash = sha256(canonical(hashConfig));
    const recipeId = config.recipeId || config.id || null;
    const recipeVersion = config.version ?? config.recipeVersion ?? null;
    if (recipeId && recipeVersion !== null && !this.db.prepare("SELECT 1 FROM audio_recipe_versions WHERE recipe_id=? AND version=?").get(recipeId, Number(recipeVersion))) throw new Error(`Audio recipe version is not available in SQLite: ${recipeId} v${recipeVersion}`);
    const existing = this.db.prepare("SELECT config_hash FROM audio_commits WHERE session_id=?").get(sessionId);
    if (existing) {
      if (existing.config_hash !== hash) throw new Error(`Audio configuration is already committed for ${sessionId}`);
      return { sessionId, recipeId, recipeVersion, config, configHash: hash, audioVersion: config.audioVersion || AUDIO_VERSION, engineVersion: config.engineVersion || ENGINE_VERSION, committedUtc: this.db.prepare("SELECT committed_utc FROM audio_commits WHERE session_id=?").get(sessionId).committed_utc };
    }
    const committedUtc = options.committedUtc || now();
    const telemetry = options.telemetry ?? config.telemetry ?? null;
    const streamDigest = options.streamDigest ?? config.streamDigest ?? null;
    const frameCount = options.frameCount ?? config.frameCount ?? null;
    const format = options.format ?? config.format ?? null;
    this.db.prepare("INSERT INTO audio_commits(session_id,recipe_id,recipe_version,config_json,config_hash,audio_version,engine_version,telemetry_json,stream_digest,frame_count,format_json,committed_utc) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(sessionId, recipeId, recipeVersion, JSON.stringify(config), hash, config.audioVersion || AUDIO_VERSION, config.engineVersion || ENGINE_VERSION, telemetry === null ? null : JSON.stringify(telemetry), streamDigest, frameCount, format === null ? null : JSON.stringify(format), committedUtc);
    this.db.prepare("UPDATE session_details SET committed_audio_config_json=?,committed_audio_config_hash=? WHERE session_id=?").run(JSON.stringify(config), hash, sessionId);
    return { sessionId, recipeId, recipeVersion, config, configHash: hash, audioVersion: config.audioVersion || AUDIO_VERSION, engineVersion: config.engineVersion || ENGINE_VERSION, telemetry, streamDigest, frameCount, format, committedUtc };
  }
  addLateAnnotation(sessionId, kind, payload) { return this.evidence.addLateAnnotation(sessionId, kind, payload); }
  events(sessionId) { return this.evidence.listRedacted(sessionId); }
  verify(sessionId, options = {}) { return options.redacted ? this.integrity.summary(sessionId) : this.integrity.verifySession(sessionId, options); }
  close() {
    if (this.db.open) {
      try { this.db.pragma("wal_checkpoint(PASSIVE)"); } catch { /* closing still releases the database */ }
      this.db.close();
    }
  }
}

export { sqlDb, json, clone, now, profileDto, recipeDto };
