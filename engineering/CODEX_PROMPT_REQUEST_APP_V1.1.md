# Codex Prompt — MIP Local Research Engine v1.1

## ACTIVE IMPLEMENTATION CORRECTION

You are the implementation agent for `rezamr/MIP`.

This v1.1 prompt is the active implementation authority for new implementation/revision work.

All mandatory requirements from `engineering/CODEX_PROMPT_REQUEST_APP_V1.0.md` remain binding unless this v1.1 file explicitly changes them.

v1.1 changes the audio runtime architecture from mandatory pre-rendered full-session playback to deterministic live synthesis.

It does not reduce any requirement concerning UI/UX, logging, timing, reproducibility, evidence integrity, Hemi-Sync synthesis capability, reporting, configuration, reveal gating, or historical provenance.

Before changing the implementation, read in full:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
5. `engineering/CODEX_PROMPT_REQUEST_APP_V1.0.md`
6. `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md`
7. `engineering/LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md`
8. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
9. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
10. `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md`
11. all other active files required by v1.0.

Then inspect the current implementation and preserve all scientifically valid functionality while applying the corrections below.

---

# A. Live synthesis is the active audio model

Implement `engineering/LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md` completely.

The application must use one shared synthesis library that generates audio continuously from a versioned recipe.

The default runtime path is NOT:

`render full WAV -> replay/loop WAV`

The active runtime path is:

`validated recipe -> frozen parameters/seed/state -> live stateful synthesis -> OS-selected audio output`

This applies to:

- Audio Lab presets;
- quick generator;
- simple custom audio;
- advanced custom audio;
- layered Hemi-Sync reconstruction;
- formal research sessions.

---

# B. Do not require permanent audio files for ordinary operation

A persistent WAV/audio file is optional.

Do not require saving a complete audio file before preview or before a formal session can start.

Formal reproducibility must instead freeze and hash:

- recipe/version;
- synthesis-engine version;
- sample rate;
- all material synthesis parameters;
- deterministic seeds;
- initial generator state;
- cue/timeline configuration;
- effective audio configuration hash.

During live playback, incrementally hash generated PCM/audio blocks and record a final generated-stream digest plus total sample/frame count.

Optional file export/render remains available for regression testing, external analysis, troubleshooting, archival use, or explicit owner request.

---

# C. Fix Audio Lab as a real interactive audio instrument

The current user-visible behavior must not consist only of a toast such as `Preview started`.

Each live player must provide clear persistent state and controls.

At minimum show:

- selected preset/recipe;
- channel/layer summary;
- playback state;
- elapsed time;
- output gain/volume;
- Play;
- Pause;
- Resume;
- Stop.

The owner must actually hear the generated signal through the normal OS-selected audio output device.

The three simple presets must work audibly:

- A-U396-4 = 394/398 Hz;
- A-P100-104 = 100/104 Hz;
- A-SHAM-0 = 396/396 Hz.

The quick generator must derive centered left/right channels automatically.

Advanced/layered synthesis must also be auditionable live after validation.

---

# D. Stateful continuous synthesis

Do not fake continuous playback by repeatedly looping a short finite file.

The synthesis engine must maintain oscillator/noise/filter/delay/modulation state across generated blocks.

It must support indefinite Audio Lab playback until manual stop.

For deterministic stochastic layers, use stored seeds and explicit algorithm versions.

For pause/resume in Audio Lab, freeze the synthesis state and continue from the exact paused state on resume.

Formal sessions normally run continuously; any interruption must be logged as a protocol deviation/abort according to the active session protocol.

---

# E. Live Hemi-Sync layered synthesis remains mandatory

Do not simplify Hemi-Sync to a single left/right oscillator pair.

The same live synthesis library must support all active layered primitives, including:

- multiple carriers;
- binaural and monaural relationships;
- per-component levels;
- phase relationships;
- envelopes;
- AM/FM;
- deterministic noise;
- pink/red noise;
- patent-grounded phased/swept pink noise;
- delay/comb processing;
- low-frequency sweep;
- Septon/multi-carrier structures;
- cue tracks;
- future voice-layer references.

`PHASED_PINK_PATENT_5356368` remains mandatory.

Historical unknowns remain unknown. Do not invent CENTER LANE parameters.

---

# F. Formal-session audio evidence

A formal session freezes the recipe/seed/state/version at commitment.

Log at minimum:

- audio recipe/version;
- synthesis engine version;
- seed(s);
- sample rate;
- playback start/end;
- monotonic sample/frame count;
- generated-stream digest;
- cue emission times;
- pause/interruption/abort events;
- detectable buffer underruns/dropouts/errors;
- audio-context/runtime warnings.

A generated-stream digest demonstrates what the software generated, not the exact acoustic waveform physically emitted by headphones. Preserve that distinction in reports.

---

# G. Optional render/export

If an `Export WAV` or equivalent function exists, it must use the same synthesis library and recipe semantics as live playback.

It is useful for:

- QA;
- spectral verification;
- regression fixtures;
- archival export;
- external listening/analysis.

It is not a mandatory precursor to live playback.

---

# H. UI/UX failures discovered in manual owner review must be treated as real failures

Do not claim success merely because a button dispatches an event or displays a toast.

The owner manually observed that current preview behavior does not produce usable audible playback and that some Sessions & Reports tabs do not behave as functional review surfaces.

Revision work must include end-to-end interactive verification of:

- actual audible Audio Lab playback;
- persistent player controls;
- tab navigation;
- Machine Output view;
- Raw Report view;
- Analysis view;
- Audio & Configuration view;
- Integrity view;
- session navigation and back behavior;
- readable logs/timeline;
- report interaction.

A route/tab that exists visually but does not load and display its intended content is not implemented.

---

# I. Logging/editability clarification

Authoritative raw event logs and locked raw reports remain immutable.

Do not make original evidence editable.

However, the UI must allow meaningful review:

- search/filter;
- event detail expansion;
- copy/export;
- clear timestamps and event ordering;
- human-readable event payload summaries;
- append-only late notes/recollections where allowed.

A reviewer should never need to edit primary evidence in order to annotate or understand a session.

---

# J. Acceptance gate

Before declaring revision complete, manually and automatically demonstrate:

1. A-U396-4 produces audible live output;
2. A-P100-104 produces audible live output;
3. A-SHAM-0 produces audible live output;
4. Play/Pause/Resume/Stop work visibly and audibly;
5. Audio Lab can run indefinitely without looping a mandatory persisted file;
6. quick generation works from one center-frequency input;
7. live Septon synthesis works;
8. live deterministic phased-pink synthesis works;
9. formal session freezes recipe/seed/state but generates live;
10. generated sample/frame count and stream digest are logged;
11. session report tabs all function end-to-end;
12. Machine Output presents real session data;
13. Analysis presents deterministic analysis;
14. Audio & Configuration presents the exact committed recipe/state;
15. Integrity re-verifies the evidence chain;
16. raw logs remain immutable while review/annotation tools remain usable;
17. English-only UI and the v1.0 product-quality requirements remain satisfied.

Do not classify these as implemented based only on unit tests. Owner-visible manual behavior is part of acceptance.

---

# K. Supersession

Where older files require a complete pre-rendered full-session audio file as the mandatory formal playback mechanism, v1.1 and `LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md` supersede that requirement.

The active formal audio model is:

`frozen deterministic recipe + frozen seed/state/version + live stateful synthesis + runtime digest/logging`

All other valid historical exactness, synthesis capability, and evidence requirements remain in force.