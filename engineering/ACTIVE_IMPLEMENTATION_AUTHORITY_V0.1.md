# MIP Active Implementation Authority v0.1

## Status

`ACTIVE — IMPLEMENTATION AUTHORITY`

## Purpose

This file removes ambiguity for implementation and revision work. MIP contains historical protocols, earlier engineering specifications, multiple deployment generations, and multiple Codex prompts. Older documents remain valuable project history, but implementation agents must not merge incompatible generations.

## Core rule

When two files disagree, do not improvise a compromise.

Use the precedence below. Preserve older files unchanged as history unless a separately versioned replacement is explicitly created.

## Precedence order for software implementation

From highest to lower authority:

1. `engineering/CODEX_PROMPT_REQUEST_APP_V1.2.md`
2. this file: `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
3. `engineering/ELECTRON_DESKTOP_ARCHITECTURE_V0.1.md`
4. `engineering/AUDIOWORKLET_REALTIME_AUDIO_REQUIREMENTS_V0.1.md`
5. `engineering/SQLITE_EVIDENCE_STORAGE_REQUIREMENTS_V0.1.md`
6. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.2.md`
7. `engineering/LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md` where not superseded by the AudioWorklet requirement
8. `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md` where storage-format/browser-server details are not superseded by SQLite/Electron requirements
9. `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md`
10. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
11. `engineering/REQUEST_TEST_APP_SPEC_V0.2.md` where deployment/server/storage details are not superseded by v1.2
12. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
13. `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
14. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
15. `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md` where not superseded by live-audio requirements
16. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
17. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md` where not superseded by the active session-data/storage requirements
18. active protocol files listed below
19. older deployment decisions, engineering specifications, and Codex prompts for historical context only.

Scientific evidence rules in `04_EVIDENCE_STANDARD.md` always remain binding. Research conclusions cannot be upgraded by software implementation wording or visual presentation.

## Active first-operational protocol files

For the first participant-facing REQUEST baseline, use:

- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
- `protocols/REQUEST_ENCODING_V0.2.md`
- `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
- `protocols/MIP_NUM_REQUEST_V0.2.md`
- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`

The following older versions remain historical and are not the current first-use participant protocol:

- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.1.md`
- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md`
- `protocols/REQUEST_ENCODING_V0.1.md`
- `protocols/MIP_NUM_REQUEST_V0.1.md`

## Explicit conflict resolutions

### 1. Deployment model

The active production application is a packaged Electron desktop application.

The normal owner workflow must not require a browser, localhost URL, or local HTTP server.

Older browser + `127.0.0.1` production requirements are superseded by:

- `engineering/ELECTRON_DESKTOP_ARCHITECTURE_V0.1.md`;
- `engineering/DEPLOYMENT_SCOPE_DECISION_V0.2.md`.

Development tooling may still use a dev server if required by the build stack, but the packaged product must not depend on it.

### 2. Runtime database/storage

SQLite is the authoritative runtime datastore for new Electron sessions.

Older requirements that make JSON/JSONL files the primary runtime evidence store are superseded by:

`engineering/SQLITE_EVIDENCE_STORAGE_REQUIREMENTS_V0.1.md`

The underlying evidence semantics remain mandatory:

- append-only primary evidence;
- cryptographic hash chaining;
- immutable commitments;
- immutable locked raw reports;
- lossless machine output;
- crash recovery;
- integrity verification.

JSON/JSONL remains valid as an export/import/archive format and for legacy migration.

### 3. Reveal authority

Older wording that says `server-side reveal gate` maps in the Electron generation to an authoritative **Electron main-process reveal gate**.

The renderer must not receive hidden objective/result data before reveal eligibility.

### 4. First baseline timing

Current first participant baseline = `IMMEDIATE_REQUEST` with a continuous hidden stream around the request.

Participant-facing wording must not require an absolute wall-clock target time.

Relative-delay and absolute-date-time modes remain implemented in the engine as separate selectable profiles.

### 5. State stabilization

The first hands-free baseline is timer/cue driven after START. It does not require the participant to press a button to announce that the state is stable.

Any older wording that requires interaction with the device during active induction is superseded for the first hands-free profile.

### 6. END SESSION control

The participant must always be physically able to terminate by opening eyes/removing headphones/reorienting.

A visible software stop control may exist as an optional convenience, but safe termination must not depend on operating it while altered.

### 7. Application language and UI quality

The application UI is English-only.

All visible user-facing text, reports, chart labels, validation errors, configuration screens, Audio Lab screens, session workflow, and status messages must be English.

The build must implement `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md` and is not complete merely because required screens technically exist.

UI/UX polish must never hide scientific warnings, exploratory status, protocol deviations, integrity failures, aborted sessions, or historical-provenance uncertainty.

### 8. Active real-time audio model

The active audio model is live deterministic synthesis through AudioWorklet.

The required model is:

`frozen deterministic recipe + frozen seed/state/version + AudioWorklet live stateful synthesis + cryptographic stream digest/telemetry`

`ScriptProcessorNode`, `createScriptProcessor`, and `onaudioprocess` are not acceptable active playback mechanisms for the Electron desktop generation.

Audio Lab and formal research sessions must use the same synthesis semantics.

A persistent WAV or complete pre-rendered full-session file is optional and is not required for ordinary playback or formal START eligibility.

Optional rendering/export remains valid for QA, spectral verification, regression fixtures, troubleshooting, external analysis, or explicit archival needs.

Where `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md` mandates a pre-rendered full-session file as the formal playback mechanism, that requirement is superseded by the active live-audio requirements.

All synthesis capability, provenance, historical-exactness, and unknown-parameter restrictions from the older file remain in force.

### 9. Audio integrity digest

Formal generated-stream evidence uses a cryptographic digest such as SHA-256 over a documented canonical PCM representation.

A simple additive checksum, FNV/CRC-style checksum, or short custom 32-bit digest is not authoritative MIP audio evidence.

### 10. Audio preset semantics

`A-U396-4` = MIP user baseline using the current documented centered calculation: L=394 Hz, R=398 Hz, center=396 Hz, beat=4 Hz.

`A-P100-104` = explicit documented patent pair L=100 Hz, R=104 Hz. Its arithmetic center is 102 Hz. Do not reinterpret this preset through centered-396 quick-template logic.

`A-SHAM-0` = first matched control L=396 Hz, R=396 Hz.

These simple pairs are component-isolation conditions. They must not be mislabeled as complete Army/CENTER LANE Hemi-Sync environments.

### 11. Historical program provenance for audio versus machine perturbation

Do not conflate the 1979–1980 Army/SRI Remote Perturbation experiment with the Monroe/Gateway/CENTER LANE Hemi-Sync audio program.

Remote Perturbation is a REQUEST/INFLUENCE precedent for machine-output testing. Hemi-Sync reconstruction comes from Monroe/Gateway/CENTER LANE audio evidence and later Monroe engineering sources.

### 12. Historical Hemi-Sync exactness gate

The engine must implement the layered signal primitives required by the active audio requirements.

Current reported CENTER LANE anchors `100 Hz base + 1.5 Hz binaural beat` and `200 Hz base + 4 Hz binaural beat` remain incomplete historical candidates until primary-source semantics are verified.

The application must not infer opposite-ear frequency, centered-pair architecture, simultaneous use, relative level, phase, modulation, noise, sequencing, or timing when those values are not source-verified.

### 13. Machine state versus participant representation

Objective machine state, participant-facing label/mapping, internal request-encoding profile, and scoring endpoint are separate objects.

Older binary examples do not authorize hardcoding literal digits into the engine.

### 14. Formal randomness

Formal research-semantic randomness must use the configured RNG provider.

Production profiles use the OS cryptographic provider unless another provider is explicitly selected by a valid profile.

Deterministic seeded RNG is for tests/fixtures or explicitly labeled deterministic profiles.

`Math.random()` must not influence formal target assignment, machine output, reveal, scoring, timing, or other evidence-bearing research semantics.

### 15. Session/trial hierarchy

For the first baseline, one Communication Session contains one primary REQUEST trial. The software architecture must preserve separate `session_id` and `trial_id` fields so later protocols can contain multiple trials without schema breakage.

Blocks group multiple sessions/trials for balanced assignment, block-level reveal, and cross-session analysis.

### 16. Authoritative session execution

The Electron main process owns the formal session state machine and authoritative named-event timing.

The renderer is not the authoritative timer.

The application must not synchronously generate an entire future session stream inside a START request and then merely display a hands-free screen as if time were still executing.

Machine output, cues, audio anchors, and named events must follow the selected profile's actual timing semantics.

### 17. Raw report lock

A participant report may be autosaved as a clearly marked mutable draft before lock.

At lock, create an immutable locked evidence record, record its hash in the event chain, and prohibit in-place edits.

Later additions are append-only `late_recollection` or `late_note` records/events.

### 18. Scheduling and power behavior

Multi-minute/hour/day and absolute-time modes are configuration capabilities, not a claim that a desktop OS provides laboratory-grade unattended timing.

The application must log scheduled time, actual event/output time, monotonic/wall-clock discontinuity, and lateness.

During active formal sessions, Electron power-save blocking should prevent application suspension where appropriate and must itself be logged/verified.

If the app is stopped, the computer sleeps, or a target is missed beyond profile tolerance, preserve the trial and mark the timing protocol deviation. Never silently generate a replacement outcome and pretend it occurred on time.

### 19. First baseline endpoint

The first operational immediate profile uses continuous hidden stream telemetry around the request as the main temporal characterization path.

A single-outcome/next-eligible companion endpoint may be configured separately if declared before data inspection.

Do not silently substitute the best post-hoc stream window for the declared primary region.

## Older Codex prompts and deployment generations

`CODEX_PROMPT_REQUEST_APP_V0.1.md` through `V1.1.md` remain project history and implementation ancestry.

`DEPLOYMENT_SCOPE_DECISION_V0.1.md` remains project history.

For new implementation/revision work, `CODEX_PROMPT_REQUEST_APP_V1.2.md` and `DEPLOYMENT_SCOPE_DECISION_V0.2.md` are active.

## Implementation ambiguity rule

If a mandatory requirement remains genuinely ambiguous after applying this authority file, the implementation agent must:

1. identify the exact conflicting files/clauses;
2. avoid silently choosing the most convenient interpretation;
3. implement unaffected components;
4. record the blocked decision in its completion report;
5. make no scientific/protocol assumption that changes experiment meaning without an explicit versioned decision.
