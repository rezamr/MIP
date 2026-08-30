# Remote Perturbation 1979–1980: Full Protocol and Results Audit

## Why this file exists

This document preserves a full working audit of the U.S. Army / SRI binary Remote Perturbation (RP) program that is directly relevant to MIP's primary REQUEST / INFLUENCE objective.

This is not a claim that remote perturbation was established as a physical phenomenon. It is a source-grounded reconstruction of what was actually proposed, tested, and reported.

---

## Source identity and page-count correction

### Primary protocol source

**Title:** Remote Perturbation Techniques: Project Description and Experimental Protocol  
**Date:** 7 November 1979  
**Originating organization:** U.S. Army Missile Command (MICOM), Redstone Arsenal, Alabama  
**Program context:** GRILL FLAME / DARCOM  
**Principal investigator named in the document:** Dr. B. Z. Jenkins  
**CIA archive identifier:** `CIA-RDP96-00788R002000230004-2`  
**Primary CIA URL:** `https://www.cia.gov/readingroom/docs/CIA-RDP96-00788R002000230004-2.pdf`

The surviving CIA PDF is approximately **49 PDF pages**. The internal report pagination runs through the 40s. **Internal page 25 is the beginning of Appendix B, “Description of Experiment.”** Therefore a reference to “the 25-page experiment” is likely a page-number confusion; MIP will preserve the entire protocol, not only page 25 onward.

### Results / managerial follow-up

**Title:** Remote Perturbation Techniques — Managerial Summary  
**Date:** 29 October 1980  
**Archive identifier:** `CIA-RDP96-00788R002000230005-1`  
**CIA URL:** `https://www.cia.gov/readingroom/docs/CIA-RDP96-00788R002000230005-1.pdf`

This later source reports the completed SRI contractor portion and states that the MICOM in-house portion was still in final data gathering at the time of the summary.

### Related SRI final report

**Title:** Electronic System Perturbation Techniques  
**Date:** 30 September 1980  
**Authors:** Edwin C. May, Beverly S. Humphrey, G. Scott Hubbard  
**Archival location:** Edwin C. May papers, Woodson Research Center, Rice University, Box 6, Folder 21  
**Catalog record:** `https://archives.library.rice.edu/repositories/2/archival_objects/317111`

A complete source-level audit of this SRI final report remains an open task because the present pass recovered its existence and structure but not a complete primary-text copy through the current web interface.

---

# Part I — What the experiment was actually testing

## Core hypothesis

The program tested whether a human participant could intentionally bias an otherwise random **binary stream**.

The primary architecture was:

`human intention -> random event generator -> binary 0/1 stream -> real-time statistical analysis -> feedback`

The participant was not simply guessing the next bit. The stated task was to **bias the statistical composition of a stream toward the desired side**.

The protocol explicitly states that the participant could be instructed to favor either:

- `1`
- or `0`

This is a direct historical analogue for MIP's `REQUEST 1` / `REQUEST 0` architecture.

However, the historical experiment used a **stream-level bias task**, not merely one isolated coin-flip output at a scheduled time.

---

# Part II — Main body of the 1979 protocol

## 1. General / program framing

The document defines Remote Perturbation as an intellectual/mental process by which a person attempts to perturb remote sensitive apparatus or equipment.

Important negative controls stated in the protocol:

- no electronic sensor aimed at the participant;
- no drugs;
- no hypnosis;
- no special visual, auditory, or olfactory stimulation;
- no liminal or subliminal stimulation;
- no electrical stimulation;
- no electromagnetic stimulation.

The work was placed under the broader GRILL FLAME program.

## 2. Background

The report explicitly distinguishes staged trickery from a smaller body of laboratory RNG/PK work it considered worth testing.

The appeal of the RNG approach was that the output could be evaluated numerically rather than by subjective interpretation.

The report also notes two major problems in the prior literature:

1. effects were generally not stable within one individual;
2. earlier publications often did not describe the physical/electronic environment well enough to exclude ordinary interference.

These problems directly motivated the stricter hardware and replication design.

## 3. Scientific merit

The report discusses speculative physical interpretations, including quantum-mechanical proposals, but does not treat those theories as proof.

For MIP, this section is historical rationale only; it is not mechanism evidence.

## 4. Objective / relationship to Remote Viewing

The report distinguishes RP from Remote Viewing.

- Remote Viewing: obtain information that ordinary perception cannot access.
- Remote Perturbation: attempt to alter a remote physical/random system.

The report identifies this as the first GRILL FLAME investigation focused specifically on RP.

This historical READ-vs-INFLUENCE separation is directly aligned with MIP's current architecture.

## 5. Simplified plan

The simplified protocol was:

1. Generate a truly random binary sequence of `0`s and `1`s.
2. Instruct the participant to bias the sequence toward `1`s or toward `0`s using mental effort.
3. Give the participant rapid feedback about apparent success.
4. Analyze the binary stream in real time.
5. End the trial when the sequential analysis determines that the stream meets the predefined criterion for perturbation or does not.
6. Repeat many trials for each participant.

---

# Part III — Random sources

The program intentionally considered more than one source.

## A. Electronic noise diode

A quantum-noise / avalanche-noise diode was used as a physical random source.

The protocol sought to characterize and isolate it against environmental and electronic artifacts.

## B. Radioactive beta-decay source

The protocol discusses beta-emitting radioactive sources, especially Promethium-147 in the main plan, with related technical discussion also mentioning Carbon-14 in Appendix B.

Random decay events were detected electronically.

A flip-flop changed state on random events and was sampled to form a binary sequence.

## C. Pseudo-random source

A deterministic pseudo-random sequence was also planned.

This was scientifically important because the investigators wanted to compare:

`true physical randomness`

versus

`deterministic sequence that only appears random`

The protocol explicitly recognized that a difference between the two could help distinguish possible mechanisms.

### MIP consequence

MIP should preserve this source-family comparison instead of testing only one software RNG.

Future MIP REQUEST work should separately test:

- deterministic PRNG;
- CSPRNG / OS entropy;
- physical electronic-noise RNG;
- quantum RNG if available.

---

# Part IV — Real-time analysis and feedback

## Statistical analysis

The computer evaluated the binary sequence continuously in real time.

The null model was essentially a 50/50 binary process:

`P(0) = 0.5`

`P(1) = 0.5`

The dependent variable was the statistical departure from chance expectation in the instructed direction.

The 1979 protocol described individual-trial success in terms of odds against chance greater than approximately `20:1`, corresponding to about the `.05` level under the procedure as described.

Important: the exact operational success rule appears to have evolved between the 1979 proposal and the 1980 reported formal test. That evolution is documented below.

## Feedback

Feedback was a major component, not a minor accessory.

The participant could choose among visual and auditory feedback modes.

Documented examples include:

- clock-like motion;
- race-car displacement;
- the position of a statistical “pawn” in the sequential-analysis display;
- auditory tone frequency or intensity varying with apparent success.

### MIP consequence

MIP must explicitly test whether feedback is:

- necessary;
- helpful;
- harmful;
- or irrelevant.

Do not assume a no-feedback version is equivalent to the historical protocol.

---

# Part V — Pilot and formal phases

## Phase I — Hardware construction and validation

Before participant testing, the apparatus was to undergo extensive validation.

The purpose was to establish:

- source randomness;
- proper analysis behavior;
- proper feedback/display function;
- sensitivity to environmental interference;
- resistance to ordinary electronic artifacts.

## Phase II — Participant testing

The planned participant-testing phase lasted approximately six months.

### Pilot period

The first four months were a learning / familiarization period.

Purposes:

- participants learn the task;
- participants explore mental strategies;
- feedback modes can be explored;
- device parameters can be optimized.

### Formal period

The final two months were intended as the formal data-collection period.

Each selected participant was to contribute `100` formal trials.

Sessions were limited to approximately `30 minutes`.

No more than two sessions per day were planned, typically one morning and one afternoon.

A participant's total exposure across pilot plus formal testing was capped in the protocol.

---

# Part VI — Typical session sequence

The 1979 Army protocol describes the following sequence:

1. Participant and experimenter discuss current program status.
2. If the participant feels the current “set or circumstance” is unfavorable, the session may be postponed.
3. Changes in experimental variables are described as appropriate.
4. Participant selects a preferred feedback mode.
5. Participant initiates successive trials at their own pace and timing.
6. Session continues for nominally about 30 minutes or ends sooner if desired.
7. Participant is debriefed.
8. Trial outcomes and statistical significance are explained.

### Critical MIP concern

Allowing the participant to choose the exact instant at which a trial begins creates an unresolved ambiguity:

`remote influence`

versus

`precognitive selection of a favorable future sequence`

The 1979 authors explicitly recognized this problem and stated that their design did **not** distinguish RP from precognition.

This is one of the most important methodological lessons for MIP.

---

# Part VII — Independent and dependent variables

## Primary independent variables

1. Participant present vs no participant.
2. Random-source type:
   - beta decay;
   - electronic-noise source;
   - pseudo-random source.
3. Feedback-display mode.

## Dependent variable

The output of the statistical analysis of the binary bit stream.

In practical terms:

`Does the bit stream deviate from 50/50 in the requested direction more strongly/often than chance predicts?`

---

# Part VIII — Hardware architecture

The experimental system included three main subsystems:

1. Randomness source.
2. Analysis / recording computer.
3. Feedback display.

The Appendix B design describes use of a DEC LSI-11-class microcomputer, disk storage, video display, and optically isolated signal pathways.

The hardware was designed so raw-source events, derived binary sequence, analysis result, and feedback path could be recorded and compared.

This allowed post-hoc localization of an anomaly to:

- source stage;
- computer/analysis stage;
- display/feedback stage.

### MIP consequence

MIP should copy this **stage-to-stage logging** principle.

A modern implementation should separately hash and log:

`raw entropy -> sampled bit -> transformed value -> target comparison -> UI display -> stored result`

so that an apparent effect can be localized.

---

# Part IX — Anti-deception / anti-artifact safeguards

The protocol placed unusually strong emphasis on credibility.

## Independent duplication

The experiment was to be run in two locations:

- SRI International, Menlo Park;
- U.S. Army MICOM, Redstone Arsenal.

The Redstone experiment was to use independently acquired/assembled equipment and Army personnel.

## Equipment separation

Participant-room equipment could not program the computer.

Sensitive/programming equipment was placed in a separate room.

## Data retention

The protocol states that formal data should be retained rather than selectively discarded.

Unusual circumstances were to be recorded.

## Monte Carlo / validation

Artificially biased sequences and Monte Carlo methods were to be used to validate the analysis machinery and estimate error behavior.

## Environmental concerns

The protocol explicitly considered possible ordinary causes such as:

- radiation;
- ultrasound;
- electromagnetic/electronic effects;
- geophysical/environmental variables.

The investigators intended hardware testing and control runs to minimize those explanations.

---

# Part X — Participants

The 1979 protocol planned to recruit a small group of experienced Remote Viewers rather than a large unselected population.

Maximum planned number in the proposal: fewer than or equal to nine.

Sources of participants included MICOM, AMSAA, and SRI personnel/consultants with prior Remote Viewing experience.

Participation was voluntary.

General health was required.

The later 1980 managerial summary states that after familiarization/screening, **seven participants** contributed formal data at SRI, each with `100` trials.

This is an example of protocol evolution between proposal and execution.

---

# Part XI — Facilities

The MICOM experiment was planned for Building 7770 at Redstone Arsenal.

The participant room was described as:

- comfortable;
- carpeted;
- air conditioned;
- fluorescent/incandescent lighting;
- couch/easy chair/tables;
- computer graphics terminal;
- reclining swivel chair.

The random generators and programmable hardware were in an adjacent separately securable room.

This physical separation was part of the anti-artifact design.

---

# Part XII — Appendix A: prior RNG database

The protocol did not begin from zero. It included a review/database of earlier RNG perturbation experiments.

## Schmidt 1970 example

The included historical example used a binary RNG linked to radioactive Strontium-90 decay.

The subject attempted to influence the direction of a light performing a random walk.

The Army report summarizes one early dataset as approximately `49.41%` ones across more than `32,000` bits, interpreted as a statistically significant deficit of ones relative to 50%.

The original Schmidt experiment embedded in the appendix used:

- binary outputs `+1` and `-1`;
- circular nine-lamp display;
- preferred clockwise or counterclockwise direction;
- `128` random steps per run;
- `4` runs per session.

The historical paper reported a significant negative deviation in its confirmatory series.

## 1978 literature database

The Army report states that by 1978, 54 related experiments had been reported, with 35 described as significantly departing from chance and control runs not showing similar deviations.

The report itself cautions that instability by individual and inadequate environmental reporting were major problems.

### MIP interpretation

This literature table is historical motivation, not independent modern validation.

---

# Part XIII — Appendix B: Description of Experiment (starts internal page 25)

This is the section most directly relevant to MIP.

## Assumptions

The proposed system assumed provisionally that:

- the random-source stage was the primary susceptible element;
- analysis/recording/display hardware was approximately stable;
- the participant was the source of any observed perturbation.

The protocol explicitly noted these were assumptions to be checked.

## Random sources

Appendix B specifies:

- electronic noise diode;
- radioactive beta-decay source;
- pseudo-random feedback shift register.

## Analysis / recording

A DEC LSI-11-family microcomputer and disk storage were used/planned.

## Display

Computer-driven video display plus selectable feedback formats.

## Experimental logic

The participant attempted to drive the ongoing statistical state toward the requested direction until the sequential procedure reached a decision boundary.

This is closer to **closed-loop intention with feedback** than to a single isolated binary event.

---

# Part XIV — Appendix C: Phase-I validation procedures

Appendix C is extremely important for MIP because it shows how seriously the authors treated device characterization.

Documented tests include:

## Haitz noise diode

Measure raw and filtered spectra and pulse-height behavior while varying:

- diode reverse current approximately `60–200 µA`;
- manufacturer-recommended point around `100 µA`;
- temperature approximately `-40°C to +40°C`;
- magnetic field up to approximately `6000 gauss`, parallel/perpendicular to junction;
- low-intensity gamma irradiation around `1.33 MeV`.

## Electron / beta detector

- verify manufacturer noise specifications;
- measure Promethium-147 beta-decay pulse-height spectrum;
- compare against known spectrum;
- confirm amplifier and pulse-shaping electronics.

## Pseudo-random generator

Generate complete sequence/set for the configured shift-register system and compare with expected sequence.

## Sequential analysis

Validate the statistical procedure with computer-generated known random/biased streams using Monte Carlo methods.

### MIP consequence

A future MIP hardware RNG must have an equally explicit **pre-session device certification protocol**. We should not treat an online RNG API as a black box if REQUEST/INFLUENCE becomes a serious test.

---

# Part XV — Appendix D: informed consent / participant handling

The protocol included written volunteer consent and participant briefing.

The main body states:

- only willing volunteers were to participate;
- participants were informed of the procedures;
- a pilot/familiarization phase was used;
- session results were discussed during debriefing;
- final debriefing was planned at experiment completion.

A full line-by-line Appendix-D transcription has not yet been source-captured in this audit and remains an archival extraction task.

---

# Part XVI — Appendix E: medical / emergency procedures

The protocol included ordinary emergency medical planning.

Documented elements include:

- immediate first aid/medical care for injury or sudden illness;
- Fox Army Hospital designated for on-post care;
- emergency room available 24/7;
- ambulance/emergency contact procedure;
- same-day accident/illness reporting;
- Project Manager authority for emergency response.

This appendix is administrative/safety infrastructure, not evidence of special physiological risk from RP.

---

# Part XVII — Planned interpretation rules in 1979

The 1979 proposal specified three program-level outcomes:

## Positive

Both contractor and government experiments meet the predefined overall criteria.

## Negative

Neither contractor nor government experiment meets the criteria, and no qualifying individual result is present.

## Indeterminate

Anything between those two cases.

The protocol planned further work if only one site succeeded, including hardware exchange and reanalysis.

The authors also explicitly stated that the design did not isolate:

- participant influence from experimenter influence;
- remote perturbation from precognition.

This limitation is central to MIP's redesign.

---

# Part XVIII — What the 1980 managerial summary says was actually done

By 29 October 1980, two technically similar experiments had been undertaken:

- SRI International contractor experiment;
- U.S. Army MICOM in-house experiment.

The summary describes the operational task as:

1. A true random `0/1` sequence is produced by a random-event generator.
2. Participant is instructed to bias it toward `1`s or toward `0`s.
3. Real-time feedback is supplied.
4. Computer performs real-time statistical analysis.
5. A trial ends when it is judged perturbed or not by the predefined analysis.
6. After familiarization/screening, seven participants each contribute 100 formal trials at SRI.

Thus the completed SRI formal dataset reported in the managerial summary contained:

`7 participants x 100 trials = 700 formal trials`

---

# Part XIX — Reported 1980 result

## Pre-established run/test criterion reported in the managerial summary

The 1980 managerial summary gives a formal criterion different in detail from the earlier 1979 proposal language:

- Participant run: `16 or more` perturbed trials out of `100` -> `P < .05` under their stated model.
- Overall test: `2 or more` significant participant runs out of `7` -> `P < .05` under their stated model.

This protocol evolution must be preserved; MIP must not silently mix the two thresholds.

## SRI contractor result

The SRI contractor experiment reportedly produced:

- one participant/run: `16 / 100` successful trials;
- another participant/run: `17 / 100` successful trials;
- therefore `2` significant runs out of `7`;
- total successful trials: `87 / 700`;
- reported overall significance: `P = .021`;
- equivalent odds language in the Army summary: approximately `1:47` against the random-stream null model for the completed contractor result.

## Controls

The managerial summary reports that control runs made without experimenter and RP participants did **not** show significant deviation from chance.

## MICOM in-house result status

At the date of the 29 October 1980 managerial summary, the MICOM in-house experiment was still in final data gathering and expected to complete by 31 October 1980.

Therefore:

**MIP does not yet have the final MICOM in-house result from a primary final document.**

This remains an open research item.

## Important interpretation limit

The reported `87 / 700` is **not** “87 correct guesses of one bit.”

Each “successful trial” refers to a sequentially analyzed stream being classified as sufficiently perturbed in the requested direction under the experiment's stopping/decision rule.

That distinction is essential.

---

# Part XX — What the Army itself concluded in October 1980

The managerial summary did **not** claim final proof.

It stated that:

- the SRI contractor result met their predefined criteria;
- control runs behaved as random;
- the completed result was considered difficult to dismiss within the context of the prior database;
- but final conclusions had to await the MICOM in-house test.

The summary explicitly proposed a next step to distinguish:

`actual remote perturbation`

from

`precognition of a favorable upcoming sequence`

This unresolved causal ambiguity is one of the most important lessons for MIP.

---

# Part XXI — Direct relevance to MIP

## What matches MIP very closely

Historical protocol:

`participant intends 0 or 1 -> random physical system -> look for requested directional bias`

MIP objective:

`participant requests 0 or 1 -> independent system produces later output -> check request/outcome correspondence`

So yes: **the Army/SRI work tested the same basic direction of causality that MIP wants to test**, although with a stream-bias architecture rather than a single scheduled output.

## What MIP should not copy unchanged

The historical design allowed the participant to initiate trials at a self-selected moment. This leaves a precognition loophole.

MIP should therefore create at least two separate variants:

### Variant A — PARTICIPANT-INITIATED

Replicate the historical style for comparability.

### Variant B — MACHINE-TIMED

The participant commits to `REQUEST 0` or `REQUEST 1` before a target time.

The machine generates or begins sampling at a time the participant cannot choose or alter.

This sharply reduces the “wait until a favorable sequence is coming” explanation.

## MIP should also compare

- one-shot binary outcome;
- stream-level bias;
- no-feedback;
- real-time feedback;
- true physical RNG;
- deterministic PRNG;
- participant-present vs remote;
- target-time vs neighboring-time controls.

---

# Part XXII — Recommended MIP replication families derived from this source

## `MIP-RP-HIST-v0.1`

Purpose: close replication of historical stream-bias logic.

- random binary stream;
- requested direction `0` or `1` randomized trial-by-trial;
- feedback available;
- sequential analysis;
- participant can initiate trial;
- raw entropy recorded separately from transformed bits;
- sham/control sessions.

## `MIP-RP-FIXEDTIME-v0.1`

Purpose: test request/influence while reducing precognitive timing selection.

- request value assigned before session;
- request cryptographically committed;
- generation time T fixed by machine;
- participant cannot initiate or delay generation;
- no target-aware experimenter intervention;
- exact-match / stream-bias endpoint predefined;
- T-1 / T / T+1 temporal controls.

## `MIP-RP-BLIND-FEEDBACK-v0.1`

Purpose: isolate feedback effects.

Randomly interleave:

- true feedback;
- sham feedback;
- no feedback.

Participant does not know the feedback condition.

---

# Part XXIII — Mandatory unresolved questions

1. Recover complete SRI 1980 final report text and all trial-level definitions.
2. Recover final MICOM in-house result after 29 October 1980.
3. Determine exact sequential-analysis decision boundaries and stopping rules used in the final SRI formal phase.
4. Determine whether `0` vs `1` request direction was randomized, participant-selected, experimenter-selected, or otherwise scheduled in the formal phase.
5. Determine how often each physical source was used in the final formal phase.
6. Determine which feedback modes were actually used by the two significant participants.
7. Recover raw trial counts and participant-by-participant tables.
8. Determine whether any follow-up separated influence from precognition.
9. Recover hardware-certification data from the Phase-I report.
10. Compare the final SRI protocol against the earlier 1979 Army proposal and document every change.

---

# Bottom line for MIP

**Yes: this historical program directly tested intentional binary-direction influence.**

The participant was asked to push a random binary process toward `1` or toward `0`.

The strongest currently recovered official result is the 1980 SRI contractor summary:

- 7 participants;
- 100 formal trials each;
- 700 total formal trials;
- two significant participant runs: 16/100 and 17/100;
- 87/700 successful trials overall;
- reported `P = .021`;
- control runs reportedly nonsignificant.

But the surviving October 1980 summary still says final conclusions awaited completion of the MICOM in-house experiment.

Therefore MIP status is:

`HISTORICAL BINARY REQUEST/INFLUENCE PRECEDENT = PRIMARY-SOURCE CONFIRMED`

`SRI CONTRACTOR POSITIVE RESULT UNDER THEIR PREDEFINED CRITERIA = PRIMARY-SOURCE CONFIRMED`

`FINAL MICOM REPLICATION RESULT = UNKNOWN / NOT YET RECOVERED`

`REMOTE INFLUENCE AS THE UNIQUE CAUSE = NOT ESTABLISHED`

`PRECOGNITION VS INFLUENCE = EXPLICITLY UNRESOLVED IN THE HISTORICAL DESIGN`
