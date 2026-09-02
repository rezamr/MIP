import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BUILTIN_RECIPES,
  EXPERIMENTAL_RECIPES,
  normalizeRecipe,
  summarizeProvenance,
} from "../public/audio-core.js";
import { quickRecipe, validateRecipe } from "../src/audio.js";
import { MipDatabase } from "../src/main/database/db.js";
import {
  applyMaterialProvenancePolicy,
  bindEngineeringVerification,
  materialDiff,
  AUDIO_CORE_VERSION,
  ENGINEERING_VERIFICATION_VERSION,
} from "../src/main/repositories/AudioRecipeVersionPolicy.js";
import { PROCESSOR_VERSION } from "../public/audio-core.js";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function tempRoot() { return fs.mkdtempSync(path.join(os.tmpdir(), "mip-recipe-policy-v12-")); }
function closeAndRemove(db, root) { db?.close(); fs.rmSync(root, { recursive: true, force: true }); }

test("material provenance policy reports canonical paths and invalidates changed claims", () => {
  const parent = BUILTIN_RECIPES["A-U396-4"];
  const proposed = clone(parent);
  proposed.carriers[0].leftHz = 395;
  proposed.carriers[0].rightHz = 399;
  const result = applyMaterialProvenancePolicy({ parentRecipe: parent, proposedRecipe: proposed, submittedRecipe: proposed, parentVersion: 1 });
  assert.ok(result.changes.some((change) => change.path === "carriers[0].leftHz"));
  assert.ok(result.changes.some((change) => change.path === "carriers[0].rightHz"));
  assert.deepEqual(result.changes.map((change) => change.path).filter((pathName) => pathName.startsWith("carriers[0].")), ["carriers[0].leftHz", "carriers[0].rightHz"]);
  assert.equal(result.recipe.parameterProvenance["carriers[0].leftHz"].provenanceClass, "USER_DEFINED");
  assert.equal(result.recipe.parameterProvenance["carriers[0].rightHz"].provenanceClass, "USER_DEFINED");
  assert.equal(result.recipe.parameterProvenance["sampleRate"].provenanceClass, parent.parameterProvenance.sampleRate.provenanceClass);
  assert.ok(result.recipe.provenanceAudit.invalidatedPaths.includes("carriers[0].leftHz"));

  const sparse = clone(proposed);
  sparse.parameterProvenance = { "carriers[0].leftHz": { provenanceClass: "USER_DEFINED", sourceRef: "owner edit" } };
  const sparseResult = applyMaterialProvenancePolicy({ parentRecipe: parent, proposedRecipe: sparse, submittedRecipe: sparse, parentVersion: 1 });
  assert.equal(sparseResult.recipe.parameterProvenance.sampleRate.provenanceClass, parent.parameterProvenance.sampleRate.provenanceClass);

  const added = clone(parent);
  added.carriers.push({ ...clone(added.carriers[0]), id: "owner-added", leftHz: 420, rightHz: 424 });
  const addedResult = applyMaterialProvenancePolicy({ parentRecipe: parent, proposedRecipe: added, submittedRecipe: added, parentVersion: 1 });
  assert.ok(addedResult.changes.some((change) => change.path === "carriers[1].leftHz"));
  assert.equal(addedResult.recipe.parameterProvenance["carriers[1].leftHz"].provenanceClass, "USER_DEFINED");
});

test("reconstruction and unknown semantics remain conservative while new derivation records may be validated", () => {
  const reconstructionParent = EXPERIMENTAL_RECIPES.MIP_LAYERED_EXPERIMENTAL_V1;
  const reconstructionProposal = clone(reconstructionParent);
  reconstructionProposal.carriers[1].leftHz += 1;
  const reconstruction = applyMaterialProvenancePolicy({ parentRecipe: reconstructionParent, proposedRecipe: reconstructionProposal, submittedRecipe: reconstructionProposal, parentVersion: 1 });
  assert.equal(reconstruction.recipe.parameterProvenance["carriers[1].leftHz"].provenanceClass, "MIP_RECONSTRUCTION_PARAMETER");

  const unknownParent = clone(BUILTIN_RECIPES["A-U396-4"]);
  unknownParent.provenance = "HISTORICAL_CANDIDATE";
  unknownParent.parameterProvenance = { "*": { provenanceClass: "UNKNOWN_BLOCKED" } };
  const unknownProposal = clone(unknownParent);
  unknownProposal.carriers[0].leftHz = 395;
  const unknown = applyMaterialProvenancePolicy({ parentRecipe: unknownParent, proposedRecipe: unknownProposal, submittedRecipe: unknownProposal, parentVersion: 1 });
  assert.equal(unknown.recipe.parameterProvenance["carriers[0].leftHz"].provenanceClass, "UNKNOWN_BLOCKED");

  const derivedProposal = clone(BUILTIN_RECIPES["A-U396-4"]);
  derivedProposal.carriers[0].leftHz = 395;
  derivedProposal.parameterProvenance["carriers[0].leftHz"] = {
    provenanceClass: "PRIMARY_SOURCE_DERIVED",
    sourceRef: "test-source",
    derivationRule: "source frequency minus one",
    inputValues: { source: 396 },
    derivedValue: 395,
    derivationVersion: "TEST_DERIVATION_V1",
  };
  const derived = applyMaterialProvenancePolicy({ parentRecipe: BUILTIN_RECIPES["A-U396-4"], proposedRecipe: derivedProposal, submittedRecipe: derivedProposal, parentVersion: 1 });
  assert.equal(derived.recipe.parameterProvenance["carriers[0].leftHz"].provenanceClass, "PRIMARY_SOURCE_DERIVED");
  assert.deepEqual(derived.newlyValidated, ["carriers[0].leftHz"]);

  const verifiedWithoutRecord = clone(BUILTIN_RECIPES["A-P100-104"]);
  verifiedWithoutRecord.carriers[0].leftHz = 101;
  verifiedWithoutRecord.parameterProvenance["carriers[0].leftHz"] = { provenanceClass: "PRIMARY_SOURCE_VERIFIED", sourceRef: "new-source" };
  const invalid = applyMaterialProvenancePolicy({ parentRecipe: BUILTIN_RECIPES["A-P100-104"], proposedRecipe: verifiedWithoutRecord, submittedRecipe: verifiedWithoutRecord, parentVersion: 1 });
  assert.equal(invalid.recipe.parameterProvenance["carriers[0].leftHz"].provenanceClass, "UNKNOWN_BLOCKED");
  assert.ok(invalid.errors.some((error) => /newly validated source record/i.test(error)));
});

test("cosmetic changes have no material diff and preserve provenance", () => {
  const parent = BUILTIN_RECIPES["A-U396-4"];
  const proposed = { ...clone(parent), name: "Cosmetic owner label" };
  assert.deepEqual(materialDiff(parent, proposed), []);
  const result = applyMaterialProvenancePolicy({ parentRecipe: parent, proposedRecipe: proposed, submittedRecipe: proposed, parentVersion: 1 });
  assert.deepEqual(result.invalidated, []);
  assert.deepEqual(result.recipe.parameterProvenance, parent.parameterProvenance);
});

test("normalization rejects contradictory convenience aliases instead of choosing one silently", () => {
  const parent = clone(BUILTIN_RECIPES["A-U396-4"]);
  assert.throws(() => normalizeRecipe({ ...parent, mode: "PHASED_PINK_PATENT_5356368", synthesisMode: "STANDARD" }), /mode\/synthesisMode aliases conflict/);
  assert.throws(() => normalizeRecipe({ ...parent, durationMode: "finite", execution: { ...parent.execution, mode: "live" } }), /durationMode\/execution\.mode aliases conflict/);
  assert.throws(() => normalizeRecipe({ ...parent, durationMode: "finite", targetFrames: 100, execution: { mode: "finite", targetFrames: 200 } }), /targetFrames\/execution\.targetFrames aliases conflict/);
  assert.throws(() => normalizeRecipe({ ...parent, gain: 0.4 }), /gain conflicts with top-level gain|top-level gain conflicts/);
  assert.throws(() => normalizeRecipe({ ...parent, leftHz: 395 }), /top-level leftHz conflicts/);
  assert.throws(() => normalizeRecipe({ ...parent, leftFrequencyHz: 395 }), /leftHz\/leftFrequencyHz aliases conflict/);
  assert.throws(() => normalizeRecipe({ ...parent, centerHz: 397 }), /top-level centerHz conflicts/);
  assert.throws(() => normalizeRecipe({ ...parent, beatHz: 5 }), /top-level beatHz conflicts/);
});

test("engineering verification is bound to the effective config and stale PASS is never reused", () => {
  const parent = BUILTIN_RECIPES["A-U396-4"];
  const pass = bindEngineeringVerification(parent, {
    status: "PASS",
    fixtureId: "PURE_394_398",
    configFingerprint: parent.configFingerprint,
    audioCoreVersion: AUDIO_CORE_VERSION,
    processorVersion: PROCESSOR_VERSION,
    verificationVersion: ENGINEERING_VERIFICATION_VERSION,
  }, { valid: true });
  assert.equal(pass.status, "PASS");
  const changedInput = { ...clone(parent), carriers: [{ ...clone(parent.carriers[0]), leftHz: 395, rightHz: 399 }] };
  delete changedInput.leftHz; delete changedInput.rightHz; delete changedInput.centerHz; delete changedInput.beatHz; delete changedInput.gain;
  const changed = normalizeRecipe(changedInput);
  const stale = bindEngineeringVerification(changed, pass, { valid: true, materialChanged: true });
  assert.equal(stale.status, "STALE");
  assert.equal(stale.referenceStatus, "STALE");
  assert.equal(stale.formalOperationalEligibility, false);
  assert.equal(stale.configFingerprint, changed.configFingerprint);
  assert.equal(stale.audioCoreVersion, AUDIO_CORE_VERSION);
  assert.equal(stale.processorVersion, PROCESSOR_VERSION);
  assert.equal(stale.verificationVersion, ENGINEERING_VERIFICATION_VERSION);
  const arbitrary = bindEngineeringVerification({ ...changed, recipeId: "OWNER_RECIPE" }, pass, { valid: true, materialChanged: true });
  assert.equal(arbitrary.status, "REFERENCE VERIFICATION NOT RUN");
  assert.equal(arbitrary.referenceStatus, "NOT_APPLICABLE");
  assert.equal(arbitrary.referenceMatch, false);
  assert.equal(arbitrary.fixtureId, null);
  const invalidCustom = bindEngineeringVerification({ ...changed, recipeId: "OWNER_INVALID_RECIPE", carriers: [] }, pass, { valid: false, materialChanged: true });
  assert.equal(invalidCustom.referenceStatus, "NOT_APPLICABLE");
  assert.equal(invalidCustom.configurationStatus, "FAIL");
  assert.equal(invalidCustom.formalOperationalEligibility, false);
});

test("QUICK_CUSTOM is owner-derived preview provenance and never formally eligible", () => {
  const recipe = quickRecipe(396, 4);
  const validation = validateRecipe(recipe);
  assert.equal(validation.valid, true);
  assert.equal(recipe.parameterProvenance["carriers[0].leftHz"].provenanceClass, "USER_DEFINED");
  assert.equal(recipe.parameterProvenance["carriers[0].rightHz"].provenanceClass, "USER_DEFINED");
  assert.equal(recipe.parameterProvenance["carriers[0].leftHz"].sourceRef, "Audio Lab owner input");
  assert.equal(recipe.formalEligibility, false);
  assert.equal(summarizeProvenance(recipe).provenanceEligible, true);
  assert.equal(summarizeProvenance(recipe).formalEligible, false);
});

test("repository versions expose operational formal eligibility separately from provenance completeness", () => {
  const root = tempRoot();
  let db = new MipDatabase(root);
  try {
    const builtin = db.recipes.getVersion("A-U396-4", 1);
    assert.equal(builtin.formalEligibility, true);
    assert.equal(builtin.provenanceEligibility, true);
    assert.equal(builtin.engineeringVerification.status, "PASS");
    const duplicate = db.recipes.duplicate("A-U396-4", "POLICY_EDIT_FIXTURE", { version: 1 });
    assert.equal(duplicate.formalEligibility, false);
    assert.equal(duplicate.engineeringVerification.status, "REFERENCE VERIFICATION NOT RUN");
    const edited = clone(duplicate);
    edited.carriers[0].leftHz = 395;
    edited.carriers[0].rightHz = 399;
    delete edited.leftHz; delete edited.rightHz; delete edited.centerHz; delete edited.beatHz; delete edited.gain;
    const version = db.recipes.saveNewVersion(edited, { parentVersion: 1 });
    assert.equal(version.version, 2);
    assert.equal(version.recipeVersion, 2);
    assert.equal(version.engineeringVerification.status, "REFERENCE VERIFICATION NOT RUN");
    assert.equal(version.parameterProvenance["carriers[0].leftHz"].provenanceClass, "USER_DEFINED");
    assert.notEqual(version.configFingerprint, duplicate.configFingerprint);
    const cosmetic = db.recipes.saveNewVersion({ ...clone(duplicate), name: "Owner cosmetic label" }, { parentVersion: 1 });
    assert.deepEqual(cosmetic.parameterProvenance, duplicate.parameterProvenance);
    db.close();
    db = new MipDatabase(root);
    const reopened = db.recipes.getVersion("POLICY_EDIT_FIXTURE", 2);
    assert.equal(reopened.carriers[0].leftHz, 395);
    assert.equal(reopened.recipeVersion, 2);
    assert.equal(reopened.carriers[0].rightHz, 399);
    assert.equal(reopened.formalEligibility, false);
    assert.equal(reopened.engineeringVerification.status, "REFERENCE VERIFICATION NOT RUN");
    assert.equal(reopened.parameterProvenance["carriers[0].leftHz"].provenanceClass, "USER_DEFINED");
  } finally {
    closeAndRemove(db, root);
  }
});

test("parentless recipes require explicit provenance claims and preserve validated records across restart", () => {
  const base = clone(BUILTIN_RECIPES["A-U396-4"]);
  const makeNew = (id, parameterProvenance) => {
    const recipe = clone(base);
    recipe.id = id;
    recipe.recipeId = id;
    recipe.name = `${id} owner recipe`;
    recipe.provenance = "USER_DEFINED_OWNER_RECIPE";
    recipe.historicalStatus = "USER_DEFINED";
    recipe.parameterProvenance = parameterProvenance;
    delete recipe.configFingerprint;
    delete recipe.configHash;
    delete recipe.status;
    delete recipe.isDraft;
    delete recipe.isActive;
    return recipe;
  };

  const fakeVerified = makeNew("PARENTLESS_FAKE_VERIFIED", {
    "*": { provenanceClass: "PRIMARY_SOURCE_VERIFIED", sourceRef: "owner assertion only" },
  });
  const fakePolicy = applyMaterialProvenancePolicy({ proposedRecipe: fakeVerified, submittedRecipe: fakeVerified });
  assert.ok(fakePolicy.changes.length > 0);
  assert.ok(fakePolicy.errors.some((error) => /newly validated source record/i.test(error)));
  assert.equal(fakePolicy.recipe.parameterProvenance["carriers[0].leftHz"].provenanceClass, "UNKNOWN_BLOCKED");

  const extraUnsupported = makeNew("PARENTLESS_EXTRA_UNSUPPORTED", {
    "*": { provenanceClass: "USER_DEFINED", sourceRef: "owner input" },
    "future.material.path": { provenanceClass: "PRIMARY_SOURCE_VERIFIED", sourceRef: "owner assertion only" },
  });
  const extraPolicy = applyMaterialProvenancePolicy({ proposedRecipe: extraUnsupported, submittedRecipe: extraUnsupported });
  assert.ok(extraPolicy.errors.some((error) => /newly validated source record/i.test(error)));

  const derived = makeNew("PARENTLESS_DERIVED", {
    "*": { provenanceClass: "USER_DEFINED", sourceRef: "owner input" },
    "carriers[0].leftHz": {
      provenanceClass: "PRIMARY_SOURCE_DERIVED",
      sourceRef: "validated-source",
      derivationRule: "source frequency minus one",
      inputValues: { source: 395 },
      derivedValue: 393,
      derivationVersion: "TEST_DERIVATION_V1",
    },
  });
  const incompleteReconstruction = makeNew("PARENTLESS_BAD_RECONSTRUCTION", {
    "*": { provenanceClass: "MIP_RECONSTRUCTION_PARAMETER" },
  });
  const root = tempRoot();
  let db = new MipDatabase(root);
  try {
    assert.throws(() => db.recipes.saveNewVersion(fakeVerified, { version: 1, activate: true }), /validation|provenance|source record/i);
    const user = db.recipes.saveNewVersion(makeNew("PARENTLESS_USER", {
      "*": { provenanceClass: "USER_DEFINED", sourceRef: "owner input" },
    }), { version: 1, activate: true });
    assert.equal(user.isActive, true);
    assert.equal(user.provenanceEligibility, true);
    assert.equal(user.engineeringVerification.referenceStatus, "NOT_APPLICABLE");
    assert.equal(user.formalOperationalEligibility, true);
    const derivedSaved = db.recipes.saveNewVersion(derived, { version: 1, activate: true });
    assert.equal(derivedSaved.parameterProvenance["carriers[0].leftHz"].provenanceClass, "PRIMARY_SOURCE_DERIVED");
    assert.throws(() => db.recipes.saveNewVersion(incompleteReconstruction, { version: 1, activate: true }), /reconstruction|validation|provenance/i);
    const exact = JSON.stringify(derivedSaved.parameterProvenance);
    db.close();
    db = new MipDatabase(root);
    assert.equal(JSON.stringify(db.recipes.getVersion("PARENTLESS_DERIVED", 1).parameterProvenance), exact);
  } finally {
    closeAndRemove(db, root);
  }
});

test("custom active recipe is formally operational without a golden reference and commits exact identity", () => {
  const root = tempRoot();
  let db = new MipDatabase(root);
  try {
    const baseRecipe = db.recipes.getVersion("A-U396-4", 1);
    const customId = "CUSTOM_FORMAL_RECIPE";
    const duplicate = db.recipes.duplicate("A-U396-4", customId, { version: 1, activate: false });
    const edited = clone(duplicate);
    edited.carriers[0].leftHz = 395;
    edited.carriers[0].rightHz = 399;
    for (const key of ["leftHz", "rightHz", "centerHz", "beatHz", "gain"]) delete edited[key];
    const custom = db.recipes.saveNewVersion(edited, { parentVersion: 1, activate: true });
    assert.equal(custom.isActive, true);
    assert.equal(custom.status, "ACTIVE");
    assert.equal(custom.engineeringVerification.referenceStatus, "NOT_APPLICABLE");
    assert.equal(custom.engineeringVerification.configurationStatus, "PASS");
    assert.equal(custom.engineeringVerification.runtimeCompatibility, "PASS");
    assert.equal(custom.engineeringVerification.deterministicSelfCheck, "PASS");
    assert.equal(custom.formalOperationalEligibility, true);
    assert.equal(custom.parameterProvenance["carriers[0].leftHz"].provenanceClass, "USER_DEFINED");

    const baseProfile = db.profiles.getVersion("BASELINE_NOW_BINARY_V1", 1);
    const customProfileId = "CUSTOM_FORMAL_PROFILE";
    db.profiles.duplicate("BASELINE_NOW_BINARY_V1", customProfileId, { version: 1, activate: false });
    const profileDraft = clone(db.profiles.getVersion(customProfileId, 1));
    profileDraft.audio = { recipeId: custom.recipeId, version: custom.version };
    const customProfile = db.profiles.saveNewVersion(profileDraft, { parentVersion: 1, activate: true });
    assert.equal(customProfile.isActive, true);
    assert.equal(customProfile.audio.recipeId, custom.recipeId);
    assert.equal(customProfile.audio.version, custom.version);

    const committed = db.beginSession(customProfile, "dry custom formal", "dry", {
      audio: custom,
      participantTarget: null,
      timing: customProfile.timing,
      researchDefinition: {
        mode: customProfile.mode,
        outcomeSpace: customProfile.outcomeSpace,
        primaryEndpoint: customProfile.analysis.primaryEndpoint,
        temporalAnalysis: customProfile.analysis,
        targetDefinition: { mode: customProfile.mode, anchor: "PARTICIPANT_REQUEST" },
      },
    });
    const audioCommit = db.db.prepare("SELECT recipe_id,recipe_version,config_hash FROM audio_commits WHERE session_id=?").get(committed.id);
    assert.deepEqual({ recipeId: audioCommit.recipe_id, version: audioCommit.recipe_version }, { recipeId: custom.recipeId, version: custom.version });
    const committedAudioConfig = JSON.parse(db.db.prepare("SELECT config_json FROM audio_commits WHERE session_id=?").get(committed.id).config_json);
    assert.equal(committedAudioConfig.recipeId, custom.recipeId);
    assert.equal(committedAudioConfig.version, custom.version);
    assert.equal(committedAudioConfig.configFingerprint, custom.configFingerprint);
    assert.equal(custom.configFingerprint, db.recipes.getVersion(custom.recipeId, custom.version).configFingerprint);
    assert.notEqual(baseRecipe.configFingerprint, custom.configFingerprint);
    assert.equal(db.recipes.getVersion("A-U396-4", 1).carriers[0].leftHz, 394);
    db.close();
    db = new MipDatabase(root);
    const reopenedCustom = db.recipes.getVersion(custom.recipeId, custom.version);
    const reopenedProfile = db.profiles.getVersion(customProfile.id, customProfile.version);
    assert.equal(reopenedCustom.formalOperationalEligibility, true);
    assert.equal(reopenedCustom.engineeringVerification.referenceStatus, "NOT_APPLICABLE");
    assert.equal(reopenedProfile.audio.recipeId, custom.recipeId);
    const reopenedCommit = db.db.prepare("SELECT config_json FROM audio_commits WHERE session_id=? AND recipe_id=? AND recipe_version=?").get(committed.id, custom.recipeId, custom.version);
    assert.ok(reopenedCommit);
    assert.equal(JSON.parse(reopenedCommit.config_json).configFingerprint, reopenedCustom.configFingerprint);
  } finally {
    closeAndRemove(db, root);
  }
});
