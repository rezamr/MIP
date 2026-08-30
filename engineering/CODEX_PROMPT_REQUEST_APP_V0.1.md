# Codex Prompt — MIP Request Test App v0.1

Use this prompt when implementation begins.

---

You are implementing a small local-first research application for the repository `rezamr/MIP`.

Before coding, read:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `04_EVIDENCE_STANDARD.md`
7. `protocols/REQUEST_ENCODING_V0.1.md`
8. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
9. `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`

Treat the repository as the source of truth.

## Mission

Build **MIP Request Test App v0.1**, a minimal auditable local application for binary REQUEST and READ trials.

The application must not assume or claim that a MATRIX, anomalous influence, or nonlocal information channel exists. It is a protocol controller, random-output generator, audio generator, logger, and reveal tool.

## Technology constraints

Prefer a small Node.js implementation that is easy to audit.

Recommended:

- Node.js 22+
- ECMAScript modules
- built-in `crypto`, `fs`, `path`, `http` where practical
- minimal dependencies
- plain local HTML/CSS/JavaScript UI
- local server bound to `127.0.0.1` only

Do not add:

- SQL
- SQLite
- MongoDB
- any database
- authentication
- cloud services
- analytics
- telemetry
- AI interpretation

All persistent data must use JSON / JSONL files.

## Required storage layout

```text
data/
  config/
    protocol.json
    audio_conditions.json
  sessions/
    <SESSION_ID>/
      session.json
      events.jsonl
      commitment.json
      request.json
      output.json
      response.json
      result.json
      hashes.json
  calibration/
  audio/
```

Use append-only JSONL for event history.

Implement a SHA-256 event hash chain:

- each event stores `previous_hash`;
- canonicalize the event object;
- calculate `event_hash`;
- never rewrite old event lines.

At session close, SHA-256 every session file and store the digest list in `hashes.json`.

## Trial modes

Implement:

### `REQUEST_SINGLE_BIT`

1. Controller assigns requested bit randomly from `{0,1}` unless manual debug mode is explicitly selected.
2. Participant sees requested bit and exact target time.
3. Trial commitment is created before session execution.
4. At target time, OS CSPRNG generates exactly one hidden bit.
5. Output remains hidden until session/report lock.
6. Reveal shows exact match/miss.

### `REQUEST_STREAM`

1. Requested direction is `0` or `1`.
2. At exact machine-controlled target time generate a predeclared fixed-size binary stream.
3. Do not use optional stopping.
4. Record 0/1 counts and deviation in requested direction.
5. Store raw generated bits or a lossless representation plus hash.
6. Calculate a predefined exact binomial/two-sided and directional statistic in a transparent module.

Default stream size should be configurable, not hardcoded as a scientific truth.

### `READ_SINGLE_BIT`

1. Generate hidden target bit using OS CSPRNG.
2. Create target commitment with nonce/hash.
3. Participant enters `0` or `1` response and confidence.
4. Lock response.
5. Reveal target and exact match.

### `READ_FUTURE_BIT`

1. Participant response is entered and locked first.
2. Target bit is generated at the predefined future time.
3. Reveal afterward.
4. Clearly label this mode separately from ordinary READ.

## RNG providers

Create an interface that later permits hardware providers.

Implement initially:

### `OS_CSPRNG`

Use Node's cryptographically secure random API.

For a bit, avoid modulo bias even though range=2 is trivial; use `crypto.randomInt(0, 2)` or equivalent secure API.

### `DETERMINISTIC_TEST_PRNG`

Debug/testing only.

- seeded;
- reproducible;
- visually marked `TEST ONLY`;
- never silently used in a real session.

Design interfaces for future:

- USB/serial hardware RNG;
- electronic-noise RNG;
- quantum RNG;
- remote isolated RNG.

Do not implement remote services in v0.1.

## Timing

- Authoritative timestamps: UTC ISO-8601 with millisecond or better resolution available from platform.
- Also record monotonic duration values.
- For target events record:
  - scheduled UTC time;
  - actual generation UTC time;
  - timing error in milliseconds.
- Never silently change a past target time.

## Session lock/reveal

There must be a clear state machine, e.g.:

`DRAFT -> COMMITTED -> ACTIVE -> RESPONSE_LOCKED -> GENERATED -> REVEALED -> CLOSED`

Exact transitions may vary by mode, but invalid transitions must be rejected.

After response/session lock:

- raw response cannot be edited;
- requested value cannot be changed;
- target time cannot be changed;
- audio condition cannot be changed;
- late notes are append-only events.

## REQUEST protocol UI

For REQUEST trials display:

- session ID;
- requested bit in very large type;
- target time;
- countdown;
- audio condition ID;
- protocol version;
- current REQUEST_ENCODING stage.

Stages from `REQUEST_ENCODING_V0.1.md`:

1. state stabilization
2. semantic lock
3. symbolic encoding
4. controlled affective tag
5. release
6. neutral hold

Include a visible `END SESSION` button that logs termination time/reason and never deletes the trial.

Do not display machine output before reveal.

## Audio generation module

Implement deterministic offline stereo WAV generation so MIP is not dependent on a third-party tone app for future controlled audio comparisons.

Requirements:

- PCM WAV
- stereo
- sample rate `48000 Hz`
- prefer `24-bit` PCM if implemented correctly; otherwise use `16-bit` PCM and document the limitation
- pure sine components for v0.1
- configurable duration
- identical fade-in/fade-out envelope across conditions
- normalize output so multi-tone conditions are not simply louder than single-pair conditions
- log exact synthesis settings
- SHA-256 every generated WAV

Initial enabled audio conditions:

### `A-U396-4`

Current reconstructed implementation based on TMSOFT's documented centered-base rule:

- Left `394 Hz`
- Right `398 Hz`
- difference `4 Hz`
- center `396 Hz`

Label: `USER_EXPERIMENTAL / RECONSTRUCTED_FROM_APP_DOCUMENTATION`

### `A-P100-104`

- Left `100 Hz`
- Right `104 Hz`
- difference `4 Hz`

Label: `MONROE_PATENT_EXAMPLE`

### `A-PSEPTON-4`

Left components:

- 200
- 204
- 208 Hz

Right components:

- 204
- 208
- 212 Hz

Equal component gain before final RMS normalization.

Label: `MONROE_LATER_PATENT_SEPTON_EXAMPLE`

### `A-S400-4`

- Left `398 Hz`
- Right `402 Hz`
- difference `4 Hz`
- center `400 Hz`

Label: `SCIENTIFIC_EXPERIMENTAL_CONTROL`

### `A-SHAM-0`

- Left `396 Hz`
- Right `396 Hz`
- difference `0 Hz`

Label: `SHAM`

Add but default-disable pending source-level verification:

- `A-C200-4`
- `A-C100-1.5`

Do not invent their exact channel frequencies until the MIP research file explicitly verifies the historical semantics.

## Audio safety/UI behavior

- Do not set or force system volume.
- Display a warning to begin at a low comfortable listening level.
- No maximum-volume recommendation.
- No subliminal or ultrasonic output.
- Do not synthesize frequencies outside ordinary audible ranges in v0.1.

## Calibration

Add a calibration page/tool:

- choose RNG provider;
- generate configurable number of bits with no participant/request session;
- store raw output or compact lossless representation;
- calculate number of zeroes/ones;
- simple bias statistic;
- session-independent JSONL log;
- SHA-256 result file.

Do not overclaim statistical quality from a small calibration sample.

## UI pages

Keep UI minimal:

1. Home
2. New Trial
3. Participant/Countdown
4. Raw Report / Response Lock
5. Reveal
6. Session Browser
7. Calibration
8. Audio Generator

No dashboard bloat.

## Tests

Write automated tests for at least:

- RNG bit range;
- deterministic test provider reproducibility;
- commitment hash reproducibility;
- event hash-chain validity;
- state-machine invalid transition rejection;
- response immutability after lock;
- output hiding before reveal;
- correct exact-match scoring;
- correct REQUEST_STREAM bit counts/statistic;
- WAV header/channel/sample-rate correctness;
- generated frequency accuracy within numerical tolerance;
- Septon component frequencies;
- session file hash generation;
- UTC target scheduling behavior using fake clocks where possible.

## Documentation

Add:

- setup/run instructions;
- architecture notes;
- data-format documentation;
- example session files;
- explanation that no database is used;
- clear research-status labels.

## Repository discipline

Do not overwrite existing MIP research conclusions.

If implementation requires a protocol change:

1. document the proposed change;
2. explain why;
3. update the relevant versioned protocol file;
4. update `00_MASTER.md` if project state materially changes.

Before finishing, run tests and report exactly what was implemented, what remains unsupported, and what is intentionally deferred.
