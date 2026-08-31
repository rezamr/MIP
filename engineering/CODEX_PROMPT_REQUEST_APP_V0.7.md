# Codex Prompt — MIP Config-Driven Research Engine v0.7

## Authority and execution rule

You are implementing the complete first local research application for the repository `rezamr/MIP`.

Do not begin by guessing the project from this prompt alone. Before touching implementation code, read the repository in full enough to understand the current source of truth, beginning with the exact startup order below and then every engineering/research file listed in this prompt.

Treat the repository as the durable project memory. When older files conflict with newer active decisions, follow the explicit supersession/version rules in the newer files and preserve old files as historical project records.

Before coding, read in full:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
7. `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
8. `04_EVIDENCE_STANDARD.md`
9. `10_CONVERSATION_ORCHESTRATION.md`
10. `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md`
11. `protocols/REQUEST_ENCODING_V0.1.md`
12. `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
13. `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
14. `protocols/MIP_NUM_REQUEST_V0.1.md`
15. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
16. `research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md`
17. `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
18. `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`
19. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
20. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
21. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
22. `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
23. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
24. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
25. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.1.md`
26. `engineering/CODEX_PROMPT_REQUEST_APP_V0.6.md`

This v0.7 prompt supersedes older Codex implementation prompts wherever there is a conflict. Older prompt files remain project history and must not be deleted.

Do not silently rewrite research protocols. If implementation reveals a genuine contradiction or impossible requirement, stop that affected feature, document the exact conflict, preserve the rest of the build, and make the smallest clearly versioned protocol/engineering correction required.

---

# 1. Mission

Build **one small, auditable, future-proof local research engine**, not a one-off application hardcoded to today's binary immediate-request experiment.

The codebase should remain stable while experiments change through validated, versioned configuration.

The architecture principle is:

`stable engine code + versioned experiment profiles + immutable session snapshots + append-only raw data + deterministic analysis`

The first real participant profile is intentionally simple, but that is a **profile choice**, not an engine limitation.

The engine must already be capable, by configuration rather than source-code forks, of experiments such as:

- system assigns `0` or `1`, participant requests the assigned state now;
- participant requests the next eligible output;
- participant requests a target five seconds/minutes/hours/days later;
- participant requests a target at an absolute local date/time such as tomorrow at 10:00;
- participant requests a target during a defined time window;
- machine logs a continuous hidden stream before/during/after the request;
- machine creates a hidden pre-generated target before the request;
- system assigns the request, participant chooses it, a balanced block assigns it, or a precommitted manifest supplies it;
- outcome space is binary, a finite integer range, an explicit symbol set, or a large exact-token space;
- participant-facing symbols are literal numbers, arbitrary labels/colors/shapes, reversed mappings, or state-A/state-B labels;
- request encoding is semantic-only, visual-only, kinesthetic-only, goal/completion-only, or a combined multimodal bundle;
- different supported audio recipes are selected without editing session logic;
- stage lengths/cue positions change through protocol configuration;
- result reveal occurs after a session report lock, after an entire block, or at a delayed date/time;
- analysis windows and declared endpoints change through versioned analysis configuration.

Future-proofing must come from a **small stable vocabulary of primitives**, not from a plugin platform or giant workflow framework.

---

# 2. Scientific/interpretive boundary

The application is a protocol controller, random-output generator, audio synthesizer/player, immutable logger, deterministic analyzer, and report generator.

It must never claim that:

- MATRIX is established;
- a hit proves anomalous influence;
- an unusual subjective event proves an external cause;
- a frequency guarantees a brain state;
- a patent proves an earlier historical waveform was used;
- the participant's feeling of acknowledgement is equivalent to an objective machine result;
- MATRIX understands digits, words, colors, feelings, or any specific representation.

Operational words such as `MATRIX`, `request`, `send`, `encode`, or `communication` describe the experimental task only.

Preserve the repository evidence standard: observation, interpretation, and conclusion remain separate.

---

# 3. Hard scope limits

The first implementation is **local-computer only**.

Do NOT implement:

- Android packaging;
- iOS packaging;
- phone application shells;
- phone installation;
- phone-to-computer control;
- application-level Bluetooth protocols;
- cloud services;
- remote accounts;
- authentication/user systems;
- synchronization;
- telemetry/analytics;
- SQL;
- SQLite;
- MongoDB;
- any database engine;
- plugin marketplaces;
- arbitrary runtime code loading;
- a custom scripting language;
- a drag-and-drop workflow designer;
- generative AI as a runtime dependency.

Bluetooth headphones are allowed only as the operating system's ordinary audio output. The application itself does not pair/control Bluetooth hardware.

Keep the implementation small enough to audit manually and debug locally.

---

# 4. Technology target

Prefer:

- Node.js 22+;
- ECMAScript modules;
- built-in `crypto`, `fs`, `path`, `http`, timers, and platform APIs where practical;
- minimal external dependencies;
- plain local HTML/CSS/JavaScript UI;
- local server bound to `127.0.0.1` only;
- JSON for structured configuration/state;
- JSONL for append-only event streams.

Do not add a framework merely for visual polish.

The first priority is correctness, traceability, deterministic behavior, testability, and low debugging complexity.

---

# 5. Required high-level modules

Organize the code cleanly enough that the following responsibilities are separable even if the exact filenames differ:

1. configuration/schema loader and validator;
2. experiment-profile resolver;
3. session state machine;
4. named-event/timing engine;
5. request-assignment engine;
6. outcome-space/mapping engine;
7. random-source provider interface;
8. machine-output/stream generator;
9. audio synthesis engine;
10. Audio Lab continuous player;
11. research-session audio controller;
12. append-only event logger/hash chain;
13. raw machine telemetry writer;
14. raw participant-report manager and lock;
15. deterministic analysis engine;
16. deterministic report generator;
17. calibration utilities;
18. local UI/router/server.

Avoid circular coupling between experiment semantics and one particular UI screen.

---

# 6. Persistent file layout

Use a clear local filesystem layout similar to:

```text
data/
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
  audio/
    generated/
    manifests/
  sessions/
    <SESSION_ID>/
      config_snapshot/
      commitment.json
      request.json
      events.jsonl
      raw_machine_output.jsonl
      raw_report.json
      analytical_report.json
      result.json
      hashes.json
  calibration/
  blocks/
```

You may simplify names, but preserve the separation of concerns.

A committed session must remain independently interpretable even if global configuration changes later.

---

# 7. Versioned configuration rules

Every configuration object must include at least:

- stable ID;
- schema version;
- human-readable name;
- status/usage label where relevant;
- parameters;
- deterministic validation.

Never silently mutate a configuration/profile already referenced by a committed session.

If a material parameter changes, create a new ID/version.

At session commitment:

1. resolve every referenced configuration object;
2. create one complete effective configuration;
3. copy all effective objects into the session's `config_snapshot`;
4. hash every snapshot object;
5. store the application version, schema versions, synthesis versions, RNG provider version, analysis version, and report-generator version;
6. make the session independent of later global changes.

The application must be able to open and verify historical session bundles without rewriting them to current defaults.

---

# 8. Experiment profile

The experiment profile is the main selectable research unit.

It must reference at minimum:

- request-assignment policy;
- objective outcome space;
- participant-facing outcome mapping;
- request-encoding profile;
- timing policy;
- machine-output policy;
- RNG provider;
- hands-free/session protocol;
- audio recipe or audio assignment pool;
- analysis plan;
- reveal policy;
- reporting profile.

Implement:

- load;
- validate;
- duplicate;
- save as new version;
- select;
- inspect effective configuration;
- commit immutable snapshot.

Do not permit START while the effective profile is invalid.

---

# 9. Request assignment

Implement these policies as stable primitives:

## `SYSTEM_RANDOM_UNIFORM`

Uniformly select the requested objective state from the declared outcome space.

## `SYSTEM_BALANCED_BLOCK`

Use a predeclared balanced/randomized block schedule so conditions such as requested `0` and `1` remain balanced across the block.

## `PARTICIPANT_MANUAL_PRESESSION`

Participant chooses the requested state before commitment.

## `FIXED_PROFILE_VALUE`

A profile declares a fixed value for dry runs/debug/special tests.

## `IMPORTED_MANIFEST`

Assignments come from a precommitted local manifest.

The current first participant profile uses system-random uniform binary assignment.

Do not hardcode binary values into the core request-assignment engine.

---

# 10. Objective outcome spaces

Implement at minimum:

## `BINARY`

Finite set `{0,1}`.

## `INTEGER_RANGE`

Uniform finite integer range with explicit inclusive/exclusive schema.

## `ENUM_SET`

Explicit finite strings/symbols/labels.

## `EXACT_TOKEN_SPACE`

Uniform integer index over a finite declared space with deterministic one-to-one human-readable token mapping.

Support at least the existing MIP entropy staircase through 30 bits:

- 2;
- 4;
- 16;
- 256;
- 65,536;
- 1,048,576;
- 1,073,741,824 outcomes.

Do not materialize huge pools in memory merely to sample one index.

Use cryptographically secure unbiased integer generation/rejection sampling or platform functionality that is unbiased for the required range.

Never use naive modulo reduction where it creates bias.

For exact-target modes, primary scoring is exact equality only unless a separately versioned exploratory analysis explicitly declares otherwise.

---

# 11. Separate machine state from participant representation

This is a hard architectural requirement.

Do not treat the string displayed to the participant as the objective outcome itself.

Keep separate:

1. objective requested machine state;
2. participant-facing target label;
3. internal request-encoding instructions;
4. objective scoring endpoint.

Implement `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md` completely.

An arbitrary mapping such as:

`BLUE -> objective state 1`

`GOLD -> objective state 0`

must be possible through configuration only.

A reversed mapping must also be possible by a new mapping configuration only.

The scoring engine must continue scoring the precommitted objective requested state, not the literal label string.

---

# 12. First request-encoding bundle

Ship the current symmetric multimodal baseline as a request-encoding configuration.

For objective state `1`, support/document:

- semantic target `one` / state 1;
- simple upright-stroke/numeral representation if natural;
- straight/upward kinesthetic representation;
- endpoint concept that the machine is in the objective state designated 1;
- neutral-to-moderate completion/certainty;
- matched affective intensity.

For objective state `0`, support/document:

- semantic target `zero` / state 0;
- simple closed-loop/numeral representation if natural;
- closed/circular kinesthetic representation;
- endpoint concept that the machine is in the objective state designated 0;
- the same neutral-to-moderate completion/certainty;
- matched affective intensity.

Do not make state `1` emotionally positive and state `0` negative.

The participant may use a nonvisual modality and report the actual modality afterward.

The engine must later allow semantic-only, visual-only, kinesthetic-only, goal/completion-only, combined, arbitrary mapping, reversed mapping, and nonnumeric state-label profiles without rewriting core session code.

---

# 13. Timing engine

Timing is a first-class configuration primitive.

Implement all of the following in the same engine:

## `IMMEDIATE_REQUEST`

The participant-facing semantics are equivalent to:

`Make/favor the requested objective state now.`

The machine may already be logging a hidden continuous stream before the request cue.

## `NEXT_ELIGIBLE_OUTPUT`

Score the first predeclared eligible output after a named anchor such as request completion or release.

## `RELATIVE_DELAY`

Target event/window occurs after a configured delay from a named anchor.

Support seconds, minutes, hours, and days.

Examples:

- 5 seconds after request end;
- 5 minutes after release;
- 24 hours after commitment.

## `ABSOLUTE_DATETIME`

User enters an explicit local date/time.

Store:

- local date/time input;
- timezone/offset;
- authoritative converted UTC;
- scheduled execution timestamp;
- actual execution timestamp;
- scheduler error.

## `ABSOLUTE_WINDOW`

Explicit date/time start and end.

## `RELATIVE_WINDOW`

Window defined relative to a named anchor.

## `CONTINUOUS_AROUND_REQUEST`

Hidden stream begins before the request and continues during and after request/release.

## `PREGENERATED_HIDDEN`

Generate/commit the hidden target before participant request, reveal only after lock according to policy, and keep this experimental family separate from ordinary future-generated request trials.

The current first participant profile uses immediate semantics because subjective time may be distorted in trance. Do not remove relative/absolute capabilities just because the first profile does not emphasize them.

---

# 14. Named timing anchors

Do not hardcode timing to stage numbers such as `stage 8`.

Use named events at minimum:

- session commitment;
- session start;
- audio start;
- induction cue;
- request cue;
- request start;
- request end;
- release start;
- release end;
- target event/start;
- target end;
- return cue;
- participant return confirmation;
- raw report start;
- raw report lock;
- reveal.

For durations use a monotonic clock. For stored absolute event time use UTC.

Store scheduler wake time and actual output-generation time separately where relevant.

---

# 15. Machine-output policies

Implement at minimum:

## `SINGLE_OUTCOME`

One objective outcome at the declared target event.

## `FIXED_LENGTH_STREAM`

Generate exactly `N` outcomes. `N` is configuration.

No optional stopping in ordinary MIP profiles.

## `CONTINUOUS_STREAM`

Generate fixed-rate or fixed-block outcomes across a declared interval.

## `WINDOWED_STREAM`

Generate/analyze explicitly named pre/request/immediate-post/later-post windows.

Machine output policy must define:

- count/rate/block size;
- start condition/anchor;
- end condition;
- outcome space;
- storage representation;
- primary scoring region;
- telemetry precision.

A historically replicated sequential stopping algorithm, if added later, must be a separate explicitly labeled policy and never silently replace fixed-length MIP operation.

---

# 16. Continuous stream around the first request

The first active baseline must support a hidden stream that is already running before the request cue, continues through request encoding/release, and continues afterward.

This allows objective analysis of:

- pre-request baseline;
- request/immediate region;
- first possible change onset;
- latency;
- peak deviation;
- persistence;
- decay/return to baseline.

Pre/request/post windows and primary endpoints must be declared before outcome inspection.

Do not select a favorable neighboring window after the fact and relabel it as the primary result.

---

# 17. Random-source provider interface

Define a stable provider interface conceptually equivalent to:

```text
id
name
version
source_type
generate_integer(max_exclusive)
generate_outcome(outcome_space)
generate_bit()
generate_bits(n)
health_check()
metadata()
```

Implement initially:

1. operating-system cryptographically secure random provider;
2. deterministic seeded provider for reproducible software tests.

Future hardware/noise/quantum providers must be addable behind this interface without rewriting experiment-profile semantics.

Do not describe software cryptographic randomness as physically equivalent to historical electronic-noise/radioactive sources.

---

# 18. Calibration

Provide a calibration area that generates random output with no participant request/intention session.

Calibration must support:

- large binary blocks;
- finite-integer/outcome-space smoke testing;
- count/frequency summaries;
- bias statistics;
- basic serial-correlation diagnostics where implemented;
- uniformity smoke tests;
- timestamps;
- RNG provider/version;
- output hash/bundle integrity.

Calibration output must be stored separately from participant sessions.

---

# 19. Session protocol engine

The hands-free sequence must be configuration-driven.

Represent stages as a versioned ordered array instead of hardcoded business logic.

Each stage should support, where appropriate:

- stage ID;
- stage type;
- duration or completion rule;
- start/end cue;
- participant instruction/documentation text;
- hands-free flag;
- emitted named timing anchors;
- machine telemetry on/off;
- audio behavior;
- analysis-window membership;
- transition rule.

Changing an existing stage duration or cue position must be possible by creating a new session-protocol configuration when existing stage primitives are sufficient.

---

# 20. First hands-free session profile

Instantiate the current operational procedure from repository protocol files.

Before active induction:

- select/resolve experiment profile;
- record baseline participant fields required by protocol;
- assign requested state according to policy;
- map it to the participant-facing label/encoding bundle;
- display target and encoding instructions clearly;
- require explicit memory confirmation;
- show effective profile summary;
- create commitment and all hashes;
- present one large START control.

After START:

- no screen interaction is required;
- no normal button press is required;
- screen may dim/blank or remain non-informative;
- audio runs automatically;
- stage cues run automatically;
- machine telemetry runs automatically;
- target/output generation runs automatically;
- output remains hidden;
- the return cue runs automatically.

The configured first session stages should preserve the current playbook structure:

1. passive settling;
2. attentional separation/conversion-box analogue;
3. slow resonant breathing/tuning analogue;
4. circulating-field/REBAL analogue;
5. neutral orientation statement;
6. progressive Focus-10-style relaxation;
7. state stabilization;
8. request semantic/representation encoding;
9. controlled matched completion/certainty component;
10. release;
11. neutral observation/hold appropriate to selected timing policy;
12. post-target/continuing observation where applicable;
13. return cue and deliberate return;
14. raw report;
15. reveal according to policy.

The exact durations and cue positions come from configuration, not hardcoded constants.

For the first active immediate profile, request wording must follow the current immediate timing decision, not the older fixed-clock wording. Participant-facing semantics should be equivalent to:

`Make/favor the assigned system state now.`

Exact machine time remains logged internally.

---

# 21. Hands-free safety/abort behavior

During active operation the participant must not be required to operate the computer to stop.

Physical self-termination always remains possible:

- open eyes;
- remove/lift headphones;
- return to ordinary orientation.

After return, allow the participant to mark the session `ABORTED/TERMINATED` with an approximate reason/time.

Preserve the session and raw machine data; do not silently delete it.

If the assigned request value was forgotten, do not ask the participant to guess. Preserve `REQUEST_VALUE_FORGOTTEN=true` and handle it only through the declared analysis exclusion rule.

---

# 22. Audio synthesis engine

Implement `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md` fully.

The audio engine must support a layered stereo recipe built from supported primitives such as:

- one or more left/right carrier components;
- binaural frequency differences;
- monaural within-channel relationships;
- amplitude envelopes;
- amplitude modulation;
- frequency modulation;
- ordinary masking noise;
- deterministic noise;
- phased/swept pink/red masking-noise architecture;
- cue tones;
- fades;
- normalization/headroom.

Adding a new combination of already-supported synthesis layers should require a new audio recipe configuration, not source changes.

A genuinely new signal-processing primitive may require code and must be versioned.

Store exact recipe, derived values, algorithm versions, sample rate, seed where relevant, normalization rule, manifest, and hash.

---

# 23. Historical audio provenance

Never label a generated waveform as an exact 1983 Gateway/CENTER LANE waveform unless all material parameters are source-verified in the repository.

The application may accurately label:

- an exact MIP-defined condition;
- a documented Monroe patent example;
- a patent-grounded reconstruction;
- an experimental MIP reconstruction;
- an unverified historical candidate.

Unknown coefficients/parameters may not be silently invented and represented as recovered history.

---

# 24. Required initial audio presets

Ship at least these first-use recipes:

## `A-U396-4`

- center/base = `396 Hz`;
- beat = `4 Hz`;
- left = `394 Hz`;
- right = `398 Hz`;
- status: user experimental/personal baseline reconstructed from current documented synthesis rule.

## `A-P100-104`

- left = `100 Hz`;
- right = `104 Hz`;
- beat = `4 Hz`;
- arithmetic center = `102 Hz`;
- status: documented simple Monroe patent example.

Preserve the explicit 100/104 pair.

## `A-SHAM-0`

First matched sham:

- left = `396 Hz`;
- right = `396 Hz`;
- beat = `0 Hz`;
- center = `396 Hz`;
- status: control.

Additional already-defined recipes may exist in configuration, but the first-use interface should not be cluttered.

---

# 25. Audio Lab — mandatory easy playback/generation area

Implement `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md` completely.

The Audio Lab is separate from formal research-session execution.

The normal user must never have to calculate left/right values manually for ordinary binaural conditions.

The Audio Lab home should expose:

1. one-click presets;
2. one-number quick mode;
3. simple custom mode;
4. advanced custom mode.

---

# 26. Audio Lab presets

One click selects and prepares each of:

- user 396/4 condition;
- Monroe 100/104 comparator;
- matched no-beat sham.

Show actual left/right frequencies read-only before playback.

Normal flow:

`select preset -> Play`

No manual channel calculation.

---

# 27. Audio Lab one-number quick mode

Provide a mode where the user enters one center/carrier frequency only.

Use a selected quick template to supply assumptions.

Default quick template:

`CENTERED_BINAURAL_4HZ_V1`

User enters only center frequency.

Template uses:

- beat = 4 Hz;
- centered pair;
- sine waveform;
- safe software gain/headroom;
- no masking noise by default.

Compute:

`left = center - 2`

`right = center + 2`

More generally:

`left = center - beat/2`

`right = center + beat/2`

Show computed left/right/difference as read-only values.

Do not pretend the one number alone mathematically defines the audio; show that the selected template supplies the 4-Hz rule.

---

# 28. Audio Lab simple custom mode

Allow at minimum:

- center frequency;
- beat/difference;
- waveform where supported;
- gain;
- fade settings for finite export;
- optional ordinary masking noise/level when supported.

Automatically derive left/right.

Show calculated values immediately.

Allow saving as a new versioned audio recipe.

---

# 29. Audio Lab advanced custom mode

Expose supported advanced primitives without forcing ordinary users to see them.

Allow, where implemented:

- direct left/right entry;
- multiple carriers;
- per-component levels;
- AM/FM;
- noise types;
- seed;
- phased/swept patent-grounded noise;
- delay/sweep relationships;
- left/right phase relationship;
- Septon architecture;
- sample rate;
- normalization/headroom;
- finite export duration.

Always show provenance/status for historical/reconstructed modes.

---

# 30. Unlimited Audio Lab playback

Audio Lab preview must play continuously until manually paused or stopped.

Required controls:

- Play;
- Pause;
- Resume;
- Stop.

Do not impose a hidden application duration limit.

Pure-tone generation must maintain phase continuity across buffers.

Noise modes must use deterministic stored seed/algorithm where deterministic reproduction is intended.

Avoid obvious clicks/pops at buffer/loop/pause boundaries.

Continuous preview should not require creating an ever-growing WAV file.

Stopping a preview must not alter/save the recipe unless the user explicitly saves.

---

# 31. Audio Lab recipe-to-session rule

An unsaved temporary Audio Lab state can never silently become research-session audio.

To use an Audio Lab setup in a formal session:

1. validate it;
2. save it as a versioned recipe;
3. select/reference that recipe in an experiment profile;
4. commit the profile/session snapshot;
5. hash the effective audio configuration.

Research-session audio cannot be manually edited after commitment.

Audio Lab manual pause/stop behavior must never leak into formal hands-free session logic.

---

# 32. Audio validation

Before playback/export/commit validate at minimum:

- finite numeric parameters;
- positive frequencies where required;
- centered calculations do not produce zero/negative channels;
- all frequencies below selected Nyquist limit;
- difference equals derived channel difference;
- supported sample rate;
- supported waveform/primitive;
- finite gain;
- defined headroom;
- no clipping in deterministic rendered verification vectors;
- unsupported historical parameters clearly marked/rejected when required.

Never silently modify an invalid frequency into a valid one.

---

# 33. Patent-grounded phased-pink capability

Implement the recoverable architecture described in the current audio requirements, including, where source-supported:

- deterministic 16-bit shift-register noise generator mode;
- 65,535-sample sequence behavior for that patent-style mode;
- filtering toward pink/red noise;
- delay-line/comb-filter processing;
- low-frequency delay sweep near 1/8 Hz;
- configurable left/right sweep phase/amplitude relationship;
- envelope;
- support for documented AM/FM and multi-carrier structures.

Any unrecovered coefficient or exact earlier historical parameter must be explicit configuration labeled as MIP reconstruction, not silently guessed.

This advanced capability must not clutter the three-preset first-use audio screen.

---

# 34. Event logging and tamper-evident chain

Use append-only JSONL event records.

Each event should contain conceptually:

- event index;
- UTC timestamp;
- monotonic time/duration context;
- event type;
- payload;
- previous hash;
- event hash.

Calculate event hash using canonical deterministic serialization and SHA-256.

At session close generate hashes for all session files.

Preserve late recollections as new append-only events; never rewrite a locked raw report.

---

# 35. Continuous machine telemetry

Implement `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`.

For stream/temporal profiles preserve enough ordered data to reconstruct the machine-output history exactly.

Log at minimum:

- session commitment/start;
- audio start;
- every cue/stage transition;
- request start/end;
- release start/end;
- every output or deterministically defined output block;
- target/window start/end;
- return cue;
- participant-return confirmation;
- raw-report lock;
- reveal.

Where storage is large, a lossless block representation is acceptable only if exact event sequence/timing can be reconstructed according to the declared policy.

---

# 36. Trend/onset analysis

The deterministic analysis layer must support, where declared by the analysis plan:

- total zero/one or outcome counts;
- signed requested-direction deviation;
- cumulative requested-direction deviation over time;
- fixed-window deviation series;
- first prespecified threshold crossing;
- first sustained threshold crossing under a versioned rule;
- exploratory deterministic change-point estimate;
- peak deviation time;
- sustained-deviation duration;
- return-to-baseline estimate;
- offsets relative to request cue/start/end, release, target, and return.

The change-point result is exploratory unless specifically declared otherwise. It may never redefine the primary target window after data inspection.

---

# 37. Participant subjective-state timeline

Without sensors, do not claim objective knowledge of internal-state onset.

After ordinary return and before reveal, collect retrospective estimates relative to remembered audible cues for at least:

- first clear state change;
- first vibration/pulse;
- first rotation/vestibular effect;
- first spontaneous imagery;
- first sensed presence/interaction;
- strongest-state period;
- acknowledgement-like event if any;
- return toward ordinary state.

Allow `unknown` and `not experienced`.

Store this separately from machine telemetry.

---

# 38. Subjective time distortion

Before showing actual elapsed session time, require/offer the participant to record:

- estimated total session duration;
- estimated request-cue-to-return duration;
- whether time felt compressed, expanded, discontinuous, or ordinary;
- confidence in the estimate.

Only after this subjective estimate is locked may the UI display actual machine-recorded elapsed time in the report/reveal flow.

Never substitute subjective time for machine timestamps.

---

# 39. Raw participant report before reveal

Immediately after participant return, the application must navigate to the raw-report interface and reveal no hidden machine result.

Capture at minimum, with `unknown/not experienced` options where appropriate:

- subjective duration estimates;
- overall state intensity;
- alertness;
- imagery;
- auditory phenomena;
- somatic/vibration/pulse;
- rotation/vestibular effects;
- sensed presence/interaction;
- perceived agency;
- time distortion;
- exact participant-facing requested label;
- request-encoding modality actually used;
- representation clarity;
- affect intensity;
- certainty;
- spontaneous conflicting target/label;
- acknowledgement-like experience;
- interruptions;
- forgotten target;
- abort/termination;
- free raw notes.

Allow the participant to record a pre-reveal belief about whether the request succeeded, but label it subjective/phenomenological only.

Then lock the raw report.

Reveal must be rejected before the configured policy permits it.

---

# 40. Reveal policies

Implement at minimum:

## `AFTER_RAW_REPORT_LOCK`

Current default first participant profile.

## `AFTER_BLOCK_LOCK`

Hide individual results until a prespecified block is complete/locked.

## `DELAYED_DATETIME`

Reveal only after configured absolute date/time.

Never expose hidden output through another UI route, logs shown on screen, URL payload, debug endpoint, or report preview before reveal is permitted.

---

# 41. Deterministic analytical report

After lock/reveal eligibility, generate a reproducible analytical report from stored data.

It must include, as applicable:

- application/engine version;
- effective experiment profile;
- configuration hashes;
- request-assignment policy;
- objective requested state;
- participant-facing mapping;
- request-encoding profile;
- session protocol and cue/stage timeline;
- audio recipe/manifest/hash;
- RNG provider/version;
- timing policy;
- scheduled and actual event times;
- scheduler error;
- exact outcome;
- stream statistics;
- primary endpoint result;
- secondary endpoints;
- pre/request/post window comparison;
- trend/onset/change-point diagnostics;
- participant subjective timeline;
- subjective vs actual time;
- forgotten/abort/protocol-deviation flags;
- integrity/hash validation;
- same-profile prior-session comparison only when scientifically valid.

The same locked input must reproduce the same analytical report.

Do not use generative AI for this report.

---

# 42. Cross-session/block report

Support deterministic comparison across sessions/blocks when configurations permit valid comparison.

Potential modules include:

- audio condition;
- requested objective state;
- participant-facing mapping;
- encoding profile;
- sham/no-intention condition;
- timing policy/delay;
- target window vs neighboring windows;
- subjective-state strength vs objective performance;
- subjective-time distortion;
- onset timing;
- forgotten/aborted rates.

Do not declare a condition `better` based on a single session.

Do not silently pool sessions with materially different profiles.

---

# 43. Main user interface

Keep the first interface simple despite the configurable engine.

Required main navigation:

1. **Start Research Session**
2. **Audio Lab**
3. **Experiment Profiles**
4. **Calibration**
5. **Sessions / Reports**

Advanced configuration belongs behind profile/custom screens, not on the main participant path.

---

# 44. Start Research Session flow

Recommended UI flow:

1. select experiment profile;
2. validate effective configuration;
3. show concise human-readable summary;
4. collect any pre-session baseline fields;
5. assign requested objective state;
6. resolve participant-facing label/mapping and encoding instructions;
7. display the assigned target prominently;
8. participant confirms memory;
9. show final effective profile/critical settings summary without hidden future output;
10. create commitment/hash snapshot;
11. enable one large START action;
12. enter hands-free mode;
13. automatic stages/audio/cues/telemetry/output;
14. return cue;
15. participant confirms ordinary return;
16. raw report;
17. lock;
18. reveal if allowed;
19. deterministic report.

Do not require target re-reading after START.

---

# 45. Profile editor

Build a deliberately small configuration/profile editor.

Allow user to:

- duplicate an existing profile;
- change request-assignment policy;
- change objective outcome space;
- change participant-facing mapping;
- change request-encoding profile;
- change timing mode;
- configure now/next/relative delay/absolute date-time/window parameters;
- change output policy/count/rate/windows;
- choose RNG provider;
- choose session protocol;
- choose one audio recipe or an assignment pool;
- choose analysis plan;
- choose reveal policy;
- choose reporting profile;
- validate;
- save as a new versioned profile;
- inspect a read-only effective JSON view.

Do not build a large visual workflow designer.

---

# 46. Configuration validation examples

Reject before commitment:

- unknown referenced IDs;
- request value outside objective outcome space;
- mapping missing an objective state;
- encoding profile missing required mapping entry;
- absolute time lacking timezone/offset;
- relative timing referencing a nonexistent anchor;
- target/analysis window outside generated telemetry coverage;
- stream analysis with single-outcome-only policy;
- unsupported audio primitive;
- invalid frequency/sample-rate relation;
- reveal policy allowing output before required lock;
- contradictory stage transitions;
- invalid outcome-space size;
- duplicate immutable IDs with conflicting content;
- invalid schema version.

Errors must name the actual invalid object/field and prevent START.

---

# 47. Commitments

Before active session starts, create a commitment containing enough information to prove the planned trial configuration existed before outcome generation.

Include as applicable:

- session/trial ID;
- objective requested state;
- participant-facing mapping ID/version;
- request encoding ID/version;
- timing policy and target/window data;
- session protocol;
- audio recipe;
- RNG provider;
- machine-output policy;
- analysis plan;
- reveal policy;
- nonce;
- configuration hashes.

For future-generated target modes, do not include a target that does not yet exist.

For pre-generated hidden/READ modes, commit hidden target + nonce according to the relevant protocol before participant response/request while preventing participant access.

---

# 48. Required shipped research profiles

Ship at least:

## `BASELINE_NOW_BINARY_V1`

First intended participant profile:

- system-random binary objective request;
- literal 0/1 participant mapping initially;
- symmetric multimodal binary encoding profile;
- request known/memorized before induction;
- hands-free protocol;
- participant-facing time = immediate/now;
- continuous hidden stream before/during/after request;
- initial audio assignment pool using current comparison recipes;
- raw report before reveal;
- subjective-time estimate before actual time;
- reveal after raw-report lock.

## `DRY_RELATIVE_5MIN_BINARY_V1`

Same basic architecture but target timing configured for five minutes after a named request anchor.

This may remain a dry/test profile initially.

## `DRY_ABSOLUTE_TIME_BINARY_V1`

Same basic architecture but target timing comes from explicit local date/time converted/committed to UTC.

This may remain a dry/test profile initially.

## `DRY_ARBITRARY_MAPPING_BINARY_V1`

Keep objective binary states but use arbitrary participant-facing labels/mapping. This profile exists to prove mapping is not hardcoded to literal digits.

The dry profiles are architectural acceptance demonstrations, not necessarily immediate participant recommendations.

---

# 49. Required first audio recipes/templates

Ship:

- `A-U396-4`;
- `A-P100-104`;
- `A-SHAM-0`;
- quick template `CENTERED_BINAURAL_4HZ_V1`.

Other repository-defined conditions may be included as non-primary/advanced configuration if their provenance status is preserved.

---

# 50. Tests — configuration and future-proofing

The build is not complete unless, without editing experiment-engine source code, tests/demonstrations can:

1. switch immediate request to a five-minute relative delay;
2. switch relative delay to an explicit absolute date/time;
3. switch binary outcome space to a four-outcome finite space using existing primitive;
4. switch request assignment from system-random to participant-selected pre-session;
5. replace literal `0/1` labels with arbitrary labels;
6. reverse the arbitrary mapping;
7. replace full request encoding with semantic-only using configuration;
8. change one supported audio recipe to another;
9. change a stage duration;
10. change cue placement using existing stage primitives;
11. change reveal from per-session to block-level;
12. change pre/request/post analysis-window sizes;
13. reopen and verify old sessions after all these new configurations exist.

If any of these require source-code modification despite using already-supported primitives, the architecture requirement is not satisfied.

---

# 51. Tests — RNG and outcome spaces

Test at minimum:

- bit generation domain correctness;
- integer range boundaries;
- no modulo bias implementation error;
- large configured exact-token boundary values through 30 bits;
- token index -> display token -> index bijection;
- deterministic provider repeatability;
- cryptographic provider smoke/uniformity tests;
- exact-match scoring;
- mapping scoring uses objective state, not display text.

Statistical smoke tests must not be written so rigidly that a valid random sample causes flaky CI under ordinary chance variation. Use sensible deterministic/structural tests plus appropriately tolerant statistical checks.

---

# 52. Tests — timing

Test with fake/injected clocks where practical:

- immediate anchor behavior;
- next-eligible behavior;
- relative seconds/minutes/hours/days conversion;
- absolute local datetime + timezone to UTC conversion;
- target scheduling;
- scheduled vs actual timestamp capture;
- scheduler error computation;
- pre/request/post window classification;
- negative temporal displacement metadata for pre-generated hidden mode;
- named anchors independent of stage numeric position.

---

# 53. Tests — hands-free and reveal

Verify:

- assigned participant-facing target exists before START;
- memory confirmation required;
- target/mapping cannot change after commitment;
- normal active-session progression requires zero screen interaction after START;
- automatic audio/cues/timing/output occur;
- hidden result remains unavailable;
- return leads to raw-report screen first;
- reveal before lock is rejected;
- forgotten-request trial is preserved;
- physically aborted trial can be preserved/marked after return;
- block-level reveal hides per-session outcomes when selected.

---

# 54. Tests — audio synthesis

Verify at minimum:

- exact left/right frequencies for all first presets;
- 4-Hz difference for 394/398;
- exact 100/104 patent pair;
- zero-beat 396/396 sham;
- quick input center 396 derives 394/398;
- simple custom center/beat calculations;
- direct advanced L/R preservation;
- exact channel assignment;
- sample-rate metadata;
- no clipping in finite render tests;
- normalization consistency;
- deterministic noise reproduction;
- expected pink/red spectral behavior within a declared tolerance where implemented;
- delay sweep frequency within tolerance;
- L/R phase behavior for phased-noise mode;
- WAV and manifest hash reproducibility.

---

# 55. Tests — Audio Lab

Verify:

- three presets are one-click usable;
- no manual left/right entry required in preset mode;
- one-number quick mode works;
- continuous playback can continue until manual stop rather than auto-ending;
- pause/resume/stop work;
- no obvious implementation discontinuity from buffer boundaries in generated test signal;
- invalid frequency/Nyquist configurations are rejected;
- saving creates a versioned recipe;
- unsaved preview state cannot enter a committed session;
- saved recipe can be selected by a profile;
- historical recipe used by an old session is not silently mutated.

---

# 56. Tests — logging, integrity, analysis, reports

Verify:

- canonical event hashing;
- previous-hash chain integrity;
- detection of a modified event/file;
- lock immutability;
- raw machine-output ordering;
- cumulative deviation calculations;
- fixed-window calculations;
- threshold crossing calculations;
- sustained crossing rule;
- change-point reproducibility from same data/version;
- primary-window immutability;
- subjective-time fields captured before actual elapsed display;
- deterministic analytical report reproduces identically from same locked data/config/version;
- misses and aborted sessions remain present;
- same-profile comparison excludes materially incompatible profiles by default.

---

# 57. Required local UI quality

The UI should be simple, clean, and practical rather than visually elaborate.

Priorities:

- clear typography;
- large critical controls;
- clear selected profile/status;
- clear validation errors;
- large pre-session requested target;
- obvious memory confirmation;
- one large START button;
- non-distracting active hands-free screen;
- raw report with no accidental result leakage;
- clear reveal/result page;
- readable deterministic report;
- easy Audio Lab presets;
- advanced controls hidden until requested.

Do not allow scientific configuration complexity to make the first baseline difficult to operate.

---

# 58. Documentation required in the implementation

Document completely:

- prerequisites;
- install command;
- local run command;
- local URL;
- directory layout;
- configuration registry structure;
- how to create/duplicate a profile;
- how versioning works;
- how a session is committed/snapshotted;
- state-machine flow;
- named timing anchors;
- RNG provider interface;
- outcome-space/mapping separation;
- request-encoding profiles;
- timing policies;
- machine-output policies;
- Audio Lab use;
- preset and one-number audio use;
- saving a custom audio recipe;
- audio provenance rules;
- calibration procedure;
- raw report/lock/reveal behavior;
- deterministic analysis/report generation;
- how to verify session hashes;
- how to inspect/export a session bundle;
- known limitations;
- every unimplemented/approximate historical audio parameter;
- what is deliberately deferred to hardware RNG/mobile/future sensors.

A new developer should be able to run and understand the system without reading source code first.

---

# 59. Required dry-run artifacts before participant use

Before declaring the implementation ready for a real participant session:

1. run all automated tests;
2. produce one calibration bundle with no participant;
3. produce one dry immediate binary session;
4. produce/test the five-minute relative profile using fake clock or safe dry execution as appropriate;
5. produce/test an absolute-time profile using controlled dry scheduling/fake clock as appropriate;
6. produce/test arbitrary label mapping;
7. verify the three initial audio presets;
8. verify one-number quick Audio Lab mode;
9. verify continuous Audio Lab playback and manual controls;
10. generate a finite deterministic WAV + manifest/hash for each required preset;
11. verify hands-free state-machine behavior end-to-end;
12. generate the deterministic analytical report for the dry session;
13. verify event/file hashes;
14. list every unsupported/approximate requirement explicitly.

Do not run a real participant session automatically.

---

# 60. Completion report from Codex

When implementation is complete, provide a precise implementation report containing:

- files/directories created or changed;
- architecture implemented;
- exact run instructions;
- exact test command;
- tests passed/failed;
- dry-run artifacts produced;
- audio presets verified;
- Audio Lab behavior verified;
- configuration-only future-proofing demonstrations completed;
- timing demonstrations completed;
- mapping/encoding demonstrations completed;
- lock/reveal/integrity validation;
- known limitations;
- every deviation from this prompt or repository requirements;
- every historical audio parameter that remains unknown or reconstructed;
- anything that must be reviewed before participant use.

Do not hide partial implementation behind vague phrases such as `supported in principle`.

For every mandatory feature, distinguish:

- implemented and tested;
- implemented but not yet manually verified;
- intentionally deferred by this prompt;
- blocked, with exact reason.

---

# 61. Final acceptance definition

The first MIP software build is ready for owner review only when all of these are true:

- one stable config-driven engine exists;
- the first immediate binary profile runs through it;
- relative and absolute timing also run through the same engine without code forks;
- objective machine state is separated from participant-facing mapping and encoding;
- the symmetric first encoding profile is available;
- arbitrary/reversed mappings are configuration-driven;
- hands-free operation requires no interaction after START until return;
- continuous hidden machine telemetry is retained for relevant profiles;
- raw report is locked before reveal;
- subjective time is captured before actual time is shown;
- deterministic analysis/reporting works;
- event/session integrity hashes work;
- Audio Lab has the three first presets;
- Audio Lab one-number quick mode automatically computes channels;
- Audio Lab can play indefinitely until pause/stop;
- simple and advanced custom audio paths exist;
- audio recipes can be saved/versioned and safely selected by profiles;
- unsaved Audio Lab state cannot contaminate a committed session;
- no mobile/cloud/database scope has been added;
- tests and dry runs are documented;
- no real participant session has been launched automatically.

The desired outcome is not the largest possible application. It is a **small, rigorous, configurable research instrument that we do not need to rewrite every time the next MIP experiment changes**.