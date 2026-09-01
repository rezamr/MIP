import fs from "node:fs";
import path from "node:path";
import { canonical, sha256 } from "../../engine.js";
import { json, now } from "../database/db.js";

const safeName = (value) => String(value).replace(/[^a-zA-Z0-9._-]/g, "_");

function writeJson(root, name, value) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
  return file;
}

function removeSecrets(value) {
  if (Array.isArray(value)) return value.map(removeSecrets);
  if (!value || typeof value !== "object") return value;
  const hidden = new Set(["objective", "hiddenObjective", "hidden_objective", "actualObjective", "actualObjectiveState", "participantTarget", "participant_target", "canonicalConfig", "canonical_config", "configSnapshot", "manifestJson", "manifest_json", "material"]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !hidden.has(key)).map(([key, child]) => [key, removeSecrets(child)]));
}

export class SessionExporter {
  constructor(owner, options = {}) {
    this.owner = owner;
    this.db = owner.db || owner;
    this.exportDir = owner.exportDir || options.exportDir;
    fs.mkdirSync(this.exportDir, { recursive: true });
  }

  _session(sessionId) { return this.db.prepare("SELECT * FROM sessions WHERE session_id=?").get(sessionId); }

  _fullData(sessionId) {
    const session = this._session(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const details = this.db.prepare("SELECT * FROM session_details WHERE session_id=?").get(sessionId);
    const commitment = this.db.prepare("SELECT * FROM session_commitments WHERE session_id=?").get(sessionId);
    const profile = session.profile_id && session.profile_version !== null ? this.db.prepare("SELECT * FROM profile_versions WHERE profile_id=? AND version=?").get(session.profile_id, session.profile_version) : null;
    const audioCommit = this.db.prepare("SELECT * FROM audio_commits WHERE session_id=?").get(sessionId);
    const recipe = audioCommit?.recipe_id && audioCommit.recipe_version !== null ? this.db.prepare("SELECT * FROM audio_recipe_versions WHERE recipe_id=? AND version=?").get(audioCommit.recipe_id, audioCommit.recipe_version) : null;
    const trials = this.db.prepare("SELECT * FROM trials WHERE session_id=? ORDER BY trial_seq").all(sessionId).map((row) => ({ ...row, config: json(row.config_json, {}) }));
    const events = this.db.prepare("SELECT * FROM evidence_events WHERE session_id=? ORDER BY seq").all(sessionId).map((row) => ({ ...row, payload: json(row.payload_json, {}) }));
    const outputs = this.db.prepare("SELECT * FROM machine_outputs WHERE session_id=? ORDER BY output_seq").all(sessionId).map((row) => ({ ...row, value: json(row.value_json, null) }));
    const finalization = this.db.prepare("SELECT * FROM output_finalizations WHERE session_id=?").get(sessionId);
    const rawReport = this.db.prepare("SELECT * FROM raw_reports_locked WHERE session_id=?").get(sessionId);
    const annotations = this.db.prepare("SELECT * FROM late_annotations WHERE session_id=? ORDER BY id").all(sessionId).map((row) => ({ ...row, payload: json(row.payload_json, {}) }));
    const analysis = this.db.prepare("SELECT * FROM analyses WHERE session_id=?").get(sessionId);
    const health = audioCommit ? this.db.prepare("SELECT h.* FROM audio_health h WHERE h.recipe_id=? AND h.recipe_version=? ORDER BY h.started_utc").all(audioCommit.recipe_id, audioCommit.recipe_version).map((row) => ({ ...row, continuity: json(row.continuity_json, {}), contextStates: json(row.context_states_json, []) })) : [];
    return { session, details, commitment, profile, audioCommit, recipe, trials, events, outputs, finalization, rawReport, annotations, analysis, health };
  }

  exportSession(sessionId, options = {}) {
    const data = this._fullData(sessionId);
    const integrity = this.owner.integrity.verifySession(sessionId, { persist: false });
    // A locked raw report only satisfies the gate.  Hidden objective,
    // participant target, and machine values become exportable only after the
    // separate REVEALED transition has been persisted.
    const revealed = ["REVEALED", "COMPLETE"].includes(data.session.status);
    const includeHidden = options.includeHidden === true && revealed;
    const manifest = {
      exportSchemaVersion: "1.2",
      exportedUtc: now(),
      sessionId,
      sourceSchemaVersion: integrity.schemaVersion,
      selfContained: true,
      revealed,
      includesHiddenValues: includeHidden,
      files: [],
    };
    const temporary = path.join(this.exportDir, `.${safeName(sessionId)}.tmp-${process.hrtime.bigint()}`);
    const target = path.join(this.exportDir, safeName(sessionId));
    fs.mkdirSync(temporary, { recursive: true });
    try {
      const sessionDocument = {
        ...data.session,
        ...(includeHidden ? { hiddenObjective: data.session.hidden_objective, participantTarget: data.session.participant_target } : {}),
        ...(includeHidden ? { manifest: json(data.session.manifest_json, null) } : {}),
      };
      const report = data.rawReport ? { lockedUtc: data.rawReport.locked_utc, lockHash: data.rawReport.lock_hash, schemaVersion: data.rawReport.schema_version, ...(includeHidden ? { payload: json(data.rawReport.payload_json, {}) } : {}) } : null;
      const documents = new Map([
        ["manifest.json", manifest],
        ["session.json", includeHidden ? sessionDocument : removeSecrets(sessionDocument)],
        ["commitment.json", includeHidden ? { ...data.commitment, canonicalConfig: json(data.commitment?.canonical_config, null) } : { sessionId, configHash: data.commitment?.config_hash || null }],
        ["profile-snapshot.json", includeHidden ? { ...data.profile, config: json(data.profile?.config_json, null) } : { profileId: data.profile?.profile_id || null, version: data.profile?.version || null, configHash: data.profile?.config_hash || null }],
        ["audio-snapshot.json", includeHidden ? { commit: data.audioCommit ? { ...data.audioCommit, config: json(data.audioCommit.config_json, null) } : null, recipe: data.recipe ? { ...data.recipe, config: json(data.recipe.config_json, null) } : null } : { configHash: data.audioCommit?.config_hash || null, recipeId: data.audioCommit?.recipe_id || null, recipeVersion: data.audioCommit?.recipe_version || null }],
        ["trials.json", data.trials.map((trial) => ({ trial_id: trial.trial_id, session_id: trial.session_id, trial_seq: trial.trial_seq, trial_type: trial.trial_type, config: trial.config, state: trial.state }))],
        ["events.json", includeHidden ? data.events.map(({ payload_json, ...event }) => event) : data.events.map(({ payload_json, payload, ...event }) => ({ ...event, payload: removeSecrets(payload) }))],
        ["output.json", includeHidden ? data.outputs.map(({ value_json, ...output }) => output) : data.outputs.map(({ value_json, value, ...output }) => output)],
        ["output-finalization.json", data.finalization],
        ["raw-report.locked.json", report],
        ["late-annotations.json", includeHidden ? data.annotations : data.annotations.map((annotation) => ({ ...annotation, payload: removeSecrets(annotation.payload) }))],
        ["analysis.json", includeHidden ? data.analysis && { ...data.analysis, payload: json(data.analysis.payload_json, null) } : data.analysis && { session_id: data.analysis.session_id, analysis_version: data.analysis.analysis_version, input_hash: data.analysis.input_hash, created_utc: data.analysis.created_utc }],
        ["audio-health.json", data.health],
        ["integrity.json", integrity],
        ["summary.txt", this.readableSummary(data.session, integrity, revealed)],
      ]);
      for (const [name, value] of documents) {
        if (name === "summary.txt") {
          fs.writeFileSync(path.join(temporary, name), value);
        } else {
          writeJson(temporary, name, value);
        }
      }
      const files = [];
      for (const name of fs.readdirSync(temporary).sort()) {
        const full = path.join(temporary, name);
        if (!fs.statSync(full).isFile()) continue;
        files.push({ path: name.replaceAll(path.sep, "/"), sizeBytes: fs.statSync(full).size, sha256: sha256(fs.readFileSync(full)) });
      }
      manifest.files = files.filter((file) => file.path !== "manifest.json");
      writeJson(temporary, "manifest.json", manifest);
      const manifestSha256 = sha256(fs.readFileSync(path.join(temporary, "manifest.json")));
      writeJson(temporary, "hashes.json", { manifestSha256, files: [...manifest.files, { path: "manifest.json", sha256: manifestSha256, sizeBytes: fs.statSync(path.join(temporary, "manifest.json")).size }] });
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      fs.renameSync(temporary, target);
      return { directory: target, sessionId, manifest, hashes: JSON.parse(fs.readFileSync(path.join(target, "hashes.json"), "utf8")), integrity };
    } catch (error) {
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  readableSummary(session, integrity, revealed) {
    return [
      `MIP session ${session.session_id}`,
      `Created UTC: ${session.created_utc}`,
      `Profile: ${session.profile_id || "UNKNOWN"} v${session.profile_version ?? "UNKNOWN"}`,
      `Status: ${session.status}`,
      `Reveal: ${revealed ? "revealed" : session.status === "REVEAL_ELIGIBLE" ? "eligible (not revealed)" : "gated"}`,
      `Integrity: ${integrity.valid ? "verified" : "requires review"}`,
      `Events: ${integrity.eventCount}`,
      `Machine outputs: ${integrity.machineOutputCount}`,
      `Schema: ${integrity.schemaVersion}`,
    ].join("\n") + "\n";
  }

  export(sessionId, options = {}) { return this.exportSession(sessionId, options); }
}

export class Exporter extends SessionExporter {}
