# MIP First Operational Playbook v0.3

## Status

`ACTIVE EXPLORATORY OPERATIONAL BASELINE — IMMEDIATE HANDS-FREE REQUEST`

## Supersession

This file supersedes `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.2.md` for new first-use REQUEST sessions.

Version 0.2 remains historical project record.

The key v0.3 correction is that the first active profile now follows `IMMEDIATE_REQUEST` semantics with a hidden continuous machine stream around the request. The participant is not asked to track or wait for an absolute wall-clock target while altered.

---

# 1. Core session architecture

The first operational flow is:

`profile selection -> baseline fields -> requested state assignment -> participant-facing mapping -> memory confirmation -> commitment -> one START action -> eyes closed/hands free -> automated induction/audio/cues/hidden machine stream -> immediate request encoding -> release -> neutral observation -> automatic return cue -> participant return -> raw report -> lock -> reveal -> deterministic analysis`

After START, normal protocol progression requires no visual interaction and no button press until the participant has deliberately returned to ordinary orientation.

---

# 2. First profile assumptions

The first active profile uses:

- objective outcome space: binary `{0,1}`;
- request assignment: system-random uniform unless a separately selected block policy applies;
- participant-facing mapping: literal `0/1` initially;
- request encoding: `SER-A-V2` from `REQUEST_ENCODING_V0.2.md`;
- participant-facing timing: `IMMEDIATE_REQUEST`;
- machine output: hidden continuous stream before/during/after request;
- primary temporal region: predeclared request/immediate region from analysis plan;
- reveal: after raw-report lock for the first profile;
- active operation: hands-free.

These are profile choices, not permanent engine limits.

---

# 3. Pre-session setup

Before START:

1. use a quiet environment where practical;
2. disable or minimize notifications/calls;
3. verify correct headphone left/right orientation;
4. select a low comfortable listening level;
5. verify the selected audio recipe/preset;
6. verify the effective experiment profile passes validation;
7. record required baseline state fields;
8. allow the application to assign the objective requested state;
9. resolve its participant-facing mapping and encoding instructions;
10. display the target prominently;
11. participant confirms the target is memorized;
12. app snapshots/commits the complete effective configuration and hashes;
13. app presents one large `START SESSION` action.

If the participant cannot confidently retain the target, do not start the session.

---

# 4. Hands-free rule after START

After START and until deliberate return:

- no screen inspection is required;
- no target is re-shown;
- no user input is required for normal progression;
- the screen should be blank/non-informative/dimmed;
- hidden machine outcomes are never displayed;
- audio/stages/cues/timing are automated;
- machine telemetry is automated;
- every important stage/cue/timing event is logged;
- physical self-termination remains possible at any time.

A software stop control may exist as an optional convenience but is not required for safe termination.

---

# 5. Cue architecture

Use fixed nonsemantic cues configured and hashed/versioned with the session protocol.

The first baseline should have identifiable cues for at least:

- `CUE-A` — session/induction start;
- `CUE-B` — request-encoding start;
- `CUE-C` — release/neutral-observation transition;
- `CUE-D` — return sequence start.

Cues must:

- be identical across compared audio conditions unless the cue itself is the experimental variable;
- be audible but not startling;
- reveal no machine result;
- reveal no hidden condition assignment;
- be logged with scheduled and actual timing.

---

# 6. Standard first-use stage sequence

Exact durations are configuration values. The values below are the current recommended first profile, not hardcoded engine constants.

## Stage 1 — Passive settling — about 2 minutes

Eyes closed.

Allow breathing and body tension to settle.

Retain the assigned target passively without actively encoding it yet.

## Stage 2 — Attentional separation / conversion-box analogue — about 1–2 minutes

Set aside worries, expectation, desire for success, fear of failure, and unrelated thoughts.

Do not discard the assigned target; it remains the one task item retained for later use.

## Stage 3 — Slow resonant breathing/tuning analogue — about 3 minutes

Use slow comfortable breathing, approximately six relaxed breaths where comfortable.

No aggressive hyperventilation.

No forced color imagery.

## Stage 4 — Circulating-field / REBAL analogue — about 2–3 minutes

Sense or imagine a simple circulating flow around the body if natural.

No required color, literal physical-energy interpretation, or externally viewed body image.

Spontaneous color, pulse, rotation, or other effects are observations rather than required achievements.

## Stage 5 — Neutral orientation — about 30–60 seconds

Internal orientation may be equivalent to:

`I remain aware and in control. I will make one clear request and record what occurs exactly.`

## Stage 6 — Focus-10-style relaxation — about 5–7 minutes

Use progressive relaxation while preserving alert awareness.

A simple 1-to-10 internal count may be used.

At the end, the intended state is approximately:

`body deeply relaxed; mind awake`.

No claim is made that this is objectively identical to a historical Monroe state.

## Stage 7 — Fixed stabilization interval — about 2 minutes

Remain still and observe.

This is an automated fixed interval for the first baseline. The participant does not press a button to declare readiness.

Poor stabilization is reported after return rather than repaired by mid-session interaction.

At the configured end of this stage, the application emits `CUE-B` and the REQUEST region begins.

## Stage 8 — Semantic/goal request — about 20–30 seconds

Recall the pre-session assigned target.

For the first literal binary immediate profile, use the current `REQUEST_ENCODING_V0.2.md` semantics equivalent to:

`Make/favor the assigned system state now.`

The exact target-specific wording is defined by the request-encoding profile and mapping.

Recommended internal repetition: three times.

Do not use older absolute-clock wording in this immediate profile.

## Stage 9 — Simple representation — about 20–30 seconds

Represent the requested state using the configured encoding bundle.

Visual imagery is optional.

Permitted actual modalities include visual, internal verbal, kinesthetic, spatial, or abstract goal representation.

Do not build elaborate narrative scenes unless a later profile explicitly tests them.

## Stage 10 — Matched completion/certainty tag — about 10–20 seconds

Use a moderate feeling of completion/certainty associated with the assigned endpoint.

Keep intensity symmetric across `0` and `1`.

Do not intentionally escalate toward involuntary emotional/motor behavior.

## Stage 11 — Release — about 20–30 seconds

Stop actively forcing/repeating the request.

Internal transition may be:

`Released.`

At the configured end, emit `CUE-C`.

## Stage 12 — Neutral post-request observation

Remain eyes closed, relaxed, and hands-free.

Do not:

- repeat the request;
- inspect a clock;
- touch the device;
- predict the outcome;
- search for confirmation;
- count down.

The hidden machine stream is already being recorded according to the committed output/timing policy and continues through the predeclared post-request windows.

There is no participant-facing absolute target moment to wait for in the first immediate profile.

## Stage 13 — Continued observation / post-request period — about 1–2 minutes or configured duration

Continue neutral observation without deciding whether the request succeeded.

The exact end is determined by the session-protocol configuration.

## Stage 14 — Automatic return cue and deliberate return

Application emits `CUE-D`.

Participant deliberately returns:

- count from 10 down to 1 if useful;
- restore ordinary body awareness;
- move fingers/toes;
- normalize breathing;
- open eyes when ordinary orientation is restored;
- sit up when ready.

Only after return should the participant inspect the computer.

## Stage 15 — Participant return confirmation

The participant confirms ordinary orientation.

The application must still not reveal hidden machine results.

## Stage 16 — Raw report before reveal

Application opens the raw-report interface first.

Record, before outcome reveal:

- subjective time estimates;
- state quality/intensity;
- request representation modality;
- certainty/affect;
- spontaneous conflicting target/number/state;
- acknowledgement-like event;
- imagery/auditory/somatic/vestibular effects;
- interruptions;
- forgotten target;
- abort/termination;
- perceived success/failure belief;
- free raw notes.

Lock the report.

## Stage 17 — Reveal and deterministic report

Only after the configured reveal policy allows it may the application show:

- objective requested state;
- generated machine output/statistics;
- primary endpoint result;
- temporal analysis;
- integrity status;
- deterministic report.

For block-level reveal profiles, Stage 17 remains `REVEAL PENDING` until the block is locked.

---

# 7. Machine timeline for first immediate profile

The application must log the objective machine timeline separately from the participant-state timeline.

At minimum preserve:

- session commitment;
- START;
- audio start;
- hidden-stream start;
- every cue/stage transition;
- request cue/start/end;
- release start/end;
- all declared machine-output blocks;
- primary window boundaries;
- exploratory window boundaries;
- return cue;
- return confirmation;
- raw-report lock;
- reveal.

The analysis plan defines the primary request/immediate region before data inspection.

Exploratory onset/latency/persistence windows may describe temporal structure but may not replace the primary region post hoc.

---

# 8. Request forgotten

If the participant genuinely forgets the assigned target:

- do not substitute another value;
- do not guess;
- allow safe completion/termination;
- after return record `REQUEST_VALUE_FORGOTTEN=true`;
- preserve all machine/session data;
- apply only the prespecified analysis rule.

---

# 9. Abort / termination

The participant does not need software interaction to terminate.

Physical self-termination:

- open eyes;
- remove/lift headphones if desired;
- reorient;
- end active participation.

After return, mark the session accurately with reason/approximate time.

The application preserves the session as aborted/terminated and does not delete machine data.

---

# 10. Comparison discipline

When comparing audio conditions, keep constant unless explicitly manipulated:

- request assignment procedure;
- mapping;
- encoding profile;
- session protocol;
- stage durations;
- cue sounds/timing;
- machine output policy;
- timing analysis plan;
- reveal behavior;
- raw-report procedure.

Only intended variables should differ.

---

# 11. What this playbook does not establish

A successful trial or block does not by itself establish:

- causal influence;
- precognition;
- MATRIX;
- external agency;
- a unique audio mechanism.

A null result is valid data.

---

# 12. Future timing profiles

The engine must also support separately configured:

- next-eligible-output;
- fixed relative delay;
- absolute date/time;
- time windows;
- pre-generated hidden targets.

Those profiles use their own participant-facing timing semantics and analysis plans. Do not reuse this first immediate playbook wording without a new version/profile when the participant task materially changes.
