# MIP AudioWorklet Real-Time Audio Requirements v0.1

## Status

`ACTIVE — REAL-TIME AUDIO REQUIREMENT`

## Purpose

MIP requires uninterrupted live synthesis suitable for long hands-free sessions.

The previous v1.1 browser implementation used `ScriptProcessorNode`, which is not acceptable for the Electron desktop build because audio generation must not depend on ordinary renderer event-loop scheduling.

The Electron build therefore uses `AudioWorklet` as the required live-playback engine.

This requirement applies to:

- simple binaural playback;
- Audio Lab preview;
- Quick Generator;
- Simple Custom;
- advanced custom synthesis;
- layered Hemi-Sync reconstruction;
- Septon/multi-carrier synthesis;
- phased-pink/patent-grounded synthesis;
- formal session playback.

---

# 1. One shared synthesis core

Do not create unrelated implementations for:

- Audio Lab;
- formal session playback;
- export rendering.

Use one versioned synthesis-core semantics layer.

The real-time worklet and offline/export renderer may have different execution wrappers, but given the same recipe/version/seed/sample rate they must follow the same synthesis equations and state semantics.

---

# 2. AudioWorklet requirement

Actual playback must use an `AudioWorkletProcessor`.

`ScriptProcessorNode` is forbidden in the active desktop implementation.

Ordinary renderer timers such as:

- `setInterval`;
- `setTimeout`;
- animation callbacks;
- DOM event handlers;

must never be responsible for producing the next audio samples.

UI stalls must not directly stop synthesis computation.

---

# 3. Deterministic stateful synthesis

The processor maintains explicit state across render quanta.

At minimum, where used by the recipe:

- oscillator phase per component/channel;
- noise PRNG/LFSR state;
- pink/red filter state;
- delay-line state;
- comb-filter state;
- AM phase;
- FM phase;
- sweep phase;
- envelope position;
- cue schedule position;
- generated frame counter;
- digest/checkpoint state.

State must not reset at each 128-frame render quantum.

---

# 4. Correct stereo oscillator semantics

Each channel component must maintain mathematically correct phase progression for its own configured frequency.

Do not derive the right channel by taking a left-channel phase and adding a frequency-difference phase expression in a way that can create incorrect state semantics for arbitrary phase, modulation, or multi-component recipes.

Each independently defined oscillator/channel component must have its own phase accumulator unless the recipe explicitly defines a shared oscillator relationship.

Phase wrapping may be used to preserve numerical precision.

---

# 5. Click/pop prevention

Normal playback controls must not introduce audible discontinuities.

Use short de-click ramps where appropriate for:

- start;
- pause;
- resume;
- stop;
- gain changes;
- recipe transitions where live transitions are explicitly allowed.

A formal committed session normally does not change the recipe during active playback.

Audio Lab may change recipes only through an explicit stop/reconfigure/restart flow unless a specific morph operation is implemented and validated.

---

# 6. Master gain and safe defaults

Provide a real master gain control outside individual recipe-component gains.

Requirements:

- conservative initial master level;
- visible level value;
- de-clicked changes;
- persisted owner preference may be allowed;
- formal session commitment records the effective starting master-gain policy/value if it affects generated PCM or playback amplitude semantics;
- never allow a hidden automatic gain increase.

Component sum must be managed to avoid clipping.

Provide headroom/normalization rules where required by the recipe.

---

# 7. Audio Lab player

The Audio Lab must show persistent controls and telemetry:

- recipe/preset;
- provenance;
- active layer summary;
- sample rate;
- playback state;
- elapsed time;
- generated frames;
- master gain;
- Play;
- Pause;
- Resume;
- Stop;
- audio-context state;
- health/warning indicator.

The player must continue indefinitely until the owner stops it or an actual error occurs.

No mandatory finite file loop is allowed.

---

# 8. Formal session integration

The formal session must use the same AudioWorklet synthesis engine.

Before entering the hands-free state:

1. resolve and validate the committed recipe;
2. freeze recipe version and all material parameters;
3. freeze deterministic seeds/initial state;
4. prepare/prewarm the AudioContext and worklet while the START action still qualifies as a user gesture where required;
5. confirm processor readiness;
6. begin committed live playback at the protocol-defined anchor;
7. record authoritative audio-start acknowledgement;
8. continue without renderer interaction;
9. finalize telemetry/digest at return/abort.

If the audio processor cannot be prepared, the formal session must not silently continue as if audio were active.

---

# 9. Audio-session handshake

Use an explicit handshake between:

- Electron main session controller;
- renderer audio controller;
- AudioWorklet processor.

Conceptually:

```text
main: COMMIT_AUDIO_CONFIG
renderer: PREPARE_AUDIO_ENGINE
worklet: PROCESSOR_READY
renderer/main: AUDIO_READY
main: START_SESSION
renderer: START_AUDIO_AT_COMMITTED_ANCHOR
worklet: AUDIO_STARTED(frame=...)
...
worklet: AUDIO_FINALIZED(frames=..., digest=...)
main: persist evidence
```

Do not infer audio success merely because a Play/Start button was clicked.

---

# 10. Real-time telemetry

The processor must expose low-rate telemetry without flooding the renderer.

At reasonable intervals report:

- generated frame count;
- processor sequence/checkpoint;
- current recipe ID/version;
- internal timing continuity state;
- digest checkpoint where implemented;
- clipping/peak warnings;
- processor errors;
- state transitions.

Do not post every sample to the renderer.

---

# 11. Cryptographic stream digest

The authoritative formal-session generated-stream digest must be cryptographic.

Do not use a simple additive checksum, FNV checksum, CRC, or 32-bit custom hash as the formal evidence digest.

Use SHA-256 or an explicitly versioned cryptographic equivalent approved by active MIP requirements.

The digest must cover a defined canonical byte representation of generated PCM, including:

- channel ordering;
- sample encoding/quantization used for hashing;
- byte order;
- sample rate/version metadata where appropriate.

Document the digest format so it can be reproduced offline.

The real-time implementation must avoid allocations/heavy work that risk audio deadlines.

Acceptable implementation strategies include:

- preallocated incremental SHA-256 state inside the worklet;
- a carefully benchmarked bundled incremental hash implementation;
- another architecture that produces the same cryptographic digest without risking audio continuity.

If hashing every render quantum is measurably unsafe on target hardware, use larger preallocated chunks/checkpoints while still covering the entire generated stream in order.

The completion report must state the chosen method and benchmark evidence.

---

# 12. Audio health and dropout diagnostics

MIP must distinguish as far as software can between:

- synthesis-engine continuity;
- renderer/main-process delays;
- AudioContext suspension;
- detectable worklet timing anomalies;
- OS/device/Bluetooth acoustic problems that software cannot directly observe.

Track where available:

- `AudioContext.state` changes;
- sample rate;
- base latency;
- output latency;
- worklet frame continuity;
- processor lifecycle errors;
- clipping;
- application suspend/resume events;
- selected-device metadata available without implementing a custom Bluetooth stack.

Do not claim that absence of software-detected errors proves artifact-free physical headphone output.

---

# 13. Audio Health Check

Before formal participant use, implement a dedicated Audio Health Check accessible from Audio Lab and pre-session readiness.

At minimum allow:

- selected simple reference recipe, default `A-U396-4`;
- configurable test duration;
- recommended 60-second quick check;
- optional longer 10-minute and 60-minute stability checks;
- visible engine telemetry;
- owner confirmation: clean / artifact heard / left-right problem / uncertain;
- optional note;
- result stored as a calibration/diagnostic record, not as participant research evidence.

For final owner acceptance, test both:

- wired headphones if available;
- intended Bluetooth headphones.

If artifacts occur only on Bluetooth while internal engine telemetry is clean, record this as device-path evidence rather than silently modifying synthesis parameters.

---

# 14. Bluetooth scope

Bluetooth remains ordinary operating-system audio transport.

MIP does not implement its own Bluetooth protocol.

However, the application should expose enough audio diagnostics to help determine whether brief crackles/dropouts are likely internal or external to the synthesis engine.

---

# 15. Recipe capability

All existing active synthesis capabilities remain mandatory where already required:

- simple left/right carriers;
- centered quick binaural construction;
- explicit non-centered pairs such as 100/104;
- multi-carrier;
- monaural relationships;
- phase relationships;
- envelopes;
- AM/FM;
- deterministic noise;
- pink/red filtering;
- phased/swept pink reconstruction;
- delay/comb processing;
- low-frequency sweep;
- Septon structures;
- cues;
- future voice references.

Historical unknowns remain unknown.

---

# 16. Export/offline verification

Optional WAV/offline rendering remains supported for QA.

Use it to compare the real-time engine against offline expected output.

Required regression approach:

- run the same deterministic recipe/seed/sample rate for a fixed frame count through the real-time synthesis core and offline harness;
- compare canonical PCM output or approved tolerance/exactness rule;
- verify matching cryptographic stream digest where exact deterministic parity is intended.

---

# 17. Stress and soak tests

Before formal session approval, perform audio tests beyond short unit tests.

Minimum software tests:

1. 394/398 phase continuity across many render quanta;
2. 100/104 continuity;
3. 396/396 sham continuity;
4. layered multi-carrier continuity;
5. Septon continuity;
6. phased-pink deterministic continuity;
7. start de-click;
8. pause/resume de-click and state continuation;
9. stop de-click;
10. gain-change de-click;
11. renderer artificial busy-load test while worklet runs;
12. large report/log UI activity while worklet runs;
13. 10-minute automated soak;
14. 60-minute owner/device soak before real participant use;
15. app focus/minimize/restore while playback continues as intended;
16. power-save blocker session test;
17. final cryptographic stream digest reproducibility for deterministic fixtures.

An audible crackle/pop in a simple stable reference condition is a failure requiring investigation before formal participant use.
