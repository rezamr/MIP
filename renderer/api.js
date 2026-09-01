import { errorMessage } from "./core.js";

const bridge = () => window.mip;

function bodyValue(options) {
  if (!options.body) return {};
  if (typeof options.body === "string") {
    try { return JSON.parse(options.body); } catch { return {}; }
  }
  return options.body;
}

export function hasBridgeMethod(name) {
  return typeof bridge()?.[name] === "function";
}

export async function optionalBridge(names, payload) {
  const name = names.find((candidate) => hasBridgeMethod(candidate));
  return name ? bridge()[name](payload) : undefined;
}

export function bridgeCapabilities() {
  return {
    electron: Boolean(bridge()),
    recipeDrafts: hasBridgeMethod("editRecipeDraft") || hasBridgeMethod("createRecipeDraft"),
    recipeValidation: hasBridgeMethod("validateRecipe") || hasBridgeMethod("validateRecipeDraft"),
    recipeVersionSave: hasBridgeMethod("saveRecipeVersion") || hasBridgeMethod("saveNewRecipeVersion") || hasBridgeMethod("saveRecipe"),
  };
}

export async function api(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = bodyValue(options);
  const parts = url.split("/").filter(Boolean);
  const id = parts[2] ? decodeURIComponent(parts[2]) : undefined;

  if (bridge()) {
    const named = {
      "/api/profiles": ["getProfiles"],
      "/api/audio/presets": ["getAudioPresets"],
      "/api/audio/quick": ["quickRecipe", body],
      "/api/sessions": [method === "POST" ? "createSession" : "listSessions", method === "POST" ? body : undefined],
      "/api/audio/prepare": ["prepareAudio", body],
      "/api/audio/ready": ["audioReady", body],
      "/api/audio/health": ["audioHealth", body],
      "/api/audio/health-history": ["audioHealthHistory"],
      "/api/calibration/history": ["calibrationHistory"],
      "/api/calibration/run": ["runCalibration", body],
      "/api/settings": ["getSettings"],
      "/api/backup/create": ["backupNow"],
      "/api/backup/restore": ["restoreBackup", body],
      "/api/legacy/import": ["importLegacy", body],
      "/api/export/session": ["exportSession", body],
    };
    const direct = named[url];
    if (direct) {
      if (!hasBridgeMethod(direct[0])) throw new Error(`Bridge method ${direct[0]} is unavailable.`);
      return direct.length > 1 && direct[1] !== undefined ? bridge()[direct[0]](direct[1]) : bridge()[direct[0]]();
    }
    if (parts[1] === "profiles" && parts[2] === "duplicate") return bridge().duplicateProfile(body);
    if (parts[1] === "audio" && parts[2] === "duplicate") return bridge().duplicateRecipe(body);
    if (parts[1] === "sessions" && parts[3] === "events") return bridge().getEvents(id);
    if (parts[1] === "sessions" && parts[3] === "verify") return bridge().verifySession(id);
    if (parts[1] === "sessions" && parts[3] === "output") return bridge().getOutput(id);
    if (parts[1] === "sessions" && parts[3] === "start") return bridge().startSession({ ...body, id });
    if (parts[1] === "sessions" && parts[3] === "draft") return bridge().saveDraft({ ...body, id });
    if (parts[1] === "sessions" && parts[3] === "lock-report") return bridge().lockReport({ ...body, id });
    if (parts[1] === "sessions" && parts[3] === "reveal") return bridge().reveal({ id });
    if (parts[1] === "sessions" && parts[3] === "report") return bridge().getRawReport(id);
    if (parts[1] === "sessions" && parts.length === 3) return bridge().getSession(id);
    throw new Error(`Unsupported local API route: ${url}`);
  }

  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });
  const text = await response.text();
  let result = {};
  try { result = text ? JSON.parse(text) : {}; } catch { result = { error: text }; }
  if (!response.ok) throw new Error(result.error || result.errors?.join("; ") || "Request failed");
  return result;
}

export { errorMessage };
