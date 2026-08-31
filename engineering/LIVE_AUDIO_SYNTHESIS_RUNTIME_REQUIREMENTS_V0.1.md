# MIP Live Audio Synthesis Runtime Requirements v0.1

## Status

`ACTIVE — AUDIO RUNTIME ARCHITECTURE CORRECTION`

## Purpose

The MIP audio system must behave as a live synthesis engine, not as a file-loop player.

The application should be able to synthesize the requested stereo environment continuously in real time from a versioned recipe, with no mandatory persistent audio file for ordinary playback or formal research sessions.

A saved audio file is an optional export, archival, regression-test, or forensic artifact. It is not the default runtime mechanism.

---

# 1. Core architecture

Use one shared versioned synthesis library capable of producing deterministic PCM/audio blocks from a declared recipe.

The same synthesis library must serve:

- Audio Lab preview;
- quick one-number binaural generation;
- simple custom playback;
- advanced custom playback;
- layered Hemi-Sync reconstruction playback;
- formal research-session audio;
- optional WAV export;
- automated audio verification fixtures.

Do not maintain separate scientific synthesis logic for live playback and file export.

---

# 2. Live generation is the default

For normal Audio Lab use and formal session use, generate audio continuously at runtime and send it directly to the operating-system/browser audio output path.

The synthesizer must be stateful and phase-continuous.

It must not repeatedly replay a short finite audio file merely to simulate continuous synthesis.

Playback continues until:

- the user manually pauses/stops in Audio Lab; or
- the formal session protocol reaches its configured audio end/return/abort condition.

The engine must support sessions whose total active duration is not known in advance.

---

# 3. Reproducibility without mandatory file storage

Formal reproducibility is based on the frozen synthesis state, not on requiring a stored WAV file.

At commitment, store and hash at minimum:

- audio recipe ID and version;
- synthesis-engine ID and version;
- sample rate;
- channel layout;
- all carrier, phase, gain, modulation, envelope, noise, delay, sweep, cue, and normalization parameters;
- deterministic seed(s) for every stochastic/noise component;
- initial generator state where required;
- audio timeline/cue schedule;
- expected session audio policy;
- configuration hash.

For deterministic recipes, the same recipe + engine version + seed + initial state must reproduce the same generated sample stream.

A full persistent audio file is not required for reproducibility.

---

# 4. Runtime stream integrity

During live synthesis, maintain a monotonic sample/frame counter.

Hash generated PCM blocks incrementally as they are produced without requiring them to be permanently stored.

At session end, store at minimum:

- total generated frames/samples;
- rolling/final generated-stream SHA-256 or equivalent deterministic stream digest;
- playback start/end times;
- audio-context/sample-clock metadata where available;
- underrun/dropout/error counters where detectable;
- pause/resume/abort events;
- actual cue emission times;
- synthesis/runtime warnings.

This digest proves what the software generated; it does not by itself prove the exact acoustic waveform physically emitted by the headphones. Preserve that distinction.

---

# 5. Audio Lab behavior

Audio Lab must provide real controls, not a toast-only simulation.

Required visible live state:

- current recipe/preset;
- current left/right or layered synthesis summary;
- playing/paused/stopped state;
- elapsed playback time;
- volume/output gain;
- Play;
- Pause;
- Resume;
- Stop.

Playback must audibly work through the normal OS-selected output device.

For quick centered mode, the user enters one center frequency and the application derives the two channels from the selected beat template.

For advanced/layered mode, the user edits supported synthesis parameters through the UI and can start live playback immediately after validation.

No mandatory save/export step is required before exploratory listening.

---

# 6. Formal session behavior

A formal session freezes the synthesis recipe/configuration at commitment, but playback remains live-generated.

After commitment:

- recipe parameters cannot change;
- seed/initial state cannot change;
- cue schedule cannot change;
- synthesis-engine version cannot change;
- output is generated continuously from the frozen state;
- all runtime audio events are logged.

Do not require a pre-rendered full-session file merely to permit START.

Before START, validate the frozen recipe and run deterministic preflight checks sufficient to prove that the recipe is syntactically valid, finite-valued, non-clipping within declared rules, and reproducible from the stored state.

---

# 7. Pause semantics

Audio Lab:

- Pause freezes the current synthesis state and sample counter.
- Resume continues from the exact paused synthesis state unless the selected mode explicitly documents another behavior.

Formal research session:

- normal protocol flow does not require interactive pause;
- an interruption should be logged as an interruption/protocol deviation;
- abort/return remains available according to the active hands-free protocol.

---

# 8. Optional render/export

The application may expose an explicit `Export WAV` / `Render Artifact` action.

Use it for:

- listening outside the application;
- regression tests;
- sharing a specific recipe artifact;
- archival snapshots;
- spectral verification;
- troubleshooting;
- external analysis.

Export must use the same synthesis library and recipe semantics as live playback.

Saved audio is optional unless a future protocol explicitly requires a file artifact.

---

# 9. Layered Hemi-Sync capability

The live synthesis library must support the layered primitives already required by the project, including:

- multiple simultaneous carriers;
- binaural and monaural relationships;
- per-component gains;
- phase relationships;
- amplitude envelopes;
- AM/FM;
- deterministic white/pink/red noise;
- patent-grounded phased/swept pink-noise processing;
- delay-line/comb-filter processing;
- low-frequency delay sweep;
- Septon/multi-carrier structures;
- cue tones;
- future voice-layer references.

The `PHASED_PINK_PATENT_5356368` reconstruction capability remains mandatory.

The architecture must be recipe-driven, so a new supported combination is created by configuration rather than by rewriting the synthesis engine.

---

# 10. Historical exactness gate remains unchanged

Live synthesis does not authorize invention of unknown historical parameters.

Reported CENTER LANE candidates with unresolved channel/level/phase/noise/modulation/sequence/timing semantics remain incomplete historical candidates.

The application must not silently fill missing values.

---

# 11. Acceptance tests

Before owner approval, demonstrate:

1. audible live playback for A-U396-4;
2. audible live playback for A-P100-104;
3. audible live playback for A-SHAM-0;
4. visible Play/Pause/Resume/Stop behavior;
5. unlimited Audio Lab playback without looping a finite persisted file;
6. phase/state continuity across normal live playback;
7. deterministic quick-mode channel derivation;
8. live multi-carrier/Septon synthesis;
9. live deterministic phased-pink synthesis;
10. identical recipe + seed + engine version produces the same generated-block digest in deterministic tests;
11. changed material recipe parameter changes the stream digest;
12. formal session locks recipe/seed/version while still synthesizing live;
13. runtime sample count, stream digest, cue times, playback start/end, and detectable audio errors are logged;
14. optional WAV export, if used, matches the same synthesis semantics as live playback;
15. no mandatory pre-rendered full-session WAV is required for START.

---

# 12. Supersession rule

This document supersedes any older requirement that mandates pre-rendering and replaying a complete frozen audio file for every formal layered session.

The correct active model is:

`frozen deterministic recipe + frozen seed/state + live stateful synthesis + runtime stream digest/logging`

Optional file rendering remains available for verification/export, but is not the default playback architecture.