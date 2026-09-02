# MIP Owner Operation and Acceptance Guide v1.2

This guide describes the packaged, offline MIP desktop application.  The
application is English-only and stores new evidence in SQLite under the local
MIP data directory.  It does not require a browser, localhost server, or
Internet connection.  Read the Integrity and protocol status before interpreting
any statistical or audio result.

## Interpretation rules used everywhere

- A **profile** is an immutable experiment/protocol definition.  A **recipe**
  is an immutable audio synthesis definition.  A committed session keeps the
  exact profile and recipe version it used; editing a draft never changes an
  old session.
- `MIP DEFINED`, `DOCUMENTED PATENT COMPARATOR`, `PATENT-ARCHITECTURE
  RECONSTRUCTION`, and `SHAM CONTROL` are explicit badges.  None is a blanket
  claim of historical exactness.  Unknown historical fields remain visible and
  block formal/historical activation where required.
- Software telemetry describes generated digital PCM: processor identity,
  frames, continuity, clipping, digest, context state, and latency.  It cannot
  prove the analogue Bluetooth/wired/DAC/headphone path or what was heard at
  the eardrum.
- Owner listening is recorded separately as `Clean`, `Artifact heard`,
  `Left-right issue`, or `Uncertain`.  An owner observation never tunes a
  recipe or changes provenance.
- A visible Stop control is a convenience.  Safe termination is always opening
  the eyes, removing headphones, and reorienting.

## Page Guide

The top-right `?` button opens the page-aware Help / Page Guide.  It shows the
current page's purpose, authoritative subsystem, owner workflow, values,
warnings/failures, interpretation boundary, and a short acceptance procedure.
The field help entries in the guide are the concise definitions used by the
controls; no raw JSON inspection is required for ordinary operation.

### Start Research Session

**Purpose.** Start one declared research session from an active immutable
profile, after the owner has reviewed its effective configuration.

**What the system is doing.** The Electron main process resolves the profile and
version from SQLite, derives the declared outcome space/cardinality, separates
target assignment from participant representation, and prepares the shared
AudioWorklet recipe.  The renderer is not the authoritative timer.

**Workflow.** Select a profile; review experiment mode, outcome space, RNG,
cadence, target anchor, participant/evidence windows, endpoint, reveal policy,
and recipe version.  Enter participant/pre-session fields, baseline,
environment, and safety confirmation.  In Target & Memory review the encoded
participant instruction without asking for hidden objective data.  Confirm
memory/readiness, then commit.  Wait for `PROCESSOR_READY`; only then start the
participant phase.  The main process records participant and evidence phases,
scheduled/actual times, power state, and timing deviations.

After the participant returns, use **Return / End participant phase**.  A
participant return is not evidence completion: continued pre/primary/post or
target-relative monitoring may still run.  Record the raw report as a mutable
draft, then press **LOCK RAW REPORT**.  Locking creates an immutable hash; later
recollections are append-only late annotations.  Reveal is a separate owner
authorization and is disabled until the declared evidence phase, endpoint,
integrity, and recovery gates are complete.  The UI never describes a report as
“reveal gate satisfied” while evidence monitoring is active.

**Do not change casually.** Profile version, target definition, RNG provider,
cadence, windows, endpoint, recipe version, and reveal policy are evidence
bearing.  Do not edit a committed session.

**Acceptance test.** Use a dry run: verify the profile and recipe fingerprint,
observe `PROCESSOR_READY`, start and stop, return, save/lock a report, confirm
reveal remains gated if evidence is active, verify integrity, then export.

**Failure/recovery.** If AudioWorklet readiness or finalization fails, the main
process records an audio failure and marks recovery required.  Do not restart
or invent missed outputs.  Reopen the session from Sessions & Reports and use
the explicit recovery path after reviewing the deviation.

### Audio Lab

**Purpose.** Exploratory listening and engineering verification, not automatic
formal evidence.

**What the system is doing.** Audio Lab, offline fixtures, and formal sessions
use the same normalized stateful AudioEngine semantics.  Formal sessions still
freeze the recipe, seed/state/version, and authenticated AudioWorklet telemetry;
Audio Lab previews remain live and indefinite.

**Controls and values.**

- Preset / recipe selects a repository-backed immutable version.
- Quick Generator derives `L = center − beat/2`, `R = center + beat/2` for a
  preview and does not commit a session.
- Simple Custom sets center, difference, and preview **Master gain**.  Master
  gain is a top-level amplitude stage; component gain belongs to an individual
  carrier, noise gain scales generated noise, effect mix controls delayed
  signal, envelope shapes time, headroom reserves dB, and OS/device volume is
  outside MIP's PCM stream.
- Play, Pause, Resume, and Stop are real AudioWorklet lifecycle commands.  Stop
  ramps transport to zero, finalizes the digest, disconnects the node, and
  closes the context.  If a control is unavailable, wait for the visible state
  transition; do not start a second player to mask it.
- The layered button resolves `MIP_LAYERED_EXPERIMENTAL_V1` from the Audio
  Recipe Library.  It does not construct an ad-hoc renderer recipe.

The selected recipe detail shows **Active layers**, **Source & Provenance**, and
**Engineering verification**.  A sentence that the engine supports AM/FM,
cues, delay, or comb is not a claim that the selected recipe activates them.
Changing Audio Lab Master gain only changes the preview PCM through a ramp; it
never rewrites a committed formal configuration.

**Acceptance test.** Audition `PURE_394_398`, select the detail panels, change
Master gain, Pause, Resume, and Stop.  Confirm generated frames stop changing
after Stop.  Record an Audio Health owner observation separately if an acoustic
artifact is heard.

### Experiment Profiles

**Purpose.** Manage protocol definitions and immutable versions.

**What the system is doing.** SQLite stores identity, draft, validation,
version, activation, and config fingerprint.  A profile controls experiment
mode, outcome space/cardinality, RNG, timing, participant/evidence windows,
endpoint, analysis windows, audio recipe reference, and reveal policy.

**Safe workflow.** Duplicate or edit a draft; Validate; inspect the material
Diff; Save New Version; Activate only after review.  Activation never mutates a
prior version.  A committed session always references its original version.

**Acceptance test.** Duplicate the active baseline, change one declared window,
validate, compare the diff, save as a draft, and verify the old version and any
old session are unchanged.

### Audio Recipes

**Purpose.** Inspect, audition, duplicate, and version synthesis definitions.

Each card shows identity/version, provenance badge, active layers, carriers,
noise/effects/modulation, gain staging, execution mode, fingerprint, engineering
verification, and formal eligibility.  `Source & Provenance` distinguishes
documented, derived, MIP-defined, reconstruction, user-defined, and unknown
blocked parameters.  `Engineering verification` is software-only and remains
separate from owner audible result.

The three simple conditions are clean component tests:

- `A-U396-4`: L=394 Hz, R=398 Hz;
- `A-P100-104`: L=100 Hz, R=104 Hz documented comparator;
- `A-SHAM-0`: L=396 Hz, R=396 Hz matched control.

They contain no hidden noise, AM/FM, delay, comb, sweep, monaural, Septon, or
cue layers.  During a formal hands-free session, `MIP_PROTOCOL_CUES_V1` is a
separately versioned nonsemantic protocol track; it is not silently added to
the selected recipe's component layers.  `MIP_LAYERED_EXPERIMENTAL_V1` is repository/version backed and
explicitly experimental; its 200/204 and 100/101.5 channel assignments and
numerical noise/effect values are reconstruction choices, not verified CENTER
LANE facts.  A recipe with `UNKNOWN_BLOCKED` material cannot be activated.

**Acceptance test.** Open the layered recipe, verify the active-layer list,
parameter classes, fingerprint, and version.  Open each pure fixture and
confirm all optional layers show `NONE` or `N/A`.

### Calibration

**Purpose.** Test the configured random provider independently of a participant
session.  Calibration does not make an RNG “more random” and does not prove a
paranormal effect; it records provider behavior and diagnostics.

Select `OS_CSPRNG` for operational calibration or the explicitly labelled
deterministic test provider for fixtures.  Binary results may show zero/one,
but generic finite outcome spaces report cardinality, unique outcomes,
duplicates, numeric min/max, and suitable diagnostics without enumerating a
billion-value range.

**Acceptance test.** Run a small OS-CSPRNG calibration before operational
testing, verify its immutable result hash, inspect history, and export the
diagnostic if needed.

### Audio Health

**Purpose.** Verify the AudioWorklet digital path and record a separate owner
listening observation.

Checks are `60-second quick check`, `10-minute stability check`, and
`60-minute owner soak` (the latter two require explicit authorization and are
not silently run by automated tests).  Telemetry records processor identity,
frames, continuity, clipping, canonical PCM digest, context state, and
latency.  The owner result records Clean / Artifact heard / Left-right issue /
Uncertain.  A correct PCM digest cannot prove Bluetooth, DAC, amplifier, or
headphone acoustics.

**Acceptance test.** Run the 60-second check, confirm challenge identity,
continuity and clipping, then record the physical result without changing the
recipe.  Run 10-minute or 60-minute checks only when authorized and document
the environment.

### Sessions & Reports

**Purpose.** Review complete, incomplete, aborted, recovered, and
integrity-failed sessions.

Tabs include Overview, Timeline, Machine Output, Raw Report, Analysis,
Audio & Configuration, Integrity, Files / Export, and aggregate/cross-session
workspace links.  Overview identifies profile/recipe versions, mode,
cardinality, endpoint, participant/evidence phases, and reveal projection.
Timeline distinguishes scheduled from actual times, lateness, missed outputs,
and recovery events.  Machine Output is the persisted ledger; Raw Report is
the immutable owner observation after lock; Analysis is derived and versioned;
Audio & Configuration shows gains, layers, provenance, fingerprint, processor,
and digest; Integrity reruns hash-chain, commitment, output, report, and
version checks; Files / Export lists hashes.

Inspect **Integrity and protocol status first**, then raw evidence, then derived
analysis.  Primary and exploratory windows, target-relative latency, pre /
primary / post boundaries, late annotations, reveal, and export never rewrite
the original evidence.  Aggregate/cross-session analysis requires compatible
definitions and revealed sessions; it is exploratory unless declared
otherwise.

**Acceptance test.** Open a dry-run session, verify the pre-reveal redaction,
lock the report, wait for evidence completion, reveal explicitly, inspect
Integrity, then export and compare the manifest hash.

### Settings & Data

**Purpose.** Inspect local identity, persistence, backups, imports, exports, and
diagnostics.

The page displays App / Engine / Audio / Processor / Schema versions, database
path and size, owner display preferences, verified backup history, restore,
legacy import, diagnostics export, and session export.  “Audio output label” is
only a human-readable label; it is not device selection.  Restore is destructive
to the current database: require confirmation, verify the backup hash and
SQLite/integrity checks, and preserve the documented app-data policy.  Legacy
JSON/JSONL is import/archive format, not the authoritative runtime store.

**Acceptance test.** Create a verified backup, inspect its hash, perform a
confirmed restore into a test profile or dry-run database, rerun integrity, and
confirm session/recipe versions survive restart.

### Aggregate Workspace

**Purpose.** Perform compatible cross-session or replication analysis after
individual evidence has passed integrity/reveal gates.

Select only compatible revealed sessions, review the compatibility fingerprint
and declared workflow, run the aggregate, and inspect the immutable aggregate
hash.  It cannot repair a failed session or convert exploratory work into a
primary endpoint.

## Field glossary

Experiment mode = influence, future-target, control, or sham semantics. Outcome
space = binary, integer range, or enumerated values; cardinality is K and is
symbolic for large ranges. RNG provider = authoritative source for target and
machine assignment. Output cadence = committed interval between opportunities.
Target anchor = named event used as T. Participant phase = owner-facing phase;
evidence phase = continued machine monitoring. Pre/post monitoring = committed
T-relative windows. Primary endpoint = declared scoring region. Profile/recipe
version = immutable configuration identity. Provenance = source class for each
material value. Sample rate, L/R frequency, and binaural difference describe the
digital component. Component gain, noise gain, effect mix, envelope, headroom,
and Master gain are distinct signal-chain stages. AM/FM, Delay, Comb, Sweep,
Envelope are optional declared layers. Continuity = processor frame-clock
agreement. PCM digest = canonical interleaved PCM16LE stream hash. Config
fingerprint = normalized synthesis hash. Integrity verification = hash-chain
and immutable-record checks. Raw report lock = immutable owner observation.
Reveal eligibility = all declared evidence/protocol gates complete. Backup,
Restore, and Export are data-integrity operations.

## First operational owner acceptance checklist

1. Confirm application identity and version.
2. Inspect database path/size and create/verify a backup.
3. Run OS-CSPRNG calibration and verify its result.
4. Inspect pure 394/398, 100/104, and 396/396 recipes; confirm no unintended
   layers and run engineering references.
5. Run Audio Health 60 s; run 10 m only when authorized; reserve 60 m for an
   explicitly authorized owner soak.
6. Review the active profile, outcome space, cadence, target anchor, windows,
   endpoint, reveal policy, and recipe version.
7. Execute a dry-run session and confirm AudioWorklet readiness.
8. Save/lock the raw report; observe that return does not imply evidence
   completion and that reveal stays gated when monitoring remains active.
9. Verify session integrity and export the bundle.
10. Restart and confirm persistence of versions, reports, output, and health.
11. Only after these checks should a real participant session be considered.

A successful subjective sound check never replaces protocol, integrity, or
source-fidelity verification.
