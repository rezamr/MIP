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
  assert.equal(stale.configFingerprint, changed.configFingerprint);
  assert.equal(stale.audioCoreVersion, AUDIO_CORE_VERSION);
  assert.equal(stale.processorVersion, PROCESSOR_VERSION);
  assert.equal(stale.verificationVersion, ENGINEERING_VERIFICATION_VERSION);
  const arbitrary = bindEngineeringVerification({ ...changed, recipeId: "OWNER_RECIPE" }, pass, { valid: true, materialChanged: true });
  assert.equal(arbitrary.status, "REFERENCE VERIFICATION NOT RUN");
  assert.equal(arbitrary.referenceMatch, false);
  assert.equal(arbitrary.fixtureId, null);
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
