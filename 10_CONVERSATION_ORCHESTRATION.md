# MIP Conversation Orchestration

## Goal

Any future conversation must be able to continue MIP from repository state without requiring the project owner to reconstruct prior context.

## Mandatory behavior for every MIP conversation

### 1. Read before acting

Read:

- `README.md`
- `COLLABORATION_PROTOCOL.md`
- `00_MASTER.md`
- this file
- relevant evidence/protocol/session/research files

### 2. Identify the current workstream

Classify the task into one or more workstreams:

- `R1` Archival Reconstruction
- `R2` Source Verification
- `R3` Audio Engineering
- `R4` Physiology / State Measurement
- `R5` Session Documentation
- `R6` Phenomenology Analysis
- `R7` READ Experiment
- `R8` WRITE / Transfer Experiment
- `R9` STORE / RETRIEVE Experiment
- `R10` HANDSHAKE Experiment
- `R11` Statistics / Blinding / Falsification
- `R12` Cross-Program / Personnel Migration

### 3. Preserve terminology

Repository language: English.

When talking to the project owner, explain in Persian unless asked otherwise. Technical terms such as pulse, carrier, binaural beat, phase, amplitude, modulation, coherence, target, payload, hash, sham, and blind may be retained in English inside Persian explanations when that improves precision.

### 4. Never depend on hidden chat context

If a fact matters for future work, write it to the repository.

Do not rely on:

- remembered chat wording;
- unrecorded user session details;
- screenshots that were never summarized;
- temporary research conclusions;
- unstored parameter choices.

### 5. Session workflow

For a new session:

1. Assign next `S####` ID.
2. Copy `templates/SESSION_TEMPLATE.md` into `sessions/S####/SESSION.md` or equivalent.
3. Fill pre-session fields before the experiment when possible.
4. Record raw observations before interpretation or target reveal.
5. Lock the raw section.
6. Add post-session questionnaire.
7. Add target reveal/scoring only after locking.
8. Add analysis separately.
9. Update `sessions/SESSION_INDEX.md`.
10. Update `00_MASTER.md` only if the session materially changes project direction.

### 6. Research workflow

For a new major research pass:

1. State the exact research question.
2. State which unknown or hypothesis it addresses.
3. Prefer primary sources.
4. Record search saturation for critical unknowns.
5. Write durable output into `research/` and relevant `evidence/` registers.
6. Update `00_MASTER.md` with only durable conclusions.

### 7. Source verification workflow

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

### 8. Contradiction handling

If new evidence conflicts with an existing conclusion:

- do not silently delete the old conclusion;
- document the conflict;
- lower confidence if required;
- identify which evidence is stronger and why;
- update the master status.

### 9. Experimental escalation

Do not escalate an exploratory observation directly into a confirmatory protocol.

Preferred progression:

`exploratory observation → repeated observation → controlled association → blinded test → preregistered replication → independent replication → mechanism test`

### 10. End-of-conversation durable handoff

Before considering a substantive MIP conversation complete, make sure the repository contains:

- work completed;
- findings;
- changed confidence levels;
- open questions;
- files modified;
- exact next action.

A future conversation should be able to resume from those files alone.
