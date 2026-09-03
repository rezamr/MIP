import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MipDatabase } from "../src/main/database/db.js";
import { OPERATIONAL_PROFILE_IDS } from "../src/engine.js";

function tempRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), "mip-profile-composability-")); }
function closeAndRemove(db, root) { db?.close(); fs.rmSync(root, { recursive: true, force: true }); }

test("owner profile composition keeps the three pilots recommended and freezes protocol semantics", () => {
  const root = tempRoot();
  const db = new MipDatabase(root);
  try {
    const recommended = db.profiles.list().filter((profile) => OPERATIONAL_PROFILE_IDS.includes(profile.id));
    assert.deepEqual(recommended.map((profile) => profile.id).sort(), [...OPERATIONAL_PROFILE_IDS].sort());
    assert.ok(recommended.every((profile) => profile.catalog?.visibility === "OPERATIONAL" && profile.catalog?.selectableForOwner === true));
    assert.ok(recommended.every((profile) => profile.isActive === true && profile.isDraft === false));
    assert.throws(() => db.profiles.saveNewVersion({ ...recommended[0], name: "Cannot change pilot" }), /frozen/i);
    assert.throws(() => db.profiles.createExperimental({
      baseProfileId: "OP_REQUEST_BINARY_V1",
      newId: "OP_REQUEST_BINARY_V1",
      name: "Overwrite attempt",
      recipeId: "A-U396-4",
      recipeVersion: 1,
    }), /overwrite|frozen/i);

    const layered = db.recipes.getVersion("MIP_LAYERED_EXPERIMENTAL_V1", 1);
    assert.ok(layered);
    assert.equal(layered.isActive, true);
    assert.equal(layered.status, "ACTIVE");
    assert.equal(layered.incomplete, false);
    assert.equal(layered.formalOperationalEligibility, true);

    const input = {
      baseProfileId: "OP_REQUEST_BINARY_V1",
      newId: "OWNER_BINARY_REQUEST_MIP_LAYERED",
      name: "Binary Request — MIP Layered",
      purpose: "Owner experimental reconstruction profile.",
      notes: "Created through the composable owner workflow.",
      recipeId: layered.recipeId,
      recipeVersion: layered.version,
    };
    const validation = db.profiles.validateExperimental(input);
    assert.equal(validation.canSave, true);
    assert.equal(validation.profile.audio.recipeId, "MIP_LAYERED_EXPERIMENTAL_V1");
    assert.equal(validation.profile.audio.version, 1);
    assert.equal(validation.audio.formalOperationalEligibility, true);

    const saved = db.profiles.createExperimental(input, { activate: true });
    assert.equal(saved.id, input.newId);
    assert.equal(saved.status, "ACTIVE");
    assert.equal(saved.isActive, true);
    assert.equal(saved.isDraft, false);
    assert.equal(saved.catalog.visibility, "EXPERIMENTAL");
    assert.equal(saved.catalog.selectableForOwner, true);
    assert.equal(saved.catalog.condition, "REQUEST");
    assert.equal(saved.audio.recipeId, "MIP_LAYERED_EXPERIMENTAL_V1");
    assert.equal(saved.audio.version, 1);
    assert.deepEqual(saved.outcomeSpace, recommended.find((profile) => profile.id === "OP_REQUEST_BINARY_V1").outcomeSpace);
    assert.equal(saved.rng.provider, "OS_CSPRNG");
    assert.equal(saved.protocol.stageMode, "PARTICIPANT_PACED");
    assert.equal(saved.protocol.cueMode, "NONE");
    assert.deepEqual(saved.protocol.audibleStages, []);
    assert.equal(saved.timing.mode, "PARTICIPANT_STOP_ANCHORED");
    assert.equal(saved.timing.targetOffsetMs, 0);
    assert.equal(saved.analysis.primaryEndpoint, "TARGET_FREQUENCY");
    assert.equal(saved.analysis.intervalMs, 100);
    assert.equal(saved.analysis.windows[0].preMs, 2_000);
    assert.equal(saved.analysis.windows[0].postMs, 2_000);
    assert.throws(() => db.profiles.saveNewVersion({ ...saved, timing: { ...saved.timing, targetOffsetMs: 1000 } }, { parentVersion: 1 }), /frozen|participant-paced/i);
    assert.throws(() => db.profiles.archive("OP_REQUEST_BINARY_V1"), /immutable|archived/i);

    const ownerCatalog = db.profiles.list().filter((profile) => profile.catalog?.selectableForOwner === true);
    assert.ok(ownerCatalog.some((profile) => profile.id === saved.id));
    const startEligible = ownerCatalog.filter((profile) => profile.isActive === true && profile.isDraft === false && profile.status === "ACTIVE" && profile.validation?.valid !== false);
    assert.ok(startEligible.some((profile) => profile.id === saved.id));

    const session = db.beginSession(saved, "composability fixture", "dry", {
      audio: layered,
      participantTarget: null,
      timing: saved.timing,
      researchDefinition: {
        mode: saved.mode,
        outcomeSpace: saved.outcomeSpace,
        primaryEndpoint: saved.analysis.primaryEndpoint,
        temporalAnalysis: saved.analysis,
        targetDefinition: { mode: saved.mode, anchor: "PARTICIPANT_STOP_RETURN", targetOffsetMs: 0 },
      },
    });
    const audioCommit = db.db.prepare("SELECT recipe_id,recipe_version,config_json FROM audio_commits WHERE session_id=?").get(session.id);
    assert.deepEqual({ recipeId: audioCommit.recipe_id, version: audioCommit.recipe_version }, { recipeId: "MIP_LAYERED_EXPERIMENTAL_V1", version: 1 });
    assert.equal(JSON.parse(audioCommit.config_json).recipeId, "MIP_LAYERED_EXPERIMENTAL_V1");

    const oldFingerprint = saved.configHash;
    const oldSessionVersion = db.sessions.getRedacted(session.id).profileVersion;
    const edited = db.profiles.saveNewVersion({ ...saved, name: "Binary Request — MIP Layered v2", purpose: "Updated owner note." }, { parentVersion: 1, activate: true });
    assert.equal(edited.version, 2);
    assert.equal(edited.audio.recipeId, "MIP_LAYERED_EXPERIMENTAL_V1");
    assert.notEqual(edited.configHash, oldFingerprint);
    assert.equal(db.profiles.getVersion(input.newId, 1).name, input.name);
    assert.equal(db.sessions.getRedacted(session.id).profileVersion, oldSessionVersion);
    assert.equal(db.sessions.getRedacted(session.id).profileId, input.newId);

    const archived = db.profiles.archive(input.newId);
    assert.equal(archived.status, "ARCHIVED");
    assert.equal(archived.isActive, false);
    assert.ok(!db.profiles.list().filter((profile) => profile.catalog?.selectableForOwner === true && profile.isActive === true && profile.status === "ACTIVE").some((profile) => profile.id === input.newId));
    assert.equal(db.profiles.getVersion(input.newId, 1).audio.recipeId, "MIP_LAYERED_EXPERIMENTAL_V1");
    assert.equal(db.sessions.getRedacted(session.id).profileVersion, 1);
  } finally {
    closeAndRemove(db, root);
  }
});
