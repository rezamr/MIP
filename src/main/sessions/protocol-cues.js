/**
 * Deterministic protocol cue policy.
 *
 * Protocol stage records and audible cue records are intentionally separate:
 * a stage can be persisted for timed procedure bookkeeping without creating a
 * tone.  Participant-paced procedures opt out of the timed cue track
 * entirely.  Timed profiles declare the audible stage IDs explicitly so
 * zero-duration semantic boundaries cannot accidentally create overlapping
 * tones at the same frame.
 */

export const PROTOCOL_CUE_MODES = Object.freeze({
  TIMED_NONSEMANTIC: "TIMED_NONSEMANTIC",
  NONE: "NONE",
});

const DEFAULT_TIMED_AUDIBLE_STAGES = Object.freeze([
  "INDUCTION_START",
  "SETTLING_START",
  "REQUEST_START",
  "RELEASE_START",
  "NEUTRAL_OBSERVATION",
  "RETURN_CUE",
]);

const STAGE_DURATIONS = Object.freeze([
  ["INDUCTION_START", "inductionSeconds"],
  ["SETTLING_START", "settleSeconds"],
  ["REQUEST_START", "requestSeconds"],
  ["REQUEST_END", null],
  ["RELEASE_START", "releaseSeconds"],
  ["NEUTRAL_OBSERVATION", "neutralSeconds"],
  ["POST_REQUEST", null],
  ["RETURN_CUE", "returnSeconds"],
]);

const nonNegativeSeconds = (value, field) => {
  const seconds = Number(value ?? 0);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`${field} must be a finite non-negative number`);
  return seconds;
};

export function normalizeProtocolCueMode(protocol = {}) {
  const stageMode = String(protocol.stageMode || (protocol.participantPaced === true ? "PARTICIPANT_PACED" : "TIMED_AUTOMATIC")).toUpperCase();
  if (!["TIMED_AUTOMATIC", "PARTICIPANT_PACED"].includes(stageMode))
    throw new Error(`Unsupported protocol stage mode: ${stageMode}`);
  const fallback = stageMode === "PARTICIPANT_PACED"
    ? PROTOCOL_CUE_MODES.NONE
    : PROTOCOL_CUE_MODES.TIMED_NONSEMANTIC;
  const value = protocol.cueMode === undefined || protocol.cueMode === null || protocol.cueMode === ""
    ? fallback
    : String(protocol.cueMode).toUpperCase();
  if (!Object.values(PROTOCOL_CUE_MODES).includes(value))
    throw new Error(`Unsupported protocol cue mode: ${value}`);
  if (stageMode === "PARTICIPANT_PACED" && value !== PROTOCOL_CUE_MODES.NONE)
    throw new Error("PARTICIPANT_PACED protocols must use cueMode NONE");
  return value;
}

function declaredAudibleStages(protocol) {
  if (protocol.audibleStages === undefined || protocol.audibleStages === null)
    return [...DEFAULT_TIMED_AUDIBLE_STAGES];
  if (!Array.isArray(protocol.audibleStages)) throw new Error("protocol.audibleStages must be an array");
  const stages = protocol.audibleStages.map((stage) => String(stage).toUpperCase());
  if (new Set(stages).size !== stages.length) throw new Error("protocol.audibleStages must not contain duplicates");
  const known = new Set(STAGE_DURATIONS.map(([stage]) => stage));
  for (const stage of stages) if (!known.has(stage)) throw new Error(`protocol.audibleStages contains unknown stage ${stage}`);
  return stages;
}

export function protocolCues(protocol = {}, sampleRate) {
  const mode = normalizeProtocolCueMode(protocol);
  if (mode === PROTOCOL_CUE_MODES.NONE) return [];
  const rate = Number(sampleRate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("sampleRate must be positive for protocol cues");
  const audibleStages = new Set(declaredAudibleStages(protocol));
  let elapsedSeconds = 0;
  const usedStartFrames = new Map();
  const cues = [];
  for (const [stageType, durationField] of STAGE_DURATIONS) {
    const durationSeconds = durationField ? nonNegativeSeconds(protocol[durationField], `protocol.${durationField}`) : 0;
    const startFrame = Math.max(0, Math.round(elapsedSeconds * rate));
    if (audibleStages.has(stageType)) {
      const previous = usedStartFrames.get(startFrame);
      if (previous) throw new Error(`protocol cue collision at frame ${startFrame}: ${previous} and ${stageType}`);
      usedStartFrames.set(startFrame, stageType);
      cues.push({
        id: `protocol-${stageType.toLowerCase()}`,
        stageType,
        startFrame,
        durationFrames: Math.max(1, Math.round(Math.min(0.25, Math.max(0.05, durationSeconds || 0.1)) * rate)),
        leftHz: 880,
        rightHz: 884,
        gain: 0.015,
        phase: { left: 0, right: 0 },
        waveform: "sine",
      });
    }
    elapsedSeconds += durationSeconds;
  }
  return cues;
}

export default protocolCues;
