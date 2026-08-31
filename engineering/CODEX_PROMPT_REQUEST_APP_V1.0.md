# Codex Prompt — MIP Local Research Engine v1.0

## FINAL ACTIVE IMPLEMENTATION PROMPT

You are the implementation agent for the repository `rezamr/MIP`.

Your task is to build the complete first local MIP research application, not merely scaffold it, not merely provide architecture notes, and not merely implement the easiest subset.

This v1.0 prompt is the active implementation prompt for new work.

It supersedes earlier Codex prompt versions where they conflict.

All mandatory requirements from `engineering/CODEX_PROMPT_REQUEST_APP_V0.9.md` remain binding unless v1.0 explicitly changes them.

v1.0 adds a mandatory product/UI/UX quality gate and an English-only application-language requirement. It does **not** reduce the scientific, logging, timing, audio, integrity, configuration, or reporting requirements already established.

Do not ask the project owner to repeat decisions already present in the repository.

Do not start coding until the required repository reading is complete.

---

# 1. Mandatory reading order

Read these files in full before implementation:

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
11. `engineering/CODEX_PROMPT_REQUEST_APP_V0.9.md`
12. `engineering/CODEX_PROMPT_REQUEST_APP_V0.8.md`
13. `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md`
14. `protocols/MIP_FIRST_OPERATIONAL_PLAYBOOK_V0.3.md`
15. `protocols/REQUEST_ENCODING_V0.2.md`
16. `protocols/IMMEDIATE_REQUEST_TIMING_V0.1.md`
17. `protocols/MATRIX_TEMPORAL_RESPONSE_AND_PERSISTENCE_V0.1.md`
18. `protocols/MIP_NUM_REQUEST_V0.2.md`
19. `research/AUDIO_FREQUENCY_TEST_MATRIX_V0.1.md`
20. `research/ADDRESS_VS_PAYLOAD_ENCODING_HYPOTHESES_V0.1.md`
21. `research/RP_1979_1980_BINARY_PERTURBATION_FULL_AUDIT.md`
22. `research/SOURCE_VERIFICATION_QUEUE.md`
23. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
24. `engineering/REQUEST_TEST_APP_SPEC_V0.2.md`
25. `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
26. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
27. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
28. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
29. `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md`
30. `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
31. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
32. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.1.md`
33. `templates/SESSION_TEMPLATE.md`
34. `sessions/SESSION_INDEX.md`

Then inspect the complete repository tree before creating or modifying implementation files.

Older versions remain project history. Do not silently combine superseded behavior with active behavior.

---

# 2. Authority and conflict resolution

Use `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md` as the conflict-resolution map.

v1.0 is now the highest Codex implementation authority.

If a genuine unresolved contradiction remains:

1. identify the exact files and clauses;
2. do not silently invent a compromise;
3. implement unaffected components;
4. record the blocked item precisely;
5. do not alter scientific meaning without a versioned repository decision.

Do not stop the entire implementation because one isolated requirement is blocked.

---

# 3. Application language — mandatory

The complete application UI must be English-only.

All of the following must be English:

- navigation;
- page titles;
- form labels;
- helper text;
- buttons;
- tooltips;
- validation messages;
- warnings;
- modals;
- empty states;
- status labels;
- reports;
- chart titles;
- chart labels;
- legends;
- configuration screens;
- session workflow;
- Audio Lab;
- calibration screens;
- export/integrity screens;
- user-visible error messages.

Do not mix Persian and English in the application.

The application must be usable without knowledge of the project owner's conversation language.

---

# 4. Product-quality requirement

This must not look or behave like a raw developer prototype.

The first build must be a polished local research product with strong UI/UX.

Implement `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md` fully.

Scientific correctness remains non-negotiable, but interface quality is also an acceptance requirement because bad UX can cause configuration mistakes, protocol mistakes, accidental reveal, incomplete reports, and unusable evidence review.

The owner must be able to perform all primary workflows without reading source code or raw JSON.

---

# 5. Visual direction

Use a modern, restrained, professional research-instrument aesthetic.

Prioritize:

- excellent typography;
- clear hierarchy;
- generous but efficient spacing;
- calm surfaces;
- consistent controls;
- strong readability;
- obvious primary actions;
- clear scientific status communication;
- low cognitive load;
- progressive disclosure.

Avoid:

- default browser-form appearance;
- giant dense admin tables everywhere;
- science-fiction visual gimmicks;
- unnecessary gradients;
- excessive animation;
- confusing icon-only actions;
- clutter;
- decorative visuals that obscure evidence.

Build a small reusable design system using CSS variables/tokens and reusable components/patterns.

---

# 6. Required main navigation

The primary navigation must include:

1. `Start Research Session`
2. `Audio Lab`
3. `Experiment Profiles`
4. `Calibration`
5. `Sessions & Reports`

The navigation must remain stable and easy to understand.

Advanced configuration must not clutter the main participant path.

---

# 7. Start Research Session — mandatory guided workflow

This is a critical product flow and must be carefully designed.

Use a multi-step guided workflow with visible progress.

At minimum:

## Step 1 — Experiment Profile

Allow profile selection with concise human-readable information:

- name;
- purpose;
- profile status;
- timing mode;
- outcome space;
- request assignment;
- selected audio/pool;
- reveal policy.

Provide a details view without forcing the user into raw configuration.

## Step 2 — Pre-session State

Collect required participant baseline fields with appropriate controls.

Use well-designed grouped inputs.

Do not force unnecessary fields.

## Step 3 — Assigned Target / Encoding

Resolve the configured objective request assignment.

Display the participant-facing target prominently.

Display the configured encoding instructions clearly.

Require explicit memory confirmation.

Do not expose hidden future machine outcome or blinded condition metadata.

## Step 4 — Readiness Review

Show a polished preflight summary:

- profile;
- assignment policy;
- participant-facing target;
- timing semantics;
- output policy;
- random source;
- session protocol;
- selected audio;
- audio verification state;
- analysis plan;
- reveal policy.

Human-readable values first.

Exact IDs, versions, hashes, and effective JSON belong in an advanced expandable section.

START must remain disabled if validation fails.

Validation errors must be specific and actionable.

## Step 5 — Commit / Start

After commitment, visually communicate that the session configuration is frozen.

Use one dominant `START SESSION` action.

Prevent double-start.

After START, transition to the hands-free screen.

---

# 8. Hands-free active session

After START, the active altered-state workflow must require no normal screen interaction until return.

The active screen must be minimal, calm, and non-contaminating.

Do not show:

- hidden machine output;
- live success/failure;
- live trend charts;
- hidden condition labels;
- debug information;
- any feedback not explicitly allowed by the selected protocol.

Audio, cues, stages, timing, machine-output logging, and return cue must execute automatically.

A software stop action may exist as an optional convenience, but physical safe return must not depend on using it.

---

# 9. Post-return raw report — high-quality UX required

Immediately after return, route to the raw report before any hidden result is revealed.

The report workflow must support:

- logical sections;
- autosaved mutable draft before lock;
- clear completion state;
- `Unknown` and `Not experienced` options where appropriate;
- high-quality rating controls;
- spacious free-text areas;
- subjective timeline capture;
- subjective-time estimate before actual duration display;
- request encoding modality;
- state, imagery, auditory, somatic, vestibular, affect, agency, interruption, forgotten-target, and abort fields required by active protocol.

Before lock, explain clearly that locking creates the immutable raw record.

Use a deliberate `LOCK RAW REPORT` confirmation.

After lock:

- the raw report becomes read-only;
- display a clear locked state;
- later additions are append-only late recollections/notes;
- no in-place editing is possible.

---

# 10. Reveal UX

Reveal only when the server-side reveal gate permits it.

The reveal page should clearly show:

- objective requested state;
- participant-facing target;
- generated result;
- primary endpoint result;
- relevant stream summary;
- timing status;
- protocol deviations;
- integrity status.

Use neutral scientific presentation.

Do not use confetti, dramatic animations, or language that implies proof of a mechanism.

A single match must not be presented as evidence that a condition is established as effective.

---

# 11. Sessions & Reports — mandatory audit workspace

Build a polished session browser.

The owner must be able to review every session, including:

- complete;
- incomplete;
- aborted;
- failed;
- protocol-deviation;
- integrity-failed.

The main session list must support practical filtering/search by at least:

- date;
- profile;
- status;
- audio;
- timing mode;
- integrity;
- completion/abort;
- result category after reveal eligibility.

Do not hide failed/aborted sessions by default.

Session detail should use a strong information architecture such as tabs:

1. `Overview`
2. `Timeline`
3. `Machine Output`
4. `Raw Report`
5. `Analysis`
6. `Audio & Configuration`
7. `Integrity`
8. `Files / Export`

---

# 12. Timeline view

Render the session event chain in a human-readable timeline.

Make it easy to identify:

- session commitment;
- start;
- audio start;
- stage/cue transitions;
- request start/end;
- release start/end;
- analysis windows;
- target events;
- return cue;
- return confirmation;
- raw report start/lock;
- reveal;
- warnings/errors;
- timing deviations;
- abort/incomplete events.

Exact timestamps must be available without overwhelming the default view.

---

# 13. Machine-output visualization

For stream profiles, provide readable deterministic visualizations.

At minimum where applicable:

- total zero/one counts;
- requested-direction deviation;
- cumulative deviation over time;
- fixed-window deviations;
- primary request/immediate region;
- exploratory pre/post regions;
- threshold markers;
- change-point marker when declared;
- peak-deviation time;
- persistence/return-to-baseline indicators.

Primary and exploratory regions must be visually distinct and explicitly labeled.

Never make the strongest exploratory window visually appear to be the primary endpoint.

Provide numerical/table equivalents alongside charts where practical.

---

# 14. Reports — mandatory presentation quality

Deterministic reports must not be raw JSON dumps.

Build polished human-readable reports with at least:

- report header;
- session/profile identity;
- status;
- integrity summary;
- factual session summary;
- primary endpoint;
- timing;
- machine output;
- participant state;
- subjective time vs actual time;
- protocol deviations;
- audio condition;
- configuration/version information;
- exploratory findings;
- hashes/integrity;
- analysis/report version.

Use clean tables where appropriate.

Use charts where they materially improve understanding.

Charts must have labeled axes, units, titles, legends where needed, and truthful scales.

Add print-friendly report styling.

---

# 15. Cross-session / block reporting

Build deterministic comparison views for scientifically compatible sessions.

Support useful comparison of:

- profile;
- audio condition;
- objective requested state;
- human mapping;
- request encoding;
- timing policy;
- request-direction performance;
- state intensity;
- subjective-time distortion;
- onset timing;
- abort rate;
- forgotten-target rate;
- integrity/protocol deviations.

Do not silently pool materially incompatible configurations.

Explain incompatibility when sessions are excluded from a comparison.

Do not label one condition `better` from one session.

---

# 16. Experiment Profiles — polished configuration UX

The engine remains highly configurable, but the editor must not become a wall of controls.

Provide:

- profile list;
- status labels;
- duplicate;
- compare versions;
- edit-as-new-version;
- validate;
- human-readable summary;
- effective configuration preview;
- read-only effective JSON.

Organize editing into sections:

1. Identity
2. Request Assignment
3. Outcome Space
4. Participant Mapping
5. Request Encoding
6. Timing
7. Machine Output
8. Random Source
9. Session Protocol
10. Audio
11. Analysis
12. Reveal
13. Reporting

Use progressive disclosure.

Material changes create new immutable config versions.

Never silently mutate a configuration already referenced by a committed session.

---

# 17. Audio Lab — excellent usability required

The Audio Lab must be both powerful and easy.

Top-level modes:

1. `Presets`
2. `Quick Generator`
3. `Simple Custom`
4. `Advanced Custom`
5. `Historical / Layered Reconstruction`

The three initial presets must remain one-click usable:

- A-U396-4: center 396, beat 4, left 394, right 398;
- A-P100-104: explicit left 100 / right 104;
- A-SHAM-0: left 396 / right 396.

For quick centered generation, the user normally enters one center value only and the template derives left/right automatically.

Show derived values immediately.

Provide high-quality transport controls:

- Play;
- Pause;
- Resume;
- Stop;
- elapsed time;
- selected recipe/status.

Audio Lab live preview remains unlimited until manually stopped.

Clearly separate:

- temporary live preview;
- saved versioned recipe;
- formal rendered session artifact.

An unsaved preview must never silently enter a formal committed session.

---

# 18. Historical / layered audio UX

Implement `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md` fully.

The interface must clearly distinguish:

- simple binaural component tests;
- documented patent examples;
- patent-grounded reconstructions;
- MIP experimental reconstructions;
- historical candidates with incomplete parameters;
- source-verified historical reconstructions.

Never represent a simple binaural pair as a complete historical Hemi-Sync environment.

For incomplete CENTER LANE candidates, show missing fields explicitly.

Do not silently infer unknown channel frequency, level, phase, noise, modulation, sequence, or timing.

---

# 19. Formal layered-audio render workflow

Provide a guided formal render workflow:

1. choose versioned recipe;
2. derive/select formal duration/timeline;
3. review exact synthesis inputs;
4. render deterministic stereo artifact;
5. generate manifest;
6. run automatic verification;
7. show verification checklist;
8. generate audio, manifest, and verification hashes;
9. mark artifact eligible/ineligible for formal session.

A failed or missing formal render must prevent formal-session START.

During formal use, play the exact frozen artifact and log playback start/end/error.

Do not retune/regenerate after commitment.

---

# 20. Mandatory complex audio engine

Do not reduce Hemi-Sync reconstruction to two pure tones.

The first build must implement the active layered synthesis requirements, including supported data-driven primitives for:

- multiple simultaneous carriers;
- binaural relationships;
- monaural relationships;
- component gain;
- phase;
- envelopes;
- AM;
- FM;
- deterministic noise;
- pink/red noise;
- phased/swept pink architecture;
- delay line;
- comb filtering;
- low-frequency delay sweep;
- Septon/multi-carrier structures;
- fades;
- normalization/headroom;
- cue support.

Implement the recoverable `PHASED_PINK_PATENT_5356368` capability now, including the documented/recoverable deterministic 16-bit shift-register mode, described 65,535-sample behavior, pink/red filtering, delay/comb processing, sweep near 1/8 Hz, stereo phase/amplitude relationship, envelope, and documented AM/FM/multi-carrier capabilities.

Unknown historical coefficients remain explicitly reconstructed/unknown rather than silently invented.

---

# 21. Inputs — mandatory quality

All inputs must be designed intentionally.

Requirements:

- visible labels;
- appropriate control type;
- units shown;
- safe defaults only;
- immediate client guidance where useful;
- authoritative server-side validation;
- inline actionable errors;
- exact values visible for sliders;
- timezone context for date/time inputs;
- no placeholder-only field labeling;
- no silent coercion of scientifically invalid values;
- confirmation for locking/destructive actions.

Normal user workflows should not require typing long configuration IDs.

---

# 22. Status communication

Use explicit status labels throughout the application, such as:

- Draft
- Validated
- Committed
- Running
- Returned
- Raw Report Pending
- Raw Report Locked
- Reveal Eligible
- Revealed
- Completed
- Aborted
- Incomplete
- Protocol Deviation
- Integrity Verified
- Integrity Failed

Do not rely on color alone.

---

# 23. Errors and recovery

Errors must identify what actually failed and what the user should do next.

Preserve evidence on failures.

For session-critical failures show:

- failure reason;
- whether data are preserved;
- whether continuation is allowed;
- recovery action;
- expandable technical details.

Do not replace specific validation errors with generic `Invalid configuration` messages.

---

# 24. Accessibility and keyboard usability

Implement reasonable first-build accessibility:

- semantic HTML;
- keyboard navigation;
- visible focus indicators;
- properly associated labels;
- sufficient contrast;
- large critical controls;
- status communicated by more than color;
- chart data available numerically where practical.

---

# 25. Performance / large-log UX

Do not freeze the browser by loading huge raw-output files at once.

Use appropriate pagination, chunked loading, server-side summaries, or display sampling while keeping the complete raw evidence on disk.

Raw evidence integrity must never be sacrificed for UI performance.

---

# 26. Scientific engine requirements remain fully mandatory

Everything in v0.9 and inherited active specifications remains mandatory, including:

- configuration-driven stable engine;
- immediate timing;
- next eligible output;
- relative timing;
- absolute date/time;
- temporal windows;
- pre-generated hidden mode;
- continuous hidden stream;
- objective-state / participant-mapping separation;
- binary and larger outcome spaces through at least 30 bits;
- unbiased cryptographic random sampling;
- deterministic test random provider;
- future hardware RNG provider abstraction;
- calibration;
- block/session/trial identity;
- immutable session configuration snapshots;
- append-only hash-chained event logs;
- lossless raw machine-output evidence;
- timing integrity/deviation logging;
- crash/incomplete-session preservation;
- raw-report immutable lock;
- server-side reveal gating;
- subjective time before actual time display;
- deterministic analysis;
- deterministic reports;
- cross-session compatibility rules;
- complete session export/integrity verification;
- formal layered audio render/verify/hash/freeze;
- no mobile app;
- no cloud;
- no database;
- no custom Bluetooth protocol;
- no runtime generative AI dependency.

---

# 27. Required UI/UX tests / demonstrations

Before owner review, demonstrate and document:

1. all visible UI is English-only;
2. the main navigation is polished and consistent;
3. the design system is reused across screens;
4. Start Research Session works end-to-end;
5. target memory confirmation is clear;
6. preflight summary is understandable;
7. invalid profiles block START with specific errors;
8. hands-free screen is minimal and non-contaminating;
9. post-return report works without reveal leakage;
10. autosave draft works;
11. immutable raw-report lock works;
12. reveal UX respects server gate;
13. Sessions & Reports list supports practical filters;
14. session detail views are readable;
15. event timeline is understandable;
16. machine-output charts distinguish primary vs exploratory regions;
17. deterministic report is polished and print-friendly;
18. integrity review is understandable;
19. session export works;
20. profile editing uses progressive disclosure;
21. Audio Lab presets are one-click usable;
22. Quick Generator derives channels automatically;
23. simple custom audio is usable;
24. advanced audio is organized rather than dumped into one form;
25. historical/layered audio provenance is obvious;
26. formal render verification has a clear pass/fail workflow;
27. calibration UI is usable;
28. empty/loading/error states are implemented;
29. keyboard navigation works for core flows;
30. a narrower browser-window usability pass is completed.

Routes existing without good usability do not satisfy this requirement.

---

# 28. Full scientific acceptance tests remain mandatory

Run all tests required by v0.9/v0.8 and active engineering specifications.

This includes, but is not limited to:

- profile configuration-only future-proofing;
- binary -> four-outcome transition;
- literal -> arbitrary mapping;
- reversed mapping;
- immediate -> relative -> absolute timing;
- timing fake-clock tests;
- scheduler lateness/deviation behavior;
- unbiased RNG range generation;
- 30-bit exact-token boundaries;
- deterministic seeded provider;
- hands-free flow;
- hidden result non-leakage;
- report lock;
- event hash chain;
- corruption detection;
- lossless machine-output reconstruction;
- trend/onset analysis;
- primary-window immutability;
- old-session re-verification after config evolution;
- audio preset frequency correctness;
- unlimited Audio Lab playback;
- deterministic formal render;
- Septon render;
- phased-pink patent-grounded render;
- deliberate audio-corruption detection;
- formal START refusal on invalid/missing audio artifact.

---

# 29. Implementation documentation

Document fully:

- prerequisites;
- install;
- test command;
- run command;
- local URL;
- runtime data root;
- directory structure;
- architecture;
- design system/UI structure;
- configuration registries;
- profile creation/versioning;
- session lifecycle;
- hands-free behavior;
- raw-report lock;
- reveal gate;
- RNG providers;
- timing modes;
- outcome spaces;
- mappings;
- Audio Lab;
- audio recipes;
- formal layered render;
- render verification;
- calibration;
- Sessions & Reports;
- integrity verification;
- export;
- known limitations;
- historical audio parameters still unknown;
- intentionally deferred mobile/hardware/sensor work.

A new developer should be able to run and understand the application without reading source code first.

---

# 30. Dry-run requirement

Before owner review:

- run the full automated test suite;
- generate a no-participant calibration bundle;
- generate a complete dry immediate binary session;
- demonstrate relative-delay timing;
- demonstrate absolute-time timing;
- demonstrate arbitrary/reversed mapping;
- verify the three simple audio presets;
- verify Quick Generator;
- verify unlimited Audio Lab playback controls;
- render and verify required formal deterministic audio fixtures;
- render Septon fixture;
- render phased-pink patent-grounded fixture;
- test corrupted-audio rejection;
- verify hands-free session state machine;
- lock raw report;
- verify server-side reveal gate;
- generate deterministic analytical report;
- verify event/file hashes;
- verify Sessions & Reports review flow;
- demonstrate session export/integrity verification.

Do not launch a real participant session automatically.

---

# 31. Completion report

At completion, produce a precise implementation report.

For every mandatory requirement, classify it as exactly one of:

- `Implemented and tested`
- `Implemented but requires owner manual verification`
- `Explicitly deferred by active scope`
- `Blocked — exact reason`

Do not use vague wording such as `supported in principle` for a mandatory feature.

Report:

- files changed/created;
- final architecture;
- exact install command;
- exact test command;
- exact run command;
- number of tests;
- pass/fail results;
- dry-run artifacts;
- calibration artifact;
- audio fixtures and hashes;
- UI/UX acceptance demonstrations;
- configuration-only future-proofing demonstrations;
- timing demonstrations;
- mapping demonstrations;
- logging/integrity demonstrations;
- report/review demonstrations;
- known limitations;
- unresolved historical audio parameters;
- anything requiring owner review before participant use.

Do not stop after writing architecture notes.

Continue until implementation, automated tests, dry runs, documentation, UI/UX review, logging/integrity review, audio verification, reporting, and completion report are finished or a specific requirement is genuinely blocked.

Do not automatically run a real participant session.
