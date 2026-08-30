# MIP Temporal and Entropy Research Priority

## Priority status

`ACTIVE — CORE MIP QUESTION`

## Why this exists

MIP does not know how any hypothesized MATRIX/request-response mechanism would map onto ordinary physical time.

The project must not assume:

- immediate execution;
- delayed execution;
- no temporal dependence;
- persistence;
- decay;
- future-only causality;
- retroactive effects;
- or semantic understanding of the request.

These are empirical questions.

## Mandatory research questions

Every MIP conversation working on REQUEST/INFLUENCE must preserve and investigate:

1. **Susceptibility** — can requested outcomes correspond to later system outcomes above chance at all?
2. **Latency** — what delay between request and machine event is optimal, if any?
3. **Temporal response kernel** — is the effect concentrated at the requested time or spread around it?
4. **Persistence** — does one encoding remain measurable over minutes/hours/days?
5. **Temporal symmetry** — do pre-generated but unobserved targets behave differently from future-generated targets?
6. **Execution semantics** — does `at T`, `during W`, `next event`, or no-time wording matter?
7. **Semantic specificity** — does correspondence follow an arbitrary requested meaning/token rather than only `high/low` or `0/1` direction?
8. **Entropy capacity** — how many bits of exact target specificity can the protocol support, if any?

## Mandatory protocol

Read and follow:

- `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`

## High-entropy strategy

Do not jump directly from binary tests to a one-in-a-billion trial and treat one exact hit as proof.

Use an entropy staircase:

`1 bit -> 2 -> 4 -> 8 -> 16 -> 20 -> 30 bits`

Binary/low-entropy tests maximize sensitivity to weak effects.

High-entropy exact-token tests maximize specificity after timing, encoding, and effect size are better characterized.

For one preregistered exact uniform target among `2^30 = 1,073,741,824` outcomes, the idealized null exact-match probability is approximately one in 1.07 billion. This number is meaningful only if:

- the outcome space is truly uniform;
- there is exactly one predeclared primary target;
- no retries are hidden;
- no post-hoc time bin is substituted;
- logging is immutable;
- the random source is validated;
- the mapping is frozen;
- and the result can later be independently replicated.

## Application requirement

The local JSON/JSONL MIP app must support:

- request-target delays;
- pre/target/post temporal windows;
- delayed reveal;
- pre-generated hidden outcomes;
- virtual outcome spaces up to at least 30 bits;
- exact-token/index targets;
- uniform integer sampling without modulo bias;
- request/target/time commitments and hashes;
- block-level reveal;
- temporal response export;
- no automatic best-lag selection.

Engineering source of truth:

- `engineering/REQUEST_TEST_APP_SPEC_V0.1.md`

## Historical research requirement

Research must specifically audit prior temporally displaced RNG/PK work, including:

- Helmut Schmidt pre-recorded/retroactive RNG experiments;
- PEAR local vs remote vs on-time vs off-time REG experiments;
- Army/SRI recognition of influence-vs-precognition ambiguity;
- null studies, replications, and methodological criticisms.

Historical precedent does not establish the MIP mechanism; it informs test design and prevents rediscovering known confounds.

## Advisor requirement

The research coordinator must actively protect MIP from two opposite errors:

1. assuming ordinary chronological timing rules without testing them;
2. treating any unusual timing pattern as proof that time is absent from MATRIX.

The correct object is empirical mapping between:

`request encoding time -> requested execution time -> physical machine event time -> reveal/observation time -> measured correspondence`.
