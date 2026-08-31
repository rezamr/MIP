# MIP Hands-Free Session Requirements v0.1

## Purpose

The participant may be deeply relaxed or in trance during the active Communication Session and must not be expected to inspect or operate a phone/computer after state induction begins.

This file adds mandatory hands-free behavior to the MIP request application.

## Mandatory pre-session flow

Before active induction begins, the app must:

1. assign the requested value/token;
2. display it clearly;
3. require explicit participant confirmation that it has been memorized;
4. create the commitment and hashes;
5. present one final START action;
6. after START, enter hands-free session mode.

## Mandatory hands-free behavior

After START and until return is complete:

- no visual interaction is required;
- no button press is required for normal protocol progression;
- the screen should dim/blank or show a non-informative state;
- hidden outcomes must never be displayed;
- all timing proceeds automatically;
- target generation proceeds automatically;
- protocol-stage transitions are signaled only by fixed nonsemantic audio cues in the first baseline;
- cues must be identical across compared audio conditions;
- all cue times are logged.

## Cue requirements

Use configurable cue assets or deterministic generated cue tones for:

- induction start;
- request-encoding start;
- release/neutral-hold transition;
- return sequence start.

Cue files/parameters must be hashed/versioned.

Do not use cues that reveal hit/miss, output value, control condition, or future target.

## Pre-session requested value

The requested value is known before trance/state induction.

Do not reveal or change the requested value during the active session.

If the participant forgets the value, the trial is preserved and marked as a forgotten-request protocol failure rather than guessed.

## Post-session flow

After the automatic return cue and participant return:

1. show the raw-report interface first;
2. do not show any output/result;
3. allow the participant to complete and lock the raw report;
4. only then permit reveal according to the configured reveal policy.

## Abort behavior

The software must not assume the participant can operate the device while altered.

Physical self-termination may occur without software interaction. The participant can later mark the trial as aborted/terminated and enter the approximate event time/reason.

Optional future support may include a local voice or tactile stop control, but this must not be required for v0.x safety.

## Testing requirements

Automated or manual tests must confirm:

- requested value is assigned before START;
- request cannot change after commitment;
- no requested-value screen is required after START;
- target generation occurs without user interaction;
- cue schedule is deterministic and logged;
- output remains hidden throughout the active session;
- post-session screen opens to raw report, not reveal;
- reveal is impossible before raw-report lock;
- forgotten-request and aborted states are preserved.