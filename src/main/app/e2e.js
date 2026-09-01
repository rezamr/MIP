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

      if (${JSON.stringify(phase)} === "restart") {
        const expected = ${JSON.stringify(options.expectedSessionId || null)};
        const sessions = await window.mip.listSessions();
        output.sessions = sessions;
        output.sessionPersisted = Boolean(sessions.find((session) => session.sessionId === expected));
        output.schemaVersion = output.settings.schemaVersion;
        output.persistedReport = expected ? await window.mip.getRawReport({ id: expected }) : null;
        output.persistedOutputCount = expected ? (await window.mip.getOutput({ id: expected })).length : 0;
        output.audioHealthHistory = await window.mip.audioHealthHistory({});
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
