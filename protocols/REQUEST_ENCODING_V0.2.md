# MIP REQUEST Encoding Protocol v0.2

## Status

`ACTIVE FIRST-USE REQUEST ENCODING PROTOCOL`

## Supersession

This file supersedes `protocols/REQUEST_ENCODING_V0.1.md` for new first-use MIP REQUEST sessions.

Version 0.1 remains project history.

The major correction is timing language: the current first participant baseline uses `IMMEDIATE_REQUEST` semantics and a continuous hidden machine stream. The participant is not required to hold or estimate an absolute wall-clock target time while altered.

## Purpose

Define a reproducible first request-encoding method while preserving strict separation between:

- objective requested machine state;
- participant-facing label/mapping;
- internal representation;
- timing semantics;
- objective scoring endpoint.

Operational terms such as `request`, `encode`, `send`, and `release` describe the participant task. They do not establish that MATRIX or any external mechanism exists.

---

# 1. First baseline target class

Initial objective outcome space:

`{0,1}`

The requested objective state is normally assigned by the experiment controller using the configured request-assignment policy.

The first literal mapping may display `0` and `1`, but the engine must not hardcode literal digits because later profiles may use arbitrary mappings.

---

# 2. Timing semantics are supplied by the experiment profile

The encoding protocol does not contain one universal wall-clock sentence.

The active experiment profile supplies one versioned timing semantic.

For the first operational profile:

`IMMEDIATE_REQUEST`

Participant-facing meaning:

`Make/favor the assigned system state now.`

For future profiles, the same encoding components may be combined with separately versioned semantics such as:

- next eligible output;
- relative delay;
- absolute time;
- fixed window;
- no explicit time.

Do not silently reuse immediate wording for a delayed profile or fixed-time wording for an immediate profile.

---

# 3. Hands-free rule

The requested state/participant-facing label is assigned, displayed, memorized, confirmed, and committed **before** active induction begins.

After START:

- no screen interaction is required;
- no request value is re-shown;
- no participant button press is required to announce state stabilization;
- protocol timing and cues advance automatically;
- the participant recalls the pre-session target at the request cue.

If the participant forgets the target, do not guess or substitute. Preserve the session and record `REQUEST_VALUE_FORGOTTEN=true` after return.

---

# 4. Primary encoding bundle

Identifier:

`SER-A-V2`

Components:

1. **Semantic/goal lock**
2. **Simple representation**
3. **Matched completion/certainty tag**
4. **Release**
5. **Neutral observation**

These components are experimental operational choices, not established mechanisms.

---

# 5. Stage A — Semantic/goal lock

At the request cue, recall the assigned participant-facing target and the intended objective endpoint.

For the literal binary mapping under the immediate profile, participant-facing wording should be equivalent to:

- `Make/favor system state 1 now.`
- `Make/favor system state 0 now.`

The application may display the exact wording before START as part of the encoding instructions, but does not need to speak or show the target during the active session.

Recommended internal repetition:

`3 times`

Rules:

- one target only;
- no bargaining;
- no alternative target;
- no changing the request after commitment;
- no attempt to predict what the machine will do;
- wording must be recorded by encoding-profile version.

For arbitrary mappings, the instruction must bind the participant-facing representation to the precommitted objective state according to the mapping/encoding profile rather than assuming the literal digit has special status.

---

# 6. Stage B — Simple representation

Initial literal binary bundle may use:

### Objective state 1

- semantic label: one/state 1;
- simple visual form if natural: upright stroke/numeral;
- simple kinesthetic form if natural: straight/upward;
- endpoint concept: machine in objective state 1.

### Objective state 0

- semantic label: zero/state 0;
- simple visual form if natural: closed loop/numeral;
- simple kinesthetic form if natural: closed/circular;
- endpoint concept: machine in objective state 0.

The participant is not required to visualize.

Allowed actual modalities include:

- visual;
- internal verbal;
- kinesthetic;
- spatial;
- abstract/goal-state representation.

Record the modality used after return.

Recommended configured duration:

`20–30 seconds`

---

# 7. Stage C — Matched completion/certainty tag

Associate the requested endpoint with a controlled, moderate sense of completion/certainty.

The two objective states must use matched affective intensity. Do not make `1` positive and `0` negative.

Initial recommended ceiling:

`6/10`

Recommended configured duration:

`10–20 seconds`

Do not deliberately escalate toward loss of voluntary control or an extreme affective episode.

Affective tagging remains an experimental component to isolate later.

---

# 8. Stage D — Release

Stop actively repeating/forcing the request.

Internal transition may be:

`Released.`

Recommended configured duration:

`20–30 seconds`

After release:

- do not repeat the request unless the selected encoding profile explicitly requires it;
- do not count down to a target;
- do not search for success confirmation;
- do not guess the machine outcome.

---

# 9. Stage E — Neutral observation

Remain in the session state until the configured return cue.

For the first immediate profile, the hidden machine stream continues during this period according to the predeclared temporal windows.

The participant does not need to know exact sample times.

Spontaneous experiences are observed and reported later without being treated as objective success/failure during the session.

---

# 10. First immediate temporal relationship

For `BASELINE_NOW_BINARY_V1`:

- hidden machine stream begins before request cue;
- request cue defines the beginning of the participant request region;
- request/encoding and release anchors are logged exactly;
- stream continues after release;
- primary analysis region is frozen by the analysis plan before inspection;
- neighboring windows are exploratory temporal-characterization regions.

A later favorable window may not replace a failed primary region after the fact.

---

# 11. Future encoding variants

The engine must support separately versioned encoding configurations such as:

- semantic/goal only;
- visual/symbol only;
- kinesthetic only;
- completion/certainty only;
- semantic + symbol;
- combined without release;
- full combined with release;
- arbitrary-label mapping;
- reversed mapping;
- physical-state A/B representation;
- repeated request;
- feedback variants.

Only one major encoding variable should change at a time when comparison design permits.

---

# 12. Post-session REQUEST fields

Before reveal, record at minimum:

1. participant-facing target remembered;
2. whether target was forgotten at any point;
3. representation modality actually used;
4. representation clarity 0–10;
5. affect intensity 0–10;
6. certainty/completion intensity 0–10;
7. whether exact configured wording was followed;
8. urge to change target, if any;
9. spontaneous conflicting label/number/state, if any;
10. acknowledgement-like experience, if any;
11. perceived agency/source, if any;
12. interruptions;
13. termination/abort;
14. subjective belief of success before reveal.

The raw description is phenomenological data. Objective REQUEST scoring uses the independently generated machine output under the declared analysis plan.

---

# 13. Safety/termination

Physical self-termination always takes priority.

If necessary:

- open eyes;
- remove/lift headphones;
- reorient physically;
- return to ordinary awareness.

The participant is not required to operate software while altered in order to terminate safely.

After return, record the termination time/reason as accurately as practical.

A terminated trial remains in the dataset.

---

# 14. Interpretation rule

A vivid sense that the request was accepted is an observation about subjective experience.

It is not the REQUEST performance endpoint.

A machine correspondence contributes to the objective endpoint only under the frozen outcome-space, timing, scoring, and exclusion rules.

Neither a single hit nor a significant block result identifies a unique mechanism by itself.
