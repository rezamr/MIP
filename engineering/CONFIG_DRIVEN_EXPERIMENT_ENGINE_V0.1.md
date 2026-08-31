# MIP Config-Driven Experiment Engine v0.1

## Status

`ARCHITECTURE DECISION — PRE-CODEX FREEZE`

## Purpose

The first MIP implementation must be a **small, stable research engine**, not a one-off application hardcoded for the current binary/immediate experiment.

The current operational profile may use:

- system-assigned `0/1`;
- an immediate request;
- a continuous hidden stream;
- the current audio comparison set.

But the engine must already be able to express future experiments such as:

- `make the output 1 now`;
- `make the output 1 in five minutes`;
- `make the output 1 at 10:00 tomorrow morning`;
- `favor 1 during a declared time window`;
- `make the next eligible output 1`;
- use larger numerical outcome spaces;
- use arbitrary symbols/tokens instead of only binary values;
- use different audio recipes;
- change protocol stage durations and cue schedules;
- change analysis windows and reveal rules;

These changes should normally require **configuration changes only**, not source-code edits.

The architecture goal is:

> stable code + versioned experiment profiles + immutable per-session configuration snapshots.

---

# Non-goal: overengineering

Do not build a generic plugin marketplace, scripting language, database-backed workflow system, mobile application, cloud service, or dynamic code loader.

The system should remain local, auditable, and easy to debug.

Future-proofing is achieved by a small set of stable experiment primitives represented in JSON, not by adding large frameworks.

---

# Core architecture rule

The engine must separate:

1. **research primitives** — stable code concepts;
2. **experiment profile** — versioned configuration selecting and parameterizing those primitives;
3. **session snapshot** — immutable copy of the exact profile/configuration used for one session;
4. **raw event log** — append-only machine/session events;
5. **analysis plan** — predeclared deterministic calculations;
6. **report** — generated from locked session data.

No historical session may depend on whatever the current global configuration happens to be later.

At session commitment, copy every effective configuration object into the session directory and hash it.

---

# Stable experiment primitives

## 1. Request-assignment policy

Support at minimum:

- `SYSTEM_RANDOM_UNIFORM`
  - system assigns requested value uniformly from the declared outcome space;
- `SYSTEM_BALANCED_BLOCK`
  - system uses a predeclared balanced/randomized block schedule;
- `PARTICIPANT_MANUAL_PRESESSION`
  - participant selects request before session commitment;
- `FIXED_PROFILE_VALUE`
  - profile declares one fixed value for debug or specialized experiments;
- `IMPORTED_MANIFEST`
  - requested values/times come from a precommitted external manifest.

The current baseline uses `SYSTEM_RANDOM_UNIFORM` over `{0,1}`.

Request assignment must never be hardcoded specifically to binary values in the core engine.

---

## 2. Outcome-space definition

Support a versioned outcome-space registry.

Required types:

### `BINARY`

Values `{0,1}`.

### `INTEGER_RANGE`

Uniform integer in `[min,max]` or `[0,N)` according to explicit schema.

### `ENUM_SET`

A declared finite set such as:

- colors;
- symbols;
- labels;
- arbitrary strings.

### `EXACT_TOKEN_SPACE`

Uniform index over a declared finite space with deterministic one-to-one display-token mapping.

Every outcome space must declare:

- ID;
- schema version;
- size;
- uniform/nonuniform status;
- mapping/version if a display representation is used;
- exact null probability for exact-match scoring when defined.

Default scientific modes should use uniform sampling.

Do not silently apply fuzzy matching.

---

## 3. Timing policy

Timing must be a first-class configurable primitive.

The engine must support all of the following without source-code modification:

### `IMMEDIATE_REQUEST`

Primary request region starts at the request cue/event.

Participant semantics example:

`Make the system output X now.`

### `NEXT_ELIGIBLE_OUTPUT`

Score the first predeclared eligible output after a specific protocol event, such as request completion or release.

### `RELATIVE_DELAY`

Target event/window occurs after a configurable delay from a named anchor event.

Examples:

- `5 seconds after request end`;
- `5 minutes after release`;
- `24 hours after session commitment`.

Fields include:

- anchor event;
- delay value;
- delay unit;
- target/window definition.

### `ABSOLUTE_DATETIME`

Target occurs at an explicit date/time.

Support:

- authoritative UTC storage;
- local date/time input with stored timezone/offset;
- conversion to UTC at commitment;
- exact scheduled vs actual execution timestamp.

Example user intent:

`tomorrow at 10:00 local time`.

### `ABSOLUTE_WINDOW`

Target is a fixed start/end date-time window.

### `RELATIVE_WINDOW`

Target is a fixed window relative to a named event.

### `CONTINUOUS_AROUND_REQUEST`

Generate/log a continuous or regularly sampled hidden stream before, during, and after request encoding.

Used for onset/latency/persistence analysis.

### `PREGENERATED_HIDDEN`

Outcome exists and is committed before participant request; reveal remains locked until protocol completion.

This remains a distinct experimental family.

The current first-use profile may choose `IMMEDIATE_REQUEST`, but **absolute time and relative-delay capability must remain implemented in the engine**.

Do not delete capabilities merely because the current profile does not expose them prominently.

---

## 4. Named timing anchors

Timing policies must reference named protocol events rather than hardcoded stage numbers.

Required anchors include at minimum:

- session commitment;
- session start;
- audio start;
- request cue;
- request start;
- request end;
- release start;
- release end;
- target event/window start;
- target event/window end;
- return cue;
- participant return;
- raw report lock;
- reveal.

A future protocol may introduce additional named anchors through configuration where practical.

---

## 5. Machine-output policy

Support at minimum:

### `SINGLE_OUTCOME`

Generate one outcome at the declared eligible target event.

### `FIXED_LENGTH_STREAM`

Generate exactly `N` outputs according to a declared sampling policy.

### `CONTINUOUS_STREAM`

Generate fixed-rate or fixed-block outputs across a declared start/end interval.

### `WINDOWED_STREAM`

Generate separately declared pre/request/post windows.

Fields must be configuration-driven:

- count;
- rate/block size;
- start anchor;
- stop condition;
- storage representation;
- primary scoring region.

No optional stopping unless a profile explicitly selects a historically replicated sequential rule.

---

## 6. Random-source provider

Retain a stable provider interface.

Required first providers:

- operating-system cryptographic random source;
- deterministic seeded test provider.

Future providers may be added behind the same interface:

- hardware electronic-noise source;
- quantum source;
- serial/USB device;
- isolated remote source.

Experiment profiles choose a provider by ID.

The core session engine must not contain provider-specific experiment logic.

---

## 7. Session-protocol definition

The active hands-free sequence must be configuration-driven.

Represent protocol stages as an ordered versioned array.

Each stage should support fields such as:

- stage ID;
- stage type;
- duration or completion rule;
- cue at start/end;
- participant instruction text for pre-session display/documentation;
- whether the stage is hands-free;
- whether a request-related timing anchor is emitted;
- whether machine telemetry is active;
- whether audio recipe/layers change;
- whether the stage is part of the primary analysis window.

Do not hardcode the current sixteen-stage sequence into business logic.

The first operational profile should instantiate the current hands-free protocol, but a later profile must be able to change durations, omit a stage, add a neutral hold, or change cue placement by profile/configuration where the existing primitives permit it.

---

## 8. Audio recipe

Audio conditions must be data-defined recipes, not hardcoded branches in session logic.

Each recipe can compose supported synthesis layers defined in `AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`, including:

- carrier pairs;
- binaural differences;
- multiple carriers;
- amplitude envelopes;
- amplitude modulation;
- frequency modulation;
- ordinary masking noise;
- phased/swept noise;
- cue layers;
- fades;
- normalization/headroom.

Store exact recipe snapshot, synthesis algorithm versions, all parameters, seed where relevant, and output hashes with the session.

Adding a new combination of already-supported synthesis layers should require a new JSON audio recipe, not source-code modification.

A genuinely new signal-processing primitive may require code and must be versioned explicitly.

---

## 9. Cue schedule

Cue identity and timing must be configurable through the protocol profile.

Cues may be:

- generated fixed tones;
- local versioned audio assets.

Store cue parameters/assets and hashes.

The first baseline uses nonsemantic cues, but the engine should not assume all future profiles have exactly four cues.

---

## 10. Analysis plan

Every experiment profile must point to a versioned analysis plan.

The analysis plan declares before data inspection:

- primary endpoint(s);
- secondary endpoint(s);
- primary timing region;
- exploratory windows;
- requested-direction scoring rule;
- exact-match scoring where applicable;
- stream window sizes;
- threshold definitions;
- sustained-crossing rule;
- change-point algorithm/version;
- multiplicity handling where applicable;
- exclusion rules;
- forgotten-request treatment;
- aborted-session treatment.

The reporting code calculates only what the analysis plan declares plus clearly labeled generic diagnostics.

Exploratory calculations may never silently replace the primary endpoint.

---

## 11. Reveal policy

Support configurable reveal policies:

- reveal after current raw report is locked;
- reveal after entire block is locked;
- delayed reveal until a declared date/time;
- no reveal during participant session.

The current profile uses reveal after raw-report lock.

---

## 12. Reporting profile

Reports are deterministic and configuration-aware.

A reporting profile selects which available modules are included, such as:

- protocol timeline;
- audio manifest;
- request assignment;
- exact outcome;
- stream statistics;
- pre/request/post comparison;
- onset/latency/persistence summary;
- subjective-time comparison;
- integrity checks;
- same-profile cross-session comparison.

Do not make the main report depend on generative AI.

---

# Experiment Profile object

An experiment profile is the primary user-facing configuration unit.

Recommended conceptual structure:

```json
{
  "id": "MIP_BASELINE_NOW_BINARY_V1",
  "schema_version": 1,
  "status": "EXPLORATORY",
  "request_assignment_policy": "SYSTEM_RANDOM_UNIFORM",
  "outcome_space_id": "BINARY_01_V1",
  "timing_policy_id": "NOW_CONTINUOUS_V1",
  "machine_output_policy_id": "STREAM_PRIMARY_WITH_SINGLE_COMPANION_V1",
  "rng_provider_id": "OS_CSPRNG",
  "session_protocol_id": "HANDS_FREE_REQUEST_V1",
  "audio_condition_pool": ["A-U396-4", "A-P100-104", "A-SHAM-0"],
  "audio_assignment_policy": "BALANCED_RANDOM",
  "analysis_plan_id": "REQUEST_NOW_BINARY_ANALYSIS_V1",
  "reveal_policy_id": "AFTER_RAW_REPORT_LOCK",
  "reporting_profile_id": "STANDARD_REQUEST_REPORT_V1"
}
```

The exact file schema may differ, but the separation of concerns must remain.

---

# Required first profiles

Ship at least these example profiles to prove that timing is truly configuration-driven:

## A. Immediate baseline

- binary `{0,1}`;
- system-assigned request;
- continuous pre/request/post stream;
- participant semantics: `now`;
- current hands-free protocol.

## B. Relative-delay demonstration

- same binary/request/audio/protocol;
- target defined as `5 minutes after request end`;
- configuration only; no code fork.

## C. Absolute-time demonstration

- same binary/request/audio/protocol;
- target defined by an explicit local date/time converted and committed to UTC;
- configuration only; no code fork.

These demonstration profiles may be dry-run/test profiles rather than recommended participant protocols.

Their purpose is to prove the architecture is not hardcoded to the first experiment.

---

# Configuration storage

Recommended layout:

```text
data/
  config/
    schemas/
    profiles/
    outcome_spaces/
    timing_policies/
    output_policies/
    rng_providers/
    session_protocols/
    audio_recipes/
    analysis_plans/
    reveal_policies/
    reporting_profiles/
```

Session directory stores an immutable effective snapshot:

```text
sessions/<SESSION_ID>/
  config_snapshot/
  events.jsonl
  raw_machine_output.*
  raw_report.json
  analytical_report.json
  hashes.json
```

Do not require a database.

---

# Configuration validation

Every configuration type must have a schema/version and deterministic validation.

Reject invalid or internally contradictory profiles before session commitment.

Examples:

- absolute timing without timezone/offset;
- primary analysis window outside generated telemetry range;
- request value not contained in outcome space;
- unsupported audio layer;
- stream analysis with a single-outcome-only policy;
- reveal policy that exposes result before required raw-report lock;
- unknown versioned ID.

Display validation errors clearly before START.

---

# Configuration editing

Provide a small local experiment/profile editor sufficient to:

- duplicate an existing profile;
- change timing mode and parameters;
- change outcome space;
- choose request-assignment policy;
- select audio condition/pool;
- select session protocol;
- select analysis and reveal profiles;
- save as a new versioned profile;
- validate before use;
- show a read-only effective configuration summary before commitment.

Do not build a large drag-and-drop workflow designer.

An advanced JSON view/export may be provided for auditability.

---

# Versioning rules

Never silently mutate a profile that has already been used in a committed session.

If a material field changes:

- create a new profile version/ID;
- preserve the old profile;
- keep prior sessions bound to their immutable snapshots.

The application code, configuration schema, synthesis algorithms, RNG provider versions, analysis algorithms, and report generator version must all be recorded.

---

# Backward compatibility rule

The engine must be able to open and verify old session bundles even after newer profiles/configurations are added.

Do not require old session data to be rewritten merely because defaults changed.

---

# Current first-use decision

The first actual MIP participant profile is intentionally simple:

- system assigns `0` or `1` before induction;
- participant memorizes it;
- active session is hands-free;
- participant request means `now` / immediate requested direction;
- hidden machine stream is already running before request cue and continues afterward;
- exact machine timestamps remain authoritative;
- subjective time estimate is captured before actual elapsed time is shown;
- raw report locks before reveal.

This is a **profile choice**, not an engine limitation.

---

# Acceptance tests for future-proofing

The implementation fails this architecture requirement if any of the following require editing experiment-engine source code:

1. Change from `now` to `5 minutes after request`.
2. Change from relative delay to `tomorrow at 10:00`.
3. Change outcome space from `{0,1}` to `{0,1,2,3}` using an already-supported finite-set/integer primitive.
4. Change requested-value assignment from system-random to participant-selected pre-session.
5. Change one audio recipe to another recipe built from already-supported synthesis layers.
6. Change a stage duration or cue placement using already-supported stage primitives.
7. Change reveal from per-session to block-level.
8. Change pre/request/post analysis-window sizes.

All eight must be achievable by creating/selecting validated versioned configuration only.

Source-code changes are acceptable only when introducing a genuinely new primitive, provider, signal-processing operation, or analysis algorithm not expressible by the existing architecture.
