export const FORMAL_TELEMETRY_INTERVAL_MS = 1000;

const defaultNow = () => globalThis.performance?.now?.() ?? Date.now();

/**
 * Forwards the newest ordinary formal-session telemetry at most once per
 * interval. Lifecycle/error messages bypass the throttle and are forwarded
 * immediately. A single timer is used so intermediate packets never form a
 * backlog while the AudioWorklet continues to report live state normally.
 */
export class FormalTelemetryThrottle {
  constructor(forward, options = {}) {
    if (typeof forward !== "function") throw new TypeError("FormalTelemetryThrottle requires a forward function");
    const intervalMs = Number(options.intervalMs ?? FORMAL_TELEMETRY_INTERVAL_MS);
    if (!Number.isFinite(intervalMs) || intervalMs < 0) throw new TypeError("intervalMs must be a non-negative finite number");
    this.forward = forward;
    this.intervalMs = intervalMs;
    this.now = options.now ?? defaultNow;
    this.setTimeout = options.setTimeoutFn ?? ((callback, delay) => globalThis.setTimeout(callback, delay));
    this.clearTimeout = options.clearTimeoutFn ?? ((timer) => globalThis.clearTimeout(timer));
    this.lastForwardAt = null;
    this.latest = null;
    this.pending = null;
    this.timer = null;
    this.telemetryForwarded = 0;
    this.immediateForwarded = 0;
  }

  _forwardTelemetry(message, at) {
    this.lastForwardAt = at;
    this.telemetryForwarded += 1;
    this.forward(message);
  }

  _schedule(delay) {
    if (this.timer !== null) return;
    this.timer = this.setTimeout(() => {
      this.timer = null;
      this._flushTimer();
    }, Math.max(0, delay));
  }

  _flushTimer() {
    if (this.pending === null) return;
    const at = this.now();
    const elapsed = this.lastForwardAt === null ? Infinity : at - this.lastForwardAt;
    if (elapsed < this.intervalMs) {
      this._schedule(this.intervalMs - elapsed);
      return;
    }
    const message = this.pending;
    this.pending = null;
    this._forwardTelemetry(message, at);
  }

  /** Queue or immediately forward an ordinary TELEMETRY packet. */
  push(message) {
    const at = this.now();
    this.latest = message;
    const elapsed = this.lastForwardAt === null ? Infinity : at - this.lastForwardAt;
    if (elapsed >= this.intervalMs) {
      this.pending = null;
      this._forwardTelemetry(message, at);
      return true;
    }
    this.pending = message;
    this._schedule(this.intervalMs - elapsed);
    return false;
  }

  /**
   * Accept a processor message. Ordinary telemetry is throttled; processor
   * errors and lifecycle/finalization messages are never delayed.
   */
  accept(message) {
    if (message?.type && message.type !== "TELEMETRY") {
      this.immediateForwarded += 1;
      this.forward(message);
      return true;
    }
    return this.push(message);
  }

  /** Forward a pending packet only when its ordinary interval has elapsed. */
  flushIfDue() {
    if (this.pending === null) return false;
    const at = this.now();
    const elapsed = this.lastForwardAt === null ? Infinity : at - this.lastForwardAt;
    if (elapsed < this.intervalMs) return false;
    const message = this.pending;
    this.pending = null;
    this._forwardTelemetry(message, at);
    return true;
  }

  cancel() {
    if (this.timer !== null) this.clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.latest = null;
  }
}

export default FormalTelemetryThrottle;
