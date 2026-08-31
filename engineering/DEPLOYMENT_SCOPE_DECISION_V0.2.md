# MIP Deployment Scope Decision v0.2

## Status

`ACTIVE — SUPERSEDES DEPLOYMENT_SCOPE_DECISION_V0.1.md`

## Decision

The active MIP software target is now a packaged **Electron desktop application**.

The first supported owner platform is Windows.

The application remains local-first and offline-capable.

This decision supersedes the earlier browser + localhost-server deployment shape and the earlier no-database implementation restriction.

---

# 1. Active desktop stack

The active deployment architecture is:

- Electron desktop shell;
- Electron main process for privileged/authoritative operations;
- isolated renderer for UI;
- minimal preload bridge;
- AudioWorklet for live synthesis;
- SQLite for authoritative runtime research data;
- local packaged assets;
- ordinary operating-system audio output, including Bluetooth if selected by the OS.

---

# 2. Removed production requirements

The packaged production app must not require:

- opening a browser;
- navigating to `127.0.0.1`;
- running a local HTTP server;
- manually executing `npm start` for ordinary owner use;
- JSON/JSONL files as the authoritative runtime datastore.

Development tooling may still use terminal commands.

---

# 3. Still deferred

The Electron transition does not expand MIP into unrelated platform scope.

Still deferred:

- Android app;
- iOS app;
- phone controller;
- cloud accounts;
- cloud synchronization;
- remote multi-user service;
- application-level Bluetooth protocol;
- sensor integration;
- runtime generative AI.

---

# 4. Database scope

SQLite is now explicitly allowed and required under:

`engineering/SQLITE_EVIDENCE_STORAGE_REQUIREMENTS_V0.1.md`

This does not authorize a network database or cloud backend.

Runtime evidence remains local to the owner machine unless explicitly exported/backed up.

---

# 5. Audio scope

Live audio is generated through AudioWorklet under:

`engineering/AUDIOWORKLET_REALTIME_AUDIO_REQUIREMENTS_V0.1.md`

A full pre-rendered session audio file is not required for normal operation.

Optional export remains supported for QA/archival analysis.

---

# 6. Packaging target

Before owner acceptance, Codex must produce a Windows desktop build/install artifact or an explicitly documented equivalent distributable package.

The installed application should:

- launch from Windows like an ordinary desktop program;
- locate its own application data directory;
- initialize/migrate SQLite automatically;
- not open a localhost browser tab;
- not require terminal commands for ordinary operation.

A portable development run may remain available separately.

---

# 7. Cross-platform posture

Do not intentionally hardcode Windows-only research semantics.

Keep file paths, application data paths, and Electron abstractions portable where practical.

macOS/Linux packaging may be added later, but they are not acceptance blockers for the first Electron desktop milestone.

---

# 8. Active authority

For implementation use:

- `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
- `engineering/ELECTRON_DESKTOP_ARCHITECTURE_V0.1.md`
- `engineering/SQLITE_EVIDENCE_STORAGE_REQUIREMENTS_V0.1.md`
- `engineering/AUDIOWORKLET_REALTIME_AUDIO_REQUIREMENTS_V0.1.md`
- `engineering/CODEX_PROMPT_REQUEST_APP_V1.2.md`

Older deployment documents remain project history.