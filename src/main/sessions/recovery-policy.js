/**
 * Startup recovery is deliberately a classification policy, not a scheduler
 * factory.  Persisted SQLite evidence can be inspected and marked incomplete,
 * but no formal runtime is resumed implicitly after a process boundary.
 */

const ACTIVE_EVIDENCE_PHASES = new Set([
  "RUNNING",
  "TARGET_PENDING",
  "TARGET_GENERATED",
  "TARGET_OBSERVED",
  "POST_TARGET_MONITORING",
]);

const RETURNED_TEMPORAL_STATES = new Set([
  "RETURNED",
  "RAW_REPORT_DRAFT",
  "RAW_REPORT_LOCKED",
]);

export function classifyStartupRecovery({
  status,
  temporal = false,
  evidencePhaseStatus,
  futureScheduleStillPending = false,
} = {}) {
  const normalizedStatus = String(status || "").toUpperCase();
  const normalizedEvidencePhase = String(evidencePhaseStatus || "").toUpperCase();

  if (!temporal) return Object.freeze({ action: "LEGACY_STATE_MACHINE_RECOVERY", resume: false });
  if (normalizedStatus === "RUNNING") {
    return Object.freeze({
      action: "REQUIRE_RECOVERY",
      resume: false,
      classification: "PROCESS_INTERRUPTED",
    });
  }
  if (RETURNED_TEMPORAL_STATES.has(normalizedStatus) && ACTIVE_EVIDENCE_PHASES.has(normalizedEvidencePhase)) {
    return Object.freeze({
      action: "MARK_INCOMPLETE_REVIEW",
      resume: false,
      classification: "PERSISTED_TEMPORAL_RUNTIME_NOT_RESUMED",
      sessionLifecycle: "RECOVERY_REQUIRED",
      evidencePhaseStatus: "INCOMPLETE",
      revealStatus: "BLOCKED",
    });
  }
  if (normalizedStatus === "COMMITTED" && futureScheduleStillPending) {
    return Object.freeze({
      action: "PRESERVE_SCHEDULE_METADATA",
      resume: false,
      classification: "SCHEDULE_METADATA_ONLY",
      evidencePhaseStatus: "TARGET_PENDING",
    });
  }
  return Object.freeze({ action: "NO_RESUME", resume: false });
}

export { ACTIVE_EVIDENCE_PHASES, RETURNED_TEMPORAL_STATES };

export default classifyStartupRecovery;
