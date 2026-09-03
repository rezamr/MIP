# MIP Owner Operation and Acceptance Guide v1.2

This guide describes the packaged, offline MIP desktop application.  The
application is English-only and stores new evidence in SQLite under the local
MIP data directory.  It does not require a browser, localhost server, or
Internet connection.  Read the Integrity and protocol status before interpreting
any statistical or audio result.

The owner-facing pilot catalog is intentionally small: it contains exactly
three operational profiles — **Binary Request**, **Binary No-Intention
Control**, and **Binary Request — Audio Sham**. Older DRY/demo and engineering
profiles remain in the engine and SQLite so historical sessions stay readable,
but they are internal validation records and are not selectable for new owner
sessions.

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
- In a participant-paced temporal profile, `PARTICIPANT_STOP_RETURN` is an
  authoritative reference point, not an instruction to force `T = STOP`.
  Before `START`, commit one signed integer `targetOffsetMs` and derive
  `T = participant STOP/RETURN + targetOffsetMs` only after the main process
  captures the stop clocks.  Negative, zero, and positive offsets are valid;
  `targetUtc` is unknown during readiness and becomes immutable only after
  return.  `preTargetMs` and `postTargetMs` are independent windows centered
  on that derived `T`.
- In `STOP_ANCHORED_INTEGER_RANGE_V1`, the participant procedure is genuinely
  self-paced: after `START`, the application does not time induction, settling,
  request, release, neutral observation, or return, and it emits no fixed
  protocol cue track.  The participant/owner explicitly presses **Return / End
  participant phase** when ready.  Only that action supplies the authoritative
  stop clocks; internal mental-stage timestamps are not inferred by MIP.

## Page Guide

The top-right `?` button opens the page-aware Help / Page Guide.  It shows the
current page's purpose, authoritative subsystem, owner workflow, values,
warnings/failures, interpretation boundary, and a short acceptance procedure.
The field help entries in the guide are the concise definitions used by the
controls; no raw JSON inspection is required for ordinary operation.

### Start Research Session

**Purpose.** Start one declared research session from one of the three active
immutable operational profiles, after the owner has reviewed its effective
configuration.

**What the system is doing.** The Electron main process resolves the profile and
version from SQLite, derives the declared outcome space/cardinality, separates
target assignment from participant representation, and prepares the shared
AudioWorklet recipe.  The renderer is not the authoritative timer.

**Workflow.** Choose **Binary Request**, **Binary No-Intention Control**, or
**Binary Request — Audio Sham**. The pilot profile freezes BINARY `[0, 1]`,
OS_CSPRNG assignment, participant-paced STOP/RETURN, zero target offset,
TARGET_FREQUENCY scoring, a ±2 second primary window, 100 ms cadence, no cues,
and the profile's A-U396-4 or A-SHAM-0 recipe. Only administrative
participant/pre-session fields, baseline, environment, safety confirmation,
and optional execution-window metadata remain editable. In Target &amp; Memory,
Request and Audio Sham show exactly one binary value (0 or 1); Control shows no
target request because its independently assigned scoring target stays hidden
until reveal. Confirm memory/readiness, then commit. Wait for
`PROCESSOR_READY`; only then start the participant phase. The main process
records participant and evidence phases, scheduled/actual times, power state,
and timing deviations.

After the participant returns, use **Return / End participant phase**.  The
main process records `stopUtc` and `stopMonotonicNs` once, then derives and
persists `targetUtc` and `targetMonotonicNs` from the precommitted signed
offset.  A participant return is not evidence completion: continued
pre/primary/post or target-relative monitoring may still run (especially for a
positive offset).  A negative offset never backfills missing evidence; if
`T - preTargetMs` predates genuine collection, the affected endpoint is
marked `INSUFFICIENT_PRE_TARGET_EVIDENCE`.  Record the raw report as a mutable
draft, then press **LOCK RAW REPORT**.  Locking creates an immutable hash; later
recollections are append-only late annotations.  Reveal is a separate owner
authorization and is disabled until the declared evidence phase, endpoint,
integrity, and recovery gates are complete.  The UI never describes a report as
“reveal gate satisfied” while evidence monitoring is active.

**Do not change casually.** Profile version, target definition (including the
signed `targetOffsetMs`), RNG provider, cadence, independent windows, endpoint,
recipe version, and reveal policy are evidence
bearing.  Do not edit a committed session.

**Acceptance test.** Use a dry run: verify one of the three operational
profiles and its recipe fingerprint,
observe `PROCESSOR_READY`, start and stop, return, verify the captured stop
clock and derived T/offset, save/lock a report, confirm
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

**Acceptance test.** Audition `A-U396-4`, `A-P100-104`, or `A-SHAM-0`, select
the detail panels, change Master gain, Pause, Resume, and Stop.  Confirm
generated frames stop changing after Stop.  Record an Audio Health owner
observation separately if an acoustic artifact is heard.

### Experiment Profiles

**Purpose.** Inspect the three recommended frozen operational protocol
definitions and create validated owner-defined experimental profiles without
changing the protocol semantics.

**What the system is doing.** SQLite stores identity, draft, validation,
version, activation, and config fingerprint.  A profile controls experiment
mode, outcome space/cardinality, RNG, timing, participant/evidence windows,
endpoint, analysis windows, audio recipe reference, and reveal policy.

**Safe workflow.** The **Recommended** list contains **Binary Request**,
**Binary No-Intention Control**, and **Binary Request — Audio Sham**. These
three pilot cards are read-only and frozen in the owner-facing workflow. Use
**+ New Experimental Profile** to choose one of those templates, select an
active complete formally operationally eligible audio recipe, enter a profile
name and optional purpose/notes, Validate, Save immutable profile, and Activate
it for future sessions. Experimental profiles inherit BINARY [0,1],
OS_CSPRNG, participant-paced STOP/RETURN, zero offset, TARGET_FREQUENCY,
the ±2 second primary window, 100 ms cadence, no protocol cues, and the same
reveal/integrity/report rules. Older DRY/demo IDs are internal validation
fixtures: they remain resolvable for historical reports, but do not appear in
Start Research Session. Engineering versioning remains available to the
underlying repository without changing a committed session. A committed
session always references its original version.

**Acceptance test.** Confirm the three Recommended cards. Create and activate
an Experimental profile using an eligible recipe, verify it appears in Start
Research Session, then Archive/Deactivate it and verify it no longer appears
there. Verify old versions and old sessions remain unchanged; engineering-only
profiles stay available through historical reports rather than the pilot
selector.

### Audio Recipes

**Purpose.** Inspect, audition, duplicate, and version synthesis definitions.

Each card shows identity/version, provenance badge, active layers, carriers,
noise/effects/modulation, gain staging, execution mode, fingerprint, activation,
formal operational eligibility, and engineering verification.  `Source &
Provenance` distinguishes documented, derived, MIP-defined, reconstruction,
user-defined, and unknown blocked parameters.  `Engineering verification` is
software-only and remains separate from owner audible result.  For a genuinely
custom recipe, the reference status is `NOT_APPLICABLE` and the card explicitly
states: **No golden reference fixture applies to this custom recipe.**
On startup, repository-owned built-ins reconcile version metadata only when the
persisted normalized material fingerprint matches the current definition.  A
material mismatch stays immutable and is shown as requiring review; it is never
silently presented as a current PASS.

The three simple conditions are clean component tests:

- `A-U396-4`: L=394 Hz, R=398 Hz;
- `A-P100-104`: L=100 Hz, R=104 Hz documented comparator;
- `A-SHAM-0`: L=396 Hz, R=396 Hz matched control.

They contain no hidden noise, AM/FM, delay, comb, sweep, monaural, Septon, or
cue layers.  A timed formal protocol may add `MIP_PROTOCOL_CUES_V1` as a
separately versioned nonsemantic track only for its explicitly declared
audible stages; it is not silently added to the selected recipe's component
layers.  `STOP_ANCHORED_INTEGER_RANGE_V1` is participant-paced with
`cueMode = NONE`, so its committed effective audio has no fixed protocol cue
track (`protocolCueCount = 0`).  `MIP_LAYERED_EXPERIMENTAL_V1` is repository/version backed and
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

Select the outcome-space source in Calibration: Application Research Default,
a profile outcome space, Binary, or an explicit Integer Range.  Enter inclusive
minimum/maximum bounds for a range and confirm the calculated cardinality K.
For example, `OS_CSPRNG`, 256 samples, and `INTEGER_RANGE 0..999999999`
should report K = 1,000,000,000, unique/duplicate counts, observed min/max,
and a sparse bucket summary.  The range remains symbolic; the application
never enumerates one billion possible values.  Use `OS_CSPRNG` for operational
calibration or the explicitly labelled deterministic test provider for
fixtures.  Binary results continue to show zero/one counts.

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
Target anchor = named event or reference used to derive T. For a
participant-paced profile, `T = participant STOP/RETURN + targetOffsetMs`, where
the signed offset is committed before START and may be negative, zero, or
positive; the target UTC is unknown until STOP/RETURN. Participant phase =
owner-facing phase; evidence phase = continued machine monitoring. Pre/post
monitoring = committed windows centered independently on T. Primary endpoint = declared scoring region. Profile/recipe
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
6. Review the active profile, outcome space, cadence, target anchor/reference,
   signed stop-relative offset (if participant-paced), independent windows,
   endpoint, reveal policy, and recipe version.  Confirm readiness shows target
   UTC as unknown until STOP/RETURN.
7. Select one of the three operational profiles, execute a dry-run session,
   and confirm AudioWorklet readiness.
8. Save/lock the raw report; observe that return does not imply evidence
   completion and that reveal stays gated when monitoring remains active.
9. Verify session integrity and export the bundle.
10. Restart and confirm persistence of versions, reports, output, and health.
11. Only after these checks should a real participant session be considered.

A successful subjective sound check never replaces protocol, integrity, or
source-fidelity verification.
