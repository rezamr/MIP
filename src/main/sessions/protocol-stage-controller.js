/**
 * Authoritative hands-free protocol clock.
 *
 * The renderer is never allowed to advance a protocol stage.  The controller
 * is anchored to the accepted AudioWorklet start acknowledgement and records
 * every planned/observed stage through the main-process callback.  Timers are
 * deliberately used only to notify the owner; machine output generation
 * remains the responsibility of SessionScheduler.
 */

export const PROTOCOL_STAGE_TYPES = Object.freeze([
  "INDUCTION_START",
  "SETTLING_START",
  "REQUEST_START",
  "REQUEST_END",
  "RELEASE_START",
  "NEUTRAL_OBSERVATION",
  "POST_REQUEST",
  "RETURN_CUE",
  "AUDIO_FINALIZED",
]);

const number = (value, fallback = 0) => {
  const result = Number(value ?? fallback);
  if (!Number.isFinite(result) || result < 0) throw new Error("Protocol duration must be a finite non-negative number");
  return result;
};

const asNs = (value) => {
  try { return typeof value === "bigint" ? value : BigInt(value); }
  catch { throw new Error("Protocol anchor monotonic time is invalid"); }
};

const utc = (value) => new Date(Math.round(Number(value))).toISOString();

function defaultTimer() {
  return {
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (handle) => clearTimeout(handle),
  };
}

function monotonicNow() { return process.hrtime.bigint(); }
function utcNow() { return Date.now(); }

function buildStages(protocol = {}) {
  const induction = number(protocol.inductionSeconds) * 1000;
  const settling = number(protocol.settleSeconds) * 1000;
  const request = number(protocol.requestSeconds) * 1000;
  const release = number(protocol.releaseSeconds) * 1000;
  const neutral = number(protocol.neutralSeconds) * 1000;
  const returnCue = number(protocol.returnSeconds) * 1000;
  let offset = 0;
  const stages = [];
  const add = (stageType, durationMs = 0, cueId = null) => {
    stages.push({ stageType, offsetMs: offset, durationMs, cueId });
    offset += durationMs;
  };
  add("INDUCTION_START", induction, "CUE_INDUCTION");
  add("SETTLING_START", settling, "CUE_SETTLING");
  add("REQUEST_START", request, "CUE_REQUEST");
  add("REQUEST_END", 0, "CUE_REQUEST_END");
  add("RELEASE_START", release, "CUE_RELEASE");
  add("NEUTRAL_OBSERVATION", neutral, "CUE_NEUTRAL");
  add("POST_REQUEST", 0, "CUE_POST_REQUEST");
  // Participant-paced protocols deliberately have no app-selected return
  // instant.  The owner activates Return/Stop and the main process captures
  // the anchor; do not synthesize a countdown/automatic cue for this mode.
  if (protocol.participantPaced !== true && protocol.returnCueMode !== "PARTICIPANT_STOP")
    add("RETURN_CUE", returnCue, "CUE_RETURN");
  return stages;
}

export class ProtocolStageController {
  constructor(protocol = {}, dependencies = {}) {
    this.protocol = { ...protocol };
    this.sessionId = dependencies.sessionId || null;
    this.trialId = dependencies.trialId || null;
    this.timer = dependencies.timer || defaultTimer();
    this.readMonotonicNs = dependencies.monotonicNs || monotonicNow;
    this.readUtcMs = dependencies.utcMs || utcNow;
    this.onStage = dependencies.onStage || null;
    // The return cue is an authoritative main-process event.  The renderer
    // may use it to request the AudioWorklet STOP handshake, but it cannot
    // advance the stage clock or mark the protocol complete itself.
    this.onReturnCue = dependencies.onReturnCue || null;
    this.onComplete = dependencies.onComplete || null;
    this.stages = buildStages(protocol);
    this.status = "IDLE";
    this.anchor = null;
    this.index = 0;
    this.timerHandle = null;
    this.stageHistory = [];
    this.audioFinalized = false;
    this.returnCueObserved = false;
    this.completionPending = false;
    this.completionCalled = false;
  }

  _clearTimer() {
    if (this.timerHandle !== null) {
      this.timer.clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }

  _planned(stage) {
    const mono = this.anchor.monotonicNs + BigInt(Math.round(stage.offsetMs * 1e6));
    const utcMs = this.anchor.utcMs + stage.offsetMs;
    return { plannedMonotonicNs: mono.toString(), plannedUtc: utc(utcMs), utcMs };
  }

  _observe(stage, status = "OBSERVED") {
    const mono = asNs(this.readMonotonicNs());
    const utcMs = Number(this.readUtcMs());
    const planned = this._planned(stage);
    const event = {
      sessionId: this.sessionId,
      trialId: this.trialId,
      stageType: stage.stageType,
      cueId: stage.cueId,
      plannedUtc: planned.plannedUtc,
      plannedMonotonicNs: planned.plannedMonotonicNs,
      actualUtc: utc(utcMs),
      actualMonotonicNs: mono.toString(),
      status,
      payload: {
        anchor: "AUDIO_STARTED",
        offsetMs: stage.offsetMs,
        cueVersion: this.protocol.cueVersion || null,
      },
    };
    this.stageHistory.push(event);
    try { this.onStage?.(event); }
    catch (error) {
      this.stop("stage persistence failed");
      throw error;
    }
    if (stage.stageType === "RETURN_CUE") {
      this.returnCueObserved = true;
      this.completionPending = true;
      try { this.onReturnCue?.(event); }
      catch (error) {
        this.stop("return cue delivery failed");
        throw error;
      }
      this._maybeComplete();
    }
    return event;
  }

  _scheduleNext() {
    if (this.status !== "RUNNING") return;
    const stage = this.stages[this.index];
    if (!stage) {
      this._maybeComplete();
      return;
    }
    const targetNs = this.anchor.monotonicNs + BigInt(Math.round(stage.offsetMs * 1e6));
    const delayMs = Math.max(0, Number(targetNs - asNs(this.readMonotonicNs())) / 1e6);
    const sentinel = {};
    this.timerHandle = sentinel;
    const handle = this.timer.setTimeout(() => {
      if (this.timerHandle === sentinel) this.timerHandle = null;
      if (this.status !== "RUNNING") return;
      try {
        this._observe(stage);
        this.index += 1;
        this._scheduleNext();
      } catch (error) {
        this.status = "FAILED";
        this.onComplete?.({ status: this.status, error: error.message, stages: this.toDTO().stages });
      }
    }, Math.min(delayMs, 2_147_483_647));
    if (this.timerHandle === sentinel) this.timerHandle = handle;
    else if (handle !== null && handle !== undefined) this.timer.clearTimeout(handle);
  }

  start(anchor = {}) {
    if (this.status !== "IDLE") throw new Error(`Protocol stage controller cannot start from ${this.status}`);
    const monotonicNs = asNs(anchor.monotonicNs ?? this.readMonotonicNs());
    const suppliedUtc = anchor.utcMs ?? (anchor.utc ? Date.parse(anchor.utc) : undefined);
    const utcMs = Number(suppliedUtc ?? this.readUtcMs());
    if (!Number.isFinite(utcMs)) throw new Error("Protocol anchor UTC is invalid");
    this.anchor = { name: anchor.name || "AUDIO_STARTED", monotonicNs, utcMs, utc: utc(utcMs) };
    this.status = "RUNNING";
    this.index = 0;
    this._scheduleNext();
    return this.toDTO();
  }

  notifyAudioFinalized(details = {}) {
    if (this.audioFinalized) return this.toDTO();
    this.audioFinalized = true;
    const stage = { stageType: "AUDIO_FINALIZED", offsetMs: this.anchor ? Number(this.readMonotonicNs() - this.anchor.monotonicNs) / 1e6 : 0, cueId: null };
    if (this.anchor) this._observe({ ...stage, durationMs: 0 });
    this._maybeComplete(details);
    return this.toDTO();
  }

  _maybeComplete(details = {}) {
    if (!this.completionPending || !this.audioFinalized || this.completionCalled) return;
    this.completionCalled = true;
    this.status = "COMPLETE";
    this._clearTimer();
    this.onComplete?.({
      status: this.status,
      sessionId: this.sessionId,
      trialId: this.trialId,
      anchor: this.anchor ? { ...this.anchor, monotonicNs: this.anchor.monotonicNs.toString() } : null,
      stages: this.toDTO().stages,
      ...details,
    });
  }

  stop(reason = "stopped") {
    this._clearTimer();
    if (!this.completionCalled && this.status !== "COMPLETE") this.status = "STOPPED";
    return { ...this.toDTO(), reason };
  }

  toDTO() {
    return {
      sessionId: this.sessionId,
      trialId: this.trialId,
      status: this.status,
      anchor: this.anchor ? { ...this.anchor, monotonicNs: this.anchor.monotonicNs.toString() } : null,
      stages: this.stageHistory.map((stage) => ({ ...stage })),
      plannedStages: this.stages.map((stage) => ({ ...stage })),
      audioFinalized: this.audioFinalized,
      returnCueObserved: this.returnCueObserved,
    };
  }
}

export default ProtocolStageController;
