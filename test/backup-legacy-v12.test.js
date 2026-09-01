import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MipDatabase } from "../src/main/database/db.js";

function tempRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeRoot(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("backup service creates, verifies, rejects corruption, and restores a known snapshot", async () => {
  const root = tempRoot("mip-v12-backup-");
  const db = new MipDatabase(root);
  try {
    const first = db.beginSession(db.profiles.get("BASELINE_NOW_BINARY_V1"), "backup fixture");
    const backup = await db.createBackup({ pathToken: "fixture-backup" });
    assert.equal(backup.verified, true);
    assert.equal(db.backups.verifyBackup({ backupId: backup.backupId, sha256: backup.sha256 }).valid, true);

    const corrupted = path.join(root, "corrupted.sqlite3");
    fs.copyFileSync(backup.path, corrupted);
    const bytes = fs.readFileSync(corrupted);
    bytes[0] = bytes[0] ^ 0xff;
    fs.writeFileSync(corrupted, bytes);
    const rejected = db.backups.verifyBackup(corrupted);
    assert.equal(rejected.valid, false);
    assert.ok(rejected.errors.length > 0);

    const second = db.beginSession(db.profiles.get("BASELINE_NOW_BINARY_V1"), "post-backup");
    assert.ok(db.getSession(second.id));
    const restored = await db.restoreBackup({ backupId: backup.backupId });
    assert.equal(restored.restored, true);
    assert.equal(restored.postRestore.valid, true);
    assert.ok(db.getSession(first.id));
    assert.equal(db.getSession(second.id), null);
  } finally {
    db.close();
    removeRoot(root);
  }
});

test("legacy v1.0 JSON import preserves originals and marks missing source hashes", () => {
  const root = tempRoot("mip-v12-legacy-json-");
  const db = new MipDatabase(root);
  try {
    const fixturePath = path.join(process.cwd(), "test", "fixtures", "legacy-v1.0.json");
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const result = db.importLegacy(fixture, { importId: "I-FIXTURE-V10" });
    assert.equal(result.imported, 2);
    assert.equal(result.sourceIntegrityStatus, "PARTIAL_UNVERIFIED");
    assert.equal(result.sessions[0].legacySessionId, "LEGACY-100");
    assert.equal(result.sessions[1].legacySessionId, "LEGACY-101");

    const imported = db.getSession("LEGACY-100");
    assert.equal(imported.recordType, "legacy");
    // Imported sessions remain unrevealed, so the public DTO must redact the
    // objective/target even though the authoritative SQLite row preserves it.
    assert.equal(imported.hiddenObjective, undefined);
    const importedRow = db.db.prepare("SELECT hidden_objective,participant_target,manifest_json FROM sessions WHERE session_id=?").get("LEGACY-100");
    assert.equal(importedRow.hidden_objective, "1");
    assert.equal(importedRow.participant_target, "one");
    assert.equal(JSON.parse(importedRow.manifest_json).metadata.operator, "fixture");
    const missing = db.getSession("LEGACY-101");
    assert.equal(missing.hiddenObjective, undefined);
    assert.equal(missing.participantTarget, undefined);
    const missingRow = db.db.prepare("SELECT hidden_objective,participant_target FROM sessions WHERE session_id=?").get("LEGACY-101");
    assert.equal(missingRow.hidden_objective, null);
    assert.equal(missingRow.participant_target, null);
    const source = db.db.prepare("SELECT original_json,original_objective,original_target,source_integrity_status FROM legacy_sessions WHERE import_id=? AND legacy_session_id=?").get("I-FIXTURE-V10", "LEGACY-100");
    assert.deepEqual(JSON.parse(source.original_json), fixture.sessions[0]);
    assert.equal(source.original_objective, "1");
    assert.equal(source.original_target, "one");
    assert.equal(source.source_integrity_status, "UNVERIFIED_MISSING_HASHES");
    const file = db.db.prepare("SELECT relative_name,sha256,size_bytes,content_text FROM legacy_source_files WHERE import_id=?").get("I-FIXTURE-V10");
    assert.equal(file.relative_name, "bundle.json");
    assert.equal(file.size_bytes, Buffer.byteLength(JSON.stringify(fixture)));
    assert.ok(/^[a-f0-9]{64}$/.test(file.sha256));
    assert.ok(file.content_text.includes("LEGACY-100"));
    assert.equal(db.importLegacy(fixture, { importId: "I-FIXTURE-V10-DUP" }).duplicate, true);
  } finally {
    db.close();
    removeRoot(root);
  }
});

test("legacy v1.1 directory import retains source files, outputs, reports, and hash status", () => {
  const root = tempRoot("mip-v12-legacy-dir-");
  const db = new MipDatabase(root);
  try {
    const fixtureDir = path.join(process.cwd(), "test", "fixtures", "legacy-v1.1");
    const result = db.importLegacy(fixtureDir, { importId: "I-FIXTURE-V11" });
    assert.equal(result.imported, 1);
    assert.equal(result.sessions[0].importedSessionId, "LEGACY-110");
    assert.equal(result.sourceIntegrityStatus, "PARTIAL_UNVERIFIED");
    assert.equal(result.sessions[0].sourceIntegrityStatus, "SOURCE_HASH_CHAIN_INVALID");
    assert.equal(db.db.prepare("SELECT COUNT(*) AS count FROM legacy_source_files WHERE import_id=?").get("I-FIXTURE-V11").count, 5);
    assert.equal(db.db.prepare("SELECT COUNT(*) AS count FROM legacy_events WHERE import_id=?").get("I-FIXTURE-V11").count, 2);
    assert.equal(db.db.prepare("SELECT COUNT(*) AS count FROM legacy_outputs WHERE import_id=?").get("I-FIXTURE-V11").count, 2);
    assert.equal(db.db.prepare("SELECT report_kind FROM legacy_reports WHERE import_id=?").get("I-FIXTURE-V11").report_kind, "LOCKED");
    assert.equal(db.db.prepare("SELECT COUNT(*) AS count FROM legacy_analyses WHERE import_id=?").get("I-FIXTURE-V11").count, 1);
    const imported = db.getSession("LEGACY-110");
    assert.equal(imported.participantTarget, undefined);
    assert.equal(imported.hiddenObjective, undefined);
    const importedRow = db.db.prepare("SELECT participant_target,hidden_objective,manifest_json FROM sessions WHERE session_id=?").get("LEGACY-110");
    assert.equal(importedRow.participantTarget, undefined);
    assert.equal(importedRow.participant_target, null);
    assert.equal(importedRow.hidden_objective, null);
    assert.equal(JSON.parse(importedRow.manifest_json).metadata.source, "v1.1 fixture");
  } finally {
    db.close();
    removeRoot(root);
  }
});
