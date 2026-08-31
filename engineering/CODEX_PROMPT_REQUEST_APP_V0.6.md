# Codex Prompt — MIP Config-Driven Research Engine v0.6

Implement the local MIP research application in `rezamr/MIP`.

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
12. `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
13. `protocols/MIP_NUM_REQUEST_V0.1.md`
14. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
15. `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
16. `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`
17. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
18. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
19. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
20. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
21. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.1.md`
22. `engineering/CODEX_PROMPT_REQUEST_APP_V0.5.md`

Where v0.6 conflicts with earlier Codex prompts, v0.6 takes precedence. Preserve earlier prompt files as project history.

## Primary architectural objective

Do **not** build a one-off application hardcoded to the current binary/immediate experiment.

Build one small, auditable, local research engine whose experiment behavior is selected through validated, versioned JSON configuration.

The current first participant experiment is only one profile.

The application must be able to switch, without editing experiment-engine source code, among examples such as:

- request `1` now;
- request `1` on the next eligible machine output;
- request `1` five minutes after request completion;
- request `1` tomorrow at 10:00 local time;
- request a value during a fixed time window;
- use system-assigned requests;
- use participant-selected pre-session requests;
- use binary, finite integer, enum/symbol, or exact-token outcome spaces;
- use different supported audio recipes;
- use different stage durations/cue schedules;
- use per-session or block-level reveal;
- use different pre/request/post analysis windows.

Future-proofing must come from a **small stable set of configuration primitives**, not from overengineering.

## Hard scope limits

Keep the implementation local-computer only.

Do NOT implement:

- Android packaging;
- phone application shells;
- phone-to-computer control;
- cloud services;
- user accounts;
- synchronization;
- SQL/SQLite/MongoDB or any database;
- plugin marketplaces;
- arbitrary runtime code loading;
- a custom scripting language;
- a large workflow designer;
- generative AI as a runtime dependency.

Bluetooth may be used only through the operating system as normal audio output to headphones.

## Technology preference

Prefer:

- Node.js 22+;
- ECMAScript modules;
- built-in platform libraries where practical;
- minimal dependencies;
- plain local HTML/CSS/JavaScript interface;
- local server bound to `127.0.0.1`;
- JSON/JSONL persistence only.

Keep the codebase small enough to audit manually.

---

# Required architecture

Implement `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.1.md` as a hard architecture requirement.

Separate:

1. stable research engine code;
2. versioned configuration registries;
3. experiment profiles;
4. immutable per-session configuration snapshots;
5. append-only event log;
6. raw machine-output data;
7. raw participant report;
8. deterministic analysis/report generation.

No committed session may depend on mutable global configuration after commitment.

At commitment, resolve the selected experiment profile into one effective configuration, copy it into the session directory, and hash the complete snapshot.

---

# Configuration registries

Use a clear filesystem structure, for example:

```text
data/
  config/
    schemas/
    profiles/
    outcome_spaces/
    request_assignment_policies/
    timing_policies/
    machine_output_policies/
    rng_providers/
    session_protocols/
    audio_recipes/
    analysis_plans/
    reveal_policies/
    reporting_profiles/
  sessions/
  calibration/
  audio/
```

Exact organization may be adjusted for simplicity, but preserve separation and versioning.

Every configuration object must contain:

- stable ID;
- schema version;
- human-readable name;
- status/usage label where relevant;
- parameters;
- deterministic validation.

Do not silently mutate a previously used configuration object.

---

# Experiment profile

The experiment profile is the main selectable unit.

It references the chosen:

- request-assignment policy;
- outcome space;
- timing policy;
- machine-output policy;
- random-source provider;
- hands-free session protocol;
- audio recipe or audio assignment pool;
- analysis plan;
- reveal policy;
- reporting profile.

Implement profile loading, validation, duplication, versioning, selection, and immutable session snapshotting.

The UI must show a concise effective-profile summary before commitment.

---

# Request-assignment policies

Implement at minimum:

### `SYSTEM_RANDOM_UNIFORM`

Uniformly choose the requested value from the declared outcome space.

### `SYSTEM_BALANCED_BLOCK`

Use a predeclared balanced/randomized request schedule for a block.

### `PARTICIPANT_MANUAL_PRESESSION`

Participant chooses the request before session commitment.

### `FIXED_PROFILE_VALUE`

Fixed profile-defined request for dry/debug/specialized use.

### `IMPORTED_MANIFEST`

Load request assignments from a precommitted manifest.

The current first-use profile uses system-random binary assignment.

Do not hardcode `{0,1}` into the request engine.

---

# Outcome spaces

Implement at minimum:

### `BINARY`

`{0,1}`.

### `INTEGER_RANGE`

Uniform finite integer range.

### `ENUM_SET`

Explicit finite list of strings/symbols/labels.

### `EXACT_TOKEN_SPACE`

Uniform finite index with deterministic one-to-one human-readable token mapping.

Store declared outcome-space size and exact-match null probability where defined.

Default scientific configurations should use uniform sampling.

No fuzzy matching for the primary endpoint.

---

# Timing engine

Timing is a configuration primitive and must not be hardcoded to the first profile.

Implement at minimum:

### `IMMEDIATE_REQUEST`

The primary request region begins at a named request event/cue.

Current participant-facing semantics can be equivalent to:

`make the requested outcome happen now`.

### `NEXT_ELIGIBLE_OUTPUT`

Score the first predeclared eligible output after a named anchor event.

### `RELATIVE_DELAY`

Target occurs a configured duration after a named anchor.

Support seconds, minutes, hours, and days.

Example: `5 minutes after request end`.

### `ABSOLUTE_DATETIME`

Target occurs at a specific date/time.

UI must support local date/time input and preserve timezone/offset, then commit authoritative UTC.

Example: `tomorrow at 10:00 local time`.

### `ABSOLUTE_WINDOW`

Explicit start/end date-time window.

### `RELATIVE_WINDOW`

Window relative to a named anchor.

### `CONTINUOUS_AROUND_REQUEST`

Hidden stream begins before request and continues during/after request for temporal onset/persistence analysis.

### `PREGENERATED_HIDDEN`

Hidden outcome exists and is committed before participant request; reveal remains locked.

The first participant profile may use immediate timing, but **do not remove or defer implementation of relative and absolute timing**.

The acceptance tests must prove all three: immediate, relative-delay, and absolute-date-time profiles execute through the same engine without source-code forks.

---

# Named timing anchors

Use named events, not hardcoded stage indexes.

Support at minimum:

- session commitment;
- session start;
- audio start;
- request cue;
- request start;
- request end;
- release start;
- release end;
- target start/event;
- target end;
- return cue;
- participant return;
- raw-report lock;
- reveal.

Store UTC and monotonic timestamps as appropriate.

---

# Machine-output policies

Implement at minimum:

### `SINGLE_OUTCOME`

One target outcome.

### `FIXED_LENGTH_STREAM`

Exactly N outcomes.

### `CONTINUOUS_STREAM`

Fixed rate/block stream over a declared interval.

### `WINDOWED_STREAM`

Predeclared named windows such as pre-request, request, immediate-post, later-post.

All count/rate/window values are configuration, not hardcoded constants.

Normal MIP modes use fixed declared lengths/windows with no optional stopping.

A historical sequential mode may be implemented later/optionally only as an explicitly separate policy.

---

# Random-source provider interface

Keep random generation behind a provider interface.

Implement initially:

- operating-system cryptographic provider;
- deterministic seeded test provider.

The interface must support future physical providers without changing experiment-profile semantics.

Use unbiased sampling for finite outcome spaces.

Never use naive modulo reduction where it creates bias.

---

# Config-driven hands-free session protocol

Do not hardcode the current session sequence into business logic.

Represent the active protocol as an ordered versioned configuration of stages.

Each stage must support appropriate fields such as:

- stage ID;
- type;
- duration or completion rule;
- cue start/end;
- hands-free flag;
- emitted named timing anchors;
- audio behavior;
- telemetry behavior;
- participant instruction text for documentation/pre-session review.

The current hands-free protocol must be shipped as the first session-protocol configuration.

After START, its normal path requires zero device interaction until return.

The engine must allow stage durations and cue placement to change by creating a new protocol configuration, without rewriting session-engine code when existing primitives are sufficient.

---

# Audio engine

Implement the existing layered synthesis requirements from `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`.

Audio must also be configuration-driven.

An audio recipe can use already-supported primitives such as:

- left/right carrier components;
- binaural differences;
- multiple carriers;
- amplitude envelope;
- amplitude modulation;
- frequency modulation;
- masking noise;
- patent-grounded phased/swept noise;
- cue layers;
- fades;
- final normalization/headroom.

Adding a new combination of already-supported layers must require only a new audio recipe configuration.

A genuinely new DSP primitive may require code.

Store and hash:

- exact recipe snapshot;
- synthesis algorithm versions;
- seed where applicable;
- generated WAV;
- manifest;
- final file hash.

Maintain historical/provenance labels exactly as required by the repository.

Never call a reconstruction an exact historical Gateway/CENTER LANE waveform unless the repository has source-verified all material parameters.

---

# Continuous telemetry

Implement `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`.

For stream/temporal profiles, preserve enough ordered time-series data to reproduce the machine-output timeline exactly.

Log at minimum:

- all named stage/cue events;
- request anchors;
- output events/blocks;
- target/window boundaries;
- return events;
- report lock;
- reveal.

Compute deterministic telemetry declared by the analysis plan, including where selected:

- cumulative requested-direction deviation;
- fixed-window deviation;
- threshold crossings;
- sustained crossing;
- exploratory change point;
- peak deviation time;
- sustained-deviation duration;
- return-to-baseline estimate;
- offsets from request/release/target anchors.

The raw timeline always remains primary evidence.

---

# Subjective-time handling

The current first-use protocol must collect subjective time **before displaying actual elapsed time**.

Capture at minimum:

- estimated total session duration;
- estimated request-to-return duration;
- compressed/expanded/discontinuous/ordinary time impression;
- confidence.

Then keep actual machine timing separate.

Do not use subjective time as authoritative machine timing.

---

# Analysis-plan registry

Analysis behavior must be versioned configuration.

Each analysis plan declares:

- primary endpoint;
- secondary endpoints;
- primary window;
- exploratory windows;
- scoring rules;
- exact-match rules;
- stream-window sizes;
- threshold definitions;
- sustained-crossing rule;
- change-point algorithm/version;
- exclusions;
- forgotten-request handling;
- aborted-session handling;
- multiplicity rule where needed.

The software may provide generic diagnostics, but must label them exploratory.

Never redefine the primary timing region after seeing results.

---

# Reveal policy

Implement at minimum:

- after raw-report lock;
- after block lock;
- delayed until configured date/time.

Output must remain unavailable before the selected reveal policy permits it.

---

# Deterministic reporting

Generate reports from the locked profile snapshot, raw event log, machine output, raw participant report, and versioned analysis plan.

Support modules for:

- effective configuration/profile summary;
- request assignment;
- session/cue timeline;
- audio manifest;
- exact outcome;
- stream statistics;
- temporal windows;
- onset/latency/persistence analysis;
- subjective-versus-actual time;
- integrity/hash validation;
- same-profile cross-session comparison.

Do not use generative AI for the primary analytical report.

---

# Small profile editor

Build a deliberately simple local profile/configuration editor.

It must allow the user to:

- create a new profile by duplicating an existing profile;
- change request-assignment policy;
- change outcome space;
- choose timing mode;
- configure `now`, relative delay, or absolute date/time parameters;
- choose machine-output policy;
- choose RNG provider;
- choose session protocol;
- choose one audio recipe or an audio assignment pool;
- choose analysis plan;
- choose reveal policy;
- validate;
- save as a new versioned profile;
- inspect the final effective configuration before commitment.

Do not build drag-and-drop workflow tooling.

Provide a read-only/raw JSON view for auditability; an advanced editable JSON view is optional if validation is strict.

---

# Configuration validation

Reject invalid profiles before commitment.

Test at least:

- unknown referenced IDs;
- request not valid for outcome space;
- absolute time lacking timezone/offset;
- analysis window outside generated telemetry coverage;
- stream analysis with single-output-only policy;
- unsupported audio primitive;
- reveal before required raw-report lock;
- contradictory stage/timing anchors;
- invalid finite outcome-space size;
- invalid profile/schema version.

Errors must be specific and visible before START.

---

# Session immutability and event chain

Use append-only JSONL events with SHA-256 chaining.

At commitment:

- resolve effective profile;
- snapshot all referenced configuration;
- write hashes;
- lock material request/timing/audio/protocol fields for that session.

After raw-report lock:

- raw participant report cannot be rewritten;
- late notes are new append-only events;
- reveal is a new event;
- analytical report is reproducible from stored data.

Preserve misses, aborted sessions, and forgotten-request trials.

---

# Required shipped profiles

Ship at least the following profiles to prove configuration-driven timing:

## `BASELINE_NOW_BINARY_V1`

- system-random `{0,1}` request;
- request known/memorized before induction;
- hands-free current session protocol;
- participant-facing request means `now`;
- continuous hidden stream before/during/after request;
- raw report before reveal;
- subjective-time estimate before actual time display.

This is the first intended participant profile.

## `DRY_RELATIVE_5MIN_BINARY_V1`

Same core components, but machine timing uses a five-minute relative delay from a named request anchor.

This can remain a dry/test profile initially.

## `DRY_ABSOLUTE_TIME_BINARY_V1`

Same core components, but target time is an explicit configured local date/time converted to UTC at commitment.

This can remain a dry/test profile initially.

The latter two profiles exist to prove future timing changes do not require code rewrites.

---

# Required future-proofing acceptance tests

The build is **not complete** unless all of the following can be demonstrated without editing experiment-engine source code:

1. switch current profile from immediate to a five-minute relative delay;
2. create/select an absolute-date-time profile such as tomorrow at 10:00 local time;
3. switch from binary to four equiprobable integer outcomes using an existing outcome-space primitive;
4. switch request assignment from system-random to participant-selected pre-session;
5. swap to another supported audio recipe;
6. change a protocol stage duration and save as a new protocol/profile version;
7. change reveal from session-level to block-level;
8. change analysis-window widths;
9. reopen an old session and verify its original configuration snapshot after current defaults/configs have changed.

Source-code change is acceptable only for a genuinely new primitive/provider/DSP operation/analysis algorithm.

---

# Existing functional requirements that remain mandatory

Do not lose earlier v0.5 functionality:

- hands-free active session;
- request preassignment/memory confirmation;
- deterministic cues;
- exact timing logs;
- RNG calibration;
- single-outcome and stream modes;
- READ modes already specified;
- pre-generated hidden mode already specified;
- exact-token capability already specified;
- continuous sequence telemetry;
- phased-pink reconstruction capability with provenance limits;
- raw report before reveal;
- deterministic analytical report;
- JSON/JSONL storage only;
- cryptographic hashes;
- no mobile/cloud/database scope.

---

# Tests

Write automated tests for at least:

## Configuration

- schema validation;
- profile reference resolution;
- effective-config snapshot reproducibility;
- immutable used-profile behavior;
- old-session compatibility;
- invalid-config rejection.

## Timing

- immediate timing;
- next-eligible timing;
- relative five-minute timing using fake clock;
- absolute local-time to UTC conversion;
- scheduled vs actual timestamp logging;
- continuous pre/request/post windows;
- named-anchor resolution.

## Outcome/request

- uniform request assignment;
- balanced block assignment;
- manual pre-session assignment;
- binary sampling;
- integer-range unbiased sampling;
- enum-set sampling;
- token bijection/exact scoring.

## Session engine

- hands-free progression requires zero normal screen actions after START;
- stage duration from configuration;
- cue placement from configuration;
- request/timing fields immutable after commitment;
- abort/forgotten states preserved;
- reveal policy enforced.

## Audio

Use all tests already required by `AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`.

## Telemetry/report

- event timestamp ordering;
- hash-chain integrity;
- deterministic trend statistics;
- primary-window immutability;
- deterministic report reproduction;
- subjective-time field captured before actual-duration exposure in the first profile.

---

# Completion checklist

Before declaring v0.6 ready:

1. run all automated tests;
2. validate all shipped configuration objects;
3. generate and hash enabled audio recipes;
4. produce one calibration bundle;
5. run a dry `BASELINE_NOW_BINARY_V1` session;
6. run a dry relative-delay session;
7. run a dry absolute-time session;
8. show that all three use the same engine code;
9. generate deterministic analytical reports;
10. verify all hashes and config snapshots;
11. document how to create a new experiment profile without code changes;
12. document exactly which changes still require source-code work;
13. provide one simple local-computer run procedure;
14. list all unsupported/approximate historical audio parameters;
15. do not implement Android/mobile/cloud/database work;
16. do not run a real participant session until the dry-run bundles have been reviewed.

## Final implementation report

When finished, report clearly:

- architecture implemented;
- configuration registries implemented;
- shipped profiles;
- tests passed/failed;
- deviations from the specifications;
- unsupported primitives;
- historical-audio approximations;
- exact commands to run locally;
- exact path to dry-run session bundles.

Do not silently alter research protocols to make implementation easier. If a specification is contradictory or technically impossible, stop and document the conflict instead of guessing.
