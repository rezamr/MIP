import crypto from "node:crypto";

export const SCHEDULER_MODES = Object.freeze({
  IMMEDIATE_REQUEST: "IMMEDIATE_REQUEST",
  NEXT_ELIGIBLE_OUTPUT: "NEXT_ELIGIBLE_OUTPUT",
  RELATIVE_DELAY: "RELATIVE_DELAY",
  ABSOLUTE_DATETIME: "ABSOLUTE_DATETIME",
  CONTINUOUS_AROUND_REQUEST: "CONTINUOUS_AROUND_REQUEST",
  PREGENERATED_HIDDEN: "PREGENERATED_HIDDEN",
  ABSOLUTE_WINDOW: "ABSOLUTE_WINDOW",
  RELATIVE_WINDOW: "RELATIVE_WINDOW",
});

export const SCHEDULER_ANCHORS = Object.freeze({
  PLAN_CREATED: "PLAN_CREATED",
  REQUEST: "REQUEST",
  PRE_START: "PRE_START",
  PRIMARY_START: "PRIMARY_START",
  PRIMARY_END: "PRIMARY_END",
  POST_START: "POST_START",
  STREAM_END: "STREAM_END",
});

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function normalizeMissedPolicy(value) {
  const policy = String(value).toUpperCase();
  if (policy === "ABORT_SESSION" || policy === "STOP") return "ABORT";
  if (policy === "CONTINUE_WITH_DEVIATION" || policy === "CONTINUE_AND_RECORD") return "CONTINUE";
  return policy;
}

function asNonNegativeInteger(value, name) {
  const result = Number(value ?? 0);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${name} must be a non-negative safe integer`);
  return result;
}

function asPositiveNumber(value, name) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) throw new Error(`${name} must be a positive number`);
  return result;
}

function asNonNegativeNumber(value, name) {
  const result = Number(value ?? 0);
  if (!Number.isFinite(result) || result < 0) throw new Error(`${name} must be a non-negative number`);
  return result;
}

function asNs(value, name = "monotonicNs") {
  try {
    const result = typeof value === "bigint" ? value : BigInt(value);
    if (result < 0n) throw new Error();
    return result;
  } catch {
    throw new Error(`${name} must be a non-negative bigint-compatible value`);
  }
}

function clockMonotonicNs(clock) {
  const read = (candidate) => typeof candidate === "function" ? candidate.call(clock) : candidate;
  const value = read(clock.monotonicNs) ?? read(clock.nowMonotonicNs) ?? read(clock.monotonic);
  if (value !== undefined) return asNs(value);
  if (typeof clock.now === "function") return BigInt(Math.round(Number(clock.now.call(clock)) * 1e6));
  if (typeof clock.performanceNow === "function") return BigInt(Math.round(Number(clock.performanceNow.call(clock)) * 1e6));
  return process.hrtime.bigint();
}

function clockUtcMs(clock) {
  const read = (candidate) => typeof candidate === "function" ? candidate.call(clock) : candidate;
  const value = read(clock.utcMs) ?? read(clock.nowUtcMs) ?? read(clock.wallClockMs) ?? read(clock.utcNowMs) ?? read(clock.nowUtc);
  if (value !== undefined) return normalizeUtcMs(value);
  if (typeof clock.now === "function") return normalizeUtcMs(clock.now.call(clock));
  return Date.now();
}

function normalizeUtcMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error(`Invalid UTC datetime ${value}`);
    return parsed;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("UTC clock must return a finite millisecond value");
  return number;
}

function isoUtc(ms) {
  return new Date(Math.round(ms)).toISOString();
}

function nsToMs(ns) {
  return Number(ns) / 1e6;
}

function addMs(ns, ms) {
  return ns + BigInt(Math.round(ms * 1e6));
}

function parseAbsolute(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error(`Invalid absolute UTC datetime ${value}`);
    return parsed;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Absolute datetime must be a Date, ISO string, or UTC milliseconds");
  return parsed;
}

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function fingerprint(outputs) {
  return crypto.createHash("sha256").update(canonical(outputs.map((output) => ({
    sequence: output.sequence,
    region: output.region,
    value: output.value,
  })))).digest("hex");
}

function pickConfig(config, key) {
  return firstDefined(config?.[key], config?.timing?.[key], config?.output?.[key]);
}

function resolveMode(config) {
  const mode = firstDefined(config?.mode, config?.timing?.mode);
  if (!mode) throw new Error("A scheduler timing mode is required");
  if (mode === SCHEDULER_MODES.ABSOLUTE_WINDOW) return SCHEDULER_MODES.ABSOLUTE_DATETIME;
  if (mode === SCHEDULER_MODES.RELATIVE_WINDOW) return SCHEDULER_MODES.RELATIVE_DELAY;
  if (!Object.values(SCHEDULER_MODES).includes(mode)) throw new Error(`Unsupported scheduler mode ${mode}`);
  return mode;
}

function resolveCounts(config) {
  const output = config.output || {};
  const blockSize = asPositiveNumber(firstDefined(output.blockSize, config.blockSize, 1), "blockSize");
  if (!Number.isSafeInteger(blockSize)) throw new Error("blockSize must be a positive safe integer");
  const preBlocks = asNonNegativeInteger(firstDefined(output.preBlocks, config.preBlocks, 0), "preBlocks");
  const primaryBlocks = asNonNegativeInteger(firstDefined(output.primaryBlocks, config.primaryBlocks, 0), "primaryBlocks");
  const postBlocks = asNonNegativeInteger(firstDefined(output.postBlocks, config.postBlocks, 0), "postBlocks");
  let preCount = preBlocks * blockSize;
  let primaryCount = primaryBlocks * blockSize;
  let postCount = postBlocks * blockSize;
  if (preCount + primaryCount + postCount === 0 && firstDefined(output.type, config.type) === "SINGLE_OUTCOME") {
    primaryCount = 1;
  }
  if (preCount + primaryCount + postCount < 1) throw new Error("Scheduler output count must be positive");
  return {
    blockSize,
    preBlocks,
    primaryBlocks,
    postBlocks,
    preCount,
    primaryCount,
    postCount,
    totalCount: preCount + primaryCount + postCount,
  };
}

function resolveIntervalMs(config, counts) {
  const explicit = firstDefined(config.output?.intervalMs, config.intervalMs);
  if (explicit !== undefined) {
    const intervalMs = asPositiveNumber(explicit, "output.intervalMs");
    return { intervalMs, streamDurationMs: intervalMs * counts.totalCount };
  }
  const duration = firstDefined(
    config.output?.streamDurationMs,
    config.streamDurationMs,
    config.output?.durationMs,
    config.durationMs,
    config.timing?.streamDurationMs,
  );
  let durationMs = duration === undefined ? undefined : asPositiveNumber(duration, "streamDurationMs");
  if (durationMs === undefined) {
    const protocolDurationSeconds = config.protocol
      ? Number(config.protocol.requestSeconds || 0) +
        Number(config.protocol.releaseSeconds || 0) +
        Number(config.protocol.neutralSeconds || 0)
      : undefined;
    const seconds = firstDefined(
      config.output?.streamDurationSeconds,
      config.streamDurationSeconds,
      config.timing?.streamDurationSeconds,
      protocolDurationSeconds,
    );
    if (seconds !== undefined && Number(seconds) > 0) durationMs = Number(seconds) * 1000;
  }
  if (durationMs === undefined) durationMs = counts.totalCount;
  return {
    intervalMs: durationMs / counts.totalCount,
    streamDurationMs: durationMs,
  };
}

function resolveEligibleAnchor(config, createdMono, createdUtc) {
  const timing = config.timing || config;
  const explicit = firstDefined(
    timing.nextEligibleMonotonicNs,
    config.nextEligibleMonotonicNs,
  );
  if (explicit !== undefined) {
    const mono = asNs(explicit, "nextEligibleMonotonicNs");
    return { monotonicNs: mono, utcMs: createdUtc + nsToMs(mono - createdMono) };
  }
  const utc = firstDefined(
    timing.nextEligibleUtc,
    timing.nextEligibleAt,
    timing.eligibleUtc,
    config.nextEligibleUtc,
  );
  if (utc !== undefined) {
    const utcMs = parseAbsolute(utc);
    return { monotonicNs: addMs(createdMono, utcMs - createdUtc), utcMs };
  }
  const delay = firstDefined(timing.nextEligibleDelayMs, config.nextEligibleDelayMs);
  if (delay !== undefined) {
    const delayMs = asNonNegativeInteger(delay, "nextEligibleDelayMs");
    return { monotonicNs: addMs(createdMono, delayMs), utcMs: createdUtc + delayMs };
  }
  if (typeof config.nextEligibleOutput === "function") {
    const value = config.nextEligibleOutput({ monotonicNs: createdMono, utcMs: createdUtc });
    if (value && typeof value === "object") {
      if (value.monotonicNs !== undefined) {
        const monotonicNs = asNs(value.monotonicNs, "nextEligibleOutput.monotonicNs");
        return {
          monotonicNs,
          utcMs: value.utcMs === undefined ? createdUtc + nsToMs(monotonicNs - createdMono) : normalizeUtcMs(value.utcMs),
        };
      }
      if (value.utcMs !== undefined) {
        const utcMs = normalizeUtcMs(value.utcMs);
        return { monotonicNs: addMs(createdMono, utcMs - createdUtc), utcMs };
      }
    }
    if (value !== undefined) {
      const utcMs = parseAbsolute(value);
      return { monotonicNs: addMs(createdMono, utcMs - createdUtc), utcMs };
    }
  }
  return { monotonicNs: createdMono, utcMs: createdUtc };
}

function anchorFromMode(config, mode, createdMono, createdUtc, counts) {
  const timing = config.timing || config;
  const explicitMono = firstDefined(timing.requestMonotonicNs, config.requestMonotonicNs);
  const explicitUtc = firstDefined(timing.requestUtc, timing.requestAt, config.requestUtc, config.requestAt);
  if (explicitMono !== undefined) {
    const monotonicNs = asNs(explicitMono, "requestMonotonicNs");
    return { monotonicNs, utcMs: explicitUtc === undefined ? createdUtc + nsToMs(monotonicNs - createdMono) : parseAbsolute(explicitUtc) };
  }
  if (explicitUtc !== undefined) {
    const utcMs = parseAbsolute(explicitUtc);
    return { monotonicNs: addMs(createdMono, utcMs - createdUtc), utcMs };
  }
  if (mode === SCHEDULER_MODES.RELATIVE_DELAY) {
    const window = timing.window || config.window || {};
    const delaySeconds = firstDefined(timing.delaySeconds, config.delaySeconds);
    const delayMs = firstDefined(
      timing.delayMs,
      timing.relativeDelayMs,
      config.delayMs,
      config.relativeDelayMs,
      window.delayMs,
      window.offsetMs,
      window.startDelayMs,
      delaySeconds === undefined ? undefined : Number(delaySeconds) * 1000,
    );
    if (delayMs === undefined) throw new Error("RELATIVE_DELAY requires delayMs or delaySeconds");
    const value = asNonNegativeInteger(delayMs, "delayMs");
    return { monotonicNs: addMs(createdMono, value), utcMs: createdUtc + value };
  }
  if (mode === SCHEDULER_MODES.ABSOLUTE_DATETIME) {
    const window = timing.window || config.window || {};
    const value = firstDefined(
      timing.datetime,
      timing.absoluteUtc,
      timing.absoluteDatetime,
      timing.at,
      timing.windowStartUtc,
      timing.startUtc,
      timing.windowStart,
      timing.startAt,
      window.startUtc,
      window.start,
      config.datetime,
      config.absoluteUtc,
      config.windowStartUtc,
      config.startUtc,
    );
    if (value === undefined) throw new Error("ABSOLUTE_DATETIME requires an absolute UTC datetime");
    const utcMs = parseAbsolute(value);
    return { monotonicNs: addMs(createdMono, utcMs - createdUtc), utcMs };
  }
  if (mode === SCHEDULER_MODES.NEXT_ELIGIBLE_OUTPUT) return resolveEligibleAnchor(config, createdMono, createdUtc);

  // An immediate/continuous request anchor is captured at plan creation. The
  // caller can supply a later anchor when a participant request is separately
  // observed; this default is intentionally not inferred from wall time later.
  return { monotonicNs: createdMono, utcMs: createdUtc };
}

function makeAnchor(name, monotonicNs, utcMs) {
  return { name, monotonicNs, utcMs, utc: isoUtc(utcMs) };
}

export function createSchedulePlan(config, clock = {}) {
  const mode = resolveMode(config);
  const counts = resolveCounts(config);
  const { intervalMs, streamDurationMs } = resolveIntervalMs(config, counts);
  const createdMonotonicNs = clockMonotonicNs(clock);
  const createdUtcMs = clockUtcMs(clock);
  const request = anchorFromMode(config, mode, createdMonotonicNs, createdUtcMs, counts);
  const intervalNs = BigInt(Math.max(1, Math.round(intervalMs * 1e6)));
  const preStart = request.monotonicNs - intervalNs * BigInt(counts.preCount);
  const primaryStart = request.monotonicNs;
  // Region anchors are half-open boundaries. The last primary output itself
  // is one interval before PRIMARY_END, and POST_START is the same boundary.
  const primaryEnd = primaryStart + intervalNs * BigInt(counts.primaryCount);
  const postStart = primaryStart + intervalNs * BigInt(counts.primaryCount);
  const streamEnd = postStart + intervalNs * BigInt(counts.postCount);
  const correlation = Object.freeze({
    createdMonotonicNs,
    createdUtcMs,
    createdUtc: isoUtc(createdUtcMs),
  });
  const anchorUtc = (monotonicNs) => request.utcMs + nsToMs(monotonicNs - request.monotonicNs);
  const anchors = {
    [SCHEDULER_ANCHORS.PLAN_CREATED]: makeAnchor(SCHEDULER_ANCHORS.PLAN_CREATED, createdMonotonicNs, createdUtcMs),
    [SCHEDULER_ANCHORS.REQUEST]: makeAnchor(SCHEDULER_ANCHORS.REQUEST, request.monotonicNs, request.utcMs),
    [SCHEDULER_ANCHORS.PRE_START]: makeAnchor(SCHEDULER_ANCHORS.PRE_START, preStart, anchorUtc(preStart)),
    [SCHEDULER_ANCHORS.PRIMARY_START]: makeAnchor(SCHEDULER_ANCHORS.PRIMARY_START, primaryStart, anchorUtc(primaryStart)),
    [SCHEDULER_ANCHORS.PRIMARY_END]: makeAnchor(SCHEDULER_ANCHORS.PRIMARY_END, primaryEnd, anchorUtc(primaryEnd)),
    [SCHEDULER_ANCHORS.POST_START]: makeAnchor(SCHEDULER_ANCHORS.POST_START, postStart, anchorUtc(postStart)),
    [SCHEDULER_ANCHORS.STREAM_END]: makeAnchor(SCHEDULER_ANCHORS.STREAM_END, streamEnd, anchorUtc(streamEnd)),
  };
  const outputs = [];
  for (let sequence = 0; sequence < counts.totalCount; sequence += 1) {
    const region = sequence < counts.preCount
      ? "pre"
      : sequence < counts.preCount + counts.primaryCount
        ? "primary"
        : "post";
    const offset = region === "post"
      ? sequence - counts.preCount - counts.primaryCount
      : sequence - counts.preCount;
    const scheduledMonotonicNs = request.monotonicNs + intervalNs * BigInt(sequence - counts.preCount);
    outputs.push(Object.freeze({
      sequence,
      region,
      offset,
      scheduledMonotonicNs,
      scheduledUtcMs: anchorUtc(scheduledMonotonicNs),
      scheduledUtc: isoUtc(anchorUtc(scheduledMonotonicNs)),
    }));
  }
  return Object.freeze({
    mode,
    requestedMode: firstDefined(config.mode, config.timing?.mode),
    sourceMode: mode === SCHEDULER_MODES.PREGENERATED_HIDDEN ? "PREGENERATED_HIDDEN" : "REAL_TIME_SCHEDULED",
    counts: Object.freeze(counts),
    totalCount: counts.totalCount,
    intervalMs,
    intervalNs,
    streamDurationMs,
    correlation,
    anchors: Object.freeze(anchors),
    outputs: Object.freeze(outputs),
  });
}

function defaultTimer() {
  return {
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (handle) => clearTimeout(handle),
  };
}

function defaultOutputProvider({ sequence }) {
  return sequence;
}

function resultWithoutValues(result) {
  return {
    status: result.status,
    mode: result.plan.mode,
    sourceMode: result.plan.sourceMode,
    totalCount: result.plan.totalCount,
    generatedCount: result.outputs.length,
    missedCount: result.records.filter((record) => record.status === "MISSED").length,
    records: result.records,
    fingerprint: result.fingerprint,
    interrupted: result.interrupted,
  };
}

export class SessionScheduler {
  constructor(config = {}, dependencies = {}) {
    // Supporting (config, dependencies) and one merged object keeps the
    // integration API convenient without coupling this module to Electron.
    const merged = dependencies && Object.keys(dependencies).length
      ? { ...config, ...dependencies }
      : config;
    this.config = config;
    this.clock = merged.clock || {};
    this.timer = merged.timer || defaultTimer();
    const configuredOutputProvider = merged.outputProvider || merged.outputProviderFactory ||
      (typeof merged.output === "function" ? merged.output : null);
    this.outputProvider = configuredOutputProvider || defaultOutputProvider;
    this.evidence = merged.evidence || merged.evidenceCallbacks || {};
    this.onEvidence = merged.onEvidence || this.evidence.onEvidence || this.evidence.record || this.evidence.append;
    this.onOutput = merged.onOutput || merged.onOutputRecord || this.evidence.onOutput || this.evidence.recordOutput;
    this.onComplete = merged.onComplete || merged.onCompletion || this.evidence.onComplete || this.evidence.onCompletion;
    this.onFailure = merged.onFailure || merged.onOutputFailure || this.evidence.onFailure || this.evidence.onOutputFailure;
    this.onTimingDeviation = merged.onTimingDeviation || this.evidence.onTimingDeviation;
    this.onClockDiscontinuity = merged.onClockDiscontinuity || this.evidence.onClockDiscontinuity;
    this.onInterrupted = merged.onInterrupted || this.evidence.onInterrupted;
    this.onAborted = merged.onAborted || this.evidence.onAborted;
    this.sessionId = merged.sessionId;
    this.trialId = merged.trialId;
    this.toleranceMs = asNonNegativeNumber(firstDefined(merged.toleranceMs, config.toleranceMs, config.timing?.toleranceMs, 100), "toleranceMs");
    this.discontinuityToleranceMs = asNonNegativeNumber(firstDefined(merged.discontinuityToleranceMs, config.discontinuityToleranceMs, 1000), "discontinuityToleranceMs");
    this.missedOutputPolicy = normalizeMissedPolicy(firstDefined(merged.missedOutputPolicy, config.missedOutputPolicy, config.timing?.missedOutputPolicy, "CONTINUE"));
    if (!["CONTINUE", "ABORT"].includes(this.missedOutputPolicy)) throw new Error("missedOutputPolicy must be CONTINUE or ABORT");
    const planConfig = {
      ...config,
      nextEligibleOutput: merged.nextEligibleOutput || config.nextEligibleOutput,
      requestMonotonicNs: merged.requestMonotonicNs ?? config.requestMonotonicNs,
      requestUtc: merged.requestUtc ?? config.requestUtc,
    };
    this.plan = createSchedulePlan(planConfig, this.clock);
    this.status = "PLANNED";
    this.records = [];
    this.outputs = [];
    this.hiddenOutputs = [];
    this.nextSequence = 0;
    this.timerHandle = null;
    this.lastObservedMonotonicNs = this.plan.correlation.createdMonotonicNs;
    this.lastObservedUtcMs = this.plan.correlation.createdUtcMs;
    this.interrupted = false;
    this.fingerprint = null;
    this._completionCalled = false;
  }

  static createPlan(config, clock = {}) {
    return createSchedulePlan(config, clock);
  }

  get sourceMode() {
    return this.plan.sourceMode;
  }

  toRendererDTO() {
    const publicAnchor = (anchor) => ({
      ...anchor,
      monotonicNs: anchor.monotonicNs.toString(),
    });
    return {
      mode: this.plan.mode,
      sourceMode: this.plan.sourceMode,
      totalCount: this.plan.totalCount,
      counts: this.plan.counts,
      intervalMs: this.plan.intervalMs,
      anchors: Object.fromEntries(Object.entries(this.plan.anchors).map(([name, anchor]) => [name, publicAnchor(anchor)])),
      status: this.status,
      fingerprint: this.status === "COMPLETE" ? this.fingerprint : undefined,
    };
  }

  _emitEvidence(type, payload = {}) {
    const evidence = {
      type,
      sessionId: this.sessionId,
      trialId: this.trialId,
      occurredUtc: isoUtc(clockUtcMs(this.clock)),
      monotonicNs: clockMonotonicNs(this.clock).toString(),
      payload,
    };
    if (typeof this.onEvidence === "function") this.onEvidence(evidence);
    const namedCallback = type === "TIMING_DEVIATION"
      ? this.onTimingDeviation
      : type === "CLOCK_DISCONTINUITY"
        ? this.onClockDiscontinuity
        : type === "INTERRUPTED"
          ? this.onInterrupted
          : type === "ABORTED"
            ? this.onAborted
            : null;
    if (typeof namedCallback === "function") namedCallback(evidence);
    return evidence;
  }

  async commit() {
    if (this.status !== "PLANNED") throw new Error(`Cannot commit scheduler in state ${this.status}`);
    this.status = "COMMITTED";
    if (this.plan.mode === SCHEDULER_MODES.PREGENERATED_HIDDEN) {
      const outputs = [];
      for (const slot of this.plan.outputs) {
        const value = await this._generate(slot, { preGenerated: true });
        const record = {
          ...slot,
          actualMonotonicNs: null,
          actualUtc: null,
          latenessMs: null,
          status: "PREGENERATED_HIDDEN",
          toleranceMs: null,
          sourceMode: "PREGENERATED_HIDDEN",
          value,
        };
        outputs.push(record);
      }
      this.hiddenOutputs = outputs;
      this.outputs = outputs;
      this.records = outputs.map(({ value, ...record }) => ({ ...record, hidden: true }));
      this.fingerprint = fingerprint(outputs);
      this.status = "COMPLETE";
      this._complete();
    }
    return {
      status: this.status,
      sourceMode: this.plan.sourceMode,
      totalCount: this.plan.totalCount,
      generatedCount: this.outputs.length,
      fingerprint: this.fingerprint,
      hidden: this.plan.mode === SCHEDULER_MODES.PREGENERATED_HIDDEN,
      plan: this.plan,
    };
  }

  async _generate(slot, timing = {}) {
    const provider = this.outputProvider;
    const generate = typeof provider === "function"
      ? provider
      : provider.generate || provider.generateOutput || provider.next || provider.produce || provider.output;
    if (typeof generate !== "function") throw new Error("outputProvider must be a function or implement generate/generateOutput/next/produce");
    return generate.call(typeof provider === "function" ? undefined : provider, {
      sessionId: this.sessionId,
      trialId: this.trialId,
      sequence: slot.sequence,
      region: slot.region,
      scheduledMonotonicNs: slot.scheduledMonotonicNs,
      scheduledUtc: slot.scheduledUtc,
      sourceMode: this.plan.sourceMode,
      ...timing,
    });
  }

  _observeClock() {
    const monotonicNs = clockMonotonicNs(this.clock);
    const utcMs = clockUtcMs(this.clock);
    const previousMono = this.lastObservedMonotonicNs;
    const previousUtc = this.lastObservedUtcMs;
    const monotonicDeltaMs = nsToMs(monotonicNs - previousMono);
    const wallDeltaMs = utcMs - previousUtc;
    const expectedWallDeltaMs = monotonicDeltaMs;
    const wallDiscontinuity = Math.abs(wallDeltaMs - expectedWallDeltaMs) > this.discontinuityToleranceMs;
    const backwardsMonotonic = monotonicNs < previousMono;
    const backwardsWall = utcMs < previousUtc;
    if (wallDiscontinuity || backwardsMonotonic || backwardsWall) {
      this._emitEvidence("CLOCK_DISCONTINUITY", {
        previousMonotonicNs: previousMono.toString(),
        monotonicNs: monotonicNs.toString(),
        previousUtc: isoUtc(previousUtc),
        actualUtc: isoUtc(utcMs),
        wallDeltaMs,
        expectedWallDeltaMs,
        backwardsMonotonic,
        backwardsWall,
      });
    }
    this.lastObservedMonotonicNs = monotonicNs;
    this.lastObservedUtcMs = utcMs;
    return { monotonicNs, utcMs };
  }

  _setTimer(delayMs) {
    if (this.timerHandle !== null) this.timer.clearTimeout(this.timerHandle);
    // Native timers cap their delay at a signed 32-bit integer. Chaining a
    // real timer is safe here because it does not generate outputs in a busy
    // loop.
    const delay = Math.max(0, Math.min(Math.ceil(delayMs), 2_147_483_647));
    const timerSentinel = {};
    this.timerHandle = timerSentinel;
    const handle = this.timer.setTimeout(() => {
      if (this.timerHandle === timerSentinel) this.timerHandle = null;
      return Promise.resolve(this._processDue()).catch((error) => this._fail(error));
    }, delay);
    // Deterministic test timers may invoke their callback before returning.
    if (this.timerHandle === timerSentinel) this.timerHandle = handle;
    else if (this.status !== "RUNNING" && handle !== null && handle !== undefined) this.timer.clearTimeout(handle);
  }

  async start() {
    if (this.plan.mode === SCHEDULER_MODES.PREGENERATED_HIDDEN) {
      if (this.status === "PLANNED") await this.commit();
      return resultWithoutValues({ plan: this.plan, status: this.status, outputs: this.outputs, records: this.records, fingerprint: this.fingerprint, interrupted: this.interrupted });
    }
    if (this.status === "PLANNED") await this.commit();
    if (this.status !== "COMMITTED") throw new Error(`Cannot start scheduler in state ${this.status}`);
    this.status = "RUNNING";
    this._scheduleNext();
    return { status: this.status, mode: this.plan.mode, sourceMode: this.plan.sourceMode, totalCount: this.plan.totalCount };
  }

  _scheduleNext() {
    if (this.status !== "RUNNING") return;
    const slot = this.plan.outputs[this.nextSequence];
    if (!slot) {
      this._finish("COMPLETE");
      return;
    }
    const now = clockMonotonicNs(this.clock);
    const delayMs = nsToMs(slot.scheduledMonotonicNs - now);
    this._setTimer(delayMs);
  }

  async _processDue() {
    if (this.status !== "RUNNING") return;
    const observed = this._observeClock();
    while (this.status === "RUNNING") {
      const slot = this.plan.outputs[this.nextSequence];
      if (!slot) {
        this._finish("COMPLETE");
        return;
      }
      if (observed.monotonicNs < slot.scheduledMonotonicNs) {
        this._scheduleNext();
        return;
      }
      const latenessMs = nsToMs(observed.monotonicNs - slot.scheduledMonotonicNs);
      this.nextSequence += 1;
      if (latenessMs > this.toleranceMs) {
        const missed = {
          ...slot,
          actualMonotonicNs: observed.monotonicNs,
          actualUtcMs: observed.utcMs,
          actualUtc: isoUtc(observed.utcMs),
          latenessMs,
          status: "MISSED",
          toleranceMs: this.toleranceMs,
          sourceMode: this.plan.sourceMode,
        };
        this.records.push(missed);
        this._emitEvidence("TIMING_DEVIATION", { ...missed, scheduledMonotonicNs: slot.scheduledMonotonicNs.toString(), actualMonotonicNs: observed.monotonicNs.toString() });
        if (this.missedOutputPolicy === "ABORT") {
          this._finish("ABORTED");
          return;
        }
        continue;
      }
      const value = await this._generate(slot, {
        actualMonotonicNs: observed.monotonicNs,
        actualUtc: isoUtc(observed.utcMs),
      });
      const record = {
        ...slot,
        actualMonotonicNs: observed.monotonicNs,
        actualUtcMs: observed.utcMs,
        actualUtc: isoUtc(observed.utcMs),
        latenessMs,
        status: latenessMs === 0 ? "ON_TIME" : "LATE",
        toleranceMs: this.toleranceMs,
        sourceMode: this.plan.sourceMode,
        value,
      };
      this.outputs.push(record);
      this.records.push(record);
      if (typeof this.onOutput === "function") await this.onOutput({ ...record });
    }
    this._scheduleNext();
  }

  _complete() {
    if (this._completionCalled) return;
    this._completionCalled = true;
    const callbackResult = {
      status: this.status,
      fingerprint: this.fingerprint,
      finalFingerprint: this.fingerprint,
      generatedCount: this.outputs.length,
      missedCount: this.records.filter((record) => record.status === "MISSED").length,
      sourceMode: this.plan.sourceMode,
    };
    if (typeof this.onComplete === "function") this.onComplete(callbackResult);
  }

  _finish(status) {
    if (this.timerHandle !== null) {
      this.timer.clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    this.status = status;
    this.fingerprint = fingerprint(this.outputs);
    this._complete();
  }

  _fail(error) {
    const failure = { error: String(error?.message || error), status: "LOGGING_FAILURE", sessionId: this.sessionId, trialId: this.trialId };
    try { this._emitEvidence("OUTPUT_FAILED", failure); } catch { /* preserve the original failure classification */ }
    if (typeof this.onFailure === "function") {
      try { Promise.resolve(this.onFailure(failure)).catch(() => {}); } catch { /* fail closed below */ }
    }
    this._finish("ABORTED");
    return this.status;
  }

  interrupt(reason = "external interruption") {
    if (!["RUNNING", "COMMITTED"].includes(this.status)) return this.status;
    this.interrupted = true;
    this._emitEvidence("INTERRUPTED", { reason });
    this._finish("INTERRUPTED");
    return this.status;
  }

  pause(reason = "pause requested") {
    return this.interrupt(reason);
  }

  abort(reason = "aborted") {
    if (["COMPLETE", "ABORTED", "INTERRUPTED"].includes(this.status)) return this.status;
    this._emitEvidence("ABORTED", { reason });
    this._finish("ABORTED");
    return this.status;
  }

  stop(reason = "stopped") {
    return this.abort(reason);
  }

  getResult() {
    return resultWithoutValues({ plan: this.plan, status: this.status, outputs: this.outputs, records: this.records, fingerprint: this.fingerprint, interrupted: this.interrupted });
  }

  getHiddenOutputsForAuthority() {
    return this.plan.mode === SCHEDULER_MODES.PREGENERATED_HIDDEN ? this.hiddenOutputs.map((output) => ({ ...output })) : [];
  }
}

export const normalizeSchedulerMode = resolveMode;

export function createSessionScheduler(config, dependencies = {}) {
  return new SessionScheduler(config, dependencies);
}

export default SessionScheduler;
