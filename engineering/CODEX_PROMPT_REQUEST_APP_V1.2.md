# Codex Prompt — MIP Desktop Research Engine v1.2

## ACTIVE ELECTRON MIGRATION AND COMPLETION PROMPT

You are the implementation agent for `rezamr/MIP`.

Your task is to migrate and complete the current v1.1 implementation as a modular Electron desktop application with SQLite evidence storage and AudioWorklet-based real-time synthesis.

This is not a visual wrapper around the existing localhost application.

This is not permission to discard valid research-engine work and restart casually.

The implementation baseline is the remote branch:

`fix-v1.1`

at the preserved baseline commit:

`7de6d629e76433ec7c06443810f658599a50084c`

The earlier pre-fix checkpoint remains:

`pre-fix-v1.0-checkpoint`

at:

`a683418ff3b9d9096070c76c94fcaac5db78aa56`

Preserve those historical branches.

Create a new implementation branch from the current `fix-v1.1` HEAD, for example:

`feature/electron-v1.2`

Do not implement directly on `main`.

Before coding, fetch the latest `main` and ensure the new v1.2 authority documents are present in your implementation branch without discarding the v1.1 implementation baseline.

---

# 1. Mandatory reading

Read the repository startup sequence and all active implementation requirements before changing code.

At minimum read in full:

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
11. `engineering/CODEX_PROMPT_REQUEST_APP_V1.2.md`
12. `engineering/ELECTRON_DESKTOP_ARCHITECTURE_V0.1.md`
13. `engineering/SQLITE_EVIDENCE_STORAGE_REQUIREMENTS_V0.1.md`
14. `engineering/AUDIOWORKLET_REALTIME_AUDIO_REQUIREMENTS_V0.1.md`
15. `engineering/DEPLOYMENT_SCOPE_DECISION_V0.2.md`
16. `engineering/CODEX_PROMPT_REQUEST_APP_V1.1.md`
17. `engineering/CODEX_PROMPT_REQUEST_APP_V1.0.md`
18. `engineering/UI_UX_PRODUCT_REQUIREMENTS_V0.1.md`
19. `engineering/LIVE_AUDIO_SYNTHESIS_RUNTIME_REQUIREMENTS_V0.1.md`
20. `engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md`
21. `engineering/AUDIO_LAB_AND_QUICK_PLAYER_REQUIREMENTS_V0.1.md`
22. `engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md`
23. `engineering/CONFIG_DRIVEN_EXPERIMENT_ENGINE_V0.2.md`
24. `engineering/REQUEST_TEST_APP_SPEC_V0.2.md`
25. `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`
26. `engineering/HANDS_FREE_SESSION_REQUIREMENTS_V0.1.md`
27. `engineering/HUMAN_ENCODING_AND_MAPPING_REQUIREMENTS_V0.1.md`
28. `engineering/SESSION_TELEMETRY_AND_REPORTING_V0.1.md`
29. all active protocol files referenced by those documents.

Inspect the complete `fix-v1.1` implementation before migration.

---

# 2. Authority

v1.2 is the active implementation prompt.

Where v1.2 changes v1.1 or earlier implementation constraints, v1.2 wins.

In particular v1.2 supersedes:

- browser + localhost server as the production runtime;
- no-database restriction;
- JSON/JSONL as the primary runtime datastore;
- `ScriptProcessorNode` for live audio;
- renderer/browser memory as authoritative session state;
- `server-side` wording where the Electron equivalent is the privileged main process.

Scientific/protocol meaning from active MIP requirements remains binding.

Do not silently invent a new scientific protocol while performing the software migration.

---

# 3. First perform a code audit

Before refactoring, explicitly identify current v1.1 technical debt that must not be carried forward.

Known issues that must be verified in code include:

1. current live playback uses `createScriptProcessor(...)` / `onaudioprocess` and must be removed from active playback;
2. owner observed intermittent millisecond crackle/static even on simple 394/398 playback;
3. current formal hands-free screen does not actually drive the live synth from the committed session recipe;
4. current formal generated-stream digest is not connected to authoritative session evidence;
5. current `LiveSynth` uses a non-cryptographic short checksum for block digest and that must not be used as formal integrity evidence;
6. current audio implementation does not model independently stateful channel/component phases generally enough for advanced recipes;
7. current session creation must be audited for any `Math.random()` use in formal target/RNG semantics; formal research randomness must use the configured RNG provider, not `Math.random()`;
8. current session output generation must be audited for whether it generates the entire stream immediately instead of according to the real configured session/timing state machine;
9. current profile editor is incomplete;
10. current calibration history is not authoritative/persistent enough;
11. current report graphs are incomplete;
12. current runtime data model depends on JSON/JSONL files and in-memory Maps.

Document the audit findings in the completion report and fix them rather than merely moving them into Electron.

---

# 4. Electron desktop architecture

Implement `engineering/ELECTRON_DESKTOP_ARCHITECTURE_V0.1.md` fully.

Production architecture must contain clear modules for:

- Electron main process;
- preload bridge;
- renderer/UI;
- SQLite repositories/services;
- authoritative session controller/state machine;
- RNG providers;
- integrity/hashing;
- profiles/configuration;
- calibration;
- analysis;
- reporting;
- export/backup;
- AudioWorklet real-time synthesis;
- optional workers for heavy non-real-time tasks.

Do not replace one monolithic browser file with one monolithic Electron file.

Refactor into maintainable modules.

---

# 5. Remove the localhost production server

The packaged app must not require:

- `http://127.0.0.1:3210`;
- opening Chrome/Edge manually;
- REST calls between renderer and backend;
- a local HTTP server for ordinary production operation.

Migrate current API behavior into constrained Electron IPC/domain services.

Development tooling may use a dev server if required by the build system, but the packaged production application must be serverless from the owner's perspective.

---

# 6. Electron security

Use a secure Electron configuration.

Mandatory:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- sandbox renderer where compatible;
- minimal preload `contextBridge` API;
- no generic arbitrary IPC channel exposed to renderer;
- main-process validation for every IPC payload;
- no renderer SQL access;
- no renderer filesystem access;
- no hidden objective/result pushed to renderer before reveal eligibility;
- restrictive navigation/window-open policy;
- restrictive CSP;
- local packaged application resources.

The main process is the authoritative reveal gate.

---

# 7. SQLite is now the authoritative runtime datastore

Implement `engineering/SQLITE_EVIDENCE_STORAGE_REQUIREMENTS_V0.1.md` fully.

Use a database adapter/repository architecture.

Select the exact SQLite binding based on the chosen Electron runtime:

- prefer a stable built-in Node/Electron SQLite API if production-stable in that exact runtime;
- otherwise use `better-sqlite3` or another mature local binding and configure Electron rebuild/packaging correctly.

State the exact driver choice in the completion report.

Do not use browser localStorage or an in-memory/WASM browser database as authoritative evidence storage.

---

# 8. Required SQLite evidence model

At minimum implement persistent entities for:

- sessions;
- trials;
- blocks;
- immutable session commitments;
- append-only evidence events;
- lossless machine outputs;
- raw-report drafts;
- immutable locked raw reports;
- append-only late annotations;
- experiment profile identities and immutable versions;
- audio recipe identities and immutable versions;
- calibration runs/history;
- deterministic analysis results/versions;
- schema migrations;
- integrity/backup metadata where appropriate.

Use database-level triggers/constraints to reject UPDATE/DELETE on immutable evidence tables.

Mutable status/projection tables are allowed, but they are not primary history.

---

# 9. Database durability and crash recovery

Use appropriate SQLite durability settings for a local research instrument.

At minimum:

- foreign keys enabled;
- WAL where supported;
- strong synchronous durability for formal evidence writes;
- transactions around critical transitions;
- migrations;
- startup recovery scan;
- no silent data loss after crash/restart.

Implement backup and restore safeguards.

Provide an explicit legacy importer for existing v1.0/v1.1 runtime JSON/JSONL session bundles.

Do not silently delete old local runtime data.

---

# 10. Preserve tamper-evident evidence semantics

Moving to SQLite does not mean ordinary mutable logging.

Keep the authoritative hash-chained event model.

Use real SHA-256 over stable canonical serialization.

Preserve:

- sequence numbers;
- previous hash;
- current event hash;
- monotonic and UTC timestamps;
- immutable commitments;
- raw-report lock hash;
- machine-output integrity;
- final evidence verification.

A user must never be able to edit primary evidence in place from the UI.

Late notes/recollections are append-only records.

---

# 11. AudioWorklet migration is mandatory

Implement `engineering/AUDIOWORKLET_REALTIME_AUDIO_REQUIREMENTS_V0.1.md` completely.

Remove active use of:

- `ScriptProcessorNode`;
- `createScriptProcessor`;
- `onaudioprocess`

from real playback paths.

Use an `AudioWorkletProcessor` for actual live synthesis.

Renderer UI activity must not generate the next sample block.

---

# 12. Fix the crackle/static problem as an acceptance issue

The owner has already heard intermittent millisecond static/click/crackle artifacts during the simple `A-U396-4` 394/398 condition.

Treat this as a real defect.

Do not label it part of Hemi-Sync or the intended signal.

The Electron/AudioWorklet implementation must include:

- de-click start/stop/pause/resume ramps;
- persistent worklet synthesis state;
- correct independent phase accumulators;
- clipping/headroom controls;
- a master gain control;
- real-time health telemetry;
- stress testing while UI is busy;
- long-duration soak testing.

If physical Bluetooth artifacts remain after software timing is clean, clearly distinguish device/OS-path artifacts from synthesis-engine defects.

---

# 13. Audio Health Check

Add a dedicated polished Audio Health Check.

It must be available before a formal session and from Audio Lab.

Support at minimum:

- 60-second quick check;
- 10-minute stability check;
- 60-minute owner soak check;
- default simple reference `A-U396-4`;
- engine telemetry;
- context state;
- sample rate;
- latency values if available;
- generated frame continuity;
- clipping warnings;
- owner outcome: Clean / Artifact heard / Left-right issue / Uncertain;
- owner note;
- persistent diagnostic/calibration record in SQLite.

This is not participant research evidence.

Before first real session, owner physical verification remains required.

---

# 14. One audio synthesis core

Preserve one versioned synthesis semantics library for:

- simple presets;
- Quick Generator;
- Simple Custom;
- Advanced Custom;
- layered Hemi-Sync;
- Septon;
- phased-pink reconstruction;
- formal sessions;
- optional WAV/export/offline verification.

Do not implement different equations in Audio Lab and formal sessions.

Offline fixed-length deterministic output must be usable as a regression oracle for the real-time engine.

---

# 15. Formal session audio must actually run

The formal hands-free flow must no longer merely claim that audio is running.

At formal commitment:

- resolve exact audio recipe/version;
- validate it;
- freeze parameters;
- freeze deterministic seed/state;
- store canonical committed audio configuration in SQLite;
- prepare/prewarm the AudioContext/AudioWorklet from the START user gesture;
- obtain an explicit PROCESSOR_READY/AUDIO_READY handshake.

At the protocol-defined audio anchor:

- actually start the worklet;
- record AUDIO_START acknowledgement;
- continue live during the hands-free session;
- generate cues from committed timeline semantics;
- finalize generated frame count and cryptographic stream digest;
- persist audio errors/deviations.

If audio preparation fails, formal START must fail safely rather than continuing with a false `audio running` message.

---

# 16. Cryptographic audio stream integrity

Replace the current short/custom block checksum as formal evidence.

Use SHA-256 for the authoritative generated PCM stream digest.

Define and document the exact canonical PCM byte format being hashed.

The hashing implementation must not cause worklet deadline failures.

Benchmark it.

Store in formal evidence:

- audio engine version;
- recipe/version;
- sample rate;
- seed/initial state reference;
- total generated frames;
- stream SHA-256;
- start/end timing;
- processor warnings/errors;
- cue timing;
- detected internal continuity anomalies.

Do not claim this digest proves the exact physical acoustic waveform emitted by a Bluetooth headset.

---

# 17. Correct formal RNG behavior

Audit and eliminate `Math.random()` from all formal research-semantic randomness.

Formal target assignment/output generation must use the configured provider:

- OS cryptographic RNG for production profiles;
- deterministic seeded provider for tests/fixtures.

`Math.random()` may be used only for irrelevant UI decoration where it cannot affect research evidence, preferably not at all.

Add a test that scans/guards critical modules against accidental formal `Math.random()` use.

---

# 18. Real session timing/state machine

Do not generate an entire multi-stage session stream immediately inside a synchronous START handler and then show a fake hands-free screen.

Implement an actual session controller that respects the configured stage/timing model.

The main process owns authoritative named events and transition times.

Machine output must be generated according to the selected output/timing policy at actual configured times.

The renderer displays the hands-free state but is not the authoritative timer.

Record scheduled and actual event times separately.

Use monotonic time for durations.

Use Electron power-save blocking during active formal sessions and record relevant power/suspend events.

---

# 19. Finish Experiment Profiles

The v1.2 Electron build must finish the profile editor.

Provide polished UI for:

- browse profiles;
- inspect version/provenance/status;
- duplicate;
- edit supported fields;
- progressive disclosure for advanced settings;
- validate;
- view material differences;
- save as a new immutable version;
- activate/select;
- never mutate a version used by committed evidence.

Persist profile versions in SQLite.

Raw canonical configuration view may exist as an expert/read-only view.

---

# 20. Finish Audio Recipe Library

Create a real Audio Recipe Library, not only a few hardcoded buttons.

Provide:

- recipe list;
- provenance/status;
- search/filter;
- duplicate;
- edit supported primitives;
- validate;
- save new immutable version;
- audition live;
- Audio Health Check;
- optional deterministic export;
- exact effective configuration view;
- historical incomplete candidates clearly disabled/marked incomplete.

Initial presets remain:

- `A-U396-4` = 394/398;
- `A-P100-104` = exact 100/104;
- `A-SHAM-0` = 396/396.

Historical unknown CENTER LANE parameters must not be invented.

---

# 21. Finish Calibration

Calibration must be authoritative and persistent in SQLite.

Implement actual RNG sampling rather than a UI-generated fake half-zero/half-one summary.

Persist:

- provider/version;
- sample count;
- actual counts/distribution;
- timing;
- metadata;
- result hash;
- integrity state.

Show polished calibration history and charts.

Calibration remains separate from participant sessions.

---

# 22. Finish Sessions & Reports

The desktop report workspace must be a genuine research-review tool.

Preserve/finish:

- Overview;
- Timeline;
- Machine Output;
- Raw Report;
- Analysis;
- Audio & Configuration;
- Integrity.

Add real charts instead of primarily raw JSON dumps.

At minimum visualize where applicable:

- output over time;
- requested-direction cumulative deviation;
- pre/request/post regions;
- declared primary region;
- exploratory regions clearly distinguished;
- peak deviation;
- threshold crossing;
- sustained crossing if implemented by active analysis version;
- change-point estimate;
- onset/latency;
- persistence/return toward baseline.

Large datasets must use pagination/decimation for display without altering stored raw evidence.

---

# 23. Preserve raw-report/reveal integrity

Raw-report draft remains mutable until lock.

Locked raw report is immutable.

Late recollections/notes are append-only.

Reveal eligibility is enforced by the Electron main process.

Before eligibility, hidden objective/result information must not be transferred to renderer memory.

Add explicit IPC-level tests for this.

---

# 24. UI/UX remains a hard acceptance gate

Keep the application English-only.

The desktop app must feel like a polished research instrument, not a browser page embedded in Electron.

Preserve useful visual work from v1.1 but redesign interactions where required.

Required quality:

- clear desktop navigation;
- professional input controls;
- consistent design system;
- excellent session-start flow;
- excellent Audio Lab/Recipe Library;
- excellent calibration view;
- excellent report charts/tables;
- useful loading/empty/error states;
- keyboard accessibility;
- narrow-window resilience;
- clear integrity warnings;
- no critical workflow controlled only by toast messages.

---

# 25. Application data management

Provide a Settings/Data section appropriate to the local desktop app.

At minimum expose:

- application version;
- engine version;
- database schema version;
- database location (read-only display/copy path);
- database size;
- Backup Now;
- backup history/status;
- Restore from Backup with safety confirmation;
- Export Session;
- Legacy JSON/JSONL Import;
- diagnostics/log export.

Do not expose arbitrary destructive database editing.

---

# 26. Windows packaging

Produce a Windows desktop build that launches like an ordinary application.

The owner must not need to:

- run `npm start`;
- open a terminal;
- open a browser;
- navigate to localhost.

Document:

- development run;
- tests;
- packaging;
- installer/portable artifact location;
- application data location;
- database location;
- backup/export behavior.

---

# 27. Testing strategy

Expand tests substantially beyond the current small suite.

Required categories:

- engine unit tests;
- profile validation/versioning tests;
- RNG tests;
- SQLite repository tests;
- migration tests;
- immutable evidence trigger tests;
- hash-chain tests;
- crash/recovery tests;
- reveal-gate IPC tests;
- session state-machine timing tests with controllable fake clock where appropriate;
- AudioWorklet DSP-core tests;
- offline/live deterministic parity tests;
- stream SHA-256 tests;
- de-click tests;
- calibration tests;
- analysis tests;
- report-query tests;
- Electron integration tests;
- renderer end-to-end tests;
- packaging smoke test.

Do not declare audible success from unit tests alone.

---

# 28. Audio stress/soak acceptance

Software acceptance must include:

- simulated/heavy renderer UI activity while worklet runs;
- report navigation while Audio Lab runs;
- window minimize/restore;
- app focus changes;
- at least a 10-minute automated/staged audio soak;
- no internally detected worklet continuity errors;
- no clipping under shipped presets;
- deterministic fixture digest verification.

Owner-manual acceptance before a real participant session must still include:

- 60-minute simple 394/398 soak on intended hardware;
- wired comparison if available;
- Bluetooth comparison;
- left/right channel confirmation;
- confirmation that no distracting crackle/pop is heard.

If owner physical verification has not occurred, classify that item as requiring owner manual verification.

---

# 29. Legacy v1.1 preservation

Do not delete the historical `fix-v1.1` and `pre-fix-v1.0-checkpoint` branches.

Do not silently rewrite old JSON/JSONL runtime bundles.

Provide explicit legacy import.

Do not commit real runtime participant/session evidence to Git.

---

# 30. Do not start a real participant session

During implementation use:

- tests;
- fixtures;
- dry sessions;
- synthetic data;
- calibration;
- Audio Health Check;
- non-participant demos.

Do not automatically run a real altered-state participant session.

---

# 31. Completion report

Do not stop after architecture/scaffolding.

Continue through implementation, migration, tests, packaging, and documentation.

At completion report:

1. source baseline branch/commit;
2. new Electron implementation branch/commit;
3. files/modules added/changed;
4. final process/module architecture;
5. exact Electron version;
6. exact Node runtime version embedded by Electron;
7. exact SQLite driver and reason;
8. database schema/migration version;
9. development run command;
10. test command;
11. packaging command;
12. Windows artifact path/name;
13. total automated tests and pass/fail;
14. Electron integration/E2E results;
15. AudioWorklet confirmation and proof `ScriptProcessorNode` is absent from active playback;
16. 394/398 software soak result;
17. Septon/phased-pink tests;
18. stream SHA-256 method and benchmark;
19. formal-session audio handshake test;
20. formal session timing/state-machine test;
21. SQLite immutability tests;
22. crash/restart recovery test;
23. reveal-gate IPC test;
24. profile editor verification;
25. Audio Recipe Library verification;
26. calibration persistence verification;
27. report/chart verification;
28. backup/restore verification;
29. legacy import verification;
30. owner-manual checks still required;
31. known limitations;
32. unresolved historical audio parameters.

For every mandatory item classify it as exactly one of:

- Implemented and tested
- Implemented but requires owner manual verification
- Explicitly deferred by active scope
- Blocked — exact reason

Do not use `should work`, `supported in principle`, `button wired`, or `route exists` as completion evidence.

Begin the v1.2 Electron migration and completion work now.