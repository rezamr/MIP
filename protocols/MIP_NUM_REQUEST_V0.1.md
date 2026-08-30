# MIP-NUM-REQUEST v0.1

## Status

`EXPERIMENTAL DESIGN — NOT YET CONFIRMATORY`

This protocol is the first integrated MIP design for testing a binary request directed toward a future independently generated machine outcome.

Operationally:

`participant requests 0/1 -> fixed protocol -> machine generates later -> correspondence measured`

This does not assume a MATRIX or causal influence mechanism exists.

---

# Primary question

Can a precommitted requested binary value correspond to a later machine-generated value more often than expected under the null model?

Secondary questions:

- Does audio condition change request performance?
- Does audio condition change only subjective state, or also objective performance?
- Is any apparent effect specific to requested value?
- Is any apparent effect specific to requested time?
- Does any effect survive sham/no-intention controls?

---

# Experimental alphabet

Initial requested values:

- `0`
- `1`

The controller should randomly assign the requested value on each trial unless a separate debug/exploratory mode explicitly permits manual selection.

---

# Request encoding

Use:

`protocols/REQUEST_ENCODING_V0.1.md`

Initial fixed bundle:

`SER-A`

Do not change the request encoding method while comparing audio conditions.

---

# Audio plan

Use:

`research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`

## Phase A initial candidates

1. `A-U396-4`
2. `A-P100-104`
3. `A-PSEPTON-4`
4. `A-S400-4`
5. `A-SHAM-0`

The purpose of Phase A is to hold the primary beat frequency at 4 Hz for active conditions while varying carrier/architecture.

CENTER LANE reported `A-C200-4` and `A-C100-1.5` remain pending exact source semantics before historical reconstruction labels are used.

---

# Development sequence

## Stage 0 — Tool and RNG validation

Before request trials:

- implement MIP Request Test App;
- verify JSON/JSONL logging;
- verify event hash chain;
- verify fixed-time scheduling;
- verify output hidden until reveal;
- verify CSPRNG behavior;
- run large no-participant calibration blocks;
- generate and hash exact audio files.

No communication conclusion may be drawn from software debugging runs.

---

## Stage 1 — Audio/state pilot

Purpose:

Identify whether candidate audio conditions produce meaningfully different state quality or tolerability before using large request trial blocks.

Suggested exploratory design:

- randomized audio-condition order;
- same REQUEST_ENCODING instructions or no target outcome during pure state sessions;
- minimum several repeats per condition before ranking;
- preserve all failures/interruption sessions;
- analyze subjective/state variables without claiming communication performance.

State metrics:

- time to state change;
- stability;
- alertness;
- drowsiness;
- time distortion;
- pulse/vibration;
- rotation;
- spontaneous imagery;
- sensed presence;
- voluntary-control stability;
- termination responsiveness;
- overall reproducibility.

No condition is selected solely because one session was dramatic.

---

## Stage 2 — Exploratory REQUEST_SINGLE_BIT

Architecture:

1. App assigns requested bit `0` or `1`.
2. App creates trial commitment.
3. Participant enters assigned audio/communication state.
4. Participant executes `SER-A` request encoding.
5. Participant releases the request.
6. At fixed machine-controlled target time, CSPRNG generates one hidden bit.
7. Participant completes/locks raw session report.
8. App reveals output.
9. Exact match/miss is logged.

The participant must not choose the machine generation instant.

Primary exploratory endpoint:

`exact_match = requested_bit == generated_bit`

Chance baseline under an unbiased binary generator:

`0.5`

---

## Stage 3 — REQUEST_STREAM

Purpose:

Increase sensitivity by measuring directional shift in a predefined binary stream rather than relying only on one future bit.

Architecture:

1. Requested direction randomly assigned: `0` or `1`.
2. Fixed target time/window precommitted.
3. Participant executes request protocol.
4. At target time, machine produces a fixed-size stream.
5. No optional stopping.
6. Analyze directional deviation toward requested bit.
7. Compare against calibration and control windows.

This differs from the historical 1979/1980 Remote Perturbation protocol, which used sequential stopping/feedback. MIP may later implement a separate historical replication mode.

---

# Control families

## C0 — RNG calibration

No participant/request.

Purpose:

- baseline bias;
- software/device behavior;
- timing behavior.

## C1 — SHAM audio

Same session/request procedure with `A-SHAM-0`.

## C2 — No-intention control

Participant enters comparable rest/state period but does not encode a requested value.

## C3 — Mismatched-time control

Analyze matched windows before/after the actual target time.

## C4 — Request-label inversion analysis

Because requested 0/1 values are randomized, test whether correspondence follows the trial-specific request rather than one permanently favored output.

## C5 — Future hardware-source replication

Repeat strongest protocol using a physical/hardware random source.

---

# Timing rule

The target time is machine-controlled.

Record:

- requested target time UTC;
- actual generation time UTC;
- timing error milliseconds;
- encoding start/end times;
- release time;
- session termination time.

The participant must not trigger output generation manually in the primary fixed-time protocol.

---

# Reveal rule

Do not reveal output during active encoding or neutral hold.

For strongest procedure:

- machine generates hidden output at T;
- raw session report is locked;
- output is then revealed.

This allows MIP to preserve any spontaneous post-request number perception separately from the requested bit.

---

# Frequency comparison rule

Do not compare frequencies by subjective intensity alone.

For each audio condition calculate/track separately:

### State score family

- reproducibility;
- stability;
- alertness;
- comfort;
- voluntary-control quality.

### Objective REQUEST score family

- single-bit match rate;
- stream directional effect;
- effect vs sham;
- effect vs no-intention;
- time specificity;
- request specificity.

A condition can be classified as:

- `STATE-STRONG / REQUEST-NULL`
- `STATE-WEAK / REQUEST-POSITIVE`
- `STATE-STRONG / REQUEST-POSITIVE`
- `NULL`
- `UNRESOLVED`

---

# Confirmatory gate

Do not promote the protocol to confirmatory status until:

- app implementation is tested;
- audio files are deterministic and hashed;
- selected audio conditions are frozen;
- request encoding version is frozen;
- RNG provider is frozen;
- target timing is frozen;
- primary endpoint is frozen;
- exclusion rules are frozen;
- sample-size or sequential analysis rule is frozen;
- analysis code is tested on simulated/calibration data;
- reveal/lock behavior is verified.

Exploratory data may guide later versions, but the version change must be documented before confirmatory trials begin.

---

# Statistical planning note

Binary single-bit testing requires substantially more trials than intuition suggests if the true effect is modest.

Illustrative one-sided binomial planning under H0 = 0.5:

- if true match probability were around `0.65`, approximately `100` trials can provide high power under a conventional alpha threshold;
- if true match probability were around `0.60`, approximately `200` trials are more realistic;
- if true match probability were around `0.55`, several hundred trials may be required.

These are planning illustrations, not the frozen MIP sample-size decision.

A formal power plan must be calculated and committed before confirmatory testing.

---

# Safety

The goal is reproducible communication performance, not maximal subjective intensity.

Do not intentionally escalate:

- loss of voluntary control;
- extreme emotion;
- hyperventilation;
- sleep deprivation;
- unsafe audio level.

If a session is stopped, preserve it as a stopped/failed trial according to predefined exclusion rules.

---

# Immediate dependencies

Before first serious REQUEST block:

1. Finish V-04 historical audio source verification.
2. Build MIP Request Test App v0.1.
3. Generate exact deterministic WAVs for enabled conditions.
4. Run RNG calibration.
5. Run audio/state pilot.
6. Freeze `MIP-NUM-REQUEST v0.2` based on pilot findings before confirmatory work.
