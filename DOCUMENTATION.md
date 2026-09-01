# MIP Desktop v1.2

MIP is a local-only Electron desktop application. Production uses no localhost server, browser tab, cloud account, phone controller, or runtime generative AI. The packaged Windows application is built with Electron 36.9.5 and electron-builder NSIS.

## Install and run

```bash
npm install
npm test
npm start
```

`npm start` rebuilds the native SQLite driver for Electron before launching the desktop window. Runtime data is created below Electron's per-user `userData` path at `MIP/data/mip.sqlite3`; backups, exports, and logs are sibling directories. Uninstall preserves this data (`deleteAppDataOnUninstall=false`).

## Architecture

`src/main/main.js` owns Electron lifecycle and named IPC handlers. `src/preload/preload.cjs` exposes a minimal frozen `window.mip` bridge. `src/main/database/db.js` owns SQLite migrations, WAL/full-sync pragmas, immutable evidence triggers, profile seeding, ID allocation, event hash chains, integrity verification, and backups. `src/engine.js` and `src/audio.js` are shared deterministic domain/audio semantics. `public/mip-processor.js` is the AudioWorklet processor.

## Session lifecycle

The Start Research Session workflow selects a profile, records baseline/safety state, assigns and displays the participant target, requires memory confirmation, presents a readiness review, commits an immutable snapshot, runs a hands-free state machine, opens the raw report before reveal, autosaves drafts, locks the report, and only then enables reveal. Machine output is never returned by participant-facing routes before the configured gate.

## Audio

Audio Lab presets are `A-U396-4` (394/398 Hz), `A-P100-104` (100/104 Hz), and `A-SHAM-0` (396/396 Hz). Quick Generator derives centered channels from one number. Audio Lab and formal runtime playback use the same stateful AudioWorklet; no `ScriptProcessorNode`, finite WAV loop, or renderer sample-generation timer is used. `PHASED_PINK_PATENT_5356368` is explicitly labeled a patent-grounded reconstruction; unresolved historical CENTER LANE parameters remain unknown rather than inferred.

## Dry run

`npm run dry-run` creates an isolated SQLite-backed, no-participant session, performs the formal AudioWorklet evidence flow, schedules hidden machine output, locks and reveals a raw report, exports the session bundle, and verifies database integrity. The command prints the temporary database and export paths, is safe to rerun, and does not launch a participant session.

## Verification status

`npm test` runs the ABI-safe verification matrix. The latest non-timed run executed 97 Node unit/integration tests (96 passed and one installer-lifecycle test was skipped because `MIP_RUN_INSTALLER_TEST=1` was not enabled), followed by one real Electron smoke test that passed, including renderer double-Play serialization, Play/Pause/Resume/Stop controls, AudioWorklet handshake/finalization, reports, backup/restore, and restart persistence. The matrix rebuilds `better-sqlite3` for each runtime and restores the Node ABI before it exits. `npm run dry-run` exercises the current SQLite/Electron evidence path. `npm run build` produces an unpacked Windows app. `npm run dist` produces the NSIS installer. The destructive temporary-directory installer lifecycle test must be run explicitly after packaging with `MIP_RUN_INSTALLER_TEST=1 node --test test/installer-lifecycle.test.js`; it is not represented as passed by the normal suite.

Implemented and automatically verified in software: the Electron renderer/main bridge, AudioWorklet loading/handshake/finalization, authenticated metadata and digest binding, persistence, restart recovery classification, backup/restore, migration, report redaction, owner reveal, and the short UI/audio lifecycle smoke. Not executed by policy: timed 10-minute/60-minute audio soak, physical OS-output checks, channel/acoustic checks, and any real participant session. Installer upgrade/uninstall/reinstall acceptance remains pending the explicit packaged lifecycle run. The main-process and renderer shells remain functional but are candidates for a later modular split; this is not silently classified as complete architecture compliance.

Explicitly deferred by active scope: Android/iOS packaging, cloud sync, custom Bluetooth protocols, sensors, phone control, unattended laboratory-grade scheduling, and automatic participant operation.

Known limitations: playback depends on Web Audio and the OS-selected output device; formal runtime digest logging is software-generated and cannot prove the acoustic waveform at the headphones; historical CENTER LANE channel semantics, levels, phase, modulation, noise, sequence, and timing remain unresolved in repository evidence.
