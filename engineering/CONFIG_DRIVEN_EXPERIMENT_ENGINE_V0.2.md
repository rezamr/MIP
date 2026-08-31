# MIP Config-Driven Experiment Engine v0.2

## Status

`ACTIVE ARCHITECTURE DECISION — PRE-CODE FREEZE`

## Supersession

This file supersedes `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.1.md` for new implementation work.

Version 0.1 remains architectural history. Its core principle is retained, but v0.2 adds missing separation for participant mapping/encoding, block orchestration, runtime evidence, session/trial identity, and failure/recovery behavior.

## Architecture invariant

The application must remain:

`stable engine + versioned configuration + immutable per-session snapshots + append-only evidence + deterministic analysis`

The engine must not be rewritten for ordinary changes in timing, outcome space, participant mapping, request encoding, audio recipe, stage duration, reveal policy, or declared analysis windows.

---

# 1. Stable primitive families

Core code implements stable primitive families for:

- request assignment;
- objective outcome space;
- participant-facing outcome mapping;
- request-encoding profile;
- timing policy;
- machine-output policy;
- RNG provider;
- session protocol/stages;
- audio recipe/synthesis;
- analysis plan;
- reveal policy;
- reporting profile;
- block assignment/reveal;
- session/trial/block integrity and lifecycle.

New combinations of existing primitives should normally require configuration only.

A source-code change is acceptable for a genuinely new primitive, RNG adapter, DSP operation, analysis algorithm, storage schema version, or safety-critical behavior.

---

# 2. Configuration registries

Provide validated versioned registries conceptually equivalent to:

```text
config/
  schemas/
  profiles/
  outcome_spaces/
  outcome_mappings/
  request_encoding_profiles/
  request_assignment_policies/
  timing_policies/
  machine_output_policies/
  rng_providers/
  session_protocols/
  audio_recipes/
  analysis_plans/
  reveal_policies/
  reporting_profiles/
  block_plans/
```

Each object must include:

- stable immutable ID;
- schema version;
- name;
- status/usage label where relevant;
- parameters;
- deterministic validation.

Do not reuse an already-used immutable ID for different content.

---

# 3. Experiment profile

The experiment profile references at minimum:

- request-assignment policy;
- objective outcome space;
- participant-facing mapping;
- request-encoding profile;
- timing policy;
- machine-output policy;
- RNG provider;
- session protocol;
- audio recipe or declared assignment pool;
- analysis plan;
- reveal policy;
- reporting profile.

It may also reference a block plan or control/arm metadata where applicable.

At commitment, resolve all references into a complete effective configuration and snapshot/hash it.

---

# 4. Session/trial/block hierarchy

Keep separate objects:

- block;
- session;
- trial.

First baseline:

`one session = one primary REQUEST trial`

but schemas must retain independent IDs.

Blocks are optional and are used for:

- balanced requested-state assignment;
- balanced/randomized audio assignment;
- condition/profile ordering;
- block-level reveal;
- block-level deterministic analysis.

Do not use a database.

---

# 5. Request-assignment primitives

Required:

- `SYSTEM_RANDOM_UNIFORM`
- `SYSTEM_BALANCED_BLOCK`
- `PARTICIPANT_MANUAL_PRESESSION`
- `FIXED_PROFILE_VALUE`
- `IMPORTED_MANIFEST`

The core assignment engine operates on objective states, not display labels.

For balanced blocks, define counts/order before outcomes are inspected. Preserve aborted/incomplete members in the block history.

---

# 6. Objective outcome spaces

Required:

- `BINARY`
- `INTEGER_RANGE`
- `ENUM_SET`
- `EXACT_TOKEN_SPACE`

Support exact finite spaces through at least 30 bits without materializing the entire set.

Use unbiased integer sampling. Never use `Math.random()` for scientific target/request assignment.

The OS cryptographic implementation may use a platform primitive such as Node `crypto.randomInt` where its documented range requirements are satisfied.

---

# 7. Outcome mapping

Outcome mapping is independent of objective state.

Examples:

- literal `0/1`;
- `BLUE/GOLD`;
- reversed `GOLD/BLUE`;
- arbitrary symbols;
- state A/state B.

A mapping change is configuration, not a scoring-engine rewrite.

Scoring compares objective requested state to objective machine outcome.

---

# 8. Request-encoding profile

Encoding instructions are versioned configuration.

The first active encoding profile is based on `REQUEST_ENCODING_V0.2.md`.

The engine must support future semantic-only, visual-only, kinesthetic-only, completion-only, combined, arbitrary-mapping, reversed-mapping, and other versioned encoding profiles without hardcoding them into the session state machine.

---

# 9. Timing primitives

Required:

- `IMMEDIATE_REQUEST`
- `NEXT_ELIGIBLE_OUTPUT`
- `RELATIVE_DELAY`
- `ABSOLUTE_DATETIME`
- `ABSOLUTE_WINDOW`
- `RELATIVE_WINDOW`
- `CONTINUOUS_AROUND_REQUEST`
- `PREGENERATED_HIDDEN`

Timing policies reference named anchors, not stage indexes.

Store UTC for absolute timestamps and monotonic time for durations/order.

---

# 10. First active timing profile

First participant baseline uses immediate participant-facing semantics and continuous hidden stream around the request.

It does **not** require the participant to understand wall-clock target time.

Relative-delay and absolute-time support remain mandatory engine capabilities and must be demonstrated using dry/test profiles.

---

# 11. Scheduler contract

The local desktop application must not pretend that ordinary OS timers are laboratory-grade unattended schedulers.

For every scheduled event log:

- scheduled UTC;
- named anchor;
- requested delay;
- scheduler wake time;
- actual generation time;
- monotonic context;
- lateness/error;
- timing tolerance;
- detected interruption/sleep/clock discontinuity where practical.

For long delays/absolute times, the app may require the application/computer to remain active.

If the process stops or the target is missed beyond tolerance, mark a protocol deviation/incomplete timing result. Never backfill/regenerate an outcome and label it as on-time.

---

# 12. Machine-output primitives

Required:

- `SINGLE_OUTCOME`
- `FIXED_LENGTH_STREAM`
- `CONTINUOUS_STREAM`
- `WINDOWED_STREAM`

Output policies define count/rate/block size, anchors, storage representation, primary region, and stop conditions.

Ordinary MIP profiles use fixed declared operation with no optional stopping.

---

# 13. Stream implementation rule

High-rate stream generation may use timestamped blocks rather than a separate timestamp for every bit if the output policy explicitly defines that architecture.

For every block preserve:

- exact ordered outcomes or lossless packed representation;
- block index;
- scheduled/actual block timing;
- provider/version;
- outcome-space version;
- block hash.

Do not claim per-bit physical generation timing that the implementation did not measure.

---

# 14. RNG provider abstraction

Required initial providers:

- OS cryptographic provider;
- versioned deterministic seeded test provider.

Provider metadata includes stable algorithm/provider version.

Future physical/hardware/quantum adapters must fit the same experiment semantics.

A deterministic provider is for software validation/control and must not be presented as an entropy source equivalent to a physical RNG.

---

# 15. Session protocol/stage engine

Represent the hands-free session as a versioned ordered stage array.

Supported stage concepts include:

- timed wait/settle;
- instruction/documentation stage;
- cue emission;
- audio behavior;
- named-anchor emission;
- telemetry start/stop;
- request region;
- release region;
- neutral observation;
- return cue;
- post-return interaction.

The first active protocol is `MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`.

Changing a duration/cue using an existing primitive creates a new config version and does not require source changes.

---

# 16. Formal hands-free invariant

After START, the normal path requires no screen interaction until deliberate return.

The screen must not reveal hidden output or require the participant to declare state readiness.

Physical self-termination remains possible without software interaction.

---

# 17. Audio recipe architecture

Audio recipes are versioned data objects using the supported synthesis primitives.

Separate:

- Audio Lab exploratory preview state;
- saved/versioned audio recipes;
- committed research-session audio.

An unsaved Audio Lab state cannot enter a formal session.

Formal session audio parameters freeze at commitment.

---

# 18. Audio Lab

Required user levels:

- one-click presets;
- one-number quick mode;
- simple custom;
- advanced custom.

Continuous preview may play indefinitely until manual pause/stop.

The first three visible presets are:

- `A-U396-4`;
- `A-P100-104`;
- `A-SHAM-0`.

The default one-number template is `CENTERED_BINAURAL_4HZ_V1`.

---

# 19. Research-session audio reproducibility

Where a formal session uses a finite generated WAV, preserve the exact file and manifest hashes or a stable reference to the immutable generated asset.

Where live synthesis is used, preserve exact synthesis recipe/version/seed and enough metadata for deterministic reconstruction.

Do not claim unmeasured physical headphone output is identical to digital source bytes.

---

# 20. Analysis plans

Analysis behavior is configuration and must declare before data inspection:

- primary endpoint;
- primary region;
- secondary endpoints;
- exploratory windows/modules;
- scoring;
- thresholds/change-point algorithm/version where used;
- exclusion/deviation treatment;
- multiplicity treatment where needed;
- forgotten/aborted handling.

Generic diagnostics may be generated only when clearly labeled exploratory.

---

# 21. Reveal policies

Required:

- `AFTER_RAW_REPORT_LOCK`
- `AFTER_BLOCK_LOCK`
- `DELAYED_DATETIME`

Reveal enforcement is server-side.

Hidden outcome data must not be sent to the participant client before eligibility.

---

# 22. Evidence storage

Implement `SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md` as a hard requirement.

The authoritative evidence model includes:

- immutable configuration snapshot;
- commitment;
- append-only event hash chain;
- lossless machine output linked by hashes;
- raw-report lock;
- protocol deviations;
- reveal event/result;
- deterministic analysis;
- integrity manifest/verifier.

Mutable indexes/caches are rebuildable and not evidence.

---

# 23. Failure/recovery

Sessions are never deleted because of:

- participant abort;
- external interruption;
- process crash;
- audio failure;
- target lateness;
- logging failure;
- forgotten request.

The application must discover incomplete sessions at startup and classify/recover them without inventing missing events/outcomes.

---

# 24. Configuration editor

Provide a small local editor to:

- duplicate a profile;
- select/change supported primitive references/parameters;
- validate;
- save a new versioned object/profile;
- show effective resolved configuration;
- show raw read-only JSON.

Do not build a generic workflow language or plugin system.

---

# 25. Required shipped profiles

At minimum ship:

- `BASELINE_NOW_BINARY_V1`
- `DRY_RELATIVE_5MIN_BINARY_V1`
- `DRY_ABSOLUTE_TIME_BINARY_V1`
- `DRY_ARBITRARY_MAPPING_BINARY_V1`

Also ship enough configuration to demonstrate:

- reversed arbitrary mapping;
- semantic-only encoding;
- block-level reveal;
- four-outcome finite space.

These demonstrations may be test fixtures rather than first-use participant recommendations.

---

# 26. Backward compatibility

Old session bundles must never be silently rewritten to new schemas/defaults.

Readers/verifiers may support explicit legacy versions.

If a legacy bundle cannot meet current integrity verification, label it `LEGACY_UNVERIFIABLE` rather than fabricating evidence.

---

# 27. No-silent-conflict rule

Implementation must follow `ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`.

If older files conflict with this architecture, their older behavior remains historical and is not merged into active code unless an explicit compatibility mode is created.
