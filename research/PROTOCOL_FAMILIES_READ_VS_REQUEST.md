# Protocol Families Audit — READ vs REQUEST / INFLUENCE

Last updated: 2026-08-29

## Purpose

MIP must distinguish two different experimental questions that are often incorrectly merged:

1. `READ`: can the participant identify a hidden independently generated target?
2. `REQUEST / INFLUENCE`: can a participant precommit a desired outcome and obtain above-chance correspondence with a later independently generated random outcome?

The second question is the primary practical communication/request objective of MIP. The first is a secondary comparison and calibration objective.

## Historical protocol family: READ

Relevant families include:

- SRI / government remote-viewing hidden-target procedures;
- later remote-perception and precognition designs;
- concealed-target OBE/remote-perception studies.

A READ protocol can be either:

- target first, hidden from participant -> remote-perception analogue;
- participant response first, target generated later -> precognition-like architecture.

These are not equivalent and must be labeled separately.

## Historical protocol family: REQUEST / INFLUENCE

### U.S. Army Remote Perturbation Techniques

A declassified U.S. Army Missile Command document exists titled:

`REMOTE PERTURBATION TECHNIQUES — PROJECT DESCRIPTION AND EXPERIMENTAL PROTOCOL`

Date shown on the released cover: 7 November 1979.

Archive source:
https://www.cia.gov/readingroom/docs/CIA-RDP96-00788R002000230004-2.pdf

Status: `PRIMARY DOCUMENT LOCATED — FULL PROTOCOL EXTRACTION REQUIRED`.

MIP must extract the exact apparatus, random process, intention instructions, trial schedule, controls, confounds, and statistics from this source before adapting it.

### Princeton Engineering Anomalies Research (PEAR) REG intention family

PEAR conducted large databases of random-event-generator experiments in which operators attempted to shift random-device output according to pre-stated intentions.

A PEAR technical analysis reports more than 5.6 million trials across 1262 experimental series and 108 operators, with operator intention treated as the primary experimental factor.

Relevant source family:

- R. D. Nelson, Y. H. Dobyns, B. J. Dunne, R. G. Jahn, `Analysis of Variance of REG Experiments: Operator Intention, Secondary Parameters, Database Structure`, PEAR Technical Note 91004.
- Princeton Library finding aid: `Correlations of Random Binary Sequences with Pre-Stated Operator Intentions`, Report No. 96003.
- B. J. Dunne and R. G. Jahn, `Experiments in Remote Human/Machine Interaction`, Journal of Scientific Exploration 6(4), 1992.

Princeton archival finding aid:
https://findingaids.princeton.edu/catalog/ENG003_c033

Historical PEAR/GCP-hosted protocol material:
https://noosphere.princeton.edu/rdnelson/reg.html
https://noosphere.princeton.edu/papers/pear/remote.reg.pdf

Status: `HISTORICAL ANALOGUE CONFIRMED — EFFECT CLAIMS REMAIN CONTESTED / REQUIRE INDEPENDENT REVIEW`.

Important methodological point: the PEAR family directly resembles MIP's REQUEST question more closely than ordinary remote viewing because the participant's intention is specified before the random-system output.

## Current MIP conclusion

Yes, both protocol families can be designed and tested:

### READ

`machine selects hidden number -> participant attempts to report number`

### REQUEST / INFLUENCE

`participant is assigned desired number -> participant performs request protocol -> machine generates number at predefined time -> test exact correspondence`

However, the existence of historical protocols does not establish that either phenomenon is reliable or that the mechanism is a MATRIX.

## Strongest MIP number protocol architecture

### A. MIP-NUM-READ

- number set defined in advance;
- machine target generated according to the specified timing model;
- participant cannot access system or target;
- response locked before reveal;
- exact match is primary endpoint;
- all trials retained.

### B. MIP-NUM-REQUEST

- requested value is randomly assigned per trial;
- participant is shown only the requested value and target time;
- request and target time are committed before machine generation;
- participant has no access to random device;
- at time T, device generates one value;
- primary endpoint: output equals trial-specific requested value;
- interleave no-intention, sham, and mismatched-time controls;
- compare target time with neighboring windows;
- calibrate device separately before/after blocks.

## Why the requested value must vary

Always requesting `1` is a weak design because an unnoticed device bias toward `1` can mimic success.

A stronger design randomly assigns the requested value on every trial, for example:

`REQUEST 0`, `REQUEST 1`, `REQUEST 1`, `REQUEST 0`, ...

The hypothesis is then whether the device follows the trial-specific request, not whether one output is globally overrepresented.

## Random source hierarchy

For READ:

- inaccessible CSPRNG can provide a strong hidden target;
- hardware/quantum RNG can also be used.

For REQUEST / INFLUENCE:

Prefer an auditable physical random source:

1. quantum RNG;
2. hardware electronic-noise RNG;
3. independently characterized physical RNG;
4. CSPRNG as a separate comparison condition.

Do not merge results from fundamentally different random-source classes without prespecified analysis.

## Control requirements

Mandatory candidate controls include:

- no-intention trials;
- sham-request trials;
- randomized requested values;
- target-time specificity;
- pre/post neighboring time windows;
- machine physically and logically isolated from participant;
- automated logging;
- immutable timestamps;
- blinded analysis labels;
- calibration runs;
- fixed sample size or formal sequential rule;
- no optional stopping after apparent streaks.

## Modern negative-control lesson

A recent concealed-target OBE study used randomly selected targets unknown to participants/researchers and did not find above-chance target correspondence in its primary rank-based analysis.

PubMed record: PMID 42617381.

This is useful methodologically because MIP should preserve strong null studies rather than build only from positive historical reports.

## Required next research tasks

1. Extract the complete 1979 Army Remote Perturbation protocol from the primary PDF.
2. Extract PEAR REG apparatus and run structure from primary/technical reports.
3. Identify independent replications, null results, and methodological critiques of REG-intention work.
4. Compare local vs remote operator protocols.
5. Determine whether any protocol tested a specific requested discrete output rather than only mean-shift/high-low intention.
6. Search for binary forced-choice intention protocols that map directly onto `REQUEST 0/1`.
7. Search for target-time-specific intention protocols.
8. Search for delayed/retroactive influence protocols, but keep them separate from ordinary forward-time REQUEST tests.
9. Design MIP-NUM-REQUEST v0.1 only after the audit above.
10. Version every protocol change and preserve failed/null versions.
