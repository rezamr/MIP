# MIP Core Objectives and Protocol Audit

## Purpose

This file defines the primary objective hierarchy of MIP and the mandatory protocol-review responsibilities for every future MIP conversation.

## Primary objective

The primary objective of MIP is **communication and request/response**, not passive information acquisition.

Operationally, MIP seeks to determine whether a reproducible interaction can be established in which the participant can make a specific request and obtain a corresponding externally verifiable response.

The strongest simple target architecture is:

`participant requests outcome X -> independent random system operates at a predefined time -> system output is tested for correspondence with X`

Example:

`Request: output 1 at time T -> isolated random system generates one value at time T -> test whether output = 1`

The term `MATRIX` remains an operational hypothesis for an unknown communication mechanism or substrate. A successful correspondence does not by itself establish what mechanism produced it.

## Secondary objective

Passive information acquisition is a secondary but essential comparison track.

MIP must distinguish two fundamentally different questions:

### Track A — READ / PERCEPTION

`independent system selects hidden value -> participant attempts to perceive/report the value`

Depending on target timing, this can test different architectures:

- target already generated but hidden -> remote-perception / remote-viewing analogue;
- target generated after the participant's response is locked -> precognition-like architecture;
- target generated after state entry but before response -> hidden-target acquisition.

### Track B — REQUEST / INFLUENCE

`participant precommits desired value -> independent random system generates value later -> test whether requested value occurs above chance`

This is not remote viewing. It is closer to historical intention / perturbation / PK / human-machine interaction protocols.

These two tracks must never be merged statistically or conceptually.

## Primary MIP success hierarchy

1. Establish a repeatable communication-state protocol.
2. Demonstrate that requests can be defined before the system outcome.
3. Demonstrate above-chance correspondence between requested outcomes and independently generated outcomes.
4. Demonstrate the effect under blinding, automation, no-contact conditions, and sham/control trials.
5. Demonstrate temporal specificity: a request intended for time T should not merely correlate with arbitrary neighboring times.
6. Demonstrate target specificity: requesting 1 should not merely increase generic anomaly; it should preferentially produce the requested value.
7. Replicate with new random systems, new target mappings, and independent analysis.
8. Only after these stages investigate mechanism and whether the operational `MATRIX` model is useful.

## Mandatory protocol families to audit

Every future research pass must actively search, recover, compare, and improve protocols relevant to both Track A and Track B.

### Historical / archival families

- Gateway / Hemi-Sync communication exercises;
- CENTER LANE / GRILL FLAME / STAR GATE remote-viewing procedures;
- CENTER LANE psychoenergetic communication and perturbation material;
- U.S. Army `Remote Perturbation Techniques: Project Description and Experimental Protocol`;
- SRI remote-perception protocols;
- PEAR REG intention experiments;
- PEAR remote human/machine interaction experiments;
- Schmidt-style RNG/PK protocols;
- precognition / future-target protocols;
- associative remote-viewing protocols;
- sender/receiver telepathy protocols where methodologically useful;
- later high-quality blinded hidden-target studies, including negative/null studies.

### Technical protocol questions

For every relevant protocol recover and document:

- exact random-source type;
- physical vs pseudo-random source;
- entropy source;
- target range and probability distribution;
- target timing;
- participant timing;
- request timing;
- whether the desired outcome is chosen by participant or randomized by the experiment controller;
- whether the desired outcome is precommitted and hashed;
- whether the machine is physically isolated;
- whether the participant/operator can access the machine or network;
- run length;
- number of trials;
- baseline/control trials;
- feedback timing;
- local vs remote operation;
- blinding;
- randomization;
- scoring rule;
- exclusion rule;
- statistical model;
- correction for optional stopping/multiple testing;
- device calibration;
- environmental monitoring;
- replication status;
- known criticisms and failed replications.

## MIP protocol-development authority

Historical protocols are inputs, not immutable rules.

MIP may modify, combine, remove, or add protocol components when:

- a historical component is ambiguous or methodologically weak;
- a modern control can eliminate a confound;
- an objective machine-generated endpoint is superior to subjective judging;
- automation can remove experimenter knowledge;
- cryptographic commitments can prevent post-hoc editing;
- a safer method can preserve the hypothesis while reducing risk;
- session evidence suggests a new variable should be isolated;
- a null result requires a more sensitive but still preregistered design;
- a positive result requires stronger adversarial replication.

Every protocol change must be versioned and must record:

- previous version;
- exact change;
- reason;
- evidence motivating the change;
- predicted consequence;
- whether the change was made before or after outcome inspection.

## Core number-selection tests

### MIP-NUM-READ

Question: Can the participant identify a number independently selected by the system?

Minimal architecture:

1. Define number set, initially small enough for statistical sensitivity, e.g. `{0,1}` or `{1,2,3,4}`.
2. Define target-generation time before the session.
3. System generates target without participant access.
4. Participant response is locked before reveal.
5. Exact-match score is primary.
6. Repeat across enough preregistered trials.

### MIP-NUM-REQUEST

Question: Can a participant's precommitted request correspond to a later independent random output above chance?

Minimal architecture:

1. Experiment controller randomly assigns the requested value for each trial so the participant does not always request the same number.
2. Participant receives the request target, e.g. `REQUEST 1`.
3. Request target and target time are cryptographically committed before generation.
4. Participant performs the communication/request protocol.
5. At predefined time T, an isolated random device generates one value.
6. Exact requested-value match is the primary endpoint.
7. No-intention / sham / mismatched-time control trials are interleaved.
8. Analyze only using the preregistered rule after the trial block is complete.

### Why randomized requested values matter

If the participant always requests `1`, a biased device could mimic success. Randomly alternating the requested value permits testing whether the machine follows the trial-specific request rather than merely drifting toward one output.

## Random-source requirement

MIP must distinguish:

- deterministic PRNG;
- cryptographically secure PRNG seeded from OS entropy;
- hardware RNG;
- quantum RNG;
- physical noise RNG;
- mechanical random system.

For READ tests, an inaccessible CSPRNG may be sufficient for a strong hidden-target design.

For REQUEST / INFLUENCE tests, a well-characterized physical or hardware random source is preferred because historical perturbation claims concern physical random processes and because deterministic algorithms introduce a different causal interpretation.

All devices must be calibrated and baseline-tested independently of communication sessions.

## Temporal-specificity controls

For REQUEST tests, MIP must test whether any effect is specific to the intended time.

Recommended design includes:

- requested target time T;
- pre-window T-1;
- post-window T+1;
- matched sham times;
- randomized time offsets unknown to the participant where feasible.

A genuine time-specific request effect should preferentially appear at the preregistered target time rather than equally across neighboring windows.

## Evidence interpretation

Possible outcomes must remain distinct:

- READ success only -> anomalous acquisition hypothesis strengthened; no evidence of influence.
- REQUEST success only -> intention/perturbation hypothesis strengthened; no evidence of perception.
- both succeed -> bidirectional architecture becomes a serious test target.
- neither succeeds -> current protocol unsupported; revise only according to documented rules, not post-hoc target fitting.
- subjective communication without objective correspondence -> phenomenological result only.

## Mandatory future-conversation responsibilities

Every MIP conversation that touches protocols must:

1. read this file;
2. determine which protocol family is relevant;
3. verify historical protocol claims at source level where possible;
4. compare them against current MIP design;
5. identify weaknesses/confounds;
6. propose justified modifications;
7. update the protocol version and master state;
8. preserve null/failed versions rather than deleting them;
9. keep READ and REQUEST/INFLUENCE results separate;
10. keep safety and termination controls active.

## Current status

- READ architecture: conceptually well defined; detailed historical/source audit still required.
- REQUEST/INFLUENCE architecture: historical analogues exist in remote-perturbation and REG-intention research; exact source-level protocol audit remains required.
- Reliable communication with an unknown external substrate: **NOT YET ESTABLISHED**.
- MIP's task is to test the communication/request hypothesis as strongly as possible without presupposing the mechanism.
