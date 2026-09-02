# MIP v1.2 Research Model and Temporal Workflow

This document describes the generic research contracts used by the Electron
runtime. It is an engineering/data-integrity contract, not a claim that any
anomalous mechanism exists.

## Generic finite outcome spaces

Every experiment commits one `OutcomeSpace` before participation. The shared
normalizer supports:

- `BINARY`, retained for historical compatibility;
- `ENUMERATED_VALUES`, for small categorical spaces; and
- `INTEGER_RANGE`, represented only by inclusive numeric bounds.

An integer range is never expanded to an array. The built-in
`TEMPORAL_INTEGER_RANGE_V1` profile uses `0..999,999,999`, which has
`K = 1,000,000,000` outcomes while consuming constant memory with respect to
the outcome cardinality. Only generated observations are stored. Range bounds,
cardinality, sampling provider, and formatter are part of the committed
definition. Canonical values are kept separate from participant display text.

Formal sampling uses rejection sampling over OS CSPRNG bytes (or the explicit
deterministic fixture provider in tests). No floating-point scaling, modulo
bias, `Math.random()`, or one-billion-entry enumeration is used. Configurable
output counts, interval/window durations, sequence windows, and probability
trials are bounded before commitment to avoid denial-of-service configurations.

## Modes and target semantics

The same infrastructure supports `INFLUENCE`, `FUTURE_TARGET`, `CONTROL`, and
`SHAM`; participant wording remains profile-specific. `INFLUENCE` commits the
target before participation. `FUTURE_TARGET` commits the prediction, outcome
space, RNG provider, and UTC/monotonic generation anchor before the future
target exists. The Main Process generates that target only at the anchor and
persists scheduled time, actual time, RNG metadata, and an evidence event.

`FUTURE_TARGET` is an experimental future-target/precognition protocol. It is
not historical proof of precognition, remote influence, or any causal
mechanism. If the application is unavailable at the anchor, the event is
recorded as missed; the target is never generated later and backdated.

## Orthogonal lifecycle projections

`ParticipantPhase` and `EvidencePhase` are independent projections:

- ending/returning the participant phase may finalize audio and the subjective
  report while evidence monitoring continues;
- explicit **Abort Evidence Collection** is a confirmed owner action that stops
  scheduled outputs and records `ABORTED_BEFORE_TARGET` or
  `ABORTED_AFTER_TARGET`; and
- normal evidence completion occurs automatically after every required
  opportunity is generated or explicitly recorded as `MISSED`.

Audio STOP therefore does not implicitly stop temporal evidence. Missed slots
are retained as null-valued `MISSED` records and are never silently backfilled.

## Target-anchored analysis

The committed target anchor `T` is persisted as UTC and, where available,
monotonic nanoseconds. Every occurrence keeps its sequence, value, region,
scheduled/actual timestamps, signed scheduled and actual latency from `T`, and
timing status. A late or early occurrence remains an occurrence, but it is not
promoted to the confirmatory primary endpoint.

Supported primary endpoints are:

- `EXACT_SLOT`: the explicitly anchored `targetSequence` at `T`;
- `FIXED_TIME_WINDOW`: a precommitted asymmetric time window around `T`;
- `FIXED_SEQUENCE_WINDOW`: inclusive precommitted opportunity bounds; and
- `TARGET_FREQUENCY`: target count over a fixed eligible opportunity set.

An exact slot that is not captured is `MISSED_OR_UNAVAILABLE`, not `NO MATCH`.
Exploratory/post-hoc windows are labeled exploratory and cannot rewrite a
precommitted primary result.

## Probability and opportunity accounting

For a uniform finite space of size `K`, the null values are:

```text
p0 = 1 / K
P(any hit in N) = 1 - (1 - 1/K)^N
E[hits] = N / K
```

The implementation uses `log1p`/`expm1` for the any-hit calculation and stores
the exact/binomial method and version (`probability-v1`). Reports persist `K`,
planned opportunities, eligible opportunities, missed opportunities, observed
hits, expected hits, exact-slot probability, and any-hit probability. Wall-clock
duration is never used as a substitute for eligible opportunity count.

## Reveal and security boundary

Raw-report lock is necessary but not sufficient. Reveal requires raw lock,
complete evidence, all required primary opportunities resolved, a complete
post-target window, acceptable integrity, and (for `FUTURE_TARGET`) both a
committed prediction and a generated target. Before reveal, preload and
renderer DTOs exclude target values, machine values, matches, occurrence times,
derived analysis, hidden RNG material, and output/final hashes. Aggregate
queries accept only explicitly revealed sessions.

## Cross-session workflow

MIP follows:

```text
DISCOVER → PRECOMMIT → REPLICATE → AGGREGATE
```

Sessions are aligned by their committed anchor `T`, regardless of calendar
date. A compatibility fingerprint covers mode, outcome-space definition and
cardinality, RNG semantics, cadence, endpoint/windows, profile/version, target
semantics, and analysis version. Incompatible cohorts are rejected by default.
Aggregates expose completed/incomplete/deviated counts, primary hits/rate,
expected hits, no-hit sessions, pre/post counts, signed first-hit latency,
latency histogram, target-aligned raster data, opportunity density, and
per-window observed/expected values. A broad scan may be shown descriptively,
but is labeled exploratory and is not assigned a naïve confirmatory p-value.

## Persistence and migration

SQLite is authoritative for new Electron sessions. Schema 14 adds immutable
research definitions, phase projections, target occurrences, future-target
events (including RNG metadata), cross-session analyses, and research defaults.
Migration 14 is additive; migrations 1–13 are not edited. Historical binary
sessions remain readable from their immutable snapshots and are not
reinterpreted using large-range semantics. Raw machine evidence remains the
source of truth; derived occurrences and analyses are separately hashed and
rebuildable/versioned.

## Verification scope

The non-timed verification suite covers symbolic billion-cardinality ranges,
unbiased deterministic/OS sampling paths, probability stability, lifecycle and
abort semantics, target-relative latency, future-target ordering/missed-anchor
behavior, reveal leakage, compatibility aggregation, SQLite migration and
integrity, Electron E2E, and the accelerated SQLite/Electron dry-run. Real
participant sessions, timed physical audio soaks, hardware checks, destructive
installer lifecycle tests, genuine old-version upgrades, and independent
crash-kill tests remain separate authorization gates.
