# Codex Prompt — MIP Local Research Engine v0.8

## READ THIS FIRST — EXECUTION AUTHORITY

You are the implementation agent for the repository `rezamr/MIP`.

Your task is to build the complete first local MIP research application, not merely scaffold it, not merely describe an architecture, and not merely implement the easiest subset.

Do not start coding until you have read the active MIP source of truth and resolved version authority exactly as instructed below.

Do not ask the project owner to restate decisions that already exist in the repository.

Do not silently merge contradictory instructions from old protocol generations.

Do not delete old research/protocol/prompt files. Preserve them as project history.

This prompt is the active implementation prompt. If an older Codex prompt conflicts with v0.8, v0.8 wins.

---

# 1. Mandatory reading order before coding

Read these files in full, in this order:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
7. `04_EVIDENCE_STANDARD.md`
8. `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
9. `10_CONVERSATION_ORCHESTRATION.md`
10. `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
11. `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
12. `protocols/REQUEST_ENCODING_V0.2.md`
13. `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
14. `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
15. `protocols/MIP_NUM_REQUEST_V0.2.md`
16. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
17. `research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md`
18. `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
19. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
20. `engineering/REQUEST_TEST_APP_SPEC_V0.2.md`
21. `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
22. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
23. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
24. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
25. `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
26. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
27. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
28. `templates/SESSION_TEMPLATE.md`
29. `sessions/SESSION_INDEX.md`

Then inspect the current repository tree before creating implementation files.

You may read older versions for historical understanding, but do not implement superseded behavior when an active replacement/authority rule exists.

---

# 2. Mandatory authority rule

Use `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md` as the conflict-resolution map.

The active first-use protocol is:

- `MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3`
- `REQUEST_ENCODING_V0.2`
- `IMMEDIATE_REQUEST_TIMING_V0.1`
- `MIP_NUM_REQUEST_V0.2`

Older fixed-clock wording in `REQUEST_ENCODING_V0.1`, `MIP_NUM_REQUEST_V0.1`, and playbook v0.2 must not leak into the first immediate participant profile.

If you discover a genuine contradiction that is not resolved by the authority file:

1. do not silently choose a convenient interpretation;
2. identify the exact files/clauses;
3. continue implementing unaffected features;
4. record the blocked issue precisely in the completion report;
5. do not change scientific meaning without a versioned repository decision.

---

# 3. Scientific mission boundary

Build a rigorous research instrument for testing MIP hypotheses.

The application must not claim that:

- MATRIX exists;
- a hit proves causal influence;
- a subjective acknowledgement proves an external source;
- a binaural frequency guarantees a brain state;
- a patent proves a historical Gateway waveform;
- a one-in-a-billion nominal chance event alone proves a mechanism;
- participant-facing symbols are literally understood by an unknown mechanism.

Preserve the repository evidence standard:

`OBSERVATION != INTERPRETATION != CONCLUSION`

The software records and analyzes experiments. It does not decide metaphysics.

---

# 4. Primary practical research objective

The first practical target is REQUEST / request-response, while READ remains a separate comparison track.

REQUEST architecture:

`participant receives/precommits desired objective state -> participant performs request protocol -> independent machine output is generated/logged under frozen timing/output policy -> correspondence is measured`

READ architecture:

`machine target/outcome is hidden -> participant reports/locks response -> target is revealed/scored`

Never pool READ and REQUEST results silently.

---

# 5. First operational participant experiment

The first active participant profile is **not** the older absolute-clock single-bit design.

It is:

`BASELINE_NOW_BINARY_V1`

with:

- objective outcome space `{0,1}`;
- system-random requested objective state;
- literal 0/1 participant-facing mapping initially;
- symmetric `SER-A-V2` encoding;
- target memorized before induction;
- one START action;
- hands-free active session;
- participant-facing timing = immediate/now;
- hidden continuous binary stream already running before request cue and continuing during/after request;
- predeclared primary request/immediate region;
- exploratory neighboring windows for onset/latency/persistence only;
- raw report before reveal;
- subjective-time estimate before actual elapsed time is shown;
- reveal after raw-report lock for this first profile;
- deterministic analysis and integrity verification.

Do not require the participant to estimate or watch a wall-clock target time during this first active profile.

---

# 6. Required future timing capabilities in the same engine

Even though the first profile is immediate, the same engine must support by configuration:

- `IMMEDIATE_REQUEST`
- `NEXT_ELIGIBLE_OUTPUT`
- `RELATIVE_DELAY`
- `ABSOLUTE_DATETIME`
- `ABSOLUTE_WINDOW`
- `RELATIVE_WINDOW`
- `CONTINUOUS_AROUND_REQUEST`
- `PREGENERATED_HIDDEN`

Demonstrate relative-delay and absolute-date-time profiles without source-code forks.

Do not defer these timing primitives simply because the first real participant profile does not use them.

---

# 7. Hard deployment limits

The active build is local-computer only.

Do not implement:

- Android;
- iOS;
- mobile shell;
- phone controller;
- custom Bluetooth protocol;
- cloud services;
- remote accounts;
- authentication/user system;
- sync;
- SQL;
- SQLite;
- MongoDB;
- any database engine;
- analytics/telemetry service;
- plugin marketplace;
- arbitrary runtime code loading;
- custom scripting language;
- drag-and-drop workflow designer;
- runtime generative AI.

Bluetooth headphones may be used only through the operating system's normal audio output path.

---

# 8. Technology target

Prefer:

- Node.js 22+;
- ECMAScript modules;
- Node built-ins wherever practical;
- `node --test` for automated tests where practical;
- minimal dependencies;
- plain HTML/CSS/JavaScript UI;
- local HTTP server bound to `127.0.0.1` only;
- JSON configuration/snapshots;
- JSONL append-only logs.

A small schema-validation dependency such as AJV is acceptable if it materially improves correctness. Do not add a large application framework merely for polish.

Never use `Math.random()` for scientific assignment or machine-output generation.

---

# 9. Preferred implementation layout

Unless the existing repository structure strongly justifies another clean equivalent, place application code under:

```text
app/
  package.json
  src/
    server/
    engine/
    config/
    rng/
    timing/
    session/
    logging/
    analysis/
    audio/
    reports/
  public/
  config/
    defaults/
    schemas/
  test/
  scripts/
```

Use a separate local runtime root such as:

```text
runtime/
  config/
  sessions/
  blocks/
  calibration/
  audio/
  indexes/
  system_logs/
```

Add appropriate `.gitignore` rules so ordinary runtime participant evidence is not automatically treated as source code.

Do not overwrite the repository's top-level `sessions/` historical Markdown documentation.

Document the runtime path clearly.

---

# 10. Run ergonomics

Provide simple commands, ideally from `app/`:

```text
npm install
npm test
npm start
```

Bind only to `127.0.0.1` by default.

Use a documented default port with optional environment override such as `MIP_PORT`.

Allow runtime data root override such as `MIP_DATA_DIR` for testing and isolation.

Tests must use temporary data roots and never modify real runtime session evidence.

---

# 11. Required high-level modules

Implement cleanly separated modules for:

1. schema/config validation;
2. profile resolution;
3. immutable configuration snapshotting;
4. block/session/trial ID allocation;
5. block manager;
6. session state machine;
7. named timing/scheduler engine;
8. request assignment;
9. objective outcome spaces;
10. participant-facing mappings;
11. request-encoding profiles;
12. RNG providers;
13. machine-output/stream generation;
14. audio synthesis;
15. Audio Lab live player;
16. formal-session audio controller;
17. event/hash logger;
18. raw machine-output writer;
19. raw-report draft/lock manager;
20. reveal gate;
21. deterministic analysis;
22. deterministic reports;
23. integrity verifier;
24. calibration;
25. session browser/audit review;
26. crash/incomplete-session recovery;
27. local server/router/API.

Avoid circular dependencies between UI and experiment semantics.

---

# 12. Configuration-driven engine requirement

Implement `CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md` fully.

Experiment behavior must come from versioned configuration, not scattered hardcoded branches.

Required registries include:

- profiles;
- outcome spaces;
- outcome mappings;
- request encoding profiles;
- request assignment policies;
- timing policies;
- machine output policies;
- RNG providers;
- session protocols;
- audio recipes;
- analysis plans;
- reveal policies;
- reporting profiles;
- block plans.

Each config object must have a stable immutable ID and schema version.

If a material config changes, create a new version/ID.

Never silently mutate an already-used configuration.

---

# 13. Experiment profile

The experiment profile is the main user-facing research unit.

It must resolve at least:

- request assignment;
- objective outcome space;
- participant-facing mapping;
- request encoding;
- timing;
- machine output;
- RNG provider;
- session protocol;
- audio recipe/pool;
- analysis plan;
- reveal policy;
- reporting profile.

Before commitment show a concise human-readable effective summary plus a read-only effective JSON view.

Do not allow START if validation fails.

---

# 14. Objective machine state versus human representation

This separation is mandatory.

Keep distinct:

1. objective machine state;
2. participant-facing label/mapping;
3. internal request-encoding instructions;
4. objective scoring endpoint.

The first literal `0/1` UI is just one mapping.

Through configuration only, support examples such as:

`BLUE -> objective state 1`

`GOLD -> objective state 0`

and the reversed mapping.

Scoring follows objective state, not the display string.

---

# 15. First active encoding profile

Implement `REQUEST_ENCODING_V0.2.md`.

Ship a versioned first encoding configuration such as `SER-A-V2` containing:

- semantic/goal lock;
- simple representation;
- matched completion/certainty tag;
- release;
- neutral observation.

The participant may use visual, verbal, kinesthetic, spatial, or abstract representation and reports the actual modality afterward.

Keep affective intensity symmetric across 0 and 1.

Do not deliberately escalate intensity.

Future encoding profiles must be selectable by config only when composed from existing primitives.

---

# 16. Request assignment

Implement:

- `SYSTEM_RANDOM_UNIFORM`
- `SYSTEM_BALANCED_BLOCK`
- `PARTICIPANT_MANUAL_PRESESSION`
- `FIXED_PROFILE_VALUE`
- `IMPORTED_MANIFEST`

Assignments operate on objective states.

For the first baseline use system-random uniform binary assignment.

For balanced blocks, define the schedule before outcome inspection and preserve aborted/incomplete members.

---

# 17. Outcome spaces and entropy

Implement:

- binary;
- finite integer range;
- explicit enum set;
- exact-token/index space.

Support the MIP entropy staircase through at least 30 bits:

- 2 outcomes;
- 4;
- 16;
- 256;
- 65,536;
- 1,048,576;
- 1,073,741,824.

Do not materialize giant target pools.

Use unbiased sampling.

For exact-token primary scoring use exact equality only.

Provide deterministic reversible index-to-token mapping with explicit mapping version.

---

# 18. RNG provider interface

Provide a stable interface containing conceptually:

```text
id
name
version
source_type
generate_integer(max_exclusive)
generate_bit()
generate_bits(n)
health_check()
metadata()
```

Initial providers:

## `OS_CSPRNG`

Use Node/platform cryptographic randomness with unbiased finite-range sampling.

## `DETERMINISTIC_PRNG_TEST`

Use an explicitly named/versioned deterministic algorithm and seed for repeatable tests/dry fixtures.

Do not use a hidden implementation whose sequence could change across Node versions without being recorded.

Document the deterministic algorithm.

Future hardware/noise/quantum adapters must fit the same interface.

---

# 19. Timing engine

Use named anchors rather than numeric stage positions.

Required anchors include at least:

- session commitment;
- START;
- audio start;
- induction cue;
- request cue;
- request start;
- request end;
- release start;
- release end;
- target/window start;
- target/window end;
- return cue;
- participant return confirmation;
- raw-report start;
- raw-report lock;
- reveal.

Use monotonic time for durations/order and UTC for absolute timestamps.

---

# 20. Scheduler integrity

For every scheduled machine event log:

- anchor;
- requested delay;
- scheduled UTC;
- intended monotonic deadline where meaningful;
- scheduler wake UTC/monotonic;
- actual generation UTC/monotonic;
- lateness/error;
- configured tolerance;
- detected wall-clock jump;
- detected process restart;
- sleep/resume suspicion where practical.

Never silently backfill a missed target.

If the app/computer is stopped/asleep and an absolute or long-delay target is missed beyond tolerance:

- preserve session;
- mark timing deviation/incomplete;
- do not generate a substitute output at resume and label it on-time.

Document that ordinary desktop timing is not laboratory-grade cross-device synchronized timing.

---

# 21. Machine-output policies

Implement:

- `SINGLE_OUTCOME`
- `FIXED_LENGTH_STREAM`
- `CONTINUOUS_STREAM`
- `WINDOWED_STREAM`

Policies define:

- count;
- rate/cadence;
- block size;
- start/end anchors;
- outcome space;
- storage representation;
- primary scoring region;
- timing precision;
- stop rule.

No optional stopping in ordinary MIP profiles.

A future historical sequential-replication algorithm must be explicitly separate.

---

# 22. First immediate continuous-stream behavior

For `BASELINE_NOW_BINARY_V1`:

- hidden stream starts before request cue;
- stream continues through request encoding;
- stream continues through release and declared post windows;
- primary request/immediate region is declared before outcome inspection;
- neighboring windows remain exploratory;
- raw ordered machine output is preserved.

The participant does not need to know sample times.

Do not auto-select the strongest lag/window and call it primary.

---

# 23. High-volume stream storage

If per-bit timestamping is impractical, use explicitly defined output blocks.

Each block must contain:

- block index;
- exact ordered outcomes or lossless packed representation;
- count;
- scheduled/actual block timing;
- provider/version;
- outcome-space version;
- block hash.

Do not claim per-bit generation timestamps unless actually captured.

Each machine-output block hash must be linked into the authoritative session event chain.

---

# 24. Session/trial/block hierarchy

Implement:

- Experiment Profile;
- optional Block;
- Session;
- Trial.

The first active profile uses one primary trial per session, but keep independent IDs.

Use MIP-compatible session IDs `S####` and do not reuse existing `S0001`/`S0002`.

Trial IDs may be `S0003-T001`.

Block IDs may be `B0001`.

Calibration IDs use a separate namespace.

---

# 25. ID collision and single-instance safety

Because there is no database:

- use exclusive session-directory creation;
- use a runtime/application lock to avoid two writers using the same data root;
- detect stale locks safely;
- never overwrite existing evidence;
- allocate next ID if collision occurs.

---

# 26. Hands-free session engine

Implement the active `MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md` as a versioned stage configuration.

After START, normal operation requires no screen interaction until deliberate return.

Do not require a `state stable` button.

The participant target is assigned/memorized before START and is not re-shown during the active session.

The screen should be non-informative/dim/blank.

All cues/timing/audio/machine output are automatic.

---

# 27. Physical termination

The participant must be able to terminate without software operation:

- open eyes;
- remove/lift headphones;
- reorient.

A software stop button may exist as an optional convenience but must not be required for safe termination.

After return, mark abort/termination with approximate time/reason.

Never delete the session.

---

# 28. Forgotten request

If target is forgotten:

- do not guess;
- preserve session/output;
- record `REQUEST_VALUE_FORGOTTEN=true`;
- apply only prespecified analysis rule.

Do not ask participant to infer target from later sensations.

---

# 29. Audio synthesis engine

Implement `AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md` fully.

Support versioned stereo recipes with primitives for:

- one/multiple carriers;
- left/right frequencies;
- binaural differences;
- monaural relationships;
- amplitude envelopes;
- AM;
- FM;
- masking noise;
- deterministic noise;
- phased/swept patent-grounded noise;
- cue tones;
- fades;
- normalization/headroom;
- Septon/multi-carrier structures where required.

Unknown historical parameters remain labeled as reconstruction/unknown.

---

# 30. Required audio provenance

Never label an audio recipe/file as exact 1983 Gateway/CENTER LANE audio unless all material parameters are source-verified in the repository.

Allowed labels include:

- exact MIP-defined condition;
- documented patent example;
- patent-grounded reconstruction;
- MIP experimental reconstruction;
- unverified historical candidate.

---

# 31. First Audio Lab presets

Make these prominent and one-click usable:

## `A-U396-4`

- center 396 Hz;
- beat 4 Hz;
- left 394 Hz;
- right 398 Hz.

## `A-P100-104`

- explicit left 100 Hz;
- explicit right 104 Hz;
- beat 4 Hz;
- arithmetic center 102 Hz.

Do not reinterpret 100/104 through the centered-396 template.

## `A-SHAM-0`

- left 396 Hz;
- right 396 Hz;
- beat 0 Hz;
- center 396 Hz.

Show actual L/R values read-only before playback.

---

# 32. One-number quick audio mode

Default quick template:

`CENTERED_BINAURAL_4HZ_V1`

User enters only center frequency `C`.

Template supplies 4-Hz difference:

`L = C - 2`

`R = C + 2`

More generally for configurable centered template:

`L = C - beat/2`

`R = C + beat/2`

Show derived L/R/beat.

The UI must state that the template supplies assumptions; one number alone does not mathematically define arbitrary stereo audio.

---

# 33. Audio Lab modes

Provide four levels:

1. presets;
2. one-number quick mode;
3. simple custom;
4. advanced custom.

Simple custom should expose center, beat, supported waveform, gain, finite-export fades, optional ordinary masking noise where supported.

Advanced custom may expose direct L/R, multiple carriers, per-component levels, AM/FM, noise seed/type, phased/swept parameters, phase relationships, Septon, sample rate, normalization/headroom, finite export duration.

Keep advanced controls hidden from normal first-use path.

---

# 34. Unlimited Audio Lab playback

Audio Lab preview must continue until the user manually pauses/stops it.

Required controls:

- Play;
- Pause;
- Resume;
- Stop.

No hidden duration cutoff.

Avoid clicks/pops at ordinary buffer/pause/resume boundaries.

Continuous preview must not create an endlessly growing WAV.

Stopping preview must not silently save a recipe.

---

# 35. Audio Lab versus formal session

Audio Lab is exploratory/mutable.

Formal session uses only a saved/versioned validated recipe referenced by the committed profile.

Unsaved preview state must never contaminate a formal session.

Formal session audio cannot be edited after commitment.

Unexpected formal-session pause/audio failure is a logged protocol deviation, not normal experimental control.

---

# 36. Audio exactness/reproducibility boundary

For finite verification/export, generate deterministic WAV + manifest + SHA-256.

For live playback, record exact recipe/algorithm/sample-rate metadata and the actual browser/audio-context sample rate where available.

Do not claim physical sound at the ear is bit-identical to the digital source unless actually measured.

Use the same versioned recipe semantics for offline render and live playback, but document any implementation-path differences.

---

# 37. Audio validation

Reject invalid audio configuration rather than silently correcting it.

Validate at least:

- finite numeric fields;
- positive frequencies where required;
- centered pair does not produce zero/negative frequency;
- frequencies below Nyquist;
- derived difference consistency;
- supported sample rate/waveform;
- finite gain/headroom;
- clipping in deterministic render fixtures;
- required historical unknowns not masquerading as recovered values.

---

# 38. Patent-grounded phased-pink mode

Implement the recoverable architecture from the active audio requirements, including where specified:

- deterministic 16-bit shift-register style generator;
- 65,535-sample sequence behavior for that mode;
- pink/red filtering;
- delay-line/comb-filter processing;
- low-frequency delay sweep near 1/8 Hz;
- configurable left/right sweep phase/amplitude relationship;
- envelope;
- supported AM/FM/multi-carrier behavior.

Any unrecovered coefficient must be explicit MIP reconstruction configuration.

Do not let this advanced feature delay usability of the three simple presets, but it remains a mandatory implementation target unless an exact requirement is technically impossible and documented.

---

# 39. Scientific session evidence model

Implement `SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md` completely.

A session is not complete merely because a result JSON exists.

Every session must preserve:

- identity;
- config snapshot;
- commitment;
- append-only event chain;
- raw machine output;
- report draft/final distinction;
- immutable raw report lock;
- protocol deviations;
- reveal event/result;
- deterministic analysis;
- integrity manifest;
- integrity verification.

---

# 40. Canonical event hash chain

Use append-only `events.jsonl`.

Define and document one canonical JSON hashing format.

Every event includes:

- schema version;
- event index;
- session ID;
- trial ID where applicable;
- UTC time;
- monotonic time;
- event type;
- payload;
- previous hash;
- event hash.

Use a deterministic genesis hash.

The verifier must detect edit/delete/reorder/insert/broken-chain cases.

Do not depend on JavaScript object insertion order as the scientific canonicalization specification.

---

# 41. Machine-output persistence

When an output/block is generated:

1. capture actual generation time immediately;
2. persist exact output/block;
3. flush/sync according to practical platform support;
4. calculate block hash;
5. append hash-reference event;
6. only then allow later reveal-dependent progression.

Never regenerate a lost target.

If required persistence fails, mark a logging/protocol failure and fail closed.

---

# 42. Atomic JSON snapshots

Mutable-before-lock JSON files must use atomic temp-write/flush/rename behavior.

After commitment/lock, immutable evidence must never be rewritten in place.

Corrections become append-only late-note/correction events.

---

# 43. Raw report lifecycle

Before lock, autosave may use `raw_report_draft.json` clearly marked mutable.

At lock:

- validate;
- create final `raw_report.json`;
- hash it;
- append lock event with hash;
- make UI read-only;
- never overwrite it.

Late recollections become new timestamped events.

Post-reveal notes must be separately labeled from pre-reveal raw report.

---

# 44. Hidden-result leakage prevention

This is mandatory and must be tested.

Before reveal eligibility, hidden output content must not be sent to participant-facing client routes at all.

Do not merely hide it with CSS.

Do not include hidden result in:

- HTML source;
- JS variables;
- JSON API response;
- URL;
- SSE/WebSocket message;
- report preview;
- browser debug payload;
- ordinary diagnostic log;
- error text.

The server checks reveal policy/state for every result-bearing request.

---

# 45. Commitment

Before START create `commitment.json` containing all material pre-outcome choices, including as applicable:

- session/trial/block IDs;
- objective requested state;
- mapping ID/version;
- encoding ID/version;
- timing policy/primary region;
- output policy;
- RNG provider/version;
- session protocol;
- audio recipe/assignment;
- analysis plan;
- reveal policy;
- nonce;
- all effective config hashes.

Compute canonical SHA-256 commitment.

Do not include a future output that does not yet exist.

Pre-generated/READ target commitment follows its separate timing family.

---

# 46. Integrity manifest

At finalization generate an integrity manifest with sorted evidence-file relative paths, file sizes, SHA-256 hashes, terminal event hash, and bundle root hash.

Avoid a self-hash cycle by excluding the manifest/root-hash field according to the documented algorithm.

Provide a verifier returning at least:

- `VALID`
- `INVALID`
- `INCOMPLETE`
- `LEGACY_UNVERIFIABLE`

Never silently repair corrupted evidence.

---

# 47. Required event coverage

Log at least:

- session create;
- profile validation;
- request assignment;
- mapping resolution;
- commitment;
- config snapshot;
- START;
- audio start/failure;
- every stage start/end;
- every cue;
- request start/end;
- release start/end;
- target/window schedule;
- scheduler wake;
- output generation/persistence;
- timing deviation;
- interruption;
- participant abort;
- return cue;
- return confirmation;
- raw-report draft start;
- raw-report lock;
- late recollection;
- reveal eligibility;
- reveal;
- analysis;
- integrity verification;
- close;
- logging/application failure.

Use a stable event-type registry/constants.

---

# 48. Session state machine

Implement validated lifecycle states including conceptually:

- CREATED;
- PROFILE_VALIDATED;
- REQUEST_ASSIGNED;
- COMMITTED;
- STARTED;
- ACTIVE;
- RETURN_PENDING;
- RETURN_CONFIRMED;
- REPORT_DRAFT;
- REPORT_LOCKED;
- REVEAL_PENDING;
- REVEALED;
- ANALYZED;
- CLOSED.

Failure/deviation states include:

- ABORTED_PARTICIPANT;
- INTERRUPTED_EXTERNAL;
- FAILED_APPLICATION;
- TIMING_DEVIATION;
- AUDIO_FAILURE;
- LOGGING_FAILURE;
- INCOMPLETE.

Reject invalid transitions and preserve evidence.

---

# 49. Crash/incomplete-session recovery

At application startup scan for nonterminal sessions.

For each:

- verify existing event chain;
- identify last valid state;
- preserve drafts;
- never invent missing events;
- never backfill missed targets;
- allow explicit close/classification;
- resume only if scientific meaning is not compromised.

For the first active hands-free baseline, an application interruption during active sequence should normally fail closed rather than resume as though uninterrupted.

---

# 50. Protocol deviations

Generate structured deviations from authoritative events, including at least:

- forgotten request;
- external interruption;
- participant abort;
- audio disconnect/failure;
- browser refresh;
- process crash;
- system sleep;
- late output;
- logging failure;
- unexpected interaction;
- unintended information leakage reported;
- post-commit config inconsistency.

Every deterministic report must state deviation status.

---

# 51. System diagnostic logs

Keep diagnostic logs separate from scientific evidence.

They may contain app lifecycle/errors/stack traces, but must not leak hidden outcome or raw participant-report content before reveal.

Scientific event logging always goes to session evidence, not only system logs.

---

# 52. Raw participant report before reveal

After ordinary return and before reveal, collect at least:

- estimated total duration;
- estimated request-cue-to-return duration;
- time felt compressed/expanded/discontinuous/ordinary;
- confidence;
- overall altered-state intensity;
- alertness;
- first clear state change estimate;
- vibration/pulse;
- rotation/vestibular effect;
- spontaneous imagery;
- auditory phenomena;
- sensed presence/interaction;
- strongest-state period;
- acknowledgement-like event;
- perceived agency;
- remembered requested label;
- forgotten-target flag;
- actual representation modality;
- representation clarity;
- affect intensity;
- certainty/completion intensity;
- spontaneous conflicting label/target;
- interruptions;
- abort/termination;
- pre-reveal belief of success;
- free raw notes.

Allow unknown/not experienced.

Do not show actual elapsed time until subjective estimate is locked.

---

# 53. Reveal policies

Implement server-side:

- `AFTER_RAW_REPORT_LOCK`
- `AFTER_BLOCK_LOCK`
- `DELAYED_DATETIME`

Block-level reveal must hide all member-session results until block lock conditions are met.

No debug endpoint or alternate page may bypass reveal.

---

# 54. Blocks and balancing

Provide minimal block support for:

- planned session count;
- profile/condition pool;
- request-value balance;
- audio-condition balance where configured;
- randomized order;
- commitment of schedule;
- member-session references;
- block-level reveal;
- block report.

Do not retroactively rebalance by deleting failed/aborted sessions.

If replacement sessions are allowed, the replacement rule must be predeclared and original session remains present.

---

# 55. Session browser — mandatory

`Sessions / Reports` must be a real audit interface.

List sessions with reveal-safe metadata:

- ID;
- date/time;
- block;
- profile/version;
- session class;
- status;
- audio;
- timing mode;
- reveal status;
- deviation count/status;
- integrity status;
- report availability.

Allow filtering by date, status, profile, audio, timing, block, completion state, integrity result.

Never expose hidden output in list rows before reveal.

---

# 56. Single-session audit page

Provide human-readable sections for:

1. identity/status;
2. effective committed config;
3. request assignment/mapping/encoding;
4. exact protocol timeline;
5. audio details;
6. machine output/timing when reveal permits;
7. raw participant report;
8. late/post-reveal notes with provenance;
9. protocol deviations;
10. deterministic analysis;
11. integrity verification.

Also provide read-only raw views of:

- commitment;
- config snapshot;
- events JSONL;
- machine output;
- raw report;
- integrity manifest;
- analytical report.

Provide a `Verify Integrity` action that never modifies evidence.

---

# 57. Timeline UI

Build a chronological timeline from `events.jsonl` showing:

- UTC;
- relative monotonic offset from START;
- event type;
- stage/cue;
- timing anchor;
- deviation markers;
- output block references only when reveal permits.

Keep machine timeline and retrospective subjective-state timeline distinct.

---

# 58. Session index/cache

A generated index/cache may be used for performance, but it is not scientific evidence.

It must be rebuildable from canonical session bundles.

Provide a rebuild action/command.

Do not make session evidence dependent on a mutable index.

---

# 59. Calibration

Provide no-participant calibration separately from Communication Sessions.

Support:

- large binary blocks;
- finite-space sampling;
- provider metadata/health check;
- counts/frequencies;
- basic bias summary;
- serial correlation diagnostic if implemented;
- uniformity smoke checks;
- timestamps;
- hashes;
- deterministic report.

Do not treat calibration as participant REQUEST evidence.

---

# 60. Deterministic analysis minimum

Implement only well-defined versioned algorithms and test each on fixed fixtures.

For binary exact-match blocks:

- eligible trial count;
- match count;
- match proportion;
- null 0.5 where applicable;
- signed difference;
- exact/numerically stable binomial tail when declared;
- confidence interval method/version if displayed.

For stream windows:

- n;
- requested-direction count;
- proportion;
- signed deviation from 0.5;
- declared z/binomial metric where configured.

For exact-token:

- N;
- exact match bool;
- nominal null `1/N` for one predeclared uniform exact target.

For temporal profiles:

- fixed pre/request/post windows;
- cumulative requested-direction deviation;
- threshold crossing if configured;
- sustained crossing if configured;
- deterministic exploratory change point if implemented;
- peak time/persistence/return metrics if configured.

Never let exploratory outputs redefine primary region.

---

# 61. Analysis fixtures

Create deterministic small fixtures with known expected results for:

- exact matches;
- mapping/scoring;
- binary proportion/deviation;
- binomial calculation;
- temporal-window classification;
- cumulative deviation;
- threshold/sustained crossing;
- token bijection/probability;
- cross-session compatibility.

Do not test statistical code only with fresh random samples.

---

# 62. Cross-session comparability gate

Before pooling sessions, verify material compatibility of:

- outcome space;
- request assignment as relevant;
- mapping;
- encoding;
- timing/primary region;
- output policy;
- RNG provider/source class as relevant;
- session protocol;
- audio condition/comparison dimension;
- analysis-plan version;
- reveal/blinding assumptions.

If incompatible, show side-by-side only and label it; do not silently pool.

Do not call one audio/profile `better` from a single session.

---

# 63. Deterministic report provenance

Every analytical report must identify:

- application/engine version;
- analysis engine version;
- analysis-plan ID/version;
- input hashes;
- config fingerprint;
- request assignment/objective state;
- mapping/encoding;
- protocol/audio/RNG/timing;
- primary/secondary/exploratory endpoints;
- deviation/exclusion treatment;
- integrity status.

The same locked inputs and same analysis version must yield the same scientific numeric outputs.

If presentation timestamps differ, separate scientific-content hash from presentation metadata so rerun time does not falsely imply scientific output changed.

---

# 64. Export

Provide read-only local export of canonical session bundle + integrity manifest.

Do not alter original evidence.

A copied directory is acceptable if you avoid an unnecessary archive dependency.

Before reveal, do not create participant-facing exports containing hidden results.

---

# 65. No deletion UI for committed evidence

Do not provide an ordinary one-click committed-session delete action in the first build.

Sessions including misses, aborts, failures, interruptions, and nulls remain visible.

---

# 66. Profile editor

Build a small practical editor allowing:

- duplicate profile;
- change request assignment;
- outcome space;
- mapping;
- encoding profile;
- timing mode/parameters;
- output policy;
- RNG provider;
- session protocol;
- audio recipe/pool;
- analysis plan;
- reveal policy;
- reporting profile;
- block plan where applicable;
- validate;
- save new version;
- read-only effective JSON.

Do not make advanced editing required for first baseline use.

---

# 67. Required shipped profiles/config demonstrations

Ship at minimum:

## `BASELINE_NOW_BINARY_V1`

Real first-use profile.

## `DRY_RELATIVE_5MIN_BINARY_V1`

Five minutes after a named anchor.

## `DRY_ABSOLUTE_TIME_BINARY_V1`

Explicit local date/time + timezone converted to UTC.

## `DRY_ARBITRARY_MAPPING_BINARY_V1`

Arbitrary participant labels mapped to objective binary states.

Also provide test/demonstration configuration for:

- reversed mapping;
- semantic-only encoding;
- four-outcome finite space;
- block-level reveal.

All must execute through the same engine without source code changes.

---

# 68. Configuration validation

Reject before commitment/START at minimum:

- unknown reference ID;
- duplicate immutable ID with different content;
- invalid schema version;
- requested objective state outside outcome space;
- incomplete mapping;
- incompatible mapping/encoding;
- invalid relative timing anchor;
- absolute time missing timezone/offset;
- target/analysis window outside generated coverage;
- stream analysis with single-output-only policy;
- invalid output cadence/count;
- invalid block balance;
- unsupported audio primitive;
- invalid frequency/sample-rate/Nyquist relation;
- reveal policy violating lock requirement;
- contradictory stage transition;
- invalid/unsafe path.

Errors must name object and field.

---

# 69. Local server safety

Even though this is local-only:

- bind to loopback only;
- prevent path traversal;
- serve only approved static/runtime routes;
- validate request bodies;
- limit request/body sizes reasonably;
- do not echo stack traces containing hidden scientific payload to participant-facing pages;
- use no-cache/private behavior for reveal-dependent responses where practical;
- do not expose arbitrary runtime filesystem browsing outside the audit UI's controlled files.

Do not build a multi-user auth system.

---

# 70. Formal test requirements — configuration architecture

The build fails architecture acceptance if any of these require source edits when using already-supported primitives:

1. immediate -> five-minute relative delay;
2. relative -> absolute date/time;
3. binary -> four-outcome finite space;
4. system-random -> participant pre-session selection;
5. literal labels -> arbitrary labels;
6. arbitrary mapping -> reversed mapping;
7. full encoding -> semantic-only;
8. one supported audio recipe -> another;
9. stage duration change;
10. cue position change;
11. session reveal -> block reveal;
12. analysis window size change;
13. reopen/verify old bundle after new configs exist.

---

# 71. Formal test requirements — RNG/outcome

Test:

- bit domain;
- integer boundaries;
- unbiased sampling implementation structure;
- no naive modulo bias;
- deterministic provider exact repeatability;
- 30-bit boundary;
- token bijection;
- exact scoring;
- objective-state scoring independent of display label;
- tolerant non-flaky OS RNG smoke tests.

---

# 72. Formal test requirements — timing

Use fake/injected clocks where practical.

Test:

- immediate anchors;
- next eligible;
- relative seconds/minutes/hours/days;
- local date/time + timezone -> UTC;
- scheduled versus actual timestamps;
- lateness/error;
- pre/request/post classification;
- negative displacement metadata for pre-generated hidden;
- named anchors independent of numeric stage position;
- missed target;
- process/sleep-like interruption simulation;
- no backfill.

---

# 73. Formal test requirements — hands-free/reveal

Test:

- target assigned before START;
- memory confirmation required;
- mapping/target immutable after commitment;
- active normal path needs zero screen interaction;
- automatic stages/audio/cues/output;
- no hidden result before reveal;
- return goes to raw report first;
- subjective time captured before actual elapsed display;
- report lock enforced;
- block-level reveal enforced;
- forgotten target preserved;
- aborted session preserved.

Include HTTP/API tests proving hidden result fields are absent, not merely visually hidden.

---

# 74. Formal test requirements — audio

Test:

- 394/398 for A-U396-4;
- exact 100/104 pair;
- 396/396 sham;
- center 396 quick template -> 394/398;
- custom centered math;
- advanced direct L/R preservation;
- channel assignment;
- sample-rate metadata;
- deterministic WAV hash;
- no clipping in finite fixtures;
- deterministic noise;
- pink/red spectral tolerance where implemented;
- phased sweep tolerance;
- phase relationship;
- invalid Nyquist rejection;
- save/version recipe;
- unsaved preview cannot enter session;
- unlimited preview play/pause/resume/stop behavior.

---

# 75. Formal test requirements — logging/integrity

Test all requirements from the session-data spec, especially:

- ID allocation;
- collision prevention;
- state transitions;
- canonical serialization;
- event chain;
- edit/delete/reorder/insert tamper detection;
- atomic draft/final behavior;
- report lock immutability;
- late recollection append;
- machine-output block hash linkage;
- integrity manifest;
- commitment hash;
- logging failure fault injection/fail closed;
- crash/incomplete discovery;
- hidden-result log/API leakage prevention;
- session-index rebuild;
- block evidence/reveal;
- cross-session compatibility;
- session audit UI does not mutate evidence.

---

# 76. Formal test requirements — analysis/reporting

Test against fixed known fixtures:

- exact match;
- stream count/proportion/deviation;
- binomial function;
- cumulative deviation;
- windows;
- thresholds;
- change-point determinism if implemented;
- exact token probability;
- deterministic scientific report content;
- input hash provenance;
- incompatible profiles excluded from automatic pooling.

---

# 77. Required dry-run artifacts before real use

Before declaring ready for owner review, create and inspect:

1. full automated test results;
2. one RNG calibration bundle;
3. one complete dry `BASELINE_NOW_BINARY_V1` session;
4. one dry relative-delay run using fake/safe scheduling;
5. one dry absolute-time run;
6. arbitrary mapping run;
7. reversed mapping run/test;
8. semantic-only encoding run/test;
9. four-outcome run/test;
10. block-level reveal demonstration;
11. three initial audio presets;
12. one-number quick audio demonstration;
13. continuous Audio Lab manual controls;
14. deterministic finite WAV+manifest/hash for each required preset;
15. one deliberate event tamper fixture that verifier rejects;
16. one deliberate logging failure fixture that fails closed;
17. one deliberate missed-target fixture that is not backfilled;
18. one full Sessions/Reports manual audit of the dry immediate session;
19. final integrity verification for dry session/block.

Do not automatically launch a real participant session.

---

# 78. Documentation required

Create implementation documentation that explains completely:

- prerequisites;
- install;
- run;
- test;
- local URL/port;
- runtime data location;
- directory layout;
- config registries;
- schema/versioning;
- profile duplication/editing;
- block creation/assignment;
- session/trial IDs;
- state machine;
- named timing anchors;
- scheduler limitations;
- RNG provider interface;
- mapping/encoding separation;
- first immediate profile;
- relative/absolute timing;
- Audio Lab presets;
- one-number quick mode;
- simple/advanced custom audio;
- saving/versioning audio;
- formal-session audio boundary;
- calibration;
- session logging/event chain;
- raw report draft/lock;
- reveal policies;
- integrity verification;
- Sessions/Reports audit workflow;
- session export;
- deterministic analysis;
- cross-session comparability;
- crash/incomplete handling;
- known limitations;
- deferred hardware RNG/mobile/sensors;
- every historical audio parameter that remains reconstructed/unknown.

A new developer should be able to run and audit the system without first reading source code.

---

# 79. Implementation discipline

Do not hide incomplete work behind TODOs in mandatory paths.

Do not label a UI control `working` if the server path is stubbed.

Do not claim `supported` unless there is an executable/configurable path.

Do not use mock values in production/dry output without clear test-provider labels.

Do not alter scientific raw evidence to make tests pass.

Do not silently reduce a mandatory requirement because it is inconvenient.

If a requirement cannot be implemented correctly within the chosen architecture, report the exact blocker.

---

# 80. Git/repository discipline

Keep research/protocol/history documents intact unless implementation requires an explicitly requested correction.

Put implementation code/config/docs in clear locations.

Do not commit ordinary generated runtime participant data as source code.

Do commit deterministic test fixtures and intentionally generated non-sensitive dry fixtures if they are useful for regression tests and clearly labeled.

Do not commit secrets, machine-specific absolute paths, or private credentials.

---

# 81. Completion report — mandatory

When implementation is complete, give a precise report containing:

- exact files/directories created/changed;
- architecture implemented;
- exact install/run/test commands;
- application URL;
- tests passed/failed with counts;
- dry-run artifacts and their locations;
- audio preset verification;
- quick Audio Lab verification;
- configuration-only timing/mapping/encoding demonstrations;
- session logging/integrity verification;
- hidden-result leakage tests;
- block/reveal tests;
- crash/logging/timing failure tests;
- analysis fixture results;
- known limitations;
- deviations from this prompt;
- unimplemented mandatory requirements, if any;
- historical/reconstructed audio parameters still unknown;
- items requiring owner manual review before participant use.

For every mandatory feature classify it explicitly as one of:

- `IMPLEMENTED_AND_TESTED`
- `IMPLEMENTED_NEEDS_MANUAL_VERIFICATION`
- `INTENTIONALLY_DEFERRED_BY_SCOPE`
- `BLOCKED` with exact reason.

Do not use vague `supported in principle` language.

---

# 82. Final acceptance gate

Do not declare the build ready for owner review until all of the following are true or explicitly reported as blockers:

- one stable config-driven engine exists;
- first immediate binary profile works end-to-end;
- relative and absolute timing work through the same engine;
- mapping/encoding are separate from objective state;
- arbitrary/reversed mapping works by config;
- semantic-only variant works by config;
- four-outcome space works by config;
- block-level reveal works;
- hands-free normal path requires no post-START interaction until return;
- continuous hidden stream is preserved;
- no optional stopping in first profile;
- raw report locks before reveal;
- subjective time locks before actual time display;
- hidden output is absent from participant API before reveal;
- session/trial/block IDs are unambiguous;
- event chain is append-only/tamper-evident;
- machine output is losslessly preserved and hash-linked;
- logging failure fails closed;
- missed target is not backfilled;
- crash/incomplete sessions remain visible;
- integrity verifier detects deliberate tampering;
- session browser/audit view works;
- session index can be rebuilt;
- deterministic analysis works from fixtures;
- incompatible sessions are not silently pooled;
- Audio Lab has three presets;
- one-number mode computes channels automatically;
- Audio Lab can play indefinitely until manual pause/stop;
- simple and advanced custom audio paths exist;
- saved recipes are versioned;
- unsaved Audio Lab state cannot enter a committed session;
- deterministic preset WAV/manifest/hash fixtures are verified;
- no mobile/cloud/database scope was added;
- all tests/dry runs are documented;
- no real participant session was launched automatically.

The desired product is not a huge application.

It is a **small, precise, auditable, configuration-driven scientific instrument whose sessions can be reconstructed and reviewed without ambiguity and whose experiment behavior can evolve without rewriting the core engine**.
