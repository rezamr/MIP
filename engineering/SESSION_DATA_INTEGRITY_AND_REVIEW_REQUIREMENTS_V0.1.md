# MIP Session Data, Integrity, and Review Requirements v0.1

## Status

`ACTIVE ENGINEERING REQUIREMENT`

## Purpose

Define exactly how the local MIP application must identify, record, preserve, verify, review, and compare every session, trial, block, machine-output stream, participant report, protocol deviation, reveal, and generated analysis.

The goal is that no meaningful session can become an ambiguous folder of partially related JSON files.

Every session must be reconstructable from its evidence bundle, every immutable boundary must be verifiable, and the Sessions/Reports interface must make it easy to audit what actually happened without exposing hidden outcomes before the configured reveal policy allows them.

---

# 1. Data hierarchy

Use four distinct concepts:

1. **Experiment profile** — versioned configuration describing how a class of sessions runs.
2. **Block** — an optional precommitted collection/order of sessions or trials used for balancing, blinded assignment, or block-level reveal.
3. **Session** — one participant Communication Session from pre-session setup through return/report/reveal or termination.
4. **Trial** — one objectively scored request/read event inside a session.

For the first active REQUEST baseline:

`one session = one primary trial`

but keep both `session_id` and `trial_id` fields in the schema.

Do not collapse these concepts into one generic ID.

---

# 2. Identifier rules

Session IDs must remain compatible with the MIP durable naming convention:

`S0001`, `S0002`, `S0003`, ...

Existing repository sessions `S0001` and `S0002` are reserved and must not be reused.

The application must discover the highest existing MIP session number from its configured local history and, when practical, the repository session index, then allocate the next available ID using an exclusive filesystem create operation.

Trial IDs should be unique within a session, for example:

`S0003-T001`

Block IDs should be stable and human-readable, for example:

`B0001`

Calibration runs use a separate namespace such as:

`CAL-YYYYMMDD-HHMMSS-<shortnonce>`

Do not use calibration IDs as participant session IDs.

---

# 3. Single-instance / collision protection

Because there is no database, prevent two local application instances from allocating or writing the same session simultaneously.

Use a local process/data-root lock with clear stale-lock recovery.

Session directory creation must use exclusive creation semantics. If an ID collision occurs, allocate the next ID; never overwrite an existing session directory.

---

# 4. Runtime data root

Keep runtime scientific evidence separate from top-level Markdown project records.

Recommended layout:

```text
runtime/
  sessions/
    S0003/
  blocks/
    B0001/
  calibration/
  audio/
  indexes/
  system_logs/
```

Default shipped configuration may live under a source-controlled application/config directory, while user-created versioned configuration can be stored under the runtime/config area if the implementation chooses that separation.

The exact path may differ, but the app must clearly distinguish:

- source-controlled project documentation;
- source-controlled default application configuration;
- local runtime evidence;
- mutable UI cache/index files.

Do not automatically push/publish runtime participant data.

---

# 5. Canonical session bundle

A completed or interrupted session directory should contain, as applicable:

```text
S0003/
  session_manifest.json
  config_snapshot/
  commitment.json
  request.json
  events.jsonl
  machine_output.jsonl
  raw_report_draft.json          # mutable working artifact, if present
  raw_report.json                # immutable after lock
  result.json                    # created only when reveal policy allows
  analytical_report.json
  protocol_deviations.json
  integrity_manifest.json
  integrity_report.json
```

Optional files may include:

- audio manifest reference/copy;
- finite rendered session WAV hash/reference;
- subjective timeline detail;
- temporal-window materialized output;
- exported human-readable report.

A missing optional file must be distinguishable from an accidental loss.

---

# 6. Session manifest

Create `session_manifest.json` at session creation and freeze its material committed fields at commitment.

Required fields include at least:

- schema version;
- session ID;
- primary trial ID;
- block ID if any;
- created UTC;
- application/engine version;
- participant identifier or local participant label;
- session class;
- experiment profile ID/version;
- current session status;
- record type: contemporaneous/dry/calibration/imported/reconstructed where applicable;
- data root/runtime version;
- reveal policy;
- integrity schema version.

Session status may be represented by a derived status cache, but the authoritative state transition history is `events.jsonl`.

---

# 7. Required session state machine

Support explicit lifecycle states conceptually equivalent to:

- `CREATED`
- `PROFILE_VALIDATED`
- `REQUEST_ASSIGNED`
- `COMMITTED`
- `STARTED`
- `ACTIVE`
- `RETURN_PENDING`
- `RETURN_CONFIRMED`
- `REPORT_DRAFT`
- `REPORT_LOCKED`
- `REVEAL_PENDING`
- `REVEALED`
- `ANALYZED`
- `CLOSED`

Terminal/deviation states include at least:

- `ABORTED_PARTICIPANT`
- `INTERRUPTED_EXTERNAL`
- `FAILED_APPLICATION`
- `TIMING_DEVIATION`
- `AUDIO_FAILURE`
- `LOGGING_FAILURE`
- `INCOMPLETE`

Do not erase a session because it enters a failure state.

State transitions must be validated. Invalid transitions are rejected and logged.

---

# 8. Authoritative event log

`events.jsonl` is the authoritative append-only chronological event chain for a session.

Every scientific state transition and important machine action must produce an event.

Each event must contain at minimum:

```json
{
  "schema_version": 1,
  "event_index": 42,
  "session_id": "S0003",
  "trial_id": "S0003-T001",
  "timestamp_utc": "...",
  "monotonic_ns_or_ms": "...",
  "event_type": "...",
  "payload": {},
  "previous_hash": "...",
  "event_hash": "..."
}
```

`trial_id` may be null for session-level events.

Use one defined canonical JSON serialization algorithm for hashing. Document it and test it.

Recommended approach: deterministic recursive key sorting, UTF-8 encoding, no insignificant whitespace, stable number/string representation, and LF-delimited JSONL.

Do not use implementation-dependent object insertion order as the scientific hash specification.

---

# 9. Hash-chain rule

Define a deterministic genesis value, for example 64 zero hex characters.

For each event:

1. set `previous_hash` to the preceding event hash;
2. build the event object without `event_hash`;
3. canonicalize it;
4. compute SHA-256 over the exact UTF-8 canonical bytes;
5. store lowercase hexadecimal `event_hash`.

The verifier must detect:

- edited event content;
- missing event;
- reordered event;
- inserted event;
- broken previous-hash link;
- invalid event index sequence.

---

# 10. Event types

Define a versioned event-type registry or clear constants.

At minimum log events for:

- application/session creation;
- profile validation;
- request assignment;
- mapping resolution;
- commitment creation;
- config snapshot completion;
- session START;
- audio start;
- audio failure;
- each stage start/end;
- every cue;
- request start/end;
- release start/end;
- target/window scheduled;
- scheduler wake;
- machine output generated;
- machine-output block persisted;
- timing deviation;
- external interruption reported;
- participant physical abort reported;
- return cue;
- participant return confirmation;
- raw-report draft start;
- raw-report lock;
- late recollection/note;
- reveal eligibility;
- reveal;
- analysis generation;
- integrity verification;
- session close;
- application/logging error.

Do not create event names ad hoc per session.

---

# 11. Machine-output evidence

Machine output can be high volume and may therefore be stored in `machine_output.jsonl` rather than copied into every event payload.

Every record or block must contain enough information to reconstruct the declared output sequence exactly, including as applicable:

- session/trial ID;
- output/block index;
- scheduled UTC/monotonic timing;
- actual generation UTC/monotonic timing;
- outcome-space ID/version;
- RNG provider/version;
- number of outcomes;
- exact ordered outcomes or a documented lossless packed representation;
- block start/end timing;
- scheduler error;
- block SHA-256.

Every persisted machine-output block hash must be referenced from an `events.jsonl` event.

This cryptographically binds the high-volume output file to the authoritative event chain.

Never retain only summary counts when the protocol requires exact ordered stream reconstruction.

---

# 12. Persistence ordering for generated outcomes

A machine outcome is not considered safely recorded merely because it exists in memory.

After generation:

1. capture generation timestamp immediately;
2. persist the raw outcome/output block;
3. flush/sync according to the platform's practical durability support;
4. append the corresponding hash-reference event;
5. only then proceed to any reveal-eligible behavior.

If persistence fails, record/attempt to record a `LOGGING_FAILURE`, prevent scientific success scoring from being treated as valid, and preserve all recoverable partial data.

Never regenerate a lost target to fill a missing record.

---

# 13. JSON snapshot write rule

For JSON objects that may be rewritten before they are frozen, use atomic write behavior:

`write temporary file -> flush -> rename/replace`

After an object becomes immutable, the application must not rewrite it in place.

If a correction is needed after lock, create a new append-only correction/late-note event instead.

---

# 14. Raw participant report lifecycle

Before lock, the UI may autosave a clearly marked mutable file such as:

`raw_report_draft.json`

The draft is for crash recovery and is not the locked evidentiary report.

At participant lock:

1. validate required fields;
2. create `raw_report.json` as the exact final snapshot;
3. calculate its SHA-256;
4. append `RAW_REPORT_LOCKED` event with the hash;
5. mark report fields read-only in the app;
6. never rewrite `raw_report.json`.

Late memories use new `LATE_RECOLLECTION` events with recorded UTC time.

Do not mutate the original report to incorporate later knowledge.

---

# 15. Hidden-result leakage prevention

Before reveal is authorized, hidden machine outcome content must not be transmitted to the participant-facing client at all.

Do not rely on CSS hiding.

Before reveal, participant-facing APIs must return only allowed metadata.

Hidden output must not appear in:

- HTML source;
- browser JavaScript state;
- URL query parameters;
- WebSocket/SSE messages;
- client-side debug objects;
- report previews;
- ordinary system logs;
- error messages.

The server-side reveal gate must check current reveal policy and locked-state prerequisites on every request.

---

# 16. Integrity manifest

At session finalization, generate `integrity_manifest.json` containing a deterministic sorted map of evidence-file relative paths to SHA-256 hashes and sizes.

Do not create an impossible self-hash cycle.

The manifest excludes itself from the file map, then stores:

- hash algorithm;
- canonicalization/version;
- sorted file list;
- each file SHA-256;
- each file size;
- event-chain terminal hash;
- bundle root hash computed from canonicalized manifest content excluding the root-hash field itself.

`integrity_report.json` is a later generated verification result and is not part of the original frozen evidence set unless explicitly versioned as such.

---

# 17. Integrity verification

Provide a verifier callable from:

- automated tests;
- command line;
- Sessions/Reports UI.

It must check:

- event-chain integrity;
- event index continuity;
- referenced machine-output block hashes;
- all integrity-manifest file hashes/sizes;
- config snapshot hashes;
- raw-report locked hash;
- commitment hash;
- generated audio/manifest references where local;
- analytical report input-version references.

Return a structured result such as:

- `VALID`
- `INVALID`
- `INCOMPLETE`
- `LEGACY_UNVERIFIABLE`

Do not silently repair corrupted evidence.

---

# 18. Commitment record

Before START, `commitment.json` must contain all material information that should be frozen before outcome generation, including:

- session/trial ID;
- objective requested state where applicable;
- participant-facing mapping ID/version;
- request-encoding profile ID/version;
- timing policy and declared primary target/window;
- machine-output policy;
- RNG provider/version;
- session protocol/version;
- audio recipe/assignment result/version;
- analysis plan/version;
- reveal policy/version;
- block reference/assignment if applicable;
- nonce;
- hashes of the effective configuration snapshot.

Store `commitment_sha256` using the same documented canonicalization policy.

For a future-generated target, do not invent/store the future outcome.

For pre-generated hidden/READ modes, commit the hidden target + nonce according to that protocol while keeping the target inaccessible to participant-facing routes.

---

# 19. Request record

`request.json` preserves the difference between objective and human representation.

Store at minimum:

- objective requested state;
- participant-facing label;
- mapping ID/version;
- encoding profile ID/version;
- exact participant-facing instruction text used;
- assignment source/policy;
- assignment timestamp;
- memory-confirmation timestamp;
- request cue/start/end timestamps when known;
- forgotten-request flag;
- any protocol-level requested execution semantics.

Do not overwrite objective state with the display label.

---

# 20. Timing audit

For every scheduled machine event store where applicable:

- anchor event;
- requested delay;
- intended/scheduled UTC;
- intended monotonic deadline where meaningful;
- scheduler wake UTC/monotonic;
- actual generation UTC/monotonic;
- scheduler lateness/error;
- detected wall-clock jump;
- detected monotonic discontinuity/process restart;
- system sleep/resume suspicion where detectable;
- profile timing tolerance;
- timing-valid flag;
- deviation reason.

A late event remains in the log. It is not silently moved into the intended time bin.

---

# 21. Process restart / crash recovery

At startup, scan runtime sessions for nonterminal states.

Do not automatically pretend interrupted sessions completed normally.

For each incomplete session:

- verify existing event chain;
- identify last valid event/state;
- preserve draft report if present;
- mark/offer recovery classification;
- if a scheduled target was missed, do not backfill it;
- allow close as `FAILED_APPLICATION`, `INCOMPLETE`, or other appropriate explicit status;
- permit safe continuation only for stages where continuing cannot change the scientific meaning of the committed trial.

The first participant baseline should normally fail closed rather than resume a broken active trance/timing sequence as though uninterrupted.

---

# 22. Logging failure behavior

Scientific logging failure is a protocol failure.

If the application cannot append required evidence or persist a generated target:

- do not continue silently;
- stop further target/reveal logic where possible;
- preserve recoverable files;
- surface a clear post-return error;
- mark the session invalid/incomplete according to the analysis plan;
- never delete it.

---

# 23. Formal audio event logging

For research-session audio, record:

- selected recipe ID/version;
- exact recipe snapshot hash;
- generated WAV/manifest hash where used;
- requested sample rate;
- playback-start UTC/monotonic;
- browser/audio-context or playback-device sample rate where discoverable;
- playback error/underrun/interruption if detectable;
- cue schedule and actual cue times;
- stop/end time;
- whether playback completed normally.

Do not claim the physical acoustic signal at the ear was bit-identical to the source WAV unless actually measured. The app guarantees the digital source/configuration, not unmeasured headphone transfer characteristics.

---

# 24. Protocol deviations

Create structured deviation records for events such as:

- forgotten request;
- unexpected screen interaction;
- participant abort;
- external interruption;
- headphone/audio disconnect;
- browser refresh;
- process crash;
- computer sleep;
- late target generation;
- logging failure;
- invalid configuration discovered after commitment;
- participant reports hearing/seeing unintended information;
- any deviation explicitly defined by the analysis plan.

`protocol_deviations.json` is generated from authoritative events; events remain primary.

Every analysis report must state whether protocol deviations occurred.

---

# 25. System diagnostic logs

Application diagnostic logs are separate from scientific evidence.

Store them under `runtime/system_logs/` or equivalent.

They may contain:

- application start/stop;
- version;
- non-sensitive errors;
- stack traces;
- performance warnings.

They must not leak hidden outcome values or raw participant-report content before reveal.

Diagnostic logs are not a replacement for session `events.jsonl`.

---

# 26. Sessions / Reports review UI

The application must provide a proper session browser, not merely raw files on disk.

For each session show, subject to reveal policy:

- session ID;
- date/time;
- block ID;
- profile ID/version;
- session class;
- status;
- audio condition;
- timing mode;
- participant-facing requested label when allowed;
- reveal status;
- protocol-deviation count/status;
- integrity status;
- report availability.

Allow filtering by:

- date;
- status;
- profile;
- audio;
- timing mode;
- block;
- completed/aborted/incomplete;
- integrity result.

Do not expose hidden result fields in list rows before reveal.

---

# 27. Single-session audit view

A session review page must provide both human-readable and raw/audit views.

Human-readable sections:

1. identity/status;
2. committed effective configuration;
3. request assignment/mapping/encoding;
4. exact protocol timeline;
5. audio details;
6. machine timing/output summary when reveal permits;
7. raw participant report;
8. protocol deviations;
9. deterministic analysis;
10. integrity verification.

Raw/audit tabs should allow read-only inspection of:

- commitment JSON;
- config snapshot;
- events JSONL;
- machine-output records;
- raw report;
- hashes/integrity manifest;
- analytical report.

Provide a `Verify Integrity` action that reruns verification without altering evidence.

---

# 28. Timeline review

Render a chronological event timeline from `events.jsonl` showing at least:

- UTC time;
- relative/monotonic offset from START;
- event type;
- stage/cue;
- timing anchor;
- output-block reference where reveal permits;
- protocol deviations.

Allow the user to inspect exact raw event JSON.

Machine and participant-subjective timelines must remain visually/conceptually distinct.

---

# 29. Machine telemetry review

For revealed sessions, provide deterministic table/plot-ready views for declared machine-output analysis:

- pre/request/post windows;
- block counts;
- cumulative requested-direction deviation;
- primary region;
- exploratory regions;
- threshold/change-point outputs where configured.

Mark primary versus exploratory clearly.

Do not visually emphasize the best exploratory window in a way that implies it was the preregistered target.

---

# 30. Draft versus locked versus late data in UI

The UI must label clearly:

- `DRAFT — MUTABLE`
- `LOCKED RAW REPORT`
- `LATE RECOLLECTION — APPENDED AFTER LOCK`
- `POST-REVEAL NOTE`

Never merge them into one prose field without provenance.

---

# 31. Session index/cache

For performance, the application may maintain a generated index/cache of session metadata.

That index is not scientific evidence and must be rebuildable by scanning canonical session bundles.

Provide a rebuild command/action.

Do not make evidence dependent on a mutable index file.

---

# 32. Block records

For block-based work create a block bundle such as:

```text
B0001/
  block_manifest.json
  assignment_commitment.json
  events.jsonl
  session_refs.json
  block_report.json
  integrity_manifest.json
```

A block manifest must preserve:

- block ID;
- profile pool/conditions;
- planned number of sessions/trials;
- balancing/randomization rule;
- reveal policy;
- assignment seed/commitment policy where appropriate;
- analysis plan;
- created UTC;
- status.

Block-level reveal must be enforced server-side for every member session.

---

# 33. Balanced block assignment

When `SYSTEM_BALANCED_BLOCK` or an audio/condition-balanced block is used:

- define block size before assignment;
- define target counts per condition/request value;
- randomize order using the selected cryptographic provider or a separately committed deterministic schedule;
- commit the schedule before outcomes are generated;
- keep hidden fields hidden from participant-facing routes;
- never rebalance retrospectively by deleting failed sessions.

Aborted/incomplete sessions remain in the block record. Any replacement-session policy must be prespecified and must not erase the original.

---

# 34. Cross-session comparability gate

Before pooling sessions, compare material configuration fingerprints.

At minimum require compatible:

- objective outcome space;
- request-assignment policy as required by the analysis;
- participant mapping when relevant;
- encoding profile;
- timing policy/primary window;
- output policy;
- RNG source class/provider where the analysis requires it;
- session protocol version;
- audio condition or declared comparison dimension;
- analysis-plan version;
- reveal/blinding assumptions.

If materially incompatible, do not silently pool.

The report may display sessions side-by-side but must label the comparison exploratory/incompatible where appropriate.

---

# 35. Deterministic report provenance

Every analytical report must identify:

- analysis-plan ID/version;
- analysis-engine version;
- exact input file hashes;
- config fingerprint;
- generation UTC;
- primary endpoint;
- secondary endpoints;
- exploratory modules;
- exclusion/deviation treatment.

Re-running analysis on unchanged locked inputs with the same version must produce semantically identical numeric results.

If formatting includes a generation timestamp, that timestamp must not change the scientific result hash unless the implementation intentionally separates content hash from presentation metadata.

---

# 36. Minimum first-build statistics

For binary exact-match sessions/blocks provide deterministic calculations for:

- number of eligible trials;
- number of matches;
- observed match proportion;
- null probability `0.5` where applicable;
- signed difference from null;
- a clearly documented exact or numerically stable binomial-tail calculation when declared by the analysis plan;
- confidence interval method/version if displayed.

For binary stream windows provide:

- `n`;
- count toward requested direction;
- proportion toward requested direction;
- signed deviation from `0.5`;
- versioned z/binomial statistic when declared.

For exact-token trials provide:

- outcome-space size `N`;
- exact match true/false;
- nominal single-preregistered-target null probability `1/N`.

Do not turn these values into a claim that a mechanism has been proven.

---

# 37. Analysis fixtures

Tests must include fixed known datasets for every implemented analysis algorithm.

Do not test statistical code only on random data.

Store small fixtures with independently checkable expected values for:

- exact-match counts;
- binary proportions;
- binomial calculation;
- window classification;
- cumulative deviation;
- threshold crossing;
- mapping/scoring;
- exact-token probability.

---

# 38. Export

Provide a read-only session export function.

At minimum export/copy the canonical session bundle plus integrity manifest to a user-selected local destination or a deterministic export directory.

Do not alter the original bundle during export.

If a compressed archive dependency is not justified, a copied directory is acceptable.

Export must respect reveal policy; before reveal, do not create a participant-facing export that exposes hidden results.

---

# 39. Import / legacy review

The first build may limit import to its own supported bundle schema.

If legacy sessions are shown, label whether their integrity can be verified under the current scheme.

Do not fabricate hashes for historical records that never had them.

---

# 40. Deletion policy

The application must not provide an ordinary one-click delete action for committed session evidence.

If local deletion is ever added later, it must be an explicitly separate administrative operation outside the normal research workflow and must never be represented as if the deleted session had not occurred.

For the first build, prefer no committed-session deletion UI.

---

# 41. Test requirements

Automated tests must cover at minimum:

- ID allocation/collision protection;
- valid and invalid state transitions;
- canonical serialization stability;
- event-chain creation/verification;
- event edit/reorder/delete/insert detection;
- atomic draft/final snapshot behavior;
- raw-report lock immutability;
- late recollection append behavior;
- machine-output block hash linkage;
- integrity-manifest verification;
- hidden-result server-side gating;
- no hidden result in participant API payload before reveal;
- crash/incomplete-session discovery;
- missed target handling without backfill;
- logging failure fail-closed behavior using fault injection/mocks;
- session-index rebuild;
- block-level reveal;
- balanced block preservation with aborts;
- cross-session comparability gate;
- deterministic analysis fixtures;
- session review rendering does not mutate evidence.

---

# 42. Acceptance definition

Session logging/review is not complete merely because `events.jsonl` exists.

It is complete only when:

- session/trial/block identities are unambiguous;
- every material transition is logged;
- raw machine output is preserved and linked;
- commitment exists before outcome generation where required;
- report lock is immutable;
- reveal is server-side gated;
- corrupt/tampered bundles are detected;
- interrupted and failed sessions remain visible;
- session history can be browsed and filtered;
- one session can be audited chronologically from UI and raw files;
- primary/exploratory results remain distinct;
- comparable sessions can be grouped without silently pooling incompatible versions;
- the index can be rebuilt from canonical evidence;
- and a future reviewer can understand exactly what happened without relying on chat memory.
