# MIP Immediate Request Timing v0.1

## Status

`DESIGN DECISION — PRE-CODEX FREEZE CANDIDATE`

## Purpose

The first MIP REQUEST baseline should not require the participant, while deeply relaxed or in trance, to understand or estimate an absolute clock time. The participant may experience substantial subjective time distortion, so participant-facing timing language must be relative and simple.

Machine timing remains exact and fully logged.

## Core distinction

Separate two concepts:

1. **Participant-facing request timing** — what the participant means during the session.
2. **Machine timing** — exact timestamps, windows, and output events recorded by the application.

For the first baseline, remove absolute clock-time language from the participant's request.

Preferred participant-facing semantics:

- `Make the system output X now.`
- or `Make the next eligible system output X.`

The participant does not need to know seconds, minutes, or wall-clock time.

## Why

A participant can experience strong subjective time compression or expansion during altered-state work. Therefore a phrase such as `at 10:15` or `in five minutes` may be cognitively inappropriate even though the computer can still measure those intervals precisely.

Subjective time distortion is itself a session variable and must be recorded after return before the participant checks actual elapsed time.

## First baseline target class

MIP is **not permanently limited to numbers**.

However, the first operational baseline remains binary because `0/1` provides:

- minimal memory burden;
- unambiguous scoring;
- clean comparison with historical binary perturbation work;
- high sensitivity to small directional effects;
- simple randomization and controls.

Later stages may use larger exact outcome spaces, arbitrary symbols, labels, tokens, or semantic mappings after the basic channel is stable.

## Immediate-request architecture

The application continuously records a hidden machine-output stream around the request period.

Recommended structure:

1. Begin hidden baseline stream before the request cue.
2. Play the fixed request cue.
3. Participant makes one immediate request for the memorized value.
4. Continue the hidden stream through the request and after release.
5. Preserve exact timestamps for every output or fixed output block.
6. Reveal nothing until the raw report is locked.

The participant should not need to know when the machine samples individual outputs.

## Primary and exploratory windows

The analysis plan must define all windows before data are inspected.

At minimum preserve:

- pre-request baseline window;
- request window;
- immediate post-request window;
- later post-request windows.

The first baseline should treat the **request/immediate window** as the primary timing region.

Neighboring windows are used to estimate onset, latency, persistence, and decay. A later successful window may not be substituted post hoc for a failed primary window.

## Single-output companion endpoint

If an intuitive one-value endpoint is retained, define it relative to the request/release cue rather than an absolute clock time.

Example:

`first predeclared eligible output after request completion`

The exact implementation delay is machine-controlled, fixed before the block, and hidden from the participant.

## Suggested participant script

For requested `1`:

`Make the system output one now.`

For requested `0`:

`Make the system output zero now.`

A later semantic-comprehension experiment may compare this against phrases such as `make the next output one` or requests without explicit temporal language.

Do not mix these wording variants in the first frozen block.

## Subjective-time record

Before the participant checks any clock after return, collect:

- estimated total session duration;
- estimated duration from request cue to return cue;
- whether time felt compressed, expanded, discontinuous, or ordinary;
- confidence in the estimate.

Then reveal actual machine-recorded duration separately.

Subjective time is a phenomenological/state measure. It must not replace machine timestamps for outcome analysis.

## Consequence for application design

The application must support:

- continuous hidden stream logging before/during/after request;
- exact cue timestamps;
- request-window and immediate-post-window definitions;
- relative event timing rather than requiring participant-facing wall-clock target time;
- post-session subjective-duration capture before displaying actual elapsed time;
- deterministic onset/change analysis across predeclared windows;
- optional later fixed-delay and absolute-time modes, but not as the default first baseline.

## Current decision

For the first practical MIP baseline:

- participant-facing absolute target time: `REMOVED`;
- participant request semantics: `NOW / NEXT ELIGIBLE OUTPUT`;
- machine timestamps: `RETAINED AND REQUIRED`;
- binary `0/1`: `FIRST BASELINE ONLY, NOT PERMANENT LIMIT`;
- continuous pre/request/post stream: `REQUIRED`;
- subjective time distortion: `REQUIRED POST-SESSION VARIABLE`.
