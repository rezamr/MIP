import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MipDatabase, CURRENT_SCHEMA_VERSION } from "../src/main/database/db.js";
import { resolveProfile } from "../src/engine.js";
import { quickRecipe } from "../src/audio.js";

function tempRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), "mip-v12-db-")); }
function closeAndRemove(db, root) { db?.close(); fs.rmSync(root, { recursive: true, force: true }); }

test("current migration is ordered, idempotent, and supports schema-v1 data", () => {
  const root = tempRoot();
  const file = path.join(root, "MIP", "data", "mip.sqlite3");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const old = new Database(file);
  old.exec(fs.readFileSync(path.join(process.cwd(), "test", "fixtures", "legacy-schema-v1.sql"), "utf8"));
  old.close();
  const db = new MipDatabase(root);
  assert.equal(db.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(db.db.pragma("foreign_keys", { simple: true }), 1);
  assert.equal(db.db.pragma("synchronous", { simple: true }), 2);
  assert.ok(["wal", "WAL"].includes(db.db.pragma("journal_mode", { simple: true })));
  assert.ok(db.db.prepare("SELECT 1 FROM sessions WHERE session_id='V1-SESSION'").get());
  for (const table of ["session_details", "transition_projections", "transition_evidence", "timing_observations", "output_finalizations", "audio_commits", "profile_identities", "profile_version_metadata", "audio_recipe_version_metadata", "calibration_details", "audio_health_observations", "backup_metadata", "legacy_imports", "legacy_source_files", "legacy_events", "legacy_outputs", "legacy_reports", "legacy_analyses", "analysis_versions"]) assert.ok(db.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table), table);
  const before = db.db.prepare("SELECT version,applied_utc FROM schema_migrations ORDER BY version").all();
  db.migrate();
  assert.deepEqual(db.db.prepare("SELECT version,applied_utc FROM schema_migrations ORDER BY version").all(), before);
  closeAndRemove(db, root);
});

test("profiles and recipes are SQLite-authoritative, exact-versioned, validated, and durable", () => {
  const root = tempRoot();
  let db = new MipDatabase(root);
  const originalProfile = db.profiles.getVersion("BASELINE_NOW_BINARY_V1", 1);
  const originalRecipe = db.recipes.getVersion("A-U396-4", 1);
  assert.equal(db.profiles.getVersion("BASELINE_NOW_BINARY_V1", 999), null);
  assert.equal(db.recipes.getVersion("A-U396-4", 999), null);
  const profileDraft = db.profiles.editDraft("BASELINE_NOW_BINARY_V1", { name: "Draft name" });
  assert.equal(profileDraft.isDraft, true);
  assert.equal(db.profiles.validateDraft("BASELINE_NOW_BINARY_V1").valid, true);
  const profileV2 = db.profiles.saveNewVersion({ ...originalProfile, name: "Persistent profile v2" });
  assert.equal(profileV2.version, 2);
  assert.equal(db.profiles.getVersion("BASELINE_NOW_BINARY_V1", 1).name, originalProfile.name);
  assert.notEqual(db.profiles.getVersion("BASELINE_NOW_BINARY_V1", 2).configHash, originalProfile.configHash);
  assert.ok(db.profiles.materialDiff("BASELINE_NOW_BINARY_V1", 1, 2).some((item) => item.field === "name"));
  db.profiles.activate("BASELINE_NOW_BINARY_V1", 2);
  const recipeDraft = db.recipes.editDraft("A-U396-4", { gain: 0.2 });
  assert.equal(recipeDraft.validation.valid, true);
  const recipeV2 = db.recipes.saveNewVersion({ ...originalRecipe, gain: 0.2 }, { activate: true });
  assert.equal(recipeV2.version, 2);
  assert.equal(db.recipes.getVersion("A-U396-4", 1).gain, originalRecipe.gain);
  const duplicate = db.recipes.duplicate("A-U396-4", "CUSTOM-RECIPE");
  assert.equal(duplicate.recipeId, "CUSTOM-RECIPE");
  db.close();
  db = new MipDatabase(root);
  assert.equal(db.profiles.getVersion("BASELINE_NOW_BINARY_V1", 2).name, "Persistent profile v2");
  assert.equal(db.recipes.getVersion("A-U396-4", 2).gain, 0.2);
  assert.equal(db.recipes.getVersion("A-U396-4", 1).gain, originalRecipe.gain);
  closeAndRemove(db, root);
});

test("calibration, audio health, transition, output, report, analysis and timing records persist with hashes", () => {
  const root = tempRoot();
  const db = new MipDatabase(root);
  const profile = db.profiles.get("BASELINE_NOW_BINARY_V1");
  const session = db.beginSession(profile, "test", "dry", { audio: db.recipes.get("A-U396-4"), timing: { mode: "IMMEDIATE_REQUEST" } });
  db.appendEvent(session.id, session.trial, "STATE_TRANSITION", { fromState: "COMMITTED", toState: "RUNNING" });
  db.recordOutput(session.id, { trialId: session.trial, outputSeq: 0, value: 1, scheduledUtc: "2026-09-01T00:00:00.000Z", scheduledMonotonicNs: "10", actualUtc: "2026-09-01T00:00:00.010Z", actualMonotonicNs: "20", latenessMs: 10, timingStatus: "LATE" });
  const digest = "a".repeat(64);
  db.finalizeOutput(session.id, { finalStreamDigest: digest, format: { sampleRate: 48000, channels: 2 }, frameCount: 1 });
  db.saveReportDraft(session.id, { subjective: "unknown" });
  db.lockRawReport(session.id, { subjective: "unknown" });
  db.saveAnalysis(session.id, { input: [1], result: { score: 1 } }, { input: [1] });
  db.addLateAnnotation(session.id, "NOTE", { text: "late" });
  const calibration = db.saveCalibration({ provider: "DETERMINISTIC_PRNG_TEST", providerVersion: "v1", samples: 4, counts: { 0: 2, 1: 2 }, statistics: { proportionOne: 0.5 }, metadata: { fixture: true }, device: { id: "d" } });
  const health = db.saveAudioHealth({ recipeId: "A-U396-4", recipeVersion: 1, generatedFrames: 1, observations: [{ suspended: true, contextState: "suspended" }, { resumed: true, contextState: "running" }] });
  assert.equal(db.calibrations.verify(calibration.calibrationId).valid, true);
  assert.equal(db.audioHealth.verify(health.diagnosticId).valid, true);
  assert.equal(db.integrity.verifySession(session.id, { persist: false }).valid, true);
  assert.equal(db.integrity.verifySession(session.id, { persist: false }).components.transitionProjectionsEvidence.projectionCount, 1);
  assert.equal(db.integrity.verifySession(session.id, { persist: false }).components.finalStreamDigest.valid, true);
  db.close();
  const reopened = new MipDatabase(root);
  assert.equal(reopened.calibrations.get(calibration.calibrationId).counts[1], 2);
  assert.equal(reopened.audioHealth.get(health.diagnosticId).observations.length, 2);
  assert.equal(reopened.getReport(session.id).redacted, true);
  closeAndRemove(reopened, root);
});

test("integrity verification detects tampered analysis input and result hashes", () => {
  const root = tempRoot();
  const db = new MipDatabase(root);
  const session = db.beginSession(resolveProfile("BASELINE_NOW_BINARY_V1"));
  db.saveAnalysis(session.id, { score: 1, bands: { primary: { proportion: 0.5 } } }, { input: { outputSeq: [0, 1], regions: { primary: [1, 2] } } });
  assert.equal(db.integrity.verifySession(session.id, { persist: false }).valid, true);

  // Simulate an offline tamper attempt after the database-level guard has been
  // deliberately removed in this isolated fixture.  Production connections
  // retain the immutable triggers tested below.
  db.db.exec("DROP TRIGGER immutable_analysis_update; DROP TRIGGER immutable_analysis_versions_update;");
  db.db.prepare("UPDATE analyses SET input_json=? WHERE session_id=?").run(JSON.stringify({ outputSeq: [99] }), session.id);
  db.db.prepare("UPDATE analysis_versions SET payload_json=? WHERE session_id=?").run(JSON.stringify({ score: 999 }), session.id);
  const invalid = db.integrity.verifySession(session.id, { persist: false });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => /Analysis input hash|Analysis result hash|Analysis version/.test(error)));
  closeAndRemove(db, root);
});

test("database immutability triggers protect all primary evidence and history rows", () => {
  const root = tempRoot();
  const db = new MipDatabase(root);
  const session = db.beginSession(resolveProfile("BASELINE_NOW_BINARY_V1"));
  db.recordOutput(session.id, { outputSeq: 0, value: 0 });
  db.lockRawReport(session.id, { report: true });
  const calibration = db.saveCalibration({ calibrationId: "C-IMMUTABLE", samples: 2, counts: { 0: 1, 1: 1 } });
  const health = db.saveAudioHealth({ diagnosticId: "H-IMMUTABLE" });
  db.addLateAnnotation(session.id, "NOTE", { immutable: true });
  const tables = [
    ["evidence_events", "session_id=?", session.id], ["session_commitments", "session_id=?", session.id], ["machine_outputs", "session_id=?", session.id], ["raw_reports_locked", "session_id=?", session.id], ["late_annotations", "session_id=?", session.id], ["profile_versions", "profile_id=?", "BASELINE_NOW_BINARY_V1"], ["audio_recipe_versions", "recipe_id=?", "A-U396-4"], ["calibrations", "calibration_id=?", calibration.calibrationId], ["audio_health", "diagnostic_id=?", health.diagnosticId],
  ];
  for (const [table, where, value] of tables) {
    assert.throws(() => db.db.prepare(`UPDATE ${table} SET ${table === "evidence_events" ? "payload_json=payload_json" : table === "machine_outputs" ? "region=region" : table === "session_commitments" ? "config_hash=config_hash" : table === "raw_reports_locked" ? "lock_hash=lock_hash" : table === "late_annotations" ? "kind=kind" : table === "profile_versions" ? "config_hash=config_hash" : table === "audio_recipe_versions" ? "config_hash=config_hash" : table === "calibrations" ? "result_hash=result_hash" : "result_hash=result_hash"} WHERE ${where}`).run(value), /immutable/);
    assert.throws(() => db.db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(value), /immutable/);
  }
  closeAndRemove(db, root);
});
