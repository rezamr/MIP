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

`npm run dry-run` creates a no-participant calibration/session bundle at `runtime/dry-run`, three preset fixtures, a layered Septon/phased-pink fixture, deterministic analysis, raw-report lock, and integrity report. It is safe to rerun and does not launch a participant session.

## Verification status

`npm test` runs the ABI-safe verification matrix: 95 Node unit/integration tests (94 passing plus one intentionally environment-gated installer test) followed by the real Electron end-to-end harness. The matrix rebuilds `better-sqlite3` for each runtime and restores the Node ABI before it exits. Coverage includes the complete AudioWorklet contract and deterministic DSP fixtures, promise-based processor handshake, stream SHA-256, de-click/state continuity, exact scheduling regions, RNG-domain separation, session-state/reveal security, SQLite migration and immutability, calibration and Audio Health persistence, backup/restore verification, realistic legacy v1.0/v1.1 import, reports/export/integrity, and renderer/main IPC flows. `npm run dry-run` creates the non-participant evidence fixture. `npm run build` produces an unpacked Windows app. `npm run dist` produces `dist/MIP-1.2.0-win-x64.exe` (NSIS x64 installer). The destructive-in-a-temporary-directory installer lifecycle test is run explicitly after packaging with `MIP_RUN_INSTALLER_TEST=1 node --test test/installer-lifecycle.test.js`.

Implemented and automatically verified in software: actual Electron renderer/main bridge, AudioWorklet loading/handshake/finalization, persistence, restart, backup/restore, migration, and installer lifecycle. Owner-manual checks remain limited to physical OS audio output and pause/resume behavior, keyboard/narrow-window visual acceptance, headphone safety, and playback hardware/acoustic perception. No timed soak or real participant session is run by the automated suite.

Explicitly deferred by active scope: Android/iOS packaging, cloud sync, custom Bluetooth protocols, sensors, phone control, unattended laboratory-grade scheduling, and automatic participant operation.

Known limitations: playback depends on Web Audio and the OS-selected output device; formal runtime digest logging is software-generated and cannot prove the acoustic waveform at the headphones; historical CENTER LANE channel semantics, levels, phase, modulation, noise, sequence, and timing remain unresolved in repository evidence.
