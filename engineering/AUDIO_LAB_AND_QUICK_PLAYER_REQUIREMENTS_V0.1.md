# MIP Audio Lab and Quick Player Requirements v0.1

## Status

`ACTIVE ENGINEERING REQUIREMENT`

## Purpose

MIP needs an easy audio-generation and listening area that is separate from committed research-session execution.

The user must not have to manually calculate left/right frequencies for ordinary binaural conditions. The application should provide one-click presets, a one-number quick mode, a simple custom mode, and an advanced custom mode while preserving exact deterministic synthesis, validation, versioning, manifests, and hashes.

The Audio Lab is for auditioning, tuning, engineering validation, and creating reusable audio recipes. It is **not** a substitute for the committed research-session audio path.

---

# Critical separation: Audio Lab vs Research Session

## Audio Lab

The Audio Lab may:

- start playback manually;
- play continuously without a predetermined end time;
- pause;
- resume;
- stop;
- change parameters before starting a new playback state;
- audition presets or custom recipes;
- save a configuration as a versioned audio recipe.

Audio Lab playback is exploratory engineering activity and must not silently become part of a committed participant session.

## Research Session audio

Once a research session is committed:

- the audio recipe is frozen in the session configuration snapshot;
- all synthesis parameters are frozen;
- the generated/session audio manifest is hashed;
- playback follows the selected session protocol automatically;
- the participant does not manually alter audio parameters during the active hands-free session;
- an unsaved temporary Audio Lab state may never be silently used as research-session audio.

To use an Audio Lab configuration in an experiment, the user must explicitly save/version it as an audio recipe and then select that recipe/profile before commitment.

---

# Audio Lab user interface

Provide four levels of use.

## 1. One-click presets

The first screen must prominently expose the three initial MIP conditions without requiring any manual left/right entry.

### `A-U396-4`

Status: user experimental baseline / current documented reconstruction.

Easy-mode inputs/derived values:

- center/base: `396 Hz`;
- binaural difference: `4 Hz`;
- left: automatically `394 Hz`;
- right: automatically `398 Hz`.

### `A-P100-104`

Status: exact simple Monroe patent comparator.

Values:

- left: `100 Hz`;
- right: `104 Hz`;
- difference: `4 Hz`;
- derived arithmetic center: `102 Hz`.

This preset must preserve the exact left/right patent example rather than reinterpret it through a different easy-mode formula.

### `A-SHAM-0`

First matched sham preset:

- left: `396 Hz`;
- right: `396 Hz`;
- difference: `0 Hz`;
- center: `396 Hz`.

If a later sham recipe uses another matched carrier, it receives a separate versioned recipe.

For every preset, show a concise read-only summary of the actual left/right output before playback.

---

## 2. One-number quick mode

Provide a deliberately simple mode where the user can enter **one carrier/center number** and press play.

A one-number mode is only mathematically meaningful because a quick template supplies the other required assumptions. Do not hide this fact.

The default quick template is:

`CENTERED_BINAURAL_4HZ_V1`

User enters:

- center frequency only.

Template supplies:

- binaural difference = `4 Hz`;
- centered-pair architecture;
- default waveform = sine;
- safe default gain/headroom;
- no masking noise unless explicitly selected by another template.

Calculate automatically:

`left = center - beat/2`

`right = center + beat/2`

Example:

- input center = `396`;
- app displays left = `394`, right = `398`, difference = `4`.

The calculated left/right values are read-only in this quick mode. The user should never need to calculate them manually.

Allow additional quick templates later through configuration, for example a `6 Hz` centered template, but do not clutter the first interface.

---

## 3. Simple custom mode

Provide a compact custom form for ordinary single-pair experiments.

At minimum allow:

- center frequency;
- binaural difference;
- waveform where supported;
- output gain/level inside a safe software range;
- fade-in duration;
- fade-out duration for finite export;
- optional ordinary masking noise toggle and level where supported.

The application automatically calculates left/right from center and difference.

Show all derived values before playback.

The user may save the result as a new versioned audio recipe.

---

## 4. Advanced custom mode

Provide an expandable advanced editor for the synthesis primitives already supported by `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`.

It may expose, as applicable:

- direct left/right frequencies;
- multiple carrier pairs;
- per-component gain;
- monaural within-channel spacing;
- amplitude envelopes;
- amplitude modulation;
- frequency modulation;
- ordinary masking noise;
- deterministic seeded noise;
- patent-grounded phased/swept pink-noise mode;
- left/right phase relationships;
- delay-sweep parameters;
- Septon/multi-carrier architecture;
- cue mixing for engineering preview;
- sample rate;
- normalization/headroom;
- export duration.

Advanced mode must retain provenance/status labels. Unverified historical parameters must never be presented as exact recovered Gateway/CENTER LANE settings.

---

# Continuous/unlimited playback

Audio Lab playback must support a user-controlled indefinite listening mode.

Required controls:

- `Play`;
- `Pause`;
- `Resume`;
- `Stop`.

Playback continues until the user pauses/stops or an actual system failure occurs. Do not impose a hidden 20/30/60-minute application limit.

Implementation may use procedural/streaming synthesis or a seamless deterministic loop as appropriate, but audible discontinuities at loop boundaries should be avoided.

For deterministic noise modes:

- preserve the selected seed;
- preserve algorithm version;
- ensure repeated playback from the same saved recipe can reproduce the same deterministic generated signal behavior where intended.

For pure tones, phase continuity should be maintained across generated buffers during continuous playback.

Pause/resume behavior must be defined and tested. A resumed stream should not create a large click/pop or silently change the recipe.

Stopping ends the current preview playback state. Starting again may restart from the defined recipe start unless the UI explicitly offers another documented behavior.

---

# Research-session playback remains protocol controlled

Do not confuse unlimited Audio Lab playback with participant-session timing.

A session protocol may itself specify:

- audio begins at session start;
- audio continues through all hands-free stages;
- audio stops/fades at return;
- or another profile-defined schedule.

That schedule is part of the committed session protocol and is not manually paused during normal participant operation.

---

# Audio recipe persistence

Allow any valid Audio Lab setup to be saved as a versioned recipe.

A saved recipe must include at minimum:

- stable ID;
- schema version;
- human-readable name;
- provenance/status;
- architecture/type;
- all explicit inputs;
- all derived left/right frequencies;
- all synthesis-layer parameters;
- sample rate;
- waveform/algorithm versions;
- noise seed if relevant;
- normalization/headroom rule;
- creation timestamp;
- optional notes.

If material parameters change, save a new version/ID rather than silently replacing a recipe already used by a committed session.

---

# Deterministic export

The Audio Lab should allow generating a finite deterministic WAV file from a preset/custom recipe for verification or later profile use.

User chooses an export duration for finite generation.

Store/generate:

- WAV;
- audio manifest;
- SHA-256 hash;
- exact effective recipe snapshot.

Continuous preview does not require creating a huge indefinitely growing WAV file.

---

# Validation and safety-oriented engineering checks

Before playback or export, validate at minimum:

- all frequencies are finite positive values where required;
- no component frequency violates the selected sample rate/Nyquist limit;
- centered calculations do not produce zero/negative channel frequencies;
- binaural difference is represented exactly as derived from left/right;
- sample rate is supported;
- gains are finite and within application limits;
- final mix has defined headroom;
- no clipping in finite rendered test vectors;
- unsupported combinations are rejected with a clear message;
- advanced historical modes identify unsupported/approximate parameters clearly.

Do not apply automatic hidden frequency corrections. If the user enters an invalid configuration, reject it visibly rather than silently changing it.

---

# Bluetooth behavior

The application does not implement Bluetooth.

Bluetooth headphones may be selected by the operating system as the computer's normal audio output. The MIP app simply plays through the system-selected output device.

No phone controller, Bluetooth protocol stack, pairing workflow, or mobile packaging belongs in this build.

---

# Audio Lab logging

Audio Lab preview activity may have a lightweight engineering log, but it must be kept separate from formal session data.

Useful optional fields:

- recipe ID or temporary recipe hash;
- playback start/pause/resume/stop times;
- output sample rate;
- application version;
- notes.

Do not count Audio Lab preview activity as a REQUEST/READ trial.

---

# Required tests

Automated/manual tests must verify at minimum:

1. selecting `A-U396-4` produces/displays exactly `394/398 Hz`;
2. selecting `A-P100-104` produces/displays exactly `100/104 Hz`;
3. selecting `A-SHAM-0` produces/displays exactly `396/396 Hz`;
4. quick input `396` under the 4-Hz centered template derives `394/398` with no manual channel entry;
5. changing quick input recomputes channels correctly;
6. simple custom center+beat mode recomputes channels correctly;
7. advanced direct-channel mode does not overwrite explicit channel values;
8. invalid/Nyquist-violating configurations are rejected;
9. finite exported WAV frequencies/channels are correct within numerical tolerance;
10. saved recipe snapshots and hashes are reproducible;
11. continuous playback can run beyond ordinary test durations until manual pause/stop;
12. pause/resume/stop controls behave cleanly;
13. saved Audio Lab recipes can be selected by a research profile;
14. unsaved Audio Lab state cannot silently leak into a committed research session;
15. changing a recipe already used in a session creates a new version rather than mutating historical session configuration.

---

# User-experience rule

The default Audio Lab must be easy enough that the normal first-use path is:

`choose one of three presets -> Play`

or:

`enter one center frequency -> see automatically calculated left/right values -> Play`

All complex synthesis controls belong behind the custom/advanced path and must not make the ordinary screen difficult to use.