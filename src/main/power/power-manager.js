/**
 * Power management is an adapter boundary. This module deliberately does not
 * import Electron, which keeps formal-domain tests runnable in plain Node.
 */

function nowUtc(clock) {
  const read = (candidate) => typeof candidate === "function" ? candidate.call(clock) : candidate;
  const value = read(clock?.utcMs) ?? read(clock?.nowUtcMs) ?? read(clock?.now);
  return value instanceof Date ? value.toISOString() : new Date(value ?? Date.now()).toISOString();
}

function nowMonotonic(clock) {
  const read = (candidate) => typeof candidate === "function" ? candidate.call(clock) : candidate;
  const value = read(clock?.monotonicNs) ?? read(clock?.nowMonotonicNs);
  return (value === undefined ? process.hrtime.bigint() : BigInt(value)).toString();
}

export class PowerManager {
  constructor({ blocker, monitor, powerSaveBlocker, powerMonitor, clock = {}, onEvidence, onSuspend, onResume, evidence } = {}) {
    this.blocker = blocker || powerSaveBlocker || null;
    this.monitor = monitor || powerMonitor || null;
    this.clock = clock;
    this.onEvidence = onEvidence || evidence?.onEvidence || evidence?.record || evidence?.append;
    this.onSuspend = onSuspend || evidence?.onSuspend;
    this.onResume = onResume || evidence?.onResume;
    this.blockerId = null;
    this.protected = false;
    this.attached = false;
    this.observations = [];
    this.listeners = new Map();
  }

  _record(type, payload = {}) {
    const event = {
      type,
      occurredUtc: nowUtc(this.clock),
      monotonicNs: nowMonotonic(this.clock),
      payload,
    };
    this.observations.push(event);
    if (typeof this.onEvidence === "function") this.onEvidence(event);
    return event;
  }

  start(reason = "prevent-app-suspension") {
    if (this.protected) return this.blockerId;
    if (this.blocker && typeof this.blocker.start === "function")
      this.blockerId = this.blocker.start(reason);
    this.protected = true;
    this._record("POWER_BLOCKER_STARTED", { reason, blockerId: this.blockerId });
    return this.blockerId;
  }

  stop() {
    if (!this.protected) return false;
    if (this.blocker && typeof this.blocker.stop === "function" && this.blockerId !== null)
      this.blocker.stop(this.blockerId);
    const blockerId = this.blockerId;
    this.blockerId = null;
    this.protected = false;
    this._record("POWER_BLOCKER_STOPPED", { blockerId });
    return true;
  }

  observe(type, payload = {}) {
    const normalized = String(type).toLowerCase();
    if (normalized === "suspend" || normalized === "sleep") {
      const event = this._record("POWER_SUSPEND_OBSERVED", { ...payload, protected: this.protected });
      if (typeof this.onSuspend === "function") this.onSuspend(event);
      return event;
    }
    if (normalized === "resume" || normalized === "wake") {
      const event = this._record("POWER_RESUME_OBSERVED", { ...payload, protected: this.protected });
      if (typeof this.onResume === "function") this.onResume(event);
      return event;
    }
    if (normalized === "lock-screen" || normalized === "lock")
      return this._record("POWER_LOCK_OBSERVED", { ...payload, protected: this.protected });
    if (normalized === "unlock-screen" || normalized === "unlock")
      return this._record("POWER_UNLOCK_OBSERVED", { ...payload, protected: this.protected });
    return this._record("POWER_OBSERVATION", { event: type, ...payload, protected: this.protected });
  }

  attach() {
    if (this.attached || !this.monitor || typeof this.monitor.on !== "function") return this;
    for (const event of ["suspend", "resume", "lock-screen", "unlock-screen"]) {
      const listener = (...args) => this.observe(event, { args });
      this.listeners.set(event, listener);
      this.monitor.on(event, listener);
    }
    this.attached = true;
    return this;
  }

  detach() {
    if (!this.attached) return this;
    for (const [event, listener] of this.listeners) {
      if (typeof this.monitor.removeListener === "function") this.monitor.removeListener(event, listener);
      else if (typeof this.monitor.off === "function") this.monitor.off(event, listener);
    }
    this.listeners.clear();
    this.attached = false;
    return this;
  }

  snapshot() {
    return {
      protected: this.protected,
      blockerId: this.blockerId,
      attached: this.attached,
      observationCount: this.observations.length,
      lastObservation: this.observations.at(-1) || null,
    };
  }

  toRendererDTO() {
    const snapshot = this.snapshot();
    return { protected: snapshot.protected, attached: snapshot.attached, observationCount: snapshot.observationCount };
  }
}

export function createPowerManager({ electron, ...options } = {}) {
  return new PowerManager({
    ...options,
    blocker: options.blocker || electron?.powerSaveBlocker,
    monitor: options.monitor || electron?.powerMonitor,
  });
}

export default PowerManager;
