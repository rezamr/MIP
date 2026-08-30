# MIP Experiment Roadmap

## Principle

Do not jump from an unusual subjective session directly to a claim of anomalous information transfer or influence. Experimental strength must increase in stages.

MIP's primary practical objective is communication/request-response. Passive READ/perception remains a separate secondary track used for comparison, calibration, and bidirectional testing.

READ and REQUEST/INFLUENCE must never be merged.

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

## EXP-003 — READ / NUMBER PERCEPTION

### Architecture

`hidden machine-selected target -> participant`

### Core design

1. Define number set before the study, initially `{0,1}` or `{1,2,3,4}` for statistical sensitivity.
2. Define whether the target is generated before response, after state entry, or after response lock. These represent different hypotheses and must not be mixed.
3. Participant cannot access the target generator.
4. No target-aware human interacts with participant.
5. Participant produces raw response.
6. Raw response is timestamped and locked.
7. Exact number match is the preferred primary endpoint.
8. Target identity is revealed only after locking.

### Primary objective
Determine whether hidden machine-selected numbers can be identified above chance.

### Interpretation
Success supports a READ/perception or prediction hypothesis. It does not establish that the participant influenced the generator.

## EXP-004 — REQUEST / INFLUENCE / NUMBER SELECTION

### Architecture

`participant receives/precommits desired output -> communication/request protocol -> independent random system operates at predefined time T -> compare output with requested value`

### Primary MIP question
Can the participant request a specific machine outcome and obtain trial-specific correspondence above chance?

### Minimal binary design

1. System randomly assigns the requested value for each trial: `REQUEST 0` or `REQUEST 1`.
2. Requested value and target time T are cryptographically committed before generation.
3. Participant sees the requested value and performs the fixed Communication Session request protocol.
4. Participant has no physical or network access to the random device.
5. At exactly T, the independent random source produces one output.
6. Primary endpoint: `generated_value == requested_value`.
7. All trials remain in the dataset.
8. Interleave no-intention, sham-request, and mismatched-time controls.

### Why the requested value must vary

Always requesting `1` is methodologically weak because a device bias toward `1` could mimic success.

The stronger hypothesis is whether the random device follows the **trial-specific request**.

### Random source preference

For this influence/perturbation track, prefer:

1. quantum RNG;
2. hardware electronic-noise RNG;
3. independently characterized physical RNG;
4. CSPRNG as a separate comparison condition.

### Temporal-specificity requirement

Test whether correspondence is concentrated at intended time T rather than neighboring times.

Candidate windows:

- pre-window;
- target time T;
- post-window;
- matched sham time.

### Interpretation
Success supports an intention/request-correlated perturbation hypothesis. It does not by itself prove a MATRIX mechanism.

## EXP-005 — QUERY / TARGETED RESPONSE

### Architecture

`participant formulates constrained request/question -> response content captured -> response locked -> external verification`

### Goal
Determine whether requested response content can be distinguished from uncontrolled spontaneous imagery.

This is different from EXP-004 because EXP-004 uses an objective random-machine output as the response endpoint.

## EXP-006 — WRITE / TRANSFER

### Architecture

`sender payload -> unknown transfer path -> isolated receiver`

### Candidate payload classes

- geometric symbol;
- word category;
- 4- or 8-choice icon;
- short binary payload;
- affective state: JOY / CALM / FEAR / SADNESS.

### Important distinction
A sender->receiver effect does not by itself establish persistent storage in an external substrate.

## EXP-007 — STORE / RETRIEVE

### Architecture

`A encodes payload -> no receiver present -> delay -> B retrieves`

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

## EXP-008 — HANDSHAKE / BIDIRECTIONAL COMMUNICATION

### Architecture

A future version should combine independently validated READ and REQUEST components rather than assuming bidirectionality from one type of result.

Candidate architecture:

`request commitment -> independent system challenge/output -> participant response -> lock -> reveal`

### Initial challenge complexity

Start with high-sensitivity forced-choice formats before increasing information content:

- binary;
- 4-choice;
- 8-choice;
- 4-bit;
- 8-bit.

Do not begin with extremely high-entropy payloads that destroy statistical sensitivity.

## Historical protocol audit requirement

Before freezing EXP-003 or EXP-004, MIP must audit:

- Army `Remote Perturbation Techniques — Project Description and Experimental Protocol`;
- PEAR REG intention protocols;
- PEAR remote human/machine interaction protocols;
- SRI/government remote-perception methods;
- Schmidt-style RNG/PK protocols;
- relevant independent replications and null results.

The durable audit is maintained in:

- `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
- `research/PROTOCOL_FAMILIES_READ_VS_REQUEST.md`

Historical protocols may be modified. Every modification must be versioned and justified before outcome inspection where possible.

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

A physiological state change is not evidence of anomalous information transfer or influence. Analyze state induction and objective communication performance as separate hypotheses.

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
- random source is characterized;
- target/request generation is validated;
- response/request locking works;
- timing synchronization is validated;
- blinding rules are documented;
- exclusions are prespecified;
- scoring method is frozen;
- sample-size/sequential rule is defined;
- sham/control conditions are available;
- optional stopping is prohibited or formally modeled.
