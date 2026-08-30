# MIP Temporal Response, Latency, Persistence, and Execution Semantics v0.1

## Status

`EXPERIMENTAL FRAMEWORK — MECHANISM UNKNOWN`

## Purpose

MIP currently uses `MATRIX` as an operational name for an unknown/hypothesized interaction mechanism. We do not know whether such a mechanism exists, whether it can interpret requests, whether it acts immediately or after a delay, whether an effect persists, whether target time matters, or whether ordinary chronological order is relevant.

This protocol treats those questions as independently measurable properties rather than assumptions.

---

## Core unknowns

### T-01 — Susceptibility

Can a precommitted request correspond to a later independently generated outcome above chance at all?

### T-02 — Latency

If correspondence exists, what delay between request encoding and target-system operation maximizes it?

Define:

`Δ = target_event_time - request_encoding_time`

Candidate delays must be tested systematically.

### T-03 — Temporal response kernel

Is any effect narrowly concentrated around one requested time or spread across a wider temporal window?

Operational object:

`K(Δ) = effect size as a function of temporal displacement Δ`

MIP should estimate this empirically rather than assume an instantaneous effect.

### T-04 — Persistence / decay

After one encoding event, does measurable correspondence decay, remain approximately stable, reappear, or oscillate over time?

### T-05 — Temporal symmetry

Does the data differ when the target event occurs:

- after the request;
- approximately during the request;
- before the request but remains unobserved/unrevealed until afterward?

This last condition is a retroactive/time-displaced test. A result would not by itself establish backward causation; it would identify a timing anomaly requiring stronger controls.

### T-06 — Execution-time semantics

Does the request need to specify an exact execution time, a time window, or no explicit time at all?

Compare:

- `execute at T`;
- `execute during window W`;
- `execute at the next system event`;
- no explicit execution-time instruction.

### T-07 — Semantic comprehension / goal specificity

If correspondence exists, does it track the requested *meaning* or only a simple physical direction?

Examples:

- request physical bit `1`;
- request label `BLUE` where mapping BLUE -> 1 is fixed before session;
- request arbitrary symbol where symbol -> output mapping is precommitted;
- request exact token/index from a large uniformly sampled outcome space.

Any semantic interpretation must be tested through preregistered mappings, not subjective post-hoc matching.

---

# Temporal Mapping Program

## TM-01 — Fixed-time request

`request at t0 -> target at fixed t0 + Δ`

Start with a small delay set, e.g.:

- 0 min;
- 1 min;
- 10 min;
- 60 min;
- 24 h.

Do not test all delays as flexible endpoints in one confirmatory analysis. Predeclare the primary delay or use balanced randomized blocks.

## TM-02 — Surrounding-window capture

The system continuously or periodically records hidden outcomes around the requested target time:

- pre-window;
- target window;
- post-window.

The primary endpoint remains the preregistered target time/window. Neighboring windows are used to estimate temporal spread and must not be substituted post-hoc for a failed primary target.

## TM-03 — Persistence series

One request encoding is performed, followed by multiple independently defined target opportunities at fixed delays.

Example exploratory schedule:

- +1 min;
- +10 min;
- +1 h;
- +6 h;
- +24 h;
- +72 h.

Analyze with a prespecified repeated-measures/multiple-testing model.

## TM-04 — Unobserved pre-generated target

The system generates and cryptographically commits an outcome before the participant performs the request. No human sees the outcome. The participant later performs the request; reveal occurs only after the response/session is locked.

This is a deliberately separate time-displaced/retroactive arm and must never be mixed with ordinary future-generation REQUEST trials.

## TM-05 — Execution semantics comparison

Compare fixed scripts while keeping audio and all other procedures constant:

A. `At exact time T, output X.`
B. `During window W, favor X.`
C. `At the next eligible event, output X.`
D. `Favor X.` without explicit time.

This tests whether temporal language itself is part of the effective request representation.

---

# High-Entropy Target Program

## Rationale

Binary outcomes are statistically sensitive for detecting very small effects, but any individual exact match has probability 1/2. MIP therefore needs a staged transition from high-sensitivity binary tests to high-specificity exact-target tests.

High entropy must not replace replication. A single spectacular exact match can still be produced by software defects, logging errors, leakage, biased sampling, hidden retries, or unrecognized multiple testing.

## Entropy staircase

Advance only after lower-complexity protocols are stable:

| Stage | Outcome space | Information | Exact-match null probability |
|---|---:|---:|---:|
| E1 | 2 | 1 bit | 1/2 |
| E2 | 4 | 2 bits | 1/4 |
| E3 | 16 | 4 bits | 1/16 |
| E4 | 256 | 8 bits | 1/256 |
| E5 | 65,536 | 16 bits | 1/65,536 |
| E6 | 1,048,576 | 20 bits | 1/1,048,576 |
| E7 | 1,073,741,824 | 30 bits | 1/1,073,741,824 |

For a uniform N-outcome generator and one preregistered attempt, exact-match chance is `1/N`.

## Virtual outcome spaces

The application does **not** need to store one billion records.

A uniformly sampled integer in `[0, N-1]` is mathematically sufficient to represent N equiprobable outcomes.

A human-friendly exact token can be deterministically derived from the index, e.g. Base32/Base36 text, while retaining a one-to-one mapping.

## Exact-token mode

Example:

`REQUEST TOKEN = K7M3Q9`

The target token, target time, pool size, mapping version, and protocol version are committed before the target system operates.

The output is one exact token selected uniformly from the declared space.

Primary endpoint: exact equality only.

No partial/fuzzy scoring in the primary endpoint.

---

# Interpretation rules

Possible timing patterns must remain separate:

- future-only peak -> ordinary REQUEST timing hypothesis strengthened relative to retroactive models;
- broad post-request decay -> persistence hypothesis becomes testable;
- narrow target-time peak -> temporal-specificity hypothesis strengthened;
- comparable pre- and post-request effects -> time-symmetric/time-displaced model becomes a higher-priority hypothesis, but causal direction remains unresolved;
- no temporal structure -> current request-timing model unsupported;
- subjective communication without objective timing correspondence -> phenomenological result only.

Do not infer that time is absent from a hypothesized MATRIX. The question is empirical: how does any observed correspondence map from participant/session time to physical machine time?

---

# Historical precedent note

Prior RNG/PK research did examine temporally displaced conditions. Helmut Schmidt reported experiments using pre-recorded random events, and PEAR publications describe remote operator intentions occurring hours or days before or after target-machine operation. These are historical precedents for studying temporal displacement, not proof that such effects are real or that MIP's MATRIX model is correct.

MIP's contribution should be to explicitly decompose the problem into latency, temporal kernel, persistence, execution semantics, target entropy, and causal-direction controls.

---

# Required application support

The MIP app must eventually support:

- arbitrary target delay `Δ`;
- pre/target/post temporal windows;
- delayed reveal;
- pre-generated hidden target mode;
- exact-token/index outcome spaces up to at least 30 bits;
- uniformity checks for every configured outcome space;
- JSON/JSONL logging of all times and hashes;
- UTC and monotonic clocks;
- target/request commitments;
- block-level reveal to reduce adaptive behavior;
- no automatic post-hoc selection of the best time bin;
- export of a temporal response table for later analysis.

---

## Current priority

Before escalating to billion-to-one exact-target tests, MIP should first estimate whether any REQUEST effect exists and characterize its approximate effect size and temporal response using binary/low-entropy trials. Once a stable timing window and request encoding are identified, high-entropy exact-token trials become a powerful falsification/verification layer.