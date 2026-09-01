const { contextBridge, ipcRenderer } = require("electron");

const call = (channel, payload) => ipcRenderer.invoke(channel, payload);
const withId = (value) => typeof value === "string" ? { id: value } : value;

contextBridge.exposeInMainWorld(
  "mip",
  Object.freeze({
    getProfiles: (value) => call("profiles:list", value),
    getProfile: (value) => call("profiles:get", withId(value)),
    getProfileVersions: (value) => call("profiles:versions", withId(value)),
    getProfileDraft: (value) => call("profiles:draft:get", withId(value)),
    saveProfileDraft: (value) => call("profiles:draft", value),
    diffProfileVersions: (value) => call("profiles:diff", value),
    saveProfileVersion: (value) => call("profiles:save", value),
    activateProfileVersion: (value) => call("profiles:activate", value),
    duplicateProfile: (value) => call("profiles:duplicate", value),

    getAudioPresets: (value) => call("audio:presets", value),
    getRecipe: (value) => call("recipes:get", withId(value)),
    getRecipeVersions: (value) => call("recipes:versions", withId(value)),
    getRecipeDraft: (value) => call("recipes:draft:get", withId(value)),
    saveRecipeDraft: (value) => call("recipes:draft", value),
    diffRecipeVersions: (value) => call("recipes:diff", value),
    saveRecipeVersion: (value) => call("recipes:save", value),
    activateRecipeVersion: (value) => call("recipes:activate", value),
    duplicateRecipe: (value) => call("audio:duplicate", value),
    quickRecipe: (value) => call("audio:quick", value),

    listSessions: (value) => call("sessions:list", value),
    getSession: (value) => call("sessions:get", withId(value)),
    getEvents: (value) => call("sessions:events", withId(value)),
    verifySession: (value) => call("sessions:verify", withId(value)),
    getOutput: (value) => call("sessions:output", withId(value)),
    createSession: (value) => call("sessions:create", value),
    commitSession: (value) => call("sessions:commit", value),
    startSession: (value) => call("sessions:start", value),
    returnSession: (value) => call("sessions:return", withId(value)),

    prepareAudio: (value) => call("audio:prepare", withId(value)),
    audioReady: (value) => call("audio:ready", value),
    audioStarted: (value) => call("audio:started", value),
    audioStopRequested: (value) => call("audio:stop-requested", value),
    audioFailed: (value) => call("audio:failed", value),
    audioTelemetry: (value) => call("audio:telemetry", value),
    audioFinalized: (value) => call("audio:finalized", value),
    finalizeAudio: (value) => call("audio:finalize", value),
    audioBlock: (value) => call("audio:block", value),

    saveDraft: (value) => call("reports:draft", value),
    getDraft: (value) => call("reports:draft:get", withId(value)),
    getRawReport: (value) => call("reports:get", withId(value)),
    lockReport: (value) => call("reports:lock", value),
    reveal: (value) => call("sessions:reveal", withId(value)),
    getAnalysis: (value) => call("analysis:get", withId(value)),
    getAnalysisHistory: (value) => call("analysis:history", withId(value)),
    runAnalysis: (value) => call("analysis:run", withId(value)),
    addLateAnnotation: (value) => call("annotations:add", value),
    getLateAnnotations: (value) => call("annotations:list", withId(value)),

    backupNow: (value) => call("backup:create", value),
    backupHistory: (value) => call("backup:history", value),
    verifyBackup: (value) => call("backup:verify", value),
    restoreBackup: (value) => call("backup:restore", value),
    getSettings: () => call("settings:get"),
    updateSettings: (value) => call("settings:update", value),
    exportSession: (value) => call("exports:session", withId(value)),
    importLegacy: (value) => call("legacy:import", value),
    exportDiagnostics: (value) => call("diagnostics:export", value),

    audioHealth: (value) => call("audio:health", value),
    prepareAudioHealth: (value) => call("audio:health:prepare", value),
    audioHealthHistory: (value) => call("audio:health-history", value),
    audioHealthDetail: (value) => call("audio:health-detail", withId(value)),
    verifyAudioHealth: (value) => call("audio:health-verify", withId(value)),
    calibrationHistory: (value) => call("calibration:history", value),
    calibrationDetail: (value) => call("calibration:detail", withId(value)),
    verifyCalibration: (value) => call("calibration:verify", withId(value)),
    saveCalibration: (value) => call("calibration:save", value),
    runCalibration: (value) => call("calibration:run", value),

    onProtocolStage: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("mip:protocol-stage", listener);
      return () => ipcRenderer.removeListener("mip:protocol-stage", listener);
    },
    onProtocolComplete: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("mip:protocol-complete", listener);
      return () => ipcRenderer.removeListener("mip:protocol-complete", listener);
    },
    onProtocolReturnCue: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("mip:protocol-return-cue", listener);
      return () => ipcRenderer.removeListener("mip:protocol-return-cue", listener);
    },
  }),
);
