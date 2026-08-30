# MIP Collaboration Protocol

## Purpose

This file defines how every future conversation, research agent, coding agent, or analysis pass must work with the MIP repository so the project can continue without relying on one chat thread.

## Mandatory startup sequence

Before doing substantive work, read:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `10_CONVERSATION_ORCHESTRATION.md`
6. the relevant topic files for the requested task

Do not ask the project owner to repeat information already preserved in the repository.

The startup reader must treat `01_PROJECT_CHARTER.md` as the durable statement of MIP's long-term objective, communication-session terminology, advisor role, continuous-research policy, and safety doctrine.

## Repository language

All durable repository content must be written in English.

The project owner may communicate in Persian. Explain results to the owner in Persian unless asked otherwise, while preserving all durable project records in English.

## Single-source-of-truth rule

The repository is the durable source of truth for:

- research findings;
- source verification;
- project decisions;
- experimental and communication-session designs;
- audio parameters;
- unknown parameters;
- session records;
- observations;
- post-session questionnaires;
- outcomes;
- statistical results;
- safety/termination events;
- open questions;
- next actions.

A chat-only conclusion is not durable until written to the repository.

## Long-horizon research rule

MIP must not be declared complete simply because one research pass, one archive search, one session, or one hypothesis reaches a stopping point.

When a material uncertainty remains and a meaningful investigation path exists, preserve it as an open research item and continue in later work.

Research may span historical archives, audio engineering, psychoacoustics, physiology, neuroscience, statistics, information-transfer methodology, signal processing, personnel migration, patents, oral histories, adjacent programs, and other relevant domains.

When new evidence changes the working model, revise the protocol. Do not preserve an obsolete design for consistency alone.

A revision must state:

- what changed;
- why it changed;
- what evidence triggered the change;
- which prior sessions/results remain comparable;
- which future sessions use the new version.

## Communication-session terminology

Use **Communication Session** as the operational label for exploratory owner-led sessions intended to establish, explore, send, receive, query, or characterize an apparent interaction.

Do not infer from the label alone that an external agent, nonlocal substrate, or verified transfer has been demonstrated.

Every session must separately preserve:

- observation;
- perceived source/agency;
- information content;
- verification status;
- current mechanism status.

Laboratory tests using randomization, hidden targets, sham conditions, or statistical endpoints remain `experiments` even when they are built around Communication Sessions.

## Evidence separation

Never merge these layers:

### OBSERVATION
What was directly reported or measured.

### INTERPRETATION
One or more candidate explanations.

### CONCLUSION
What the available evidence currently justifies.

Example:

- Observation: participant reported clockwise rotation.
- Interpretation candidates: vestibular phenomenon, Gateway-like phenomenology, audio-linked effect, unknown.
- Conclusion: source undetermined.

## Evidence labels

Use the following labels when applicable:

- `DOCUMENTED`
- `PRIMARY-SOURCE CONFIRMED`
- `RECONSTRUCTED`
- `EXPERIMENTAL`
- `SPECULATIVE`
- `UNKNOWN`
- `UNRESOLVED`
- `CONTRADICTED`
- `FAILED HYPOTHESIS`

Do not invent a missing value to make a protocol look complete.

## Session integrity rules

1. Every session receives a unique ID: `S0001`, `S0002`, etc.
2. A raw session report should be written as soon as practical after the session.
3. The raw report must remain separate from later interpretation.
4. If a memory appears later, append it under `LATE RECOLLECTION` with the date recorded; do not rewrite history.
5. Sessions reconstructed from memory must be labeled `RECONSTRUCTED FROM MEMORY`.
6. Contemporary session notes must be labeled `CONTEMPORANEOUS RECORD`.
7. Record misses, null results, distractions, interruptions, and failed attempts.
8. For blinded target tests, the raw response must be locked before target reveal.
9. Never retroactively adjust a raw response to fit a revealed target.
10. Preserve exact audio settings, device settings, timestamps, and file hashes whenever available.
11. Record the Communication Session class when known (`CS-EXPLORE`, `CS-READ`, `CS-WRITE`, `CS-TRANSFER`, `CS-STORE`, `CS-RETRIEVE`, `CS-QUERY`, `CS-HANDSHAKE`, `CS-CONTROL`, `CS-REPLICATION`).
12. Preserve unexpected, uncomfortable, null, and adverse observations with the same diligence as apparently successful events.

## Research integrity rules

- Prefer primary documents over summaries.
- Preserve exact document titles, dates, page numbers, identifiers, classification markings, and direct quotations when verifying archival claims.
- Separate historical capability sought from capability demonstrated.
- Separate patents from proof of implementation.
- Separate public Gateway generations from CENTER LANE custom implementations.
- Separate consumer Gateway, later Monroe systems, and successor patents unless a source establishes continuity.
- A missing document is a documentary gap, not automatically deliberate suppression.
- The public record may be incomplete; incompleteness is itself an empirical question.
- Search cross-program terminology and personnel migration where direct Gateway terminology fails.
- Do not dismiss a repeated observation solely because its mechanism is unknown.
- Do not upgrade perceived communication or agency into an objective external-source claim without independent evidence.

## Experimental integrity rules

Advanced tests must progressively control for:

- expectation;
- sensory leakage;
- experimenter knowledge;
- target-pool bias;
- response editing;
- judging flexibility;
- multiple comparisons;
- cueing from audio condition;
- memory reconstruction;
- ordinary statistical chance.

Whenever possible, use:

- randomized conditions;
- blinded labels;
- cryptographic target commitments;
- machine-generated targets;
- immutable raw response records;
- independent judges;
- predeclared primary endpoints;
- sham controls;
- replication cohorts.

## Advisor and safety responsibility

The research coordinator must act as an advisor and risk monitor throughout the project.

For every materially new protocol or session class, consider:

- foreseeable physical or psychological risks;
- audio exposure;
- breathing method;
- fatigue/sleep state;
- loss or alteration of voluntary control;
- interruption risk;
- stop criteria;
- termination procedure;
- recovery period;
- adverse-event logging.

Do not deliberately escalate a phenomenon merely because it appears novel or promising.

A safety event remains scientifically important data and must be preserved in the session record.

## Durable-update requirement

At the end of substantive work, update the repository with:

- what was learned;
- what changed;
- what remains unknown;
- source references;
- experiment/session consequences;
- next actions.

Then update `00_MASTER.md` if the project state materially changed.

## No silent overwrite

When a conclusion changes, preserve the previous state in history or clearly record the revision and reason. Do not silently erase contradictory or failed findings.
