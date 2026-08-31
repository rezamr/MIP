# Codex Prompt — MIP Local Research Engine v0.9

## READ THIS FIRST — FINAL PRE-CODE AUDIO CORRECTION

You are the implementation agent for `rezamr/MIP`.

This v0.9 prompt is the active implementation authority for new work and supersedes v0.8 where they differ.

All requirements in `engineering/CODEX_PROMPT_REQUEST_APP_V0.8.md` remain mandatory unless this v0.9 file explicitly changes or strengthens them. Do not treat v0.9 as a reduced-scope replacement. It is an additive final correction before coding.

Before coding, read the repository startup sequence and the complete active implementation chain, including at minimum:

1. `README.md`
2. `COLLABORATION_PROTOCOL.md`
3. `00_MASTER.md`
4. `01_PROJECT_CHARTER.md`
5. `02_CORE_OBJECTIVES_AND_PROTOCOL_AUDIT.md`
6. `03_TEMPORAL_AND_ENTROPY_RESEARCH_PRIORITY.md`
7. `04_EVIDENCE_STANDARD.md`
8. `05_PRACTICAL_DEVELOPMENT_STRATEGY.md`
9. `10_CONVERSATION_ORCHESTRATION.md`
10. `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
11. `engineering/CODEX_PROMPT_REQUEST_APP_V0.8.md`
12. `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
13. `protocols/REQUEST_ENCODING_V0.2.md`
14. `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
15. `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
16. `protocols/MIP_NUM_REQUEST_V0.2.md`
17. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
18. `research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md`
19. `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
20. `research/SOURCE_VERIFICATION_QUEUE.md`
21. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
22. `engineering/REQUEST_TEST_APP_SPEC_V0.2.md`
23. `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
24. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
25. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
26. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
27. `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md`
28. `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
29. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
30. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
31. `templates/SESSION_TEMPLATE.md`
32. `sessions/SESSION_INDEX.md`

Then inspect the repository tree and implement the complete application required by v0.8 plus the mandatory changes below.

---

# A. Critical historical/audio distinction

Do not confuse two different historical families:

- the 1979–1980 Army/SRI Remote Perturbation work is a REQUEST/INFLUENCE precedent for random-machine output testing;
- Monroe/Gateway/CENTER LANE material is the historical source family for Hemi-Sync/state-induction audio reconstruction.

MIP may combine methodological lessons from both in one modern experiment, but provenance must remain explicit.

---

# B. Hemi-Sync must not be reduced to a simple frequency player

The application's easy pure-tone conditions remain necessary for component-isolation experiments, but they are not the complete Hemi-Sync reconstruction path.

A simple pair such as:

- 394/398 Hz;
- 100/104 Hz;
- 396/396 Hz sham;

must remain available and easy to use.

However, the audio engine must ALSO implement the full layered synthesis/render architecture required by:

`engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md`

This is mandatory in the first software build. Do not postpone the layered architecture merely because the first comparison block can use simple tones.

---

# C. Formal historical/reconstruction audio must be rendered, frozen, verified, and hashed before use

For any formal research session whose selected audio is a layered Hemi-Sync reconstruction or patent-grounded reconstruction:

1. resolve the versioned audio recipe;
2. render the complete finite stereo file required by that session protocol;
3. generate the complete machine-readable manifest;
4. verify the rendered audio automatically;
5. calculate and store SHA-256 for audio, manifest, and render-verification report;
6. include those hashes in the immutable session commitment/configuration snapshot;
7. permit START only after verification passes;
8. play that exact frozen file during the active session;
9. log actual playback start/end and playback deviations/errors;
10. never retune/regenerate parameters after commitment.

The Audio Lab may synthesize continuously for auditioning. Formal layered research-session audio is a reproducible rendered artifact.

---

# D. Layered synthesis primitives are required now

The first build must support, as versioned data-driven recipe primitives where documented by the active audio requirements:

- multiple simultaneous left/right carriers;
- binaural relationships;
- monaural within-channel relationships;
- per-component levels;
- phase relationships;
- amplitude envelopes;
- amplitude modulation;
- frequency modulation;
- ordinary noise;
- deterministic pink/red noise;
- patent-grounded phased/swept pink-noise mode;
- delay-line / comb-filter processing;
- low-frequency delay sweep;
- Septon/multi-carrier structure;
- fades;
- normalization/headroom;
- cue-track support;
- future voice-layer references without requiring a rewrite of the audio graph.

Implement the recoverable `PHASED_PINK_PATENT_5356368` architecture described in the active audio requirements.

A new combination of supported primitives must be creatable through a new recipe, not a source-code rewrite.

---

# E. Historical exactness gate

Do NOT invent missing Army/CENTER LANE waveform parameters.

The repository currently preserves reported operational anchors:

- 100-Hz base with 1.5-Hz binaural beat;
- 200-Hz base with 4-Hz binaural beat.

But the source-verification queue still requires exact clarification of what `base` means and which complete channel/waveform parameters were used.

Therefore the application must:

- support those future recipes structurally;
- show incomplete historical candidates with missing fields if useful;
- refuse to call them exact historical renders while verification is incomplete;
- never auto-infer the opposite-ear frequency;
- never auto-assume centered synthesis;
- never auto-assume simultaneous use unless a verified source supports it;
- never invent level, phase, modulation, noise, sequencing, or timing.

When source verification later supplies exact parameters, adding the historical recipe must require configuration/data only if all needed signal primitives already exist.

---

# F. User-facing audio organization

Keep the Audio Lab simple despite the full engine.

The normal interface must still provide:

1. three one-click initial simple conditions;
2. one-number quick mode that derives channels automatically from the selected template;
3. simple custom mode;
4. advanced custom mode;
5. a separate historical/layered reconstruction area.

A normal user should never have to manually calculate left/right values for common centered binaural conditions.

For the simple 396/4 template:

- center = 396 Hz;
- beat = 4 Hz;
- left = 394 Hz;
- right = 398 Hz.

For the explicit patent comparator:

- left = 100 Hz;
- right = 104 Hz;
- preserve that exact pair rather than forcing it through centered-pair assumptions.

Audio Lab playback remains unlimited until manually paused/stopped.

---

# G. Historical/layered render validation is an acceptance gate

Before owner review, demonstrate at minimum:

1. simple 396/4 condition passes channel/frequency verification;
2. exact 100/104 comparator passes verification;
3. sham passes verification;
4. multi-carrier/Septon recipe renders correctly;
5. patent-grounded phased-pink recipe renders deterministically;
6. identical recipe + seed + synthesis version produces identical bytes/hash;
7. changing a material recipe value changes the manifest/hash;
8. deliberate render corruption is detected;
9. formal START is rejected if the selected rendered artifact is absent, invalid, or hash-mismatched;
10. playback start/end/error is included in the session evidence chain;
11. incomplete CENTER LANE candidate cannot be mislabeled as exact;
12. live Audio Lab state cannot contaminate formal committed audio.

Include these test outcomes in the Codex completion report.

---

# H. Everything else in v0.8 remains mandatory

Do not drop or simplify any v0.8 requirement concerning:

- configuration-driven architecture;
- immediate, relative, absolute, and pre-generated timing;
- continuous hidden stream around request;
- objective state vs participant mapping/encoding separation;
- random-source provider abstraction;
- calibration;
- block/session/trial identity;
- append-only hash-chained event logging;
- lossless machine-output evidence;
- crash/incomplete-session recovery;
- participant raw-report draft and immutable lock;
- server-side reveal gate;
- subjective-time estimate before actual time display;
- deterministic session and block analysis;
- Sessions/Reports browsing and integrity review;
- export/verification of complete evidence bundles;
- no database;
- no cloud;
- no mobile app;
- local-computer operation only;
- ordinary operating-system Bluetooth headphone output only;
- tests and dry runs before any participant session.

The desired result is one stable research engine that can evolve by configuration, while preserving exact evidence and reproducible audio artifacts.

Do not start a real participant session automatically.

At completion, report every mandatory requirement as one of:

- implemented and tested;
- implemented but not manually verified;
- deliberately deferred by explicit active scope;
- blocked, with exact reason.

Do not use vague phrases such as `supported in principle` for mandatory items.
