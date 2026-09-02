import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TemporalEvidenceScheduler } from "../src/main/sessions/temporal-evidence-scheduler.js";
import { ProtocolStageController } from "../src/main/sessions/protocol-stage-controller.js";
import { MipDatabase } from "../src/main/database/db.js";
import { normalizeExecutionWindow, normalizeTargetDefinition, resolveEffectiveConfiguration, profiles } from "../src/engine.js";

const BASE = Date.parse("2026-01-01T00:00:00.000Z");

function fakeClock() {
  let elapsed = 0;
  return {
    clock: {
      now: () => BASE + elapsed,
      monotonicNs: () => BigInt(elapsed) * 1_000_000n,
    },
    set(value) { elapsed = value; },
    get elapsed() { return elapsed; },
  };
}

function stopScheduler(time, options = {}) {
  const events = [];
  const outputs = [];
  const scheduler = new TemporalEvidenceScheduler({
    mode: "INFLUENCE",
    timing: { mode: "PARTICIPANT_STOP_ANCHORED", targetOffsetMs: options.targetOffsetMs ?? 0, anchorReference: "PARTICIPANT_STOP_RETURN" },
    target: 5,
    targetDefinition: { mode: "INFLUENCE", anchor: "PARTICIPANT_STOP_RETURN", anchorReference: "PARTICIPANT_STOP_RETURN", targetOffsetMs: options.targetOffsetMs ?? 0, target: 5 },
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    temporalAnalysis: { primaryEndpoint: "FIXED_TIME_WINDOW", intervalMs: 100, toleranceMs: 20, windows: [{ id: "primary", preMs: options.preMs ?? 200, postMs: options.postMs ?? 200 }] },
    output: { intervalMs: 100 },
    executionWindow: options.executionWindow || null,
  }, {
    clock: time.clock,
    timer: { setTimeout: () => 0, clearTimeout: () => {} },
    machineRandomSource: { int: () => 1 },
    outputProvider: () => 5,
    onEvidence: (event) => events.push(event),
    onOutput: (record) => outputs.push(record),
    onParticipantStopAnchor: options.onParticipantStopAnchor,
  });
  return { scheduler, events, outputs };
}

test("participant-stop profile and target definition have no scheduled T before STOP", () => {
  assert.equal(profiles.STOP_ANCHORED_INTEGER_RANGE_V1.timing.mode, "PARTICIPANT_STOP_ANCHORED");
  assert.equal(profiles.TEMPORAL_INTEGER_RANGE_V1.timing.mode, "IMMEDIATE_REQUEST");
  const target = normalizeTargetDefinition({ mode: "INFLUENCE", anchor: "PARTICIPANT_STOP", target: 3 });
  assert.equal(target.scheduledUtc, null);
  assert.equal(target.scheduledMonotonicNs, null);
  assert.equal(target.semantics, "PARTICIPANT_STOP_ANCHOR");
  assert.throws(() => normalizeTargetDefinition({ anchor: "PARTICIPANT_STOP", scheduledUtc: new Date(BASE).toISOString() }), /predetermined scheduled timestamp/);
});

test("signed stop-relative offsets are committed before START and derive exact T after STOP", async () => {
  for (const offset of [-600_000, 0, 1_200_000]) {
    const time = fakeClock();
    const { scheduler } = stopScheduler(time, { targetOffsetMs: offset, preMs: 0, postMs: 0 });
    assert.equal(scheduler.plan.targetOffsetMs, offset);
    assert.equal(scheduler.plan.targetUtc, null);
    await scheduler.start();
    assert.equal(scheduler.toRendererDTO().targetScheduledUtc, null);
    const anchor = scheduler.commitStopAnchor({ utcMs: BASE + 2_000, monotonicNs: 2_000_000_000n });
    assert.equal(anchor.targetOffsetMs, offset);
    assert.equal(anchor.targetUtc, new Date(BASE + 2_000 + offset).toISOString());
    assert.equal(anchor.targetMonotonicNs, String(2_000_000_000n + BigInt(offset) * 1_000_000n));
  }
});

test("stop scheduler streams continuously, captures authoritative STOP once, and never backfills", async () => {
  const time = fakeClock();
  const { scheduler, events } = stopScheduler(time);
  await scheduler.start();
  assert.equal(scheduler.status, "RUNNING_UNANCHORED");
  assert.equal(scheduler.toRendererDTO().targetCapturedUtc, null);
  for (const instant of [0, 100, 200]) { time.set(instant); await scheduler.tick(); }
  const generatedBeforeStop = scheduler.records.length;
  time.set(250);
  const anchor = scheduler.commitStopAnchor();
  assert.equal(anchor.utc, new Date(BASE + 250).toISOString());
  assert.equal(anchor.monotonicNs, "250000000");
  assert.equal(events.filter((event) => event.type === "PARTICIPANT_STOP_ANCHOR_COMMITTED").length, 1);
  assert.equal(scheduler.commitStopAnchor().monotonicNs, "250000000");
  time.set(450);
  await scheduler.tick();
  assert.equal(scheduler.status, "COMPLETE");
  assert.equal(scheduler.evidencePhase, "COMPLETE");
  assert.equal(scheduler.records.length, generatedBeforeStop + 2);
  assert.equal(scheduler.records.some((record) => record.region === "primary" && record.scheduledUtc === new Date(BASE + 300).toISOString()), true);
  assert.equal(scheduler.records.some((record) => record.region === "post" && record.scheduledUtc === new Date(BASE + 400).toISOString()), true);
  assert.equal(scheduler.records.some((record) => record.scheduledUtc === new Date(BASE + 250).toISOString()), false);
});

test("signed negative offset derives T before STOP without backfilling and keeps windows centered on T", async () => {
  const time = fakeClock();
  const { scheduler } = stopScheduler(time, { targetOffsetMs: -600, preMs: 200, postMs: 300 });
  await scheduler.start();
  assert.equal(scheduler.toRendererDTO().targetScheduledUtc, null);
  assert.equal(scheduler.toRendererDTO().targetOffsetMs, -600);
  for (const instant of [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) { time.set(instant); await scheduler.tick(); }
  const anchor = scheduler.commitStopAnchor();
  assert.equal(anchor.targetOffsetMs, -600);
  assert.equal(anchor.targetUtc, new Date(BASE + 400).toISOString());
  assert.equal(anchor.targetMonotonicNs, "400000000");
  assert.equal(anchor.insufficientPreTargetEvidence, false);
  assert.equal(scheduler.records.some((record) => record.scheduledUtc === new Date(BASE + 400).toISOString()), true);
  assert.equal(scheduler.records.some((record) => record.scheduledUtc === new Date(BASE + 700).toISOString()), true);
  assert.equal(scheduler.records.some((record) => record.scheduledUtc === new Date(BASE + 250).toISOString()), false);
  assert.equal(scheduler.status, "COMPLETE");
});

test("zero offset is the explicit T=STOP special case, not the only supported relationship", async () => {
  const time = fakeClock();
  const { scheduler } = stopScheduler(time, { targetOffsetMs: 0, preMs: 200, postMs: 200 });
  await scheduler.start();
  time.set(250);
  const anchor = scheduler.commitStopAnchor();
  assert.equal(anchor.targetOffsetMs, 0);
  assert.equal(anchor.targetUtc, anchor.stopUtc);
  assert.equal(anchor.targetMonotonicNs, anchor.stopMonotonicNs);
});

test("positive offset continues hidden evidence after STOP through T plus post window", async () => {
  const time = fakeClock();
  const { scheduler } = stopScheduler(time, { targetOffsetMs: 1200, preMs: 200, postMs: 300 });
  await scheduler.start();
  time.set(500);
  await scheduler.tick();
  const anchor = scheduler.commitStopAnchor();
  assert.equal(anchor.targetUtc, new Date(BASE + 1700).toISOString());
  assert.equal(scheduler.status, "POST_TARGET_MONITORING");
  assert.equal(scheduler.toRendererDTO().remainingPostMs, 1500);
  time.set(1700);
  await scheduler.tick();
  assert.equal(scheduler.records.some((record) => record.region === "primary" && record.scheduledUtc === new Date(BASE + 1700).toISOString()), true);
  time.set(2000);
  await scheduler.tick();
  assert.equal(scheduler.status, "COMPLETE");
  assert.equal(scheduler.records.some((record) => record.region === "post" && record.scheduledUtc === new Date(BASE + 2000).toISOString()), true);
});

test("negative offset with a late START is explicitly incomplete rather than backfilled", async () => {
  const time = fakeClock();
  const { scheduler } = stopScheduler(time, { targetOffsetMs: -600, preMs: 500, postMs: 100 });
  await scheduler.start();
  time.set(1000);
  await scheduler.tick();
  const anchor = scheduler.commitStopAnchor();
  assert.equal(anchor.insufficientPreTargetEvidence, true);
  assert.equal(scheduler.toRendererDTO().insufficientPreTargetEvidence, true);
  assert.equal(scheduler.records.some((record) => record.scheduledUtc === new Date(BASE - 100).toISOString()), false);
});

test("short participant phase is explicitly insufficient and blocks primary resolution without shortening the window", async () => {
  const time = fakeClock();
  const { scheduler, events } = stopScheduler(time, { preMs: 500, postMs: 200 });
  await scheduler.start();
  time.set(100);
  await scheduler.tick();
  scheduler.commitStopAnchor();
  assert.equal(scheduler.insufficientPreTargetEvidence, true);
  assert.equal(events.filter((event) => event.type === "INSUFFICIENT_PRE_TARGET_EVIDENCE").length, 1);
  assert.equal(scheduler.toRendererDTO().preTargetMs, 500);
  time.set(300);
  await scheduler.tick();
  assert.equal(scheduler.status, "COMPLETE");
  assert.equal(scheduler.getResult({ revealed: true }).insufficientPreTargetEvidence, true);
});

test("post evidence continues after participant phase ends and reveal-facing DTO reports progress", async () => {
  const time = fakeClock();
  const { scheduler } = stopScheduler(time, { postMs: 300 });
  await scheduler.start();
  time.set(200);
  await scheduler.tick();
  scheduler.endParticipantPhase("owner_returned");
  assert.equal(scheduler.participantPhase, "ENDED");
  assert.equal(scheduler.status, "POST_TARGET_MONITORING");
  assert.equal(scheduler.evidencePhase, "POST_TARGET_MONITORING");
  assert.equal(scheduler.toRendererDTO().remainingPostMs, 300);
  time.set(500);
  await scheduler.tick();
  assert.equal(scheduler.evidencePhase, "COMPLETE");
});

test("execution window is normalized as UTC metadata and is never used as T", () => {
  const window = normalizeExecutionWindow({ startUtc: "2026-01-01T10:00:00Z", endUtc: "2026-01-01T11:00:00Z", timezone: "America/Moncton" });
  assert.deepEqual(window, { startUtc: "2026-01-01T10:00:00.000Z", endUtc: "2026-01-01T11:00:00.000Z", timezone: "America/Moncton" });
  const time = fakeClock();
  const { scheduler } = stopScheduler(time, { executionWindow: window });
  assert.equal(scheduler.plan.targetUtc, null);
  assert.deepEqual(scheduler.plan.executionWindow, window);
});

test("execution window is optional while local calendar scheduling still requires a timezone", () => {
  const effective = resolveEffectiveConfiguration({
    profile: profiles.STOP_ANCHORED_INTEGER_RANGE_V1,
    session: { targetDefinition: { anchor: "PARTICIPANT_STOP_RETURN", targetOffsetMs: 0 } },
  });
  assert.equal(effective.executionWindow, null);
  assert.throws(() => normalizeExecutionWindow({ startLocal: "2026-01-01T10:00", endLocal: "2026-01-01T11:00" }), /timezone is required/);
});

test("participant-paced protocol has no automatic return cue", () => {
  const controller = new ProtocolStageController({ inductionSeconds: 0, settleSeconds: 0, requestSeconds: 0, releaseSeconds: 0, neutralSeconds: 0, returnSeconds: 1, participantPaced: true }, { timer: { setTimeout: () => 0, clearTimeout: () => {} } });
  assert.equal(controller.stages.some((stage) => stage.stageType === "RETURN_CUE"), false);
});

test("participant stop anchor is atomically persisted, immutable, and survives restart", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mip-stop-anchor-v12-"));
  let db;
  try {
    db = new MipDatabase(root);
    const profile = db.profiles.getVersion("STOP_ANCHORED_INTEGER_RANGE_V1", 1);
    const session = db.beginSession(profile, "stop fixture", "dry", {
      deferCommit: false,
      researchDefinition: {
        mode: "INFLUENCE",
        timingMode: "PARTICIPANT_STOP_ANCHORED",
        executionWindow: { startUtc: "2026-01-01T00:00:00Z", endUtc: "2026-01-01T01:00:00Z", timezone: "UTC" },
        outcomeSpace: profile.outcomeSpace,
        targetDefinition: { mode: "INFLUENCE", anchor: "PARTICIPANT_STOP_RETURN", targetOffsetMs: -600000, target: 5 },
        temporalAnalysis: { primaryEndpoint: "FIXED_TIME_WINDOW", intervalMs: 100, windows: [{ id: "primary", preMs: 200, postMs: 200 }] },
        primaryEndpoint: "FIXED_TIME_WINDOW",
        revealPolicy: "AFTER_EVIDENCE_COMPLETE",
      },
    });
    const first = db.research.commitParticipantStopAnchor(session.id, { trialId: session.trial, utc: new Date(BASE + 250).toISOString(), monotonicNs: "250000000" });
    const replay = db.research.commitParticipantStopAnchor(session.id, { trialId: session.trial, utc: first.utc, monotonicNs: first.monotonicNs });
    assert.equal(replay.anchorHash, first.anchorHash);
    assert.equal(first.targetOffsetMs, -600000);
    assert.equal(first.targetUtc, new Date(BASE - 599750).toISOString());
    assert.equal(first.targetMonotonicNs, "-599750000000");
    assert.equal(db.db.prepare("SELECT COUNT(*) AS count FROM participant_stop_anchors WHERE session_id=?").get(session.id).count, 1);
    assert.equal(db.evidence.listFull(session.id).filter((event) => event.type === "PARTICIPANT_STOP_ANCHOR_COMMITTED").length, 1);
    assert.equal(db.research.getPhases(session.id).participantStopAnchor.utc, first.utc);
    db.close();
    db = new MipDatabase(root);
    assert.equal(db.research.getParticipantStopAnchor(session.id).utc, first.utc);
    assert.equal(db.research.getPhases(session.id).participantStopAnchor.monotonicNs, "250000000");
    assert.equal(db.integrity.verifySession(session.id, { persist: false }).valid, true);
  } finally {
    try { db?.close(); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});
