# MIP Human Encoding and Outcome Mapping Requirements v0.1

## Status

`ACTIVE ENGINEERING REQUIREMENT — MECHANISM UNKNOWN`

## Purpose

The MIP software must not assume that a hypothesized MATRIX literally understands written digits, words, colors, symbols, clock notation, or feelings. It also must not assume that only affect matters.

The application must preserve a strict separation between the objective machine state and the participant's representation of that state so later experiments can test which representation, if any, matters.

This requirement operationalizes the research distinction documented in `research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md`.

---

# Required conceptual separation

The engine must treat the following as independent versioned objects:

1. **Objective outcome space** — the machine states that can actually be generated and scored.
2. **Participant-facing label/mapping** — what the participant is shown before the session.
3. **Internal request-encoding profile** — how the participant is instructed to represent the requested state internally.
4. **Scoring endpoint** — how objective machine output is compared with the requested objective state.

The application must never infer that these four layers are equivalent merely because the first baseline uses the labels `0` and `1`.

---

# Configuration registries

Add versioned registries for at least:

```text
data/config/
  outcome_spaces/
  outcome_mappings/
  request_encoding_profiles/
```

The exact directory naming may vary if the same separation is preserved.

Every committed session must contain an immutable snapshot and hash of the effective outcome space, mapping, and request-encoding profile.

---

# Outcome mapping object

An outcome mapping converts objective machine states into participant-facing representations.

Example:

```json
{
  "id": "BINARY_LITERAL_LABELS_V1",
  "schema_version": 1,
  "outcome_space_id": "BINARY_01_V1",
  "entries": {
    "0": {"display_label": "0"},
    "1": {"display_label": "1"}
  }
}
```

Later mappings must support arbitrary finite labels, for example:

```json
{
  "id": "BINARY_COLOR_MAPPING_V1",
  "schema_version": 1,
  "outcome_space_id": "BINARY_01_V1",
  "entries": {
    "0": {"display_label": "GOLD"},
    "1": {"display_label": "BLUE"}
  }
}
```

A reversed mapping must be creatable as a new configuration version without source-code changes.

Do not silently alter an existing mapping that has been used in a committed session.

---

# Request-encoding profile

A request-encoding profile describes what the participant is instructed to do with the assigned target after entering the designated state.

It must be data-driven and support independently configurable components such as:

- semantic label or sentence;
- visual form;
- kinesthetic/spatial form;
- endpoint/goal-state concept;
- affective tag description;
- affective intensity target or ceiling;
- repetition count;
- encoding duration;
- release instruction;
- notes/provenance/status.

The software is not required to prove or interpret any of these as a mechanism. It only preserves a reproducible protocol.

---

# First binary symmetric multimodal profile

Ship a first encoding profile corresponding to the current MIP baseline.

## Objective state `1`

Participant-facing components:

- semantic label: `one` / the assigned state called `1`;
- simple visual representation: upright stroke/numeral `1` if visualization is natural;
- kinesthetic representation: simple straight/upward movement or directional sense;
- endpoint concept: `the machine is in the objective state designated as 1`;
- affective tag: neutral-to-moderate completion/certainty;
- affective intensity: matched to state `0`, not stronger because `1` is culturally positive.

## Objective state `0`

Participant-facing components:

- semantic label: `zero` / the assigned state called `0`;
- simple visual representation: closed loop/numeral `0` if visualization is natural;
- kinesthetic representation: simple closed/circular movement or closure sense;
- endpoint concept: `the machine is in the objective state designated as 0`;
- affective tag: the same neutral-to-moderate completion/certainty;
- affective intensity: matched to state `1`.

The request sequence remains conceptually:

`semantic target -> simple representation -> simple kinesthetic/goal representation -> matched completion/certainty -> release`

The participant may use a nonvisual path if imagery is weak. The modality actually used is reported after return.

---

# Timing-aware request wording

The encoding profile must be able to parameterize request wording from the selected timing policy rather than hardcode one sentence.

Examples:

- immediate: `Make the system output/favor X now.`
- next eligible output: `Make the next eligible system output X.`
- relative delay: wording/documentation appropriate to the configured relative target;
- absolute date/time: wording/documentation appropriate to the configured committed date/time;
- window: `During the declared window, favor X.`

For the first active profile, participant-facing time is immediate/`now`; exact machine time remains internal and authoritative.

---

# Required future encoding comparisons

The engine must be able to express these using configuration where existing primitives are sufficient:

1. semantic label only;
2. visual numeral/shape only;
3. kinesthetic/gestalt only;
4. completion/goal-state only;
5. semantic + visual;
6. full symmetric multimodal bundle;
7. arbitrary symbol/color-to-machine-state mapping;
8. reversed arbitrary mapping;
9. participant-facing `STATE A` / `STATE B` labels with no numeric semantics;
10. physical-state-oriented labels where `0/1` exist only as analysis/database labels.

The application must not require source-code modifications merely to reverse or replace labels in a finite mapping.

---

# Pre-session user interface

Before commitment and START, the application must show the participant exactly:

- the assigned participant-facing target label;
- the relevant internal encoding instructions for that target;
- any timing language required by the chosen timing policy;
- a clear memory-confirmation action.

The objective machine value may be shown or hidden according to the mapping experiment design. For the literal first baseline it can be shown because label and objective state are intentionally identical.

For arbitrary-mapping experiments, the UI must follow the profile's blinding policy and must never expose hidden information not intended for the participant.

---

# Session logging

Log and hash at minimum:

- objective requested machine state;
- participant-facing label/mapping ID and version;
- request-encoding profile ID and version;
- exact rendered/request instruction snapshot;
- mapping entries effective for the trial;
- memory confirmation event;
- request cue/start/end/release timing;
- post-session representation modality actually used;
- symbol/representation clarity;
- affect intensity;
- certainty;
- any conflicting spontaneous target/label;
- forgotten-request flag;
- any protocol deviation.

---

# Analysis rule

The primary objective endpoint is always calculated against the precommitted objective requested machine state, not against an after-the-fact interpretation of imagery or feeling.

Any comparison between encoding profiles or mappings is a separate analysis factor and must preserve all misses and controls.

No arbitrary symbol may be considered a match through semantic similarity, color similarity, or subjective reinterpretation unless a separate exploratory rule was declared before the data were inspected.

---

# Acceptance tests

The implementation is incomplete unless all of the following can be done without modifying engine source code:

1. keep objective states `{0,1}` but replace visible `0/1` with arbitrary labels;
2. reverse the arbitrary label mapping;
3. switch from the full multimodal encoding bundle to semantic-only;
4. switch from semantic-only to kinesthetic-only;
5. keep the same mapping while changing timing policy;
6. retain and verify old session mapping/encoding snapshots after new mappings are created;
7. prove that scoring still uses the objective requested state rather than the participant-facing label string.

---

# Interpretation rule

The application is a protocol controller and recorder. It must never state that a successful result proves that MATRIX understands a symbol, feeling, gestalt, intention, or goal. Those are competing experimental hypotheses to be tested through controlled mapping and encoding comparisons.