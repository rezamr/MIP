# MIP First Operational Playbook v0.2

## Status

`EXPLORATORY OPERATIONAL BASELINE — HANDS-FREE REVISION`

## Why v0.2 exists

Version 0.1 contained a practical error: it allowed the application to reveal the assigned request value after the participant had already entered the altered/communication state. The project owner correctly noted that, once deeply relaxed or in trance, checking a phone or computer would break the state and may be impractical.

Version 0.2 therefore makes the active session **hands-free and eyes-closed** from the moment state induction begins until the return stage is complete.

The requested value is assigned, displayed, memorized, confirmed, and cryptographically committed **before** state induction begins.

The application must not require the participant to inspect or touch a screen during the active session.

---

# Core hands-free rule

The active session architecture is:

`assign request -> show request -> participant confirms memory -> commit trial -> one START action -> eyes closed / hands free -> automated audio/cues/timing/output -> deliberate return -> raw report -> lock -> reveal`

After the participant presses START, no visual interaction is required until the session has ended and ordinary orientation has returned.

---

# Pre-session request assignment

Before headphones/state induction:

1. The app randomly assigns `0` or `1`.
2. The app displays the requested value in very large type.
3. The participant reads it and repeats it once aloud or internally.
4. The participant confirms: `I have memorized the requested value.`
5. The app stores and hashes the request commitment, target timing, protocol version, audio condition, RNG provider, and nonce.
6. The app then presents one large `START SESSION` control.
7. After START, the screen may dim/blank and must not be needed again during the session.

If the participant cannot confidently remember the assigned value before START, the trial must not begin.

For the binary baseline, a single memorized bit is intentionally chosen because it imposes minimal memory demand.

---

# Automated cue architecture

The app controls all session timing after START.

The first baseline should use a small set of fixed, nonsemantic audio cues mixed identically across all audio conditions.

Recommended cue set:

- `CUE-A`: session/state induction begins;
- `CUE-B`: REQUEST encoding begins;
- `CUE-C`: release/neutral-hold begins;
- `CUE-D`: return sequence begins.

The cues must:

- be identical across compared audio conditions;
- have fixed timing and level;
- be audible but not startling;
- not encode success/failure;
- never reveal the future machine output;
- be logged with exact timestamps.

No live outcome feedback is used in the first baseline.

A later protocol may compare spoken guidance, real feedback, sham feedback, or no cues as separate variables. Do not mix them into the first baseline.

---

# Standard session sequence

## Stage 0 — Setup and pre-session request assignment

Before entering the state:

- prepare quiet environment;
- disable notifications/calls;
- verify headphone left/right orientation;
- choose low comfortable listening level;
- record baseline alertness/fatigue/anxiety/concentration/emotional intensity;
- allow the app to assign `0` or `1`;
- memorize the value;
- confirm it once;
- verify that the app has committed the trial;
- press START exactly once.

From this point until the return stage is complete, do not inspect the screen.

## Stage 1 — Passive settling — 2 minutes

Eyes closed.

Do not think about the requested value yet beyond retaining it passively in memory.

Allow breathing and body tension to settle.

## Stage 2 — Energy Conversion Box analogue — 1–2 minutes

Set aside worries, desire for success, fear of failure, prior-session expectations, and guesses about the machine.

Do **not** place the assigned request value in the box; it remains the one task item retained for later use.

## Stage 3 — Resonant breathing/tuning — approximately 3 minutes

Use approximately six slow comfortable breaths.

No aggressive hyperventilation.

No forced color imagery.

## Stage 4 — REBAL / circulating-field analogue — 2–3 minutes

Sense or imagine a flow rising from the feet/lower body toward the head, moving outward and around the body, and returning downward toward the feet.

No required color, brightness, external viewpoint, or literal-energy interpretation.

Spontaneous color/pulse/rotation is observed, not forced.

## Stage 5 — Orientation statement — 30–60 seconds

Internal orientation:

`I remain aware and in control. I will make one clear request and record what occurs exactly.`

## Stage 6 — Focus-10-style relaxation — 5–7 minutes

Count from 1 to 10 while progressively relaxing the body and preserving alert awareness.

At 10:

`Body deeply relaxed; mind awake.`

## Stage 7 — Stabilization — 2 minutes

Remain still and observe the state.

The participant still does not look at any device.

At the end of this stage, the app plays `CUE-B`, indicating that REQUEST encoding now begins.

The requested value is recalled from the pre-session assignment.

## Stage 8 — Semantic request — approximately 20–30 seconds

For assigned value `1`:

`At the predefined target time, the system output is 1.`

For assigned value `0`:

`At the predefined target time, the system output is 0.`

Repeat internally three times.

No device interaction.

## Stage 9 — Symbolic encoding — 20–30 seconds

Represent only the memorized requested value.

If visual imagery is natural, use a simple numeral.

If imagery is difficult, use internal verbal, kinesthetic/spatial, or abstract representation.

Do not add elaborate scenes, people, vehicles, future-life imagery, or other narrative material.

## Stage 10 — Controlled affective tag — 10–20 seconds

Add a moderate feeling of certainty/completion associated with the requested value.

Do not deliberately intensify toward involuntary emotional or motor behavior.

## Stage 11 — Release — 20–30 seconds

Stop actively repeating or forcing the request.

Use the internal transition:

`Released.`

At the end of this stage the app plays `CUE-C`.

## Stage 12 — Neutral hold until target time

Remain eyes closed, relaxed, and hands-free.

Do not:

- inspect a clock;
- touch the device;
- repeat the request;
- guess the output;
- search for confirmation;
- count down to target time.

The app handles the machine event automatically at the committed target time.

The result remains hidden.

## Stage 13 — Post-target neutral period — 1–2 minutes

Remain still and observe any spontaneous change without assigning success/failure meaning.

## Stage 14 — Automated return cue and deliberate return

The app plays `CUE-D`.

The participant deliberately returns:

- count from 10 down to 1;
- restore normal body awareness;
- move fingers/toes;
- normalize breathing;
- open eyes only after ordinary orientation is restored;
- sit up when ready.

Only after this stage may the participant inspect the device.

## Stage 15 — Raw report before reveal

The application must open directly to the raw-report page without showing the machine outcome.

Record the full phenomenology, exact request used, representation modality, certainty, affect intensity, spontaneous conflicting numbers/images, perceived acknowledgement, interruptions, and any termination/adverse event.

Then lock the raw report.

## Stage 16 — Reveal

Only after raw-report lock does the app reveal the machine output and calculated endpoints.

---

# Abort / termination behavior

The participant must not be required to interact with the screen to stop an uncomfortable session.

Immediate physical self-termination always takes priority:

- open eyes;
- remove or lift headphones if desired;
- sit up/reorient when safe;
- end the session.

After returning to ordinary orientation, mark the trial as `ABORTED / TERMINATED` in the app and record the reason/time as accurately as possible.

A later app version may add an optional local voice-recognition or tactile hardware stop mechanism, but this is not required for the first build and must not be relied upon for safety.

---

# Memory integrity rule

The participant must know the assigned request value before state induction.

For the initial binary protocol, do not introduce a second task item that competes with memory of the assigned bit.

If, during the session, the participant genuinely forgets which value was assigned, do not guess or substitute a value. Complete/terminate the session without request encoding and mark:

`REQUEST_VALUE_FORGOTTEN = true`.

Such a trial is preserved but excluded from the primary REQUEST-performance endpoint according to a prespecified exclusion rule.

---

# Comparison rule

All compared audio conditions must use the same:

- pre-session assignment procedure;
- cue sounds;
- cue timing;
- request encoding timings;
- target timing;
- no-screen/no-touch rule;
- post-session report procedure.

Only the intended experimental variable may differ.

---

# Supersession note

For active hands-free Communication Sessions, this file supersedes the device-interaction wording in `MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.1.md`.

Version 0.1 remains preserved as project history.