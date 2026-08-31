# MIP Local Research Application Specification v0.2

## Status

`ACTIVE APPLICATION SPECIFICATION — PRE-CODE FREEZE`

## Supersession

This file supersedes `engineering/REQUEST_TEST_APP_SPEC_V0.1.md` for new implementation work.

Version 0.1 remains historical engineering context.

## Purpose

Build one local, auditable research utility for MIP REQUEST, READ, temporal, mapping, entropy, audio, calibration, and session-review work without a database or cloud dependency.

This specification intentionally separates:

- research configuration;
- participant session execution;
- machine-output generation;
- participant representation;
- audio engineering;
- raw evidence;
- deterministic analysis;
- session review.

---

# 1. Active references

Implementation must follow, in authority order:

- `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
- `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
- `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
- `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
- `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
- `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md` where not superseded
- current active protocol files.

---

# 2. Scope

The first build runs on the local computer only.

Use:

- Node.js 22+;
- ESM;
- minimal dependencies;
- local HTTP server bound to `127.0.0.1`;
- plain HTML/CSS/JavaScript UI;
- JSON/JSONL filesystem persistence.

Do not implement:

- databases;
- accounts/authentication;
- cloud sync;
- mobile apps;
- custom Bluetooth control;
- analytics;
- runtime generative AI;
- plugin/workflow frameworks.

---

# 3. Required main areas

Main navigation:

1. `Start Research Session`
2. `Audio Lab`
3. `Experiment Profiles`
4. `Calibration`
5. `Sessions / Reports`
6. optional `Blocks` entry if not nested under Profiles/Sessions.

Do not overload the main screen with advanced scientific parameters.

---

# 4. Core runtime modules

Required modules:

- config loader/validator;
- profile resolver;
- mapping/encoding resolver;
- session/trial/block ID allocator;
- session state machine;
- named timing/scheduler engine;
- request assignment;
- outcome-space sampling/scoring;
- RNG provider abstraction;
- machine-output stream writer;
- audio synthesis;
- Audio Lab live player;
- formal-session audio controller;
- event/hash logger;
- raw-report manager/lock;
- reveal gate;
- deterministic analysis;
- integrity verifier;
- report generator;
- session browser/review;
- calibration utilities;
- crash/incomplete-session recovery scanner.

---

# 5. Runtime data model

Use the hierarchy:

`block -> session -> trial`

The first REQUEST baseline has one primary trial per session.

Use MIP session IDs `S####` without reusing existing IDs.

Runtime participant evidence is kept in a dedicated runtime data root and is not silently merged into top-level Markdown session documentation.

---

# 6. Required trial families

The engine must be able to express at least:

## A. `REQUEST_IMMEDIATE_STREAM`

First active participant family.

- system assigns objective request;
- participant memorizes before START;
- hidden stream runs before/during/after request;
- primary request/immediate region predeclared;
- raw report locks before reveal.

## B. `REQUEST_SINGLE_OUTCOME`

One objective machine outcome at a configured timing event.

May use next-eligible, relative-delay, or absolute-time timing.

## C. `REQUEST_FIXED_STREAM`

Fixed-length requested-direction stream with no optional stopping.

## D. `READ_HIDDEN_EXISTING`

Machine target generated/committed before participant response; participant response locks before reveal.

## E. `READ_FUTURE`

Participant response locks before future target generation; keep separate from ordinary hidden-existing READ.

## F. `REQUEST_PREGENERATED_HIDDEN`

Target generated/committed before request but hidden; distinct time-displaced family.

## G. `REQUEST_EXACT_TOKEN`

Exact objective state/index from a uniform finite space up to at least 30 bits.

## H. Temporal/delay blocks

Balanced exploration across configured request-to-target delays/windows.

Do not force all these into one giant form. Profiles select the required primitives.

---

# 7. Outcome spaces

Required:

- binary;
- finite integer range;
- explicit enum set;
- exact-token space.

Entropy staircase support through:

- 2;
- 4;
- 16;
- 256;
- 65,536;
- 1,048,576;
- 1,073,741,824 outcomes.

For huge spaces, sample integer indices without materializing members.

Exact-token display mapping must be deterministic and reversible.

No fuzzy scoring in primary exact-token endpoints.

---

# 8. Randomness

Initial providers:

- `OS_CSPRNG`;
- `DETERMINISTIC_PRNG_TEST` with stable explicit algorithm/version/seed.

Use unbiased sampling.

Never use `Math.random()` for scientific assignment/output.

Future hardware providers must plug into the same provider interface.

---

# 9. First active session profile

Ship `BASELINE_NOW_BINARY_V1` with:

- objective space `{0,1}`;
- system-random request assignment;
- literal 0/1 mapping;
- `SER-A-V2` request encoding;
- active playbook v0.3;
- immediate participant-facing timing;
- continuous hidden stream around request;
- first audio comparison pool as configured;
- raw report before reveal;
- subjective-time estimate before actual-time display;
- reveal after raw-report lock;
- deterministic report/integrity verification.

---

# 10. Required architecture demonstrations

Ship dry/test profiles demonstrating:

- five-minute relative delay;
- absolute local date/time converted to UTC;
- arbitrary binary label mapping;
- reversed arbitrary mapping;
- semantic-only request encoding;
- four-outcome space;
- block-level reveal.

These must run through the same engine without source-code forks.

---

# 11. Timing

Support named anchors including:

- commitment;
- START;
- audio start;
- induction cue;
- request cue;
- request start/end;
- release start/end;
- target/window start/end;
- return cue;
- return confirmation;
- report start/lock;
- reveal.

Use monotonic clock for durations/order and UTC for stored absolute timestamps.

Log scheduled versus actual execution separately.

Long-delay/absolute-time operation must follow the timing-deviation rules in the active architecture; missed events are not backfilled.

---

# 12. Audio Lab

Implement:

- one-click preset mode;
- one-number quick mode;
- simple custom;
- advanced custom;
- continuous play until pause/stop;
- save/version recipe;
- finite deterministic WAV export/manifest/hash where requested.

First presets:

- `A-U396-4` = 394/398 Hz;
- `A-P100-104` = explicit 100/104 Hz patent example;
- `A-SHAM-0` = 396/396 Hz.

Quick template:

`CENTERED_BINAURAL_4HZ_V1`

For center `C`:

`L = C - 2`

`R = C + 2`

Show derived values before playback.

---

# 13. Audio Lab separation

Audio Lab preview is exploratory and mutable.

A formal session may use only a saved/versioned validated recipe referenced by the committed profile.

After commitment, formal session audio cannot be edited manually.

Formal session pause/resume is not part of normal experimental operation; unexpected audio interruption is a protocol deviation/failure event.

---

# 14. First hands-free user flow

Before START:

1. select profile;
2. validate;
3. collect baseline fields;
4. assign objective requested state;
5. resolve/display participant-facing target and encoding instructions;
6. participant confirms memory;
7. show effective critical-settings summary;
8. snapshot/commit/hashes;
9. one large START action.

After START:

- no screen interaction required;
- non-informative/dim screen;
- automatic audio/stages/cues/telemetry;
- hidden output unavailable.

After automatic return cue and ordinary return:

1. confirm return;
2. raw-report form;
3. lock;
4. reveal only if policy permits;
5. deterministic report;
6. integrity verification.

---

# 15. Raw report

Before reveal capture at minimum:

- subjective total duration;
- subjective request-to-return duration;
- time compression/expansion/discontinuity/ordinary;
- confidence;
- overall state intensity;
- alertness;
- imagery;
- auditory phenomena;
- somatic/vibration/pulse;
- rotation/vestibular phenomena;
- sensed presence/interaction;
- perceived agency;
- participant-facing requested label remembered;
- forgotten-request status;
- actual encoding modality;
- representation clarity;
- affect/certainty;
- spontaneous conflicting target/state;
- acknowledgement-like event;
- interruptions;
- termination/abort;
- pre-reveal belief of success;
- free raw notes.

Allow `unknown` / `not experienced` where appropriate.

Use mutable draft only before lock. Final raw report is immutable.

---

# 16. Evidence/logging

Implement the active session-data requirements completely.

Every session must have:

- unique session/trial IDs;
- config snapshot;
- commitment;
- authoritative append-only event chain;
- lossless machine output linked by hashes;
- raw report lock hash;
- protocol-deviation records;
- reveal event/result;
- deterministic analysis;
- integrity manifest;
- verifier result.

Logging failure fails closed; do not silently continue as a valid trial.

---

# 17. Session browser/review

The `Sessions / Reports` area must provide:

- sortable/filterable session list;
- status/reveal/integrity indicators;
- single-session audit page;
- human-readable timeline;
- raw events JSONL view;
- config/commitment view;
- machine-output view when reveal permits;
- raw report with draft/locked/late provenance;
- protocol deviations;
- deterministic report;
- `Verify Integrity` action;
- read-only export.

Hidden outcome must not leak in browser list or audit view before reveal.

---

# 18. Blocks

Support versioned/precommitted blocks for:

- balanced request assignments;
- audio/condition assignment;
- block-level reveal;
- block report.

Block schedule must not be retroactively rebalanced by deleting failed/aborted sessions.

Replacement rules, if used, must be predeclared.

---

# 19. Calibration

Calibration is separate from participant sessions.

Support:

- binary blocks;
- finite-space output;
- provider health metadata;
- counts/frequencies;
- basic bias summaries;
- deterministic fixtures/tests;
- timestamps;
- hashes/integrity.

Calibration output does not receive a participant Communication Session result classification.

---

# 20. Deterministic analysis

Minimum supported calculations as declared by versioned analysis plans:

- exact binary match;
- requested-direction stream count/proportion/deviation;
- exact-token equality and `1/N` nominal null probability;
- fixed pre/request/post window summaries;
- cumulative requested-direction deviation;
- configured threshold/sustained crossing;
- exploratory deterministic change-point when implemented;
- timing offsets;
- cross-session eligible-trial counts/match proportions;
- exact/numerically stable binomial calculation where declared.

All implemented algorithms require fixed test fixtures with known expected values.

---

# 21. Reports

The deterministic report includes:

- engine/app version;
- profile/config fingerprint;
- request assignment;
- objective requested state;
- participant mapping;
- encoding profile;
- protocol timeline;
- audio recipe/manifest/hash;
- RNG provider;
- timing policy/scheduled/actual timing;
- machine output/result when reveal permits;
- primary and secondary results;
- exploratory temporal diagnostics;
- subjective timeline/time distortion;
- protocol deviations;
- integrity verification;
- comparability status with prior sessions.

No generative interpretation in the primary analytical report.

---

# 22. Reveal gate

Reveal is a server-side authorization/state check.

Required policies:

- after raw-report lock;
- after block lock;
- delayed date/time.

Before eligibility, hidden result data must not be sent to participant-facing client routes at all.

---

# 23. Configuration/profile editor

Allow:

- duplicate existing profile;
- change request assignment;
- outcome space;
- mapping;
- encoding profile;
- timing;
- output policy;
- RNG provider;
- session protocol;
- audio recipe/pool;
- analysis plan;
- reveal/reporting;
- validate;
- save new version;
- inspect effective JSON.

Never mutate a profile already used by a committed session.

---

# 24. Validation

Reject START for at least:

- missing/unknown referenced config;
- conflicting immutable IDs;
- objective request outside outcome space;
- incomplete mapping;
- incompatible encoding/mapping;
- missing timing anchor;
- absolute time without timezone/offset;
- impossible analysis window coverage;
- incompatible output/analysis policy;
- unsupported audio primitive;
- invalid frequency/Nyquist relation;
- reveal policy that violates lock requirements;
- contradictory stage transitions;
- invalid block balance;
- invalid schema/version.

Errors must name object and field.

---

# 25. Crash/recovery

On startup scan for incomplete sessions.

Verify last valid event and classify incomplete state.

Do not fabricate missed target outputs or stage events.

The first active protocol should normally fail closed after an active-session application interruption rather than pretend an interrupted run was continuous.

---

# 26. Security/local behavior

- local server only;
- no automatic network dependency for OS RNG;
- no analytics;
- no automatic upload;
- no hidden output in diagnostic logs;
- validate filesystem paths and prevent path traversal;
- do not serve arbitrary files outside approved static/runtime routes;
- use appropriate no-cache headers on sensitive/reveal-dependent API responses where practical.

This is local scientific integrity/security, not a multi-user authentication system.

---

# 27. Required automated tests

Tests must cover all requirements in:

- active config-engine v0.2;
- session-data/integrity v0.1;
- audio synthesis;
- Audio Lab;
- mapping/encoding;
- hands-free flow.

Additionally verify:

- no source-code change needed for required config demonstrations;
- hidden result absent from participant API before reveal;
- deterministic provider repeatability;
- OS RNG structural/range tests;
- 30-bit boundaries;
- token bijection;
- fake-clock timing;
- missed target handling;
- no backfill;
- event tampering detection;
- raw report immutability;
- block reveal;
- cross-session compatibility gate;
- old bundle read/legacy labeling.

---

# 28. Dry-run acceptance before participant use

Produce and inspect:

1. full automated test result;
2. RNG calibration bundle;
3. dry immediate binary session;
4. dry five-minute relative session using fake/safe timing;
5. dry absolute-time session;
6. arbitrary/reversed mapping demonstration;
7. semantic-only encoding demonstration;
8. block-level reveal demonstration;
9. finite four-outcome demonstration;
10. all three first audio presets;
11. one-number quick mode;
12. continuous Audio Lab manual controls;
13. deterministic finite WAV+manifest/hash for required presets;
14. session integrity verifier success;
15. deliberate tamper fixture detected;
16. deliberate logging/timing failure fixture handled fail-closed;
17. complete Sessions/Reports audit review of the dry baseline.

Do not launch a real participant session automatically.

---

# 29. Completion definition

The app is ready for owner review only when Codex can state for every mandatory capability whether it is:

- implemented and tested;
- implemented but awaiting manual verification;
- intentionally deferred;
- blocked with exact reason.

Do not claim `supported in principle` where no executable path/test exists.
