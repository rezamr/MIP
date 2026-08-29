# MIP Experiment Roadmap

## Principle

Do not jump from an unusual subjective session directly to a claim of anomalous information transfer. Experimental strength must increase in stages.

## EXP-001 — Phenomenology Replication

### Goal
Determine whether reported phenomena recur under standardized conditions without hidden targets.

### Candidate tracked phenomena

- vibration;
- pulse;
- roaring/buzzing/motor-like sound;
- rotation/spinning;
- floating/rising/falling;
- feet-to-head somatic flow;
- protective-field/REBAL phenomenology;
- sensed presence;
- spontaneous imagery;
- time compression;
- affective peaks;
- changes in voluntary control;
- termination-command effect.

### Output
Repeated-observation matrix by session and audio condition.

## EXP-002 — Audio Component Isolation

### Goal
Determine whether specific audio components are associated with measurable or reported state differences.

### Candidate conditions

- user baseline: 396 Hz + 4 Hz difference;
- historically reported anchor candidate: 200 Hz base + 4 Hz difference, pending primary-source verification;
- historically reported anchor candidate: 100 Hz base + 1.5 Hz difference, pending verification;
- reported dual/multi-pair environment, pending exact implementation recovery;
- carrier-matched Δ=0 control;
- deliberately different beat condition;
- phase-randomized stereo control;
- voice/preparation only;
- quiet rest;
- sham audio.

### Design requirements

- random condition labels;
- loudness matching where possible;
- identical preparation script across audio conditions;
- participant blind to condition identity where feasible;
- repeated within-subject sessions;
- preregistered primary state metrics before confirmatory phase.

## EXP-003 — READ

### Architecture

`hidden machine-selected target → participant`

### Core design

1. Participant enters defined state.
2. State-entry time is recorded.
3. Remote/isolated system generates target after state entry.
4. No target-aware human interacts with participant.
5. Participant produces raw response.
6. Raw response is timestamped and locked.
7. Independent judges rank response against true target + matched decoys, or a forced-choice design is used.
8. Target identity is revealed only after locking/scoring setup.

### Primary objective
Above-chance target information under leakage-resistant conditions.

## EXP-004 — WRITE / TRANSFER

### Architecture

`sender payload → unknown transfer path → isolated receiver`

### Candidate payload classes

- geometric symbol;
- word category;
- 4- or 8-choice icon;
- short binary payload;
- affective state: JOY / CALM / FEAR / SADNESS.

### Important distinction
A sender→receiver effect does not by itself establish persistent storage in an external substrate.

## EXP-005 — STORE / RETRIEVE

### Architecture

`A encodes payload → no receiver present → delay → B retrieves`

### Candidate delays

- 1 hour;
- 24 hours;
- 7 days.

### Requirements

- payload generated randomly;
- payload locked/encrypted;
- no contemporaneous receiver;
- delayed retrieval session uses blinded target set;
- no communication channel between encoder and retriever;
- raw retrieval locked before reveal.

### Importance
This test directly addresses persistence rather than ordinary contemporaneous sender/receiver transfer.

## EXP-006 — HANDSHAKE

### Architecture

`query commitment → hidden challenge generated afterward → participant response → lock → reveal`

### Initial challenge complexity

Start with high-sensitivity forced-choice formats before increasing information content:

- 4-choice;
- 8-choice;
- 4-bit;
- 8-bit.

Do not begin with extremely high-entropy payloads that destroy statistical sensitivity.

## State measurement program

Separate historical Focus labels from laboratory operational states.

Future lab-state measurements may include:

- ECG/heart rate;
- HRV;
- respiration;
- EEG;
- accelerometry/body movement;
- electrodermal activity;
- SpO2;
- temperature;
- blood pressure where practical;
- subjective alertness/agency/time perception.

A physiological state change is not evidence of anomalous information transfer. Analyze state induction and information performance as separate hypotheses.

## Termination protocol development

Because S0002 included a reported major change in voluntary emotional/facial control, future sessions should use a predefined termination command and measure whether it reliably reduces the state.

Candidate neutral command: `END SESSION`.

Record:

- time command issued;
- state intensity before command;
- time until reduction;
- state intensity after 15 s / 30 s / 60 s;
- whether participant could sit up/open eyes/respond normally;
- post-session after-effects.

Do not intentionally escalate a session solely to reproduce the most intense previous episode before measurement and control procedures are established.

## Confirmatory-test gate

Do not describe a test as confirmatory until:

- protocol version is frozen;
- primary endpoint is defined;
- target generation is validated;
- response locking works;
- blinding rules are documented;
- exclusions are prespecified;
- scoring method is frozen;
- sample-size/sequential rule is defined;
- sham/control conditions are available.
