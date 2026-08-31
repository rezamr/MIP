# MIP Mobile Local Installation Requirements v0.1

## Purpose

The active-session application must work locally on an Android phone without requiring a cloud service or remote server.

The current Node-on-localhost desktop concept is not sufficient as the only deployment path because a participant may want the phone itself to run the complete session while offline.

## Required deployment architecture

Use one shared web application and research core where practical, with two local deployment targets:

1. Desktop/local-computer mode.
2. Android installable application mode.

The Android build must package the application so it runs entirely on-device after installation.

## Android requirements

Preferred packaging approach:

- local web user interface packaged in an Android shell such as Capacitor or an equivalently auditable wrapper;
- no remote web server required for normal use;
- local filesystem storage for JSON/JSONL/session audio;
- application-private data directory by default;
- explicit export function for copying a session bundle to user-selected storage;
- offline audio synthesis/playback;
- exact local scheduling while the active session is open;
- screen may dim/blank while audio/timing continue;
- prevent ordinary screen sleep from silently stopping an active session where platform APIs permit;
- keep all hidden results inaccessible in normal participant flow until reveal state;
- no analytics or cloud synchronization.

## Storage

Preserve the same logical structure as desktop:

- config;
- sessions;
- calibration;
- audio;
- exports.

All durable research data remain JSON/JSONL plus generated audio and hashes. Do not introduce a SQL/NoSQL database merely for mobile packaging.

## Import/export

The phone application must support:

- export one complete session as a directory/archive with all JSON/JSONL/audio/hashes;
- export a complete block of sessions;
- import a valid previously exported bundle without modifying its original hashes;
- integrity verification after import/export.

## Installation deliverables

Codex must produce:

- clear Android build instructions;
- a development install path using USB/debug installation;
- a signed-release build procedure for later personal installation;
- documentation of minimum Android version actually tested;
- documentation of permissions requested and why;
- no unnecessary internet permission if the application does not need networking.

## Local-first privacy

The application must not require:

- account creation;
- cloud login;
- remote API;
- network connectivity;
- telemetry.

## Session reliability tests on phone

Test at minimum:

- hands-free session completes with screen dimmed;
- audio continues for full duration;
- cue timing is preserved;
- target generation happens on schedule;
- session files are written correctly;
- app survives ordinary orientation changes or locks orientation during active session;
- incoming notifications are not required for protocol operation;
- result remains hidden before raw-report lock;
- export bundle hash verification passes.

## Progressive-web-app note

An installable browser version may be provided as a convenience, but it must not be the only mobile path if browser storage/background/audio restrictions make timing or filesystem guarantees weaker than the packaged Android build.
