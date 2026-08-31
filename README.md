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

The application UI is English-only, including navigation, forms, validation messages, session workflow, Audio Lab, reports, charts, configuration screens, integrity views, and user-visible errors.

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
- The active audio runtime is deterministic live synthesis from a frozen versioned recipe/seed/state.
- Actual desktop playback must use AudioWorklet rather than ScriptProcessorNode or renderer-timer-driven sample generation.
- Formal audio reproducibility is preserved by frozen synthesis configuration plus cryptographic runtime stream hashing/logging; optional WAV export remains available for QA, archival, regression, and external analysis.
- The 1979–1980 Army/SRI Remote Perturbation protocol and the Monroe/Gateway/CENTER LANE Hemi-Sync audio lineage are separate historical families and must not be conflated.
- The active software deployment target is a packaged Electron desktop application, initially for Windows.
- The packaged application must not require a localhost browser/server workflow for ordinary owner use.
- SQLite is the authoritative runtime datastore for new Electron sessions while append-only/tamper-evident evidence semantics remain mandatory.
- Previously used experiment profiles/configurations must never be silently mutated; each committed session keeps an immutable configuration snapshot.
- Runtime session evidence must be append-only/tamper-evident, reviewable, recoverable, and independent from chat memory.
- Hidden result data must be gated in the privileged Electron main process and must not reach renderer memory before reveal eligibility.
- The application UI must be polished, highly usable, consistent, and suitable for repeated research use rather than a raw developer prototype.
- UI polish must never hide protocol deviations, integrity failures, aborted sessions, exploratory status, or historical-provenance uncertainty.
- The research core remains configuration-driven: current experiment choices are profiles, not hardcoded engine limitations.
- Immediate, relative-delay, and absolute-date-time request timing must coexist in the same stable engine and be selectable by validated configuration.
- Formal research randomness must use the configured RNG provider; `Math.random()` must not affect evidence-bearing research semantics.

## Current software direction

MIP Desktop v1.2 is the active implementation direction:

- Electron desktop shell;
- isolated English-only renderer UI;
- minimal preload bridge;
- privileged Electron main-process research/session controller;
- SQLite evidence storage;
- AudioWorklet real-time synthesis;
- cryptographic stream integrity;
- deterministic analysis/reporting;
- packaged Windows application;
- no production localhost server;
- no browser required for owner operation.

The current implementation baseline is preserved on branch `fix-v1.1` at commit `7de6d629e76433ec7c06443810f658599a50084c`.

The earlier pre-fix implementation is preserved on branch `pre-fix-v1.0-checkpoint` at commit `a683418ff3b9d9096070c76c94fcaac5db78aa56`.

## Current program areas

- Historical and archival reconstruction
- CENTER LANE / MIAS advanced training recovery
- Hemi-Sync audio engineering reconstruction
- Electron desktop research application
- AudioWorklet live deterministic layered Hemi-Sync synthesis
- Audio Health Check / dropout diagnostics
- Optional deterministic audio rendering/export for QA and archival use
- Monroe patent analysis
- Bentov physiology reconstruction
- Session phenomenology
- REQUEST encoding / communication protocol development
- Immediate / relative-delay / absolute-time request timing
- Config-driven experiment profiles and versioned research primitives
- Objective-state vs participant-mapping/encoding experiments
- Audio component isolation
- Audio Recipe Library / Audio Lab
- Phased-pink / masking-noise engineering reconstruction
- READ / hidden-target tests
- REQUEST / binary and larger machine-outcome tests
- Continuous output trend/onset analysis
- Temporal response / latency / persistence mapping
- High-entropy exact-target tests
- Delayed store/retrieve tests
- Challenge-response tests
- Sham, blinding, leakage, and falsification controls
- SQLite append-only/tamper-evident research evidence
- Legacy JSON/JSONL import and explicit evidence export
- Deterministic analytical session/block reporting
- High-quality English-only desktop UI/UX
- Session-start workflow, raw-report workflow, session browser, charts, reporting, integrity review, backup and export
- Local-computer deployment with ordinary operating-system Bluetooth audio output where useful
- Practical protocol optimization and MIP-plus development

## Current active protocol-development and implementation files

For work on REQUEST / READ testing, audio comparison, temporal mapping, target entropy, practical optimization, reporting, or the desktop research application, read these files before changing implementation behavior:

- `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
- `protocols/REQUEST_ENCODING_V0.2.md`
- `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
- `protocols/MIP_NUM_REQUEST_V0.2.md`
- `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
- `research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md`
- `research/SOURCE_VERIFICATION_QUEUE.md`
- `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
- `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
- `engineering/CODEX_PROMPT_REQUEST_APP_V1.2.md`
- `engineering/ELECTRON_DESKTOP_ARCHITECTURE_V0.1.md`
- `engineering/AUDIOWORKLET_REALTIME_AUDIO_REQUIREMENTS_V0.1.md`
- `engineering/SQLITE_EVIDENCE_STORAGE_REQUIREMENTS_V0.1.md`
- `engineering/DEPLOYMENT_SCOPE_DECISION_V0.2.md`
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

`engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md` is the conflict-resolution authority.

`engineering/CODEX_PROMPT_REQUEST_APP_V1.2.md` is the active implementation prompt. It migrates the current v1.1 baseline to Electron + SQLite + AudioWorklet and requires completion of the remaining formal-session, profile, calibration, reporting, integrity, and packaging work.

`engineering/ELECTRON_DESKTOP_ARCHITECTURE_V0.1.md` defines the required main/preload/renderer/audio-worklet module boundaries and removes the production localhost server.

`engineering/AUDIOWORKLET_REALTIME_AUDIO_REQUIREMENTS_V0.1.md` is the active real-time playback authority. It requires AudioWorklet, correct stateful channel/component synthesis, de-click controls, cryptographic stream integrity, health telemetry, long soak tests, and formal-session integration.

`engineering/SQLITE_EVIDENCE_STORAGE_REQUIREMENTS_V0.1.md` is the active runtime-storage authority. SQLite replaces JSON/JSONL as the primary store for new Electron sessions while preserving append-only hash-chained evidence, immutable locked reports, lossless machine output, crash recovery, backup, export, and legacy import.

`engineering/DEPLOYMENT_SCOPE_DECISION_V0.2.md` makes Electron desktop the active production deployment target and supersedes the older browser/no-database deployment restrictions.

The initial user audio condition `A-U396-4` remains the experimental baseline. Historical/patent/scientific comparator conditions remain separately labeled and must not be conflated.

Historical CENTER LANE parameters that are not source-verified remain explicitly unknown and must not be silently inferred.

See `00_MASTER.md` for broader project status and research next actions.
