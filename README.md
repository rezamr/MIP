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

## Current program areas

- Historical and archival reconstruction
- CENTER LANE / MIAS advanced training recovery
- Hemi-Sync audio engineering reconstruction
- Monroe patent analysis
- Bentov physiology reconstruction
- Session phenomenology
- REQUEST encoding / communication protocol development
- Immediate/relative request timing
- Audio component isolation
- Phased-pink / masking-noise engineering reconstruction
- READ / hidden-target tests
- REQUEST / binary machine-outcome tests
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

For work on REQUEST / READ testing, audio comparison, temporal mapping, target entropy, practical optimization, reporting, or the planned local research app, read these files before changing a protocol:

- `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md`
- `protocols/REQUEST_ENCODING_V0.1.md`
- `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
- `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
- `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`
- `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
- `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
- `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
- `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
- `engineering/CODEX_PROMPT_REQUEST_APP_V0.5.md`
- `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`

`protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md` remains the current full step-by-step execution guide, while `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md` introduces the pending timing correction for the next freeze: the participant requests an outcome `now` / at the next eligible event rather than reasoning about an absolute target clock time while altered. The computer still logs all exact times internally.

`engineering/CODEX_PROMPT_REQUEST_APP_V0.5.md` is the current implementation prompt but should not be treated as final until the immediate-request timing decision is incorporated into the next frozen prompt. The active build remains local-computer only; Android/mobile packaging and phone-control transport are deferred.

The initial user audio condition `A-U396-4` is preserved as a personal experimental baseline. Historical/patent/scientific comparator conditions are kept separately labeled and must not be conflated.

See `00_MASTER.md` for current status and next actions.
