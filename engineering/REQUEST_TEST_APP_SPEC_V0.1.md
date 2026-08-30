# MIP Request Test App — Engineering Specification v0.1

## Purpose

Build a small local-first research utility to support MIP binary READ and REQUEST trials without a database.

The application must prioritize:

- exact timing;
- deterministic protocol execution;
- immutable/tamper-evident logging;
- participant blinding where possible;
- JSON-based storage;
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
  sessions/
    S0003/
      session.json
      events.jsonl
      commitment.json
      request.json
      output.json
      response.json
      result.json
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

This creates an append-only hash chain.

At session close, calculate a SHA-256 hash for every session file and store it in `hashes.json`.

---

# Trial modes

## 1. REQUEST_SINGLE_BIT

Architecture:

`participant is assigned REQUEST 0/1 -> target time T -> RNG generates exactly one hidden output bit -> reveal after session lock`

Fields:

- requested_bit;
- target_time_utc;
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

---

# Random-source interface

Define a simple provider interface:

```text
RNGProvider
  id
  name
  source_type
  generate_bit()
  generate_bits(n)
  health_check()
  metadata()
```

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
- Log scheduler wake time and actual generation time separately.
- Record timing error in milliseconds.

Example:

```json
{
  "scheduled_time_utc": "...",
  "actual_generation_time_utc": "...",
  "timing_error_ms": 2.4
}
```

---

# Trial commitment

Before a trial starts, create a commitment object containing:

- trial ID;
- requested bit where REQUEST mode requires participant knowledge;
- target time;
- protocol version;
- audio condition ID;
- RNG provider ID;
- control label if participant is allowed to know it;
- random nonce.

Calculate and save:

`commitment_sha256`

Do not include the future RNG output because it does not yet exist in fixed-time REQUEST mode.

For READ mode where a target already exists, hash target + nonce before participant response.

---

# Blinding behavior

## REQUEST

Participant may see:

- requested bit;
- target time;
- countdown;
- protocol stage instructions.

Participant must not see:

- future machine output;
- hidden condition labels;
- hidden sham/control status when a blinded condition is used.

## READ

Participant must not see target before response lock.

---

# Audio-condition metadata

The app does not need to synthesize audio in the first minimal build, but every session must select/log an audio condition ID from `audio_conditions.json`.

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

# UI — minimal v0.1

Recommended screens:

1. **Home**
   - New REQUEST trial
   - New READ trial
   - Calibration
   - Session browser

2. **Trial setup**
   - mode;
   - requested value generation/manual test mode;
   - target time;
   - RNG provider;
   - audio condition;
   - request protocol version;
   - notes.

3. **Participant screen**
   - large requested bit for REQUEST;
   - target time/countdown;
   - current protocol stage;
   - `END SESSION` button;
   - no hidden machine output.

4. **Response lock screen**
   - free text/raw report;
   - READ bit response where applicable;
   - confidence;
   - lock button.

5. **Reveal/result**
   - requested bit;
   - output bit;
   - exact match;
   - target timing error;
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
- bit count;
- 0/1 counts;
- basic frequency/bias statistics;
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
- live statistical fishing across many endpoints.

Keep the first build auditable and small.
