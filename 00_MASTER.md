# MIP Master Project State

Last updated: 2026-08-31

## Mission

MIP — Mission Impossible — is a long-horizon forensic reconstruction, technical reverse-engineering, physiology, phenomenology, and information-behavior research program.

Primary practical objective: determine whether a stable, reproducible **communication/request-response** interaction can be established and objectively characterized, while reconstructing the historical Gateway / Hemi-Sync / Bentov / CENTER LANE systems and testing owner-led Communication Sessions with progressively stronger controls.

For operational shorthand, **MATRIX** means a hypothesized external or non-ordinary interaction/information substrate or mechanism. This is a test model, not an established fact.

Durable objective/standards files:

- `01_PROJECT_CHARTER.md`
- `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
- `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
- `04_EVIDENCE_STANDARD.md`
- `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`

---

# Current primary practical target

MIP's main goal is **communication/request-response**, not passive information acquisition.

General REQUEST architecture:

`participant receives/precommits desired objective state X -> participant performs a fixed request protocol -> independent random system operates under a predeclared timing/output policy -> test correspondence with X`

Passive information acquisition remains a separate secondary track.

## Track A — READ / PERCEPTION

`independent hidden system outcome -> participant attempts to perceive/report outcome -> response locks -> reveal/scoring`

## Track B — REQUEST / INFLUENCE

`participant precommits desired objective outcome -> independent machine output is generated/logged -> predeclared correspondence endpoint is scored`

A READ success is not evidence of influence. A REQUEST success is not evidence of remote perception. Analyze them independently before any bidirectional interpretation.

---

# Current first operational REQUEST decision

The first active participant baseline is no longer the older absolute-clock single-future-bit wording.

Current first profile:

`BASELINE_NOW_BINARY_V1`

Core behavior:

- objective outcome space `{0,1}`;
- requested objective state normally assigned by `SYSTEM_RANDOM_UNIFORM`;
- literal `0/1` participant-facing mapping initially;
- machine state, participant mapping, request encoding, and scoring endpoint remain separate objects;
- active encoding profile: `SER-A-V2`;
- participant memorizes target before induction;
- one START action;
- active session is hands-free;
- participant-facing request timing = `IMMEDIATE_REQUEST` / now;
- hidden binary machine stream begins before request cue and continues during request, release, and declared post-request windows;
- primary request/immediate region is predeclared by the analysis plan;
- neighboring temporal windows are exploratory for onset/latency/persistence and may not replace the primary region post hoc;
- subjective time estimate is captured before actual elapsed time is displayed;
- raw report locks before reveal;
- first-profile reveal policy = after raw-report lock;
- deterministic analysis and integrity verification follow reveal eligibility.

Active protocol files:

- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
- `protocols/REQUEST_ENCODING_V0.2.md`
- `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
- `protocols/MIP_NUM_REQUEST_V0.2.md`
- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`

Older playbook/encoding/MIP-NUM versions remain history and are not the active first-use participant protocol.

---

# Current temporal / entropy model

Timing is an empirical variable, not an assumption.

MIP must distinguish and measure:

- susceptibility;
- latency;
- temporal response kernel;
- persistence/decay;
- temporal symmetry;
- execution-time semantics;
- semantic/goal specificity;
- entropy capacity.

The correct timing object is:

`request encoding -> requested execution semantics -> physical machine event -> reveal/observation -> measured correspondence`

The software engine must support, through configuration rather than code forks:

- immediate request;
- next eligible output;
- relative delay;
- absolute date/time;
- relative/absolute windows;
- continuous stream around request;
- pre-generated hidden target.

High-entropy testing follows the staircase:

`1 -> 2 -> 4 -> 8 -> 16 -> 20 -> 30 bits`

Do not jump directly to one-in-a-billion exact-token testing and treat one hit as proof.

---

# Current pre-Codex software freeze

The project is now at a **pre-implementation specification freeze** for the first local application.

## Active implementation authority

- `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`

This file resolves conflicts between old and active generations. Do not silently merge incompatible old instructions.

## Active architecture/specification

- `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
- `engineering/REQUEST_TEST_APP_SPEC_V0.2.md`
- `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
- `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
- `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md`
- `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
- `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md` where not superseded by the active integrity specification
- `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`

## Active Codex prompt

- `engineering/CODEX_PROMPT_REQUEST_APP_V0.9.md`

`V0.9` is the active additive final implementation instruction. Every mandatory requirement from `V0.8` remains active unless `V0.9` explicitly changes or strengthens it. Earlier Codex prompt files remain historical implementation ancestry.

---

# Software architecture invariant

The application must be:

`stable engine code + versioned validated configuration + immutable session snapshots + append-only evidence + deterministic analysis`

Ordinary changes in:

- requested-value assignment;
- objective outcome space;
- participant-facing mapping;
- request encoding;
- timing;
- machine-output policy;
- stage duration/cues;
- audio recipe;
- analysis windows;
- reveal policy;

must normally require a new versioned configuration/profile, not experiment-engine rewrites.

The engine hierarchy is:

`Experiment Profile -> optional Block -> Session -> Trial`

For the first active baseline:

`one Session = one primary REQUEST Trial`

but `session_id` and `trial_id` remain independent schema fields for future expansion.

---

# Session evidence / logging freeze

Formal software-recorded sessions must follow:

- `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`

Core evidence rules:

1. Existing historical IDs `S0001` and `S0002` remain reserved; new software sessions continue the `S####` namespace without reuse.
2. Runtime scientific evidence is kept separately from top-level repository Markdown session documentation.
3. `events.jsonl` is the authoritative append-only session event chain.
4. Events use versioned canonical serialization, SHA-256, event indexes, previous-hash linkage, UTC timestamps, and monotonic timing context.
5. High-volume raw machine output is stored losslessly in a separate file when useful, but every persisted block is hash-linked into the authoritative event chain.
6. A generated machine outcome is persisted before any later reveal-dependent progression; a lost output is never regenerated to fill a record.
7. Mutable JSON drafts use atomic write/replace behavior.
8. Participant raw report may autosave as a clearly marked mutable draft, but at lock a final immutable `raw_report.json` is created and hashed.
9. Late recollections and post-reveal notes are append-only records; they never rewrite the locked raw report.
10. Reveal is enforced server-side. Hidden result data must not be sent to the participant-facing browser/API before eligibility.
11. Timing audit preserves scheduled time, scheduler wake, actual generation time, monotonic/wall-clock context, lateness/error, and timing validity.
12. Missed targets after sleep/process interruption are not backfilled or regenerated as if on time.
13. Logging, timing, audio, application, interruption, forgotten-request, and participant-abort events remain part of the session record.
14. A final integrity manifest hashes the evidence bundle without creating a self-hash cycle.
15. Integrity verification must detect edited, deleted, inserted, or reordered events and modified evidence files.
16. Session verifier statuses include `VALID`, `INVALID`, `INCOMPLETE`, and `LEGACY_UNVERIFIABLE`.
17. The app must discover incomplete sessions after restart and preserve/classify them rather than inventing missing history.
18. Committed session evidence has no normal one-click deletion UI.

---

# Sessions / Reports audit requirement

The application must include a real session-review interface, not merely write files to disk.

Required review capability:

- filterable session list;
- session/profile/audio/timing/status/reveal/deviation/integrity metadata;
- single-session chronological audit timeline;
- committed effective configuration;
- request assignment/mapping/encoding;
- audio details;
- raw machine telemetry after reveal eligibility;
- raw report with draft/locked/late provenance;
- protocol deviations;
- deterministic analysis;
- read-only raw JSON/JSONL views;
- `Verify Integrity` action;
- read-only export;
- rebuildable session index/cache.

Primary and exploratory analysis must remain visibly distinct.

Sessions with materially incompatible profiles may be displayed side-by-side but must not be silently pooled.

---

# Block architecture

Blocks are optional but required as an engine capability for:

- balanced requested values;
- randomized/balanced audio/condition ordering;
- precommitted assignment schedules;
- block-level reveal;
- block-level deterministic reports.

Aborted or incomplete sessions stay in the block record. A replacement-session rule, if ever used, must be prespecified and must not erase the original session.

---

# Current audio engineering decision

The first build must support **both** easy component-isolation playback and the full data-driven layered Hemi-Sync/patent-grounded reconstruction architecture.

## Historical provenance separation

Do not conflate:

- the 1979–1980 Army/SRI Remote Perturbation work, which is a REQUEST/INFLUENCE precedent for the machine-output side;
- the Monroe/Gateway/CENTER LANE lineage, which is the historical source family for Hemi-Sync/state-induction audio reconstruction.

A modern MIP experiment may combine lessons from both, but software labels, manifests, reports, and documentation must keep provenance explicit.

## Easy first-use presets

### `A-U396-4`

- center/base = 396 Hz;
- beat = 4 Hz;
- left = 394 Hz;
- right = 398 Hz;
- status = MIP user experimental baseline reconstructed from current documented centered synthesis rule.

### `A-P100-104`

- explicit left = 100 Hz;
- explicit right = 104 Hz;
- beat = 4 Hz;
- arithmetic center = 102 Hz;
- status = documented simple Monroe patent example.

Do not reinterpret this explicit pair through a different centered formula.

### `A-SHAM-0`

- left = 396 Hz;
- right = 396 Hz;
- beat = 0 Hz;
- center = 396 Hz;
- status = matched control.

These are simple component-isolation conditions. They are not complete historical Hemi-Sync environments.

## One-number quick mode

Default template:

`CENTERED_BINAURAL_4HZ_V1`

User enters one center value `C` and the application calculates:

`L = C - 2`

`R = C + 2`

The UI must show that the template supplies the 4-Hz assumption.

## Audio Lab operating modes

- one-click presets;
- one-number quick mode;
- simple custom;
- advanced custom;
- separate historical/layered reconstruction area.

Preview playback can continue indefinitely until manual pause/stop.

An unsaved Audio Lab state can never silently enter a formal research session.

## Formal layered Hemi-Sync render gate

For a formal session using layered Hemi-Sync/patent-grounded reconstruction:

1. resolve exact versioned recipe;
2. resolve complete session audio duration/timeline;
3. render complete finite stereo artifact before START eligibility;
4. generate machine-readable manifest;
5. verify rendered artifact automatically;
6. compute SHA-256 for audio, manifest, and verification report;
7. bind the hashes into the immutable session commitment/config snapshot;
8. permit START only after verification passes;
9. play that exact frozen artifact;
10. log playback start/end/errors;
11. never retune/regenerate after commitment.

Required layered primitives include, where supported/documented:

- multiple carriers;
- binaural and monaural relationships;
- per-component levels;
- phase relationships;
- envelopes;
- AM/FM;
- ordinary/deterministic pink-red noise;
- patent-grounded phased/swept pink noise;
- delay-line/comb-filter processing;
- low-frequency sweep;
- Septon/multi-carrier structures;
- fades;
- normalization/headroom;
- cue-track support;
- future voice-layer references.

The recoverable `PHASED_PINK_PATENT_5356368` architecture is mandatory in the first engine build.

Historical provenance labels remain strict. A reconstruction is not an exact historical Gateway/CENTER LANE waveform unless all material parameters are source-verified.

Current reported CENTER LANE candidate anchors `100 Hz base + 1.5 Hz binaural beat` and `200 Hz base + 4 Hz binaural beat` remain incomplete pending primary-source semantics. Do not infer the opposite-ear frequency, centered synthesis, simultaneous use, level, phase, modulation, noise, sequencing, or timing.

---

# Random-source posture

Initial software providers:

- `OS_CSPRNG` — software baseline/READ/tooling;
- explicit versioned deterministic seeded provider — tests/fixtures only.

Scientific assignment/output must never use `Math.random()`.

For stronger REQUEST/INFLUENCE replication, MIP should later repeat the strongest protocol with a well-characterized physical/hardware random source.

Do not describe a software CSPRNG as physically equivalent to Army electronic-noise or beta-decay sources.

---

# Current historical REQUEST anchor

The 7 November 1979 U.S. Army MICOM report `Remote Perturbation Techniques: Project Description and Experimental Protocol` directly tested a historical binary intention/perturbation family:

`participant instructed to bias physical binary random process toward 0 or 1 -> random stream generated -> statistical success tested`

Source-audited points preserved in MIP:

- binary target alphabet;
- electronic-noise and beta-decay random-source families;
- pseudo-random comparison/control contemplated;
- real-time visual/auditory feedback;
- participant-selected initiation time;
- explicit influence-vs-precognition ambiguity recognized by the authors;
- SRI and MICOM apparatus duplication;
- participant/no-participant, source, and feedback variables;
- extensive hardware/environmental validation.

The 29 October 1980 Army managerial summary reports for the completed SRI contractor portion:

- 7 participants;
- 100 formal trials each;
- 700 total formal trials;
- two significant participant runs: `16/100` and `17/100`;
- `87/700` successful sequentially classified trials;
- reported `P = .021`;
- controls reportedly nonsignificant.

Critical interpretation: `87/700` does not mean 87 correct bit guesses.

Final MICOM in-house outcome remains `UNKNOWN / NOT YET RECOVERED`.

Durable audit:

- `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`

Status:

- historical binary request/influence precedent = `PRIMARY-SOURCE CONFIRMED`;
- SRI contractor positive result under its own predefined criterion = `PRIMARY-SOURCE CONFIRMED`;
- final MICOM replication = `UNKNOWN`;
- remote influence as unique cause = `NOT ESTABLISHED`;
- precognition vs influence = `UNRESOLVED`.

---

# Current historical audio/reconstruction posture

Keep separate unless evidence explicitly joins them:

- consumer Gateway training;
- CENTER LANE customized MIAS/Hemi-Sync implementation;
- SRI / GRILL FLAME remote-viewing procedures;
- Army remote-perturbation protocols;
- later Monroe patents;
- PEAR / REG intention experiments;
- Schmidt RNG/PK work;
- later internet-era claims.

Current high-priority historical unknowns remain:

- final MICOM result;
- full SRI Electronic System Perturbation final report/trial details;
- exact historical sequential-analysis rules;
- formal request-direction assignment;
- source allocation/feedback details;
- primary-source verification of CENTER LANE custom training/audio;
- exact custom tape waveforms;
- advanced training record;
- biomonitoring hardware/tuning logic;
- PEAR/Schmidt primary temporal protocols plus replications/nulls/critiques.

---

# Current session record

Existing durable session IDs:

- `S0001` — retrospective first reported 396-Hz-center / 4-Hz session; exploratory phenomenology; `L0`.
- `S0002` — retrospective later unusual outbound/intention session; audio not source-confirmed; exploratory phenomenology; `L0`.

Both remain `RECONSTRUCTED FROM MEMORY`, not equivalent to contemporaneously locked software evidence.

Do not reuse these IDs.

---

# Current experiment roadmap

### EXP-001 — Phenomenology Replication
Standardized sessions without hidden target performance claims.

### EXP-002 — Audio Component Isolation / Reconstruction
Blinded/sham comparison of simple experimental conditions plus separately provenance-gated layered Hemi-Sync/patent-grounded reconstructions.

### EXP-003 — READ / NUMBER PERCEPTION
Hidden machine target, locked participant response, reveal/scoring; kept separate from REQUEST.

### EXP-004 — REQUEST / INFLUENCE / NUMBER SELECTION
Current immediate continuous-stream binary baseline first; later discrete output, delayed timing, pre-generated hidden, hardware RNG, and historical replication arms.

### EXP-005 — QUERY / TARGETED RESPONSE
Constrained question/request with objectively verifiable content where possible.

### EXP-006 — WRITE / TRANSFER
Random payload sender -> isolated blinded receiver -> objective scoring.

### EXP-007 — STORE / RETRIEVE
Encoded payload with no contemporaneous receiver -> delayed blinded retrieval.

### EXP-008 — HANDSHAKE / BIDIRECTIONAL
Only after READ and REQUEST components are independently supported.

Detailed long-form roadmap remains in `protocols/EXPERIMENT_ROADMAP.md`.

---

# Evidence ladder

- `L0` — single subjective observation
- `L1` — repeated subjective observation
- `L2` — association with controlled condition
- `L3` — blinded above-chance or instrumentally verified effect
- `L4` — preregistered replication
- `L5` — independent replication
- `L6` — mechanism-sensitive replication

No result may be described at a higher level than the evidence permits.

---

# Immediate next action

The active software specification has been reviewed and versioned for implementation.

Next action:

> Give Codex `engineering/CODEX_PROMPT_REQUEST_APP_V0.9.md`. Require Codex to read `V0.8` in full because `V0.9` is additive, then execute the complete active authority/specification chain, run every required automated test and dry-run artifact, and produce the mandatory completion report.

Before any real participant REQUEST session:

1. automated tests must pass or blockers must be explicit;
2. RNG calibration bundle must exist;
3. dry immediate/relative/absolute/mapping/block runs must be reviewed;
4. simple Audio Lab presets/quick/custom paths must be verified;
5. layered Hemi-Sync/Septon/phased-pink deterministic render and verification gates must be demonstrated;
6. session integrity/tamper/reveal/logging-failure/missed-target behavior must be verified;
7. one complete dry session must be manually audited from commitment through integrity report;
8. known limitations and all unresolved historical audio parameters must be documented;
9. no real participant session is launched automatically by Codex.
