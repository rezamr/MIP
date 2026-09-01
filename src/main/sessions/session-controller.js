/**
 * The persisted session state machine.
 *
 * `transition()` is intentionally retained as the small synchronous API used
 * by the existing Electron integration. New persistence code should use
 * `transitionTransactional()`, which makes the event and projection update
 * atomic with the state change.
 */

export const SESSION_STATES = Object.freeze({
  DRAFT: "DRAFT",
  TARGET_ASSIGNED: "TARGET_ASSIGNED",
  READY: "READY",
  COMMITTED: "COMMITTED",
  AUDIO_PREPARING: "AUDIO_PREPARING",
  AUDIO_READY: "AUDIO_READY",
  RUNNING: "RUNNING",
  RETURNED: "RETURNED",
  RAW_REPORT_DRAFT: "RAW_REPORT_DRAFT",
  RAW_REPORT_LOCKED: "RAW_REPORT_LOCKED",
  REVEAL_ELIGIBLE: "REVEAL_ELIGIBLE",
  REVEALED: "REVEALED",
  COMPLETE: "COMPLETE",
  AUDIO_FAILED: "AUDIO_FAILED",
  TIMING_DEVIATION: "TIMING_DEVIATION",
  INTERRUPTED: "INTERRUPTED",
  ABORTED: "ABORTED",
  RECOVERY_REQUIRED: "RECOVERY_REQUIRED",
  INTEGRITY_FAILED: "INTEGRITY_FAILED",
});

const {
  DRAFT,
  TARGET_ASSIGNED,
  READY,
  COMMITTED,
  AUDIO_PREPARING,
  AUDIO_READY,
  RUNNING,
  RETURNED,
  RAW_REPORT_DRAFT,
  RAW_REPORT_LOCKED,
  REVEAL_ELIGIBLE,
  REVEALED,
  COMPLETE,
  AUDIO_FAILED,
  TIMING_DEVIATION,
  INTERRUPTED,
  ABORTED,
  RECOVERY_REQUIRED,
  INTEGRITY_FAILED,
} = SESSION_STATES;

const transitionTable = {
  [DRAFT]: [TARGET_ASSIGNED, RECOVERY_REQUIRED, ABORTED, INTEGRITY_FAILED],
  [TARGET_ASSIGNED]: [READY, RECOVERY_REQUIRED, ABORTED, INTEGRITY_FAILED],
  [READY]: [COMMITTED, RECOVERY_REQUIRED, ABORTED, INTEGRITY_FAILED],
  [COMMITTED]: [AUDIO_PREPARING, ABORTED, INTEGRITY_FAILED],
  [AUDIO_PREPARING]: [AUDIO_READY, AUDIO_FAILED, ABORTED, INTEGRITY_FAILED],
  [AUDIO_FAILED]: [AUDIO_PREPARING, RECOVERY_REQUIRED, ABORTED, INTEGRITY_FAILED],
  [AUDIO_READY]: [RUNNING, AUDIO_FAILED, ABORTED, INTEGRITY_FAILED],
  [RUNNING]: [
    RETURNED,
    AUDIO_FAILED,
    TIMING_DEVIATION,
    INTERRUPTED,
    RECOVERY_REQUIRED,
    ABORTED,
    INTEGRITY_FAILED,
  ],
  [TIMING_DEVIATION]: [RETURNED, AUDIO_FAILED, INTERRUPTED, RECOVERY_REQUIRED, ABORTED, INTEGRITY_FAILED],
  [INTERRUPTED]: [RECOVERY_REQUIRED, ABORTED, INTEGRITY_FAILED],
  [RECOVERY_REQUIRED]: [READY, ABORTED, INTEGRITY_FAILED],
  [RETURNED]: [RAW_REPORT_DRAFT, RAW_REPORT_LOCKED, ABORTED, INTEGRITY_FAILED],
  [RAW_REPORT_DRAFT]: [RAW_REPORT_DRAFT, RAW_REPORT_LOCKED, ABORTED, INTEGRITY_FAILED],
  [RAW_REPORT_LOCKED]: [REVEAL_ELIGIBLE, ABORTED, INTEGRITY_FAILED],
  [REVEAL_ELIGIBLE]: [REVEALED, ABORTED, INTEGRITY_FAILED],
  [REVEALED]: [COMPLETE, INTEGRITY_FAILED],
  [INTEGRITY_FAILED]: [RECOVERY_REQUIRED, ABORTED],
  [ABORTED]: [],
  [COMPLETE]: [],
};

// Freeze each list as well as the containing object so callers cannot weaken
// the authority of the state machine by mutating an exported table.
for (const state of Object.keys(transitionTable))
  Object.freeze(transitionTable[state]);
export const SESSION_TRANSITIONS = Object.freeze(transitionTable);
export const transitions = SESSION_TRANSITIONS;
export const SESSION_STATE_TRANSITIONS = SESSION_TRANSITIONS;

const stateSet = new Set(Object.values(SESSION_STATES));

function hasValue(value) {
  return value !== undefined && value !== null;
}

function preconditionValues(context) {
  const value = context || {};
  return {
    ...value,
    ...(value.payload && typeof value.payload === "object" ? value.payload : {}),
    ...(value.evidence && typeof value.evidence === "object" ? value.evidence : {}),
    ...(value.preconditions && typeof value.preconditions === "object" ? value.preconditions : {}),
  };
}

const preconditionRules = Object.freeze({
  [TARGET_ASSIGNED]: [
    ["targetAssigned", (c) => c.targetAssigned === true || hasValue(c.targetAssignment) || hasValue(c.target)],
  ],
  [READY]: [
    ["ready", (c) => c.ready === true || c.participantReady === true],
  ],
  [COMMITTED]: [
    ["commitment", (c) => c.committed === true || hasValue(c.commitment) || hasValue(c.configFingerprint)],
  ],
  [AUDIO_PREPARING]: [
    ["audioPreparation", (c) => c.audioPreparation === true || c.audioRequested === true || hasValue(c.audio)],
  ],
  [AUDIO_READY]: [
    ["audioReady", (c) => c.audioReady === true || c.readyAudio === true],
  ],
  [RUNNING]: [
    ["memoryConfirmed", (c) => c.memoryConfirmed === true],
    ["audioReady", (c) => c.audioReady === true],
  ],
  [RETURNED]: [
    ["completion", (c) => c.returned === true || c.completed === true || c.outputComplete === true],
  ],
  [RAW_REPORT_DRAFT]: [
    ["rawReportDraft", (c) => c.reportDraft === true || hasValue(c.rawReportDraft)],
  ],
  [RAW_REPORT_LOCKED]: [
    ["rawReportLock", (c) => c.rawReportLocked === true || c.reportLocked === true || hasValue(c.lockHash)],
  ],
  [REVEAL_ELIGIBLE]: [
    ["revealEligibility", (c) => c.revealEligible === true],
  ],
  [REVEALED]: [
    ["revealAuthorization", (c) => c.revealAuthorized === true || c.revealed === true],
  ],
  [COMPLETE]: [
    ["completion", (c) => c.complete === true || c.finalized === true],
  ],
  [AUDIO_FAILED]: [
    ["audioFailureEvidence", (c) => hasValue(c.error) || hasValue(c.failure) || c.audioFailed === true],
  ],
  [TIMING_DEVIATION]: [
    ["timingDeviationEvidence", (c) => hasValue(c.deviation) || hasValue(c.timingDeviation) || c.timingDeviation === true],
  ],
  [INTERRUPTED]: [
    ["interruptionEvidence", (c) => hasValue(c.interruption) || hasValue(c.interrupted) || c.interrupted === true],
  ],
  [ABORTED]: [
    ["abortEvidence", (c) => hasValue(c.reason) || hasValue(c.abortReason) || c.aborted === true],
  ],
  [RECOVERY_REQUIRED]: [
    ["recoveryEvidence", (c) => hasValue(c.recoveryReason) || hasValue(c.recovery) || c.recoveryRequired === true],
  ],
  [INTEGRITY_FAILED]: [
    ["integrityEvidence", (c) => hasValue(c.integrityError) || hasValue(c.failedCheck) || c.integrityFailed === true],
  ],
});
export const SESSION_PRECONDITIONS = preconditionRules;

/**
 * Validate both the graph edge and the destination's evidence/preconditions.
 * The result is deliberately data-shaped so an integration can show all
 * missing requirements without attempting a persistence operation.
 */
export function validateTransition(from, to, context = {}, options = {}) {
  const errors = [];
  if (!stateSet.has(from)) errors.push(`Unknown current session state ${from}`);
  if (!stateSet.has(to)) errors.push(`Unknown destination session state ${to}`);
  if (stateSet.has(from) && !SESSION_TRANSITIONS[from].includes(to))
    errors.push(`Illegal session transition ${from} -> ${to}`);

  // The legacy synchronous API is intentionally graph-only. Transactional
  // calls enforce every destination precondition by default.
  if (options.checkPreconditions !== false && stateSet.has(to)) {
    const values = preconditionValues(context);
    for (const [name, predicate] of preconditionRules[to] || [])
      if (!predicate(values)) errors.push(`Missing precondition: ${name}`);
  }
  return { valid: errors.length === 0, from, to, errors };
}

export function validatePreconditions(to, context = {}) {
  const errors = [];
  if (!stateSet.has(to)) errors.push(`Unknown destination session state ${to}`);
  for (const [name, predicate] of preconditionRules[to] || [])
    if (!predicate(preconditionValues(context))) errors.push(`Missing precondition: ${name}`);
  return { valid: errors.length === 0, state: to, errors };
}

export const validatePrecondition = validatePreconditions;
export const validateSessionTransition = validateTransition;

export function isLegalTransition(from, to) {
  return validateTransition(from, to, {}, { checkPreconditions: false }).valid;
}

export function legalTransitions(from) {
  if (!stateSet.has(from)) throw new Error(`Unknown current session state ${from}`);
  return SESSION_TRANSITIONS[from];
}

/** Backward-compatible graph assertion used by the existing main process. */
export function assertTransition(from, to) {
  const result = validateTransition(from, to, {}, { checkPreconditions: false });
  if (!result.valid) throw new Error(result.errors[0]);
  return to;
}

function throwIfInvalid(result) {
  if (!result.valid) throw new Error(result.errors.join("; "));
}

function callAppendEvent(adapter, event) {
  // The object form is the domain adapter contract. The positional form also
  // lets the existing SQLite-shaped adapters be adopted without a wrapper.
  if (adapter.appendEvent.length >= 3)
    return adapter.appendEvent(event.sessionId, event.trialId, event.type, event.payload);
  return adapter.appendEvent(event);
}

function callUpdateProjection(adapter, projection) {
  if (adapter.updateProjection.length >= 2)
    return adapter.updateProjection(projection.sessionId, projection);
  return adapter.updateProjection(projection);
}

export class SessionController {
  constructor(initial = DRAFT, options = {}) {
    if (initial && typeof initial === "object") {
      options = initial;
      initial = options.initial ?? options.initialState ?? options.state ?? DRAFT;
    }
    if (!stateSet.has(initial)) throw new Error(`Unknown current session state ${initial}`);
    this.state = initial;
    this.adapter = options.adapter || (typeof options.transaction === "function" ? options : null);
    this.sessionId = options.sessionId;
    this.trialId = options.trialId;
    this.version = 0;
    this.history = [];
  }

  get currentState() {
    return this.state;
  }

  canTransition(to, context = {}) {
    return validateTransition(this.state, to, context).valid;
  }

  /** Synchronous compatibility path. It has no persistence side effects. */
  transition(to, context) {
    if (
      context?.transactional === true ||
      context?.persist === true ||
      context?.adapter?.transaction ||
      typeof context?.transaction === "function" ||
      (this.adapter && context !== undefined)
    )
      return this.transitionTransactional(to, context);
    if (context !== undefined) {
      const validation = validateTransition(this.state, to, context);
      throwIfInvalid(validation);
    }
    const from = this.state;
    this.state = assertTransition(from, to);
    this.version += 1;
    this.history.push({ from, to });
    return this.state;
  }

  /**
   * Atomically append evidence and update the projection before changing the
   * in-memory state. Adapters must make `transaction(callback)` atomic and
   * must throw/reject on failure.
   *
   * Adapter object contract:
   *   transaction(callback)
   *   appendEvent({ sessionId, trialId, type, from, to, payload })
   *   updateProjection({ sessionId, trialId, state, from, to, version })
   */
  async transitionTransactional(to, context = {}) {
    const adapter = context.adapter ||
      (typeof context.transaction === "function" ? context : null) ||
      this.adapter;
    const validation = validateTransition(this.state, to, context);
    throwIfInvalid(validation);
    if (!adapter || typeof adapter.transaction !== "function")
      throw new Error("A transactional session adapter is required");
    if (typeof adapter.appendEvent !== "function" || typeof adapter.updateProjection !== "function")
      throw new Error("Session adapter must implement appendEvent and updateProjection");

    const from = this.state;
    const version = this.version + 1;
    const payload = {
      ...(context.payload || {}),
      ...(context.evidence || {}),
      from,
      to,
    };
    const event = {
      sessionId: context.sessionId ?? this.sessionId,
      trialId: context.trialId ?? this.trialId,
      type: context.eventType || "SESSION_STATE_TRANSITION",
      eventType: context.eventType || "SESSION_STATE_TRANSITION",
      from,
      to,
      payload,
    };
    const projection = {
      sessionId: event.sessionId,
      trialId: event.trialId,
      state: to,
      from,
      to,
      version,
      ...(context.projection || {}),
    };

    let persisted;
    const transactionResult = adapter.transaction(() => {
      const appended = callAppendEvent(adapter, event);
      const projected = callUpdateProjection(adapter, projection);
      return { appended, projected };
    });
    persisted = await transactionResult;

    // This is deliberately after await. A rejected transaction leaves every
    // in-memory field, including history and version, untouched.
    this.state = to;
    this.version = version;
    this.history.push({ from, to, event: persisted?.appended, projection: persisted?.projected });
    return { state: this.state, version: this.version, ...persisted };
  }

  transitionInTransaction(to, context = {}) {
    return this.transitionTransactional(to, context);
  }

  transitionAsync(to, context = {}) {
    return this.transitionTransactional(to, context);
  }

  transitionAtomically(to, context = {}) {
    return this.transitionTransactional(to, context);
  }

  toRendererDTO() {
    return { state: this.state, version: this.version };
  }
}

export default SessionController;
