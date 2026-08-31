# MIP Conversation Orchestration

## Goal

Any future conversation must be able to continue MIP from repository state without requiring the project owner to reconstruct prior context.

## Mandatory behavior for every MIP conversation

### 1. Read before acting

Read, in the repository startup order:

- `README.md`
- `COLLABORATION_PROTOCOL.md`
- `00_MASTER.md`
- `01_PROJECT_CHARTER.md`
- `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
- `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
- `04_EVIDENCE_STANDARD.md`
- `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
- this file
- relevant evidence/protocol/session/research/engineering files.

For software implementation work, read `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md` before interpreting older engineering generations.

### 2. Identify the current workstream

Classify the task into one or more workstreams:

- `R1` Archival Reconstruction
- `R2` Source Verification
- `R3` Audio Engineering / Audio Lab
- `R4` Physiology / State Measurement
- `R5` Session Documentation / Evidence Integrity
- `R6` Phenomenology Analysis
- `R7` READ Experiment
- `R8` REQUEST / INFLUENCE Experiment
- `R9` Temporal Response / Latency / Persistence
- `R10` Entropy / Mapping / Encoding
- `R11` WRITE / Transfer Experiment
- `R12` STORE / RETRIEVE Experiment
- `R13` HANDSHAKE / Bidirectional Experiment
- `R14` Statistics / Blinding / Falsification
- `R15` Software / Instrumentation / RNG / Logging
- `R16` Cross-Program / Personnel Migration

READ and REQUEST/INFLUENCE remain separate workstreams and must not be silently pooled.

### 3. Preserve terminology

Repository language: English.

When talking to the project owner, explain in Persian unless asked otherwise. Technical terms such as pulse, carrier, binaural beat, phase, amplitude, modulation, coherence, target, payload, hash, sham, blind, mapping, request, reveal, and commitment may be retained in English inside Persian explanations when that improves precision.

### 4. Never depend on hidden chat context

If a fact matters for future work, write it to the repository.

Do not rely on:

- remembered chat wording;
- unrecorded user session details;
- screenshots that were never summarized;
- temporary research conclusions;
- unstored parameter choices.

### 5. Session workflow

For a new manually documented session:

1. Assign next `S####` ID.
2. Copy/update the current session template into `sessions/S####/SESSION.md` or equivalent.
3. Fill pre-session fields before the experiment when possible.
4. Record raw observations before interpretation or target reveal.
5. Lock the raw section.
6. Add post-session questionnaire.
7. Add target reveal/scoring only after locking.
8. Add analysis separately.
9. Update `sessions/SESSION_INDEX.md`.
10. Update `00_MASTER.md` only if the session materially changes project direction.

For formal software-recorded sessions, the application runtime bundle is the machine-level evidence record and must follow `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`. Repository Markdown documentation may summarize/import that evidence later but must not replace or rewrite the runtime raw evidence.

### 6. Formal session audit workflow

When reviewing a software-recorded session:

1. verify session/trial/block IDs;
2. run integrity verification;
3. inspect commitment and immutable config snapshot;
4. inspect chronological `events.jsonl` chain;
5. verify raw machine-output linkage/hashes;
6. confirm timing scheduled/wake/actual values;
7. confirm raw-report lock preceded reveal;
8. inspect protocol deviations/failures;
9. distinguish primary versus exploratory analysis;
10. compare only with configuration-compatible sessions;
11. preserve late recollections/post-reveal notes separately.

Do not accept a result summary if the underlying evidence bundle fails integrity verification.

### 7. Research workflow

For a new major research pass:

1. State the exact research question.
2. State which unknown or hypothesis it addresses.
3. Prefer primary sources.
4. Record search saturation for critical unknowns.
5. Write durable output into `research/` and relevant `evidence/` registers.
6. Update `00_MASTER.md` with only durable conclusions.

### 8. Source verification workflow

For every high-impact archival claim preserve:

- exact title;
- date;
- author/originating office;
- classification marking;
- archive/collection;
- document identifier;
- exact page;
- exact relevant quotation;
- direct primary-source location if available;
- interpretation;
- what the source does not establish;
- verification status.

### 9. Contradiction handling

If new evidence conflicts with an existing conclusion:

- do not silently delete the old conclusion;
- document the conflict;
- lower confidence if required;
- identify which evidence is stronger and why;
- update the master status.

For implementation conflicts, use the active implementation authority file rather than combining old and new behaviors.

### 10. Experimental escalation

Do not escalate an exploratory observation directly into a confirmatory protocol.

Preferred progression:

`exploratory observation -> repeated observation -> controlled association -> blinded test -> preregistered replication -> independent replication -> mechanism test`

For REQUEST specifically, characterize timing, mapping/encoding, device bias, controls, and entropy progressively rather than jumping from one binary session to a high-entropy causal claim.

### 11. End-of-conversation durable handoff

Before considering a substantive MIP conversation complete, make sure the repository contains:

- work completed;
- findings;
- changed confidence levels;
- protocol/engineering version changes;
- open questions;
- files modified;
- exact next action.

A future conversation should be able to resume from those files alone.
