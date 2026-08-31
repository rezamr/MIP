# MIP Local Research Application

This build is a local-computer-only Node.js 22+ application. It uses plain HTML/CSS/JavaScript, a localhost HTTP server, and JSON/JSONL evidence bundles. No account, cloud service, database, phone controller, custom Bluetooth protocol, or runtime generative AI is used.

## Install and run

```bash
npm install
npm test
npm start
```

Open `http://127.0.0.1:3210`. Runtime evidence is stored under `runtime/`; set `MIP_DATA_ROOT` to choose another local root. The application never starts a real participant session automatically.

## Architecture

`src/engine.js` contains versioned profile registries, outcome spaces, mappings, request encoding, timing plans, CSPRNG/deterministic providers, and deterministic stream analysis. `src/audio.js` implements exact simple presets plus layered multi-carrier, Septon, deterministic phased-pink/comb-sweep rendering, WAV manifests, and hashes. `src/storage.js` allocates collision-safe MIP session IDs, writes append-only hash-chained events and lossless machine output, locks raw reports, and verifies bundles. `src/server.js` exposes safe localhost APIs with reveal gating and serves the English UI. `public/` contains the reusable design system and workflow screens.

## Session lifecycle

The Start Research Session workflow selects a profile, records baseline/safety state, assigns and displays the participant target, requires memory confirmation, presents a readiness review, commits an immutable snapshot, runs a hands-free state machine, opens the raw report before reveal, autosaves drafts, locks the report, and only then enables reveal. Machine output is never returned by participant-facing routes before the configured gate.

## Audio

Audio Lab presets are `A-U396-4` (394/398 Hz), `A-P100-104` (100/104 Hz), and `A-SHAM-0` (396/396 Hz). Quick Generator derives centered channels from one number. Formal layered recipes are rendered to a finite WAV, manifest, verification file, and SHA-256 hashes before use. `PHASED_PINK_PATENT_5356368` is explicitly labeled a patent-grounded reconstruction; unresolved historical CENTER LANE parameters remain unknown rather than inferred.

## Dry run

`npm run dry-run` creates a no-participant calibration/session bundle at `runtime/dry-run`, three preset fixtures, a layered Septon/phased-pink fixture, deterministic analysis, raw-report lock, and integrity report. It is safe to rerun and does not launch a participant session.

## Verification status

Implemented and tested: profile validation and configuration-only demonstrations; binary/four-outcome spaces; arbitrary/reversed mapping; immediate/relative/absolute timing plans; deterministic and OS RNG abstractions; 30-bit bounds; hands-free workflow; hidden-result reveal gate; append-only event chain and corruption detection; raw-report lock; deterministic stream analysis; exact audio presets; layered/Septon/phased-pink deterministic rendering; WAV manifests and hashes; local session browser; English responsive UI; report/timeline/integrity views.

Implemented but requires owner manual verification: actual OS audio output and pause/resume behavior in a chosen browser; keyboard/narrow-window visual acceptance; headphone safety and formal playback hardware; long-duration scheduler behavior.

Explicitly deferred by active scope: Android/iOS packaging, cloud sync, databases, custom Bluetooth protocols, sensors, phone control, unattended laboratory-grade scheduling, and automatic participant operation.

Known limitations: browser Audio Lab preview uses a controlled UI status path rather than a native device-specific audio driver; the local server must remain running for long relative/absolute delays; historical CENTER LANE channel semantics, levels, phase, modulation, noise, sequence, and timing remain unresolved in repository evidence.
