# MIP Session Telemetry and Reporting Requirements v0.1

## Purpose

Define continuous machine-side logging, temporal trend analysis, participant-state annotations, and post-session reporting.

## Two different timelines must never be conflated

### A. Machine-output timeline

The application can objectively know when random-system output statistics begin to deviate from baseline because it records every generated event with timestamps.

### B. Participant-state timeline

Without physiological sensors, the application cannot objectively know the exact instant the participant's internal state changes. It can know protocol stage/cue times and can collect retrospective onset estimates after return. Future physiology may provide objective markers.

## Continuous machine logging

For any stream or temporal-scan trial, preserve the full ordered output with authoritative UTC and monotonic timing.

Log at minimum:

- session start;
- audio start;
- every protocol cue;
- request-encoding start/end;
- release start;
- target-window start/end;
- every stream block or every bit/event where storage size permits;
- pre-target windows;
- post-target windows;
- return cue;
- participant return confirmation;
- raw-report lock;
- reveal.

## Trend-onset analysis

The application must support analysis of when a directional deviation appears relative to request encoding and target time.

Required outputs:

- cumulative requested-direction deviation over time;
- fixed-window deviation series;
- predeclared threshold-crossing times;
- first sustained threshold crossing under a versioned rule;
- exploratory change-point estimate;
- peak deviation time;
- duration of sustained deviation;
- return-to-baseline estimate.

The raw timeline must always remain available.

### Guardrail

Exploratory change-point algorithms may describe where the data appear to change, but they may not redefine the preregistered primary target window after the fact.

## Participant-state onset

Immediately after return and before reveal, ask the participant to estimate whether and when any noticeable state changes occurred relative to the audible stage cues.

Capture:

- first clear altered-state sensation;
- first vibration/pulse;
- first rotation/vestibular sensation;
- first spontaneous imagery;
- first sensed-presence/interaction event;
- strongest-state period;
- perceived acknowledgement-like event;
- perceived return toward ordinary state.

Allow answers such as `unknown` or `not experienced`.

Future physiology integration may add heart rate, HRV, respiration, EEG, EDA, motion, or other signals, but no unsupported physiological inference is permitted in v0.x.

## Reporting architecture

The report has three layers.

### Layer 1 — Raw immutable record

Generated before reveal and never edited afterward.

### Layer 2 — Deterministic analytical report

Generated automatically from locked data and includes:

- protocol/audio versions;
- exact request;
- all stage times;
- machine target times;
- timing error;
- random-source metadata;
- requested-direction stream statistics;
- exact single-outcome result where applicable;
- pre/target/post window comparison;
- trend-onset and change-point summaries;
- participant subjective timeline;
- aborted/forgotten-request status;
- hashes and data-integrity checks;
- comparison with prior sessions using the same frozen protocol where enough data exist.

This layer must be reproducible from stored data and must not use generative interpretation.

### Layer 3 — Optional interpretive assistant report

Only after raw data and deterministic analysis are locked, a later optional assistant may summarize patterns and propose next protocol questions.

It must:

- never alter raw data;
- clearly separate observation, analysis, and hypothesis;
- display both hits and misses;
- mention sample size and uncertainty;
- never call a result proof of MATRIX or a unique mechanism;
- never select favorable windows silently.

The first production version may omit Layer 3 while still providing a strong 'smart' deterministic report.

## Cross-session report

The application should generate a block report comparing:

- audio conditions;
- requested 0 versus requested 1;
- sham/no-intention conditions;
- request-to-target delays;
- target-window versus surrounding windows;
- subjective state strength versus objective performance;
- trend-onset timing;
- forgotten/aborted rates.

No condition may be declared better based on one session.
