# MIP Active Implementation Authority v0.1

## Status

`ACTIVE — PRE-CODE IMPLEMENTATION AUTHORITY`

## Purpose

This file exists to remove ambiguity before implementation. MIP has accumulated historical protocols, earlier engineering specifications, and multiple Codex prompts. Older documents remain valuable project history, but Codex must not merge mutually incompatible instructions from different generations.

This file defines the active implementation authority for the first local MIP research application.

## Core rule

When two files disagree, do not improvise a compromise.

Use the precedence below. Preserve the older file unchanged as history unless a separately versioned replacement is explicitly created.

## Precedence order for software implementation

From highest to lower authority:

1. `engineering/CODEX_PROMPT_REQUEST_APP_V0.8.md`
2. this file: `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
3. `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
4. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
5. `engineering/REQUEST_TEST_APP_SPEC_V0.2.md`
6. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
7. `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
8. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
9. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
10. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md` where not superseded by the session-data v0.1 file above
11. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
12. active protocol files listed below
13. older engineering specifications and older Codex prompts for historical context only.

Scientific evidence rules in `04_EVIDENCE_STANDARD.md` always remain binding. Research conclusions cannot be upgraded by software implementation wording.

## Active first-operational protocol files

For the first participant-facing REQUEST baseline, use:

- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
- `protocols/REQUEST_ENCODING_V0.2.md`
- `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
- `protocols/MIP_NUM_REQUEST_V0.2.md`
- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`

The following older versions remain historical and are **not** the current first-use participant protocol:

- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.1.md`
- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md`
- `protocols/REQUEST_ENCODING_V0.1.md`
- `protocols/MIP_NUM_REQUEST_V0.1.md`

## Explicit conflict resolutions

### 1. First baseline timing

Current first participant baseline = `IMMEDIATE_REQUEST` with a continuous hidden stream around the request.

Participant-facing wording must not require an absolute wall-clock target time.

Older wording such as:

`At the predefined target time, the system output is X.`

is superseded for the first immediate profile by timing-neutral/immediate wording defined in `REQUEST_ENCODING_V0.2.md` and `IMMEDIATE_REQUEST_TIMING_V0.1.md`.

Relative-delay and absolute-date-time modes remain implemented in the engine as separate selectable profiles.

### 2. State stabilization

The first hands-free baseline is timer/cue driven after START. It does not require the participant to press a button to announce that the state is stable.

Any older wording that says the participant must interact with the device during active induction is superseded for the first hands-free profile.

The participant may later report that stabilization was poor; this is recorded as data/protocol quality, not corrected by mid-session screen interaction.

### 3. END SESSION control

The participant must always be physically able to terminate by opening eyes/removing headphones/reorienting.

A visible software stop control may exist as an optional convenience, but successful protocol completion and safe termination must not depend on operating it while altered.

Older UI wording that appears to require an `END SESSION` button during active trance is not a mandatory interaction.

### 4. Audio Lab versus research-session audio

Audio Lab can play indefinitely, pause, resume, stop, and use temporary custom parameters.

A committed research session cannot use an unsaved temporary Audio Lab state and cannot change audio parameters after commitment.

Formal session audio is frozen, versioned, manifested, and hashed.

### 5. Audio preset semantics

`A-U396-4` = MIP user baseline using the current documented centered calculation: L=394 Hz, R=398 Hz, center=396 Hz, beat=4 Hz.

`A-P100-104` = explicit documented patent pair L=100 Hz, R=104 Hz. Its arithmetic center is 102 Hz. Do not reinterpret this preset through the centered-396 quick-template logic.

`A-SHAM-0` = first matched control L=396 Hz, R=396 Hz.

### 6. Machine state versus participant representation

Objective machine state, participant-facing label/mapping, internal request-encoding profile, and scoring endpoint are separate objects.

Older binary examples do not authorize hardcoding literal digits into the engine.

### 7. Session/trial hierarchy

For the first baseline, one Communication Session contains one primary REQUEST trial. The software architecture must nevertheless preserve separate `session_id` and `trial_id` fields so later protocols can contain multiple trials without schema breakage.

Blocks group multiple sessions/trials for balanced assignment, block-level reveal, and cross-session analysis.

### 8. Session storage and historical repository records

Top-level repository directory `sessions/` contains durable MIP project/session documentation.

Application runtime evidence is stored under the application runtime data root, not silently written over top-level historical Markdown records.

The application may generate an explicit export/import summary for later repository documentation, but must not automatically publish or push runtime session data.

### 9. Logging authority

`events.jsonl` is the authoritative append-only session event chain.

Raw machine output may live in a separate lossless file for volume reasons, but each machine-output record/block must be cryptographically linked into the session evidence by hash references and final bundle hashes.

Mutable UI caches, indexes, or drafts are never primary evidence.

### 10. Raw report lock

A participant report may be autosaved as a clearly marked mutable draft before lock.

At lock, create an immutable `raw_report.json` snapshot, record its hash in the event chain, and prohibit in-place edits.

Later additions are append-only `late_recollection` or `late_note` events.

### 11. Reveal

Reveal policy is enforced server-side, not merely by hiding a button.

Before reveal eligibility, hidden outputs must not be returned by any participant-facing API, page, report preview, debug route, URL field, browser payload, or client-side state.

### 12. Scheduling

Multi-minute/hour/day and absolute-time modes are configuration capabilities, not a claim that a normal desktop OS provides laboratory-grade unattended timing.

The application must log scheduled time, scheduler wake time, actual generation time, monotonic/wall-clock discontinuity, and lateness.

If the application is stopped, the computer sleeps, or the target is missed beyond the profile tolerance, preserve the trial and mark the timing protocol deviation. Never silently generate a replacement outcome and pretend it occurred on time.

### 13. First baseline endpoint

The first operational immediate profile uses continuous hidden stream telemetry around the request as the main temporal characterization path.

A single-outcome/next-eligible companion endpoint may be configured separately if declared before data inspection.

Do not silently substitute the best post-hoc stream window for the declared primary region.

## Older Codex prompts

`CODEX_PROMPT_REQUEST_APP_V0.1.md` through `V0.7.md` remain project history.

For new implementation work, only `V0.8` is active.

## Implementation ambiguity rule

If a mandatory requirement remains genuinely ambiguous after applying this authority file, Codex must:

1. identify the exact conflicting files/clauses;
2. avoid silently choosing the most convenient interpretation;
3. implement unaffected components;
4. record the blocked decision in its completion report;
5. make no scientific/protocol assumption that changes the meaning of the experiment without an explicit versioned decision.
