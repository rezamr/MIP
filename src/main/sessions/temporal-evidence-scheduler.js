import {
  EXPERIMENT_MODES,
  EVIDENCE_PHASES,
  PARTICIPANT_PHASES,
  PRIMARY_ENDPOINTS,
  TARGET_ANCHORS,
  normalizeExperimentMode,
  normalizeOutcomeSpace,
  outcomeSpaceSize,
  sampleOutcome,
  normalizeTemporalAnalysisPlan,
  normalizeTargetDefinition,
  formatOutcome,
  MAX_SCHEDULED_OUTPUTS,
} from "../../domain/research-model.js";

const defaultTimer = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) };

function readClock(clock, keys, fallback) {
  for (const key of keys) {
    const candidate = clock?.[key];
    const value = typeof candidate === "function" ? candidate.call(clock) : candidate;
    if (value !== undefined && value !== null) return value;
  }
  return fallback();
}

function clockUtcMs(clock) {
  const value = readClock(clock, ["utcMs", "nowUtcMs", "now"], () => Date.now());
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value);
  return Number(value);
}

function clockMonoNs(clock) {
  const value = readClock(clock, ["monotonicNs", "nowMonotonicNs", "monotonic"], () =>
    typeof clock?.now === "function"
      ? (() => {
        // Convert a millisecond wall-clock reading without multiplying a
        // large epoch-valued Number by 1e6 first.  That multiplication loses
        // sub-millisecond precision (and can make an exact T+50ms slot look
        // a few nanoseconds early), which is particularly visible with fake
        // clocks and can leave the final output stuck in RUNNING.
        const milliseconds = Number(clock.now());
        if (!Number.isFinite(milliseconds)) return process.hrtime.bigint();
        const wholeMilliseconds = Math.trunc(milliseconds);
        const fractionalNanoseconds = Math.round((milliseconds - wholeMilliseconds) * 1e6);
        return BigInt(wholeMilliseconds) * 1_000_000n + BigInt(fractionalNanoseconds);
      })()
      : process.hrtime.bigint());
  return typeof value === "bigint" ? value : BigInt(Math.max(0, Math.round(Number(value) * (Number(value) < 1e12 ? 1e6 : 1))));
}

function iso(ms) { return new Date(Math.round(ms)).toISOString(); }
function asMs(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function safeInt(value, fallback = 0) { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : fallback; }

function promiseResult(value) { return value && typeof value.then === "function" ? value : Promise.resolve(value); }

/**
 * Evidence scheduler with an independent participant lifecycle.  It is used
 * by temporal/future-target profiles; the historical SessionScheduler remains
 * available for v1.2 binary profiles.
 */
export class TemporalEvidenceScheduler {
  constructor(config = {}, dependencies = {}) {
    this.config = config;
    this.mode = normalizeExperimentMode(config.mode || config.experimentMode || EXPERIMENT_MODES.INFLUENCE);
    this.outcomeSpace = normalizeOutcomeSpace(config.outcomeSpace || { type: "BINARY" });
    this.cardinality = outcomeSpaceSize(this.outcomeSpace);
    this.analysisPlan = normalizeTemporalAnalysisPlan(config.temporalAnalysis || config.analysis || {}, { plannedBeforeCommit: true });
    this.targetDefinition = normalizeTargetDefinition(config.targetDefinition || config.target || {}, { mode: this.mode });
    this.clock = dependencies.clock || config.clock || {};
    this.timer = dependencies.timer || defaultTimer;
    this.randomSource = dependencies.randomSource || dependencies.targetRandomSource || null;
    this.machineRandomSource = dependencies.machineRandomSource || dependencies.outputRandomSource || this.randomSource;
    this.outputProvider = dependencies.outputProvider || (({ randomSource }) => sampleOutcome(this.outcomeSpace, randomSource));
    this.onOutput = dependencies.onOutput;
    this.onEvidence = dependencies.onEvidence;
    this.onTargetGenerated = dependencies.onTargetGenerated;
    this.onFailure = dependencies.onFailure;
    this.onComplete = dependencies.onComplete;
    this.onParticipantPhase = dependencies.onParticipantPhase;
    this.sessionId = dependencies.sessionId || config.sessionId || null;
    this.trialId = dependencies.trialId || config.trialId || null;
    this.toleranceMs = asMs(dependencies.toleranceMs ?? config.toleranceMs, 100);
    this.status = "PLANNED";
    this.participantPhase = PARTICIPANT_PHASES.PRECOMMIT;
    this.evidencePhase = EVIDENCE_PHASES.NOT_STARTED;
    this.outputs = [];
    this.records = [];
    this.target = this.mode === EXPERIMENT_MODES.FUTURE_TARGET ? null : (config.target ?? dependencies.target ?? null);
    this.targetGenerated = this.target !== null;
    this.targetGeneration = null;
    this.targetPrediction = config.prediction ?? dependencies.prediction ?? null;
    this.targetMissed = false;
    this.timerHandle = null;
    this.started = null;
    this.completed = null;
    this.abortClassification = null;
    this.nextSequence = 0;
    this.plan = this._buildPlan();
  }

  _buildPlan() {
    const output = this.config.output || {};
    const blockSize = Math.max(1, safeInt(output.blockSize, 1));
    const intervalMs = asMs(this.analysisPlan.intervalMs ?? output.intervalMs ?? this.config.intervalMs, 1);
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error("Temporal evidence output cadence must be positive");
    const explicitCounts = ["preCount", "primaryCount", "postCount", "preBlocks", "primaryBlocks", "postBlocks"]
      .some((key) => output[key] !== undefined && output[key] !== null);
    let preCount = safeInt(output.preCount, safeInt(output.preBlocks, 0) * blockSize);
    let primaryCount = safeInt(output.primaryCount, safeInt(output.primaryBlocks, 1) * blockSize);
    let postCount = safeInt(output.postCount, safeInt(output.postBlocks, 0) * blockSize);
    // A temporal definition may specify only committed wall-clock windows and
    // cadence.  Derive the opportunity set symbolically in that case instead
    // of silently falling back to one arbitrary output.  Explicit profile
    // counts remain authoritative for backwards-compatible profiles.
    if (!explicitCounts) {
      const primaryWindow = this.analysisPlan.windows.find((window) => window.id === this.analysisPlan.primaryWindowId) || this.analysisPlan.windows[0] || {};
      const durationToCount = (duration) => Math.max(0, Math.ceil(asMs(duration, 0) / intervalMs));
      preCount = durationToCount(primaryWindow.preMs);
      postCount = durationToCount(primaryWindow.postMs);
      primaryCount = 1;
    }
    const totalCount = preCount + primaryCount + postCount;
    if (!Number.isSafeInteger(totalCount)) throw new Error("Temporal evidence schedule output count exceeds safe integer bounds");
    if (totalCount < 1) throw new Error("Temporal evidence schedule requires at least one output");
    if (totalCount > MAX_SCHEDULED_OUTPUTS) throw new Error(`Temporal evidence schedule cannot exceed ${MAX_SCHEDULED_OUTPUTS} outputs`);
    const nowUtc = clockUtcMs(this.clock);
    const nowMono = clockMonoNs(this.clock);
    const targetUtc = this.targetDefinition.scheduledUtc ? Date.parse(this.targetDefinition.scheduledUtc) : nowUtc + asMs(this.config.targetDelayMs, 0);
    const targetMono = this.targetDefinition.scheduledMonotonicNs !== null
      ? BigInt(this.targetDefinition.scheduledMonotonicNs)
      : nowMono + BigInt(Math.round((targetUtc - nowUtc) * 1e6));
    const targetIndex = this.targetDefinition.targetSequence === null ? preCount : this.targetDefinition.targetSequence;
    if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 || targetIndex >= totalCount)
      throw new Error("targetSequence must identify one scheduled output in the evidence plan");
    const firstMono = targetMono - BigInt(Math.round(targetIndex * intervalMs * 1e6));
    const outputs = Array.from({ length: totalCount }, (_unused, sequence) => {
      const scheduledMono = firstMono + BigInt(Math.round(sequence * intervalMs * 1e6));
      const scheduledUtcMs = targetUtc + (sequence - targetIndex) * intervalMs;
      return Object.freeze({
        sequence,
        region: sequence < preCount ? "pre" : sequence < preCount + primaryCount ? "primary" : "post",
        scheduledMonotonicNs: scheduledMono,
        scheduledUtcMs,
        scheduledUtc: iso(scheduledUtcMs),
        targetSlot: sequence === targetIndex,
      });
    });
    return Object.freeze({
      totalCount,
      preCount,
      primaryCount,
      postCount,
      intervalMs,
      targetIndex,
      targetUtcMs: targetUtc,
      targetUtc: iso(targetUtc),
      targetMonotonicNs: targetMono,
      outputs: Object.freeze(outputs),
    });
  }

  _emit(type, payload = {}) {
    const event = { type, sessionId: this.sessionId, trialId: this.trialId, occurredUtc: iso(clockUtcMs(this.clock)), monotonicNs: clockMonoNs(this.clock).toString(), payload };
    if (typeof this.onEvidence === "function") this.onEvidence(event);
    return event;
  }

  toRendererDTO({ revealed = false } = {}) {
    return {
      mode: this.mode,
      cardinality: this.cardinality,
      outcomeSpace: this.outcomeSpace.type === "INTEGER_RANGE" ? this.outcomeSpace : { type: this.outcomeSpace.type, values: this.outcomeSpace.values },
      status: this.status,
      participantPhase: this.participantPhase,
      evidencePhase: this.evidencePhase,
      totalCount: this.plan.totalCount,
      targetAnchor: this.targetDefinition.anchor,
      targetSequence: this.plan.targetIndex,
      targetScheduledUtc: this.plan.targetUtc,
      target: revealed ? this.target : undefined,
      targetGenerated: this.targetGenerated,
      targetGeneration: revealed ? this.targetGeneration : undefined,
      targetPrediction: revealed ? this.targetPrediction : undefined,
      generatedCount: this.outputs.length,
      missedCount: this.records.filter((record) => record.status === "MISSED").length,
      abortClassification: this.abortClassification,
    };
  }

  async commit() {
    if (this.status !== "PLANNED") throw new Error(`Cannot commit temporal scheduler in state ${this.status}`);
    this.status = "COMMITTED";
    this.participantPhase = PARTICIPANT_PHASES.READY;
    this.evidencePhase = EVIDENCE_PHASES.SCHEDULED;
    this._emit("EVIDENCE_SCHEDULE_COMMITTED", {
      totalCount: this.plan.totalCount,
      targetScheduledUtc: this.plan.targetUtc,
      targetScheduledMonotonicNs: this.plan.targetMonotonicNs.toString(),
      targetSequence: this.plan.targetIndex,
      cardinality: this.cardinality,
    });
    return this.toRendererDTO();
  }

  async start() {
    if (this.status === "PLANNED") await this.commit();
    if (this.status !== "COMMITTED") throw new Error(`Cannot start temporal scheduler in state ${this.status}`);
    this.status = "RUNNING";
    this.evidencePhase = this.mode === EXPERIMENT_MODES.FUTURE_TARGET ? EVIDENCE_PHASES.TARGET_PENDING : EVIDENCE_PHASES.RUNNING;
    this.participantPhase = PARTICIPANT_PHASES.ACTIVE;
    this.started = { utc: iso(clockUtcMs(this.clock)), monotonicNs: clockMonoNs(this.clock).toString() };
    this._emit("EVIDENCE_STARTED", { mode: this.mode });
    this._scheduleNext();
    return this.toRendererDTO();
  }

  endParticipantPhase(reason = "participant_return") {
    if ([PARTICIPANT_PHASES.ENDED, PARTICIPANT_PHASES.RETURNED].includes(this.participantPhase)) return this.participantPhase;
    this.participantPhase = PARTICIPANT_PHASES.ENDED;
    this._emit("PARTICIPANT_PHASE_ENDED", { reason, evidenceContinues: this.status === "RUNNING" });
    if (typeof this.onParticipantPhase === "function") this.onParticipantPhase({ participantPhase: this.participantPhase, reason, evidenceContinues: this.status === "RUNNING" });
    return this.participantPhase;
  }

  returnParticipant(reason = "participant_return") { return this.endParticipantPhase(reason); }

  abortEvidence(reason = "owner_abort", options = {}) {
    if ([EVIDENCE_PHASES.COMPLETE, EVIDENCE_PHASES.ABORTED].includes(this.evidencePhase)) return this.getResult();
    const atAnchor = this.mode === EXPERIMENT_MODES.FUTURE_TARGET
      ? (this.targetGenerated || clockMonoNs(this.clock) >= this.plan.targetMonotonicNs)
      : clockMonoNs(this.clock) >= this.plan.targetMonotonicNs;
    this.abortClassification = atAnchor ? "ABORTED_AFTER_TARGET" : "ABORTED_BEFORE_TARGET";
    this.evidencePhase = EVIDENCE_PHASES.ABORTED;
    this.status = "ABORTED";
    this._clearTimer();
    this._emit("EVIDENCE_ABORTED", { reason, classification: this.abortClassification, noBackfill: true, targetGenerated: this.targetGenerated, ...options });
    return this.getResult();
  }

  // Compatibility edge for the main-process failure/shutdown path.  The
  // operation is still an evidence abort (never a silent stop), so the
  // classification and no-backfill event are preserved.
  interrupt(reason = "runtime_interrupted") {
    return this.abortEvidence(reason, { interrupted: true });
  }

  markFutureTargetMissed(reason = "application_unavailable_at_target_anchor") {
    if (this.mode !== EXPERIMENT_MODES.FUTURE_TARGET || this.targetGenerated) return false;
    this.targetMissed = true;
    this.evidencePhase = EVIDENCE_PHASES.MISSED;
    this.status = "ABORTED";
    this._clearTimer();
    this._emit("FUTURE_TARGET_MISSED", { reason, scheduledUtc: this.plan.targetUtc, noBackfill: true });
    return true;
  }

  _clearTimer() { if (this.timerHandle !== null) { this.timer.clearTimeout(this.timerHandle); this.timerHandle = null; } }
  _scheduleNext() {
    if (this.status !== "RUNNING") return;
    const slot = this.plan.outputs[this.nextSequence];
    if (!slot) { this._finish(); return; }
    const delay = Math.max(0, Number(slot.scheduledMonotonicNs - clockMonoNs(this.clock)) / 1e6);
    this._clearTimer();
    this.timerHandle = this.timer.setTimeout(() => {
      this.timerHandle = null;
      void this._processDue().catch(async (error) => {
        const failure = { error: error.message, classification: "OUTPUT_FAILURE", noBackfill: true };
        try {
          if (typeof this.onFailure === "function") await promiseResult(this.onFailure(failure));
          else this.abortEvidence("OUTPUT_FAILURE", failure);
        } catch (failureHandlerError) {
          // A failure callback is persistence plumbing, not a second source
          // of unhandled timer rejections.  If it fails, close the evidence
          // scheduler locally and retain the original no-backfill reason.
          this.abortEvidence("OUTPUT_FAILURE", {
            ...failure,
            failureHandlerError: failureHandlerError.message,
          });
        }
      });
    }, Math.min(Math.max(0, Math.ceil(delay)), 2_147_483_647));
  }

  async _generateTargetIfDue(observed) {
    if (this.mode !== EXPERIMENT_MODES.FUTURE_TARGET || this.targetGenerated || this.targetMissed) return;
    if (observed.monotonicNs < this.plan.targetMonotonicNs) return;
    if (!this.randomSource) throw new Error("FUTURE_TARGET requires an OS_CSPRNG target random source");
    this.target = sampleOutcome(this.outcomeSpace, this.randomSource);
    this.targetGenerated = true;
    this.evidencePhase = EVIDENCE_PHASES.TARGET_GENERATED;
    this.targetGeneration = { prediction: this.targetPrediction, scheduledUtc: this.plan.targetUtc, scheduledMonotonicNs: this.plan.targetMonotonicNs.toString(), actualUtc: iso(observed.utcMs), actualMonotonicNs: observed.monotonicNs.toString(), status: observed.monotonicNs === this.plan.targetMonotonicNs ? "ON_TIME" : "LATE", target: this.target, rng: typeof this.randomSource.metadata === "function" ? this.randomSource.metadata() : null };
    this._emit("FUTURE_TARGET_GENERATED", { ...this.targetGeneration, target: this.target });
    if (typeof this.onTargetGenerated === "function") await promiseResult(this.onTargetGenerated({ ...this.targetGeneration, target: this.target }));
  }

  async _processDue() {
    if (this.status !== "RUNNING") return;
    const observed = { monotonicNs: clockMonoNs(this.clock), utcMs: clockUtcMs(this.clock) };
    await this._generateTargetIfDue(observed);
    while (this.status === "RUNNING") {
      const slot = this.plan.outputs[this.nextSequence];
      if (!slot || observed.monotonicNs < slot.scheduledMonotonicNs) break;
      this.nextSequence += 1;
      const latenessMs = Number(observed.monotonicNs - slot.scheduledMonotonicNs) / 1e6;
      if (latenessMs > this.toleranceMs) {
        // Persist a concrete null value for a missed opportunity.  Keeping a
        // row in the authoritative machine-output table is important: a
        // missed slot must remain visible as MISSED and must never be
        // silently removed or regenerated later.
        const missed = { ...slot, sessionId: this.sessionId, trialId: this.trialId, actualUtc: iso(observed.utcMs), actualMonotonicNs: observed.monotonicNs.toString(), latenessMs, status: "MISSED", value: null };
        this.records.push(missed);
        if (typeof this.onOutput === "function") await promiseResult(this.onOutput({ ...missed }));
        this._emit("OUTPUT_MISSED", { sequence: slot.sequence, scheduledUtc: slot.scheduledUtc, actualUtc: missed.actualUtc, latenessMs, noBackfill: true });
        continue;
      }
      if (this.mode === EXPERIMENT_MODES.FUTURE_TARGET && slot.targetSlot)
        this.evidencePhase = EVIDENCE_PHASES.TARGET_OBSERVED;
      const value = await promiseResult(this.outputProvider({ sessionId: this.sessionId, trialId: this.trialId, sequence: slot.sequence, region: slot.region, scheduledUtc: slot.scheduledUtc, scheduledMonotonicNs: slot.scheduledMonotonicNs.toString(), target: this.target, randomSource: this.machineRandomSource }));
      const record = { ...slot, sessionId: this.sessionId, trialId: this.trialId, value, actualUtc: iso(observed.utcMs), actualMonotonicNs: observed.monotonicNs.toString(), latenessMs, status: latenessMs === 0 ? "ON_TIME" : "LATE" };
      this.outputs.push(record);
      this.records.push(record);
      if (typeof this.onOutput === "function") await promiseResult(this.onOutput({ ...record }));
      this._emit("OUTPUT_RECORDED", { sequence: slot.sequence, region: slot.region, status: record.status });
    }
    if (!this.plan.outputs[this.nextSequence]) this._finish();
    else {
      if (this.mode === EXPERIMENT_MODES.FUTURE_TARGET && this.targetGenerated && this.nextSequence > this.plan.targetIndex)
        this.evidencePhase = EVIDENCE_PHASES.POST_TARGET_MONITORING;
      this._scheduleNext();
    }
  }

  /** Deterministic test/dev hook; production uses the timer callback. */
  async tick() { return this._processDue(); }

  _finish() {
    this._clearTimer();
    if (this.status !== "RUNNING") return;
    this.status = "COMPLETE";
    this.evidencePhase = EVIDENCE_PHASES.COMPLETE;
    this.completed = { utc: iso(clockUtcMs(this.clock)), monotonicNs: clockMonoNs(this.clock).toString() };
    this._emit("EVIDENCE_COMPLETE", { generatedCount: this.outputs.length, missedCount: this.records.filter((record) => record.status === "MISSED").length });
    if (typeof this.onComplete === "function") this.onComplete(this.getResult());
  }

  getResult({ revealed = false } = {}) {
    // Scheduler slots deliberately use BigInt monotonic timestamps so that
    // nanosecond arithmetic remains exact.  IPC/evidence payloads are JSON,
    // however, and the main-process completion callback serializes the result
    // before persisting it.  Normalize every record boundary here rather than
    // relying on each caller to remember a BigInt replacer (which previously
    // made a completed temporal session fail inside `clone(result)`).
    const serializeRecord = (record, includeValue) => {
      const serialized = {
        ...record,
        scheduledMonotonicNs: record.scheduledMonotonicNs === null || record.scheduledMonotonicNs === undefined
          ? null
          : String(record.scheduledMonotonicNs),
        actualMonotonicNs: record.actualMonotonicNs === null || record.actualMonotonicNs === undefined
          ? null
          : String(record.actualMonotonicNs),
      };
      if (!includeValue) delete serialized.value;
      return serialized;
    };
    return {
      ...this.toRendererDTO({ revealed }),
      plan: { ...this.plan, targetMonotonicNs: this.plan.targetMonotonicNs.toString(), outputs: this.plan.outputs.map((slot) => ({ ...slot, scheduledMonotonicNs: slot.scheduledMonotonicNs.toString() })) },
      outputs: revealed ? this.outputs.map((record) => serializeRecord(record, true)) : [],
      records: revealed
        ? this.records.map((record) => serializeRecord(record, true))
        : this.records.map((record) => ({ ...serializeRecord(record, false), hidden: true })),
      target: revealed ? this.target : undefined,
      targetLabel: revealed && this.target !== null ? formatOutcome(this.outcomeSpace, this.target) : undefined,
    };
  }
}

export function createTemporalEvidenceScheduler(config, dependencies = {}) { return new TemporalEvidenceScheduler(config, dependencies); }
export default TemporalEvidenceScheduler;
