# MIP REQUEST Encoding Protocol v0.1

## Purpose

This protocol defines the first standardized method for encoding a desired binary outcome during a MIP Communication Session.

Operational language such as `inject`, `encode`, `request`, or `send` describes the participant's task. It does not establish that a MATRIX, external agent, or nonlocal substrate exists.

The purpose is to make the request procedure reproducible enough that different audio conditions and later protocol variants can be compared without changing the request method at the same time.

---

## Primary target class

Initial alphabet:

- `0`
- `1`

The requested value should normally be assigned by the experiment controller rather than always chosen by the participant. This prevents a fixed device bias toward one value from mimicking request success.

Example:

`REQUESTED_VALUE = 1`

`TARGET_TIME_UTC = 2026-09-01T02:00:00Z`

---

## Core principle

The initial request-encoding method combines four deliberately separable components:

1. **Semantic definition** — exactly what outcome is requested.
2. **Symbolic representation** — a simple stable representation of `0` or `1`.
3. **Affective/intention tag** — a controlled feeling of certainty/importance associated with the requested outcome.
4. **Release** — stop actively manipulating the representation after the encoding interval.

These components are derived from a combination of Gateway Patterning-style instructions, the project owner's spontaneous affective-transmission strategy in S0002, and modern experimental-control requirements.

They are `RECONSTRUCTED / EXPERIMENTAL`, not proven communication mechanisms.

---

# Pre-session commitment

Before state induction begins, the controller must create and preserve:

- session ID;
- trial ID;
- requested value;
- target generation time;
- audio condition ID;
- request protocol version;
- random-source type;
- control/sham status;
- nonce;
- SHA-256 commitment hash.

The participant may know:

- requested value;
- target time;
- session instructions.

The participant must not know:

- future machine output;
- hidden control labels when blinding is possible;
- any entropy or random seed used by the output generator.

---

# Standard request sequence

## Step 1 — State stabilization

Enter the currently assigned communication-state protocol.

Do not begin request encoding until the participant judges the state sufficiently stable to proceed.

Record:

- request-stage start time;
- state intensity 0–10;
- alertness 0–10;
- perceived control 0–10.

---

## Step 2 — Semantic lock

Use one short, fixed sentence.

For initial binary tests:

`At the predefined target time, the system output is [X].`

where `[X]` is `0` or `1`.

Rules:

- no extra explanation;
- no alternative outcomes;
- no bargaining language;
- no changing the request after encoding starts;
- exact wording must be logged.

The phrase may be repeated internally three times at a slow, natural pace.

---

## Step 3 — Symbolic encoding

Represent only the requested bit.

Recommended initial representations:

- `1` = simple upright numeral `1`;
- `0` = simple circular numeral `0`.

Do not add color, animation, location, or elaborate scenes in v0.1 unless those are later isolated as experimental variables.

If visual imagery is difficult, the participant may use a nonvisual representation:

- kinesthetic sense of the number;
- internal verbal label;
- spatial form;
- abstract certainty.

The modality used must be logged.

Encoding interval:

`20–30 seconds` initial target.

Do not force visual imagery when it does not arise naturally.

---

## Step 4 — Controlled affective tag

Associate the requested outcome with a clear but controlled feeling of:

- certainty;
- completion;
- recognition that this is the intended outcome.

Initial intensity ceiling:

`6/10`.

Do **not** intentionally reproduce or escalate the extreme involuntary affective episode reported in S0002.

Affective tagging is included because the participant spontaneously used emotional-state transmission in S0002 and Gateway Patterning material places emphasis on feeling/intention, but MIP has not established that stronger emotion improves objective performance.

Duration:

`10–20 seconds`.

Record actual affect intensity after the session.

---

## Step 5 — Release

After semantic + symbolic + affective encoding:

- stop repeating the sentence;
- stop actively forcing the symbol;
- do not keep checking whether the request is working;
- allow the representation to fade or remain without active manipulation.

Initial release interval:

`20–30 seconds`.

This component has a historical analogue in Gateway Patterning instructions that emphasize releasing a completed pattern rather than repeatedly reworking it.

MIP treats this as a protocol component to test, not as a metaphysical rule.

---

## Step 6 — Neutral hold until target time

After release:

- remain in the session state;
- do not repeat the request unless the protocol version explicitly requires repetition;
- do not attempt to predict the machine output;
- avoid checking clocks if timing is automated;
- do not receive live outcome feedback in the primary fixed-time REQUEST protocol.

This separation is designed to reduce the historical ambiguity between intentional influence and participant selection/precognition of a favorable sequence.

---

# Primary v0.1 encoding bundle

Abbreviation:

`SER-A`

Meaning:

`Semantic + simple Symbol + controlled Emotion/Affect + Release`

Sequence:

`SEMANTIC 3x -> SYMBOL 20–30s -> AFFECT 10–20s -> RELEASE 20–30s -> NEUTRAL HOLD`

This must remain fixed while the first audio-frequency comparison is performed.

---

# Future encoding variants

Do not mix these into the first comparison block. They are later experimental variants:

- `SER-S` — semantic only;
- `SER-V` — symbol/visual only;
- `SER-AF` — affect only;
- `SER-SV` — semantic + symbol;
- `SER-SVA` — semantic + symbol + affect, no release;
- `SER-A` — full v0.1 combined protocol;
- repeated-request variant;
- real-feedback closed-loop variant;
- sham-feedback variant;
- no-feedback fixed-time variant.

Only one major request-encoding variable should change at a time whenever possible.

---

# Safety and stop conditions

Stop or terminate the active encoding stage if any of the following occur:

- perceived voluntary control drops sharply;
- involuntary motor/emotional behavior escalates;
- distress exceeds a predefined personal threshold;
- intense dizziness, near-fainting, or inability to reorient occurs;
- audio becomes uncomfortable or painful;
- the participant cannot execute the termination command.

Recommended command:

`END SESSION`

A stopped trial remains in the dataset and must not be silently removed.

---

# Post-session questions specific to REQUEST encoding

Record:

1. Exact requested value.
2. Exact semantic phrase used.
3. Representation modality used.
4. Symbol clarity 0–10.
5. Affect intensity 0–10.
6. Certainty 0–10.
7. Whether the request felt self-generated, released, externally interactive, or unknown.
8. Whether any acknowledgement-like event was perceived.
9. Raw description of any acknowledgement before interpretation.
10. Whether the participant felt an urge to change the requested value.
11. Whether the participant believed the machine outcome before reveal.
12. Whether any spontaneous image/number appeared that conflicted with the request.
13. Whether the session was interrupted.
14. Whether termination was used.

Machine output must remain hidden until the response/session record is locked when the protocol requires blinding.

---

# Interpretation rule

A vivid feeling that the request was accepted is a phenomenological observation.

Only objective machine correspondence contributes to the REQUEST performance endpoint.

A successful REQUEST trial does not by itself determine the mechanism.
