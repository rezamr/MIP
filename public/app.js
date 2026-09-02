import { RendererAudio } from "../renderer/audio/controller.js";
import { pageTitle } from "../renderer/pages/index.js";
import { renderAnalysisBands } from "../renderer/charts/analysis-chart.js";
import { renderDistribution } from "../renderer/charts/distribution-chart.js";
import { renderReportTabs } from "../renderer/components/ReportTabs.js";
import { fieldRow as renderFieldRow, renderError } from "../renderer/core.js";
import { sessionService } from "../renderer/services/session-service.js";
import { activeLayers as projectActiveLayers, summarizeProvenance } from "./audio-core.js";
import { getPageHelp, FIELD_HELP } from "../renderer/help-registry.js";

const $ = (s) => document.querySelector(s),
  app = $("#app");
const fieldRow = renderFieldRow;
let profiles = [],
  presets = [],
  selectedProfile = null,
  currentSession = null;
let preSessionState = { baseline: "Ordinary alertness", environment: "", safetyConfirmed: false };
let protocolHandlersBound = false;
let audioGeneration = 0;
let stopInFlight = null;
let prepareInFlight = null;
const pendingPreparations = new Set();
let stopEvidencePollTimer = null;
let player = {
  ctx: null,
  node: null,
  gain: null,
  controller: null,
  audioRuntime: null,
  status: "stopped",
  started: 0,
  elapsed: 0,
  timer: null,
  frames: 0,
  finalization: null,
};
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const jsonSafe = (value) => JSON.parse(JSON.stringify(value, (_key, child) => typeof child === "bigint" ? child.toString() : child));
function canonicalRecipeEditorDraft(recipe) {
  const draft = jsonSafe(recipe || {});
  if (Array.isArray(draft.carriers) && draft.carriers[0])
    for (const key of ["leftHz", "rightHz", "leftFrequencyHz", "rightFrequencyHz", "frequencyHz", "hz", "centerHz", "beatHz", "gain"]) delete draft[key];
  if (draft.execution && typeof draft.execution === "object") {
    delete draft.durationMode;
    delete draft.targetFrames;
  }
  if (draft.synthesisMode !== undefined) delete draft.mode;
  return draft;
}
function setCanonicalRecipePath(root, pathName, value) {
  const keys = String(pathName).match(/[^.[\]]+/g) || [];
  if (!keys.length) return;
  let target = root;
  for (const key of keys.slice(0, -1)) {
    const next = target[key];
    if (!next || typeof next !== "object") target[key] = /^\d+$/.test(key) ? [] : {};
    target = target[key];
  }
  target[keys.at(-1)] = value;
  if (pathName === "execution.mode" && value === "live" && root.execution)
    root.execution.targetFrames = null;
  if (Array.isArray(root.carriers) && root.carriers[0])
    for (const key of ["leftHz", "rightHz", "leftFrequencyHz", "rightFrequencyHz", "frequencyHz", "hz", "centerHz", "beatHz", "gain"]) delete root[key];
  if (root.execution && typeof root.execution === "object") {
    delete root.durationMode;
    delete root.targetFrames;
  }
  if (root.synthesisMode !== undefined) delete root.mode;
}
const LAYER_LABELS = Object.freeze([
  ["primaryCarrier", "Primary carrier"],
  ["additionalCarriers", "Additional carriers"],
  ["monauralLayers", "Monaural layers"],
  ["septon", "Septon / multi-carrier"],
  ["whitePinkRedNoise", "White / pink / red noise"],
  ["phasedPink", "Phased-pink"],
  ["am", "AM"],
  ["fm", "FM"],
  ["delay", "Delay"],
  ["comb", "Comb"],
  ["lowFrequencySweep", "Low-frequency sweep"],
  ["envelope", "Envelope"],
  ["cues", "Cues"],
  ["protocolCues", "Protocol cue track"],
  ["voiceReferences", "Voice references"],
]);
function layerProjection(recipe) {
  const layers = recipe?.activeLayers || projectActiveLayers(recipe || {});
  return `<div class="active-layers"><h4>Active layers</h4>${LAYER_LABELS.map(([key, label]) => `<div class="review-row"><span>${label}</span><strong>${layers[key] ? "ACTIVE" : "NONE"}</strong></div>`).join("")}${recipe?.protocolCueVersion ? `<p class="subtle">Protocol cues are a separately versioned, nonsemantic track (${esc(recipe.protocolCueVersion)}); they are not part of the selected recipe's component condition.</p>` : ""}</div>`;
}
function provenanceProjection(recipe) {
  const summary = recipe?.parameterProvenance ? summarizeProvenance(recipe) : { classes: [], unknownBlocked: [], reconstruction: [], sourceVerified: [], formalEligible: recipe?.formalEligibility !== false, formalOperationalEligible: recipe?.formalOperationalEligibility === true };
  const classes = summary.classes.length ? summary.classes.join(", ") : (recipe?.provenance || "UNKNOWN");
  const formalOperational = summary.formalOperationalEligible === true;
  const activation = recipe?.isActive === true && recipe?.isDraft !== true && recipe?.status === "ACTIVE" ? "ACTIVE" : "NOT ACTIVE";
  return `<div class="provenance-panel"><h4>Source &amp; Provenance</h4><div class="review-row"><span>Recipe status</span><strong>${esc(recipe?.historicalStatus || "NOT_HISTORICALLY_EXACT")}</strong></div><div class="review-row"><span>Recipe class</span><strong>${esc(recipe?.provenance || "UNKNOWN")}</strong></div><div class="review-row"><span>Parameter classes</span><strong>${esc(classes)}</strong></div><div class="review-row"><span>Activation</span><strong>${activation}</strong></div><div class="review-row"><span>Provenance completeness</span><strong>${summary.provenanceEligible === false ? "BLOCKED" : "VALID"}</strong></div><div class="review-row"><span>Formal operational use</span><strong>${formalOperational ? "ELIGIBLE (subject to protocol)" : "NOT ELIGIBLE"}</strong></div><div class="review-row"><span>Historical-exact claim</span><strong>${esc(recipe?.historicalExactness || "NOT_CLAIMED")}</strong></div>${summary.unknownBlocked?.length ? `<p class="callout warning">Unknown fields block formal/historical use: ${esc(summary.unknownBlocked.join(", "))}</p>` : ""}${summary.reconstruction?.length ? `<p class="subtle">Reconstruction choices are engineering parameters, not historical facts: ${esc(summary.reconstruction.slice(0, 8).join(", "))}${summary.reconstruction.length > 8 ? "…" : ""}</p>` : ""}</div>`;
}
function formalOperationalStatus(recipe) {
  return summarizeProvenance(recipe || {}).formalOperationalEligible === true;
}
function verificationProjection(recipe) {
  const verification = recipe?.engineeringVerification || {};
  const rows = ["referenceStatus", "configurationStatus", "runtimeCompatibility", "deterministicSelfCheck", "operationalChecksPassed", "status", "configurationValidation", "deterministicFixture", "channelAssignment", "carrierVerification", "noiseVerification", "sweepVerification", "amVerification", "fmVerification", "continuity", "clipping", "pcmDigestFixture", "configFingerprint", "fixtureId", "referenceConfigFingerprint"];
  const noFixture = verification.referenceStatus === "NOT_APPLICABLE";
  return `<div class="verification-panel"><h4>Engineering verification</h4>${rows.map((key) => `<div class="review-row"><span>${esc(key.replace(/[A-Z]/g, (m) => ` ${m}`).replace(/^./, (m) => m.toUpperCase()))}</span><strong>${esc(verification[key] === true ? "PASS" : verification[key] === false ? "FAIL" : verification[key] || "NOT RECORDED")}</strong></div>`).join("")}${noFixture ? '<p class="callout">No golden reference fixture applies to this custom recipe.</p>' : ""}<p class="subtle">Reference verification is separate from configuration/runtime checks and the owner's physical listening observation.</p></div>`;
}
function recipeDetailProjection(recipe) {
  if (!recipe) return '<div class="empty">Select a recipe to inspect its effective configuration.</div>';
  return `<div class="grid three" style="margin-top:14px"><div class="card">${provenanceProjection(recipe)}</div><div class="card">${layerProjection(recipe)}</div><div class="card">${verificationProjection(recipe)}</div></div>`;
}
function showPageGuide(pageId = document.querySelector("#nav button.active")?.dataset.page || "start") {
  const guide = getPageHelp(pageId);
  const existing = document.querySelector("#pageGuide");
  existing?.remove();
  const modal = document.createElement("div");
  modal.id = "pageGuide";
  modal.className = "help-modal-backdrop";
  modal.innerHTML = `<section class="help-modal" role="dialog" aria-modal="true" aria-labelledby="pageGuideTitle"><div class="section-intro"><div><p class="eyebrow">HELP / PAGE GUIDE · OFFLINE OWNER GUIDE</p><h2 id="pageGuideTitle">${esc(guide.title)}</h2></div><button class="icon-button" id="closePageGuide" aria-label="Close page guide">×</button></div>${[["Purpose", guide.purpose], ["What the system is doing", guide.doing], ["What you should do", guide.doNow], ["What not to change casually", guide.avoid], ["What the values mean", guide.values], ["Pass / warning / failure", guide.statuses], ["What this does not prove", guide.boundary], ["How to test this page", guide.test]].map(([heading, text]) => `<div class="help-block"><h3>${heading}</h3><p>${esc(text)}</p></div>`).join("")}<details class="help-fields"><summary>Field definitions</summary><div class="grid two">${Object.entries(FIELD_HELP).map(([key, text]) => `<div><strong>${esc(key)}</strong><p>${esc(text)}</p></div>`).join("")}</div></details><p class="subtle help-offline-note">This complete Page Guide is bundled locally for offline operation. The longer owner acceptance document is packaged at <span class="mono">docs/MIP_OWNER_OPERATION_AND_ACCEPTANCE_GUIDE_V1.2.md</span>; no Internet connection is required.</p></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  $("#closePageGuide")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  document.addEventListener("keydown", function escape(event) { if (event.key === "Escape") { close(); document.removeEventListener("keydown", escape); } });
}
async function api(url, opt = {}) {
  if (window.mip) {
    const method = (opt.method || "GET").toUpperCase(),
      body = opt.body ? JSON.parse(opt.body) : {},
      parts = url.split("/").filter(Boolean),
      id = parts[2];
    if (url === "/api/profiles") return window.mip.getProfiles();
    if (url === "/api/audio/presets") return window.mip.getAudioPresets();
    if (url === "/api/audio/quick") return window.mip.quickRecipe(body);
    if (url === "/api/sessions" && method === "GET")
      return window.mip.listSessions();
    if (url === "/api/sessions" && method === "POST")
      return window.mip.createSession(body);
    if (parts[1] === "sessions" && parts[3] === "events")
      return window.mip.getEvents(id);
    if (parts[1] === "sessions" && parts[3] === "verify")
      return window.mip.verifySession(id);
    if (parts[1] === "sessions" && parts[3] === "output")
      return window.mip.getOutput(id);
    if (parts[1] === "sessions" && parts[3] === "start")
      return window.mip.startSession({ ...body, id });
    if (parts[1] === "sessions" && parts[3] === "draft")
      return window.mip.saveDraft({ ...body, id });
    if (parts[1] === "sessions" && parts[3] === "lock-report")
      return window.mip.lockReport({ ...body, id });
    if (parts[1] === "sessions" && parts[3] === "reveal")
      return window.mip.reveal({ id });
    if (parts[1] === "sessions" && parts[3] === "report")
      return window.mip.getRawReport(id);
    if (parts[1] === "sessions" && parts.length === 3)
      return window.mip.getSession(id);
    throw Error(`Unsupported local API route: ${url}`);
  }
  const r = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opt,
    }),
    d = await r.json();
  if (!r.ok) throw Error(d.error || d.errors?.join("; ") || "Request failed");
  return d;
}
function toast(s) {
  const t = $("#toast");
  t.textContent = s;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
function pill(s) {
  return `<span class="pill ${/valid|locked|revealed|complete/i.test(s) ? "valid" : /fail|abort/i.test(s) ? "bad" : "neutral"}">${esc(s)}</span>`;
}
function setPage(p) {
  if (player.formal && player.status !== "stopped") {
    toast("The formal session is active; use the return control to finalize audio before leaving this screen.");
    return;
  }
  if (player.healthCheckMode && player.status !== "stopped" && p !== "health") {
    toast("An Audio Health check is active; stop and persist it before leaving this screen.");
    return;
  }
  if (!player.formal && !player.healthCheckMode && player.status !== "stopped" && p !== "audio") {
    // Live previews must never survive a page transition after their controls
    // have been removed from the DOM.  The generation guard in stopPlayer()
    // makes this safe even when a user clicks navigation repeatedly.
    stopPlayer().catch((error) => toast(`Audio stopped with a cleanup warning: ${error.message}`));
  }
  document
    .querySelectorAll("#nav button")
    .forEach((b) => b.classList.toggle("active", b.dataset.page === p));
  $("#page-title").textContent = pageTitle(p);
  const render = ({
    start: renderStart,
    audio: renderAudio,
    profiles: renderProfiles,
    recipes: renderRecipes,
    calibration: renderCalibration,
    health: renderAudioHealth,
    reports: renderReports,
    aggregate: renderAggregate,
    settings: renderSettings,
  })[p];
  if (typeof render !== "function") {
    renderError(app, "Page unavailable", new Error(`Unknown page: ${p}`), () => setPage("start"));
    return;
  }
  try {
    Promise.resolve(render()).catch((error) => {
      renderError(app, "Page unavailable", error, () => setPage(p));
    });
  } catch (error) {
    renderError(app, "Page unavailable", error, () => setPage(p));
  }
}
document
  .querySelectorAll("#nav button")
  .forEach((b) => (b.onclick = () => setPage(b.dataset.page)));
document.querySelector("#helpButton")?.addEventListener("click", () => showPageGuide());
function steps(n) {
  return `<div class="stepper">${["Profile", "Pre-session", "Target & memory", "Readiness", "Commit & start"].map((x, i) => `<div class="step ${i + 1 === n ? "active" : ""} ${i + 1 < n ? "done" : ""}"><span class="number">${i + 1 < n ? "✓" : i + 1}</span>${x}</div>${i < 4 ? '<span class="step-line"></span>' : ""}`).join("")}</div>`;
}
async function init() {
  [profiles, presets] = await Promise.all([
    api("/api/profiles"),
    api("/api/audio/presets"),
  ]);
  selectedProfile = profiles[0];
  if (window.mip?.onProtocolStage && !protocolHandlersBound) {
    protocolHandlersBound = true;
    window.mip.onProtocolStage((stage) => {
      const label = $("#sessionStage");
      if (label && stage?.stageType) label.textContent = `${stage.stageType.replaceAll("_", " ")} · hidden output protected`;
    });
    window.mip.onProtocolComplete(async (payload) => {
      if (!currentSession?.sessionId || payload?.sessionId !== currentSession.sessionId) return;
      try {
        if (player.status !== "stopped") {
          const finalization = await stopPlayer();
          if (finalization) await window.mip.audioFinalized({ id: currentSession.sessionId, finalization: jsonSafe(finalization) });
        }
        await window.mip.returnSession({ id: currentSession.sessionId });
        renderRaw();
      } catch (error) { toast(`Automatic protocol completion failed: ${error.message}`); }
    });
    window.mip.onProtocolReturnCue(async (payload) => {
      if (!currentSession?.sessionId || payload?.sessionId !== currentSession.sessionId) return;
      // The main process owns the cue.  This listener only performs the
      // AudioWorklet STOP handshake; formalReturn remains main-process code.
      if (player.status === "stopped" || player.status === "stopping") return;
      try {
        await window.mip.audioStopRequested({ id: currentSession.sessionId, reason: "protocol_return_cue" });
        const finalization = await stopPlayer();
        if (finalization) await window.mip.audioFinalized({ id: currentSession.sessionId, finalization: jsonSafe(finalization) });
      } catch (error) {
        toast(`Automatic return cue stop failed: ${error.message}`);
        try { await window.mip.audioFailed({ id: currentSession.sessionId, error: error.message }); } catch {}
      }
    });
  }
  renderStart();
}
function renderStart() {
  const available = profiles.filter((profile) => !profile.isDraft && profile.status !== "UNKNOWN" && profile.isActive === true && profile.reveal?.policy !== "AFTER_BLOCK_LOCK");
  selectedProfile = available.find((profile) => profile.id === selectedProfile?.id) || available[0] || selectedProfile;
  app.innerHTML = `<div class="section-intro"><div><h2>Begin a controlled research session</h2><p>The operational profile is primary; demonstrations remain available in Experiment Profiles.</p></div>${pill("Step 1 of 5")}</div>${steps(1)}<div class="card"><div class="field"><label for="profileSelect">Operational session profile</label><select id="profileSelect">${available.map((profile) => `<option value="${esc(profile.id)}" ${profile.id === selectedProfile?.id ? "selected" : ""}>${esc(profile.name)} v${esc(profile.version)} · ${esc(profile.timing?.mode || "UNKNOWN")}</option>`).join("")}</select><small>Profiles are resolved by immutable ID/version from SQLite.</small></div><div id="profileSummary"></div></div><div class="actions" style="margin-top:20px"><button class="button primary" id="next">Continue to pre-session setup →</button></div>`;
  const summary = () => { const profile = profiles.find((item) => item.id === $("#profileSelect")?.value) || selectedProfile; selectedProfile = profile; $("#profileSummary").innerHTML = `<div class="review-row"><span>Purpose</span><strong>${esc(profile?.purpose || "Not recorded")}</strong></div><div class="review-row"><span>Outcome / timing</span><strong>${esc(profile?.outcomeSpace?.type || "UNKNOWN")} · ${esc(profile?.timing?.mode || "UNKNOWN")}</strong></div><div class="review-row"><span>Audio</span><strong>${esc(profile?.audio?.recipeId || "UNKNOWN")} · live synthesis</strong></div>`; };
  $("#profileSelect").onchange = summary;
  summary();
  $("#next").onclick = renderPre;
}
async function renderPre() {
  const settings = window.mip?.getSettings ? await window.mip.getSettings().catch(() => ({})) : {};
  const profileSpace = selectedProfile?.outcomeSpace || settings?.researchDefaults?.outcomeSpace || { type: "BINARY", values: [0, 1] };
  const integerSpace = String(profileSpace.type || "").toUpperCase() === "INTEGER_RANGE";
  const minDefault = profileSpace.minInclusive ?? profileSpace.min ?? 0;
  const maxDefault = profileSpace.maxInclusive ?? profileSpace.max ?? 1;
  const profileAnalysis = selectedProfile?.analysis || {};
  const appAnalysis = settings?.researchDefaults?.temporalAnalysis || settings?.researchDefaults?.analysis || {};
  const inheritedWindows = Array.isArray(profileAnalysis.windows) && profileAnalysis.windows.length
    ? profileAnalysis.windows
    : Array.isArray(appAnalysis.windows) && appAnalysis.windows.length
      ? appAnalysis.windows
      : [];
  const profileWindow = inheritedWindows[0] || (profileAnalysis.primaryWindow && typeof profileAnalysis.primaryWindow === "object" ? profileAnalysis.primaryWindow : {});
  const endpointDefault = String(profileAnalysis.primaryEndpoint || appAnalysis.primaryEndpoint || "EXACT_SLOT").toUpperCase();
  const intervalDefault = selectedProfile?.output?.intervalMs ?? profileAnalysis.intervalMs ?? appAnalysis.intervalMs ?? "";
  const stopAnchoredProfile = String(selectedProfile?.timing?.mode || "").toUpperCase() === "PARTICIPANT_STOP_ANCHORED";
  const stopOffsetDefault = Number(selectedProfile?.timing?.targetOffsetMs ?? 0);
  const stopOffsetRelationship = stopOffsetDefault < 0 ? "before" : stopOffsetDefault > 0 ? "after" : "at";
  const stopOffsetMagnitude = Math.abs(stopOffsetDefault) / (Math.abs(stopOffsetDefault) >= 3_600_000 && Math.abs(stopOffsetDefault) % 3_600_000 === 0 ? 3_600_000 : Math.abs(stopOffsetDefault) >= 60_000 && Math.abs(stopOffsetDefault) % 60_000 === 0 ? 60_000 : 1_000);
  const stopOffsetUnit = Math.abs(stopOffsetDefault) >= 3_600_000 && Math.abs(stopOffsetDefault) % 3_600_000 === 0 ? "hours" : Math.abs(stopOffsetDefault) >= 60_000 && Math.abs(stopOffsetDefault) % 60_000 === 0 ? "minutes" : "seconds";
  const localDateTime = (offsetMs) => {
    const value = new Date(Date.now() + offsetMs);
    const pad = (item) => String(item).padStart(2, "0");
    return { date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`, time: `${pad(value.getHours())}:${pad(value.getMinutes())}` };
  };
  const defaultWindowDate = localDateTime(0).date;
  const defaultWindowStart = { date: defaultWindowDate, time: "00:00" };
  const defaultWindowEnd = { date: defaultWindowDate, time: "23:59" };
  const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  app.innerHTML = `<div class="section-intro"><div><h2>Pre-session state</h2><p>Capture baseline context and the protocol overrides that will be committed for this session.</p></div></div>${steps(2)}<div class="card"><div class="form-grid"><div class="field"><label for="participant">Participant label</label><input id="participant" value="Local participant"></div><div class="field"><label for="record">Record type</label><select id="record"><option value="dry">Dry run / validation</option><option value="contemporaneous">Contemporaneous research record</option></select></div><div class="field"><label for="experimentMode">Experiment mode</label><select id="experimentMode"><option value="INFLUENCE">Influence</option><option value="FUTURE_TARGET">Future target / recognition</option><option value="CONTROL">Control</option><option value="SHAM">Sham</option></select><small>The mode is committed before START; future targets are generated only at their anchor.</small></div><div class="field"><label for="prediction">Future-target prediction <span id="predictionRequired">(required for FUTURE_TARGET)</span></label><input id="prediction" placeholder="Only used in FUTURE_TARGET mode"><small>This prediction is committed before START and is not the actual future target.</small></div><div class="field" id="futureDelayField" style="display:none"><label for="futureDelayMinutes">Future target delay (minutes)</label><input id="futureDelayMinutes" type="number" min="1" max="525600" value="1440"><small>The target is generated only at this committed future anchor; it is not generated early and hidden.</small></div><div class="field" id="outcomeRangeFields" style="display:${integerSpace ? "block" : "none"}"><label>Integer outcome-space override</label><div class="form-grid"><input id="outcomeMin" type="number" step="1" value="${esc(minDefault)}" aria-label="Outcome range minimum"><input id="outcomeMax" type="number" step="1" value="${esc(maxDefault)}" aria-label="Outcome range maximum"></div><small>Symbolic range; no values are enumerated. Edit before commitment.</small><div id="outcomeCardinality" class="review-row"><span>Calculated cardinality</span><strong>${integerSpace ? esc(Number(maxDefault) - Number(minDefault) + 1) : "2"}</strong></div></div><div class="field"><label for="primaryEndpoint">Primary endpoint</label><select id="primaryEndpoint"><option value="EXACT_SLOT">Exact scheduled target slot</option><option value="FIXED_TIME_WINDOW">Fixed committed time window</option><option value="FIXED_SEQUENCE_WINDOW">Fixed committed sequence window</option><option value="TARGET_FREQUENCY">Target frequency</option></select><small>Late or early matches remain exploratory unless this endpoint explicitly includes them.</small></div><div class="field"><label for="outputIntervalMs">Output cadence (milliseconds)</label><input id="outputIntervalMs" type="number" min="0.001" max="31536000000" step="any" value="${esc(intervalDefault)}"><small>Cadence is part of the immutable evidence definition.</small></div><div class="field"><label for="preTargetSeconds">Pre-target monitoring (seconds)</label><input id="preTargetSeconds" type="number" min="0" max="31536000" step="any" value="${esc(Number(profileWindow.preMs || 0) / 1000)}"></div><div class="field"><label for="postTargetSeconds">Post-target monitoring (seconds)</label><input id="postTargetSeconds" type="number" min="0" max="31536000" step="any" value="${esc(Number(profileWindow.postMs || 0) / 1000)}"></div><div id="stopExecutionWindow" class="field full" style="display:${stopAnchoredProfile ? "block" : "none"}"><label>Participant-stop execution window</label><div class="form-grid"><input id="executionDate" type="date" value="${defaultWindowStart.date}" aria-label="Execution date"><input id="executionStart" type="time" value="${defaultWindowStart.time}" aria-label="Window start"><input id="executionEnd" type="time" value="${defaultWindowEnd.time}" aria-label="Window end"><input id="executionTimezone" value="${esc(defaultTimezone)}" aria-label="Execution timezone"></div><small>Scheduling metadata only. It is normalized to UTC and never becomes target T.</small></div><div class="field"><label for="baseline">Baseline state</label><select id="baseline"><option>Ordinary alertness</option><option>Relaxed</option><option>Fatigued</option></select></div><div class="field"><label for="environment">Environment note</label><input id="environment" placeholder="Optional note"></div><div class="field full"><label><input id="safety" type="checkbox"> I can safely stop by opening my eyes, removing headphones, and reorienting.</label></div></div></div><div class="actions" style="margin-top:20px"><button class="button" id="back">← Back</button><button class="button primary" id="next">Continue to target assignment →</button></div>`;
  if (stopAnchoredProfile) {
    const endpointField = $("#primaryEndpoint")?.closest(".field");
    endpointField?.insertAdjacentHTML("beforebegin", `<div id="stopTargetTimingFields" class="field full"><label>Target timing relative to participant return</label><div class="form-grid"><select id="stopTargetRelationship" aria-label="Target relationship"><option value="before" ${stopOffsetRelationship === "before" ? "selected" : ""}>Before return</option><option value="at" ${stopOffsetRelationship === "at" ? "selected" : ""}>At return</option><option value="after" ${stopOffsetRelationship === "after" ? "selected" : ""}>After return</option></select><input id="stopTargetOffset" type="number" min="0" max="31536000" step="any" value="${esc(stopOffsetMagnitude)}" aria-label="Target offset magnitude"><select id="stopTargetOffsetUnit" aria-label="Target offset unit"><option value="seconds" ${stopOffsetUnit === "seconds" ? "selected" : ""}>seconds</option><option value="minutes" ${stopOffsetUnit === "minutes" ? "selected" : ""}>minutes</option><option value="hours" ${stopOffsetUnit === "hours" ? "selected" : ""}>hours</option></select></div><small>Canonical signed targetOffsetMs is committed before START: T = participant STOP/RETURN + offset.</small></div>`);
    const executionField = $("#stopExecutionWindow");
    if (executionField) {
      executionField.querySelector("label").innerHTML = `<input id="executionWindowEnabled" type="checkbox"> Use optional execution window`;
      executionField.querySelectorAll("input:not(#executionWindowEnabled)").forEach((input) => { input.disabled = true; });
      $("#executionWindowEnabled").onchange = (event) => executionField.querySelectorAll("input:not(#executionWindowEnabled)").forEach((input) => { input.disabled = !event.target.checked; });
    }
  }
  $("#experimentMode").value = selectedProfile?.mode || "INFLUENCE";
  $("#primaryEndpoint").value = ["EXACT_SLOT", "FIXED_TIME_WINDOW", "FIXED_SEQUENCE_WINDOW", "TARGET_FREQUENCY"].includes(endpointDefault) ? endpointDefault : "EXACT_SLOT";
  const updateCardinality = () => {
    const min = Number($("#outcomeMin")?.value);
    const max = Number($("#outcomeMax")?.value);
    const field = $("#outcomeCardinality strong");
    if (!field) return;
    field.textContent = Number.isSafeInteger(min) && Number.isSafeInteger(max) && max >= min ? new Intl.NumberFormat().format(max - min + 1) : "Invalid range";
  };
  $("#outcomeMin")?.addEventListener("input", updateCardinality);
  $("#outcomeMax")?.addEventListener("input", updateCardinality);
  updateCardinality();
  const updateFutureFields = () => {
    const future = $("#experimentMode").value === "FUTURE_TARGET";
    $("#futureDelayField").style.display = future ? "block" : "none";
    $("#prediction").required = future;
  };
  $("#experimentMode").onchange = updateFutureFields;
  updateFutureFields();
  $("#back").onclick = renderStart;
  $("#next").onclick = async () => {
    if (!$("#safety").checked)
      return toast("Confirm the physical safety stop method first.");
    preSessionState = {
      baseline: $("#baseline").value,
      environment: $("#environment").value,
      safetyConfirmed: true,
    };
    try {
      const mode = $("#experimentMode").value;
      const requestedSpace = integerSpace
        ? { type: "INTEGER_RANGE", minInclusive: Number($("#outcomeMin").value), maxInclusive: Number($("#outcomeMax").value) }
        : undefined;
      if (requestedSpace && (!Number.isSafeInteger(requestedSpace.minInclusive) || !Number.isSafeInteger(requestedSpace.maxInclusive) || requestedSpace.maxInclusive < requestedSpace.minInclusive))
        throw new Error("The integer outcome range must contain safe integer bounds with minimum ≤ maximum.");
      const intervalRaw = $("#outputIntervalMs").value.trim();
      const intervalMs = intervalRaw === "" ? null : Number(intervalRaw);
      const preMs = Number($("#preTargetSeconds").value || 0) * 1000;
      const postMs = Number($("#postTargetSeconds").value || 0) * 1000;
      if (![preMs, postMs].every((item) => Number.isFinite(item) && item >= 0) || (intervalMs !== null && (!Number.isFinite(intervalMs) || intervalMs <= 0)))
        throw new Error("Temporal monitoring durations and cadence must be valid non-negative values.");
      // Preserve inherited fine windows in the committed definition.  The
      // session override edits only the primary duration; it must not erase
      // application/profile windows that were reviewed before commitment.
      const temporalAnalysis = {
        primaryEndpoint: $("#primaryEndpoint").value,
        windows: [
          { ...profileWindow, id: "primary", enabled: true, preMs, postMs },
          ...inheritedWindows.slice(1).map((window, index) => ({ ...window, id: window.id || `fine-${index + 1}` })),
        ],
      };
      if (Number.isFinite(intervalMs) && intervalMs > 0) temporalAnalysis.intervalMs = intervalMs;
      const targetOffsetMs = stopAnchoredProfile
        ? (() => {
          const magnitude = Number($("#stopTargetOffset")?.value || 0);
          const unit = ({ seconds: 1_000, minutes: 60_000, hours: 3_600_000 })[$("#stopTargetOffsetUnit")?.value] || 1_000;
          if (!Number.isFinite(magnitude) || magnitude < 0) throw new Error("Target offset magnitude must be non-negative.");
          const sign = $("#stopTargetRelationship")?.value === "before" ? -1 : $("#stopTargetRelationship")?.value === "after" ? 1 : 0;
          const offset = sign * magnitude * unit;
          if (!Number.isSafeInteger(offset)) throw new Error("Target offset must resolve to a safe integer number of milliseconds.");
          return offset;
        })()
        : undefined;
      // Keep the optional window explicitly disabled when its checkbox is
      // off. Do not serialize the disabled date/time controls: stale blank
      // DOM values are not an execution-window request and must never reach
      // domain datetime validation.
      const executionWindow = stopAnchoredProfile
        ? $("#executionWindowEnabled")?.checked === true
          ? {
            enabled: true,
            startLocal: `${$("#executionDate").value}T${$("#executionStart").value}`,
            endLocal: `${$("#executionDate").value}T${$("#executionEnd").value}`,
            timezone: $("#executionTimezone").value.trim(),
          }
          : null
        : null;
      currentSession = await api("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          profileId: selectedProfile.id,
          mode,
          ...(requestedSpace ? { outcomeSpace: requestedSpace } : {}),
          ...(stopAnchoredProfile ? { targetOffsetMs } : {}),
          temporalAnalysis,
          ...(stopAnchoredProfile ? { executionWindow } : {}),
          prediction: $("#prediction").value.trim() || null,
          targetDelayMs: mode === "FUTURE_TARGET" ? Number($("#futureDelayMinutes").value || 1440) * 60_000 : undefined,
          participantLabel: $("#participant").value,
          recordType: $("#record").value,
          deferCommit: true,
        }),
      });
      renderTarget();
    } catch (e) {
      toast(e.message);
    }
  };
}
function renderTarget() {
  const future = currentSession?.mode === "FUTURE_TARGET";
  const instruction = currentSession?.participantTarget || (future ? `Prediction committed: ${currentSession?.prediction ?? "not recorded"}. The actual future target is generated only at the committed anchor.` : "Target instruction unavailable.");
  const targetText = future ? "Hidden until the future target anchor" : (instruction.match(/favor (.+?)(?: now\.)?$/)?.[1] || instruction);
  app.innerHTML = `<div class="section-intro"><div><h2>${future ? "Future target commitment" : "Assigned target & encoding"}</h2><p>${future ? "Prediction/recognition mode: no actual target exists before its precommitted anchor." : "The target is assigned in a draft; immutable commitment occurs only after memory and safety confirmation."}</p></div>${pill(future ? "Future target · Draft" : "Target assigned · Draft")}</div>${steps(3)}<div class="grid two"><div class="card target-box"><div class="subtle">Participant-facing target</div><div class="target">${esc(targetText)}</div><p class="subtle">${future ? "The actual target and machine output remain hidden until the evidence gate permits reveal." : "Memorize exactly what is shown. Hidden future output is not displayed."}</p></div><div class="card"><h3>Encoding instruction</h3><p>${esc(instruction)}</p><div class="callout">Release the request and observe neutrally. Fixed non-semantic cues guide hands-free stages.</div><label style="display:flex;gap:8px;margin-top:18px"><input id="memory" type="checkbox"> I have memorized the target and instruction.</label></div></div><div class="actions" style="margin-top:20px"><button class="button" id="back">← Back</button><button class="button primary" id="next" disabled>Continue to readiness review →</button></div>`;
  $("#back").onclick = renderPre;
  $("#memory").onchange = (e) => ($("#next").disabled = !e.target.checked);
  $("#next").onclick = renderReady;
}
function renderReady() {
  const p = selectedProfile;
  const targetSummary = currentSession?.mode === "FUTURE_TARGET" ? "Generated only at the committed future anchor" : currentSession?.participantTarget;
  const spaceSummary = currentSession?.outcomeSpace?.type === "INTEGER_RANGE"
    ? `${currentSession.outcomeSpace.minInclusive}..${currentSession.outcomeSpace.maxInclusive}`
    : (currentSession?.outcomeSpace?.values || []).join(", ");
  const research = currentSession?.researchDefinition || {};
  const windows = Array.isArray(research.temporalAnalysis?.windows) ? research.temporalAnalysis.windows : [];
  const primaryWindow = windows.find((window) => window.id === (research.temporalAnalysis?.primaryWindowId || "primary")) || windows[0] || {};
  const output = p.output || {};
  const configuredOpportunities = (Number(output.preBlocks || 0) + Number(output.primaryBlocks || 0) + Number(output.postBlocks || 0)) * Number(output.blockSize || 1);
  const intervalMs = research.temporalAnalysis?.intervalMs ?? output.intervalMs ?? "Not recorded";
  const hasCommittedTimeWindow = primaryWindow.enabled !== false && (Number(primaryWindow.preMs || 0) > 0 || Number(primaryWindow.postMs || 0) > 0);
  const derivedTemporalOpportunities = hasCommittedTimeWindow && Number(intervalMs) > 0
    ? Math.ceil(Number(primaryWindow.preMs || 0) / Number(intervalMs)) + 1 + Math.ceil(Number(primaryWindow.postMs || 0) / Number(intervalMs))
    : null;
  const plannedOpportunities = derivedTemporalOpportunities || configuredOpportunities || (output.type === "SINGLE_OUTCOME" ? 1 : "Not recorded");
  const stopAnchored = String(research.timingMode || currentSession?.timing?.mode || p.timing?.mode || "").toUpperCase() === "PARTICIPANT_STOP_ANCHORED" || ["PARTICIPANT_STOP", "PARTICIPANT_STOP_RETURN"].includes(String(research.targetAnchor || research.targetDefinition?.anchor || "").toUpperCase());
  const targetOffsetMs = Number(research.targetOffsetMs ?? research.targetDefinition?.targetOffsetMs ?? currentSession?.timing?.targetOffsetMs ?? p.timing?.targetOffsetMs ?? 0);
  const targetRelationship = targetOffsetMs < 0 ? `${Math.abs(targetOffsetMs) / 1000}s before participant return` : targetOffsetMs > 0 ? `${targetOffsetMs / 1000}s after participant return` : "At participant return";
  const scheduledUtc = stopAnchored ? "Not known until participant STOP / RETURN" : (research.targetDefinition?.scheduledUtc || currentSession?.timing?.scheduledUtc || "Not recorded");
  const executionWindowSummary = research.executionWindow
    ? `${research.executionWindow.startUtc} → ${research.executionWindow.endUtc} ${research.executionWindow.timezone || "UTC"}`
    : "Not recorded";
  const evidenceWindow = `${Number(primaryWindow.preMs || 0) / 1000}s before T → ${Number(primaryWindow.postMs || 0) / 1000}s after T`;
  const fineWindows = windows.slice(1).map((window) => {
    const pre = Number(window.preMs || 0) / 1000;
    const post = Number(window.postMs || 0) / 1000;
    return `${window.id}: -${pre}s/+${post}s`;
  });
  const cardinality = Number(currentSession?.cardinality || 2);
  app.innerHTML = `<div class="section-intro"><div><h2>Readiness review</h2><p>Human-readable commitment summary. Exact IDs and hashes are expandable.</p></div></div>${steps(4)}<div class="card"><div class="grid two"><div>${[
    ["Profile", p.name],
    ["Assignment", "System random uniform"],
    ["Mode", currentSession?.mode || p.mode || "INFLUENCE"],
    ["Outcome space / K", `${spaceSummary || p.outcomeSpace?.type || "BINARY"} · ${currentSession?.cardinality || "2"}`],
    ["Target", targetSummary],
    ["Target anchor (T)", scheduledUtc],
    ...(stopAnchored ? [["Anchor reference", "PARTICIPANT_STOP_RETURN"], ["Target relationship", targetRelationship], ["Execution window", executionWindowSummary]] : []),
    ["Evidence monitoring", evidenceWindow],
    ["Output cadence", `${intervalMs} ms per opportunity`],
    ["Planned opportunities", plannedOpportunities],
    ["Precommitted fine windows", fineWindows.length ? fineWindows.join(", ") : "None"],
    ["Uniform exact-target chance", `1 / ${Number.isSafeInteger(cardinality) && cardinality > 0 ? cardinality : "K"}`],
    ["Timing", p.timing.mode],
  ]
    .map(
      (x) =>
        `<div class="review-row"><span>${x[0]}</span><strong>${esc(x[1])}</strong></div>`,
    )
    .join("")}</div><div>${[
    ["Audio", p.audio.recipeId + " · live synthesis"],
    ["Random source", research.rng?.provider || p.rng.provider],
    ["Reveal policy", p.reveal.policy],
    ["Analysis", `${currentSession?.researchDefinition?.primaryEndpoint || p.analysis?.primaryEndpoint || "EXACT_SLOT"} · primary + exploratory windows`],
  ]
    .map(
      (x) =>
        `<div class="review-row"><span>${x[0]}</span><strong>${esc(x[1])}</strong></div>`,
    )
    .join(
      "",
    )}</div></div><details style="margin-top:18px"><summary>Advanced configuration snapshot</summary><pre class="json">${esc(JSON.stringify(p, null, 2))}</pre></details></div><div class="callout warning" style="margin-top:18px"><strong>Before START:</strong> confirm comfortable headphones and the normal OS output. The active screen becomes non-informative.</div><div class="actions" style="margin-top:20px"><button class="button" id="back">← Back</button><button class="button primary" id="start">START SESSION</button></div>`;
  $("#back").onclick = renderTarget;
  $("#start").onclick = async () => {
    const startButton = $("#start");
    if (startButton.disabled) return;
    startButton.disabled = true;
    try {
      if (window.mip) {
        await window.mip.commitSession({ id: currentSession.sessionId, memoryConfirmed: true, safetyConfirmed: preSessionState.safetyConfirmed, baseline: preSessionState.baseline, environment: preSessionState.environment || null });
        const prepared = await window.mip.prepareAudio({ id: currentSession.sessionId });
        // The main process returns the immutable, complete recipe committed for
        // this session.  Never reconstruct a formal recipe from the profile or
        // from a minimal {id, version} object in the renderer.
        const ack = await preparePlayer(prepared.audio, { autoStart: false, formal: true, handshake: prepared.handshake });
        await window.mip.audioReady({ id: currentSession.sessionId, ack: jsonSafe(ack) });
      }
      const startedSession = await api(`/api/sessions/${currentSession.sessionId}/start`, {
        method: "POST",
        body: JSON.stringify({ memoryConfirmed: true }),
      });
      player.scheduler = startedSession.scheduler || null;
      currentSession.scheduler = startedSession.scheduler || null;
      if (player.controller) {
        const started = await player.controller.start();
        await window.mip?.audioStarted({ id: currentSession.sessionId, ack: jsonSafe(started) });
        player.status = "playing";
        player.started = performance.now();
        player.timer = setInterval(updatePlayer, 100);
        updatePlayer();
      }
      renderHandsFree();
    } catch (e) {
      startButton.disabled = false;
      if (window.mip && currentSession?.sessionId) {
        try { await window.mip.audioFailed({ id: currentSession.sessionId, error: e.message }); } catch {}
      }
      try { await stopPlayer(); } catch {}
      toast(e.message);
    }
  };
}
function renderHandsFree() {
  const research = currentSession?.researchDefinition || {};
  const temporalWindows = research.temporalAnalysis?.windows?.some?.((window) =>
    window?.enabled !== false && (Number(window?.preMs || 0) > 0 || Number(window?.postMs || 0) > 0 ||
      window?.exactSequence !== null && window?.exactSequence !== undefined ||
      window?.sequenceStart !== null && window?.sequenceStart !== undefined ||
      window?.sequenceEnd !== null && window?.sequenceEnd !== undefined ||
      window?.sequenceOffsetStart !== null && window?.sequenceOffsetStart !== undefined ||
      window?.sequenceOffsetEnd !== null && window?.sequenceOffsetEnd !== undefined));
  const temporal = currentSession?.mode === "FUTURE_TARGET" ||
    String(currentSession?.mode || "INFLUENCE").toUpperCase() !== "INFLUENCE" ||
    (research.outcomeSpace?.type || currentSession?.outcomeSpace?.type) !== "BINARY" ||
    research.primaryEndpoint !== "EXACT_SLOT" || temporalWindows;
  app.innerHTML = `<div class="hands-free"><span class="eyebrow">SESSION ACTIVE · HANDS-FREE</span><div class="breath"></div><h2>Remain comfortable</h2><p>Audio, cues, telemetry, and hidden output are running automatically.<br>No screen interaction is required.</p><div class="progress"><span id="sessionProgress" style="width:0%"></span></div><small id="sessionStage">Stage in progress · hidden output protected</small><div class="actions" style="margin-top:18px"><button class="button" id="returned">End participant phase / Return</button>${temporal ? '<button class="button danger" id="abortEvidence">Abort evidence collection</button>' : ""}</div>${temporal ? '<p class="subtle" style="margin-top:12px">Returning ends the participant phase only. Abort is a separate confirmed action and records a deviation; missed opportunities are never backfilled.</p>' : ""}</div>`;
  updateFormalProgress();
  $("#returned").onclick = async () => {
    const returned = $("#returned");
    returned.disabled = true;
    try {
      if (window.mip && currentSession?.sessionId)
        await window.mip.audioStopRequested({ id: currentSession.sessionId, reason: "owner_returned" });
      const finalization = await stopPlayer();
      if (window.mip && finalization)
        await window.mip.audioFinalized({ id: currentSession.sessionId, finalization: jsonSafe(finalization) });
      await window.mip?.returnSession({ id: currentSession.sessionId });
      renderRaw();
    } catch (error) {
      returned.disabled = false;
      toast(error.message);
    }
  };
  $("#abortEvidence")?.addEventListener("click", async () => {
    if (!confirm("Abort evidence collection? Future scheduled outputs will stop and the deviation will be recorded. This cannot be undone.")) return;
    const button = $("#abortEvidence");
    button.disabled = true;
    try {
      // End the participant/audio phase first, then perform the explicit
      // evidence abort.  This preserves the required AudioWorklet
      // finalization handshake while keeping the destructive evidence action
      // distinct; the main process records the final session as ABORTED and
      // no scheduled output can resume afterward.
      if (window.mip && player.status !== "stopped") {
        await window.mip.audioStopRequested({ id: currentSession.sessionId, reason: "owner_abort" });
        const finalization = await stopPlayer();
        if (finalization) await window.mip.audioFinalized({ id: currentSession.sessionId, finalization: jsonSafe(finalization) });
      }
      await window.mip.abortEvidence({ id: currentSession.sessionId, confirmed: true, reason: "owner_abort" });
      renderRaw();
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  });
}

function updateFormalProgress() {
  const scheduler = player.scheduler;
  if (!scheduler) return;
  const total = Number(scheduler.totalCount || 0);
  const intervalMs = Number(scheduler.intervalMs || 0);
  const totalMs = total > 0 && intervalMs > 0 ? intervalMs * total : 0;
  const elapsedFrames = Number(player.frames || 0);
  const elapsedByAudio = total > 0 && Number.isFinite(elapsedFrames)
    ? (elapsedFrames / Math.max(1, total)) * totalMs
    : 0;
  const elapsedByClock = player.started
    ? player.elapsed * 1000 + (player.status === "playing" ? performance.now() - player.started : 0)
    : 0;
  const elapsedMs = Math.max(elapsedByAudio, elapsedByClock);
  const audioProgress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  player.progress = audioProgress;
  const span = $("#sessionProgress");
  if (span) span.style.width = `${audioProgress.toFixed(2)}%`;
  const stage = $("#sessionStage");
  if (stage) stage.textContent = `${scheduler.mode || "Scheduled"} · ${Math.round(audioProgress)}% · hidden output protected`;
}
async function renderRaw() {
  const id = currentSession?.sessionId;
  const draft = id && window.mip?.getDraft ? await window.mip.getDraft({ id }).catch(() => null) : null;
  clearInterval(stopEvidencePollTimer);
  const stopAnchored = String(currentSession?.research?.timingMode || currentSession?.researchDefinition?.timingMode || currentSession?.timing?.mode || "").toUpperCase() === "PARTICIPANT_STOP_ANCHORED" || ["PARTICIPANT_STOP", "PARTICIPANT_STOP_RETURN"].includes(String(currentSession?.research?.targetAnchor || currentSession?.researchDefinition?.targetDefinition?.anchor || "").toUpperCase());
  app.innerHTML = `<div class="section-intro"><div><h2>Raw report · before reveal</h2><p>Capture observation first. The generated result remains hidden.</p></div>${pill(draft ? "DRAFT — MUTABLE" : "Raw Report Pending")}</div>${stopAnchored ? '<div class="card" id="stopEvidenceStatus" style="margin-top:18px"><h3>Participant-stop evidence</h3><div class="callout">Loading authoritative stop anchor and post-target progress…</div></div>' : ""}<div class="callout warning">Record subjective time before actual duration is shown. Unknown / Not experienced are valid responses. A draft is mutable until the owner locks it.</div><div class="card" style="margin-top:18px"><div class="form-grid"><div class="field"><label for="subjectiveTime">Subjective total duration</label><input id="subjectiveTime" placeholder="e.g. 20 minutes"></div><div class="field"><label for="intensity">Overall state intensity (0–10)</label><input id="intensity" type="number" min="0" max="10"></div><div class="field"><label for="modality">Actual encoding modality</label><input id="modality" placeholder="semantic, visual, kinesthetic, combined"></div><div class="field"><label for="certainty">Pre-reveal belief (%)</label><input id="certainty" type="number" min="0" max="100"></div><div class="field full"><label for="timeline">Subjective timeline</label><textarea id="timeline" placeholder="Approximate sequence and moments"></textarea></div><div class="field full"><label for="notes">Free raw notes</label><textarea id="notes" placeholder="Observation only"></textarea></div></div><div id="reportValidation" class="callout" role="status" aria-live="polite" style="margin-top:12px"></div><div class="actions" style="margin-top:18px"><button class="button" id="save">Save draft</button><button class="button primary" id="lock">LOCK RAW REPORT</button></div></div>`;
  if (stopAnchored) {
    const refreshStopStatus = async () => {
      try {
        const phases = await window.mip?.getResearchPhases?.({ id });
        const anchor = phases?.participantStopAnchor;
        const status = $("#stopEvidenceStatus");
        if (!status) return;
        const remaining = Number.isFinite(Number(phases?.remainingPostMs)) ? `${Math.ceil(Number(phases.remainingPostMs))} ms` : anchor && phases?.evidencePhaseStatus !== "COMPLETE" ? `${anchor.postTargetMs} ms committed` : "Complete";
        status.innerHTML = `<h3>Participant-stop evidence</h3><div class="review-row"><span>Participant phase</span><strong>${esc(phases?.participantPhaseStatus || "RETURNED")}</strong></div><div class="review-row"><span>Stop / Return clock</span><strong>${esc(anchor?.stopUtc || anchor?.utc || phases?.stopUtc || "Not captured")}</strong></div><div class="review-row"><span>Target T</span><strong>${esc(anchor?.targetUtc || phases?.targetScheduledUtc || "Not known until STOP / RETURN")}</strong></div><div class="review-row"><span>Signed offset</span><strong>${esc(anchor?.targetOffsetMs ?? phases?.targetOffsetMs ?? currentSession?.research?.targetOffsetMs ?? 0)} ms</strong></div><div class="review-row"><span>Evidence phase</span><strong>${esc(phases?.evidencePhaseStatus || "PENDING")}</strong></div><div class="review-row"><span>Remaining post evidence</span><strong>${esc(remaining)}</strong></div><div class="review-row"><span>Reveal</span><strong>${phases?.revealStatus === "ELIGIBLE" ? "ELIGIBLE" : "BLOCKED"}</strong></div>`;
        if (phases?.evidencePhaseStatus === "COMPLETE") clearInterval(stopEvidencePollTimer);
      } catch { /* status is advisory; the report gate remains authoritative */ }
    };
    await refreshStopStatus();
    stopEvidencePollTimer = setInterval(refreshStopStatus, 500);
  }
  const initial = draft?.report || {};
  for (const field of ["subjectiveTime", "intensity", "modality", "certainty", "timeline", "notes"]) if ($(`#${field}`)) $(`#${field}`).value = initial[field] ?? "";
  const collect = () => Object.fromEntries([...document.querySelectorAll("#subjectiveTime,#intensity,#modality,#certainty,#timeline,#notes")].map((x) => [x.id, x.value]));
  const missing = (report) => ["subjectiveTime", "intensity", "modality", "certainty"].filter((key) => !String(report[key] ?? "").trim());
  let saveTimer = null;
  const saveDraft = async (quiet = false) => {
    if (!id) return;
    await api(`/api/sessions/${id}/draft`, { method: "POST", body: JSON.stringify({ report: collect() }) });
    if (!quiet) toast("Draft saved. It remains mutable until lock.");
  };
  $("#save").onclick = () => saveDraft(false).catch((error) => toast(error.message));
  document.querySelectorAll("#subjectiveTime,#intensity,#modality,#certainty,#timeline,#notes").forEach((element) => element.addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveDraft(true).catch(() => {}), 700);
  }));
  $("#lock").onclick = async () => {
    const report = collect();
    const required = missing(report);
    if (required.length) { $("#reportValidation").textContent = `Complete required fields before lock: ${required.join(", ")}.`; return; }
    if (!confirm("Lock this raw report? It becomes read-only.")) return;
    try {
      const lockResult = await api(`/api/sessions/${id}/lock-report`, { method: "POST", body: JSON.stringify({ report }) });
      app.innerHTML = `<div class="card"><div class="lock-box">✓ Raw report locked · ${lockResult.revealEligible ? "reveal gate satisfied" : "evidence collection still in progress"}</div><p class="subtle">The original report is immutable. Later recollections are append-only.</p><div id="gateStatus" class="callout">${lockResult.revealEligible ? "All required evidence gates are complete." : "Reveal remains blocked until the evidence phase, primary endpoint, post-target window, and integrity checks complete."}</div><button class="button primary" id="reveal" ${lockResult.revealEligible ? "" : "disabled"}>Reveal result</button><button class="button" id="refreshGate" ${lockResult.revealEligible ? "style=\"display:none\"" : ""}>Refresh evidence gate</button></div>`;
      const refreshGate = async () => {
        try {
          const phases = await window.mip?.getResearchPhases?.({ id });
          const session = await window.mip?.getSession?.({ id });
          const eligible = session?.revealEligible === true;
          $("#gateStatus").textContent = eligible ? "All required evidence gates are complete." : `Evidence phase: ${phases?.evidencePhaseStatus || "PENDING"}. Reveal remains blocked.`;
          $("#reveal").disabled = !eligible;
          if (eligible) $("#refreshGate").style.display = "none";
        } catch (error) { toast(error.message); }
      };
      $("#refreshGate").onclick = refreshGate;
      $("#reveal").onclick = async () => {
        try {
          const r = await api(`/api/sessions/${id}/reveal`, { method: "POST" });
          app.innerHTML = `<div class="section-intro"><div><h2>Session reveal</h2><p>Neutral presentation; one session does not establish a mechanism.</p></div>${pill("Revealed")}</div><div class="grid three"><div class="card"><div class="metric">${esc(r.objective)}</div><div class="metric-label">Objective state</div></div><div class="card"><div class="metric">${esc(r.participantTarget)}</div><div class="metric-label">Participant target</div></div><div class="card"><div class="metric">${r.primary?.match ? "Match" : "No Match"}</div><div class="metric-label">Primary endpoint</div></div></div><div class="card" style="margin-top:18px"><div class="lock-box">✓ ${r.integrity?.valid ? "Integrity verified" : "Integrity requires review"}</div><p>${r.integrity?.eventCount || 0} events · ${r.integrity?.machineOutputCount || 0} machine-output records</p></div>`;
        } catch (error) { toast(error.message); }
      };
    } catch (error) { toast(error.message); }
  };
}
async function stopPlayer({ cancelPreparations = true } = {}) {
  if (cancelPreparations) for (const preparation of pendingPreparations) preparation.cancelled = true;
  if (stopInFlight) return stopInFlight;
  const operation = stopPlayerInternal();
  stopInFlight = operation;
  try { return await operation; }
  finally { if (stopInFlight === operation) stopInFlight = null; }
}
async function stopPlayerInternal() {
  const generation = ++audioGeneration;
  const previous = player;
  if (previous.timer) clearInterval(previous.timer);
  if (previous.healthTimer) clearTimeout(previous.healthTimer);
  if (previous.status !== "stopped") {
    previous.status = "stopping";
    updatePlayer();
  }
  let finalization = previous.finalization || null;
  let failure = null;
  try {
    if (previous.audioRuntime) {
      // RendererAudio owns the replaceable AudioController instance.  Calling
      // stop through that facade prevents a stale controller from leaving the
      // live AudioWorklet connected after prepare() rotates the instance.
      finalization = await previous.audioRuntime.stop({ timeoutMs: 5000 });
    } else if (previous.controller) {
      finalization = await previous.controller.stop({ timeoutMs: 5000 });
    } else {
      if (previous.node) previous.node.disconnect();
      if (previous.ctx && previous.ctx.state !== "closed") await previous.ctx.close();
    }
  } catch (error) {
    // Cleanup is still attempted, but a formal caller must see a failed
    // finalization instead of silently moving to the report screen.
    if (previous.ctx && previous.ctx.state !== "closed") {
      try { await previous.ctx.close(); } catch {}
    }
    failure = error;
  }
  player = {
    ctx: null,
    node: null,
    gain: null,
    controller: null,
    audioRuntime: null,
    status: "stopped",
    started: 0,
    elapsed: 0,
    timer: null,
    frames: 0,
    finalization,
    formal: false,
    scheduler: null,
    generation,
  };
  updatePlayer();
  if (failure) throw failure;
  return finalization;
}
function updatePlayer() {
  const e = $("#playerState");
  if (!e) return;
  const secs =
    player.elapsed +
    (player.status === "playing"
      ? (performance.now() - player.started) / 1000
      : 0);
  e.innerHTML = `<div class="review-row"><span>Status</span><strong>${player.status}</strong></div><div class="review-row"><span>Elapsed</span><strong>${secs.toFixed(1)} s</strong></div><div class="review-row"><span>Generated frames</span><strong>${player.frames || 0}</strong></div>`;
  const progress = $("#sessionProgress");
  if (progress) progress.style.width = `${Math.max(0, Math.min(100, Number(player.progress || 0)))}%`;
  updateFormalProgress();
  const active = ["preparing", "starting", "ready", "playing", "paused", "pausing", "resuming", "stopping"].includes(player.status);
  for (const [id, disabled] of [
    ["livePlay", active],
    ["livePause", player.status !== "playing"],
    ["liveResume", player.status !== "paused"],
    ["liveStop", !active || player.status === "stopping"],
    ["liveGainApply", !["ready", "playing", "paused"].includes(player.status)],
  ])
    if ($("#" + id)) $("#" + id).disabled = disabled;
}
async function preparePlayer(recipe, options = {}) {
  const preparation = { cancelled: false };
  pendingPreparations.add(preparation);
  // Publish the pending state before the serialized operation reaches its
  // first await. This keeps Stop available during the tiny hand-off window
  // between the click and AudioWorklet module preparation.
  player = { ...player, status: "preparing", pendingPreparation: true };
  updatePlayer();
  // Serialize every replacement, including quick/custom/layered auditions.
  // Without this queue two rapid clicks can each create an AudioContext before
  // either one publishes its controller, leaving an orphaned Worklet playing.
  const previous = prepareInFlight || Promise.resolve();
  const operation = previous.catch(() => {}).then(() => preparePlayerInternal(recipe, { ...options, preparation }));
  prepareInFlight = operation;
  try {
    return await operation;
  } finally {
    pendingPreparations.delete(preparation);
    if (prepareInFlight === operation) prepareInFlight = null;
  }
}

async function preparePlayerInternal(recipe, {
  autoStart = true,
  formal = false,
  handshake = null,
  healthCheck = null,
  preparation = null,
} = {}) {
  if (preparation?.cancelled) throw new Error("Audio preparation was cancelled");
  await stopPlayer({ cancelPreparations: false });
  if (preparation?.cancelled) throw new Error("Audio preparation was cancelled");
  const generation = ++audioGeneration;
  const audioRuntime = new RendererAudio((message) => {
    if (generation !== audioGeneration || player.audioRuntime !== audioRuntime) return;
    player.frames = Number(message.generatedFrames ?? message.frames ?? player.frames);
    if (formal && currentSession?.sessionId && window.mip) {
      const telemetry = jsonSafe({ ...message, type: "TELEMETRY" });
      window.mip.audioTelemetry({ id: currentSession.sessionId, telemetry }).catch(() => {});
    }
    updatePlayer();
  });
  const healthFields = {
    healthCheckMode: healthCheck?.mode || null,
    healthIntendedDurationMs: healthCheck?.intendedDurationMs || null,
    healthChallengeId: healthCheck?.challengeId || null,
  };
  player = {
    ctx: null,
    node: null,
    gain: null,
    controller: null,
    audioRuntime,
    status: "preparing",
    started: 0,
    elapsed: 0,
    timer: null,
    healthTimer: null,
    frames: 0,
    finalization: null,
    formal,
    scheduler: null,
    progress: 0,
    generation,
    ...healthFields,
  };
  updatePlayer();
  try {
    const ack = await audioRuntime.prepare(recipe, { timeoutMs: 5000, handshake });
    if (preparation?.cancelled || generation !== audioGeneration || player.audioRuntime !== audioRuntime)
      throw new Error("Audio preparation was cancelled");
    // RendererAudio.prepare() intentionally creates a fresh controller.  Read
    // the controller only after preparation so all subsequent lifecycle
    // commands target the same AudioWorklet node that emitted PROCESSOR_READY.
    const controller = audioRuntime.controller;
    player = {
      ...player,
      ctx: controller.context,
      node: controller.node,
      controller,
      status: autoStart ? "starting" : "ready",
      generation,
    };
    updatePlayer();
    if (autoStart) {
      const started = await audioRuntime.start({ timeoutMs: 5000 });
      if (preparation?.cancelled || generation !== audioGeneration || player.audioRuntime !== audioRuntime) {
        await audioRuntime.stop({ timeoutMs: 5000 }).catch(() => audioRuntime.dispose());
        throw new Error("Audio start was cancelled");
      }
      player.status = "playing";
      player.started = performance.now();
      player.timer = setInterval(updatePlayer, 100);
      updatePlayer();
      if (formal && currentSession?.sessionId && window.mip)
        await window.mip.audioStarted({ id: currentSession.sessionId, ack: jsonSafe(started) });
    }
    return ack;
  } catch (error) {
    await audioRuntime.stop({ timeoutMs: 5000 }).catch(() => audioRuntime.dispose());
    throw error;
  }
}

async function playRecipe(recipe) {
  return preparePlayer(recipe, { autoStart: true, formal: false });
}
function renderAudio() {
  app.innerHTML = `<div class="section-intro"><div><h2>Audio Lab</h2><p>Exploratory listening and engineering workspace. Live stateful synthesis uses the shared AudioWorklet; it is not automatically formal evidence.</p></div>${pill("Live synthesis")}</div><div class="card"><div class="grid two"><div><h3>Live player</h3><div class="field"><label for="recipeSelect">Preset / recipe</label><select id="recipeSelect">${presets.map((a) => `<option value="${a.id}">${a.id} · ${a.leftHz ?? "layered"}/${a.rightHz ?? "layered"} · ${a.provenance || "UNKNOWN"}</option>`).join("")}</select></div><div class="actions" style="margin-top:14px"><button class="button primary" id="livePlay">Play</button><button class="button" id="livePause" disabled>Pause</button><button class="button" id="liveResume" disabled>Resume</button><button class="button danger" id="liveStop" disabled>Stop</button></div></div><div id="playerState"><div class="review-row"><span>Status</span><strong>stopped</strong></div><div class="review-row"><span>Elapsed</span><strong>0.0 s</strong></div><div class="review-row"><span>Generated frames</span><strong>0</strong></div></div></div><div id="recipeDetails"></div></div><div class="grid two" style="margin-top:18px"><div class="card"><h3>Quick Generator</h3><p class="subtle">One center value derives a MIP-defined centered 4 Hz component pair.</p><div class="field"><label for="center">Center frequency (Hz)</label><input id="center" type="number" value="396" min="1"><small>Quick previews are not committed formal evidence.</small></div><div class="review-row"><span>Derived channels</span><strong id="derived">394 / 398 Hz</strong></div><button class="button primary" id="quick">Use in live player</button></div><div class="card"><h3>Simple Custom</h3><p class="subtle">A preview-only centered pair with an explicit master-gain stage.</p><div class="form-grid"><div class="field"><label for="customCenter">Center (Hz)</label><input id="customCenter" type="number" value="396"></div><div class="field"><label for="customBeat">Difference (Hz)</label><input id="customBeat" type="number" value="4" min="0"></div><div class="field"><label for="customGain">Master gain</label><input id="customGain" type="number" value="0.25" min="0" max="1" step=".01"><small>Changes preview PCM amplitude only; it cannot rewrite a committed session.</small></div></div><button class="button" id="custom" style="margin-top:14px">Validate and use</button></div></div><div class="card" style="margin-top:18px"><h3>Experimental layered reconstruction</h3><p class="subtle">The engine supports multi-carrier, Septon, deterministic noise, delay/comb, envelopes, AM/FM, cues, and voice-reference layers. The selected recipe panel below states which layers are actually active.</p><div class="callout warning"><strong>MIP experimental reconstruction:</strong> architecture capability is documented, while numerical reconstruction choices remain explicitly labelled and are not historically exact.</div><button class="button" id="layered">Play repository-backed layered demo</button></div>`;
  const livePlayer = $("#livePlay")?.parentElement?.parentElement;
  livePlayer?.querySelector(".field")?.insertAdjacentHTML("afterend", `<div class="field" style="margin-top:12px"><label for="liveGain">Master gain <output id="liveGainValue">0.80</output></label><input id="liveGain" type="range" min="0" max="1" step="0.01" value="0.8"><small>Changes are ramped in the active AudioWorklet to avoid clicks.</small></div>`);
  const gainApplyTarget = $("#livePlay")?.parentElement;
  gainApplyTarget?.insertAdjacentHTML("beforeend", `<button class="button" id="liveGainApply" disabled>Apply gain</button>`);
  const sel = $("#recipeSelect"),
    get = () => presets.find((x) => x.id === sel.value) || presets[0];
  const showRecipeDetails = () => { const selected = get(); $("#recipeDetails").innerHTML = recipeDetailProjection(selected); };
  sel?.addEventListener("change", showRecipeDetails);
  showRecipeDetails();
  const gain = $("#liveGain"), gainValue = $("#liveGainValue"), gainApply = $("#liveGainApply");
  gain?.addEventListener("input", () => {
    const value = Number(gain.value).toFixed(2);
    if (gainValue) {
      gainValue.value = value;
      gainValue.textContent = value;
    }
  });
  gainApply?.addEventListener("click", async () => {
    const runtime = player.audioRuntime;
    if (!runtime || !["ready", "playing", "paused"].includes(player.status)) return;
    const operationGeneration = audioGeneration;
    gainApply.disabled = true;
    try {
      const acknowledgement = await runtime.setMasterGain(Number(gain.value), { timeoutMs: 5000 });
      if (operationGeneration === audioGeneration && player.audioRuntime === runtime)
        toast(`Master gain ramped to ${Number(acknowledgement.gain ?? gain.value).toFixed(2)}.`);
    } catch (error) {
      if (operationGeneration === audioGeneration) toast(error.message);
    } finally {
      if (operationGeneration === audioGeneration) updatePlayer();
    }
  });
  $("#livePlay").onclick = () =>
    playRecipe(get()).catch((e) => toast(e.message));
  $("#livePause").onclick = () => {
    if (player.status !== "playing") return;
    const elapsed = (performance.now() - player.started) / 1000;
    const runtime = player.audioRuntime;
    const operationGeneration = audioGeneration;
    player.status = "pausing";
    updatePlayer();
    runtime?.pause({ timeoutMs: 5000 })
      .then(() => {
        if (operationGeneration !== audioGeneration || player.audioRuntime !== runtime) return;
        player.elapsed += elapsed;
        player.status = "paused";
        updatePlayer();
      })
      .catch((error) => {
        if (operationGeneration === audioGeneration) {
          player.status = "playing";
          player.started = performance.now();
          updatePlayer();
          toast(error.message);
        }
      });
  };
  $("#liveResume").onclick = () => {
    if (player.status !== "paused") return;
    const runtime = player.audioRuntime;
    const operationGeneration = audioGeneration;
    player.status = "resuming";
    updatePlayer();
    runtime?.resume({ timeoutMs: 5000 })
      .then(() => {
        if (operationGeneration !== audioGeneration || player.audioRuntime !== runtime) return;
        player.started = performance.now();
        player.status = "playing";
        updatePlayer();
      })
      .catch((error) => {
        if (operationGeneration === audioGeneration) {
          player.status = "paused";
          updatePlayer();
          toast(error.message);
        }
      });
  };
  $("#liveStop").onclick = () => stopPlayer().catch((error) => toast(error.message));
  const readQuickPair = (centerValue, beatValue = 4) => {
    if (centerValue === undefined || centerValue === null || String(centerValue).trim() === "")
      return { valid: false, message: "Enter a center frequency greater than 0 Hz." };
    if (beatValue === undefined || beatValue === null || String(beatValue).trim() === "")
      return { valid: false, message: "Enter a beat/difference frequency of 0 Hz or greater." };
    const center = Number(centerValue);
    const beat = Number(beatValue);
    if (!Number.isFinite(center) || center <= 0)
      return { valid: false, message: "Center frequency must be a finite number greater than 0 Hz." };
    if (!Number.isFinite(beat) || beat < 0)
      return { valid: false, message: "Beat/difference frequency must be a finite number of 0 Hz or greater." };
    const left = center - beat / 2;
    const right = center + beat / 2;
    if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0)
      return { valid: false, message: `Center must be greater than half the beat/difference (${(beat / 2).toLocaleString()} Hz) so both channels stay positive.` };
    return { valid: true, center, beat, left, right };
  };
  const quickButton = $("#quick");
  const customButton = $("#custom");
  const quickValidation = document.createElement("p");
  quickValidation.id = "quickValidation";
  quickValidation.className = "subtle";
  quickValidation.setAttribute("role", "status");
  quickValidation.setAttribute("aria-live", "polite");
  quickButton?.insertAdjacentElement("beforebegin", quickValidation);
  const customValidation = document.createElement("p");
  customValidation.id = "customValidation";
  customValidation.className = "subtle";
  customValidation.setAttribute("role", "status");
  customValidation.setAttribute("aria-live", "polite");
  customButton?.insertAdjacentElement("beforebegin", customValidation);
  const updateQuickInputs = () => {
    const pair = readQuickPair($("#center")?.value, 4);
    $("#derived").textContent = pair.valid ? `${pair.left} / ${pair.right} Hz` : "—";
    quickValidation.textContent = pair.valid ? "" : pair.message;
    quickValidation.className = pair.valid ? "subtle" : "callout warning";
    $("#center")?.toggleAttribute("aria-invalid", !pair.valid);
    if (quickButton) quickButton.disabled = !pair.valid;
  };
  const updateCustomInputs = () => {
    const pair = readQuickPair($("#customCenter")?.value, $("#customBeat")?.value);
    const gainRaw = $("#customGain")?.value;
    const gainValue = Number(gainRaw);
    const gainValid = gainRaw !== undefined && gainRaw !== null && String(gainRaw).trim() !== "" && Number.isFinite(gainValue) && gainValue >= 0 && gainValue <= 1;
    const valid = pair.valid && gainValid;
    customValidation.textContent = !pair.valid ? pair.message : !gainValid ? "Master gain must be a finite number from 0 to 1." : "";
    customValidation.className = valid ? "subtle" : "callout warning";
    $("#customCenter")?.toggleAttribute("aria-invalid", !pair.valid);
    $("#customBeat")?.toggleAttribute("aria-invalid", !pair.valid);
    $("#customGain")?.toggleAttribute("aria-invalid", !gainValid);
    if (customButton) customButton.disabled = !valid;
  };
  $("#center").oninput = updateQuickInputs;
  $("#customCenter").oninput = updateCustomInputs;
  $("#customBeat").oninput = updateCustomInputs;
  $("#customGain").oninput = updateCustomInputs;
  updateQuickInputs();
  updateCustomInputs();
  quickButton.onclick = async () => {
    try {
      const pair = readQuickPair($("#center").value, 4);
      if (!pair.valid) throw new Error(pair.message);
      const r = await api("/api/audio/quick", {
        method: "POST",
        body: JSON.stringify({ centerHz: pair.center, beatHz: pair.beat }),
      });
      await playRecipe(r.recipe);
      toast("Quick recipe is playing through the OS audio output.");
    } catch (e) {
      toast(e.message);
    }
  };
  customButton.onclick = async () => {
    try {
      const pair = readQuickPair($("#customCenter").value, $("#customBeat").value);
      const gainRaw = $("#customGain").value;
      const gainValue = Number(gainRaw);
      if (!pair.valid) throw new Error(pair.message);
      if (gainRaw.trim() === "" || !Number.isFinite(gainValue) || gainValue < 0 || gainValue > 1) throw new Error("Master gain must be a finite number from 0 to 1.");
      const r = await api("/api/audio/quick", {
        method: "POST",
        body: JSON.stringify({
          centerHz: pair.center,
          beatHz: pair.beat,
        }),
      });
      // The normalized carrier gain is intentionally independent from the
      // preview master stage.  Route this control through masterGain so the
      // resulting PCM changes measurably and the UI does not suggest that an
      // ignored top-level `gain` field controls output volume.
      r.recipe.masterGain = gainValue;
      await playRecipe(r.recipe);
      toast(`Playing ${r.recipe.leftHz}/${r.recipe.rightHz} Hz at master gain ${r.recipe.masterGain.toFixed(2)}`);
    } catch (e) {
      toast(e.message);
    }
  };
  $("#layered").onclick = () => {
    const recipe = presets.find((item) => item.recipeId === "MIP_LAYERED_EXPERIMENTAL_V1" || item.id === "MIP_LAYERED_EXPERIMENTAL_V1");
    if (!recipe) return toast("The repository-backed layered recipe is unavailable.");
    if (recipe.incomplete || !formalOperationalStatus(recipe)) return toast(recipe.formalEligibilityReason || "This layered recipe is incomplete or not operationally eligible.");
    playRecipe(recipe).catch((e) => toast(e.message));
  };
  // Re-rendering the Audio Lab must reflect the existing runtime. Without
  // this refresh a live preview could continue in the Worklet while the new
  // DOM showed every lifecycle button as if the player were stopped.
  updatePlayer();
}
async function renderProfiles() {
  profiles = window.mip ? await window.mip.getProfiles({ allVersions: false }) : profiles;
  app.innerHTML = `<div class="section-intro"><div><h2>Experiment Profiles</h2><p>Versioned configuration workspace with SQLite-authoritative immutable snapshots.</p></div><button class="button primary" id="duplicate">Duplicate selected</button></div><div class="grid two">${profiles.map((p) => `<article class="card profile-card"><div style="display:flex;justify-content:space-between;gap:12px"><h3>${esc(p.name)} · v${esc(p.version)}</h3>${pill(p.status || "ACTIVE")}</div><p class="subtle">${esc(p.purpose)}</p><div class="review-row"><span>Timing</span><strong>${esc(p.timing?.mode || "UNKNOWN")}</strong></div><div class="review-row"><span>Outcome / mapping</span><strong>${esc(p.outcomeSpace?.type || "UNKNOWN")} · ${esc(p.mapping?.id || "UNKNOWN")}</strong></div><div class="review-row"><span>Config fingerprint</span><strong class="mono">${esc(p.configHash || "UNKNOWN")}</strong></div><div class="actions"><button class="button" data-profile-duplicate="${esc(p.id)}" data-version="${esc(p.version)}">Duplicate</button><button class="button" data-profile-edit="${esc(p.id)}" data-version="${esc(p.version)}">Edit draft</button><button class="button" data-profile-versions="${esc(p.id)}">Versions</button>${p.status !== "ACTIVE" && !p.isDraft ? `<button class="button" data-profile-activate="${esc(p.id)}" data-version="${esc(p.version)}">Activate</button>` : p.isDraft ? `<button class="button" data-profile-activate="${esc(p.id)}" data-version="${esc(p.version)}">Activate after review</button>` : ""}</div><details><summary>Effective JSON (read-only)</summary><pre class="json">${esc(JSON.stringify(p, null, 2))}</pre></details></article>`).join("")}</div><div id="profileEditor" style="margin-top:18px"></div>`;
  const editor = $("#profileEditor");
  const duplicate = async (id, version) => {
    if (!window.mip) return toast("Profile editing requires the packaged Electron application.");
    try { await window.mip.duplicateProfile({ profileId: id, version: Number(version), activate: false }); toast("Immutable profile copy created in SQLite."); profiles = await window.mip.getProfiles(); renderProfiles(); } catch (error) { toast(error.message); }
  };
  document.querySelectorAll("[data-profile-duplicate]").forEach((button) => button.onclick = () => duplicate(button.dataset.profileDuplicate, button.dataset.version));
  $("#duplicate").onclick = () => document.querySelector("[data-profile-duplicate]")?.click();
  document.querySelectorAll("[data-profile-versions]").forEach((button) => button.onclick = async () => {
    try { const rows = await window.mip?.getProfileVersions({ id: button.dataset.profileVersions }); editor.innerHTML = `<div class="card"><h3>Immutable versions · ${esc(button.dataset.profileVersions)}</h3><pre class="json">${esc(JSON.stringify(rows || [], null, 2))}</pre></div>`; } catch (error) { toast(error.message); }
  });
  document.querySelectorAll("[data-profile-activate]").forEach((button) => button.onclick = async () => {
    try {
      await window.mip?.activateProfileVersion({ id: button.dataset.profileActivate, version: Number(button.dataset.version) });
      toast("Profile version activated for future formal sessions.");
      await renderProfiles();
    } catch (error) { toast(error.message); }
  });
  document.querySelectorAll("[data-profile-edit]").forEach((button) => button.onclick = async () => {
    try {
      const profile = window.mip ? await window.mip.getProfile({ id: button.dataset.profileEdit, version: Number(button.dataset.version) }) : profiles.find((item) => item.id === button.dataset.profileEdit);
      const draft = JSON.parse(JSON.stringify(profile));
      const setPath = (path, raw, numeric = false) => {
        const keys = path.split(".");
        let target = draft;
        for (const key of keys.slice(0, -1)) target = target[key] ||= {};
        target[keys.at(-1)] = numeric && raw !== "" ? Number(raw) : raw;
        $("#profileJson").value = JSON.stringify(draft, null, 2);
      };
      editor.innerHTML = `<div class="card"><h3>Guided profile editor · ${esc(profile.id)} v${esc(profile.version)}</h3><p class="subtle">Edit material fields with field-level validation. Immutable versions are created only after the draft passes the main-process validator.</p><fieldset><legend>Identity &amp; protocol</legend><div class="form-grid"><div class="field"><label for="profileName">Name</label><input id="profileName" value="${esc(draft.name || "")}"></div><div class="field"><label for="profilePurpose">Purpose</label><input id="profilePurpose" value="${esc(draft.purpose || "")}"></div><div class="field"><label for="profileTimingMode">Timing mode</label><select id="profileTimingMode"><option>IMMEDIATE_REQUEST</option><option>RELATIVE_DELAY</option><option>ABSOLUTE_DATETIME</option><option>NEXT_ELIGIBLE_OUTPUT</option><option>CONTINUOUS_AROUND_REQUEST</option></select></div><div class="field"><label for="profileOutcomeType">Outcome space</label><input id="profileOutcomeType" value="${esc(draft.outcomeSpace?.type || "")}"></div><div class="field"><label for="profileEncodingModality">Encoding modality</label><input id="profileEncodingModality" value="${esc(draft.encoding?.modality || "")}"></div><div class="field"><label for="profileRngProvider">Random provider</label><select id="profileRngProvider"><option>OS_CSPRNG</option><option>DETERMINISTIC_PRNG_TEST</option></select></div><div class="field"><label for="profileRecipeId">Audio recipe ID</label><input id="profileRecipeId" value="${esc(draft.audio?.recipeId || "")}"></div><div class="field"><label for="profileRecipeVersion">Audio recipe version</label><input id="profileRecipeVersion" type="number" min="1" value="${esc(draft.audio?.version || 1)}"></div></div></fieldset><fieldset style="margin-top:14px"><legend>Output &amp; analysis windows</legend><div class="form-grid"><div class="field"><label for="profileBlockSize">Block size</label><input id="profileBlockSize" type="number" min="1" value="${esc(draft.output?.blockSize || 1)}"></div><div class="field"><label for="profilePreBlocks">Pre blocks</label><input id="profilePreBlocks" type="number" min="0" value="${esc(draft.output?.preBlocks || 0)}"></div><div class="field"><label for="profilePrimaryBlocks">Primary blocks</label><input id="profilePrimaryBlocks" type="number" min="0" value="${esc(draft.output?.primaryBlocks || 0)}"></div><div class="field"><label for="profilePostBlocks">Post blocks</label><input id="profilePostBlocks" type="number" min="0" value="${esc(draft.output?.postBlocks || 0)}"></div><div class="field"><label for="profileThreshold">Threshold</label><input id="profileThreshold" type="number" min="0" step="0.01" value="${esc(draft.analysis?.threshold ?? 0)}"></div><div class="field"><label for="profileSustainedBlocks">Sustained blocks</label><input id="profileSustainedBlocks" type="number" min="1" value="${esc(draft.analysis?.sustainedBlocks || 1)}"></div></div></fieldset><details style="margin-top:14px"><summary>Expert JSON view (read-only)</summary><textarea id="profileJson" readonly style="min-height:280px;width:100%;font-family:monospace">${esc(JSON.stringify(draft, null, 2))}</textarea></details><div class="actions"><button class="button" id="validateProfileDraft">Validate draft</button><button class="button" id="diffProfileDraft">Show material diff</button><button class="button primary" id="saveProfileVersion">Save immutable version</button></div><div id="profileValidation" class="callout" role="status" aria-live="polite" style="margin-top:12px"></div></div>`;
      $("#profileTimingMode").value = draft.timing?.mode || "IMMEDIATE_REQUEST";
      $("#profileRngProvider").value = draft.rng?.provider || "OS_CSPRNG";
      const bindings = [["#profileName", "name"], ["#profilePurpose", "purpose"], ["#profileTimingMode", "timing.mode"], ["#profileOutcomeType", "outcomeSpace.type"], ["#profileEncodingModality", "encoding.modality"], ["#profileRngProvider", "rng.provider"], ["#profileRecipeId", "audio.recipeId"], ["#profileRecipeVersion", "audio.version"], ["#profileBlockSize", "output.blockSize"], ["#profilePreBlocks", "output.preBlocks"], ["#profilePrimaryBlocks", "output.primaryBlocks"], ["#profilePostBlocks", "output.postBlocks"], ["#profileThreshold", "analysis.threshold"], ["#profileSustainedBlocks", "analysis.sustainedBlocks"]];
      bindings.forEach(([selector, path]) => $(selector).addEventListener("input", (event) => setPath(path, event.target.value, /Version|Blocks|Size|threshold/i.test(path))));
      $("#validateProfileDraft").onclick = async () => {
        try { const result = await window.mip?.saveProfileDraft({ profile: draft, baseVersion: Number(button.dataset.version) }); $("#profileValidation").textContent = result?.validation?.valid ? "Draft is valid." : `Draft invalid: ${(result?.validation?.errors || []).join("; ")}`; } catch (error) { $("#profileValidation").textContent = error.message; }
      };
      $("#diffProfileDraft").onclick = () => { const changed = Object.keys(draft).filter((key) => JSON.stringify(draft[key]) !== JSON.stringify(profile[key])); $("#profileValidation").textContent = changed.length ? `Material fields changed: ${changed.join(", ")}` : "No material changes against the selected base version."; };
      $("#saveProfileVersion").onclick = async () => {
        try { await window.mip?.saveProfileVersion({ profile: draft, parentVersion: Number(button.dataset.version), activate: false }); toast("New immutable profile version saved as a draft. Activate it after review."); renderProfiles(); } catch (error) { toast(error.message); }
      };
    } catch (error) { toast(error.message); }
  });
}

async function renderRecipes() {
  const list = window.mip ? await window.mip.getAudioPresets({ allVersions: true }) : presets;
  const current = list || [];
  app.innerHTML = `<div class="section-intro"><div><h2>Audio Recipe Library</h2><p>SQLite-authoritative immutable recipe identities and versions. Incomplete historical candidates remain clearly marked.</p></div><button class="button primary" id="newRecipe">Duplicate selected</button></div><div class="card"><div class="field"><label for="recipeSearch">Search recipes</label><input id="recipeSearch" placeholder="ID, provenance, or material field"></div></div><div class="grid two" id="recipeCards" style="margin-top:18px"></div><div id="recipeEditor" style="margin-top:18px"></div>`;
  const cards = $("#recipeCards");
  const editor = $("#recipeEditor");
  const draw = (query = "") => {
    const term = query.trim().toLowerCase();
    const visible = current.filter((recipe) => !term || JSON.stringify(recipe).toLowerCase().includes(term));
    cards.innerHTML = visible.map((recipe) => `<article class="card recipe-card"><div style="display:flex;justify-content:space-between;gap:12px"><h3>${esc(recipe.recipeId || recipe.id)} · v${esc(recipe.version)}</h3>${pill(recipe.incomplete ? "INCOMPLETE / BLOCKED" : recipe.historicalStatus || recipe.status || "ACTIVE")}</div><p class="subtle">${esc(recipe.name || "Unnamed recipe")} · ${esc(recipe.provenance || "UNKNOWN")}</p><div class="review-row"><span>Channels</span><strong>${esc(recipe.leftHz ?? "layered")} / ${esc(recipe.rightHz ?? "layered")} Hz</strong></div><div class="review-row"><span>Execution</span><strong>${esc(recipe.durationMode || recipe.execution?.mode || "UNKNOWN")}</strong></div><div class="review-row"><span>Activation</span><strong>${recipe.isActive === true && recipe.isDraft !== true && recipe.status === "ACTIVE" ? "ACTIVE" : "NOT ACTIVE"}</strong></div><div class="review-row"><span>Formal operational eligibility</span><strong>${formalOperationalStatus(recipe) ? "ELIGIBLE (protocol permitting)" : "NOT ELIGIBLE"}</strong></div><div class="review-row"><span>Fingerprint</span><strong class="mono">${esc(recipe.configFingerprint || recipe.configHash || "UNKNOWN")}</strong></div>${layerProjection(recipe)}${provenanceProjection(recipe)}${verificationProjection(recipe)}${recipe.incomplete || !formalOperationalStatus(recipe) ? '<div class="callout warning">This version is incomplete or not formally operationally eligible; activation and formal-session gates are shown separately.</div>' : ""}<div class="actions"><button class="button" data-audition="${esc(recipe.recipeId || recipe.id)}" data-version="${esc(recipe.version)}" ${recipe.incomplete || recipe.isDraft || recipe.status !== "ACTIVE" ? "disabled" : ""}>Audition</button><button class="button" data-duplicate="${esc(recipe.recipeId || recipe.id)}" data-version="${esc(recipe.version)}">Duplicate</button><button class="button" data-edit-recipe="${esc(recipe.recipeId || recipe.id)}" data-version="${esc(recipe.version)}">Edit</button><button class="button" data-recipe-versions="${esc(recipe.recipeId || recipe.id)}">Versions</button>${!recipe.incomplete && recipe.status !== "ACTIVE" ? `<button class="button" data-activate-recipe="${esc(recipe.recipeId || recipe.id)}" data-version="${esc(recipe.version)}">Activate after review</button>` : ""}</div><details><summary>Complete effective recipe (read-only)</summary><pre class="json">${esc(JSON.stringify(recipe, null, 2))}</pre></details></article>`).join("") || '<div class="card empty">No recipes match the filter.</div>';
    cards.querySelectorAll("[data-audition]").forEach((button) => button.onclick = async () => {
      try {
        const recipe = window.mip ? await window.mip.getRecipe({ id: button.dataset.audition, version: Number(button.dataset.version) }) : current.find((item) => (item.recipeId || item.id) === button.dataset.audition);
        if (recipe.incomplete || recipe.isDraft || recipe.status !== "ACTIVE") throw new Error("Only active, complete recipes can be auditioned.");
        await playRecipe(recipe);
        toast("Recipe is playing through the OS-selected output. Use Stop to end the audition.");
      } catch (error) { toast(error.message); }
    });
    cards.querySelectorAll("[data-duplicate]").forEach((button) => button.onclick = async () => {
      try {
        if (!window.mip) throw new Error("Recipe editing requires the packaged Electron application.");
        await window.mip.duplicateRecipe({ recipeId: button.dataset.duplicate, version: Number(button.dataset.version), activate: false });
        toast("Immutable recipe copy created in SQLite.");
        renderRecipes();
      } catch (error) { toast(error.message); }
    });
    cards.querySelectorAll("[data-activate-recipe]").forEach((button) => button.onclick = async () => {
      try {
        await window.mip?.activateRecipeVersion({ id: button.dataset.activateRecipe, version: Number(button.dataset.version) });
        toast("Audio recipe version activated for future formal sessions.");
        await renderRecipes();
      } catch (error) { toast(error.message); }
    });
    cards.querySelectorAll("[data-edit-recipe]").forEach((button) => button.onclick = async () => {
      try {
        if (!window.mip) throw new Error("Recipe editing requires the packaged Electron application.");
        const recipe = await window.mip.getRecipe({ id: button.dataset.editRecipe, version: Number(button.dataset.version) });
        const draft = canonicalRecipeEditorDraft(recipe);
        const setPath = (path, raw, numeric = false) => {
          setCanonicalRecipePath(draft, path, numeric && raw !== "" ? Number(raw) : raw);
          $("#recipeJson").value = JSON.stringify(draft, null, 2);
        };
        editor.innerHTML = `<div class="card"><h3>Guided audio recipe editor · ${esc(recipe.recipeId)} v${esc(recipe.version)}</h3><p class="subtle">Material fields are edited explicitly; canonical carrier and execution fields are authoritative. Convenience aliases are derived by normalization and are never edited independently.</p><fieldset><legend>Identity &amp; synthesis</legend><div class="form-grid"><div class="field"><label for="recipeName">Name</label><input id="recipeName" value="${esc(draft.name || "")}"></div><div class="field"><label for="recipeProvenance">Provenance</label><input id="recipeProvenance" value="${esc(draft.provenance || "")}"></div><div class="field"><label for="recipeSynthesisMode">Synthesis mode</label><input id="recipeSynthesisMode" value="${esc(draft.synthesisMode || "")}"></div><div class="field"><label for="recipeSampleRate">Sample rate</label><input id="recipeSampleRate" type="number" min="8000" max="192000" value="${esc(draft.sampleRate || 44100)}"></div><div class="field"><label for="recipeLeftHz">Left carrier (Hz)</label><input id="recipeLeftHz" type="number" min="0" step="0.01" value="${esc(draft.carriers?.[0]?.leftHz ?? "")}"></div><div class="field"><label for="recipeRightHz">Right carrier (Hz)</label><input id="recipeRightHz" type="number" min="0" step="0.01" value="${esc(draft.carriers?.[0]?.rightHz ?? "")}"></div><div class="field"><label for="recipeMasterGain">Master gain</label><input id="recipeMasterGain" type="number" min="0" max="1" step="0.01" value="${esc(draft.masterGain ?? 0.8)}"></div><div class="field"><label for="recipeDurationMode">Execution mode</label><select id="recipeDurationMode"><option value="live">live</option><option value="finite">finite</option></select></div><div class="field"><label for="recipeTargetFrames">Target frames (finite only)</label><input id="recipeTargetFrames" type="number" min="1" value="${esc(draft.execution?.targetFrames ?? "")}"></div></div></fieldset><details style="margin-top:14px"><summary>Expert JSON view (read-only)</summary><textarea id="recipeJson" readonly style="min-height:360px;width:100%;font-family:monospace">${esc(JSON.stringify(draft, null, 2))}</textarea></details><div class="actions" style="margin-top:12px"><button class="button" id="validateRecipeDraft">Validate draft</button><button class="button" id="diffRecipeDraft">Show material diff</button><button class="button primary" id="saveRecipeVersion">Save immutable version</button><label class="check"><input type="checkbox" id="activateRecipe"> Activate new version</label></div><div id="recipeValidation" class="callout" role="status" aria-live="polite" style="margin-top:12px"></div></div>`;
        $("#recipeDurationMode").value = draft.execution?.mode || "live";
        const bindings = [["#recipeName", "name"], ["#recipeProvenance", "provenance"], ["#recipeSynthesisMode", "synthesisMode"], ["#recipeSampleRate", "sampleRate"], ["#recipeLeftHz", "carriers[0].leftHz"], ["#recipeRightHz", "carriers[0].rightHz"], ["#recipeMasterGain", "masterGain"], ["#recipeDurationMode", "execution.mode"], ["#recipeTargetFrames", "execution.targetFrames"]];
        bindings.forEach(([selector, path]) => {
          const element = $(selector);
          const update = (event) => {
            const raw = event.target.value;
            const numeric = /sampleRate|Hz|Gain|targetFrames/i.test(path);
            // A blank finite-only target is an intentional null projection;
            // other blank numeric fields remain invalid and are reported by
            // the repository validator rather than becoming an implicit zero.
            const next = numeric && raw === "" && path === "execution.targetFrames"
              ? null
              : numeric && raw !== "" ? Number(raw) : raw;
            setCanonicalRecipePath(draft, path, next);
            $("#recipeJson").value = JSON.stringify(draft, null, 2);
          };
          element.addEventListener("input", update);
          element.addEventListener("change", update);
        });
        $("#validateRecipeDraft").onclick = async () => {
          try {
            const result = await window.mip.saveRecipeDraft({ recipe: draft, baseVersion: Number(button.dataset.version) });
            $("#recipeValidation").textContent = result?.validation?.valid ? "Draft is valid." : `Draft invalid: ${(result?.validation?.errors || []).join("; ")}`;
          } catch (error) { $("#recipeValidation").textContent = error.message; }
        };
        $("#diffRecipeDraft").onclick = () => { const changed = ["sampleRate", "channels", "synthesisMode", "carriers", "monauralLayers", "septon", "binauralRelationships", "envelope", "noise", "delay", "comb", "lowFrequencySweep", "cues", "protocolCues", "voiceReferences", "masterGain", "headroomDb", "rampSeconds", "execution"].filter((key) => JSON.stringify(draft[key] ?? null) !== JSON.stringify(recipe[key] ?? null)); $("#recipeValidation").textContent = changed.length ? `Material fields changed: ${changed.join(", ")}` : "No material changes against the selected base version."; };
        $("#saveRecipeVersion").onclick = async () => {
          try {
            await window.mip.saveRecipeVersion({ recipe: draft, parentVersion: Number(button.dataset.version), activate: $("#activateRecipe").checked });
            toast("New immutable audio recipe version saved.");
            editor.innerHTML = "";
            await renderRecipes();
          } catch (error) { $("#recipeValidation").textContent = error.message; }
        };
      } catch (error) { toast(error.message); }
    });
    cards.querySelectorAll("[data-recipe-versions]").forEach((button) => button.onclick = async () => {
      try {
        const rows = await window.mip?.getRecipeVersions({ id: button.dataset.recipeVersions });
        editor.innerHTML = `<div class="card"><h3>Immutable recipe versions · ${esc(button.dataset.recipeVersions)}</h3><pre class="json">${esc(JSON.stringify(rows || [], null, 2))}</pre></div>`;
      } catch (error) { toast(error.message); }
    });
  };
  $("#recipeSearch").oninput = (event) => draw(event.target.value);
  $("#newRecipe").onclick = () => cards.querySelector("[data-duplicate]")?.click();
  draw();
}

async function renderAudioHealth() {
  const history = window.mip ? await window.mip.audioHealthHistory({}) : [];
  app.innerHTML = `<div class="section-intro"><div><h2>Audio Health Check</h2><p>Run a real AudioWorklet diagnostic, then record the owner's audible result separately from software telemetry.</p></div>${pill("No participant session")}</div><div class="card"><div class="form-grid"><div class="field"><label for="healthRecipe">Recipe</label><select id="healthRecipe">${presets.filter((recipe) => !recipe.incomplete && recipe.isDraft !== true && recipe.status === "ACTIVE" && recipe.isActive === true).map((recipe) => `<option value="${esc(recipe.id || recipe.recipeId)}">${esc(recipe.id || recipe.recipeId)} · ${esc(recipe.leftHz)}/${esc(recipe.rightHz)} Hz</option>`).join("")}</select></div><div class="field"><label for="healthMode">Check mode</label><select id="healthMode"><option value="QUICK_60S">Quick check · 60 seconds (automated)</option><option value="STABILITY_10M">Stability check · 10 minutes (automated)</option><option value="OWNER_SOAK_60M">Owner soak · 60 minutes (manual stop)</option></select></div><div class="field"><label for="healthResult">Owner result</label><select id="healthResult"><option>Uncertain</option><option>Clean</option><option>Artifact heard</option><option>Left-right issue</option></select></div><div class="field full"><label for="healthNote">Owner note</label><textarea id="healthNote" placeholder="Optional audible observation"></textarea></div></div><div class="actions"><button class="button primary" id="runHealth">Run AudioWorklet diagnostic</button><button class="button" id="stopHealth" disabled>Stop and persist</button></div><div id="healthStatus" class="callout" style="margin-top:16px">No diagnostic is running.</div></div><div class="card" style="margin-top:18px"><h3>Persisted diagnostics</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Started</th><th>Mode</th><th>Recipe</th><th>Frames</th><th>Continuity</th><th>Owner result</th><th>Integrity</th><th></th></tr></thead><tbody id="healthRows">${(history || []).map((row) => `<tr><td>${esc(row.startedUtc)}</td><td>${esc(row.checkMode || "CUSTOM")}</td><td>${esc(row.recipeId)} v${esc(row.recipeVersion)}</td><td>${esc(row.generatedFrames)}</td><td>${row.continuity?.ok === false ? pill("FAIL") : pill("OK")}</td><td>${esc(row.ownerResult || "Uncertain")}</td><td>${pill(row.integrityStatus || "UNVERIFIED")}</td><td><button class="button" data-health-detail="${esc(row.diagnosticId)}">Detail</button></td></tr>`).join("") || '<tr><td colspan="8" class="empty">No diagnostics recorded.</td></tr>'}</tbody></table></div><div id="healthDetail" role="status" aria-live="polite" aria-labelledby="healthDetailHeading" style="margin-top:16px"><h4 id="healthDetailHeading">Diagnostic detail</h4><p class="subtle">Select a persisted record to inspect verification dimensions.</p></div></div>`;
  $("#healthRows").querySelectorAll("[data-health-detail]").forEach((button) => button.onclick = async () => {
    try {
      const row = await window.mip?.audioHealthDetail({ id: button.dataset.healthDetail });
      const verification = await window.mip?.verifyAudioHealth({ id: button.dataset.healthDetail });
      $("#healthDetail").innerHTML = row ? `<div class="callout ${verification?.valid ? "success" : "warning"}"><strong>${esc(row.diagnosticId)}</strong> · ${verification?.valid ? "Integrity verified" : esc((verification?.errors || []).join("; ") || "Integrity unavailable")}</div><pre class="json">${esc(JSON.stringify(row, null, 2))}</pre>` : '<div class="empty">Diagnostic detail unavailable.</div>';
    } catch (error) { toast(error.message); }
  });
  let running = Boolean(player.healthCheckMode && player.status !== "stopped");
  if (running) {
    if ($("#healthMode")) $("#healthMode").value = player.healthCheckMode;
    if ($("#runHealth")) $("#runHealth").disabled = true;
    if ($("#stopHealth")) $("#stopHealth").disabled = false;
    if ($("#healthStatus")) $("#healthStatus").textContent = `${player.healthCheckMode} running. Stop and persist the diagnostic when ready.`;
  }
  $("#runHealth").onclick = async () => {
    if (running) return;
    running = true;
    try {
      const recipeId = $("#healthRecipe").value;
      const recipe = window.mip ? await window.mip.getRecipe({ id: recipeId }) : presets.find((item) => (item.id || item.recipeId) === recipeId);
      const mode = $("#healthMode").value;
      const durations = { QUICK_60S: 60_000, STABILITY_10M: 600_000, OWNER_SOAK_60M: 3_600_000 };
      const challenge = window.mip?.prepareAudioHealth
        ? await window.mip.prepareAudioHealth({ recipeId: recipe.recipeId || recipe.id, recipeVersion: recipe.version, sampleRate: recipe.sampleRate, channels: recipe.channels })
        : null;
      await preparePlayer(recipe, {
        autoStart: true,
        formal: false,
        handshake: challenge?.handshake || { digestVersion: "MIP_PCM_SHA256_V1", pcmFormat: "PCM16LE_INTERLEAVED_LR", channels: 2 },
        healthCheck: { mode, intendedDurationMs: durations[mode], challengeId: challenge?.challengeId || null },
      });
      $("#runHealth").disabled = true;
      $("#stopHealth").disabled = false;
      if (mode !== "OWNER_SOAK_60M") player.healthTimer = setTimeout(() => $("#stopHealth")?.click(), durations[mode]);
      $("#healthStatus").textContent = `${mode} running. It will stop automatically at the intended duration unless stopped manually.`;
    } catch (error) {
      try { await stopPlayer(); } catch {}
      running = false;
      toast(error.message);
    }
  };
  $("#stopHealth").onclick = async () => {
    if (!running) return;
    const controller = player.controller;
    const healthMode = player.healthCheckMode || $("#healthMode").value;
    const healthIntendedDurationMs = player.healthIntendedDurationMs || null;
    const healthChallengeId = player.healthChallengeId || null;
    const startedAt = player.started;
    const startedUtc = new Date(Date.now() - Math.max(0, performance.now() - startedAt)).toISOString();
    try {
      const finalization = await stopPlayer();
      const diagnostics = controller?.diagnostics?.() || {};
      if (window.mip && finalization) {
        const result = await window.mip.audioHealth({
          diagnosticId: `HEALTH-${Date.now()}`,
          recipeId: finalization.recipeId || controller?.recipe?.recipeId,
          recipeVersion: finalization.recipeVersion || controller?.recipe?.version,
          startedUtc,
          endedUtc: new Date().toISOString(),
          sampleRate: finalization.sampleRate || diagnostics.sampleRate,
          baseLatency: diagnostics.baseLatency,
          outputLatency: diagnostics.outputLatency,
          generatedFrames: finalization.totalFrames,
          continuity: finalization.continuity,
          clipping: finalization.clipping,
          contextStates: diagnostics.contextStateChanges,
          ownerResult: $("#healthResult").value,
          ownerNote: $("#healthNote").value,
          checkMode: healthMode,
          intendedDurationMs: healthIntendedDurationMs,
          challengeId: healthChallengeId,
          telemetry: { ...(diagnostics.telemetry || {}), ...finalization, type: "TELEMETRY", processorVersion: finalization.processorVersion, digestVersion: finalization.digestVersion, pcmFormat: finalization.pcmFormat, channels: finalization.channels, configFingerprint: finalization.configFingerprint || controller?.recipe?.configFingerprint },
          digest: finalization.digest,
          format: { digestVersion: finalization.digestVersion || "MIP_PCM_SHA256_V1", sampleRate: finalization.sampleRate, channels: 2, sampleFormat: "PCM16LE_INTERLEAVED_LR" },
          observations: (diagnostics.contextStateChanges || []).map((change) => ({
            observedUtc: new Date(Date.now() - Math.max(0, performance.now() - Number(change.at || performance.now()))).toISOString(),
            contextState: change.state,
            observationType: change.state === "suspended" ? "SUSPEND" : change.state === "running" ? "RESUME" : "CONTEXT_STATE",
            suspended: change.state === "suspended",
            resumed: change.state === "running",
          })),
        });
        $("#healthStatus").textContent = `Persisted diagnostic ${result.diagnosticId} · ${result.integrityStatus}`;
      }
      running = false;
      $("#runHealth").disabled = false;
      $("#stopHealth").disabled = true;
      setTimeout(renderAudioHealth, 0);
    } catch (error) {
      toast(error.message);
      running = false;
    }
  };
}

async function renderSettings() {
  const value = window.mip ? await window.mip.getSettings() : { schemaVersion: "server-managed" };
  const backupHistory = window.mip?.backupHistory ? await window.mip.backupHistory({ limit: 50 }) : [];
  const defaults = value.researchDefaults && typeof value.researchDefaults === "object" ? value.researchDefaults : {};
  const defaultSpace = defaults.outcomeSpace && typeof defaults.outcomeSpace === "object" ? defaults.outcomeSpace : {};
  const defaultAnalysis = defaults.temporalAnalysis && typeof defaults.temporalAnalysis === "object" ? defaults.temporalAnalysis : (defaults.analysis && typeof defaults.analysis === "object" ? defaults.analysis : {});
  const defaultWindow = Array.isArray(defaultAnalysis.windows) && defaultAnalysis.windows[0] ? defaultAnalysis.windows[0] : {};
  const defaultFineWindows = Array.isArray(defaultAnalysis.windows) ? defaultAnalysis.windows.slice(1).map((window) => Number(window.preMs || window.postMs || 0) / 1000).filter((seconds) => Number.isFinite(seconds) && seconds > 0).join(", ") : "";
  app.innerHTML = `<div class="section-intro"><div><h2>Settings &amp; Data</h2><p>Owner-controlled diagnostics, backups, and research defaults. Runtime session evidence remains in SQLite.</p></div></div><div class="grid two"><div class="card"><h3>Application identity</h3>${[["App version", value.appVersion], ["Engine version", value.engineVersion], ["Audio version", value.audioVersion], ["Processor version", value.processorVersion], ["Schema version", value.schemaVersion], ["Database", value.databasePath], ["Database size", `${value.databaseSize || 0} bytes`]].map(([label, item]) => `<div class="review-row"><span>${esc(label)}</span><strong class="${label === "Database" ? "mono" : ""}">${esc(item ?? "Not recorded")}</strong></div>`).join("")}<button class="button" id="copyDbPath">Copy database path</button></div><div class="card"><h3>Research Defaults</h3><div class="form-grid"><div class="field"><label for="defaultMin">Outcome range minimum</label><input id="defaultMin" type="number" step="1" value="${esc(defaultSpace.minInclusive ?? defaultSpace.min ?? "")}"></div><div class="field"><label for="defaultMax">Outcome range maximum</label><input id="defaultMax" type="number" step="1" value="${esc(defaultSpace.maxInclusive ?? defaultSpace.max ?? "")}"></div><div class="field"><label for="defaultCadence">Machine output cadence</label><select id="defaultCadence"><option value="FIXED_INTERVAL">Fixed interval</option><option value="FIXED_COUNT">Fixed count</option><option value="EVENT_DRIVEN">Event driven</option></select></div><div class="field"><label for="defaultEndpoint">Primary endpoint</label><select id="defaultEndpoint"><option value="EXACT_SLOT">Exact scheduled target slot</option><option value="FIXED_TIME_WINDOW">Fixed committed time window</option><option value="FIXED_SEQUENCE_WINDOW">Fixed committed sequence window</option><option value="TARGET_FREQUENCY">Target frequency</option></select></div><div class="field"><label for="defaultPre">Default pre-target duration (seconds)</label><input id="defaultPre" type="number" min="0" step="any" value="${esc(Number(defaultWindow.preMs || 0) / 1000)}"></div><div class="field"><label for="defaultPost">Default post-target duration (seconds)</label><input id="defaultPost" type="number" min="0" step="any" value="${esc(Number(defaultWindow.postMs || 0) / 1000)}"></div><div class="field full"><label for="defaultFineWindows">Fine windows (seconds, comma separated)</label><input id="defaultFineWindows" value="${esc(defaultFineWindows)}" placeholder="10, 30, 60, 120"><small>These are precommitted defaults only; later exploratory scans remain labelled post-hoc.</small></div></div><div class="review-row"><span>Default cardinality</span><strong id="defaultCardinality">${defaultSpace.type === "INTEGER_RANGE" && Number.isSafeInteger(Number(defaultSpace.minInclusive ?? defaultSpace.min)) && Number.isSafeInteger(Number(defaultSpace.maxInclusive ?? defaultSpace.max)) ? esc(new Intl.NumberFormat().format(Number(defaultSpace.maxInclusive ?? defaultSpace.max) - Number(defaultSpace.minInclusive ?? defaultSpace.min) + 1)) : "Set a range to calculate K"}</strong></div><details style="margin-top:12px"><summary>Expert view (read-only)</summary><pre class="json">${esc(JSON.stringify(defaults, null, 2))}</pre></details><small>Precedence: session override → profile → application default. Defaults are validated, canonicalized, hashed, and stored before use.</small><div class="field" style="margin-top:12px"><label for="theme">Theme</label><input id="theme" value="${esc(value.theme || "default")}"></div><div class="field"><label for="audioLabel">Audio output label</label><input id="audioLabel" value="${esc(value.audioOutputLabel || "")}"></div><button class="button primary" id="saveSettings">Save settings</button></div></div><div class="card" style="margin-top:18px"><h3>Evidence data operations</h3><div class="actions"><button class="button" id="backup">Create verified backup</button><button class="button" id="restore">Restore selected backup</button><button class="button" id="import">Import legacy bundle</button><button class="button" id="diagnosticsExport">Export diagnostics</button></div><div class="form-grid" style="margin-top:14px"><div class="field"><label for="exportSessionId">Revealed session ID for export</label><input id="exportSessionId" placeholder="S0003"></div><button class="button" id="exportSession">Export session bundle</button></div><div id="dataStatus" class="callout" style="margin-top:16px">${value.lastBackup ? `Last verified backup: ${esc(value.lastBackup.createdUtc)} · ${esc(value.lastBackup.sha256)}` : "No backup recorded."}</div><details style="margin-top:14px"><summary>Backup history</summary><div>${backupHistory.map((row) => `<div class="review-row"><span>${esc(row.createdUtc)} · ${esc(row.backupId)}</span><strong>${row.verified ? "VERIFIED" : "UNVERIFIED"}</strong></div>`).join("") || '<p class="subtle">No backups recorded.</p>'}</div></details></div>`;
  $("#defaultCadence").value = ["FIXED_INTERVAL", "FIXED_COUNT", "EVENT_DRIVEN"].includes(String(defaultAnalysis.outputCadence || "").toUpperCase()) ? String(defaultAnalysis.outputCadence).toUpperCase() : "FIXED_INTERVAL";
  $("#defaultEndpoint").value = ["EXACT_SLOT", "FIXED_TIME_WINDOW", "FIXED_SEQUENCE_WINDOW", "TARGET_FREQUENCY"].includes(String(defaultAnalysis.primaryEndpoint || "").toUpperCase()) ? String(defaultAnalysis.primaryEndpoint).toUpperCase() : "EXACT_SLOT";
  const updateDefaultCardinality = () => {
    const min = Number($("#defaultMin")?.value);
    const max = Number($("#defaultMax")?.value);
    if ($("#defaultCardinality")) $("#defaultCardinality").textContent = Number.isSafeInteger(min) && Number.isSafeInteger(max) && max >= min ? new Intl.NumberFormat().format(max - min + 1) : "Set a valid range to calculate K";
  };
  $("#defaultMin").oninput = updateDefaultCardinality;
  $("#defaultMax").oninput = updateDefaultCardinality;
  $("#copyDbPath").onclick = async () => { try { await navigator.clipboard?.writeText(value.databasePath || ""); toast("Database path copied."); } catch { toast(value.databasePath || "Database path unavailable."); } };
  $("#diagnosticsExport").onclick = async () => { try { const result = await window.mip?.exportDiagnostics({}); $("#dataStatus").textContent = result?.cancelled ? "Diagnostics export cancelled." : `Diagnostics exported to ${result.path}`; } catch (error) { toast(error.message); } };
  $("#exportSession").onclick = async () => { try { const id = $("#exportSessionId").value.trim(); if (!id) throw new Error("Enter a revealed session ID first."); const result = await window.mip?.exportSession({ id }); $("#dataStatus").textContent = result?.directory ? `Session bundle exported to ${result.directory}.` : "Session export completed."; } catch (error) { toast(error.message); } };
  $("#saveSettings").onclick = async () => {
    try {
      const minRaw = $("#defaultMin").value.trim();
      const maxRaw = $("#defaultMax").value.trim();
      const min = minRaw === "" ? null : Number(minRaw);
      const max = maxRaw === "" ? null : Number(maxRaw);
      if ((min === null) !== (max === null) || (min !== null && (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min)))
        throw new Error("Outcome defaults must contain both safe integer bounds with minimum ≤ maximum.");
      const preSeconds = Number($("#defaultPre").value || 0);
      const postSeconds = Number($("#defaultPost").value || 0);
      if (![preSeconds, postSeconds].every((item) => Number.isFinite(item) && item >= 0)) throw new Error("Default temporal durations must be non-negative numbers.");
      const fineWindows = $("#defaultFineWindows").value.split(",").map((item) => item.trim()).filter(Boolean).map(Number);
      if (fineWindows.some((item) => !Number.isFinite(item) || item <= 0) || fineWindows.length > 8) throw new Error("Fine windows must be positive seconds (at most eight).")
      const researchDefaults = { ...defaults, temporalAnalysis: { ...(defaults.temporalAnalysis || {}), primaryEndpoint: $("#defaultEndpoint").value, outputCadence: $("#defaultCadence").value, windows: [{ id: "primary", enabled: true, preMs: preSeconds * 1000, postMs: postSeconds * 1000 }, ...fineWindows.map((seconds, index) => ({ id: `fine-${index + 1}`, enabled: true, preMs: seconds * 1000, postMs: seconds * 1000, exploratory: false }))] } };
      if (min !== null) researchDefaults.outcomeSpace = { type: "INTEGER_RANGE", minInclusive: min, maxInclusive: max };
      else if (researchDefaults.outcomeSpace && researchDefaults.outcomeSpace.type === "INTEGER_RANGE") delete researchDefaults.outcomeSpace;
      await window.mip?.updateSettings({ theme: $("#theme").value, audioOutputLabel: $("#audioLabel").value, researchDefaults });
      toast("Settings saved.");
    } catch (error) { toast(error.message); }
  };
  $("#backup").onclick = async () => {
    try { const result = await window.mip?.backupNow({}); $("#dataStatus").textContent = result ? `Verified backup created: ${result.path} · ${result.sha256}` : "Backup unavailable outside Electron."; } catch (error) { toast(error.message); }
  };
  $("#restore").onclick = async () => {
    if (!confirm("Restore the selected backup? A verified safety backup of the current database will be created first.")) return;
    try { const result = await window.mip?.restoreBackup({}); $("#dataStatus").textContent = result?.restored ? `Restore verified. Schema ${result.schemaVersion}. Safety backup: ${result.safetyBackup?.path || "created"}. Post-restore integrity: ${result.postRestore?.valid ? "VALID" : "REVIEW REQUIRED"}.` : "Restore cancelled."; } catch (error) { toast(error.message); }
  };
  $("#import").onclick = async () => {
    try { const result = await window.mip?.importLegacy({}); $("#dataStatus").textContent = result?.cancelled ? "Import cancelled." : `Imported ${result?.imported || 0} legacy session(s); source integrity: ${result?.sourceIntegrityStatus || "UNKNOWN"}.`; } catch (error) { toast(error.message); }
  };
}

async function renderAggregate() {
  const sessions = window.mip ? await window.mip.listSessions({}) : [];
  const revealed = sessions.filter((session) => session.hasReveal === true);
  const renderAggregateDetails = (aggregate) => {
    const analysis = aggregate?.analysis || aggregate || {};
    const metric = (label, value) => `<div class="review-row"><span>${esc(label)}</span><strong>${esc(value === null || value === undefined ? "—" : typeof value === "number" ? value.toLocaleString() : value)}</strong></div>`;
    const rate = analysis.primaryHitRate === null || analysis.primaryHitRate === undefined ? "—" : `${(Number(analysis.primaryHitRate) * 100).toFixed(2)}%`;
    const firstMedian = analysis.firstHitLatency?.medianMs === null || analysis.firstHitLatency?.medianMs === undefined ? "—" : `${Number(analysis.firstHitLatency.medianMs).toLocaleString()} ms`;
    const histogram = Object.entries(analysis.latencyHistogram || {}).sort((left, right) => Number(left[0]) - Number(right[0]));
    const histogramHtml = histogram.length
      ? `<div class="subtle" style="margin-top:12px">Signed latency histogram (one-second buckets)</div><div class="distribution-chart">${histogram.slice(0, 128).map(([bucket, count]) => `<div class="bar-row"><span>${esc(bucket)}s</span><span class="bar" style="width:${Math.max(2, Math.min(100, Number(count) / Math.max(1, Number(analysis.hits || count)) * 100))}%" role="img" aria-label="${esc(bucket)} seconds, ${esc(count)} hits"></span><strong>${esc(count)}</strong></div>`).join("")}${histogram.length > 128 ? `<div class="subtle">${histogram.length - 128} additional buckets are available in the export.</div>` : ""}</div>`
      : '<div class="empty">No signed target-relative latencies recorded.</div>';
    const rasterHtml = Array.isArray(analysis.targetAlignedRaster) && analysis.targetAlignedRaster.length
      ? `<div class="subtle" style="margin-top:16px">Target-aligned raster (T = 0 ms)</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Session</th><th>Signed latencies</th></tr></thead><tbody>${analysis.targetAlignedRaster.map((row) => `<tr><td>${esc(row.sessionId)}</td><td class="mono">${esc((row.latenciesMs || []).map((value) => `${value} ms`).join(" · ") || "No hit")}</td></tr>`).join("")}</tbody></table></div>`
      : "";
    const cumulativeHtml = Array.isArray(analysis.cumulativeObservedVsNull) && analysis.cumulativeObservedVsNull.length
      ? `<div class="subtle" style="margin-top:16px">Cumulative observed versus null expectation</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Session</th><th>Observed</th><th>Expected</th></tr></thead><tbody>${analysis.cumulativeObservedVsNull.map((row) => `<tr><td>${esc(row.sessionId)}</td><td>${esc(row.observedHits)}</td><td>${esc(Number(row.expectedHits || 0).toFixed(3))}</td></tr>`).join("")}</tbody></table></div>`
      : "";
    const perWindowHtml = Array.isArray(analysis.perWindow) && analysis.perWindow.length
      ? `<div class="subtle" style="margin-top:16px">Per-window observed versus expected hits</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Session</th><th>Window</th><th>Observed</th><th>Expected</th><th>Eligible</th></tr></thead><tbody>${analysis.perWindow.map((row) => `<tr><td>${esc(row.sessionId)}</td><td>${esc(row.id)}${row.exploratory ? " · exploratory" : ""}</td><td>${esc(row.observedHits)}</td><td>${esc(Number(row.expectedHits || 0).toFixed(3))}</td><td>${esc(row.eligibleCount)}</td></tr>`).join("")}</tbody></table></div>`
      : "";
    return `<div class="card" style="margin-top:16px"><div class="section-intro"><div><h3>Aggregate ${esc(aggregate?.aggregateId || "analysis")}</h3><p class="subtle">${esc(analysis.labels?.aggregate || "Compatible committed sessions")}</p></div>${pill(analysis.exploratory ? "EXPLORATORY" : "CONFIRMATORY")}</div>${metric("Sessions", analysis.sessionCount)}${metric("Completed sessions", analysis.completedSessionCount)}${metric("Incomplete / deviated", `${analysis.incompleteSessionCount ?? 0} / ${analysis.deviatedSessionCount ?? 0}`)}${metric("Exact primary matches", analysis.primaryHits)}${metric("Exact primary hit rate", rate)}${metric("Expected exact primary matches (null)", analysis.expectedExactPrimaryMatches)}${metric("Target occurrences", analysis.hits)}${metric("Total eligible opportunities", analysis.eligibleCount)}${metric("Pre-target / post-target hits", `${analysis.preTargetHitCount ?? 0} / ${analysis.postTargetHitCount ?? 0}`)}${metric("No-hit sessions", analysis.noHitSessionCount)}${metric("Median first-hit latency", firstMedian)}${metric("Temporal hit density", analysis.temporalHitDensity?.hitsPerEligibleOpportunity)}${histogramHtml}${rasterHtml}${cumulativeHtml}${perWindowHtml}</div>`;
  };
  app.innerHTML = `<div class="section-intro"><div><h2>Aggregate Workspace</h2><p>Cross-session analysis is restricted to revealed sessions with compatible committed definitions.</p></div>${pill("DISCOVER → PRECOMMIT → REPLICATE → AGGREGATE")}</div><div class="card"><p class="subtle">Select revealed sessions. Primary endpoints remain confirmatory; all other occurrences are labelled exploratory.</p><div class="form-grid"><div class="field full"><label for="aggregateSessions">Revealed session IDs</label><select id="aggregateSessions" multiple size="8">${revealed.map((session) => `<option value="${esc(session.sessionId)}">${esc(session.sessionId)} · ${esc(session.profileId)} · ${esc(session.research?.mode || "INFLUENCE")}</option>`).join("")}</select></div></div><button class="button primary" id="runAggregate" ${revealed.length < 1 ? "disabled" : ""}>Run compatible aggregate</button><div id="aggregateResult" style="margin-top:16px"></div></div><div class="card" style="margin-top:18px"><h3>Saved aggregate analyses</h3><div id="aggregateHistory">Loading…</div></div>`;
  const draw = async () => {
    try {
      const rows = await window.mip?.listAggregates?.({ limit: 100 }) || [];
      $("#aggregateHistory").innerHTML = rows.length ? rows.map((row) => `<div class="review-row"><span>${esc(row.aggregateId)} · ${esc(row.createdUtc)}</span><strong>${esc(row.workflow)} · ${row.exploratory ? "EXPLORATORY" : "CONFIRMATORY"} <button class="button" data-view-aggregate="${esc(row.aggregateId)}">View</button> <button class="button" data-export-aggregate="${esc(row.aggregateId)}">Export</button></strong></div>`).join("") : '<p class="subtle">No aggregate analyses recorded.</p>';
      $("#aggregateHistory").querySelectorAll("[data-view-aggregate]").forEach((button) => button.onclick = async () => {
        try { const aggregate = await window.mip?.getAggregate?.({ aggregateId: button.dataset.viewAggregate }); $("#aggregateResult").innerHTML = renderAggregateDetails(aggregate); } catch (error) { toast(error.message); }
      });
      $("#aggregateHistory").querySelectorAll("[data-export-aggregate]").forEach((button) => button.onclick = async () => {
        try { const result = await window.mip?.exportAggregate({ aggregateId: button.dataset.exportAggregate }); toast(result?.directory ? `Aggregate exported to ${result.directory}.` : "Aggregate export completed."); } catch (error) { toast(error.message); }
      });
    } catch (error) { $("#aggregateHistory").textContent = error.message; }
  };
  $("#runAggregate").onclick = async () => {
    const sessionIds = [...$("#aggregateSessions").selectedOptions].map((option) => option.value);
    if (!sessionIds.length) return toast("Select at least one revealed session.");
    try {
      const result = await window.mip.runAggregate({ sessionIds, workflow: "AGGREGATE" });
      $("#aggregateResult").innerHTML = `<div class="callout success">Aggregate ${esc(result.aggregateId)} saved.</div>${renderAggregateDetails(result)}`;
      draw();
    } catch (error) { toast(error.message); }
  };
  draw();
}

async function renderCalibration() {
  const [history, settings] = window.mip
    ? await Promise.all([window.mip.calibrationHistory({}), window.mip.getSettings?.() || Promise.resolve({})])
    : [[], {}];
  const configuredDefault = settings?.researchDefaults?.outcomeSpace;
  const applicationDefault = configuredDefault && typeof configuredDefault === "object"
    ? jsonSafe(configuredDefault)
    : { type: "BINARY", values: [0, 1] };
  const profileOptions = (profiles || []).filter((profile) => profile?.outcomeSpace && typeof profile.outcomeSpace === "object");
  const defaultProfileId = selectedProfile?.id && profileOptions.some((profile) => profile.id === selectedProfile.id)
    ? selectedProfile.id
    : profileOptions[0]?.id || "";
  const profileMarkup = profileOptions.length
    ? profileOptions.map((profile) => `<option value="${esc(profile.id)}">${esc(profile.id)} · ${esc(profile.outcomeSpace.type || "UNKNOWN")}</option>`).join("")
    : '<option value="">No profile outcome spaces available</option>';
  app.innerHTML = `<div class="section-intro"><div><h2>Calibration</h2><p>Calibration runs in the authoritative main-process RNG service and is persisted in SQLite.</p></div>${pill("No participant session")}</div><div class="card"><div class="form-grid"><div class="field"><label for="calRng">Random source</label><select id="calRng"><option>OS_CSPRNG</option><option>DETERMINISTIC_PRNG_TEST</option></select></div><div class="field"><label for="calN">Sample count</label><input id="calN" type="number" value="256" min="2"></div><div class="field"><label for="calSpaceSource">Outcome space</label><select id="calSpaceSource"><option value="APPLICATION_DEFAULT">Application default</option><option value="PROFILE">Profile outcome space</option><option value="BINARY">Binary</option><option value="INTEGER_RANGE">Integer range</option></select></div><div class="field" id="calProfileField"><label for="calProfile">Profile</label><select id="calProfile" ${profileOptions.length ? "" : "disabled"}>${profileMarkup}</select></div><div class="field" id="calRangeFields" hidden><label>Integer range</label><div class="form-grid"><input id="calRangeMin" type="number" step="1" value="0" aria-label="Calibration range minimum"><input id="calRangeMax" type="number" step="1" value="1" aria-label="Calibration range maximum"></div><small>Minimum and maximum are inclusive; no values are enumerated.</small></div></div><div class="review-row"><span>Selected outcome space / K</span><strong id="calSpaceSummary">APPLICATION_DEFAULT</strong></div><div id="calValidation" class="callout" role="status" aria-live="polite" style="margin-top:12px"></div><button class="button primary" id="runCal" style="margin-top:16px">Run calibration</button></div><div id="calResult" style="margin-top:18px"></div><div class="card" style="margin-top:18px"><div class="section-intro"><div><h3>Calibration history</h3><p class="subtle">Historical results are immutable; filtering never changes their evidence.</p></div><input id="calFilter" class="button" placeholder="Provider or integrity status" aria-label="Filter calibration history"></div><div id="calHistory"></div><div id="calDetail" style="margin-top:16px"></div></div>`;
  $("#calProfile").value = defaultProfileId;
  const historyContainer = $("#calHistory");
  const detailContainer = $("#calDetail");
  const formatCount = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat().format(Number(value)) : String(value ?? "—");
  const formatSpace = (space) => space?.type === "INTEGER_RANGE"
    ? `${space.type} · ${space.minInclusive}..${space.maxInclusive}`
    : `${space?.type || "UNKNOWN"}${Array.isArray(space?.values) ? ` · ${space.values.join(", ")}` : ""}`;
  const updateRangeCardinality = () => {
    const min = Number($("#calRangeMin")?.value);
    const max = Number($("#calRangeMax")?.value);
    const valid = Number.isSafeInteger(min) && Number.isSafeInteger(max) && max >= min;
    $("#calSpaceSummary").textContent = $("#calSpaceSource").value === "INTEGER_RANGE" && valid
      ? formatSpace({ type: "INTEGER_RANGE", minInclusive: min, maxInclusive: max }) + ` · K=${new Intl.NumberFormat().format(max - min + 1)}`
      : $("#calSpaceSource").value;
    return valid;
  };
  const updateSpaceControls = () => {
    const source = $("#calSpaceSource").value;
    $("#calProfileField").hidden = source !== "PROFILE";
    $("#calRangeFields").hidden = source !== "INTEGER_RANGE";
    if (source === "APPLICATION_DEFAULT") $("#calSpaceSummary").textContent = `${formatSpace(applicationDefault)} · application default`;
    else if (source === "PROFILE") {
      const profile = profileOptions.find((item) => item.id === $("#calProfile").value);
      $("#calSpaceSummary").textContent = profile ? `${formatSpace(profile.outcomeSpace)} · ${profile.id}` : "PROFILE · unavailable";
    } else if (source === "BINARY") $("#calSpaceSummary").textContent = "BINARY · 0, 1 · K=2";
    else updateRangeCardinality();
  };
  const requestedOutcomeSpace = () => {
    const source = $("#calSpaceSource").value;
    if (source === "APPLICATION_DEFAULT") return jsonSafe(applicationDefault);
    if (source === "BINARY") return { type: "BINARY", values: [0, 1] };
    if (source === "PROFILE") {
      const profile = profileOptions.find((item) => item.id === $("#calProfile").value);
      if (!profile) throw new Error("Select a profile with a valid outcome space.");
      return jsonSafe(profile.outcomeSpace);
    }
    const min = Number($("#calRangeMin").value);
    const max = Number($("#calRangeMax").value);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min)
      throw new Error("Integer range requires safe integer bounds with minimum ≤ maximum.");
    return { type: "INTEGER_RANGE", minInclusive: min, maxInclusive: max };
  };
  $("#calSpaceSource").onchange = updateSpaceControls;
  $("#calProfile").onchange = updateSpaceControls;
  $("#calRangeMin").oninput = updateRangeCardinality;
  $("#calRangeMax").oninput = updateRangeCardinality;
  updateSpaceControls();
  const drawHistory = (query = "") => {
    const term = query.trim().toLowerCase();
    const rows = (history || []).filter((row) => !term || JSON.stringify(row).toLowerCase().includes(term));
    historyContainer.innerHTML = rows.length ? rows.map((row) => `<article class="review-row"><span>${esc(row.createdUtc)} · ${esc(row.provider || "UNKNOWN")} · ${esc(row.sampleCount)} observations · ${esc(formatSpace(row.statistics?.outcomeSpace))} · K=${esc(formatCount(row.statistics?.cardinality))}</span><div>${renderDistribution(row.counts, { statistics: row.statistics })}<button class="button" data-cal-detail="${esc(row.calibrationId)}">Detail</button> ${pill(row.integrityStatus || "UNVERIFIED")}</div></article>`).join("") : '<div class="empty">No calibration records match the filter.</div>';
    historyContainer.querySelectorAll("[data-cal-detail]").forEach((button) => button.onclick = async () => {
      try {
        const row = await window.mip?.calibrationDetail({ id: button.dataset.calDetail });
        const verification = window.mip ? await window.mip.verifyCalibration({ id: button.dataset.calDetail }) : null;
        detailContainer.innerHTML = row ? `<div class="card"><h4>${esc(row.calibrationId)} · immutable detail</h4>${fieldRow("Provider", `${row.provider} · ${row.providerVersion}`)}${fieldRow("Samples", formatCount(row.sampleCount))}${fieldRow("Outcome space", formatSpace(row.statistics?.outcomeSpace))}${fieldRow("Cardinality K", formatCount(row.statistics?.cardinality))}${fieldRow("Unique / duplicates", `${formatCount(row.statistics?.uniqueCount)} / ${formatCount(row.statistics?.duplicateCount)}`)}${fieldRow("Observed min / max", `${row.statistics?.min ?? "—"} / ${row.statistics?.max ?? "—"}`)}${fieldRow("Result hash", row.resultHash, { mono: true })}${fieldRow("Statistics", row.statistics)}${fieldRow("Integrity", verification?.valid ? "VERIFIED" : verification?.errors?.join("; ") || row.integrityStatus || "UNVERIFIED")}</div>` : '<div class="empty">Calibration detail unavailable.</div>';
      } catch (error) { toast(error.message); }
    });
  };
  $("#calFilter").oninput = (event) => drawHistory(event.target.value);
  $("#runCal").onclick = async () => {
    if (!window.mip) return toast("Calibration requires the Electron application.");
    try {
      const outcomeSpace = requestedOutcomeSpace();
      const result = await window.mip.runCalibration({ provider: $("#calRng").value, samples: Number($("#calN").value), outcomeSpace });
      const countTotal = Object.values(result.counts || {}).reduce((sum, count) => sum + Number(count || 0), 0);
      const statistics = result.statistics || {};
      $("#calValidation").textContent = "";
      $("#calResult").innerHTML = `<div class="card"><h3>Persisted calibration result</h3><div class="review-row"><span>Provider</span><strong>${esc(result.provider)} · ${esc(result.providerVersion)}</strong></div><div class="review-row"><span>Samples</span><strong>${esc(formatCount(result.samples ?? result.sampleCount ?? countTotal))}</strong></div><div class="review-row"><span>Outcome space</span><strong>${esc(formatSpace(statistics.outcomeSpace))}</strong></div><div class="review-row"><span>Cardinality K</span><strong>${esc(formatCount(statistics.cardinality))}</strong></div><div class="review-row"><span>Unique outcomes / duplicates</span><strong>${esc(formatCount(statistics.uniqueCount ?? Object.keys(result.counts || {}).length))} / ${esc(formatCount(statistics.duplicateCount))}</strong></div><div class="review-row"><span>Numeric min / max</span><strong>${esc(statistics.min ?? "—")} / ${esc(statistics.max ?? "—")}</strong></div><div class="review-row"><span>Observed buckets</span><strong>${esc(formatCount(statistics.bucketCount ?? Object.keys(result.counts || {}).length))}</strong></div>${renderDistribution(result.counts, { statistics })}<div class="review-row"><span>SHA-256</span><strong class="mono">${esc(result.resultHash)}</strong></div><div class="review-row"><span>Integrity</span><strong>${esc(result.integrityStatus || "UNVERIFIED")}</strong></div></div>`;
      toast("Calibration persisted in SQLite.");
      setTimeout(renderCalibration, 0);
    } catch (error) { $("#calValidation").textContent = error.message; toast(error.message); }
  };
  drawHistory();
}
async function renderReports() {
  const list = await sessionService.list();
  app.innerHTML = `<div class="section-intro"><div><h2>Sessions & Reports</h2><p>Review every complete, incomplete, aborted, and integrity-failed bundle.</p></div><input id="filter" class="button" placeholder="Filter by ID or profile" aria-label="Filter sessions"></div><div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Session</th><th>Date</th><th>Profile</th><th>Status</th><th>Reveal</th></tr></thead><tbody id="rows">${list.map((m) => `<tr data-q="${esc((m.sessionId + " " + m.profileId).toLowerCase())}"><td><button class="button" data-id="${esc(m.sessionId)}">${esc(m.sessionId)}</button></td><td>${new Date(m.createdUtc).toLocaleString()}</td><td>${esc(m.profileId)}</td><td>${pill(m.status)}</td><td>${m.hasReveal ? "Available" : m.revealEligible ? `<button class="button primary" data-reveal-id="${esc(m.sessionId)}">Reveal</button>` : "Gated"}</td></tr>`).join("") || '<tr><td colspan="5"><div class="empty">No sessions yet.</div></td></tr>'}</tbody></table></div></div>`;
  $("#filter").oninput = (e) =>
    document
      .querySelectorAll("#rows tr")
      .forEach(
        (r) =>
          (r.style.display = r.dataset.q?.includes(e.target.value.toLowerCase())
            ? ""
            : "none"),
      );
  document
    .querySelectorAll("[data-id]")
    .forEach((b) => (b.onclick = () => openSession(b.dataset.id)));
  document.querySelectorAll("[data-reveal-id]").forEach((button) => button.onclick = async () => {
    button.disabled = true;
    try { await sessionService.reveal(button.dataset.revealId); toast("Session revealed by owner authorization."); await renderReports(); }
    catch (error) { button.disabled = false; toast(error.message); }
  });
}
async function mPromiseOutput(id) {
  try {
    // Keep report rendering bounded even for large sessions.  The main
    // process returns the total separately so the UI can state when a page is
    // being shown without loading an unbounded result set into the renderer.
    return await sessionService.output(id, { paginated: true, offset: 0, limit: 5_000 });
  } catch {
    return [];
  }
}
async function openSession(id) {
  try {
    await renderSession(id);
  } catch (error) {
    renderError(app, "Session report unavailable", error, () => openSession(id));
  }
}
async function renderSession(id) {
  const [m, e, v, raw, out, analysis, occurrenceData, annotations] = await Promise.all([
    sessionService.get(id),
    sessionService.events(id),
    sessionService.verify(id),
    sessionService.report(id),
    mPromiseOutput(id),
    sessionService.analysis(id),
    sessionService.occurrences(id),
    sessionService.annotations(id),
  ]);
  app.innerHTML = `<div class="section-intro"><div><h2>${esc(id)} · Audit workspace</h2><p>${esc(m.profileId)} · ${new Date(m.createdUtc).toLocaleString()}</p></div><div class="actions">${pill(m.status)}${m.revealEligible ? '<button class="button primary" id="ownerReveal">Reveal result</button>' : ""}</div></div><div class="card"><div class="tabs">${renderReportTabs()}</div><div id="tabContent"></div></div><button class="button" id="back">← Back to sessions</button>`;
  const content = $("#tabContent");
  $("#ownerReveal")?.addEventListener("click", async () => {
    try { await sessionService.reveal(id); toast("Session revealed by owner authorization."); await renderSession(id); }
    catch (error) { toast(error.message); }
  });
  const show = (t) => {
    try {
      document
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
    if (t === "overview")
      content.innerHTML = `<div class="grid two"><div class="review-row"><span>Status</span><strong>${esc(m.status)}</strong></div><div class="review-row"><span>Reveal policy</span><strong>${esc(m.revealPolicy)}</strong></div><div class="review-row"><span>Participant</span><strong>${esc(m.participantLabel)}</strong></div><div class="review-row"><span>Config fingerprint</span><strong class="mono">${esc(m.configFingerprint)}</strong></div>${m.research ? `<div class="review-row"><span>Experiment mode</span><strong>${esc(m.research.mode)}</strong></div><div class="review-row"><span>Outcome space / K</span><strong>${esc(m.research.outcomeSpace?.type || "UNKNOWN")} · ${esc(m.research.cardinality)}</strong></div><div class="review-row"><span>Primary endpoint</span><strong>${esc(m.research.primaryEndpoint)}</strong></div><div class="review-row"><span>Participant phase</span><strong>${esc(m.research.phases?.participantPhaseStatus || "UNKNOWN")}</strong></div><div class="review-row"><span>Evidence phase</span><strong>${esc(m.research.phases?.evidencePhaseStatus || "UNKNOWN")}</strong></div><div class="review-row"><span>Reveal projection</span><strong>${esc(m.research.phases?.revealStatus || "UNKNOWN")}</strong></div>` : ""}</div>`;
    if (t === "timeline")
      content.innerHTML = `<div class="timeline">${e.events.map((x) => `<div class="timeline-item"><div class="timeline-time">${x.occurredUtc ? new Date(x.occurredUtc).toLocaleTimeString() : "time hidden until reveal"}</div><div class="timeline-node"></div><div class="timeline-event">${esc(x.type)}<small>Event ${x.seq} · ${x.hash ? `${esc(x.hash.slice(0, 16))}…` : "hash redacted before reveal"}</small></div></div>`).join("")}</div>`;
    if (t === "machine" || t === "analysis") {
      if (!m.revealed && m.status !== "REVEALED" && m.status !== "COMPLETE") {
        content.innerHTML = '<div class="callout warning">Machine output and derived analysis remain gated until raw-report lock and the separate reveal action.</div>';
      } else if (t === "machine") {
        const rows = Array.isArray(out) ? out : out?.records || [];
        const total = Array.isArray(out) ? rows.length : Number(out?.total ?? rows.length);
        const counts = rows.reduce((map, row) => { const key = row.value ?? "UNKNOWN"; map[key] = (map[key] || 0) + 1; return map; }, {});
        content.innerHTML = `<div class="callout success">Actual persisted machine-output sequence · ${rows.length}${total !== rows.length ? ` of ${total}` : ""} records.</div><div class="grid two"><div class="card"><h3>Distribution</h3>${renderDistribution(counts)}</div><div class="card"><h3>Timing summary</h3>${fieldRow("First scheduled", rows[0]?.scheduledUtc || "Not recorded")}${fieldRow("Last actual", rows.at(-1)?.actualUtc || "Not recorded")}${fieldRow("Late / missed", rows.filter((row) => /LATE|MISSED/i.test(row.timingStatus || "")).length)}${fieldRow("Regions", [...new Set(rows.map((row) => row.region).filter(Boolean))].join(", ") || "Not recorded")}</div></div><div class="table-wrap" style="margin-top:18px"><table class="data-table"><thead><tr><th>Seq</th><th>Region</th><th>Value</th><th>Scheduled UTC</th><th>Actual UTC</th><th>Lateness</th><th>Status</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${esc(row.outputSeq)}</td><td>${esc(row.region || "UNKNOWN")}</td><td>${esc(row.value)}</td><td>${esc(row.scheduledUtc || "—")}</td><td>${esc(row.actualUtc || "—")}</td><td>${esc(row.latenessMs ?? "—")}</td><td>${pill(row.timingStatus || "ON_TIME")}</td></tr>`).join("") || '<tr><td colspan="7" class="empty">No output records.</td></tr>'}</tbody></table></div>`;
      } else {
        const data = analysis?.analysis || analysis || {};
        const genericTemporal = Number(data.cardinality || 2) !== 2 || data.endpoint && data.endpoint !== "EXACT_SLOT" || Array.isArray(data.occurrences);
        if (genericTemporal) {
          const occurrences = Array.isArray(occurrenceData?.records) ? occurrenceData.records : (Array.isArray(data.occurrences) ? data.occurrences : []);
          content.innerHTML = `<div class="callout success">Generic finite-outcome analysis · ${esc(data.endpoint || "EXACT_SLOT")} · primary and exploratory observations remain separate.</div><div class="grid three"><div class="card">${fieldRow("Target", data.target ?? "Not recorded")}${fieldRow("Outcome cardinality (K)", data.cardinality ?? "Not recorded")}${fieldRow("Primary status", data.primary?.status ?? "Not resolved")}${fieldRow("Primary result", data.primary?.hit === true ? "MATCH" : data.primary?.resolved ? "NO MATCH" : "MISSED / UNAVAILABLE")}</div><div class="card">${fieldRow("Planned opportunities", data.plannedCount ?? "Not recorded")}${fieldRow("Eligible opportunities", data.eligibleCount ?? "Not recorded")}${fieldRow("Missed opportunities", data.missedCount ?? "Not recorded")}${fieldRow("Observed target hits", data.hits ?? 0)}</div><div class="card">${fieldRow("Single-target p0", data.nullModel?.p0 ?? "Not recorded")}${fieldRow("Expected hits", data.expectedHits?.value ?? data.expectedHits ?? "Not recorded")}${fieldRow("Any-hit null probability", data.anyHitProbability?.value ?? data.anyHitProbability ?? "Not recorded")}${fieldRow("Calculation version", data.methodVersion || data.analysisVersion || "Not recorded")}</div></div><div class="card" style="margin-top:18px"><h3>Committed target-relative summary</h3>${fieldRow("First pre-target occurrence", data.firstPreTargetLatencyMs ?? "None")}${fieldRow("First post-target occurrence", data.firstPostTargetLatencyMs ?? "None")}${fieldRow("Nearest occurrence to T", data.nearestOccurrenceLatencyMs ?? "None")}${fieldRow("Primary scheduled target", data.primary?.targetScheduledUtc || "Not recorded")}</div><div class="card" style="margin-top:18px"><h3>Target occurrences relative to T</h3>${occurrences.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Sequence</th><th>Region</th><th>Scheduled UTC</th><th>Actual UTC</th><th>Signed latency (ms)</th><th>Classification</th></tr></thead><tbody>${occurrences.map((item) => `<tr><td>${esc(item.sequence ?? item.outputSeq ?? "—")}</td><td>${esc(item.region || "—")}</td><td>${esc(item.scheduledUtc || "—")}</td><td>${esc(item.actualUtc || "—")}</td><td>${esc(item.signedLatencyMs ?? item.latencyMs ?? "—")}</td><td>${pill(item.timingClassification || item.status || "OBSERVED")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="subtle">No exact target occurrences were observed.</p>'}</div><details style="margin-top:18px"><summary>Analysis evidence JSON</summary><pre class="json">${esc(JSON.stringify(data, null, 2))}</pre></details>`;
          return;
        }
        const bands = ["pre", "primary", "post"].map((name) => data[name] || {});
        const peak = Number(data.peakDeviation ?? data.peak ?? 0);
        content.innerHTML = `<div class="callout success">Analysis uses the committed named region boundaries and request/timing anchors.</div><div class="grid three">${bands.map((band, index) => `<div class="card"><h3>${["Pre-request", "Primary", "Post-request"][index]}</h3>${fieldRow("Expected records", band.expectedCount ?? "Not recorded")}${fieldRow("Observed records", band.observedCount ?? "Not recorded")}${fieldRow("Matches", band.matches ?? "Not recorded")}${fieldRow("Match proportion", band.proportion === null || band.proportion === undefined ? "Not recorded" : `${(Number(band.proportion) * 100).toFixed(1)}%`)}</div>`).join("")}</div><div class="card" style="margin-top:18px"><h3>Requested-direction deviation</h3>${renderAnalysisBands(data)}${fieldRow("Peak deviation", Number.isFinite(peak) ? peak : "Not recorded")}${fieldRow("Threshold crossing", data.thresholdCrossing ?? data.thresholdCrossed ?? "Not recorded")}${fieldRow("Sustained crossing", data.sustainedCrossing ?? "Not recorded")}${fieldRow("Latency", data.latencyMs ?? "Not recorded")}${fieldRow("Persistence", data.persistence ?? "Not recorded")}${fieldRow("Return toward baseline", data.returnTowardBaseline ?? "Not recorded")}</div><details style="margin-top:18px"><summary>Analysis evidence JSON</summary><pre class="json">${esc(JSON.stringify(data, null, 2))}</pre></details>`;
      }
    }
    if (t === "occurrences") {
      if (!m.revealed && m.status !== "REVEALED" && m.status !== "COMPLETE") {
        content.innerHTML = '<div class="callout warning">Target occurrences remain gated until the owner completes reveal.</div>';
      } else {
        const data = analysis?.analysis || analysis || {};
        const occurrences = Array.isArray(occurrenceData?.records) ? occurrenceData.records : (Array.isArray(data.occurrences) ? data.occurrences : []);
        content.innerHTML = `<div class="callout">Every exact target occurrence is retained. A late or early occurrence does not rewrite the primary endpoint.</div>${occurrences.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Sequence</th><th>Region</th><th>Scheduled</th><th>Actual</th><th>Signed latency</th><th>Classification</th></tr></thead><tbody>${occurrences.map((item) => `<tr><td>${esc(item.sequence ?? item.outputSeq ?? "—")}</td><td>${esc(item.region || "—")}</td><td>${esc(item.scheduledUtc || "—")}</td><td>${esc(item.actualUtc || "—")}</td><td>${esc(item.signedLatencyMs ?? item.latencyMs ?? "—")}</td><td>${pill(item.timingClassification || item.status || "OBSERVED")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="subtle">No exact target occurrences were observed.</p>'}`;
      }
    }
    if (t === "raw") {
      content.innerHTML = raw.locked
        ? `<div class="lock-box">✓ Locked raw report</div><div class="grid two">${fieldRow("Locked UTC", raw.lockedUtc)}${fieldRow("SHA-256", raw.lockHash, { mono: true })}${fieldRow("Schema version", raw.schemaVersion)}${fieldRow("Late annotations", (annotations || []).length)}</div><details style="margin-top:18px"><summary>Immutable raw payload</summary><pre class="json">${esc(JSON.stringify(raw.payload || {}, null, 2))}</pre></details><div class="card" style="margin-top:18px"><h3>Late annotation</h3><p class="subtle">Annotations never edit the locked payload; each is append-only and hashed.</p><div class="form-grid"><div class="field"><label for="annotationKind">Kind</label><input id="annotationKind" value="NOTE"></div><div class="field full"><label for="annotationText">Note</label><textarea id="annotationText"></textarea></div></div><button class="button" id="addAnnotation">Append annotation</button></div>`
        : `<div class="lock-box">Raw report pending lock</div>`;
      $("#addAnnotation")?.addEventListener("click", async () => {
        try {
          await sessionService.addAnnotation(id, $("#annotationKind").value || "NOTE", { text: $("#annotationText").value });
          toast("Late annotation appended and hashed.");
          show("raw");
        } catch (error) { toast(error.message); }
      });
    }
    if (t === "audio")
      content.innerHTML = `<pre class="json">${esc(JSON.stringify(m.audioArtifact || m.configSnapshot?.audio || {}, null, 2))}</pre>`;
    if (t === "export")
      content.innerHTML = m.revealed || m.status === "REVEALED" || m.status === "COMPLETE"
        ? `<div class="callout success">The complete export includes immutable SQLite evidence, raw report, analysis, audio finalization metadata, and hashes.</div><button class="button primary" id="exportSession">Export complete session bundle</button><div id="exportStatus" class="callout" style="margin-top:14px"></div>`
        : `<div class="callout warning">Files and export remain gated until the owner reveals this session.</div>`;
    $("#exportSession")?.addEventListener("click", async () => {
      try { const exported = await sessionService.export(id); $("#exportStatus").textContent = exported?.path ? `Exported to ${exported.path}` : "Export completed."; }
      catch (error) { $("#exportStatus").textContent = error.message; }
    });
    if (t === "integrity")
      content.innerHTML = `<div class="lock-box">${v.valid ? "✓ Integrity verified" : "✕ Integrity failed"}</div><pre class="json">${esc(JSON.stringify(v, null, 2))}</pre>`;
    } catch (error) {
      renderError(content, "Report tab unavailable", error, () => show(t));
    }
  };
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  $("#back").onclick = () => setPage("reports");
  show("overview");
}
init().catch(
  (e) =>
    (app.innerHTML = `<div class="card"><h2>Application unavailable</h2><p>${esc(e.message)}</p><p>Start with <code>npm start</code> and reload.</p></div>`),
);
