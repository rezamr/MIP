# Codex Prompt — MIP Request Test App v0.3

You are implementing the MIP local research application in `rezamr/MIP`.

Before coding, read in full:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
7. `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
8. `04_EVIDENCE_STANDARD.md`
9. `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md`
10. `protocols/REQUEST_ENCODING_V0.1.md`
11. `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
12. `protocols/MIP_NUM_REQUEST_V0.1.md`
13. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
14. `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
15. `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`
16. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`

Treat the repository as the source of truth.

## Critical v0.3 correction

The participant may be deeply relaxed or in trance during the active session. The application MUST NOT require the participant to inspect or operate a phone/computer after state induction begins.

The requested value/token must be assigned, displayed, memorized, confirmed, and committed BEFORE the participant presses START SESSION.

After START SESSION:

- the session is hands-free and eyes-closed;
- the screen is not needed;
- all stage timing is automatic;
- target generation is automatic;
- no requested value is displayed as a required in-session action;
- no future output is displayed;
- fixed nonsemantic cues signal request start, release/neutral hold, and return;
- the participant does not need to touch the device until ordinary orientation has returned.

After return, the first screen must be the RAW REPORT screen. Reveal remains impossible until the report is locked.

If the participant forgot the assigned value, preserve the trial with `REQUEST_VALUE_FORGOTTEN=true`; never ask them to guess.

If the participant physically terminates the session without software interaction, preserve the trial and allow `ABORTED/TERMINATED` to be entered after return.

## Implementation scope

Implement all applicable requirements from `CODEX_PROMPT_REQUEST_APP_V0.2.md`, but where v0.2 conflicts with the hands-free rule, v0.3 and `MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md` take precedence.

Continue to use:

- local-only architecture;
- Node.js 22+ / minimal dependencies;
- JSON / JSONL only;
- no database;
- SHA-256 append-only event chain;
- deterministic stereo WAV generation;
- RNG calibration;
- REQUEST / READ / temporal / exact-token modes;
- strict lock/reveal state machine;
- no hidden output before reveal.

## Required additional state/events

Add events/state fields for:

- `request_assigned_pre_session`;
- `request_memory_confirmed`;
- `session_start_pressed`;
- `hands_free_mode_entered`;
- `cue_request_start`;
- `cue_release`;
- `target_generated`;
- `cue_return`;
- `participant_return_confirmed`;
- `request_value_forgotten`;
- `session_aborted_physical`;
- `raw_report_locked`;
- `reveal`.

## Required tests

In addition to v0.2 tests, verify:

1. requested value exists and is committed before START;
2. requested value cannot change after START;
3. normal active-session progression requires zero screen interactions;
4. target generation occurs automatically on schedule;
5. cue events are deterministic and timestamped;
6. output remains hidden throughout hands-free mode;
7. post-return navigation goes to raw report before reveal;
8. reveal is rejected before raw-report lock;
9. forgotten-request trials remain preserved and are excluded only by declared rule;
10. physical-abort trials remain preserved.

Before finishing, run tests and report exactly what was implemented and any deviation from the repository protocols.