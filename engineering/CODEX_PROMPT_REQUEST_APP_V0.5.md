# Codex Prompt — MIP Request Test App v0.5

Implement the MIP local research application in `rezamr/MIP`.

Before coding, read in full:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
7. `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
8. `04_EVIDENCE_STANDARD.md`
9. `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md`
10. `protocols/REQUEST_ENCODING_V0.1.md`
11. `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
12. `protocols/MIP_NUM_REQUEST_V0.1.md`
13. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
14. `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
15. `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`
16. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
17. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
18. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
19. `engineering/CODEX_PROMPT_REQUEST_APP_V0.4.md`

Where v0.5 conflicts with earlier Codex prompts, v0.5 takes precedence. Preserve earlier prompts as history.

## Scope decision

Keep the first implementation deliberately small and easy to debug.

Build only a local-computer application for the first real trials.

Do NOT implement in v0.5:

- Android packaging;
- mobile application shells;
- phone installation;
- progressive-web-app packaging;
- phone-to-computer Bluetooth control;
- cloud services;
- remote accounts;
- synchronization;
- database engines.

Bluetooth is permitted only as an ordinary operating-system audio transport, for example connecting Bluetooth headphones to the local computer. The MIP application itself does not implement a Bluetooth protocol stack in v0.5.

If phone control is desired later, treat it as a separate deployment project after the local research core is stable.

## Required local architecture

Use the existing local-first design:

- Node.js 22+;
- minimal dependencies;
- local server bound to `127.0.0.1` unless a later explicit local-network requirement is approved;
- plain local HTML/CSS/JavaScript interface;
- JSON and JSONL storage only;
- no database;
- no cloud requirement;
- no telemetry;
- no generative-AI dependency.

## Core capabilities that MUST remain

Do not simplify away the research functions. v0.5 must still implement:

1. pre-session request assignment and commitment;
2. hands-free eyes-closed active session after one START action;
3. deterministic audio generation and cue timing;
4. enabled audio-condition generation from the current research matrix;
5. optional patent-grounded phased-pink reconstruction mode with provenance labels;
6. fixed-time target generation;
7. REQUEST single-bit mode;
8. REQUEST fixed-length stream mode;
9. READ single-bit and future-bit modes;
10. temporal scan and delay-sweep support already specified;
11. exact-token outcome spaces already specified, but they need not be exposed prominently in the first-use interface;
12. continuous ordered machine-output telemetry in stream/temporal modes;
13. raw immutable post-session report before reveal;
14. deterministic analytical session report after lock;
15. JSON/JSONL hash chain and session-file hashes;
16. calibration mode;
17. preservation of misses, aborted trials, and forgotten-request trials.

## Audio scope

Implement the audio requirements already defined, but keep the first operational screen focused on the initial comparison conditions.

For first-use conditions, prioritize:

- participant 396-center / 4-Hz condition;
- exact Monroe 100/104-Hz patent comparator;
- matched no-beat sham.

Additional audio conditions can exist in configuration without cluttering the first-use flow.

For phased-pink/noise reconstruction:

- implement only parameters that are source-supported or explicitly marked as MIP reconstruction;
- version and hash all synthesis parameters and generated files;
- never label the output as exact historical Gateway/CENTER LANE audio unless all material parameters are verified.

## Continuous sequence telemetry

For REQUEST stream trials, preserve the full ordered sequence or an exact lossless representation with timestamps sufficient to reconstruct the sequence timeline.

Calculate and report deterministically:

- total zeros and ones;
- requested-direction deviation;
- cumulative deviation over time;
- fixed-window deviation;
- first prespecified threshold crossing;
- first sustained threshold crossing;
- exploratory change-point estimate;
- peak deviation time;
- sustained-deviation duration;
- return-to-baseline estimate;
- offsets from request start/end, release, target time, and return cue.

Do not allow post-hoc change-point estimates to redefine the preregistered primary target window.

## Hands-free session flow

The active session must require zero device interaction after START.

Before START:

- assign request;
- show it clearly;
- require memory confirmation;
- commit request/timing/audio/protocol/random-source/nonce;
- present one START control.

After START:

- no screen interaction required;
- audio and cues run automatically;
- target generation runs automatically;
- result stays hidden;
- return cue runs automatically.

After the participant has returned:

- open raw-report screen first;
- collect report;
- lock report;
- only then permit reveal.

## Deterministic analytical report

After raw-report lock, automatically generate a reproducible report from stored data.

Include:

- request and protocol version;
- audio manifest/version/hash;
- cue and stage timeline;
- target schedule and actual time;
- timing error;
- random-source details;
- exact outcome;
- stream statistics and trend timing;
- pre/target/post windows where relevant;
- participant retrospective state timeline;
- forgotten/abort flags;
- integrity/hash validation;
- comparison with prior sessions only when the same frozen protocol permits valid comparison.

Do not use generative AI for the primary report.

## Completion criteria

Before declaring v0.5 ready:

1. run all automated tests;
2. produce one no-participant calibration bundle;
3. produce one dry request session bundle;
4. verify hands-free operation from START to return cue;
5. verify Bluetooth headphones work through ordinary operating-system audio output if available, without application-specific Bluetooth code;
6. verify sequence telemetry and trend report from the dry session;
7. verify lock/reveal behavior;
8. verify all hashes;
9. list every unsupported or approximate historical audio parameter;
10. provide one simple local-computer run procedure;
11. do not implement or debug Android/mobile packaging in this phase;
12. do not run a real participant session until the dry-run output has been reviewed.