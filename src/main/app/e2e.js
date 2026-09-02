import fs from "node:fs";
import path from "node:path";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function writeResult(file, result) {
  if (!file) return;
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(result, null, 2));
}

/**
 * Run a bounded, no-participant Electron smoke flow through the real preload
 * bridge and renderer AudioWorklet.  This module is only called when the
 * MIP_E2E_RESULT environment variable is explicitly set by a test harness.
 */
export async function runElectronE2E(mainWindow, options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error("E2E window is unavailable");
  const resultPath = options.resultPath;
  const phase = options.phase || "initial";
  try {
    const result = await mainWindow.webContents.executeJavaScript(`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const jsonSafe = (value) => JSON.parse(JSON.stringify(value, (_key, child) => typeof child === "bigint" ? child.toString() : child));
      const forbidden = new Set(["objective", "hiddenObjective", "hidden_objective", "actualObjective", "actualObjectiveState", "participantTarget", "participant_target", "target", "requested", "value", "value_json", "recordHash", "record_hash", "streamDigest", "finalStreamDigest", "analysisHash", "inputHash", "configFingerprint", "finalFingerprint", "machineOutputFingerprint"]);
      const containsForbidden = (value) => {
        if (Array.isArray(value)) return value.some(containsForbidden);
        if (!value || typeof value !== "object") return false;
        return Object.entries(value).some(([key, child]) => forbidden.has(key) || containsForbidden(child));
      };
      const output = { phase: ${JSON.stringify(phase)} };
      if (!window.mip) throw new Error("preload bridge is unavailable");
      output.bridge = true;
      output.settings = await window.mip.getSettings();
      output.profiles = await window.mip.getProfiles();
      output.recipes = await window.mip.getAudioPresets();
      output.rendererReady = document.readyState === "complete" && Boolean(document.querySelector("#app"));
      if (!output.rendererReady) throw new Error("renderer did not initialize");

      // Every top-level page must render its own content and its own offline
      // Page Guide.  This catches stale help state, missing renderer wiring,
      // and packaged-build differences before the formal flow is exercised.
      const pageErrors = [];
      const unhandledErrors = [];
      const previousConsoleError = console.error;
      console.error = (...args) => { pageErrors.push(args.map((arg) => String(arg)).join(" ")); previousConsoleError(...args); };
      window.addEventListener("error", (event) => unhandledErrors.push(String(event.error?.message || event.message || "window error")));
      window.addEventListener("unhandledrejection", (event) => unhandledErrors.push(String(event.reason?.message || event.reason || "unhandled rejection")));
      const pageSelectors = {
        start: "#profileSelect",
        audio: "#livePlay",
        profiles: ".profile-card",
        recipes: "#recipeCards",
        calibration: "#runCal",
        health: "#runHealth",
        reports: "#rows",
        aggregate: "#aggregateSessions",
        settings: "#saveSettings",
      };
      const pageNavigation = [];
      const pageButtons = [...document.querySelectorAll("#nav button")];
      const waitForSelector = async (selector, attempts = 40) => {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const element = document.querySelector(selector);
          if (element) return element;
          await sleep(25);
        }
        return null;
      };
      for (const button of pageButtons) {
        const pageId = button.dataset.page;
        button.click();
        const critical = await waitForSelector(pageSelectors[pageId]);
        await sleep(40);
        const title = document.querySelector("#page-title")?.textContent?.trim() || "";
        const guideButton = document.querySelector("#helpButton");
        guideButton?.click();
        const guideTitleElement = await waitForSelector("#pageGuideTitle");
        const guideTitle = guideTitleElement?.textContent?.trim() || "";
        const guideBody = document.querySelector("#pageGuide")?.innerText || "";
        document.querySelector("#closePageGuide")?.click();
        pageNavigation.push({ pageId, title, guideTitle, rendered: Boolean(critical && document.querySelector("#app")?.innerText?.trim()), criticalControl: pageSelectors[pageId], explanatoryText: guideBody.length > 80, guideMatchesPage: Boolean(title && title === guideTitle) });
      }
      console.error = previousConsoleError;
      output.pageNavigation = pageNavigation;
      output.pageGuideCoverage = {
        pages: pageNavigation.length,
        rendered: pageNavigation.every((page) => page.rendered),
        guides: pageNavigation.filter((page) => page.guideMatchesPage && page.explanatoryText).length,
        consoleErrors: pageErrors,
        unhandledErrors,
      };
      if (!pageNavigation.every((page) => page.rendered && page.guideMatchesPage && page.explanatoryText)) throw new Error("Top-level page/Page Guide E2E failed: " + JSON.stringify(pageNavigation));
      if (pageErrors.length || unhandledErrors.length) throw new Error("Renderer emitted an error during page E2E: " + JSON.stringify({ pageErrors, unhandledErrors }));

      // Calibration acceptance is exercised through the real renderer and
      // preload bridge.  The INTEGER_RANGE is symbolic: the main process
      // samples only 256 observations and never enumerates the one-billion
      // value domain.
      document.querySelector('[data-page="calibration"]')?.click();
      await sleep(120);
      const calibrationUi = {
        controls: Boolean(document.querySelector("#calSpaceSource") && document.querySelector("#calRangeMin") && document.querySelector("#calRangeMax") && document.querySelector("#calN") && document.querySelector("#calRng")),
        selectedOutcomeSpace: false,
        calculatedCardinality: false,
        persistedOutcomeSpace: false,
        persistedCardinality: false,
        persistedSamples: false,
        persistedIntegrity: false,
        provider: false,
      };
      const setInput = (selector, value, eventType = "input") => {
        const element = document.querySelector(selector);
        if (!element) return false;
        element.value = String(value);
        element.dispatchEvent(new Event(eventType, { bubbles: true }));
        return true;
      };
      if (calibrationUi.controls) {
        const source = document.querySelector("#calSpaceSource");
        source.value = "INTEGER_RANGE";
        source.dispatchEvent(new Event("change", { bubbles: true }));
        setInput("#calRangeMin", 0);
        setInput("#calRangeMax", 999999999);
        setInput("#calN", 256);
        setInput("#calRng", "OS_CSPRNG", "change");
        const summary = document.querySelector("#calSpaceSummary")?.textContent || "";
        calibrationUi.selectedOutcomeSpace = /INTEGER_RANGE/.test(summary);
        calibrationUi.calculatedCardinality = /1,?000,?000,?000/.test(summary);
        document.querySelector("#runCal")?.click();
        for (let attempt = 0; attempt < 240; attempt += 1) {
          const historyText = document.querySelector("#calHistory")?.innerText || "";
          if (/INTEGER_RANGE/.test(historyText) && /K=1,?000,?000,?000/.test(historyText)) break;
          await sleep(25);
        }
        const historyText = document.querySelector("#calHistory")?.innerText || "";
        calibrationUi.persistedOutcomeSpace = /INTEGER_RANGE/.test(historyText) && /0\.\.999999999/.test(historyText);
        calibrationUi.persistedCardinality = /K=1,?000,?000,?000/.test(historyText);
        calibrationUi.persistedSamples = /256 observations/.test(historyText);
        const detailButton = document.querySelector("#calHistory [data-cal-detail]");
        detailButton?.click();
        for (let attempt = 0; attempt < 120; attempt += 1) {
          if ((document.querySelector("#calDetail")?.innerText || "").includes("immutable detail")) break;
          await sleep(25);
        }
        const detailText = document.querySelector("#calDetail")?.innerText || "";
        calibrationUi.persistedOutcomeSpace = calibrationUi.persistedOutcomeSpace || /INTEGER_RANGE/.test(detailText);
        calibrationUi.persistedCardinality = calibrationUi.persistedCardinality || /Cardinality K\s*1,?000,?000,?000/.test(detailText);
        calibrationUi.persistedSamples = calibrationUi.persistedSamples || /Samples\s*256/.test(detailText);
        const verification = detailButton?.dataset.calDetail ? await window.mip.verifyCalibration({ id: detailButton.dataset.calDetail }) : null;
        calibrationUi.persistedIntegrity = verification?.valid === true || /VERIFIED/i.test(detailText);
        calibrationUi.provider = /OS_CSPRNG/.test(historyText) || /OS_CSPRNG/.test(detailText);
      }
      output.calibrationUi = calibrationUi;
      if (!Object.values(calibrationUi).every(Boolean)) throw new Error("Large-range Calibration UI E2E failed: " + JSON.stringify(calibrationUi));

      // Exercise the actual Audio Lab buttons through the renderer instead of
      // only testing AudioController directly.  This catches stale-controller
      // references and UI lifecycle races where audio continues after Stop.
      document.querySelector('[data-page="audio"]')?.click();
      await sleep(100);
      const audioControlSmoke = {};
      const playerText = () => document.querySelector("#playerState")?.innerText || "";
      const waitForPlayerState = async (state) => {
        for (let attempt = 0; attempt < 150; attempt += 1) {
          if (new RegExp("\\\\b" + state + "\\\\b", "i").test(playerText())) return true;
          await sleep(20);
        }
        return false;
      };
      document.querySelector("#livePlay")?.click();
      // A second click while the first prepare is still pending must be
      // serialized by the renderer; only the latest controller may remain
      // connected and audible.
      document.querySelector("#livePlay")?.click();
      audioControlSmoke.doublePlay = await waitForPlayerState("playing");
      audioControlSmoke.play = await waitForPlayerState("playing");
      // Re-open the same page while audio is live.  The controls are rebuilt
      // by the renderer, so this catches a UI-only reset that could otherwise
      // leave an active Worklet with a disabled Stop button.
      document.querySelector('[data-page="audio"]')?.click();
      await sleep(100);
      audioControlSmoke.rerender = !document.querySelector("#liveStop")?.disabled;
      document.querySelector("#livePause")?.click();
      audioControlSmoke.pause = await waitForPlayerState("paused");
      document.querySelector("#liveResume")?.click();
      audioControlSmoke.resume = await waitForPlayerState("playing");
      const gainInput = document.querySelector("#liveGain");
      const gainValue = document.querySelector("#liveGainValue");
      if (gainInput && gainValue) {
        gainInput.value = "0.60";
        gainInput.dispatchEvent(new Event("input", { bubbles: true }));
        document.querySelector("#liveGainApply")?.click();
        audioControlSmoke.gain = gainValue.textContent === "0.60";
        await sleep(100);
      } else {
        audioControlSmoke.gain = false;
      }
      document.querySelector("#liveStop")?.click();
      audioControlSmoke.stop = await waitForPlayerState("stopped");
      output.audioControlSmoke = audioControlSmoke;
      if (!Object.values(audioControlSmoke).every(Boolean)) throw new Error("Audio Lab control smoke failed: " + JSON.stringify(audioControlSmoke));

      // The Audio Lab and Recipes checks below are deliberately DOM-backed:
      // they verify the explanatory panels rather than only the IPC payloads.
      output.audioLabPanels = {
        pureRecipeDetails: false,
        sourceProvenance: false,
        engineeringVerification: false,
        activeLayers: false,
        masterGainText: false,
      };
      const recipeSelect = document.querySelector("#recipeSelect");
      if (recipeSelect) {
        recipeSelect.value = "A-U396-4";
        recipeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(30);
        const detailsText = document.querySelector("#recipeDetails")?.innerText || "";
        output.audioLabPanels.pureRecipeDetails = detailsText.includes("Source & Provenance");
        output.audioLabPanels.sourceProvenance = detailsText.includes("Source & Provenance");
        output.audioLabPanels.engineeringVerification = detailsText.includes("Engineering verification");
        output.audioLabPanels.activeLayers = detailsText.includes("Active layers");
        output.audioLabPanels.masterGainText = document.querySelector("#liveGain")?.previousElementSibling?.innerText?.includes("Master gain") || false;
      }
      if (!Object.values(output.audioLabPanels).every(Boolean)) throw new Error("Audio Lab provenance panel E2E failed: " + JSON.stringify(output.audioLabPanels));
      document.querySelector('[data-page="recipes"]')?.click();
      await waitForSelector("#recipeCards");
      const layeredCard = [...document.querySelectorAll(".recipe-card")].find((card) => card.innerText.includes("MIP_LAYERED_EXPERIMENTAL_V1"));
      output.layeredRecipePanels = {
        repositoryBacked: Boolean(layeredCard && layeredCard.innerText.includes("PATENT-ARCHITECTURE RECONSTRUCTION")),
        activeLayers: Boolean(layeredCard && layeredCard.innerText.includes("Active layers")),
        sourceClasses: Boolean(layeredCard && layeredCard.innerText.includes("MIP_RECONSTRUCTION_PARAMETER")),
        engineeringVerification: Boolean(layeredCard && layeredCard.innerText.includes("Engineering verification")),
      };
      if (!Object.values(output.layeredRecipePanels).every(Boolean)) throw new Error("Layered recipe panel E2E failed: " + JSON.stringify(output.layeredRecipePanels));

      // Exercise the complete immutable recipe editor path through the real
      // preload bridge and SQLite repository.  The guided controls must write
      // canonical carriers/execution fields; aliases are only projections.
      const runRecipeEditorFlow = async () => {
        const base = await window.mip.getRecipe({ id: "A-U396-4", version: 1 });
        const editedRecipeId = "E2E_RECIPE_EDIT_" + Date.now();
        const duplicate = await window.mip.duplicateRecipe({ recipeId: "A-U396-4", version: 1, newId: editedRecipeId, activate: false });
        const oldSnapshot = { leftHz: duplicate.carriers[0].leftHz, rightHz: duplicate.carriers[0].rightHz, configFingerprint: duplicate.configFingerprint, provenance: jsonSafe(duplicate.parameterProvenance) };
        const edited = jsonSafe(duplicate);
        edited.carriers = edited.carriers.map((carrier, index) => index === 0 ? { ...carrier, leftHz: 395, rightHz: 399 } : carrier);
        delete edited.leftHz; delete edited.rightHz; delete edited.centerHz; delete edited.beatHz; delete edited.gain;
        delete edited.mode; delete edited.durationMode; delete edited.targetFrames;
        const draft = await window.mip.saveRecipeDraft({ recipe: edited, baseVersion: 1 });
        if (!draft?.validation?.valid) throw new Error("Canonical guided recipe draft validation failed: " + JSON.stringify(draft?.validation));
        const saved = await window.mip.saveRecipeVersion({ recipe: edited, parentVersion: 1, activate: false });
        const reopened = await window.mip.getRecipe({ id: editedRecipeId, version: saved.version });
        const oldAfter = await window.mip.getRecipe({ id: editedRecipeId, version: 1 });
        const { renderOffline } = await import(new URL("./audio-core.js", location.href).href);
        const originalPcm = renderOffline(duplicate, { targetFrames: 2048 }).digest;
        const editedPcm = renderOffline(reopened, { targetFrames: 2048 }).digest;
        const changedProvenance = ["carriers[0].leftHz", "carriers[0].rightHz"].map((pathName) => reopened.parameterProvenance?.[pathName]?.provenanceClass || "MISSING");
        const editor = {
          editedRecipeId,
          draftValid: true,
          savedVersion: saved.version,
          canonicalCarriers: { leftHz: reopened.carriers[0].leftHz, rightHz: reopened.carriers[0].rightHz },
          displayAliases: { leftHz: reopened.leftHz, rightHz: reopened.rightHz, centerHz: reopened.centerHz, beatHz: reopened.beatHz, gain: reopened.gain },
          aliasesMatch: reopened.leftHz === reopened.carriers[0].leftHz && reopened.rightHz === reopened.carriers[0].rightHz && reopened.centerHz === (reopened.leftHz + reopened.rightHz) / 2 && reopened.beatHz === Math.abs(reopened.rightHz - reopened.leftHz) && reopened.gain === reopened.carriers[0].gainLeft,
          configFingerprintChanged: oldSnapshot.configFingerprint !== reopened.configFingerprint,
          pcmDigestChanged: originalPcm !== editedPcm,
          oldVersionUnchanged: oldAfter.carriers[0].leftHz === oldSnapshot.leftHz && oldAfter.carriers[0].rightHz === oldSnapshot.rightHz && oldAfter.configFingerprint === oldSnapshot.configFingerprint && JSON.stringify(oldAfter.parameterProvenance) === JSON.stringify(oldSnapshot.provenance),
          changedProvenance,
          changedProvenanceSafe: changedProvenance.every((value) => !String(value).startsWith("PRIMARY_SOURCE_")),
          engineeringVerification: reopened.engineeringVerification,
          verificationStaleOrNotRun: ["STALE", "REFERENCE VERIFICATION NOT RUN", "NOT_RUN"].includes(String(reopened.engineeringVerification?.status || "").toUpperCase()),
        };
        const cosmeticRecipeId = "E2E_RECIPE_COSMETIC_" + Date.now();
        const cosmeticDuplicate = await window.mip.duplicateRecipe({ recipeId: "A-U396-4", version: 1, newId: cosmeticRecipeId, activate: false });
        const cosmetic = await window.mip.saveRecipeVersion({ recipe: { ...jsonSafe(cosmeticDuplicate), name: "Cosmetic owner label" }, parentVersion: 1, activate: false });
        const cosmeticReopened = await window.mip.getRecipe({ id: cosmeticRecipeId, version: cosmetic.version });
        editor.cosmeticProvenanceSurvives = JSON.stringify(cosmeticReopened.parameterProvenance) === JSON.stringify(cosmeticDuplicate.parameterProvenance);
        editor.cosmeticMaterialDiffEmpty = JSON.stringify(cosmeticReopened.provenanceAudit?.changedMaterialPaths || []) === "[]";
        if (!editor.aliasesMatch || !editor.configFingerprintChanged || !editor.pcmDigestChanged || !editor.oldVersionUnchanged || !editor.changedProvenanceSafe || !editor.verificationStaleOrNotRun || !editor.cosmeticProvenanceSurvives || !editor.cosmeticMaterialDiffEmpty)
          throw new Error("Recipe editor/repository E2E failed: " + JSON.stringify(editor));
        return editor;
      };

      if (${JSON.stringify(phase)} === "restart") {
        const expected = ${JSON.stringify(options.expectedSessionId || null)};
        const expectedRecipe = ${JSON.stringify(options.expectedRecipeId || null)};
        const sessions = await window.mip.listSessions();
        output.sessions = sessions;
        output.sessionPersisted = Boolean(sessions.find((session) => session.sessionId === expected));
        output.schemaVersion = output.settings.schemaVersion;
        output.persistedReport = expected ? await window.mip.getRawReport({ id: expected }) : null;
        output.persistedOutputCount = expected ? (await window.mip.getOutput({ id: expected })).length : 0;
        output.audioHealthHistory = await window.mip.audioHealthHistory({});
        if (expectedRecipe) {
          const persistedRecipe = await window.mip.getRecipe({ id: expectedRecipe, version: 2 });
          const persistedOldRecipe = await window.mip.getRecipe({ id: expectedRecipe, version: 1 });
          const { renderOffline: renderPersistedOffline } = await import(new URL("./audio-core.js", location.href).href);
          const persistedOldDigest = persistedOldRecipe ? renderPersistedOffline(persistedOldRecipe, { targetFrames: 2048 }).digest : null;
          const persistedEditedDigest = persistedRecipe ? renderPersistedOffline(persistedRecipe, { targetFrames: 2048 }).digest : null;
          output.recipeEditingPersistence = {
            recipeId: expectedRecipe,
            canonicalCarriers: { leftHz: persistedRecipe?.carriers?.[0]?.leftHz, rightHz: persistedRecipe?.carriers?.[0]?.rightHz },
            aliasesMatch: Boolean(persistedRecipe && persistedRecipe.leftHz === persistedRecipe.carriers?.[0]?.leftHz && persistedRecipe.rightHz === persistedRecipe.carriers?.[0]?.rightHz),
            configFingerprint: persistedRecipe?.configFingerprint || null,
            oldConfigFingerprint: persistedOldRecipe?.configFingerprint || null,
            configFingerprintChanged: Boolean(persistedOldRecipe && persistedRecipe && persistedOldRecipe.configFingerprint !== persistedRecipe.configFingerprint),
            oldPcmDigest: persistedOldDigest,
            pcmDigest: persistedEditedDigest,
            pcmDigestChanged: Boolean(persistedOldDigest && persistedEditedDigest && persistedOldDigest !== persistedEditedDigest),
            oldVersionUnchanged: Boolean(persistedOldRecipe && persistedOldRecipe.carriers?.[0]?.leftHz === 394 && persistedOldRecipe.carriers?.[0]?.rightHz === 398 && persistedOldRecipe.parameterProvenance?.["carriers[0].leftHz"]?.provenanceClass === "MIP_OPERATIONAL_DEFINED"),
            provenance: persistedRecipe?.parameterProvenance?.["carriers[0].leftHz"]?.provenanceClass || null,
            verificationStatus: persistedRecipe?.engineeringVerification?.status || null,
          };
          output.recipeEditingPersistence.ok = output.recipeEditingPersistence.canonicalCarriers.leftHz === 395 && output.recipeEditingPersistence.canonicalCarriers.rightHz === 399 && output.recipeEditingPersistence.aliasesMatch && output.recipeEditingPersistence.configFingerprintChanged && output.recipeEditingPersistence.pcmDigestChanged && output.recipeEditingPersistence.oldVersionUnchanged && !String(output.recipeEditingPersistence.provenance).startsWith("PRIMARY_SOURCE_") && ["STALE", "REFERENCE VERIFICATION NOT RUN", "NOT_RUN"].includes(String(output.recipeEditingPersistence.verificationStatus).toUpperCase());
          if (!output.recipeEditingPersistence.ok) throw new Error("Recipe editor restart persistence failed: " + JSON.stringify(output.recipeEditingPersistence));
        }
        document.querySelector('[data-page="reports"]')?.click();
        await sleep(300);
        output.reportNavigation = document.querySelector("#page-title")?.textContent || "";
        return output;
      }

      if (${JSON.stringify(phase)} === "migration") {
        const expected = ${JSON.stringify(options.expectedSessionId || null)};
        const sessions = await window.mip.listSessions();
        output.sessions = sessions;
        output.sessionPersisted = Boolean(sessions.find((session) => session.sessionId === expected));
        output.schemaVersion = output.settings.schemaVersion;
        output.migrationSession = expected ? await window.mip.getSession({ id: expected }) : null;
        output.migrationIntegrity = expected ? await window.mip.verifySession({ id: expected }) : null;
        document.querySelector('[data-page="reports"]')?.click();
        await sleep(300);
        output.reportNavigation = document.querySelector("#page-title")?.textContent || "";
        return output;
      }

      output.recipeEditing = await runRecipeEditorFlow();

      // Regression guard for the actual Guided Editor DOM.  The IPC flow above
      // proves the repository contract; this flow proves that the visible L/R
      // inputs update carriers[0] rather than stale top-level projections.
      const runGuidedEditorDomFlow = async () => {
        document.querySelector('[data-page="recipes"]')?.click();
        await waitForSelector("#recipeCards");
        let editButton = null;
        for (let attempt = 0; attempt < 80 && !editButton; attempt += 1) {
          editButton = [...document.querySelectorAll("[data-edit-recipe]")]
            .find((button) => button.dataset.editRecipe === output.recipeEditing.editedRecipeId && button.dataset.version === "1");
          if (!editButton) await sleep(25);
        }
        if (!editButton) throw new Error("Guided Editor DOM fixture was not rendered");
        editButton.click();
        const left = await waitForSelector("#recipeLeftHz");
        const right = await waitForSelector("#recipeRightHz");
        if (!left || !right) throw new Error("Guided Editor canonical carrier inputs are unavailable");
        const change = (element, value) => {
          element.value = String(value);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        };
        change(left, 396);
        change(right, 400);
        document.querySelector("#validateRecipeDraft")?.click();
        await sleep(180);
        const validationText = document.querySelector("#recipeValidation")?.textContent || "";
        document.querySelector("#saveRecipeVersion")?.click();
        await waitForSelector("#recipeCards");
        await sleep(180);
        const reopened = await window.mip.getRecipe({ id: output.recipeEditing.editedRecipeId });
        let aliasConflict = false;
        try {
          const { normalizeRecipe } = await import(new URL("./audio-core.js", location.href).href);
          normalizeRecipe(reopened);
        } catch {
          aliasConflict = true;
        }
        const result = {
          recipeId: reopened.recipeId,
          savedVersion: reopened.version,
          validationPassed: /Draft is valid/i.test(validationText),
          canonicalCarriers: { leftHz: reopened.carriers?.[0]?.leftHz, rightHz: reopened.carriers?.[0]?.rightHz },
          aliasesMatch: reopened.leftHz === reopened.carriers?.[0]?.leftHz && reopened.rightHz === reopened.carriers?.[0]?.rightHz && reopened.centerHz === (reopened.leftHz + reopened.rightHz) / 2 && reopened.beatHz === Math.abs(reopened.rightHz - reopened.leftHz),
          aliasConflict,
        };
        if (!result.validationPassed || result.savedVersion !== 3 || result.canonicalCarriers.leftHz !== 396 || result.canonicalCarriers.rightHz !== 400 || !result.aliasesMatch || result.aliasConflict)
          throw new Error("Guided Editor DOM regression failed: " + JSON.stringify(result));
        return result;
      };
      output.guidedEditorDom = await runGuidedEditorDomFlow();

      const session = await window.mip.createSession({
        profileId: "BASELINE_NOW_BINARY_V1",
        recordType: "dry",
        participantLabel: "Electron E2E fixture",
        seed: "electron-e2e-domain-seed",
      });
      output.sessionId = session.sessionId;
      output.preRevealSession = await window.mip.getSession({ id: session.sessionId });
      output.preRevealRedacted = !Object.prototype.hasOwnProperty.call(output.preRevealSession, "hiddenObjective");
      output.preRevealReport = await window.mip.getRawReport({ id: session.sessionId });
      output.preRevealEvents = await window.mip.getEvents({ id: session.sessionId });
      output.preRevealVerify = await window.mip.verifySession({ id: session.sessionId });
      output.preRevealAnalysis = await window.mip.getAnalysis({ id: session.sessionId });
      output.preRevealAnalysisHistory = await window.mip.getAnalysisHistory({ id: session.sessionId });
      output.preRevealAnnotations = await window.mip.getLateAnnotations({ id: session.sessionId });
      output.preRevealDraft = await window.mip.getDraft({ id: session.sessionId });
      output.preRevealLeakFree = [output.preRevealSession, output.preRevealReport, output.preRevealEvents, output.preRevealVerify, output.preRevealAnalysis, output.preRevealAnalysisHistory, output.preRevealAnnotations, output.preRevealDraft].every((value) => !containsForbidden(value));
      if (!output.preRevealLeakFree) throw new Error("A pre-reveal IPC response contained hidden result material");
      try {
        await window.mip.getOutput({ id: session.sessionId });
        output.outputBlockedBeforeReveal = false;
      } catch {
        output.outputBlockedBeforeReveal = true;
      }

      const prepared = await window.mip.prepareAudio({ id: session.sessionId });
      output.preparedRecipe = prepared.audio;
      const { default: AudioController } = await import(new URL("./audio-controller.js", location.href).href);
      const controller = new AudioController({ timeoutMs: 5000 });
      const ready = await controller.prepare(prepared.audio, { timeoutMs: 5000, handshake: prepared.handshake });
      output.processorReady = {
        processorVersion: ready.processorVersion,
        recipeId: ready.recipeId,
        recipeVersion: ready.recipeVersion,
        sampleRate: ready.sampleRate,
        configFingerprint: ready.configFingerprint,
      };
      await window.mip.audioReady({ id: session.sessionId, ack: jsonSafe(ready) });
      const startedSession = await window.mip.startSession({ id: session.sessionId, memoryConfirmed: true });
      const started = await controller.start({ timeoutMs: 5000 });
      await window.mip.audioStarted({ id: session.sessionId, ack: jsonSafe(started) });
      output.scheduler = startedSession.scheduler;
      await sleep(180);
      const finalization = await controller.stop({ timeoutMs: 5000 });
      output.audioFinalized = {
        type: finalization.type,
        digest: finalization.digest,
        totalFrames: finalization.totalFrames,
        sampleRate: finalization.sampleRate,
        continuity: finalization.continuity,
        clipping: finalization.clipping,
      };
      await window.mip.audioFinalized({ id: session.sessionId, finalization: jsonSafe(finalization) });
      output.returned = await window.mip.returnSession({ id: session.sessionId });
      try {
        await window.mip.audioFinalized({ id: session.sessionId, finalization: jsonSafe(finalization) });
        output.finalizationReplayBlocked = false;
      } catch {
        output.finalizationReplayBlocked = true;
      }
      try {
        await window.mip.returnSession({ id: session.sessionId, finalization: jsonSafe(finalization) });
        output.returnFinalizationRouteBlocked = false;
      } catch {
        output.returnFinalizationRouteBlocked = true;
      }

      const rawDraft = { subjectiveTime: "Unknown", intensity: "0", modality: "unknown", certainty: "100", notes: "Electron automated dry-run fixture" };
      await window.mip.saveDraft({ id: session.sessionId, report: rawDraft });
      await window.mip.lockReport({ id: session.sessionId, report: rawDraft });
      output.lockedReport = await window.mip.getRawReport({ id: session.sessionId });
      output.lockedButNotRevealed = output.lockedReport.locked === true && output.lockedReport.redacted === true;
      output.reveal = await window.mip.reveal({ id: session.sessionId });
      output.output = await window.mip.getOutput({ id: session.sessionId });
      output.analysis = await window.mip.getAnalysis({ id: session.sessionId });
      output.annotations = await window.mip.addLateAnnotation({ id: session.sessionId, kind: "E2E_NOTE", annotation: { source: "automated" } });
      output.events = await window.mip.getEvents({ id: session.sessionId });
      output.eventTypes = output.events.events.map((event) => event.type);
      output.integrity = await window.mip.verifySession({ id: session.sessionId });
      output.exported = await window.mip.exportSession({ id: session.sessionId });
      const healthController = new AudioController({ timeoutMs: 5000 });
      const healthRecipe = await window.mip.getRecipe({ id: prepared.audio.recipeId, version: prepared.audio.version });
      const healthChallenge = await window.mip.prepareAudioHealth({ recipeId: healthRecipe.recipeId, recipeVersion: healthRecipe.version, sampleRate: healthRecipe.sampleRate, channels: healthRecipe.channels });
      await healthController.prepare(healthRecipe, { timeoutMs: 5000, handshake: healthChallenge.handshake });
      await healthController.start({ timeoutMs: 5000 });
      await sleep(120);
      const healthFinalization = await healthController.stop({ timeoutMs: 5000 });
      const healthDiagnostics = healthController.diagnostics();
      const healthTelemetry = {
        ...(healthDiagnostics.telemetry || {}),
        type: "TELEMETRY",
        recipeId: healthFinalization.recipeId || prepared.audio.recipeId,
        recipeVersion: healthFinalization.recipeVersion || prepared.audio.version,
        sampleRate: healthFinalization.sampleRate || prepared.audio.sampleRate,
        generatedFrames: healthFinalization.totalFrames,
        digest: healthFinalization.digest,
        continuity: healthFinalization.continuity,
        clipping: healthFinalization.clipping,
        configFingerprint: healthRecipe.configFingerprint,
        processorVersion: healthFinalization.processorVersion,
        digestVersion: healthFinalization.digestVersion,
        pcmFormat: healthFinalization.pcmFormat,
        channels: healthFinalization.channels,
        sessionId: healthFinalization.sessionId,
        trialId: healthFinalization.trialId,
        audioNonce: healthFinalization.audioNonce,
      };
      output.audioHealth = await window.mip.audioHealth({
        diagnosticId: "HEALTH-E2E-" + Date.now(),
        recipeId: healthTelemetry.recipeId,
        recipeVersion: healthTelemetry.recipeVersion,
        startedUtc: new Date(Date.now() - 120).toISOString(),
        endedUtc: new Date().toISOString(),
        sampleRate: healthTelemetry.sampleRate,
        baseLatency: healthDiagnostics.baseLatency,
        outputLatency: healthDiagnostics.outputLatency,
        generatedFrames: healthTelemetry.generatedFrames,
        continuity: healthTelemetry.continuity,
        clipping: healthTelemetry.clipping,
        contextStates: healthDiagnostics.contextStateChanges,
        ownerResult: "Uncertain",
        ownerNote: "Automated AudioWorklet health fixture; physical acoustics not assessed.",
        telemetry: healthTelemetry,
        challengeId: healthChallenge.challengeId,
        digest: healthFinalization.digest,
        format: { digestVersion: healthFinalization.digestVersion || "MIP_PCM_SHA256_V1", sampleRate: healthFinalization.sampleRate, channels: 2, sampleFormat: "PCM16LE_INTERLEAVED_LR" },
        observations: healthDiagnostics.contextStateChanges.map((change) => ({ contextState: change.state, observationType: "CONTEXT_STATE" })),
        checkMode: "CUSTOM",
      });
      output.audioHealthVerification = await window.mip.verifyAudioHealth({ id: output.audioHealth.diagnosticId });
      output.backup = await window.mip.backupNow({});
      output.backupVerification = await window.mip.verifyBackup({ backupId: output.backup.backupId, sha256: output.backup.sha256 });
      const restored = await window.mip.restoreBackup({ backupId: output.backup.backupId, sha256: output.backup.sha256 });
      output.restore = { restored: restored.restored, schemaVersion: restored.schemaVersion, postRestore: restored.postRestore };
      output.afterRestore = await window.mip.getSession({ id: session.sessionId });

      // Prove the independent formal-operational path with a genuinely custom
      // identity.  This is deliberately last because the dry fixture is
      // inspected through the real main-process session IPC and then moved to
      // an explicit AUDIO_FAILED terminal/recovery state; no participant or
      // AudioWorklet is started and it must not block the backup/restore gate.
      const runCustomFormalRecipeFlow = async () => {
        const customRecipeId = output.recipeEditing.editedRecipeId;
        const activatedRecipe = await window.mip.activateRecipeVersion({ id: customRecipeId, version: output.guidedEditorDom.savedVersion });
        const customProfileId = "E2E_CUSTOM_FORMAL_PROFILE_" + Date.now();
        const profileCopy = await window.mip.duplicateProfile({ profileId: "BASELINE_NOW_BINARY_V1", version: 1, newId: customProfileId, activate: false });
        const profileDraft = jsonSafe(profileCopy);
        profileDraft.audio = { recipeId: customRecipeId, version: output.guidedEditorDom.savedVersion };
        const savedProfile = await window.mip.saveProfileVersion({ profile: profileDraft, parentVersion: 1, activate: true });
        const customDraft = await window.mip.createSession({
          profileId: customProfileId,
          profileVersion: savedProfile.version,
          recordType: "dry",
          participantLabel: "Electron custom formal fixture",
          seed: "electron-custom-formal-seed",
          deferCommit: true,
        });
        const customCommit = await window.mip.commitSession({
          id: customDraft.sessionId,
          memoryConfirmed: true,
          safetyConfirmed: true,
          safetyNote: "Automated dry custom-recipe gate.",
        });
        const prepared = await window.mip.prepareAudio({ id: customDraft.sessionId });
        const committedAudio = prepared.audio;
        const result = {
          recipeId: committedAudio.recipeId,
          recipeVersion: committedAudio.version,
          configFingerprint: committedAudio.configFingerprint,
          referenceStatus: activatedRecipe.engineeringVerification?.referenceStatus,
          configurationStatus: activatedRecipe.engineeringVerification?.configurationStatus,
          runtimeCompatibility: activatedRecipe.engineeringVerification?.runtimeCompatibility,
          deterministicSelfCheck: activatedRecipe.engineeringVerification?.deterministicSelfCheck,
          formalOperationalEligibility: activatedRecipe.formalOperationalEligibility === true,
          profileId: savedProfile.id,
          profileVersion: savedProfile.version,
          sessionId: customDraft.sessionId,
          createAccepted: customDraft.status === "DRAFT",
          commitAccepted: customCommit.status === "COMMITTED",
          exactIdentity: committedAudio.recipeId === customRecipeId && committedAudio.version === output.guidedEditorDom.savedVersion,
          fingerprintPresent: /^[a-f0-9]{64}$/i.test(String(committedAudio.configFingerprint || "")),
        };
        // Close the dry fixture without starting a participant/audio phase.
        await window.mip.audioFailed({ id: customDraft.sessionId, error: "E2E custom formal fixture cleanup" });
        if (result.referenceStatus !== "NOT_APPLICABLE" || result.configurationStatus !== "PASS" || result.runtimeCompatibility !== "PASS" || result.deterministicSelfCheck !== "PASS" || !result.formalOperationalEligibility || !result.createAccepted || !result.commitAccepted || !result.exactIdentity || !result.fingerprintPresent)
          throw new Error("Custom formal recipe IPC workflow failed: " + JSON.stringify(result));
        return result;
      };
      output.customFormalRecipe = await runCustomFormalRecipeFlow();
      document.querySelector('[data-page="reports"]')?.click();
      await sleep(300);
      output.reportNavigation = document.querySelector("#page-title")?.textContent || "";
      output.ok = true;
      return output;
    })()`, true);
    writeResult(resultPath, { ok: true, ...result });
    return result;
  } catch (error) {
    const failure = { ok: false, phase, error: error?.message || String(error), stack: error?.stack || null };
    writeResult(resultPath, failure);
    throw error;
  }
}

export default runElectronE2E;
