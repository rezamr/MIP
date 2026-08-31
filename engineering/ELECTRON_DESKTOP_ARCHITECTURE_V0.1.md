# MIP Electron Desktop Architecture v0.1

## Status

`ACTIVE — DESKTOP ARCHITECTURE REQUIREMENT`

## Decision

MIP is moving from a local-browser + HTTP-server application to a packaged Electron desktop application.

This is an architectural migration of the existing research engine, not a reset of the scientific project.

The implementation must preserve scientifically valid v1.1 behavior while replacing the browser/server runtime with a modular Electron desktop architecture.

The primary reasons are:

- a controlled single-application runtime;
- removal of the localhost HTTP server from ordinary operation;
- separation of UI, privileged storage, research execution, and real-time audio responsibilities;
- lower risk that renderer/UI activity disturbs live audio generation;
- reliable desktop packaging and startup;
- stronger control over session lifecycle, crash recovery, sleep prevention, and local evidence storage.

Electron is not adopted on the assumption that it inherently uses less memory than a browser. Electron embeds Chromium. The architectural benefit is control and process separation.

---

# 1. Required process architecture

The application must be modular and divided into explicit responsibilities.

## 1.1 Electron main process

The Electron main process owns privileged and authoritative operations:

- application lifecycle;
- window creation;
- SQLite database connection and migrations;
- append-only evidence writes;
- cryptographic hashing;
- session/trial/block allocation;
- random-source providers used by formal research;
- configuration/profile persistence;
- calibration persistence;
- reveal-policy enforcement;
- file export/import;
- backup/recovery;
- packaging/runtime paths;
- power-save blocking during active formal sessions;
- controlled IPC routing.

The main process must not contain large UI rendering logic.

## 1.2 Preload bridge

Use a minimal preload script with `contextBridge`.

Requirements:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- renderer sandbox enabled where compatible with required Electron APIs;
- no raw Node.js, filesystem, database, crypto, shell, or process object exposed to the renderer;
- expose only small, named, validated MIP operations;
- every privileged operation is validated in the main process again.

The renderer must never receive a generic `ipc.invoke(channel, arbitraryPayload)` escape hatch.

## 1.3 Renderer/UI process

The renderer owns presentation and user interaction only:

- navigation;
- forms;
- charts;
- session-start workflow;
- Audio Lab controls;
- reports;
- profile editor UX;
- calibration UX;
- integrity review UX.

It does not open the SQLite database directly.

It does not decide reveal eligibility.

It does not own authoritative session state.

## 1.4 Real-time audio worklet

All live synthesis used for actual playback must run through `AudioWorklet`, not `ScriptProcessorNode`.

The worklet owns real-time synthesis state:

- oscillator phases;
- noise generator state;
- filter state;
- delay/comb state;
- AM/FM state;
- envelopes;
- Septon/multi-carrier state;
- generated frame count;
- deterministic stream-integrity state/checkpoints;
- audio-engine timing telemetry.

UI work must not execute inside the real-time audio processor.

## 1.5 Optional computation workers

Analysis, export rendering, expensive report calculations, and other non-real-time CPU-heavy tasks should run in worker threads or renderer Web Workers where useful so they do not block:

- Electron main event handling;
- the UI renderer;
- the audio worklet.

Do not use a worker merely to create architectural complexity. Use it when the task can create visible/UI/audio blocking.

---

# 2. No localhost server in ordinary operation

The Electron application must not require:

- `npm start` launching an HTTP server for normal owner use;
- `127.0.0.1:3210`;
- browser navigation to a localhost URL;
- REST routes between the UI and local backend.

Migrate existing REST-style operations into typed/named Electron IPC services.

Optional development tooling may run a development server only if the chosen bundler requires it during development. The packaged production application must not depend on a localhost server.

---

# 3. Application loading

Prefer a local packaged application origin rather than arbitrary remote content.

A custom application protocol such as `mip://app/` may be registered as a secure/standard scheme to load:

- renderer assets;
- AudioWorklet modules;
- local application resources.

No remote web content is required for core application operation.

Set a restrictive Content Security Policy.

Disable arbitrary navigation and new-window creation unless an explicitly reviewed action requires it.

---

# 4. Module boundaries

The source tree should clearly separate concerns. An acceptable organization is conceptually:

```text
src/
  main/
    app/
    ipc/
    database/
    sessions/
    profiles/
    calibration/
    integrity/
    random/
    exports/
    power/
  preload/
  renderer/
    app/
    components/
    pages/
    charts/
    services/
    styles/
  audio/
    core/
    recipes/
    processors/
    worklet/
    validation/
    telemetry/
  shared/
    schemas/
    types/
    constants/
    canonicalization/
  analysis/
  tests/
```

Exact folder names may differ, but equivalent separation is mandatory.

Avoid returning to a single enormous `app.js`, `server.js`, or audio file that owns unrelated concerns.

---

# 5. Research engine separation

Experiment semantics must remain independent from Electron presentation.

The engine must remain usable through stable modules for:

- outcome spaces;
- mappings;
- request encodings;
- timing policies;
- machine-output policies;
- random providers;
- session protocol definitions;
- audio recipes;
- analysis plans;
- reveal policies;
- reporting profiles.

Electron is the deployment/runtime shell, not the definition of experiment meaning.

---

# 6. Session lifecycle

Formal session execution is coordinated by an authoritative main-process session controller.

The session controller owns the state machine and evidence transitions.

Example conceptual states:

```text
DRAFT
-> TARGET_ASSIGNED
-> READY
-> COMMITTED
-> AUDIO_PREPARED
-> RUNNING
-> RETURNED
-> RAW_REPORT_DRAFT
-> RAW_REPORT_LOCKED
-> REVEAL_ELIGIBLE
-> REVEALED
-> COMPLETE
```

Failure states remain evidence-bearing states, for example:

```text
ABORTED
INCOMPLETE
CRASH_RECOVERED
TIMING_DEVIATION
AUDIO_DEVIATION
INTEGRITY_FAILED
```

The renderer may request a transition, but the main process validates whether it is legal and records the transition authoritatively.

---

# 7. Formal-session power behavior

When a formal session enters the active hands-free portion:

- start an Electron `powerSaveBlocker` mode appropriate to preventing application/system suspension during the session;
- record whether the blocker was successfully acquired;
- release it after return/abort/finalization;
- log suspend/resume/power-monitor events that still occur;
- never silently fabricate outputs for a missed period.

Display sleep behavior may remain independent if it does not suspend the application/audio path.

---

# 8. Security boundaries

The application handles hidden outcomes and immutable evidence; therefore ordinary Electron security practices are mandatory.

At minimum:

- no Node integration in renderer;
- context isolation;
- minimal preload API;
- validate every IPC payload;
- no renderer access to raw database path;
- no renderer SQL execution;
- no arbitrary filesystem path operations;
- no hidden-result data sent to renderer before reveal eligibility;
- do not place objective hidden state in DOM, renderer cache, preload globals, or developer-facing renderer payloads before reveal eligibility;
- disable remote-module-style behavior;
- restrictive navigation/window-open handlers;
- local-only application resources by default.

The old phrase `server-side reveal gate` maps in Electron to an **authoritative main-process reveal gate**.

---

# 9. Packaging

The first desktop packaging target is Windows because the current owner environment is Windows.

The architecture must not intentionally prevent later macOS/Linux packaging, but cross-platform installers are not required before the Windows build is stable.

Provide:

- development run command;
- production build command;
- Windows package command;
- documented application data path;
- documented backup/export path;
- reproducible dependency lockfile.

The installed application must launch without asking the owner to open a terminal or browser.

---

# 10. Performance rules

The app must remain responsive during long sessions.

Do not perform these on the renderer/UI thread when they can block audio or interaction:

- long analyses;
- large database scans;
- large export serialization;
- audio rendering/export;
- expensive cryptographic work unrelated to the real-time worklet.

Do not perform heavy computation on the Electron main thread when it can delay authoritative session events.

Use pagination/virtualization for large logs and output tables.

Charts must aggregate/decimate large series for display without altering stored raw evidence.

---

# 11. Migration from v1.1

The existing `fix-v1.1` implementation is the source implementation baseline.

Preserve useful parts, including:

- experiment engine semantics;
- current validated profiles where scientifically valid;
- mapping separation;
- RNG interfaces;
- analysis primitives;
- UI design foundation;
- session/reveal concepts;
- existing audio recipes and known provenance.

Replace or redesign:

- localhost HTTP server runtime;
- giant browser-only application controller patterns;
- `ScriptProcessorNode` live audio;
- JSON/JSONL as primary runtime evidence storage;
- in-memory-only authoritative session state;
- placeholder profile editing;
- browser-local calibration history.

Do not migrate old implementation weaknesses merely to reduce code changes.

---

# 12. Acceptance gate

The Electron migration is not complete until:

1. packaged/development Electron launches without a localhost server;
2. renderer has no Node integration;
3. privileged actions go through constrained preload/main IPC;
4. SQLite is authoritative for runtime research data under the active storage requirement;
5. simple live audio uses AudioWorklet;
6. layered/Septon/phased-pink live audio uses the same AudioWorklet engine semantics;
7. formal sessions use the worklet and authoritative main-process state machine;
8. session evidence survives app restart/crash recovery tests;
9. hidden outcomes remain inaccessible to renderer before reveal;
10. UI remains English-only and polished;
11. long-running audio does not depend on UI event-loop callbacks;
12. Windows package launches and operates without terminal/browser setup.
