# MIP-NUM-REQUEST v0.2

## Status

`ACTIVE EXPLORATORY FIRST-USE REQUEST DESIGN — NOT CONFIRMATORY`

## Supersession

This file supersedes `protocols/MIP_NUM_REQUEST_V0.1.md` for new first-use REQUEST sessions.

Version 0.1 remains preserved as the earlier fixed-future-target integrated design.

The current first operational baseline is now an immediate request embedded in a continuous hidden stream around the request, while fixed-delay and absolute-time modes remain separate later profiles in the same software engine.

---

# 1. Primary question

Can a precommitted requested binary objective state correspond with independently generated machine output in the predeclared immediate/request region more strongly than expected under the null model?

The first operational profile is exploratory and intended to establish implementation quality, estimate effect size if any, and characterize timing.

This does not establish MATRIX, causal influence, or any unique mechanism.

---

# 2. Secondary questions

- Is correspondence specific to the trial-specific requested state rather than device bias?
- Does machine-output deviation begin before, during, or after the request cue?
- What latency/persistence pattern is observed, if any?
- Does audio condition alter subjective state, objective REQUEST performance, both, or neither?
- Does any apparent effect survive sham/no-intention and timing controls?
- Does participant-facing mapping or encoding representation matter?
- Do future-generated and pre-generated hidden conditions differ?

---

# 3. Initial objective alphabet

`{0,1}`

The experiment controller normally assigns the requested objective state using a validated request-assignment policy.

Do not always request the same value.

The first literal display mapping may use `0` and `1`, but machine state and participant-facing representation remain separate configurable objects.

---

# 4. Active request encoding

Use:

`protocols/REQUEST_ENCODING_V0.2.md`

First encoding profile:

`SER-A-V2`

Do not change the encoding profile while comparing audio conditions unless encoding itself is the declared experimental variable.

---

# 5. Active operational playbook

Use:

`protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`

The active first baseline is hands-free after START.

---

# 6. Active timing model

Use:

`protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`

First participant-facing semantics:

`Make/favor the assigned system state now.`

The participant does not track wall-clock time.

Machine timing remains exact and authoritative.

---

# 7. First machine-output architecture

Use a hidden binary stream that begins before the request cue and continues through request encoding, release, and the predeclared post-request period.

The analysis plan must define before outcome inspection:

- pre-request baseline region;
- primary request/immediate region;
- immediate-post region;
- later exploratory post-request regions;
- output/block cadence;
- stream length;
- primary statistic;
- exclusion/deviation rules.

No optional stopping.

No post-hoc replacement of the primary region by the most favorable neighboring window.

---

# 8. Optional single-outcome companion endpoint

A profile may additionally declare one intuitive discrete endpoint such as:

`first eligible machine output after request completion`

This endpoint must be committed before the session/block and must not be introduced after seeing stream results.

If enabled, analyze it separately from the continuous-stream endpoint.

---

# 9. Development sequence

## Stage 0 — Software/RNG/audio validation

Before participant REQUEST use:

- complete automated software tests;
- verify config validation;
- verify session/trial/block IDs;
- verify event hash chain;
- verify raw machine-output persistence and hash linkage;
- verify reveal gate;
- verify raw-report lock;
- verify timing/scheduler logging;
- verify crash/incomplete-session handling;
- run no-participant RNG calibration;
- verify required audio presets and hashes;
- run dry sessions.

Software debugging runs do not contribute to communication evidence.

## Stage 1 — Audio/state pilot

Compare selected audio conditions for:

- tolerability;
- state stability;
- alertness;
- time distortion;
- reproducibility;
- voluntary-control quality;
- interruption/abort rate.

Do not choose an audio condition solely because one session was dramatic.

## Stage 2 — Exploratory immediate REQUEST stream

For each session:

1. profile validated;
2. requested objective state assigned and mapped;
3. target memorized;
4. complete configuration committed;
5. participant presses START once;
6. hidden stream begins/continues according to profile;
7. participant enters hands-free protocol;
8. request cue occurs;
9. participant executes `SER-A-V2` under immediate semantics;
10. release occurs;
11. hidden stream continues through declared windows;
12. return cue occurs;
13. participant returns and completes raw report;
14. raw report locks;
15. reveal occurs only when policy allows;
16. deterministic primary/exploratory analysis is generated;
17. integrity verification runs.

## Stage 3 — Repeated balanced blocks

Use enough repeated sessions to estimate whether correspondence is stable.

Where practical:

- balance requested 0/1;
- balance/randomize audio conditions;
- precommit block schedule;
- preserve aborted/failed sessions;
- optionally use block-level reveal;
- do not adapt the block based on individual revealed outcomes unless the design explicitly allows it.

## Stage 4 — Timing characterization

If a repeatable signal appears, compare separately configured timing profiles:

- immediate;
- next eligible;
- short relative delays;
- longer delays;
- absolute time;
- pre-generated hidden.

Use `MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`.

## Stage 5 — Entropy scaling

Only after timing/encoding is sufficiently characterized, progress through the declared entropy staircase rather than jumping directly to a one-in-a-billion exact-token target.

---

# 10. Control families

Controls may be implemented as separate profiles/block conditions and must never be retrospectively invented.

## C0 — RNG calibration

No participant request/intention session.

## C1 — Audio sham

Use matched no-beat control where appropriate.

## C2 — No-intention

Comparable state/session without an active requested outcome.

## C3 — Timing controls

Predeclared neighboring/mismatched windows.

## C4 — Mapping controls

Arbitrary or reversed participant-facing mapping while objective machine states remain unchanged.

## C5 — Pre-generated hidden

Separate time-displaced family, never pooled silently with future-generated request trials.

## C6 — Future physical RNG replication

Repeat strongest protocol with a characterized physical/hardware source once the provider interface is stable.

---

# 11. Audio comparison

Initial easy first-use audio set:

- `A-U396-4`;
- `A-P100-104`;
- `A-SHAM-0`.

Other research-defined candidates may be added later as versioned recipes while preserving provenance.

Track subjective state and objective REQUEST performance separately.

Possible descriptive classifications include:

- `STATE-STRONG / REQUEST-NULL`
- `STATE-WEAK / REQUEST-POSITIVE`
- `STATE-STRONG / REQUEST-POSITIVE`
- `NULL`
- `UNRESOLVED`

Do not assign these from one session alone.

---

# 12. Primary first-build binary stream measures

For a declared window with `n` binary outcomes and requested state `r`:

- count outcomes equal to `r`;
- proportion toward request = `k/n`;
- signed deviation from null = `k/n - 0.5`;
- use the versioned analysis-plan statistic/test;
- preserve all raw ordered outputs.

Cross-session/block statistics must state eligible-session count and all exclusion/deviation treatment.

---

# 13. Random-source posture

Initial software implementation:

- `OS_CSPRNG` for software baseline/testing;
- deterministic seeded provider for reproducible software tests only.

For stronger REQUEST/INFLUENCE claims, later replicate with a characterized physical/hardware random source.

Do not describe software CSPRNG as physically equivalent to Army electronic-noise or radioactive sources.

---

# 14. Timing validity

For every machine output/window record exact scheduled/actual timing according to the engineering logging requirements.

If target timing is late because of process interruption, OS sleep, clock discontinuity, or scheduler error beyond configured tolerance:

- preserve the output/session;
- mark the timing deviation;
- never silently shift the target region;
- never regenerate a replacement outcome for the intended time.

---

# 15. Reveal and raw-report rule

Hidden output must remain unavailable to the participant-facing UI until reveal policy permits it.

For the first profile:

`raw report lock -> reveal`

For stronger later blocks:

`all member raw reports/block lock -> block reveal`

The reveal gate must be enforced server-side.

---

# 16. Confirmatory gate

Do not declare a confirmatory MIP-NUM-REQUEST protocol until at minimum these are frozen and tested:

- application/engine version;
- active experiment profile;
- objective outcome space;
- request assignment;
- participant mapping;
- encoding profile;
- audio condition/pool;
- RNG provider;
- session protocol;
- machine-output policy;
- timing policy;
- primary region/endpoint;
- statistical analysis plan;
- exclusion/protocol-deviation rules;
- reveal policy;
- sample size/block plan;
- integrity/logging implementation.

Exploratory findings may motivate a new version, but the new version must be committed before confirmatory outcomes are inspected.

---

# 17. Safety

The goal is reproducible performance, not maximal subjective intensity.

Do not deliberately escalate:

- loss of voluntary control;
- extreme emotion;
- unsafe audio level;
- hyperventilation;
- sleep deprivation;
- other avoidable hazards.

Terminated sessions remain recorded.

---

# 18. Current implementation dependencies

Before first real participant REQUEST session:

1. build the active local MIP research engine;
2. pass all mandatory tests;
3. generate/verify dry-run artifacts;
4. verify session logging/integrity/review workflow;
5. run RNG calibration;
6. verify first audio presets;
7. manually review one full dry session bundle from commitment through report/reveal/integrity;
8. document every known limitation.

Historical CENTER LANE source verification remains important for historical reconstruction but does not block use of clearly labeled MIP experimental/patent comparator audio conditions.
