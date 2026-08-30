# Codex Prompt — MIP Request Test App v0.2

You are implementing a small local-first research application for the repository `rezamr/MIP`.

Before coding, read in full:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
7. `04_EVIDENCE_STANDARD.md`
8. `protocols/REQUEST_ENCODING_V0.1.md`
9. `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
10. `protocols/MIP_NUM_REQUEST_V0.1.md`
11. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
12. `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
13. `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`

Treat the repository as the source of truth.

## Mission

Build **MIP Request Test App v0.2**, a minimal auditable local application for REQUEST, READ, temporal-mapping, and exact-target trials.

The application is a protocol controller, random-output generator, audio generator, immutable logger, and reveal tool. It must not claim that MATRIX/anomalous influence exists.

## Technology constraints

Prefer:

- Node.js 22+
- ECMAScript modules
- built-in `crypto`, `fs`, `path`, `http` where practical
- minimal dependencies
- plain local HTML/CSS/JavaScript UI
- server bound to `127.0.0.1` only

Do not add:

- SQL/SQLite/MongoDB/any database
- user accounts
- cloud services
- analytics/telemetry
- AI interpretation

All persistent data must use JSON / JSONL files.

## Required capabilities

Implement the storage, hash-chain, state-machine, timing, calibration, audio-generation, lock/reveal, and RNG-provider requirements in `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`.

In addition, the following modes are mandatory:

### REQUEST_SINGLE_BIT

Randomly assigned requested bit `{0,1}` unless explicit debug/manual mode is selected.

Future output generated at exact machine-controlled target time.

### REQUEST_STREAM

Fixed-size binary stream generated at fixed target time/window. No optional stopping in normal MIP mode.

### READ_SINGLE_BIT

Hidden machine target first, participant response locked, then reveal.

### READ_FUTURE_BIT

Participant response locked first, target generated later.

### REQUEST_TEMPORAL_SCAN

- request encoded at t0;
- record configured pre/target/post windows;
- primary target window is frozen before the session;
- neighboring windows are exploratory only;
- never automatically select the best lag after outcome inspection.

### REQUEST_DELAY_SWEEP

Support configurable request-to-target delays, including immediate, minutes, hours, and multi-day delays.

### REQUEST_PREGENERATED_HIDDEN

- generate hidden outcome before participant request;
- commit target with SHA-256 + nonce;
- no reveal/access before session lock;
- log first-observation/reveal time;
- keep these trials separate from future-generation REQUEST trials.

### REQUEST_EXACT_TOKEN

Support exact uniformly sampled outcome spaces:

- 2 / 1 bit
- 4 / 2 bits
- 16 / 4 bits
- 256 / 8 bits
- 65,536 / 16 bits
- 1,048,576 / 20 bits
- 1,073,741,824 / 30 bits

Do not materialize huge pools. Generate a uniform integer index in `[0,N)` using cryptographically secure unbiased sampling.

Use `crypto.randomInt` where supported or rejection sampling for larger ranges. Never use modulo reduction that can create bias.

Provide a one-to-one human-readable token representation using a versioned Base32 or Base36 mapping.

Primary score is exact equality only.

## Timing model

Every relevant trial must log:

- request encoding start/end UTC;
- requested execution time/window;
- scheduled machine event time;
- actual machine event time;
- request-to-target delay;
- scheduler error;
- reveal/first-observation time;
- monotonic durations.

Support negative temporal displacement metadata for pre-generated hidden outcomes.

## JSON configuration

Add:

```text
data/config/temporal_conditions.json
data/config/outcome_spaces.json
```

Example temporal condition:

```json
{
  "id": "T-10M",
  "mode": "future_fixed",
  "delay_seconds": 600,
  "primary_window_seconds": 1,
  "pre_windows_seconds": [-60, -10, -1],
  "post_windows_seconds": [1, 10, 60]
}
```

Example outcome space:

```json
{
  "id": "E20",
  "size": 1048576,
  "entropy_bits": 20,
  "representation": "base32_token",
  "mapping_version": "v1",
  "primary_score": "exact_match"
}
```

## Block-level reveal

Implement an option to keep all outcomes hidden until an entire prespecified trial block is closed and hashed.

This is important to reduce adaptive stopping and outcome-driven protocol changes.

## Audio

Implement deterministic stereo WAV generation for currently enabled MIP audio conditions defined in `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`.

At minimum support:

- `A-U396-4`
- `A-P100-104`
- `A-PSEPTON-4`
- `A-S400-4`
- `A-SHAM-0`

Keep unverified CENTER LANE channel reconstructions disabled until repository evidence status changes.

Generate reproducible PCM WAV files, log exact synthesis parameters, RMS-normalize multi-tone vs single-tone conditions, and SHA-256 every generated audio file.

## Calibration and validation

Add tests for:

- RNG uniformity smoke tests;
- exact integer range correctness;
- no modulo bias in configured outcome spaces;
- commitment reproducibility;
- hash-chain integrity;
- lock immutability;
- hidden-output behavior;
- UTC scheduling using fake clocks where practical;
- temporal-window classification;
- negative temporal displacement metadata;
- Base32/Base36 index<->token bijection;
- exact-token scoring;
- 30-bit outcome-space boundary values;
- block-level reveal;
- WAV channel/frequency correctness.

## Scientific guardrails in software

The UI and reports must:

- label primary vs exploratory temporal windows;
- show nominal null exact-match probability as `1/N` for exact uniform target modes;
- never call a hit proof of MATRIX/influence;
- never combine pre-generated and future-generated trials silently;
- never auto-select a successful neighboring time bin;
- never permit editing locked request/target/timing fields;
- preserve misses and aborted trials.

## Documentation

Document:

- installation/run procedure;
- file layout;
- state machine;
- RNG provider interface;
- temporal model;
- outcome-space model;
- JSON schemas/examples;
- security/privacy behavior;
- known limitations;
- exactly what remains deferred to later hardware-RNG work.

Before finishing:

1. run automated tests;
2. provide a concise implementation report;
3. list every deviation from the MIP specifications;
4. do not silently change research protocols;
5. update MIP durable files if implementation required a justified protocol revision.
