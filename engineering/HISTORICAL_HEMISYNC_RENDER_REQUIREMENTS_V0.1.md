# MIP Historical Hemi-Sync Render Requirements v0.1

## Status

`ACTIVE ENGINEERING REQUIREMENT — PRE-CODEX FREEZE`

## Purpose

The MIP application must distinguish a simple binaural-frequency player from a historically motivated Hemi-Sync reconstruction engine.

A single pair such as `394/398 Hz` or `100/104 Hz` is useful for component-isolation experiments, but it is not automatically a complete Hemi-Sync environment.

For formal Hemi-Sync reconstruction conditions, the application must be able to synthesize the complete declared stereo signal environment from a versioned recipe, render it deterministically to a finite audio file before the session, verify the rendered file, hash it, and then play that exact frozen file during the committed research session.

This requirement does not authorize invention of unrecovered historical parameters.

---

# 1. Historical program distinction

Do not conflate the 1979–1980 Army/SRI Remote Perturbation random-system experiment with the CENTER LANE / Monroe Hemi-Sync audio program.

The Remote Perturbation protocol is a historical REQUEST/INFLUENCE precedent for the machine-output side of MIP.

The Hemi-Sync reconstruction problem comes from Monroe/Gateway/CENTER LANE audio material and later Monroe engineering documents/patents.

A MIP experiment may combine lessons from both families, but the software and documentation must preserve their separate provenance.

---

# 2. Simple binaural conditions are not the full historical reconstruction

The following remain valid component-isolation conditions:

- `A-U396-4` — MIP user baseline, centered 394/398 Hz reconstruction;
- `A-P100-104` — documented simple Monroe patent comparator;
- `A-SHAM-0` — matched no-beat control.

These may be generated and played as simple stereo tones.

They must not be labeled as an exact Army/CENTER LANE Hemi-Sync recording merely because they contain a binaural difference.

The user-facing interface should distinguish clearly between:

- `Simple Binaural / Component Test`;
- `Layered Hemi-Sync Reconstruction`;
- `Historical Candidate — Parameters Incomplete`.

---

# 3. Formal layered Hemi-Sync render path

Implement a dedicated deterministic layered-render path for formal Hemi-Sync reconstruction recipes.

A recipe may contain, when supported by the source or explicitly labeled MIP reconstruction parameters:

1. one or more simultaneous left/right carrier components;
2. binaural relationships between channels;
3. monaural within-channel beat relationships;
4. per-component amplitude/gain;
5. left/right phase relationships;
6. amplitude envelopes;
7. amplitude modulation;
8. frequency modulation;
9. ordinary masking noise;
10. deterministic pink/red noise;
11. patent-grounded phased/swept pink-noise processing;
12. delay-line/comb-filter processing;
13. low-frequency delay sweep;
14. multi-carrier / Septon structures;
15. fades;
16. optional cue tones or separately versioned cue track;
17. optional future voice/script layers when a protocol explicitly requires them;
18. final normalization/headroom.

The signal graph must be data-driven from the audio recipe rather than hardcoded for one current condition.

---

# 4. Render-before-session rule for formal research use

For a committed formal session using a layered Hemi-Sync reconstruction:

1. resolve the exact versioned audio recipe;
2. resolve the exact session duration/audio timeline required by the session protocol;
3. render the complete stereo audio file before session commitment or before final START eligibility;
4. create a machine-readable audio manifest;
5. run deterministic validation against the rendered file;
6. calculate SHA-256 for the final audio file and manifest;
7. include those hashes in the session commitment/configuration snapshot;
8. during the active session, play that exact frozen file;
9. do not regenerate, retune, or alter synthesis parameters after commitment;
10. log actual playback start/end and any playback error/interruption.

The formal research path must not depend on a continuously changing live oscillator state that cannot later be reproduced exactly.

Audio Lab preview may remain live/continuous. Formal historical-reconstruction session audio must be reproducible and frozen.

---

# 5. Required audio manifest

For every formal rendered Hemi-Sync file store at minimum:

- recipe ID and version;
- provenance/status label;
- synthesis-engine version;
- sample rate;
- sample format / bit depth;
- channel count and channel assignment;
- duration in samples and seconds;
- every carrier component per channel;
- every declared binaural relationship;
- every monaural relationship;
- per-component gain;
- phase values/relationships;
- AM parameters;
- FM parameters;
- noise algorithm and version;
- deterministic noise seed where applicable;
- noise filter coefficients/version;
- delay-line parameters;
- sweep parameters and rate;
- envelope parameters;
- cue/voice layer references if present;
- normalization/headroom rule;
- peak level and clipping check;
- final file SHA-256;
- manifest SHA-256;
- all reconstruction/unknown-parameter notes.

No material synthesis parameter may exist only in application memory and disappear from the manifest.

---

# 6. Patent-grounded complex synthesis capability

The application must implement the recoverable architecture already described in `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`, including the versioned `PHASED_PINK_PATENT_5356368` capability.

This includes, where the documented source supports it:

- deterministic 16-bit shift-register noise mode;
- the described 65,535-sample sequence behavior;
- filtering toward pink/red noise;
- delay-line / comb-filter processing;
- low-frequency sweep near 1/8 Hz;
- configurable left/right sweep phase/amplitude relationship;
- envelope multiplication;
- documented AM/FM structures;
- Septon/multi-carrier architecture.

These capabilities are not optional merely because the first simple component-isolation block uses pure tones.

They must exist in the engine so later layered recipes can be created without rewriting the audio subsystem.

---

# 7. CENTER LANE / Army operational candidates

Current repository evidence preserves reported CENTER LANE operational anchors:

- `100 Hz base + 1.5 Hz binaural beat`;
- `200 Hz base + 4 Hz binaural beat`.

However, `research/SOURCE_VERIFICATION_QUEUE.md` currently marks the exact meaning of `base` and complete waveform semantics as pending verification.

Therefore:

- do not invent the opposite-ear frequencies;
- do not assume centered-pair synthesis;
- do not assume the two reported components were simultaneous unless the verified source establishes that;
- do not assume levels, phase, noise, modulation, sequence, or timing not recovered from evidence;
- do not label a generated file as an exact 1984 CENTER LANE file while these parameters remain unresolved.

The software should nevertheless support a future versioned CENTER LANE recipe immediately once source-verified parameters are added to configuration.

If the application displays these candidates before verification, show them as disabled/incomplete historical candidates with the exact missing fields rather than silently filling them.

---

# 8. Provenance classes

Every audio recipe must have one of a small explicit provenance/status classes, for example:

- `USER_EXPERIMENTAL`;
- `DOCUMENTED_PATENT_EXAMPLE`;
- `PATENT_GROUNDED_RECONSTRUCTION`;
- `REPORTED_HISTORICAL_CANDIDATE_INCOMPLETE`;
- `PRIMARY_SOURCE_VERIFIED_HISTORICAL_RECONSTRUCTION`;
- `MIP_EXPERIMENTAL_RECONSTRUCTION`;
- `SHAM_CONTROL`.

The UI and reports must show the class prominently.

A source-verification upgrade creates a new recipe version; it does not silently mutate an older rendered file.

---

# 9. Render verification

Before a rendered file becomes eligible for a formal session, verify automatically where applicable:

- exact sample count/duration;
- correct stereo channel assignment;
- expected carrier spectral peaks within tolerance;
- expected binaural frequency differences;
- expected monaural spacing;
- expected AM/FM rates;
- expected noise spectral slope;
- expected delay-sweep rate;
- expected stereo phase relationship;
- deterministic reproduction from identical recipe/seed/version;
- no clipping;
- declared normalization/headroom;
- finite valid samples;
- reproducible WAV/PCM metadata and SHA-256.

Create a render-verification report and link/hash it in the manifest.

A failed render verification prevents formal-session START with that file.

---

# 10. Audio Lab behavior remains separate

The Audio Lab keeps its easy workflow:

- one-click initial presets;
- one-number quick mode;
- simple custom mode;
- advanced custom mode;
- unlimited manual playback until pause/stop.

For exploratory listening, live synthesis is acceptable.

To promote an Audio Lab setup into a formal research-session condition:

1. save/version the recipe;
2. choose the formal render duration/timeline from the session protocol;
3. render the complete file;
4. verify it;
5. hash it;
6. select that immutable rendered artifact in the committed session.

An unsaved or live-only preview is never formal session evidence.

---

# 11. Required acceptance tests

Codex must demonstrate before owner review:

1. simple 396/4 component test works and derives the correct channels;
2. simple 100/104 patent comparator preserves the exact documented pair;
3. sham condition works;
4. a multi-carrier/Septon recipe renders to a finite stereo file;
5. patent-grounded phased-pink mode renders deterministically from a stored seed;
6. the same full recipe rendered twice produces identical bytes/hash when deterministic parameters are identical;
7. changed material recipe parameter produces a new manifest/hash;
8. full render verification detects a deliberately corrupted/wrong render fixture;
9. formal session cannot START when the selected render is missing or fails verification;
10. formal session plays the frozen file and logs playback start/end/error;
11. a reported-but-unverified CENTER LANE recipe cannot be mislabeled or silently completed;
12. Audio Lab live preview remains separate from formal rendered-session audio.

---

# 12. Interpretation boundary

A faithful reconstruction of a documented signal architecture is an engineering statement, not proof that:

- the same waveform was used in every historical session;
- the historical program produced anomalous effects;
- the reconstructed waveform will reproduce any claimed effect;
- later patent architecture was necessarily used in earlier CENTER LANE work.

MIP must preserve those distinctions in every label, manifest, report, and user-facing historical description.
