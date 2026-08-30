# MIP Request Test App — Engineering Specification v0.1

## Purpose

Build a small local-first research utility to support MIP READ and REQUEST trials without a database.

The application must prioritize:

- exact timing;
- deterministic protocol execution;
- immutable/tamper-evident logging;
- participant blinding where possible;
- JSON-based storage;
- temporal-response mapping;
- configurable outcome entropy;
- simple future extensibility to hardware/physical RNG sources.

The application is a research logger/controller, not evidence that anomalous communication exists.

---

# Storage policy

No SQL/NoSQL database in v0.1.

Use filesystem storage only.

Recommended structure:

```text
data/
  config/
    protocol.json
    audio_conditions.json
    temporal_conditions.json
    outcome_spaces.json
  sessions/
    S0003/
      session.json
      events.jsonl
      commitment.json
      request.json
      output.json
      response.json
      result.json
      temporal_windows.json
      hashes.json
  calibration/
    rng_baseline_YYYYMMDD.jsonl
```

Use standard JSON for state/config objects and **JSON Lines (`.jsonl`)** for append-only event logs.

---

# Tamper-evident event chain

Every event in `events.jsonl` should contain:

```json
{
  "event_index": 12,
  "timestamp_utc": "2026-09-01T02:00:00.123456Z",
  "monotonic_ms": 3912923.82,
  "event_type": "rng_output",
  "payload": {},
  "previous_hash": "...",
  "event_hash": "..."
}
```

`event_hash = SHA256(canonical_json(event_without_event_hash))`

At session close, calculate a SHA-256 hash for every session file and store it in `hashes.json`.

---

# Trial modes

## 1. REQUEST_SINGLE_BIT

Architecture:

`participant is assigned REQUEST 0/1 -> target time T -> RNG generates exactly one hidden output bit -> reveal after session lock`

Fields:

- requested_bit;
- request_encoding_time_utc;
- target_time_utc;
- request_to_target_delay_ms;
- output_bit;
- exact_match;
- audio_condition_id;
- encoding_protocol_version;
- RNG source.

## 2. REQUEST_STREAM

Architecture:

`participant requests direction 0/1 -> target window begins at fixed machine time -> RNG produces fixed-size binary stream -> directional shift measured`

Initial configurable parameters:

- target window start time;
- fixed bit count;
- fixed sampling rate if applicable;
- requested direction;
- number of 1s;
- number of 0s;
- signed deviation from 0.5;
- predefined z/binomial score;
- control-window results.

No sequential optional stopping in MIP v0.1 unless a separate historical-replication mode explicitly implements the original rule.

## 3. READ_SINGLE_BIT

Architecture:

`machine generates hidden bit -> participant enters response -> response is locked -> target reveal`

## 4. READ_FUTURE_BIT

Architecture:

`participant response is locked -> machine generates hidden bit later -> reveal`

Keep this distinct from ordinary READ because it tests a different timing architecture.

## 5. REQUEST_TEMPORAL_SCAN

Architecture:

`request encoded at t0 -> system records hidden outcomes in pre/target/post windows -> preregistered target window remains primary -> neighboring windows estimate temporal spread`

Required fields:

- request_encoding_time_utc;
- primary_target_time_utc;
- primary_target_window_ms;
- pre_window definitions;
- post_window definitions;
- requested value/direction;
- output for every window;
- primary-endpoint flag;
- exploratory-window flag.

The app must never automatically relabel the best-performing neighboring window as the primary target.

## 6. REQUEST_DELAY_SWEEP

Used in balanced exploratory blocks to estimate response versus request-target delay.

Candidate delays are configuration-driven, for example:

- 0 min;
- 1 min;
- 10 min;
- 60 min;
- 24 h.

The delay assignment must be logged before outcome generation.

## 7. REQUEST_PREGENERATED_HIDDEN

Architecture:

`system generates and commits hidden outcome first -> nobody sees it -> participant later performs request -> session locks -> reveal`

This mode is a separate time-displaced/retroactive test. It must never be pooled with ordinary future-generation REQUEST trials without an explicitly prespecified model.

Required metadata:

- outcome_generation_time_utc;
- outcome_commitment_hash;
- first_observation/reveal time;
- request_encoding_time_utc;
- temporal displacement;
- access audit showing the participant was not shown the target before lock.

## 8. REQUEST_EXACT_TOKEN

Architecture:

`participant requests one exact token/index from a declared uniformly sampled outcome space -> system generates one outcome at target time -> exact equality scored`

Outcome spaces must support at least:

- 2 outcomes / 1 bit;
- 4 / 2 bits;
- 16 / 4 bits;
- 256 / 8 bits;
- 65,536 / 16 bits;
- 1,048,576 / 20 bits;
- 1,073,741,824 / 30 bits.

The app does not need to store all members of large spaces. A uniform random index in `[0, N-1]` is sufficient.

A display token may be derived one-to-one from the index using a versioned Base32/Base36 mapping.

Primary endpoint: **exact match only**.

No fuzzy or partial matching in the primary endpoint.

---

# Random-source interface

Define a simple provider interface:

```text
RNGProvider
  id
  name
  source_type
  generate_integer(max_exclusive)
  generate_bit()
  generate_bits(n)
  health_check()
  metadata()
```

`generate_integer(max_exclusive)` must use rejection sampling or another unbiased method. Never use a naive modulo operation when it would produce modulo bias.

Initial implementations:

1. `OS_CSPRNG`
   - local cryptographically secure OS entropy;
   - implementation using standard platform cryptographic APIs;
   - suitable for software baseline and READ tests.

2. `DETERMINISTIC_PRNG_TEST`
   - seeded deterministic source;
   - used only for software validation/control testing;
   - seed must be hidden until reveal where applicable.

Future adapters:

- hardware electronic-noise RNG;
- quantum RNG;
- serial/USB RNG;
- remote isolated RNG service.

Do not claim a software CSPRNG is physically equivalent to the historical Army electronic-noise/beta-decay sources.

---

# Timing requirements

- All stored timestamps in UTC.
- Display local time optionally, but log UTC as authoritative.
- Use monotonic clock for duration measurements.
- Schedule target generation against system UTC clock.
- Log request-encoding start/end separately from target time.
- Log scheduler wake time and actual generation time separately.
- Record timing error in milliseconds.
- Record `request_to_target_delay_ms` explicitly.
- Support target delays ranging from immediate to multi-day.

Example:

```json
{
  "request_encoding_end_utc": "...",
  "scheduled_time_utc": "...",
  "actual_generation_time_utc": "...",
  "request_to_target_delay_ms": 600000,
  "timing_error_ms": 2.4
}
```

---

# Trial commitment

Before a trial starts, create a commitment object containing:

- trial ID;
- requested value/token where REQUEST mode requires participant knowledge;
- outcome-space definition and size;
- target time/window;
- protocol version;
- temporal-condition ID;
- audio condition ID;
- RNG provider ID;
- control label if participant is allowed to know it;
- random nonce.

Calculate and save:

`commitment_sha256`

Do not include the future RNG output because it does not yet exist in fixed-time REQUEST mode.

For READ or PREGENERATED modes where a target already exists, hash target + nonce before participant response/request.

---

# Blinding behavior

## REQUEST

Participant may see:

- requested bit/token;
- target time/window when protocol requires it;
- countdown;
- protocol stage instructions.

Participant must not see:

- future machine output;
- hidden condition labels;
- hidden sham/control status when a blinded condition is used;
- neighboring temporal-window outputs until the configured reveal stage.

## READ

Participant must not see target before response lock.

## Block-level reveal

The app should support delayed reveal until a complete trial block is locked. This reduces adaptive behavior, selective stopping, and learning from individual outcomes.

---

# Audio-condition metadata

Every session must select/log an audio condition ID from `audio_conditions.json`.

Required fields:

```json
{
  "id": "A-U396-4",
  "status": "USER_EXPERIMENTAL",
  "center_hz": 396.0,
  "beat_hz": 4.0,
  "left_hz": 394.0,
  "right_hz": 398.0,
  "architecture": "single_pair_centered",
  "notes": "Reconstructed from current TMSOFT documented synthesis rule"
}
```

Future build may add local WAV generation/playback, but it must preserve exact per-channel parameters and hashes.

---

# Temporal-condition metadata

Example:

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

A separate `mode` value must identify pre-generated/retroactive trials.

---

# Outcome-space metadata

Example:

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

Uniformity validation must be possible for every configured space.

---

# UI — minimal v0.1

Recommended screens:

1. **Home**
   - New REQUEST trial
   - New READ trial
   - Temporal mapping
   - Exact-token test
   - Calibration
   - Session browser

2. **Trial setup**
   - mode;
   - requested value generation/manual test mode;
   - outcome space;
   - target time/delay;
   - temporal condition;
   - RNG provider;
   - audio condition;
   - request protocol version;
   - reveal policy;
   - notes.

3. **Participant screen**
   - requested bit/token for REQUEST;
   - target time/countdown where applicable;
   - current protocol stage;
   - `END SESSION` button;
   - no hidden machine output.

4. **Response lock screen**
   - free text/raw report;
   - READ response where applicable;
   - confidence;
   - lock button.

5. **Reveal/result**
   - requested value/token;
   - output;
   - exact match;
   - target timing error;
   - request-target delay;
   - temporal-window summary;
   - outcome-space size and nominal null exact-match probability;
   - file hashes;
   - no editable historical fields after lock.

---

# Session immutability

After `LOCK SESSION`:

- raw request/response fields become read-only;
- reveal is logged as a new event;
- late notes are appended as `late_recollection` events rather than modifying raw fields.

---

# Calibration mode

The application must support RNG baseline generation without a participant/session intention.

Calibration should log large blocks of outputs with:

- source ID;
- timestamps;
- bit count or outcome-space size;
- counts/frequency distribution;
- basic frequency/bias statistics;
- uniformity checks for large-N spaces;
- optional serial-correlation metrics later.

This creates a device/software baseline before communication testing.

---

# Security / privacy

- Local-only by default.
- No analytics.
- No cloud account.
- No network requirement for the initial OS_CSPRNG version.
- Never upload session content automatically.

---

# v0.1 exclusions

Do not add yet:

- database;
- user accounts;
- cloud synchronization;
- AI interpretation;
- automatic claim classification;
- complicated dashboards;
- hardware RNG support before the provider interface is stable;
- live statistical fishing across many endpoints;
- automatic selection of a best temporal lag after outcome inspection.

Keep the first build auditable and small.

---

# Required linked protocol

Temporal and high-entropy behavior must follow:

- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
