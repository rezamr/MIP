# MIP Pre-Codex Implementation Review v0.1

## Status

`APPROVED FOR CODEX IMPLEMENTATION — ACTIVE SPECIFICATION SET REVIEWED 2026-08-31`

## Purpose

Record the final specification-level review performed immediately before handing the first local MIP research-engine build to Codex.

This is an approval of the **active implementation specification set**, not a claim that future implementation code is already bug-free. Codex must still pass the mandatory tests, dry runs, integrity checks, failure injections, and owner review defined in `engineering/CODEX_PROMPT_REQUEST_APP_V0.8.md`.

---

# Review scope

The review checked the current project objective, protocol hierarchy, first operational REQUEST flow, timing semantics, entropy roadmap, mapping/encoding separation, audio architecture, Audio Lab behavior, session data model, event logging, raw machine telemetry, raw-report locking, reveal behavior, block orchestration, deterministic analysis, session review, failure/recovery behavior, deployment scope, test requirements, and Codex completion gate.

Core files reviewed and/or reconciled include:

- `README.md`
- `COLLABORATION_PROTOCOL.md`
- `00_MASTER.md`
- `01_PROJECT_CHARTER.md`
- `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
- `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
- `04_EVIDENCE_STANDARD.md`
- `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
- `10_CONVERSATION_ORCHESTRATION.md`
- current and superseded REQUEST/playbook files;
- temporal/entropy protocol;
- audio frequency research matrix;
- historical Army perturbation audit;
- active audio synthesis and Audio Lab requirements;
- mapping/encoding requirements;
- hands-free requirements;
- telemetry/reporting requirements;
- deployment decision;
- session template/index;
- prior Codex prompt generations.

---

# Material conflicts found during review and resolved

## C-01 — Fixed clock wording vs immediate first baseline

Older REQUEST encoding and MIP-NUM files required participant-facing fixed target-time wording.

Current first baseline requires immediate/now participant semantics with a continuous hidden stream.

Resolution:

- created `protocols/REQUEST_ENCODING_V0.2.md`;
- created `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`;
- created `protocols/MIP_NUM_REQUEST_V0.2.md`;
- added explicit authority rule preventing older wording from leaking into the first profile.

Status: `RESOLVED`.

## C-02 — Participant state-stabilization interaction vs hands-free requirement

Older wording could be interpreted as requiring the participant to judge/announce readiness during the active session.

Resolution:

- first active playbook now uses a fixed configured stabilization stage;
- no button is required after START;
- poor stabilization is reported after return.

Status: `RESOLVED`.

## C-03 — END SESSION UI wording vs physical hands-free termination

Older UI language could be interpreted as requiring a software control while altered.

Resolution:

- physical self-termination is authoritative;
- software stop may be optional convenience only;
- active completion/safety never depends on operating the screen.

Status: `RESOLVED`.

## C-04 — Binary literal value vs participant representation

Older simple binary descriptions could encourage hardcoding `0/1` as both machine state and participant meaning.

Resolution:

- objective outcome state, participant-facing mapping, internal encoding, and scoring endpoint are separate versioned objects;
- arbitrary and reversed mappings are mandatory configuration-only acceptance tests.

Status: `RESOLVED`.

## C-05 — Session ID vs trial vs block ambiguity

Earlier app specifications centered mostly on a single `trial/session` concept.

Resolution:

- explicit hierarchy: Experiment Profile -> optional Block -> Session -> Trial;
- first baseline has one primary trial per session while preserving separate IDs;
- balanced blocks and block-level reveal now have explicit evidence structures.

Status: `RESOLVED`.

## C-06 — Repository Markdown sessions vs application runtime evidence

Top-level `sessions/` is already used for durable MIP documentation. Earlier runtime examples also used a generic sessions path and could cause conceptual collision.

Resolution:

- runtime evidence is explicitly separated under a local runtime data root;
- top-level Markdown session records remain durable project summaries/history;
- runtime evidence is never automatically pushed/published.

Status: `RESOLVED`.

## C-07 — Event log existed but scientific durability was underspecified

Earlier prompt generations required a SHA-256 event chain but did not fully define canonical serialization, raw machine-output linkage, atomic writes, logging failure, crash recovery, or integrity-manifest behavior.

Resolution:

- added `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`;
- canonical event hashing/versioning required;
- high-volume machine-output blocks are losslessly stored and hash-linked;
- outputs are persisted before later reveal-dependent progression;
- mutable snapshots use atomic writes;
- logging failure fails closed;
- integrity verification detects modification/deletion/insertion/reordering;
- incomplete sessions are preserved after restart.

Status: `RESOLVED`.

## C-08 — Raw report draft vs immutable evidentiary report

Earlier wording said raw reports lock but did not fully define autosave/crash recovery versus immutability.

Resolution:

- mutable `raw_report_draft` is allowed before lock;
- immutable final `raw_report.json` is created/hash-recorded at lock;
- late recollections are append-only events;
- post-reveal notes remain separately labeled.

Status: `RESOLVED`.

## C-09 — Reveal could be interpreted as a UI hiding problem

Resolution:

- reveal is now explicitly server-side state/policy authorization;
- hidden outcomes must not be sent in HTML, JS state, APIs, URLs, SSE/WebSocket payloads, previews, debug output, or ordinary logs before eligibility;
- HTTP/API leakage tests are mandatory.

Status: `RESOLVED`.

## C-10 — Long-delay/absolute-time behavior after process stop or computer sleep

Earlier requirements supported hours/days/absolute time but did not state what to do when the machine misses the scheduled event.

Resolution:

- log scheduled, wake, and actual generation times;
- record timing tolerance/discontinuities;
- missed events are deviations/incomplete, not silently backfilled;
- never regenerate a replacement and label it on-time.

Status: `RESOLVED`.

## C-11 — Audio Lab manual playback vs formal session playback

Resolution:

- Audio Lab remains mutable exploratory preview with Play/Pause/Resume/Stop and indefinite duration;
- only saved/versioned validated recipes can enter a committed session;
- formal session audio cannot be manually edited after commitment;
- audio interruption during formal operation is a protocol deviation/failure, not normal session control.

Status: `RESOLVED`.

## C-12 — One-number audio convenience could hide assumptions

Resolution:

- default quick template explicitly supplies the 4-Hz centered-pair rule;
- input center `396` derives `394/398`;
- explicit patent preset `100/104` remains direct and is not reinterpreted through centered-template math.

Status: `RESOLVED`.

## C-13 — Session files existed but review/audit workflow was incomplete

Resolution:

- mandatory Sessions/Reports browser;
- filterable list;
- chronological event timeline;
- raw/effective config/commitment/machine-output/report views;
- protocol-deviation review;
- Verify Integrity action;
- rebuildable index/cache;
- read-only export;
- cross-session comparability gate.

Status: `RESOLVED`.

## C-14 — Analysis reproducibility and testing

Resolution:

- primary/secondary/exploratory endpoints explicitly separated;
- deterministic analysis fixtures with known expected values required;
- binomial/stream/window/token calculations require versioned algorithms;
- incompatible sessions may not be silently pooled;
- scientific result hashes/provenance are separated from irrelevant presentation timestamps where needed.

Status: `RESOLVED`.

## C-15 — Multiple Codex prompt generations

Resolution:

- created `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`;
- created final active `engineering/CODEX_PROMPT_REQUEST_APP_V0.8.md`;
- README, Collaboration Protocol, Master, Charter, Core Objectives, Temporal Priority, Orchestration, Deployment Decision, and Session Template were aligned to the active generation;
- old prompts remain history only.

Status: `RESOLVED`.

---

# Logging/session audit verdict

The active specification now defines a complete evidence path:

`profile resolution -> assignment -> commitment -> config snapshot -> START -> automated stage/cue/audio/timing events -> raw machine output persistence -> participant return -> mutable report draft -> immutable raw-report lock -> reveal authorization -> result -> deterministic analysis -> integrity manifest -> verification -> session/block review`

Failure paths are also preserved:

- abort;
- interruption;
- forgotten request;
- audio failure;
- logging failure;
- application crash;
- computer sleep/missed timing;
- corrupted/tampered bundle;
- incomplete session.

No failed/null/incomplete session is silently deleted from the scientific history.

Verdict: `APPROVED`.

---

# Audio/UI verdict

The active specification includes:

- three one-click first-use presets;
- one-number centered 4-Hz quick mode;
- simple custom mode;
- advanced custom mode;
- indefinite Audio Lab playback until manual pause/stop;
- deterministic finite WAV/manifest/hash verification;
- strict Audio Lab vs formal-session separation;
- historical provenance labels.

Verdict: `APPROVED`.

---

# Timing/entropy/mapping verdict

The engine must implement immediate, next-eligible, relative-delay, absolute-time/window, continuous-around-request, and pre-generated-hidden modes through configuration.

It must also support binary through 30-bit exact-token spaces and arbitrary/reversed participant mappings without hardcoding one representation.

Primary timing regions remain frozen before outcome inspection; exploratory windows cannot replace them post hoc.

Verdict: `APPROVED`.

---

# Remaining non-blocking research unknowns

The following remain research questions, not software-specification conflicts:

- final MICOM in-house result;
- exact historical CENTER LANE audio channel semantics for several reported base/beat values;
- complete historical custom Hemi-Sync waveform details;
- PEAR/Schmidt primary temporal protocols and replication/null audit;
- future physical/hardware RNG selection and integration;
- future physiological-sensor integration;
- empirical effect size/timing/encoding/audio performance in MIP itself.

The app is specifically designed so these can be added/tested later through new versioned configurations/providers where the existing primitive set permits.

---

# Final pre-code approval

No **known unresolved material conflict** remains inside the active implementation set as of this review.

Older historical/superseded files may intentionally contain different designs, but `ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md` explicitly prevents those differences from becoming implementation ambiguity.

The active Codex implementation instruction is:

`engineering/CODEX_PROMPT_REQUEST_APP_V0.8.md`

Codex must not declare the application ready merely because code compiles. It must satisfy the v0.8 automated tests, dry-run artifacts, deliberate tamper/logging-failure/missed-target tests, Sessions/Reports audit, and final acceptance gate before reporting readiness for owner review.
