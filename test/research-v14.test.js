import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MipDatabase } from "../src/main/database/db.js";
import {
  normalizeOutcomeSpace,
  validateOutcomeSpace,
  outcomeSpaceSize,
  containsOutcome,
  sampleOutcome,
  formatOutcome,
  normalizeTemporalWindow,
  anyHitProbability,
  expectedHits,
  singleTargetProbability,
  binomialTail,
  binomialProbability,
  resolveEffectiveConfiguration,
  createCompatibilityFingerprint,
  evaluateRevealGate,
} from "../src/domain/research-model.js";
import { analyzeTemporalEvidence, aggregateCrossSession } from "../src/main/analysis/temporal-analysis.js";
import { TemporalEvidenceScheduler } from "../src/main/sessions/temporal-evidence-scheduler.js";
import { classifyStartupRecovery } from "../src/main/sessions/recovery-policy.js";

test("OutcomeSpace remains symbolic and exact for billion-cardinality ranges", () => {
  const space = normalizeOutcomeSpace({ type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 999_999_999 });
  assert.deepEqual(space, { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 999_999_999 });
  assert.equal(outcomeSpaceSize(space), 1_000_000_000);
  assert.equal(containsOutcome(space, 999_999_999), true);
  assert.equal(containsOutcome(space, 1_000_000_000), false);
  assert.equal(formatOutcome(space, 999_999_999), "999999999");
  assert.equal(sampleOutcome(space, { int: (n) => n - 1 }), 999_999_999);
  assert.equal(validateOutcomeSpace({ type: "INTEGER_RANGE", minInclusive: 3, maxInclusive: 2 }).valid, false);
  assert.equal(validateOutcomeSpace({ type: "ENUMERATED_VALUES", values: ["A", "B", "C"] }).cardinality, 3);
  const relativeWindow = normalizeTemporalWindow({ sequenceStart: -10, sequenceEnd: -1 });
  assert.deepEqual([relativeWindow.sequenceOffsetStart, relativeWindow.sequenceOffsetEnd], [-10, -1]);
});

test("probability calculations are stable and generic", () => {
  assert.equal(singleTargetProbability(1_000_000_000).value, 1 / 1_000_000_000);
  const any = anyHitProbability(1_000_000_000, 1_000_000).value;
  assert.ok(any > 0 && any < 0.001);
  assert.ok(Math.abs(any - (1 - Math.exp(-0.001))) < 1e-9);
  assert.equal(expectedHits(4, 20).value, 5);
  assert.ok(binomialTail(2, 10, 6).value > 0.37);
  assert.ok(Math.abs(binomialProbability(1_000_000_000, 1_000_000, 0).value - Math.exp(-0.001)) < 1e-6);
  assert.throws(() => anyHitProbability(4, 1_000_001), /must not exceed/);
});

test("effective configuration precedence and compatibility fingerprints are deterministic", () => {
  const effective = resolveEffectiveConfiguration({
    app: { mode: "CONTROL", outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 } },
    profile: { id: "P", version: 1, mode: "INFLUENCE", outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 99 } },
    session: { mode: "FUTURE_TARGET", outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 999 } },
  });
  assert.equal(effective.mode, "FUTURE_TARGET");
  assert.equal(effective.cardinality, 1000);
  assert.equal(effective.configHash, resolveEffectiveConfiguration({
    app: { mode: "CONTROL", outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 } },
    profile: { id: "P", version: 1, mode: "INFLUENCE", outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 99 } },
    session: { mode: "FUTURE_TARGET", outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 999 } },
  }).configHash);
  assert.equal(effective.compatibilityFingerprint, createCompatibilityFingerprint(effective));
});

test("temporal analysis separates exact primary slot from exploratory occurrences", () => {
  const outputs = [
    { sessionId: "S1", sequence: 0, value: 7, scheduledUtc: "2026-01-01T00:00:00.000Z", actualUtc: "2025-12-31T23:59:58.000Z", status: "ON_TIME" },
    { sessionId: "S1", sequence: 1, value: 7, scheduledUtc: "2026-01-01T00:00:00.000Z", actualUtc: "2026-01-01T00:00:00.000Z", status: "ON_TIME" },
    { sessionId: "S1", sequence: 2, value: 7, scheduledUtc: "2026-01-01T00:00:00.000Z", actualUtc: "2026-01-01T00:00:02.000Z", status: "ON_TIME" },
  ];
  const result = analyzeTemporalEvidence({ outputs, target: 7, outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 }, primaryEndpoint: "EXACT_SLOT", targetSequence: 1, primaryWindow: { preMs: 2000, postMs: 2000 }, plannedCount: 3, eligibleCount: 3, missedCount: 0 });
  assert.equal(result.cardinality, 10);
  assert.equal(result.primary.hit, true);
  assert.equal(result.occurrences.length, 3);
  assert.equal(result.occurrences[0].timingClassification, "PRE_WINDOW");
  assert.equal(result.occurrences[2].timingClassification, "POST_WINDOW");
  assert.equal(result.primary.eligibleCount, 1);
  assert.equal(result.windowResults[0].observedHits, 3);
});

test("target frequency exposes observed and expected finite-space rates", () => {
  const result = analyzeTemporalEvidence({
    outputs: [
      { sequence: 0, value: 2, scheduledUtc: "2026-01-01T00:00:00.000Z", actualUtc: "2026-01-01T00:00:00.000Z", status: "ON_TIME" },
      { sequence: 1, value: 1, scheduledUtc: "2026-01-01T00:00:01.000Z", actualUtc: "2026-01-01T00:00:01.000Z", status: "ON_TIME" },
      { sequence: 2, value: 2, scheduledUtc: "2026-01-01T00:00:02.000Z", actualUtc: "2026-01-01T00:00:02.000Z", status: "ON_TIME" },
    ],
    target: 2,
    outcomeSpace: { type: "ENUMERATED_VALUES", values: [1, 2, 3, 4] },
    primaryEndpoint: "TARGET_FREQUENCY",
    targetScheduledUtc: "2026-01-01T00:00:01.000Z",
    plannedCount: 3,
    eligibleCount: 3,
    missedCount: 0,
  });
  assert.equal(result.primary.hit, true);
  assert.equal(result.primary.observedHits, 2);
  assert.equal(result.primary.expectedHits, 0.75);
  assert.equal(result.primary.observedFrequency, 2 / 3);
  assert.equal(result.primary.expectedFrequency, 0.25);
});

test("temporal latency is signed from the committed target anchor and missed slots stay unavailable", () => {
  const targetUtc = "2026-01-02T00:00:00.000Z";
  const result = analyzeTemporalEvidence({
    outputs: [
      { sequence: 0, value: 9, scheduledUtc: targetUtc, actualUtc: "2026-01-01T23:58:00.000Z", status: "ON_TIME" },
      { sequence: 1, value: null, scheduledUtc: targetUtc, actualUtc: null, status: "MISSED" },
      { sequence: 2, value: 9, scheduledUtc: targetUtc, actualUtc: "2026-01-02T00:02:00.000Z", status: "LATE" },
    ],
    target: 9,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    primaryEndpoint: "EXACT_SLOT",
    targetSequence: 1,
    targetScheduledUtc: targetUtc,
    primaryWindow: { preMs: 120_000, postMs: 120_000 },
    plannedCount: 3,
    eligibleCount: 2,
    missedCount: 1,
  });
  assert.equal(result.primary.hit, false);
  assert.equal(result.primary.classification, "MISSED_OR_UNAVAILABLE");
  assert.deepEqual(result.occurrences.map((occurrence) => occurrence.signedLatencyMs), [-120_000, 120_000]);
  assert.deepEqual(result.occurrences.map((occurrence) => occurrence.timingClassification), ["PRE_WINDOW", "POST_WINDOW"]);
  assert.equal(result.missedCount, 1);
});

test("fixed sequence windows can be committed relative to the target slot", () => {
  const result = analyzeTemporalEvidence({
    outputs: [
      { sequence: 0, value: 7, scheduledUtc: "2026-01-02T00:00:00.000Z", actualUtc: "2026-01-02T00:00:00.000Z" },
      { sequence: 1, value: 7, scheduledUtc: "2026-01-02T00:00:01.000Z", actualUtc: "2026-01-02T00:00:01.000Z" },
      { sequence: 2, value: 7, scheduledUtc: "2026-01-02T00:00:02.000Z", actualUtc: "2026-01-02T00:00:02.000Z" },
    ],
    target: 7,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    primaryEndpoint: "FIXED_SEQUENCE_WINDOW",
    targetSequence: 2,
    primaryWindow: { sequenceStart: -2, sequenceEnd: -1 },
    plannedCount: 3,
    eligibleCount: 3,
    missedCount: 0,
  });
  assert.equal(result.primary.hit, true);
});

test("exact sequence windows resolve their committed slot without a target sequence", () => {
  const result = analyzeTemporalEvidence({
    outputs: [
      { sequence: 0, value: 7, scheduledUtc: "2026-01-02T00:00:00.000Z", actualUtc: "2026-01-02T00:00:00.000Z", status: "ON_TIME" },
      { sequence: 1, value: 7, scheduledUtc: "2026-01-02T00:00:01.000Z", actualUtc: "2026-01-02T00:00:01.000Z", status: "ON_TIME" },
    ],
    target: 7,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    primaryEndpoint: "FIXED_SEQUENCE_WINDOW",
    targetSequence: null,
    primaryWindow: { exactSequence: 1 },
    plannedCount: 2,
    eligibleCount: 2,
    missedCount: 0,
  });
  assert.equal(result.primary.resolved, true);
  assert.equal(result.primary.hit, true);
  assert.equal(result.primary.targetSequence, null);
  assert.equal(result.primary.probability, 0.1);
});

test("temporal scheduler ends participant phase without stopping evidence and classifies aborts", async () => {
  let now = 0;
  const clock = { now: () => now };
  const scheduler = new TemporalEvidenceScheduler({ mode: "INFLUENCE", target: 5, outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 }, output: { preCount: 1, primaryCount: 2, postCount: 1 }, analysis: { intervalMs: 10 }, targetDelayMs: 20 }, { clock, timer: { setTimeout: () => 0, clearTimeout: () => {} }, machineRandomSource: { int: () => 5 }, outputProvider: () => 5 });
  await scheduler.start();
  assert.equal(scheduler.endParticipantPhase(), "ENDED");
  now = 50;
  await scheduler.tick();
  assert.equal(scheduler.status, "COMPLETE");
  assert.equal(scheduler.evidencePhase, "COMPLETE");

  const aborted = new TemporalEvidenceScheduler({ mode: "INFLUENCE", target: 1, outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 }, output: { preCount: 1, primaryCount: 1 }, analysis: { intervalMs: 100 }, targetDelayMs: 100 }, { clock, timer: { setTimeout: () => 0, clearTimeout: () => {} }, machineRandomSource: { int: () => 1 }, outputProvider: () => 1 });
  await aborted.start();
  const result = aborted.abortEvidence("owner");
  assert.equal(result.abortClassification, "ABORTED_BEFORE_TARGET");
  assert.equal(result.evidencePhase, "ABORTED");
});

test("startup recovery classifies persisted temporal evidence without silent resume", () => {
  const returned = classifyStartupRecovery({
    status: "RAW_REPORT_LOCKED",
    temporal: true,
    evidencePhaseStatus: "POST_TARGET_MONITORING",
  });
  assert.equal(returned.action, "MARK_INCOMPLETE_REVIEW");
  assert.equal(returned.resume, false);
  assert.equal(returned.evidencePhaseStatus, "INCOMPLETE");
  assert.equal(returned.revealStatus, "BLOCKED");

  const running = classifyStartupRecovery({ status: "RUNNING", temporal: true, evidencePhaseStatus: "RUNNING" });
  assert.equal(running.action, "REQUIRE_RECOVERY");
  assert.equal(running.resume, false);

  const futureSchedule = classifyStartupRecovery({
    status: "COMMITTED",
    temporal: true,
    evidencePhaseStatus: "TARGET_PENDING",
    futureScheduleStillPending: true,
  });
  assert.equal(futureSchedule.action, "PRESERVE_SCHEDULE_METADATA");
  assert.equal(futureSchedule.resume, false);
});

test("temporal scheduler derives opportunity counts from committed duration windows when no counts are supplied", () => {
  const scheduler = new TemporalEvidenceScheduler({
    mode: "INFLUENCE",
    target: 1,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 1 },
    analysis: { intervalMs: 100, windows: [{ id: "primary", preMs: 200, postMs: 300 }] },
  }, { clock: { now: () => 0 }, timer: { setTimeout: () => 0, clearTimeout: () => {} }, outputProvider: () => 1 });
  assert.deepEqual({ pre: scheduler.plan.preCount, primary: scheduler.plan.primaryCount, post: scheduler.plan.postCount, total: scheduler.plan.totalCount }, { pre: 2, primary: 1, post: 3, total: 6 });
});

test("temporal scheduler uses its configured cadence when the normalized plan omits intervalMs", () => {
  const scheduler = new TemporalEvidenceScheduler({
    mode: "INFLUENCE",
    target: 1,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 1 },
    intervalMs: 5,
    output: { preCount: 0, primaryCount: 1, postCount: 0 },
  }, { clock: { now: () => 0 }, timer: { setTimeout: () => 0, clearTimeout: () => {} }, outputProvider: () => 1 });
  assert.equal(scheduler.plan.intervalMs, 5);
});

test("exact-slot target sequence follows a committed duration window", () => {
  const scheduler = new TemporalEvidenceScheduler({
    mode: "INFLUENCE",
    target: 1,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 1 },
    targetDefinition: { mode: "INFLUENCE", anchor: "ABSOLUTE_UTC", scheduledUtc: "2026-01-02T00:00:00.000Z" },
    temporalAnalysis: { primaryEndpoint: "EXACT_SLOT", intervalMs: 100, windows: [{ id: "primary", preMs: 200, postMs: 300 }] },
  }, { clock: { now: () => Date.parse("2026-01-02T00:00:00.000Z") }, timer: { setTimeout: () => 0, clearTimeout: () => {} }, outputProvider: () => 1 });
  assert.equal(scheduler.plan.targetIndex, 2);
  assert.equal(scheduler.plan.preCount, 2);
  assert.equal(scheduler.plan.outputs[2].region, "primary");
  assert.equal(scheduler.plan.outputs[2].targetSlot, true);
});

test("accelerated lifecycle keeps evidence active after participant return and never backfills", async () => {
  const baseUtc = Date.parse("2026-01-03T00:00:00.000Z");
  let now = baseUtc;
  const clock = { now: () => now };
  const emitted = [];
  const scheduler = new TemporalEvidenceScheduler({
    mode: "INFLUENCE",
    target: 7,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    targetDefinition: { mode: "INFLUENCE", anchor: "ABSOLUTE_UTC", scheduledUtc: new Date(baseUtc + 40).toISOString(), targetSequence: 1 },
    output: { preCount: 1, primaryCount: 1, postCount: 1 },
    analysis: { intervalMs: 10 },
  }, {
    clock,
    timer: { setTimeout: () => 0, clearTimeout: () => {} },
    outputProvider: () => 7,
    onEvidence: (event) => emitted.push(event),
  });
  await scheduler.start();
  now = baseUtc + 20;
  assert.equal(scheduler.endParticipantPhase("returned"), "ENDED");
  await scheduler.tick();
  assert.equal(scheduler.status, "RUNNING");
  assert.equal(scheduler.evidencePhase, "RUNNING");
  assert.equal(scheduler.toRendererDTO().target, undefined);
  now = baseUtc + 40;
  await scheduler.tick();
  assert.equal(scheduler.records.find((record) => record.sequence === 1).status, "ON_TIME");
  now = baseUtc + 50;
  await scheduler.tick();
  assert.equal(scheduler.status, "COMPLETE");
  assert.equal(scheduler.evidencePhase, "COMPLETE");
  assert.equal(scheduler.records.length, 3);
  assert.equal(emitted.some((event) => event.type === "OUTPUT_MISSED"), false);

  const interrupted = new TemporalEvidenceScheduler({
    mode: "INFLUENCE",
    target: 7,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    targetDefinition: { mode: "INFLUENCE", anchor: "ABSOLUTE_UTC", scheduledUtc: new Date(baseUtc + 100).toISOString(), targetSequence: 1 },
    output: { preCount: 1, primaryCount: 1 },
    analysis: { intervalMs: 100 },
  }, { clock, timer: { setTimeout: () => 0, clearTimeout: () => {} }, outputProvider: () => 7 });
  await interrupted.start();
  now = baseUtc + 20;
  const aborted = interrupted.abortEvidence("owner_abort");
  assert.equal(aborted.abortClassification, "ABORTED_BEFORE_TARGET");
  assert.equal(interrupted.records.length, 0);
  now = baseUtc + 200;
  await interrupted.tick();
  assert.equal(interrupted.records.length, 0);
});

test("temporal completion result is JSON-safe when slots use monotonic BigInt timestamps", async () => {
  let now = 0;
  let completion = null;
  const scheduler = new TemporalEvidenceScheduler({
    mode: "INFLUENCE",
    target: 1,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 1 },
    output: { preCount: 0, primaryCount: 1, postCount: 0 },
    analysis: { intervalMs: 1 },
  }, {
    clock: { now: () => now },
    timer: { setTimeout: () => 0, clearTimeout: () => {} },
    outputProvider: () => 1,
    onComplete: (result) => { completion = JSON.parse(JSON.stringify(result)); },
  });
  await scheduler.start();
  await scheduler.tick();
  assert.equal(scheduler.status, "COMPLETE");
  assert.equal(completion.status, "COMPLETE");
  assert.equal(typeof completion.records[0].scheduledMonotonicNs, "string");
});

test("future target is absent before its anchor, generated once at the anchor, and can be explicitly missed", async () => {
  const baseUtc = Date.parse("2026-01-04T00:00:00.000Z");
  let now = baseUtc;
  const clock = { now: () => now };
  const targetEvents = [];
  const scheduler = new TemporalEvidenceScheduler({
    mode: "FUTURE_TARGET",
    prediction: 3,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    targetDefinition: { mode: "FUTURE_TARGET", anchor: "ABSOLUTE_UTC", scheduledUtc: new Date(baseUtc + 40).toISOString(), targetSequence: 1, prediction: 3 },
    output: { preCount: 1, primaryCount: 1, postCount: 1 },
    analysis: { intervalMs: 10 },
  }, {
    clock,
    timer: { setTimeout: () => 0, clearTimeout: () => {} },
    randomSource: { int: () => 3, metadata: () => ({ domain: "FUTURE_TARGET", provider: "DETERMINISTIC_PRNG_TEST", id: "fixture", version: "v1", deterministic: true }) },
    outputProvider: () => 3,
    onTargetGenerated: (event) => targetEvents.push(event),
  });
  await scheduler.start();
  now = baseUtc + 20;
  await scheduler.tick();
  assert.equal(scheduler.target, null);
  assert.equal(scheduler.targetGeneration, null);
  now = baseUtc + 40;
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(scheduler.target, 3);
  assert.equal(targetEvents.length, 1);
  assert.equal(targetEvents[0].prediction, 3);
  assert.equal(targetEvents[0].rng.domain, "FUTURE_TARGET");

  const missed = new TemporalEvidenceScheduler({
    mode: "FUTURE_TARGET",
    prediction: 3,
    outcomeSpace: { type: "INTEGER_RANGE", minInclusive: 0, maxInclusive: 9 },
    targetDefinition: { mode: "FUTURE_TARGET", anchor: "ABSOLUTE_UTC", scheduledUtc: new Date(baseUtc + 100).toISOString(), targetSequence: 1, prediction: 3 },
    output: { preCount: 1, primaryCount: 1 },
    analysis: { intervalMs: 100 },
  }, { clock, timer: { setTimeout: () => 0, clearTimeout: () => {} }, randomSource: { int: () => 3 }, outputProvider: () => 3 });
  await missed.start();
  assert.equal(missed.markFutureTargetMissed(), true);
  assert.equal(missed.evidencePhase, "MISSED");
  assert.equal(missed.status, "ABORTED");
  assert.equal(missed.target, null);
});

test("cross-session aggregate rejects incompatible fingerprints and preserves labels", () => {
  const analysis = { cardinality: 4, plannedCount: 4, eligibleCount: 4, missedCount: 0, hits: 1, primary: { hit: true }, occurrences: [] };
  const result = aggregateCrossSession([{ sessionId: "S1", compatibilityFingerprint: "same", analysis }, { sessionId: "S2", compatibilityFingerprint: "same", analysis }], { compatibilityFingerprint: "same", workflow: "AGGREGATE" });
  assert.equal(result.sessionCount, 2);
  assert.equal(result.primaryHits, 2);
  assert.equal(result.completedSessionCount, 0);
  assert.throws(() => aggregateCrossSession([{ compatibilityFingerprint: "a", analysis }, { compatibilityFingerprint: "b", analysis }]), /incompatible/);
});

test("cross-session aggregation aligns signed latency across calendar dates and excludes unrevealed sessions", () => {
  const latencies = [122_000, 161_000, -34_000, 112_000, 492_000];
  const sessions = latencies.map((latency, index) => ({
    sessionId: `S${index + 1}`,
    revealed: true,
    compatibilityFingerprint: "cohort",
    completed: true,
    analysis: { cardinality: 1_000_000_000, plannedCount: 10, eligibleCount: 10, missedCount: 0, hits: 1, primary: { hit: false }, occurrences: [{ signedLatencyMs: latency }] },
  }));
  sessions.push({ sessionId: "HIDDEN", revealed: false, compatibilityFingerprint: "cohort", analysis: { cardinality: 1_000_000_000, plannedCount: 10, eligibleCount: 10, hits: 1, primary: { hit: true }, occurrences: [{ signedLatencyMs: 0 }] } });
  const result = aggregateCrossSession(sessions, { compatibilityFingerprint: "cohort", workflow: "AGGREGATE", exploratory: true });
  assert.equal(result.sessionCount, 5);
  assert.equal(result.excludedSessionCount, 1);
  assert.equal(result.preTargetHitCount, 1);
  assert.equal(result.postTargetHitCount, 4);
  assert.equal(result.firstHitLatency.medianMs, 122_000);
  assert.equal(result.latencyHistogram[122], 1);
  assert.match(result.labels.occurrences, /EXPLORATORY/);
  assert.equal(result.targetAlignedRaster.length, 5);
});

test("reveal gate requires every independent condition", () => {
  const blocked = evaluateRevealGate({ mode: "FUTURE_TARGET", rawReportLocked: true, evidenceComplete: true, primaryResolved: true, postTargetComplete: true, integrityAcceptable: true, futureTargetGenerated: false, predictionCommitted: true });
  assert.equal(blocked.eligible, false);
  assert.deepEqual(blocked.missing, ["futureTargetGenerated"]);
  assert.equal(evaluateRevealGate({ mode: "FUTURE_TARGET", rawReportLocked: true, evidenceComplete: true, primaryResolved: true, postTargetComplete: true, integrityAcceptable: true, futureTargetGenerated: true, predictionCommitted: true }).eligible, true);
});

test("schema 14 research definitions and future target evidence persist immutably", () => {
  const root = fs.mkdtempSync(pathForTest());
  const db = new MipDatabase(root);
  const profile = db.profiles.getVersion("TEMPORAL_INTEGER_RANGE_V1", 1);
  const session = db.beginSession(profile, "fixture", "dry", { deferCommit: false, researchDefinition: { mode: "FUTURE_TARGET", outcomeSpace: profile.outcomeSpace, targetDefinition: { mode: "FUTURE_TARGET", anchor: "ABSOLUTE_UTC", scheduledUtc: "2026-01-01T00:00:00.000Z" }, temporalAnalysis: { primaryEndpoint: "FIXED_TIME_WINDOW", windows: [{ id: "primary", preMs: 100, postMs: 100 }] }, revealPolicy: "AFTER_EVIDENCE_COMPLETE" } });
  assert.equal(db.schemaVersion, 14);
  assert.equal(db.research.getDefinition(session.id).cardinality, 1_000_000_000);
  db.research.recordTargetGeneration(session.id, { prediction: 12, target: 34, scheduledUtc: "2026-01-01T00:00:00.000Z", actualUtc: "2026-01-01T00:00:01.000Z", status: "GENERATED", rng: { domain: "FUTURE_TARGET", provider: "DETERMINISTIC_PRNG_TEST", version: "v1" } });
  assert.equal(db.research.getTargetGeneration(session.id, { full: true }).match, false);
  const preRevealTarget = db.research.getTargetGeneration(session.id);
  assert.deepEqual(preRevealTarget, { sessionId: session.id, scheduledUtc: "2026-01-01T00:00:00.000Z", status: "GENERATED" });
  assert.equal(db.research.getTargetGeneration(session.id, { full: true }).rng.domain, "FUTURE_TARGET");
  assert.equal(db.evidence.list(session.id, { full: true }).filter((event) => event.type === "PREDICTION_LOCKED").length, 1);
  assert.equal(db.integrity.verifySession(session.id, { persist: false }).valid, true);
  db.research.recordOccurrence(session.id, { outputSeq: 1, value: 34, region: "primary" });
  assert.throws(() => db.db.prepare("UPDATE target_occurrences SET region='x' WHERE session_id=?").run(session.id), /immutable/);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test("schema 13 databases migrate forward without rewriting historical rows", () => {
  const root = fs.mkdtempSync(pathForTest());
  const file = path.join(root, "MIP", "data", "mip.sqlite3");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const legacy = new Database(file);
  legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_utc TEXT NOT NULL);");
  for (let version = 1; version <= 13; version += 1)
    legacy.prepare("INSERT INTO schema_migrations(version, applied_utc) VALUES(?, ?)").run(version, "2026-01-01T00:00:00.000Z");
  legacy.close();
  const db = new MipDatabase(root);
  assert.equal(db.schemaVersion, 14);
  for (const table of ["research_definitions", "session_phase_projections", "target_occurrences", "future_target_events", "cross_session_analyses", "research_defaults"])
    assert.ok(db.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table), table);
  assert.deepEqual(db.db.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((row) => row.version), Array.from({ length: 14 }, (_unused, index) => index + 1));
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

function pathForTest() { return path.join(os.tmpdir(), `mip-research-${Date.now()}-${process.hrtime.bigint()}-`); }
