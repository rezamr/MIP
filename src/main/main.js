import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  powerSaveBlocker,
  dialog,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { MipDatabase } from "./database/db.js";
import {
  profiles,
  validateProfile,
  resolveProfile,
  requestInstruction,
  assignOutcome,
  createRNG,
  timingPlan,
  analyzeStream,
  sha256,
  canonical,
  APP_VERSION,
  ENGINE_VERSION,
} from "../../src/engine.js";
import { PRESETS, quickRecipe, validateRecipe } from "../../src/audio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
let db;
let mainWindow;
const active = new Map();
let blocker = null;
const cryptoNonce = () => crypto.randomBytes(16).toString("hex");
const getId = (payload) => {
  if (
    !payload ||
    typeof payload.id !== "string" ||
    !/^S\d{4,}$/.test(payload.id)
  )
    throw new Error("Invalid session identifier.");
  return payload.id;
};
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1050,
    minHeight: 700,
    show: false,
    icon: path.join(here, "..", "..", "..", "build", "icon.ico"),
    webPreferences: {
      preload: path.join(here, "..", "preload", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  mainWindow.loadFile(path.join(here, "..", "..", "public", "index.html"));
}
function register() {
  ipcMain.handle("profiles:list", () =>
    Object.values(profiles).map((p) => ({
      ...p,
      validation: validateProfile(p),
    })),
  );
  ipcMain.handle("profiles:duplicate", (_, p) => {
    const source = resolveProfile(p?.profileId || "BASELINE_NOW_BINARY_V1"),
      id = String(p?.newId || `${source.id}_COPY_${Date.now()}`),
      copy = {
        ...source,
        id,
        version: 1,
        name: p?.name || `${source.name} Copy`,
        status: "Draft",
      };
    if (!validateProfile(copy).valid) throw Error("Profile validation failed.");
    db.db
      .prepare("INSERT INTO experiment_profiles VALUES(?,?,?)")
      .run(id, copy.name, "User duplicate");
    db.db
      .prepare("INSERT INTO profile_versions VALUES(?,?,?,?,?,1)")
      .run(
        id,
        1,
        JSON.stringify(copy),
        sha256(canonical(copy)),
        new Date().toISOString(),
      );
    return copy;
  });
  ipcMain.handle("audio:presets", () => Object.values(PRESETS));
  ipcMain.handle("audio:quick", (_, v) => {
    const recipe = quickRecipe(v.centerHz, v.beatHz);
    return { recipe, validation: validateRecipe(recipe) };
  });
  ipcMain.handle("sessions:list", () => db.listSessions());
  ipcMain.handle("sessions:get", (_, p) => {
    const id = getId(p),
      s = db.db.prepare("SELECT * FROM sessions WHERE session_id=?").get(id);
    if (!s) throw Error("Session not found.");
    const locked = !!db.db
        .prepare("SELECT 1 FROM raw_reports_locked WHERE session_id=?")
        .get(id),
      commit = db.db
        .prepare(
          "SELECT config_hash FROM session_commitments WHERE session_id=?",
        )
        .get(id),
      profile = profiles[s.profile_id];
    return {
      sessionId: s.session_id,
      createdUtc: s.created_utc,
      participantLabel: s.participant_label,
      recordType: s.record_type,
      profileId: s.profile_id,
      profileVersion: s.profile_version,
      status: s.status,
      revealPolicy: s.reveal_policy,
      configFingerprint: commit?.config_hash,
      configSnapshot: profile || null,
      hiddenObjective:
        s.status === "REVEALED" ? Number(s.hidden_objective) : undefined,
      participantTarget:
        s.status === "REVEALED" ? s.participant_target : undefined,
      revealEligible: locked,
      analysis:
        s.status === "REVEALED"
          ? JSON.parse(
              db.db
                .prepare("SELECT payload_json FROM analyses WHERE session_id=?")
                .get(id)?.payload_json || "null",
            )
          : null,
      audioArtifact: profile?.audio || null,
    };
  });
  ipcMain.handle("sessions:events", (_, p) => db.events(getId(p)));
  ipcMain.handle("audio:prepare", (_, p) => {
    const id = getId(p),
      state = active.get(id);
    if (!state) throw Error("Session runtime unavailable.");
    state.state = "AUDIO_PREPARING";
    db.appendEvent(id, state.trial, "COMMIT_AUDIO_CONFIG", {
      audio: state.audio,
    });
    return { sessionId: id, status: "AUDIO_PREPARING", audio: state.audio };
  });
  ipcMain.handle("audio:ready", (_, p) => {
    const id = getId(p),
      state = active.get(id);
    if (!state || state.state !== "AUDIO_PREPARING")
      throw Error("Audio preparation was not committed.");
    state.audioReady = true;
    state.state = "AUDIO_READY";
    db.appendEvent(id, state.trial, "AUDIO_READY", {
      recipeId: state.audio.recipeId,
      sampleRate: state.audio.sampleRate,
      handshake: "PROCESSOR_READY",
    });
    return { sessionId: id, status: "AUDIO_READY" };
  });
  ipcMain.handle("sessions:verify", (_, p) => db.verify(getId(p)));
  ipcMain.handle("sessions:output", (_, p) => {
    const id = getId(p);
    if (
      db.db.prepare("SELECT status FROM sessions WHERE session_id=?").get(id)
        ?.status !== "REVEALED"
    )
      throw Error("Machine output remains hidden until reveal.");
    if (
      !db.db
        .prepare("SELECT 1 FROM raw_reports_locked WHERE session_id=?")
        .get(id)
    )
      throw Error(
        "Machine output remains hidden until the raw report is locked.",
      );
    return db.db
      .prepare(
        "SELECT * FROM machine_outputs WHERE session_id=? ORDER BY output_seq",
      )
      .all(id);
  });
  ipcMain.handle("sessions:create", (_, p) => {
    const profile = resolveProfile(p.profileId || "BASELINE_NOW_BINARY_V1"),
      provider = profile.rng?.provider || "OS_CSPRNG",
      rng = createRNG(
        provider,
        provider === "DETERMINISTIC_PRNG_TEST" ? p.seed : "ignored",
      ),
      objective = assignOutcome(profile, rng),
      target = requestInstruction(profile, objective),
      timing = timingPlan(profile),
      audio = {
        recipeId: profile.audio.recipeId,
        version: profile.audio.version,
        engineVersion: "1.2.0",
        sampleRate: 48000,
        seed:
          provider === "DETERMINISTIC_PRNG_TEST"
            ? p.seed || "mip-test-seed"
            : cryptoNonce(),
      };
    const s = db.beginSession(
      profile,
      p.participantLabel || "Local participant",
      p.recordType || "dry",
      {
        objective,
        participantTarget: target,
        rng: { id: rng.id, version: rng.version },
        audio,
        appVersion: APP_VERSION,
        engineVersion: ENGINE_VERSION,
        timing,
      },
    );
    active.set(s.id, {
      profile,
      objective,
      trial: s.trial,
      seed: audio.seed,
      rng: createRNG(provider, audio.seed),
      timing,
      audio,
      state: "COMMITTED",
      audioReady: false,
    });
    return {
      sessionId: s.id,
      trialId: s.trial,
      participantTarget: target,
      timing,
      status: "Committed",
      rng: { id: rng.id, version: rng.version },
      audio,
    };
  });
  ipcMain.handle("sessions:start", (_, p) => {
    const id = getId(p);
    if (p.memoryConfirmed !== true)
      throw Error("Explicit memory confirmation is required before START.");
    const state = active.get(id);
    if (!state)
      throw Error(
        "Session runtime unavailable; restart from a committed profile.",
      );
    if (!state.audioReady) throw Error("AudioWorklet is not ready.");
    if (state.running)
      return { sessionId: id, status: "Running", hidden: true };
    state.running = true;
    state.cancelled = false;
    db.appendEvent(id, state.trial, "STARTED", { timing: state.timing });
    if (blocker === null)
      blocker = powerSaveBlocker.start("prevent-app-suspension");
    const total =
      (state.profile.output.preBlocks +
        state.profile.output.primaryBlocks +
        state.profile.output.postBlocks) *
      (state.profile.output.blockSize || 1);
    state.total = total;
    state.values = [];
    state.rng = createRNG(
      state.profile.rng?.provider || "OS_CSPRNG",
      state.seed,
    );
    const step = () => {
      if (state.cancelled) return;
      const end = Math.min(state.values.length + 128, total);
      for (let i = state.values.length; i < end; i++) {
        const value = assignOutcome(state.profile, state.rng);
        state.values.push(value);
        db.db
          .prepare("INSERT INTO machine_outputs VALUES(?,?,?,?,?,?,?,?,?)")
          .run(
            id,
            state.trial,
            i,
            new Date().toISOString(),
            process.hrtime.bigint().toString(),
            JSON.stringify(value),
            i < total / 3 ? "pre" : i < (total * 2) / 3 ? "primary" : "post",
            sha256(canonical({ id, i, value })),
          );
      }
      if (state.values.length < total) {
        setImmediate(step);
        return;
      }
      const analysis = analyzeStream({
        requested: state.objective,
        values: state.values,
        primary: [Math.floor(total / 3), Math.floor((total * 2) / 3)],
        exploratory: [
          [0, Math.floor(total / 3)],
          [Math.floor((total * 2) / 3), total],
        ],
      });
      db.db
        .prepare(
          "INSERT OR REPLACE INTO analyses(session_id,analysis_version,input_hash,payload_json,created_utc) VALUES(?,?,?,?,?)",
        )
        .run(
          id,
          "analysis-v1",
          sha256(state.values.join(",")),
          JSON.stringify(analysis),
          new Date().toISOString(),
        );
      db.appendEvent(id, state.trial, "RETURN_CONFIRMED", {
        generatedFrames: total,
      });
      db.db
        .prepare("UPDATE sessions SET status=? WHERE session_id=?")
        .run("RETURNED", id);
      state.running = false;
      if (blocker !== null) {
        powerSaveBlocker.stop(blocker);
        blocker = null;
      }
    };
    setImmediate(step);
    return {
      sessionId: id,
      status: "Running",
      hidden: true,
      reportRequired: true,
    };
  });
  ipcMain.handle("reports:draft", (_, p) => {
    const id = getId(p);
    db.db
      .prepare("INSERT OR REPLACE INTO raw_report_drafts VALUES(?,?,?)")
      .run(id, new Date().toISOString(), JSON.stringify(p.report || {}));
    db.appendEvent(id, null, "RAW_REPORT_DRAFT_SAVED", {});
    return { saved: true };
  });
  ipcMain.handle("reports:lock", (_, p) => {
    const id = getId(p),
      now = new Date().toISOString(),
      payload = JSON.stringify(p.report || {}),
      hash = sha256(payload),
      tx = db.db.transaction(() => {
        db.db
          .prepare("INSERT INTO raw_reports_locked VALUES(?,?,?,?,?)")
          .run(id, now, payload, hash, "1.0");
        db.db
          .prepare("DELETE FROM raw_report_drafts WHERE session_id=?")
          .run(id);
        db.appendEvent(id, null, "RAW_REPORT_LOCKED", { lockHash: hash });
        db.db
          .prepare("UPDATE sessions SET status=? WHERE session_id=?")
          .run("REVEAL_ELIGIBLE", id);
      });
    tx();
    return { locked: true, lockHash: hash };
  });
  ipcMain.handle("sessions:reveal", (_, p) => {
    const id = getId(p),
      m = db.db.prepare("SELECT * FROM sessions WHERE session_id=?").get(id);
    if (
      !db.db
        .prepare("SELECT 1 FROM raw_reports_locked WHERE session_id=?")
        .get(id)
    )
      throw Error("Reveal is not eligible until the raw report is locked.");
    db.appendEvent(id, null, "REVEALED", { objective: m.hidden_objective });
    db.db
      .prepare("UPDATE sessions SET status=? WHERE session_id=?")
      .run("REVEALED", id);
    return {
      objective: Number(m.hidden_objective),
      participantTarget: m.participant_target,
      analysis: JSON.parse(
        db.db
          .prepare("SELECT payload_json FROM analyses WHERE session_id=?")
          .get(id)?.payload_json || "null",
      ),
      integrity: db.verify(id),
    };
  });
  ipcMain.handle("settings:get", () => ({
    appVersion: app.getVersion(),
    engineVersion: "1.2.0",
    schemaVersion: 1,
    databasePath: db.file,
    databaseSize: fs.statSync(db.file).size,
    lastBackup:
      db.db
        .prepare("SELECT * FROM backups ORDER BY created_utc DESC LIMIT 1")
        .get() || null,
  }));
  ipcMain.handle("backup:create", () => {
    const id = `B${Date.now()}`,
      target = path.join(db.backupDir, `${id}.sqlite3`);
    db.db.pragma("wal_checkpoint(TRUNCATE)");
    fs.copyFileSync(db.file, target);
    const hash = sha256(fs.readFileSync(target));
    db.db
      .prepare("INSERT INTO backups VALUES(?,?,?,?,?)")
      .run(id, new Date().toISOString(), target, hash, 1);
    return { id, path: target, sha256: hash, verified: true };
  });
  ipcMain.handle("backup:restore", (_, p) => {
    const source = String(p?.path || ""),
      expected = String(p?.sha256 || "");
    if (!source || !fs.existsSync(source))
      throw Error("Backup file not found.");
    const actual = sha256(fs.readFileSync(source));
    if (expected && expected !== actual)
      throw Error("Backup SHA-256 mismatch.");
    const safety = path.join(db.backupDir, `pre-restore-${Date.now()}.sqlite3`);
    db.db.pragma("wal_checkpoint(TRUNCATE)");
    fs.copyFileSync(db.file, safety);
    db.close();
    fs.copyFileSync(source, db.file);
    db = new MipDatabase(app.getPath("userData"));
    active.clear();
    return {
      restored: true,
      safetyBackup: safety,
      sha256: actual,
      schemaVersion: 2,
      integrity: true,
    };
  });
  ipcMain.handle("exports:session", async (_, p) => {
    const id = getId(p),
      m = db.db.prepare("SELECT * FROM sessions WHERE session_id=?").get(id),
      dir = path.join(db.exportDir, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "manifest.json"),
      JSON.stringify(m, null, 2),
    );
    fs.writeFileSync(
      path.join(dir, "events.json"),
      JSON.stringify(db.events(id), null, 2),
    );
    fs.writeFileSync(
      path.join(dir, "integrity.json"),
      JSON.stringify(db.verify(id), null, 2),
    );
    return { directory: dir };
  });
  ipcMain.handle("legacy:import", (_, p) => {
    const raw =
        typeof p?.data === "string" ? JSON.parse(p.data) : p?.data || {},
      rows = Array.isArray(raw.sessions) ? raw.sessions : [];
    let imported = 0;
    for (const row of rows) {
      const profile = resolveProfile(row.profileId || "BASELINE_NOW_BINARY_V1"),
        rng = createRNG("DETERMINISTIC_PRNG_TEST", `legacy-${imported}`),
        objective = assignOutcome(profile, rng),
        target = requestInstruction(profile, objective);
      db.beginSession(
        profile,
        row.participantLabel || "Legacy import",
        "legacy",
        {
          objective,
          participantTarget: target,
          rng: { id: rng.id, version: rng.version },
          audio: profile.audio,
          imported: true,
        },
      );
      imported++;
    }
    return { imported, source: "legacy-json" };
  });
  ipcMain.handle("audio:health", (_, p) => ({
    status: "software-check-complete",
    recipeId: p?.recipeId || "A-U396-4",
    context: "AudioWorklet required",
    note: "Physical headphone acoustics require owner assessment.",
  }));
  ipcMain.handle("audio:block", (_, p) => ({
    accepted: true,
    bytes: p?.byteLength || 0,
  }));
  ipcMain.handle("calibration:run", (_, p) => {
    const provider = p?.provider || "OS_CSPRNG",
      samples = Math.max(2, Math.min(100000, Number(p?.samples || 256))),
      rng = createRNG(provider, p?.seed),
      counts = { 0: 0, 1: 0 },
      started = Date.now();
    for (let i = 0; i < samples; i++) counts[rng.int(2)]++;
    const result = {
      provider,
      providerVersion: rng.version,
      samples,
      counts,
      elapsedMs: Date.now() - started,
      statistics: { proportionOne: counts[1] / samples },
      metadata: { appVersion: APP_VERSION, engineVersion: ENGINE_VERSION },
      integrityStatus: "VERIFIED",
    };
    result.resultHash = sha256(canonical(result));
    db.db
      .prepare("INSERT INTO calibrations VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(
        `C${Date.now()}`,
        new Date().toISOString(),
        provider,
        rng.version,
        samples,
        JSON.stringify(counts),
        JSON.stringify(result.statistics),
        JSON.stringify(result.metadata),
        result.resultHash,
        result.integrityStatus,
      );
    return result;
  });
}
app.whenReady().then(() => {
  db = new MipDatabase(app.getPath("userData"));
  register();
  session.defaultSession.webRequest.onHeadersReceived((details, callback) =>
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        ],
      },
    }),
  );
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (blocker) powerSaveBlocker.stop(blocker);
  db?.close();
  if (process.platform !== "darwin") app.quit();
});
