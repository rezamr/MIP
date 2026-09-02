import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MipDatabase, reconcileBuiltinRecipeMetadata, BUILTIN_METADATA_RECONCILIATION_VERSION } from "../src/main/database/db.js";
import { BUILTIN_RECIPES, renderOffline } from "../public/audio-core.js";
import { canonical, sha256 } from "../src/engine.js";
import { renderDistribution } from "../renderer/charts/distribution-chart.js";

const BUILTIN_IDS = ["A-U396-4", "A-P100-104", "A-SHAM-0"];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function tempRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), "mip-builtin-upgrade-v12-")); }
function closeAndRemove(db, root) { db?.close(); fs.rmSync(root, { recursive: true, force: true }); }
function versionRow(db, recipeId) {
  return db.db.prepare("SELECT config_json,config_hash FROM audio_recipe_versions WHERE recipe_id=? AND version=1").get(recipeId);
}
function projection(recipe) {
  return {
    configFingerprint: recipe.configFingerprint,
    parameterProvenance: recipe.parameterProvenance,
    engineeringVerification: recipe.engineeringVerification,
    formalOperationalEligibility: recipe.formalOperationalEligibility,
    activeLayers: recipe.activeLayers,
  };
}

test("fingerprint-gated built-in metadata upgrade preserves immutable material, PCM, and old session integrity", () => {
  const root = tempRoot();
  let db = new MipDatabase(root);
  try {
    const fresh = Object.fromEntries(BUILTIN_IDS.map((recipeId) => {
      const recipe = db.recipes.getVersion(recipeId, 1);
      const row = versionRow(db, recipeId);
      return [recipeId, {
        recipe,
        configJson: row.config_json,
        configHash: row.config_hash,
        pcmDigest: renderOffline(recipe, { targetFrames: 2048 }).digest,
      }];
    }));

    // Commit a session before simulating the old database. Reconciliation is
    // metadata-only and must not alter this immutable session snapshot.
    const session = db.beginSession(db.profiles.getVersion("BASELINE_NOW_BINARY_V1", 1), "upgrade fixture", "dry", {
      audio: fresh["A-U396-4"].recipe,
      timing: { mode: "IMMEDIATE_REQUEST" },
    });
    const sessionRowsBefore = {
      snapshot: db.db.prepare("SELECT session_snapshot_json,session_snapshot_hash FROM session_details WHERE session_id=?").get(session.id),
      commitment: db.db.prepare("SELECT canonical_config,config_hash FROM session_commitments WHERE session_id=?").get(session.id),
      audio: db.db.prepare("SELECT config_json,config_hash FROM audio_commits WHERE session_id=?").get(session.id),
    };
    assert.equal(db.integrity.verifySession(session.id, { persist: false }).valid, true);

    // Reproduce the pre-reconciliation persisted shape: immutable material is
    // retained, while the older build omitted current provenance and
    // engineering metadata. Dropping this trigger is test-only setup for an
    // already-created historical database; production migration never does it.
    db.db.exec("DROP TRIGGER immutable_recipe_versions_update");
    const staleRows = {};
    for (const recipeId of BUILTIN_IDS) {
      const before = versionRow(db, recipeId);
      const stale = JSON.parse(before.config_json);
      for (const key of ["parameterProvenance", "engineeringVerification", "historicalStatus", "historicalExactness", "formalEligibility", "formalEligibilityReason", "formalOperationalEligibility", "provenanceEligibility", "provenanceAudit", "activeLayers"]) delete stale[key];
      const configJson = JSON.stringify(stale);
      const configHash = sha256(canonical(stale));
      db.db.prepare("UPDATE audio_recipe_versions SET config_json=?,config_hash=? WHERE recipe_id=? AND version=1").run(configJson, configHash, recipeId);
      db.db.prepare("UPDATE audio_recipe_version_metadata SET provenance_json=?,validation_json=?,incomplete=1 WHERE recipe_id=? AND version=1").run(JSON.stringify({ source: "pre-v12 schema" }), null, recipeId);
      staleRows[recipeId] = { configJson, configHash };
    }
    db.close();

    db = new MipDatabase(root);
    for (const recipeId of BUILTIN_IDS) {
      const reopened = db.recipes.getVersion(recipeId, 1);
      const row = versionRow(db, recipeId);
      const current = fresh[recipeId];
      assert.equal(row.config_json, staleRows[recipeId].configJson, `${recipeId} config_json was rewritten`);
      assert.equal(row.config_hash, staleRows[recipeId].configHash, `${recipeId} config_hash was rewritten`);
      assert.deepEqual(projection(reopened), projection(current.recipe), `${recipeId} did not converge with a fresh database`);
      assert.equal(renderOffline(reopened, { targetFrames: 2048 }).digest, current.pcmDigest, `${recipeId} PCM changed during metadata repair`);
      assert.equal(reopened.metadataReconciliation?.version, BUILTIN_METADATA_RECONCILIATION_VERSION);
      assert.equal(reopened.metadataReconciliation?.status, "MATCHED");
      assert.equal(reopened.formalOperationalEligibility, true);
      assert.equal(reopened.engineeringVerification.referenceStatus, "PASS");
      assert.equal(reopened.engineeringVerification.configFingerprint, reopened.configFingerprint);
    }

    const sessionRowsAfter = {
      snapshot: db.db.prepare("SELECT session_snapshot_json,session_snapshot_hash FROM session_details WHERE session_id=?").get(session.id),
      commitment: db.db.prepare("SELECT canonical_config,config_hash FROM session_commitments WHERE session_id=?").get(session.id),
      audio: db.db.prepare("SELECT config_json,config_hash FROM audio_commits WHERE session_id=?").get(session.id),
    };
    assert.deepEqual(sessionRowsAfter, sessionRowsBefore, "metadata reconciliation changed a committed session row");
    assert.equal(db.integrity.verifySession(session.id, { persist: false }).valid, true);

    const metadataBeforeIdempotent = db.db.prepare("SELECT recipe_id,version,provenance_json,validation_json,incomplete FROM audio_recipe_version_metadata WHERE recipe_id IN (?,?,?) ORDER BY recipe_id").all(...BUILTIN_IDS);
    const second = reconcileBuiltinRecipeMetadata(db.db);
    assert.deepEqual(second.mismatches, []);
    assert.ok(second.repaired.every((item) => item.changed === false));
    const metadataAfterIdempotent = db.db.prepare("SELECT recipe_id,version,provenance_json,validation_json,incomplete FROM audio_recipe_version_metadata WHERE recipe_id IN (?,?,?) ORDER BY recipe_id").all(...BUILTIN_IDS);
    assert.deepEqual(metadataAfterIdempotent, metadataBeforeIdempotent, "second reconciliation changed metadata");

    db.close();
    db = new MipDatabase(root);
    for (const recipeId of BUILTIN_IDS) {
      const reopenedAgain = db.recipes.getVersion(recipeId, 1);
      assert.deepEqual(projection(reopenedAgain), projection(fresh[recipeId].recipe));
      assert.equal(versionRow(db, recipeId).config_json, staleRows[recipeId].configJson);
      assert.equal(versionRow(db, recipeId).config_hash, staleRows[recipeId].configHash);
    }
  } finally {
    closeAndRemove(db, root);
  }
});

test("a built-in material fingerprint mismatch is reported without silent metadata repair", () => {
  const root = tempRoot();
  let db = new MipDatabase(root);
  try {
    const recipeId = "A-U396-4";
    const before = versionRow(db, recipeId);
    const changed = JSON.parse(before.config_json);
    changed.carriers[0].leftHz = 395;
    changed.leftHz = 395;
    changed.centerHz = (changed.leftHz + changed.rightHz) / 2;
    changed.beatHz = Math.abs(changed.rightHz - changed.leftHz);
    changed.binauralRelationships[0].leftHz = 395;
    for (const key of ["parameterProvenance", "engineeringVerification", "formalEligibility", "formalEligibilityReason", "formalOperationalEligibility", "provenanceEligibility", "provenanceAudit", "activeLayers"]) delete changed[key];
    const configJson = JSON.stringify(changed);
    const configHash = sha256(canonical(changed));
    db.db.exec("DROP TRIGGER immutable_recipe_versions_update");
    db.db.prepare("UPDATE audio_recipe_versions SET config_json=?,config_hash=? WHERE recipe_id=? AND version=1").run(configJson, configHash, recipeId);
    db.db.prepare("UPDATE audio_recipe_version_metadata SET provenance_json=?,incomplete=0 WHERE recipe_id=? AND version=1").run(JSON.stringify({ source: "pre-v12 schema", engineeringVerification: { status: "PASS", fixtureId: "PURE_394_398" } }), recipeId);
    db.close();
    db = new MipDatabase(root);
    const reopened = db.recipes.getVersion(recipeId, 1);
    assert.deepEqual(versionRow(db, recipeId), { config_json: configJson, config_hash: configHash });
    assert.equal(reopened.metadataReconciliation?.status, "MATERIAL_MISMATCH_REVIEW_REQUIRED");
    assert.equal(reopened.formalOperationalEligibility, false);
    assert.notEqual(reopened.engineeringVerification.status, "PASS");
    assert.notEqual(reopened.configFingerprint, BUILTIN_RECIPES[recipeId].configFingerprint);
    const repairedMetadata = JSON.parse(db.db.prepare("SELECT provenance_json FROM audio_recipe_version_metadata WHERE recipe_id=? AND version=1").get(recipeId).provenance_json);
    assert.equal(repairedMetadata.source, "pre-v12 schema");
    assert.notEqual(repairedMetadata.engineeringVerification?.status, "PASS");
  } finally {
    closeAndRemove(db, root);
  }
});

test("large integer-range calibration distribution is sparse and deterministic in the renderer", () => {
  const counts = Object.fromEntries(Array.from({ length: 256 }, (_, index) => [String(index * 3_906_250), 1]));
  const html = renderDistribution(counts, {
    statistics: {
      outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 999_999_999 },
      cardinality: 1_000_000_000,
      uniqueCount: 256,
      duplicateCount: 0,
    },
  });
  assert.match(html, /Sparse INTEGER_RANGE sample/);
  assert.match(html, /K=1,000,000,000/);
  assert.ok((html.match(/class="bar-row"/g) || []).length <= 16);
  assert.ok(!html.includes("individual outcomes omitted") || html.includes("range buckets shown"));
});

test("generic calibration statistics remain verifiable after JSON persistence", () => {
  const root = tempRoot();
  let db = new MipDatabase(root);
  try {
    const result = db.saveCalibration({
      provider: "OS_CSPRNG",
      providerVersion: "node-crypto",
      samples: 4,
      counts: { "0": 1, "17": 1, "42": 1, "999999999": 1 },
      statistics: {
        outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 999999999 },
        cardinality: 1000000000,
        uniqueCount: 4,
        duplicateCount: 0,
        min: 0,
        max: 999999999,
        proportionOne: undefined,
      },
    });
    assert.equal(db.calibrations.verify(result.calibrationId).valid, true);
    assert.equal(db.calibrations.get(result.calibrationId).statistics.proportionOne, undefined);
  } finally {
    closeAndRemove(db, root);
  }
});
