import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MipDatabase } from "../src/main/database/db.js";
import { TemporalEvidenceScheduler } from "../src/main/sessions/temporal-evidence-scheduler.js";

const BASE_UTC = Date.parse("2026-02-01T00:00:00.000Z");

function makeClock() {
  let now = BASE_UTC;
  return {
    clock: { now: () => now },
    set(ms) { now = BASE_UTC + ms; },
  };
}

function makeScheduler(time, options = {}) {
  const events = [];
  const targets = [];
  const missed = [];
  const scheduler = new TemporalEvidenceScheduler({
    mode: "FUTURE_TARGET",
    prediction: 3,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    targetDefinition: {
      mode: "FUTURE_TARGET",
      anchor: "ABSOLUTE_UTC",
      scheduledUtc: new Date(BASE_UTC + 100).toISOString(),
      targetSequence: 1,
      prediction: 3,
    },
    output: { preCount: 1, primaryCount: 1, postCount: 1 },
    temporalAnalysis: { intervalMs: 10, toleranceMs: options.toleranceMs ?? 100 },
  }, {
    clock: time.clock,
    timer: { setTimeout: () => 0, clearTimeout: () => {} },
    randomSource: { int: () => 7, metadata: () => ({ domain: "FUTURE_TARGET", provider: "DETERMINISTIC_PRNG_TEST", version: "fixture" }) },
    machineRandomSource: { int: () => 1 },
    outputProvider: () => 1,
    onEvidence: (event) => events.push(event),
    onTargetGenerated: (event) => targets.push(event),
    onTargetMissed: (event) => missed.push(event),
  });
  return { scheduler, events, targets, missed };
}

function temporaryRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mip-future-target-restart-v12-"));
}

test("future target generation is exactly once at the anchor and records ON_TIME", async () => {
  const time = makeClock();
  const { scheduler, targets, missed } = makeScheduler(time);
  await scheduler.start();
  time.set(100);
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(targets.length, 1);
  assert.equal(missed.length, 0);
  assert.equal(targets[0].status, "ON_TIME");
  assert.equal(targets[0].latenessMs, 0);
  assert.equal(scheduler.targetGenerated, true);
  assert.equal(scheduler.targetMissed, false);
  assert.equal(scheduler.target, 7);
});

test("future target generation inside committed tolerance is LATE_WITHIN_TOLERANCE, never a missed opportunity", async () => {
  const time = makeClock();
  const { scheduler, targets, missed } = makeScheduler(time, { toleranceMs: 100 });
  await scheduler.start();
  time.set(150);
  await scheduler.tick();
  assert.equal(targets.length, 1);
  assert.equal(targets[0].status, "LATE_WITHIN_TOLERANCE");
  assert.equal(targets[0].latenessMs, 50);
  assert.equal(missed.length, 0);
  assert.equal(scheduler.records.find((record) => record.targetSlot)?.status, "LATE");
  assert.equal(scheduler.targetMissed, false);
});

test("one tick beyond committed tolerance records MISSED_FUTURE_TARGET_GENERATION and never backfills", async () => {
  const time = makeClock();
  const { scheduler, events, targets, missed } = makeScheduler(time, { toleranceMs: 100 });
  await scheduler.start();
  time.set(201);
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(targets.length, 0);
  assert.equal(missed.length, 1);
  assert.equal(missed[0].status, "MISSED_FUTURE_TARGET_GENERATION");
  assert.equal(missed[0].latenessMs, 101);
  assert.equal(scheduler.target, null);
  assert.equal(scheduler.targetGenerated, false);
  assert.equal(scheduler.targetMissed, true);
  assert.equal(scheduler.targetGeneration.status, "MISSED_FUTURE_TARGET_GENERATION");
  assert.equal(scheduler.status, "ABORTED");
  assert.equal(scheduler.evidencePhase, "MISSED");
  assert.equal(scheduler.records.find((record) => record.targetSlot)?.status, "MISSED");
  assert.equal(events.filter((event) => event.type === "MISSED_FUTURE_TARGET_GENERATION").length, 1);
  await scheduler.tick();
  assert.equal(missed.length, 1);
});

test("application unavailable at the committed anchor is a terminal miss and duplicate callbacks cannot replay", async () => {
  const time = makeClock();
  const { scheduler, events, missed } = makeScheduler(time);
  await scheduler.start();
  time.set(100);
  assert.equal(scheduler.markFutureTargetMissed("runtime unavailable at anchor"), true);
  assert.equal(scheduler.markFutureTargetMissed("duplicate"), false);
  assert.equal(scheduler.status, "ABORTED");
  assert.equal(scheduler.evidencePhase, "MISSED");
  assert.equal(scheduler.targetGeneration.status, "MISSED_FUTURE_TARGET_GENERATION");
  assert.equal(missed.length, 1);
  assert.equal(events.filter((event) => event.type === "MISSED_FUTURE_TARGET_GENERATION").length, 1);
  await scheduler.tick();
  assert.equal(missed.length, 1);
});

test("restart after a missed anchor preserves the persisted miss and never recreates a target", () => {
  const root = temporaryRoot();
  let db = new MipDatabase(root);
  try {
    const profile = db.profiles.get("BASELINE_NOW_BINARY_V1");
    const scheduledUtc = new Date(BASE_UTC + 100).toISOString();
    const session = db.beginSession(profile, "future-target restart fixture", "dry", {
      researchDefinition: {
        mode: "FUTURE_TARGET",
        outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
        targetDefinition: {
          mode: "FUTURE_TARGET",
          anchor: "ABSOLUTE_UTC",
          scheduledUtc,
          targetSequence: 0,
          prediction: 3,
        },
        temporalAnalysis: {
          intervalMs: 10,
          toleranceMs: 100,
          windows: [{ id: "primary", preMs: 0, postMs: 0 }],
        },
        primaryEndpoint: "EXACT_SLOT",
        revealPolicy: "AFTER_EVIDENCE_COMPLETE",
      },
    });
    db.research.recordTargetGeneration(session.id, {
      prediction: 3,
      target: null,
      scheduledUtc,
      actualUtc: new Date(BASE_UTC + 201).toISOString(),
      status: "MISSED_FUTURE_TARGET_GENERATION",
    });
    assert.equal(db.research.getTargetGeneration(session.id, { full: true }).status, "MISSED");
    assert.equal(db.research.getPhases(session.id).evidencePhaseStatus, "MISSED");
    db.close();
    db = new MipDatabase(root);
    const persisted = db.research.getTargetGeneration(session.id, { full: true });
    assert.equal(persisted.status, "MISSED");
    assert.equal(persisted.target, null);
    assert.equal(persisted.scheduledUtc, scheduledUtc);
    assert.equal(persisted.actualUtc, new Date(BASE_UTC + 201).toISOString());
    assert.equal(db.research.getPhases(session.id).evidencePhaseStatus, "MISSED");
    assert.equal(db.research.getTargetGeneration(session.id, { full: true }).target, null);
  } finally {
    try { db.close(); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("temporal analysis tolerance is the committed policy instead of an undocumented scheduler constant", () => {
  const time = makeClock();
  const { scheduler } = makeScheduler(time, { toleranceMs: 37 });
  assert.equal(scheduler.toleranceMs, 37);
  assert.equal(scheduler.toRendererDTO().targetGenerationToleranceMs, 37);
});
