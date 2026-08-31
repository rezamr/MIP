# MIP Active Implementation Authority v0.1

## Status

`ACTIVE — IMPLEMENTATION AUTHORITY`

## Purpose

This file exists to remove ambiguity before implementation and revision work. MIP has accumulated historical protocols, earlier engineering specifications, and multiple Codex prompts. Older documents remain valuable project history, but implementation agents must not merge mutually incompatible instructions from different generations.

## Core rule

When two files disagree, do not improvise a compromise.

Use the precedence below. Preserve the older file unchanged as history unless a separately versioned replacement is explicitly created.

## Precedence order for software implementation

From highest to lower authority:

1. `engineering/CODEX_PROMPT_REQUEST_APP_V1.1.md`
2. this file: `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
3. `engineering/LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md`
4. `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
5. `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md`
6. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
7. `engineering/REQUEST_TEST_APP_SPEC_V0.2.md`
8. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
9. `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
10. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
11. `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md` where not superseded by the live-audio runtime requirement
12. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
13. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md` where not superseded by the session-data requirement
14. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
15. active protocol files listed below
16. older engineering specifications and older Codex prompts for historical context only.

Scientific evidence rules in `04_EVIDENCE_STANDARD.md` always remain binding. Research conclusions cannot be upgraded by software implementation wording or by visual presentation.

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

### 1. First baseline timing

Current first participant baseline = `IMMEDIATE_REQUEST` with a continuous hidden stream around the request.

Participant-facing wording must not require an absolute wall-clock target time.

Relative-delay and absolute-date-time modes remain implemented in the engine as separate selectable profiles.

### 2. State stabilization

The first hands-free baseline is timer/cue driven after START. It does not require the participant to press a button to announce that the state is stable.

Any older wording that requires interaction with the device during active induction is superseded for the first hands-free profile.

### 3. END SESSION control

The participant must always be physically able to terminate by opening eyes/removing headphones/reorienting.

A visible software stop control may exist as an optional convenience, but safe termination must not depend on operating it while altered.

### 4. Application language and UI quality

The application UI is English-only.

All visible user-facing text, reports, chart labels, validation errors, configuration screens, Audio Lab screens, session workflow, and status messages must be English.

The build must implement `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md` and is not complete merely because required routes/forms technically exist.

UI/UX polish must never hide scientific warnings, exploratory status, protocol deviations, integrity failures, aborted sessions, or historical-provenance uncertainty.

### 5. Active audio runtime model

The active audio model is live deterministic synthesis.

Audio Lab and formal research sessions use one shared stateful synthesis library that generates audio continuously from a versioned recipe.

The required model is:

`frozen deterministic recipe + frozen seed/state/version + live stateful synthesis + runtime stream digest/logging`

A persistent WAV or other complete pre-rendered full-session file is optional and is not required for ordinary playback or formal START eligibility.

Optional rendering/export remains valid for QA, spectral verification, regression fixtures, troubleshooting, external analysis, or explicit archival needs.

Where `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md` mandates a pre-rendered full-session file as the formal playback mechanism, that requirement is superseded by `engineering/LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md`.

All synthesis capability, provenance, historical-exactness, and unknown-parameter restrictions from the older file remain in force.

### 6. Audio preset semantics

`A-U396-4` = MIP user baseline using the current documented centered calculation: L=394 Hz, R=398 Hz, center=396 Hz, beat=4 Hz.

`A-P100-104` = explicit documented patent pair L=100 Hz, R=104 Hz. Its arithmetic center is 102 Hz. Do not reinterpret this preset through centered-396 quick-template logic.

`A-SHAM-0` = first matched control L=396 Hz, R=396 Hz.

These simple pairs are component-isolation conditions. They must not be mislabeled as complete Army/CENTER LANE Hemi-Sync environments.

### 7. Historical program provenance for audio versus machine perturbation

Do not conflate the 1979–1980 Army/SRI Remote Perturbation experiment with the Monroe/Gateway/CENTER LANE Hemi-Sync audio program.

Remote Perturbation is a REQUEST/INFLUENCE precedent for machine-output testing. Hemi-Sync reconstruction comes from Monroe/Gateway/CENTER LANE audio evidence and later Monroe engineering sources.

### 8. Historical Hemi-Sync exactness gate

The engine must implement the layered signal primitives required by the active audio requirements.

Current reported CENTER LANE anchors `100 Hz base + 1.5 Hz binaural beat` and `200 Hz base + 4 Hz binaural beat` remain incomplete historical candidates until primary-source semantics are verified.

The application must not infer opposite-ear frequency, centered-pair architecture, simultaneous use, relative level, phase, modulation, noise, sequencing, or timing when those values are not source-verified.

### 9. Machine state versus participant representation

Objective machine state, participant-facing label/mapping, internal request-encoding profile, and scoring endpoint are separate objects.

Older binary examples do not authorize hardcoding literal digits into the engine.

### 10. Session/trial hierarchy

For the first baseline, one Communication Session contains one primary REQUEST trial. The software architecture must preserve separate `session_id` and `trial_id` fields so later protocols can contain multiple trials without schema breakage.

Blocks group multiple sessions/trials for balanced assignment, block-level reveal, and cross-session analysis.

### 11. Session storage and historical repository records

Top-level repository directory `sessions/` contains durable MIP project/session documentation.

Application runtime evidence is stored under the application runtime data root, not silently written over top-level historical Markdown records.

### 12. Logging authority

`events.jsonl` is the authoritative append-only session event chain.

Raw machine output may live in a separate lossless file for volume reasons, but each machine-output record/block must be cryptographically linked into the session evidence by hash references and final bundle hashes.

Mutable UI caches, indexes, or drafts are never primary evidence.

### 13. Raw report lock

A participant report may be autosaved as a clearly marked mutable draft before lock.

At lock, create an immutable `raw_report.json` snapshot, record its hash in the event chain, and prohibit in-place edits.

Later additions are append-only `late_recollection` or `late_note` events.

### 14. Reveal

Reveal policy is enforced server-side, not merely by hiding a button.

Before reveal eligibility, hidden outputs must not be returned by any participant-facing API, page, report preview, debug route, URL field, browser payload, or client-side state.

### 15. Scheduling

Multi-minute/hour/day and absolute-time modes are configuration capabilities, not a claim that a normal desktop OS provides laboratory-grade unattended timing.

The application must log scheduled time, scheduler wake time, actual generation time, monotonic/wall-clock discontinuity, and lateness.

If the application is stopped, the computer sleeps, or the target is missed beyond profile tolerance, preserve the trial and mark the timing protocol deviation. Never silently generate a replacement outcome and pretend it occurred on time.

### 16. First baseline endpoint

The first operational immediate profile uses continuous hidden stream telemetry around the request as the main temporal characterization path.

A single-outcome/next-eligible companion endpoint may be configured separately if declared before data inspection.

Do not silently substitute the best post-hoc stream window for the declared primary region.

## Older Codex prompts

`CODEX_PROMPT_REQUEST_APP_V0.1.md` through `V1.0.md` remain project history and implementation ancestry.

For new implementation/revision work, only `V1.1` is active.

## Implementation ambiguity rule

If a mandatory requirement remains genuinely ambiguous after applying this authority file, the implementation agent must:

1. identify the exact conflicting files/clauses;
2. avoid silently choosing the most convenient interpretation;
3. implement unaffected components;
4. record the blocked decision in its completion report;
5. make no scientific/protocol assumption that changes experiment meaning without an explicit versioned decision.