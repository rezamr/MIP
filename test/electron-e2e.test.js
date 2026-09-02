import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronPackage = path.dirname(require.resolve("electron/package.json"));
const electronBinary = process.platform === "win32"
  ? path.join(electronPackage, "dist", "electron.exe")
  : path.join(electronPackage, "dist", "electron");

function launchE2E(root, phase, expectedSessionId = null, expectedRecipeId = null) {
  const resultPath = path.join(root, `${phase}.json`);
  const userData = path.join(root, "user-data");
  const environment = {
    ...process.env,
    MIP_E2E_RESULT: resultPath,
    MIP_E2E_USER_DATA: userData,
    MIP_E2E_PHASE: phase,
    ...(expectedSessionId ? { MIP_E2E_EXPECT_SESSION: expectedSessionId } : {}),
    ...(expectedRecipeId ? { MIP_E2E_EXPECT_RECIPE: expectedRecipeId } : {}),
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  };
  return new Promise((resolve, reject) => {
    const child = spawn(electronBinary, [projectRoot, "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"], {
      cwd: projectRoot,
      env: environment,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Electron E2E ${phase} timed out\n${stdout}\n${stderr}`));
    }, 90_000);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (!fs.existsSync(resultPath)) {
        reject(new Error(`Electron E2E ${phase} produced no result (code ${code}, signal ${signal})\n${stdout}\n${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
        if (code !== 0 && result.ok !== false) reject(new Error(`Electron E2E ${phase} exited with ${code}\n${stdout}\n${stderr}`));
        else resolve(result);
      } catch (error) {
        reject(new Error(`Electron E2E ${phase} result is invalid: ${error.message}\n${stdout}\n${stderr}`));
      }
    });
  });
}

test("real Electron bridge, AudioWorklet lifecycle, reports, backup/restore, and restart persistence", async (t) => {
  if (!fs.existsSync(electronBinary)) {
    t.skip(`Electron binary is not available at ${electronBinary}`);
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mip-electron-e2e-"));
  try {
    const initial = await launchE2E(root, "initial");
    assert.equal(initial.ok, true, JSON.stringify(initial));
    assert.equal(initial.bridge, true);
    assert.equal(initial.rendererReady, true);
    assert.equal(initial.pageGuideCoverage.pages, 9, JSON.stringify(initial.pageGuideCoverage));
    assert.equal(initial.pageGuideCoverage.rendered, true, JSON.stringify(initial.pageNavigation));
    assert.equal(initial.pageGuideCoverage.guides, 9, JSON.stringify(initial.pageNavigation));
    assert.deepEqual(initial.pageGuideCoverage.consoleErrors, []);
    assert.deepEqual(initial.pageGuideCoverage.unhandledErrors, []);
    assert.deepEqual(initial.calibrationUi, {
      controls: true,
      selectedOutcomeSpace: true,
      calculatedCardinality: true,
      persistedOutcomeSpace: true,
      persistedCardinality: true,
      persistedSamples: true,
      persistedIntegrity: true,
      provider: true,
    });
    assert.deepEqual(initial.audioLabPanels, { pureRecipeDetails: true, sourceProvenance: true, engineeringVerification: true, activeLayers: true, masterGainText: true });
    assert.deepEqual(initial.layeredRecipePanels, { repositoryBacked: true, activeLayers: true, sourceClasses: true, engineeringVerification: true });
    assert.deepEqual(initial.audioControlSmoke, { doublePlay: true, play: true, rerender: true, pause: true, resume: true, gain: true, stop: true });
    assert.equal(initial.recipeEditing.draftValid, true);
    assert.equal(initial.recipeEditing.savedVersion, 2);
    assert.deepEqual(initial.recipeEditing.canonicalCarriers, { leftHz: 395, rightHz: 399 });
    assert.equal(initial.recipeEditing.aliasesMatch, true);
    assert.equal(initial.recipeEditing.configFingerprintChanged, true);
    assert.equal(initial.recipeEditing.pcmDigestChanged, true);
    assert.equal(initial.recipeEditing.oldVersionUnchanged, true);
    assert.equal(initial.recipeEditing.changedProvenanceSafe, true);
    assert.equal(initial.recipeEditing.verificationStaleOrNotRun, true);
    assert.equal(initial.recipeEditing.cosmeticProvenanceSurvives, true);
    assert.equal(initial.recipeEditing.cosmeticMaterialDiffEmpty, true);
    assert.equal(initial.guidedEditorDom.validationPassed, true);
    assert.equal(initial.guidedEditorDom.savedVersion, 3);
    assert.deepEqual(initial.guidedEditorDom.canonicalCarriers, { leftHz: 396, rightHz: 400 });
    assert.equal(initial.guidedEditorDom.aliasesMatch, true);
    assert.equal(initial.guidedEditorDom.aliasConflict, false);
    assert.equal(initial.customFormalRecipe.referenceStatus, "NOT_APPLICABLE");
    assert.equal(initial.customFormalRecipe.configurationStatus, "PASS");
    assert.equal(initial.customFormalRecipe.runtimeCompatibility, "PASS");
    assert.equal(initial.customFormalRecipe.deterministicSelfCheck, "PASS");
    assert.equal(initial.customFormalRecipe.formalOperationalEligibility, true);
    assert.equal(initial.customFormalRecipe.createAccepted, true);
    assert.equal(initial.customFormalRecipe.commitAccepted, true);
    assert.equal(initial.customFormalRecipe.exactIdentity, true);
    assert.equal(initial.customFormalRecipe.fingerprintPresent, true);
    assert.ok(initial.settings.schemaVersion >= 12);
    assert.ok(initial.profiles.length > 0);
    assert.ok(initial.recipes.length >= 3);
    assert.equal(initial.preRevealRedacted, true);
    assert.equal(initial.outputBlockedBeforeReveal, true);
    assert.equal(initial.processorReady.recipeId, initial.preparedRecipe.recipeId);
    assert.equal(initial.processorReady.recipeVersion, initial.preparedRecipe.version);
    assert.equal(initial.processorReady.sampleRate, initial.preparedRecipe.sampleRate);
    assert.equal(initial.processorReady.configFingerprint, initial.preparedRecipe.configFingerprint);
    assert.equal(initial.audioFinalized.type, "AUDIO_FINALIZED");
    assert.match(initial.audioFinalized.digest, /^[a-f0-9]{64}$/i);
    assert.ok(initial.audioFinalized.totalFrames > 0);
    assert.equal(initial.finalizationReplayBlocked, true);
    assert.equal(initial.returnFinalizationRouteBlocked, true);
    assert.ok(initial.eventTypes.includes("AUDIO_STOP_REQUESTED"));
    assert.ok(initial.eventTypes.includes("AUDIO_FINALIZED"));
    assert.ok(initial.eventTypes.includes("AUDIO_FINALIZATION_REJECTED"));
    assert.ok(initial.audioHealth);
    assert.equal(initial.audioHealthVerification.valid, true, JSON.stringify(initial.audioHealthVerification));
    assert.equal(initial.audioHealth.integrityStatus, "VERIFIED");
    assert.equal(initial.lockedButNotRevealed, true);
    assert.equal(initial.reveal.revealed, true);
    assert.ok(initial.output.length > 0);
    assert.ok(initial.analysis);
    assert.ok(initial.exported?.manifest?.files?.length >= 10, JSON.stringify(initial.exported));
    assert.ok(initial.exported?.hashes?.manifestSha256);
    assert.equal(initial.integrity.valid, true, JSON.stringify(initial.integrity));
    assert.equal(initial.backup.verified, true);
    assert.equal(initial.backupVerification.valid, true, JSON.stringify(initial.backupVerification));
    assert.equal(initial.restore.restored, true);
    assert.equal(initial.restore.schemaVersion, initial.settings.schemaVersion);
    assert.equal(initial.afterRestore.sessionId, initial.sessionId);
    assert.equal(initial.afterRestore.revealed, true);
    assert.ok(initial.afterRestore.actualStartUtc);
    assert.ok(initial.afterRestore.actualEndUtc);
    assert.match(initial.reportNavigation, /Sessions/i);

    const restarted = await launchE2E(root, "restart", initial.sessionId, initial.recipeEditing.editedRecipeId);
    assert.equal(restarted.ok, true, JSON.stringify(restarted));
    assert.equal(restarted.sessionPersisted, true);
    assert.equal(restarted.schemaVersion, initial.settings.schemaVersion);
    assert.equal(restarted.persistedReport.locked, true);
    assert.ok(restarted.persistedOutputCount > 0);
    assert.ok(restarted.audioHealthHistory.some((row) => row.diagnosticId === initial.audioHealth.diagnosticId));
    assert.equal(restarted.recipeEditingPersistence.ok, true, JSON.stringify(restarted.recipeEditingPersistence));
    assert.match(restarted.reportNavigation, /Sessions/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
