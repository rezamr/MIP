# MIP Audio Frequency Test Matrix v0.1

## Purpose

This document defines the initial audio-frequency candidates for MIP Communication Sessions and separates:

- user-established experimental settings;
- historically documented Monroe/Hemi-Sync engineering examples;
- reported CENTER LANE operational anchors still requiring source-level waveform clarification;
- modern psychoacoustic/scientific control conditions;
- sham/control conditions.

The purpose is not to assume that any frequency causes anomalous communication. The purpose is to test whether audio configuration changes the probability, quality, stability, or reproducibility of the communication/request state.

---

## Critical distinction

MIP must separately test:

1. **State induction** — does an audio condition reliably produce a stable altered/communication state?
2. **REQUEST performance** — does that condition improve objective request/output correspondence?
3. **READ performance** — does that condition improve hidden-target identification?

A frequency may produce strong subjective phenomena and still have no effect on objective REQUEST or READ performance.

---

# Candidate registry

## A-U396-4 — User baseline

### Status

`USER EXPERIMENTAL / PERSONAL PRIOR`

### Known settings

- App: TMSOFT Binaural Beats Generator, based on screenshot identification.
- UI base frequency: `396 Hz`
- UI binaural beat: `4 Hz`
- UI volume shown in screenshot: `47%`

### Developer-documented current synthesis rule

TMSOFT documents the base frequency as the center frequency:

- left = base - beat/2
- right = base + beat/2

Therefore the current documented implementation for 396 Hz / 4 Hz is:

- Left: `394 Hz`
- Right: `398 Hz`
- Difference: `4 Hz`
- Center: `396 Hz`

### Historical-session caution

The exact left/right output used in S0001/S0002 is **not considered instrumentally verified** because:

- no audio capture/hash from the actual historical session exists;
- the exact app version used in those sessions is not yet recorded;
- the app's 2026 release notes mention a later frequency-calculation bug fix.

Thus `394/398` is a strong reconstruction from current developer documentation, not a forensic measurement of the past session.

### Why it remains a high-priority MIP condition

- It produced the strongest existing personal prior in S0001/S0002.
- Its center frequency is close to the ~400 Hz carrier region frequently used in modern binaural-beat research and often described as favorable for binaural-beat perception.
- This gives 396 Hz an acoustically plausible reason to remain in the test matrix **independent of Solfeggio claims**.

### What is NOT established

- 396 Hz is not currently established as an original Gateway/CENTER LANE carrier.
- No MIP claim should rely on a Solfeggio mechanism unless new evidence independently supports it.

---

## A-P100-104 — Exact Monroe patent simple 4-Hz example

### Status

`DOCUMENTED PATENT EXAMPLE / POST-GATEWAY-ERA`

### Source

Robert A. Monroe, US Patent 5,213,562, issued 1993.

The patent explicitly gives:

- one channel: `100 Hz`
- other channel: `104 Hz`
- binaural difference: `4 Hz`

### MIP use

This is a technically exact Monroe engineering condition and therefore a useful comparator.

### Limitation

It must not be back-projected as an exact 1983 Gateway or CENTER LANE setting without contemporaneous evidence.

---

## A-PSEPTON-4 — Exact Monroe patent seven-beat / Septon example

### Status

`DOCUMENTED PATENT EXAMPLE / LATER SUCCESSOR ENGINEERING`

### Source

Robert A. Monroe, US Patent 5,356,368, issued 1994.

Example carrier stack:

Left channel:

- `200 Hz`
- `204 Hz`
- `208 Hz`

Right channel:

- `204 Hz`
- `208 Hz`
- `212 Hz`

The patent describes three interaural 4-Hz binaural relationships plus monaural beat relationships within the channels, producing what Monroe called a `Septon`.

### MIP use

This is a high-value engineering comparator because it tests whether a multiplexed 4-Hz architecture differs from a single carrier pair.

### Limitation

Later patent; not proof of use in 1983 CENTER LANE.

---

## A-S400-4 — Modern psychoacoustic carrier control

### Status

`SCIENTIFIC / EXPERIMENTAL CONTROL`

### Proposed synthesis

- Left: `398 Hz`
- Right: `402 Hz`
- Difference: `4 Hz`
- Center: `400 Hz`

### Reason

Modern binaural-beat literature frequently uses carrier frequencies near 400 Hz, and reviews note earlier evidence that binaural beats are often well perceived in the ~400 Hz carrier region.

### Purpose

This condition helps answer whether the user's 396-Hz result is related to the broad ~400-Hz psychoacoustic carrier region rather than to 396 as a numerologically specific value.

---

## A-C200-4 — Reported CENTER LANE operational anchor

### Status

`REPORTED HISTORICAL OPERATIONAL ANCHOR — EXACT CHANNEL IMPLEMENTATION PENDING PRIMARY-SOURCE VERIFICATION`

Priority-0 research reported a March 1984 operational Hemi-Sync environment containing a `200-Hz base` with a `4-Hz binaural beat`.

### Critical restriction

Do not yet assign exact left/right frequencies from this phrase alone.

Possible implementations include asymmetric or centered carrier arrangements, but MIP will not invent the historical implementation.

### Test status

Hold as a **high-priority candidate** until V-04 source-level extraction determines what the original document means by `base`.

---

## A-C100-1.5 — Reported CENTER LANE operational anchor

### Status

`REPORTED HISTORICAL OPERATIONAL ANCHOR — EXACT CHANNEL IMPLEMENTATION PENDING PRIMARY-SOURCE VERIFICATION`

Priority-0 research reported a March 1984 operational Hemi-Sync environment containing a `100-Hz base` with a `1.5-Hz binaural beat`.

### Purpose

Potential lower-frequency state comparator.

### Concern

A 1.5-Hz difference may be more sleep-promoting / low-arousal than the desired communication state. It should therefore not replace 4 Hz without state and performance data.

### Test status

Phase-2 candidate after source verification.

---

## A-P275-4 — Patent-derived carrier candidate

### Status

`DOCUMENTED PATENT ENGINEERING CLUE / EXPERIMENTAL RECONSTRUCTION`

US 5,213,562 discusses an effective harmonic carrier around `275 Hz` in its broader EEG-waveform synthesis architecture.

### Proposed MIP reconstruction

If tested as a simple centered 4-Hz pair:

- Left: `273 Hz`
- Right: `277 Hz`

This exact simple pair is an MIP reconstruction, not a quoted historical configuration.

### Test status

Later phase only.

---

## A-SHAM-0 — Carrier-only sham

### Status

`CONTROL`

Recommended matched sham examples:

- `396 / 396 Hz`, or
- `400 / 400 Hz`

The sham must be loudness-matched and session instructions otherwise identical.

---

# Initial test strategy

## Phase A — Hold beat constant at 4 Hz; compare carrier/architecture

Do **not** change both carrier and beat at the same time if the goal is to identify which component matters.

Recommended first comparison set:

1. `A-U396-4` — user baseline (`394/398` reconstruction)
2. `A-P100-104` — exact Monroe patent simple 4-Hz pair
3. `A-PSEPTON-4` — exact Monroe patent multiplexed 4-Hz Septon
4. `A-S400-4` — modern psychoacoustic ~400-Hz control
5. `A-SHAM-0` — matched no-beat sham

### Why not immediately include every historical candidate?

The reported CENTER LANE `200/4` and `100/1.5` anchors remain important, but exact channel semantics must be source-verified before MIP labels a synthesized file as a historical reconstruction.

---

## Phase B — Hold the best-performing carrier architecture constant; compare beat frequency

After Phase A identifies a stable carrier/architecture candidate, compare at minimum:

- `0 Hz` sham
- `1.5 Hz` historical-operational candidate after source verification
- `4 Hz` primary current candidate
- `6 Hz` experimental mid-theta comparator

Do not describe `6 Hz` as recovered Gateway engineering; it is a modern experimental comparator.

---

## Phase C — Dynamic / multiplexed reconstruction

Only after simple conditions are characterized:

- multiple simultaneous binaural pairs;
- Septon variants;
- pink/phased-pink masking;
- amplitude/frequency modulation;
- time-varying beat sequences;
- individualized tuning;
- biomonitor-driven adaptation.

---

# Outcome metrics

For every audio condition track separately:

## State metrics

- time to first clear state change;
- state stability;
- alertness;
- drowsiness;
- time distortion;
- vibration/pulse;
- rotation/vestibular effects;
- spontaneous imagery;
- sensed presence;
- perceived agency;
- emotional intensity;
- voluntary-control stability;
- termination responsiveness.

## REQUEST metrics

- exact requested-bit match rate;
- stream directional shift;
- target-time specificity;
- effect relative to sham/no-intention;
- effect relative to nearby non-target windows.

## READ metrics

- exact hidden-bit match rate;
- confidence calibration;
- response time;
- performance relative to sham and chance.

---

# Scientific caution

The modern EEG literature does not establish a deterministic rule that a 4-Hz binaural stimulus forces the brain into a 4-Hz theta state. A 2023 systematic review found highly inconsistent EEG entrainment results across 14 qualifying studies.

MIP therefore treats frequency as an experimental variable, not as a guaranteed state command.

---

# Current priority ranking

1. `A-U396-4` — preserve and replicate the user's personally effective baseline.
2. `A-P100-104` — exact Monroe 4-Hz patent comparator.
3. `A-PSEPTON-4` — exact later Monroe multiplexed 4-Hz engineering comparator.
4. `A-S400-4` — scientific carrier-region control.
5. `A-SHAM-0` — mandatory sham.
6. `A-C200-4` — promote after V-04 exact source semantics are recovered.
7. `A-C100-1.5` — promote after V-04 verification and after 4-Hz carrier testing.
8. `A-P275-4` — later engineering exploration.

No condition may be called `better` until repeated MIP data support that conclusion on predefined state and/or objective communication endpoints.
