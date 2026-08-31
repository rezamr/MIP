# Codex Prompt — MIP Request Test App v0.4

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
19. `engineering/MOBILE_LOCAL_INSTALL_REQUIREMENTS_V0.1.md`
20. `engineering/CODEX_PROMPT_REQUEST_APP_V0.3.md`

Where this v0.4 prompt conflicts with earlier Codex prompts, v0.4 takes precedence. Preserve earlier versions as history.

## Main correction and expansion

The application must now be designed as a complete local research instrument, not only a binary output screen.

It must include:

- hands-free eyes-closed session execution;
- deterministic layered stereo audio synthesis;
- exact versioned tone/noise manifests and hashes;
- patent-grounded phased-pink reconstruction capability;
- continuous machine-output telemetry;
- temporal trend-onset/change-point analysis;
- raw immutable post-session reporting;
- deterministic analytical session and block reports;
- local Android installation path in addition to desktop/local-computer use.

## Audio

Implement `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`.

Important distinction:

- simple first-block conditions remain pure-tone where the protocol requires isolation;
- implement a separate patent-grounded phased-pink synthesis mode based on US 5,356,368;
- never label generated audio as exact 1983 Gateway/CENTER LANE audio unless repository evidence explicitly verifies all material parameters.

For the patent-grounded phased-pink mode implement, to the extent recoverable:

- deterministic 16-bit shift-register noise source;
- 65,535-sample sequence behavior for the patent-style generator mode;
- filtering toward pink/red noise;
- stereo delay-line/comb-filter processing;
- low-frequency delay sweep near 1/8 Hz;
- configurable left/right sweep phase/amplitude relationship;
- envelope control;
- support for amplitude/frequency modulation;
- versioned parameters and seed;
- full audio manifest and SHA-256.

Do not silently invent unrecovered patent coefficients. Put such values in explicit MIP reconstruction configuration with status labels.

## Continuous telemetry and onset analysis

Implement `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`.

For stream/temporal modes, store enough ordered time-series data to reconstruct the full machine-output history.

Provide deterministic analysis for:

- cumulative requested-direction deviation;
- fixed-window deviation;
- first prespecified threshold crossing;
- first sustained crossing;
- exploratory change-point estimate;
- peak deviation time;
- sustained-deviation duration;
- return-to-baseline estimate;
- relationship to request start/end, release, target time, and nearby windows.

Do not permit the exploratory change-point to redefine the primary target window after the fact.

## Participant state timing

The app must distinguish machine trend timing from participant-state timing.

Without sensors, do not claim to know objective internal-state onset.

After return and before reveal, collect retrospective onset estimates relative to session cues for:

- first clear state change;
- vibration/pulse;
- rotation;
- imagery;
- sensed interaction/presence;
- strongest-state period;
- acknowledgement-like event;
- return toward ordinary state.

## Reporting

Implement a deterministic 'smart' report after raw-report lock.

It must automatically summarize:

- protocol and audio versions;
- exact request;
- cue/stage timeline;
- target and actual event times;
- scheduler error;
- random-source details;
- exact result and stream statistics;
- pre/target/post windows;
- trend-onset/change-point results;
- participant subjective timeline;
- integrity/hash checks;
- abort/forgotten-request flags;
- comparison with prior sessions using the same frozen protocol when sufficient data exist.

Do not use generative AI to create the primary analytical report.

If an optional interpretive assistant is added later, it must run only after all raw and deterministic reports are locked and must never modify them.

## Mobile/local deployment

Implement `engineering/MOBILE_LOCAL_INSTALL_REQUIREMENTS_V0.1.md`.

The same research core should support:

1. desktop/local-computer execution;
2. installable Android execution.

For Android, package the local web interface in an auditable local application shell such as Capacitor or an equivalent solution.

Requirements:

- no cloud server required;
- local JSON/JSONL/audio storage;
- offline operation;
- active hands-free session must continue with screen dimmed;
- deterministic cue and target timing;
- local filesystem session bundles;
- export/import with hash verification;
- clear Android build and installation documentation;
- no unnecessary networking or telemetry.

A browser-installable progressive version may be provided as a convenience, but it must not be the only Android deployment if browser limitations weaken timing/audio/filesystem guarantees.

## Tests

In addition to all v0.2/v0.3 tests, add tests for:

- phased-pink deterministic reproducibility;
- noise spectral behavior within tolerance;
- delay-sweep rate;
- left/right phase behavior;
- no audio clipping;
- continuous stream timestamp ordering;
- trend-threshold calculations;
- change-point reproducibility;
- primary-window immutability;
- deterministic session-report reproduction from the same locked data;
- mobile filesystem bundle integrity;
- Android hands-free run with screen dimming;
- export/import hash verification.

## Completion criteria

Before declaring implementation ready:

1. run all automated tests;
2. document desktop run procedure;
3. document Android build/install procedure;
4. generate at least one dry session and one calibration bundle;
5. generate the deterministic analytical report for the dry session;
6. verify all hashes;
7. list every unsupported or approximate historical audio parameter explicitly;
8. do not run a real participant session until the research owner reviews the dry-run output.