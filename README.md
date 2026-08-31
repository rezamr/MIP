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

All repository content is written in English. Conversation with the project owner may occur in Persian, but durable conclusions, protocols, reports, session records, and decisions must be written back to this repository in English.

## Start here in every conversation

Any new conversation or research agent must read, in this order:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
7. `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
8. `10_CONVERSATION_ORCHESTRATION.md`
9. the topic-specific files required for the current task

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
- The first software implementation must remain deliberately small and easy to debug; mobile packaging is deferred until the research core is stable.
- Participant-facing absolute clock time is not required for the first REQUEST baseline; machine timing remains exact and authoritative.
- The software research core must be configuration-driven: current experiment choices are profiles, not hardcoded engine limitations.
- Immediate, relative-delay, and absolute-date-time request timing must coexist in the same stable engine and be selectable by validated configuration.
- Previously used experiment profiles/configurations must never be silently mutated; each committed session keeps an immutable configuration snapshot.
- Objective machine state, participant-facing label, internal request-encoding method, and scoring endpoint must remain separate configurable objects.
- MIP does not assume that a hypothesized MATRIX understands digits, words, symbols, or only feelings; representation is an empirical variable.
- Audio engineering preview must remain separate from committed research-session audio. Unsaved Audio Lab state may never silently enter a session.
- The normal Audio Lab path should require no manual left/right frequency calculation for standard binaural use.

## Current program areas

- Historical and archival reconstruction
- CENTER LANE / MIAS advanced training recovery
- Hemi-Sync audio engineering reconstruction
- Monroe patent analysis
- Bentov physiology reconstruction
- Session phenomenology
- REQUEST encoding / communication protocol development
- Address vs payload / human-representation testing
- Immediate / relative-delay / absolute-time request timing
- Config-driven experiment profiles and versioned research primitives
- Audio component isolation
- Easy Audio Lab / quick binaural generation
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
- Deterministic analytical session/block reporting
- Local-computer deployment with ordinary Bluetooth audio-output support where useful
- Practical protocol optimization and MIP-plus development

## Current active protocol-development files

For work on REQUEST / READ testing, encoding/mapping, audio comparison, temporal mapping, target entropy, practical optimization, reporting, or the planned local research app, read these files before changing a protocol:

- `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md`
- `protocols/REQUEST_ENCODING_V0.1.md`
- `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
- `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
- `research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md`
- `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`
- `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
- `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
- `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
- `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
- `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.1.md`
- `engineering/CODEX_PROMPT_REQUEST_APP_V0.7.md`
- `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`

`protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md` remains the current full hands-free step-by-step execution guide. `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md` defines the current first-use timing choice: the participant requests an outcome `now` / at the next eligible event rather than reasoning about an absolute clock time while altered. This is a profile-level choice; the engine still implements relative-delay and absolute-date-time timing for future profiles.

`research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md` and `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md` require the software to separate objective machine state from human-facing labels and internal representation so literal digits, arbitrary mappings, gestalts, affect, and goal-oriented encodings can later be compared rather than assumed.

`engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md` defines the separate Audio Lab: three one-click initial presets, one-number centered-binaural quick mode with automatic left/right calculation, simple and advanced custom modes, continuous playback until manual pause/stop, and explicit save/version before a lab recipe can be used by a committed research session.

`engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.1.md` is the core software architecture decision. It requires stable engine code, validated versioned JSON experiment profiles, immutable per-session configuration snapshots, and configuration-driven request assignment, outcome spaces, mappings, timing, machine-output policies, session stages, audio recipes, analysis plans, reveal policies, and reporting.

`engineering/CODEX_PROMPT_REQUEST_APP_V0.7.md` is the current comprehensive implementation prompt. It supersedes earlier Codex prompts for new implementation work and explicitly incorporates the config-driven engine, hands-free execution, all timing families, human encoding/mapping separation, Audio Lab/quick player, deterministic audio synthesis, telemetry, subjective-time capture, immutable logging, reporting, tests, and dry-run acceptance criteria. The active build remains local-computer only; Android/mobile packaging, phone-control transport, cloud services, and databases are deferred.

The initial user audio condition `A-U396-4` is preserved as a personal experimental baseline. Historical/patent/scientific comparator conditions are kept separately labeled and must not be conflated.

See `00_MASTER.md` for current status and next actions.
