# MIP Deployment Scope Decision v0.1

## Decision

The first implementation must remain deliberately small and easy to debug.

The active deployment target is a **local-computer application only**.

The Android/mobile-installation work introduced in the earlier v0.4 implementation prompt is **deferred** and is not part of the current build.

## Current transport model

For the first real tests:

- the research application runs on the local computer;
- the participant interacts with it only before session start and after ordinary return;
- Bluetooth may be used as the normal operating-system audio path to headphones;
- the application does not implement its own Bluetooth communication/control protocol;
- no phone application is required;
- no phone installation or mobile packaging is required.

If future operation requires a phone as a controller, that must be designed as a separate later deployment layer after the research core is stable.

## Reason

The research core already contains several high-value components that require careful testing:

- exact/configurable audio synthesis;
- Audio Lab and quick playback;
- hands-free session timing;
- random-source behavior;
- stream telemetry;
- temporal analysis;
- objective-state vs participant-representation mapping;
- immutable logging;
- lock/reveal behavior;
- deterministic analytical reporting.

Adding Android packaging or a custom Bluetooth control channel now would increase implementation and debugging surface without improving the first scientific test.

## Active implementation prompt

Use:

`engineering/CODEX_PROMPT_REQUEST_APP_V0.7.md`

Earlier implementation prompts and mobile requirements remain preserved as project history but are not active requirements for the current implementation.