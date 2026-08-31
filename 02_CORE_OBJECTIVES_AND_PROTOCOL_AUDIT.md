# MIP Core Objectives and Protocol Audit

## Purpose

This file defines the primary objective hierarchy of MIP and the mandatory protocol-review responsibilities for every future MIP conversation.

## Primary objective

The primary objective of MIP is **communication and request/response**, not passive information acquisition.

Operationally, MIP seeks to determine whether a reproducible interaction can be established in which the participant can make a specific request and obtain a corresponding externally verifiable response.

The strongest general target architecture is:

`participant requests objective outcome X -> independent random system operates under a predefined timing/output policy -> system output is tested for correspondence with X`

One discrete example is:

`Request: output 1 at time T -> isolated random system generates one value at time T -> test whether output = 1`

That example is a protocol family, not the mandatory first-use timing profile.

The term `MATRIX` remains an operational hypothesis for an unknown communication mechanism or substrate. A successful correspondence does not by itself establish what mechanism produced it.

## Current first operational REQUEST profile

The current first participant baseline uses:

- randomized objective request `{0,1}`;
- target memorized before induction;
- hands-free operation after START;
- participant-facing `IMMEDIATE_REQUEST` / now semantics;
- a continuous hidden binary machine stream before, during, and after request encoding;
- a predeclared request/immediate primary region;
- exploratory neighboring windows for onset/latency/persistence;
- raw-report lock before reveal.

Active files:

- `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
- `protocols/REQUEST_ENCODING_V0.2.md`
- `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
- `protocols/MIP_NUM_REQUEST_V0.2.md`

Fixed relative-delay, absolute-date-time, next-eligible-output, and pre-generated-hidden REQUEST families remain mandatory software capabilities and later experimental comparisons. They are not the participant-facing timing semantics of the first immediate baseline.

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

`participant precommits desired objective state -> independent random system generates/logs output -> test whether requested state corresponds above chance under the declared endpoint`

This is not remote viewing. It is closer to historical intention / perturbation / PK / human-machine interaction protocols.

These two tracks must never be merged statistically or conceptually.

## Primary MIP success hierarchy

1. Establish a repeatable communication-state protocol.
2. Demonstrate that requests can be defined and committed before the scored machine output/region.
3. Demonstrate above-chance correspondence between requested outcomes and independently generated outcomes.
4. Demonstrate the effect under blinding, automation, no-contact conditions, and sham/control trials.
5. Demonstrate temporal specificity under separately frozen timing profiles and windows.
6. Demonstrate target specificity: requesting 1 should not merely increase generic anomaly; it should preferentially favor the trial-specific requested objective state.
7. Demonstrate representation specificity/independence using arbitrary/reversed mappings and controlled encoding variants.
8. Replicate with new random systems, new target mappings, and independent analysis.
9. Only after these stages investigate mechanism and whether the operational `MATRIX` model is useful.

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

For software implementation, conflict resolution additionally follows:

- `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`

Do not silently merge superseded protocol generations.

## Core number-selection tests

### MIP-NUM-READ

Question: Can the participant identify a number independently selected by the system?

Minimal architecture:

1. Define a finite outcome space.
2. Define target-generation timing before the session/trial.
3. System generates target without participant access.
4. Participant response is locked before reveal.
5. Exact-match score is primary where appropriate.
6. Repeat across enough preregistered trials.

### MIP-NUM-REQUEST

Question: Can a participant's precommitted request correspond to independent random machine output above chance?

General architecture:

1. Experiment controller assigns or otherwise freezes the requested objective state according to a declared assignment policy.
2. Participant receives the participant-facing mapped target before active induction when required.
3. Request/mapping/timing/output/analysis configuration is cryptographically committed before scored output generation.
4. Participant performs the fixed communication/request protocol.
5. Machine produces output according to the frozen timing/output policy.
6. A predeclared objective scoring rule tests correspondence.
7. No-intention/sham/timing/mapping controls are introduced only through predeclared profiles/blocks.
8. Analyze only with the frozen primary rule; exploratory windows remain labeled exploratory.

The current first-use implementation of this family is `MIP_NUM_REQUEST_V0.2`, using an immediate hidden continuous stream rather than requiring a participant-facing absolute target time.

### Why randomized requested values matter

If the participant always requests `1`, a biased device could mimic success. Randomizing/balancing the requested objective state permits testing whether the machine follows the trial-specific request rather than merely drifting toward one output.

## Random-source requirement

MIP must distinguish:

- deterministic PRNG;
- cryptographically secure PRNG seeded from OS entropy;
- hardware RNG;
- quantum RNG;
- physical noise RNG;
- mechanical random system.

For READ tests, an inaccessible CSPRNG may be sufficient for a strong hidden-target design.

For REQUEST / INFLUENCE tests, a well-characterized physical or hardware random source is preferred for stronger later replication because historical perturbation claims concern physical random processes and deterministic/software sources have different causal interpretations.

The first software implementation uses OS cryptographic randomness for tooling/baseline and a separately labeled deterministic provider for tests. All devices/providers must be calibrated and baseline-tested independently of Communication Sessions.

## Temporal-specificity controls

REQUEST timing is itself an empirical question.

Current first-use design preserves:

- pre-request baseline;
- predeclared request/immediate primary region;
- immediate-post region;
- later exploratory post regions.

Later separately frozen designs should compare:

- immediate;
- next eligible;
- relative delays;
- absolute target time;
- windows;
- pre-generated hidden targets;
- matched sham/mismatched times.

A later favorable region may not be substituted post hoc for a failed preregistered primary region.

## Representation / mapping controls

The application and protocol must keep separate:

- objective machine state;
- participant-facing label;
- internal request encoding;
- scoring endpoint.

Later tests should compare literal digits, arbitrary labels, reversed mappings, semantic-only, visual/kinesthetic/goal variants, and physical state labels without hardcoding an assumption about what a hypothesized mechanism understands.

## Evidence interpretation

Possible outcomes must remain distinct:

- READ success only -> anomalous acquisition hypothesis strengthened; no evidence of influence.
- REQUEST success only -> request/output correspondence or intention/perturbation hypothesis strengthened; no evidence of perception.
- both succeed -> bidirectional architecture becomes a serious test target.
- neither succeeds -> current protocol unsupported; revise only according to documented rules, not post-hoc target fitting.
- subjective communication without objective correspondence -> phenomenological result only.

No single outcome establishes MATRIX or a unique causal mechanism.

## Mandatory future-conversation responsibilities

Every MIP conversation that touches protocols must:

1. read this file;
2. determine which protocol family is relevant;
3. verify historical protocol claims at source level where possible;
4. compare them against current MIP design;
5. identify weaknesses/confounds;
6. propose justified modifications;
7. update the protocol version and master state;
8. preserve null/failed/superseded versions rather than deleting them;
9. keep READ and REQUEST/INFLUENCE results separate;
10. keep safety and termination controls active;
11. preserve timing/entropy/mapping questions as empirical rather than assumed;
12. for software-recorded sessions, preserve the complete auditable evidence bundle and integrity status.

## Current status

- READ architecture: conceptually well defined; detailed historical/source audit remains ongoing.
- REQUEST/INFLUENCE historical precedent: source-audited Army remote-perturbation anchor exists; PEAR/Schmidt/replication audit remains ongoing.
- First operational MIP REQUEST design: `ACTIVE EXPLORATORY` under v0.2/v0.3 protocol generation.
- Local research application specification: frozen for Codex implementation under `engineering/CODEX_PROMPT_REQUEST_APP_V0.8.md`.
- Reliable communication with an unknown external substrate: **NOT YET ESTABLISHED**.
- MIP's task is to test the communication/request hypothesis as strongly as possible without presupposing the mechanism.
