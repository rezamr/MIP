# MIP — Mission Impossible

MIP is a forensic reconstruction and experimental research project focused on neuroacoustic state induction, the historical Gateway / Hemi-Sync / Bentov / CENTER LANE record, and rigorous tests of communication/request-response, anomalous information acquisition, transmission, persistence, temporal behavior, and challenge-response behavior.

## Core rule

MIP does **not** assume that any hypothesized external information substrate exists. It also does **not** assume that unusual subjective experiences are meaningless. Observations are recorded first; interpretations and conclusions are kept separate.

Every important claim must be traceable to one or more of:

- primary archival evidence;
- peer-reviewed scientific evidence;
- a reproducible experimental observation;
- a clearly labeled reconstruction or hypothesis.

## Language policy

All repository content is written in English.

The application UI for the first software build is also English-only, including navigation, forms, validation messages, session workflow, Audio Lab, reports, charts, configuration screens, integrity views, and user-visible errors.

Conversation with the project owner may occur in Persian, but durable conclusions, protocols, reports, session records, software requirements, and decisions must be written back to this repository in English.

## Start here in every conversation

Any new conversation or research agent must read, in this order:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
7. `04_EVIDENCE_STANDARD.md`
8. `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
9. `10_CONVERSATION_ORCHESTRATION.md`
10. the topic-specific files required for the current task

The repository is the durable project memory and the single source of truth for MIP.

## Research principles

- Never silently upgrade a possibility into a fact.
- Never silently downgrade an unusual observation into imagination.
- Distinguish `OBSERVATION`, `INTERPRETATION`, and `CONCLUSION`.
- Record misses as carefully as hits.
- Preserve unknown parameters as `UNKNOWN` rather than inventing values.
- Preserve generation/version boundaries in Gateway and Hemi-Sync material.
- Historical overlap is not proof of mechanism.
- Historical positive results justify development and replication work, but do not by themselves identify a unique mechanism.
- Statistical significance is not proof of a specific metaphysical explanation.
- A documentary gap is not automatically evidence of deliberate suppression.
- A negative finding is a valid result.
- Timing, latency, persistence, execution semantics, and entropy capacity are empirical variables, not assumptions.
- Do not substitute a post-hoc best time window for a failed preregistered target time.
- MIP follows a development-and-validation strategy: reproduce a useful prior effect family, characterize it, improve it, and then scale toward practical use.
- Active altered-state sessions must be hands-free and must not require screen inspection after induction begins.
- Machine-output trend timing and participant-state timing must be logged and interpreted separately.
- Audio generated from patents or archival clues must retain exact provenance labels; unrecovered parameters may not be silently guessed.
- A simple binaural pair is a valid component test but is not automatically a complete historical Hemi-Sync environment.
- The active audio runtime is live deterministic synthesis from a frozen versioned recipe/seed/state, not mandatory playback of a pre-rendered full-session file.
- Formal audio reproducibility is preserved by frozen synthesis configuration plus deterministic runtime stream hashing/logging; optional WAV export remains available for QA, archival, regression, and external analysis.
- The 1979–1980 Army/SRI Remote Perturbation protocol and the Monroe/Gateway/CENTER LANE Hemi-Sync audio lineage are separate historical families and must not be conflated.
- The first software implementation must remain deliberately small and easy to debug; mobile packaging is deferred until the research core is stable.
- The first software interface must nevertheless be polished, highly usable, consistent, and suitable for repeated research use rather than a raw developer prototype.
- Participant-facing absolute clock time is not required for the first REQUEST baseline; machine timing remains exact and authoritative.
- The software research core must be configuration-driven: current experiment choices are profiles, not hardcoded engine limitations.
- Immediate, relative-delay, and absolute-date-time request timing must coexist in the same stable engine and be selectable by validated configuration.
- Previously used experiment profiles/configurations must never be silently mutated; each committed session keeps an immutable configuration snapshot.
- Runtime session evidence must be append-only/tamper-evident, reviewable, and recoverable without relying on chat memory.
- Hidden result data must be gated server-side and must not be sent to participant-facing routes before reveal eligibility.
- UI polish must never hide protocol deviations, integrity failures, aborted sessions, exploratory status, or historical-provenance uncertainty.

## Current program areas

- Historical and archival reconstruction
- CENTER LANE / MIAS advanced training recovery
- Hemi-Sync audio engineering reconstruction
- Live deterministic layered Hemi-Sync synthesis
- Optional deterministic audio rendering/export for QA and archival use
- Monroe patent analysis
- Bentov physiology reconstruction
- Session phenomenology
- REQUEST encoding / communication protocol development
- Immediate / relative-delay / absolute-time request timing
- Config-driven experiment profiles and versioned research primitives
- Objective-state vs participant-mapping/encoding experiments
- Audio component isolation
- Audio Lab / deterministic audio engineering
- Phased-pink / masking-noise engineering reconstruction
- READ / hidden-target tests
- REQUEST / binary and larger machine-outcome tests
- Continuous output trend/onset analysis
- Temporal response / latency / persistence mapping
- High-entropy exact-target tests
- Delayed store/retrieve tests
- Challenge-response tests
- Sham, blinding, leakage, and falsification controls
- Local JSON/JSONL research tooling
- Tamper-evident session/block logging and integrity review
- Deterministic analytical session/block reporting
- High-quality English-only local research UI/UX
- Session-start workflow, raw-report workflow, session browser, charts, reporting, and export UX
- Local-computer deployment with ordinary Bluetooth audio-output support where useful
- Practical protocol optimization and MIP-plus development

## Current active protocol-development files

For work on REQUEST / READ testing, audio comparison, temporal mapping, target entropy, practical optimization, reporting, or the planned local research app, read these files before changing a protocol:

- `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
- `protocols/REQUEST_ENCODING_V0.2.md`
- `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
- `protocols/MIP_NUM_REQUEST_V0.2.md`
- `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
- `research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md`
- `research/SOURCE_VERIFICATION_QUEUE.md`
- `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
- `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
- `engineering/REQUEST_TEST_APP_SPEC_V0.2.md`
- `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
- `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md`
- `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
- `engineering/LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md`
- `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md`
- `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
- `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
- `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
- `engineering/CODEX_PROMPT_REQUEST_APP_V1.1.md`
- `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`

`protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md` is the current full step-by-step execution guide. It aligns the hands-free session with the current immediate-request timing decision and continuous hidden stream.

`protocols/REQUEST_ENCODING_V0.2.md` is the active first-use request-encoding protocol. It replaces older fixed-clock participant wording with profile-driven timing semantics while preserving semantic/representation/affect/release as separable components.

`engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md` is the current conflict-resolution authority for software implementation and revision work.

`engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md` is the current software architecture decision. It requires stable engine code, validated versioned configuration, separate objective state/mapping/encoding, block/session/trial hierarchy, immutable per-session configuration snapshots, and configuration-driven timing/output/audio/analysis/reveal behavior.

`engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md` is the current session-evidence authority. It requires unambiguous IDs, an append-only hash-chained event log, lossless machine-output evidence linked by hashes, immutable raw-report locking, server-side reveal gating, failure/crash preservation, integrity verification, block records, and a complete Sessions/Reports audit interface.

`engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md` is the active product/interface requirement. It requires an English-only, highly polished, consistent research UI; excellent session-start and reporting workflows; deliberate input/output design; progressive disclosure for complex configuration; a usable session-audit workspace; strong Audio Lab UX; accessibility; and meaningful error/recovery states.

`engineering/LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md` is the active audio runtime authority. It requires one shared deterministic synthesis library, real live playback for Audio Lab and formal sessions, stateful continuous generation rather than file looping, frozen recipe/seed/state at commitment, runtime sample counting and stream hashing, and optional rather than mandatory audio-file export.

`engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md` remains relevant for layered synthesis primitives, provenance, historical exactness, and optional render/export verification, but its older mandatory full-session pre-render/playback requirement is superseded by the live-audio runtime authority.

`engineering/CODEX_PROMPT_REQUEST_APP_V1.1.md` is the active implementation prompt. It inherits all valid v1.0 scientific, engineering, logging, UI/UX, and reporting requirements and changes the audio runtime to live deterministic synthesis. All earlier Codex prompt versions remain project history.

The initial user audio condition `A-U396-4` is preserved as a personal experimental baseline. Historical/patent/scientific comparator conditions are kept separately labeled and must not be conflated.

See `00_MASTER.md` for current status and next actions.
