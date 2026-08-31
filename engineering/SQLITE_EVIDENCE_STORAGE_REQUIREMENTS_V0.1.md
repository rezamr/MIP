# MIP SQLite Evidence Storage Requirements v0.1

## Status

`ACTIVE — RUNTIME STORAGE AND EVIDENCE REQUIREMENT`

## Decision

The Electron desktop application uses SQLite as the authoritative runtime datastore for MIP sessions, trials, events, machine output, locked reports, profiles, audio recipes, calibration records, integrity metadata, and deterministic analysis results.

Runtime JSON/JSONL files are no longer the primary evidence store for new Electron sessions.

JSON remains useful for:

- canonical configuration serialization inside database rows;
- explicit export/import bundles;
- human-readable archival export;
- test fixtures;
- repository documentation.

The database does not weaken the append-only/tamper-evident evidence model. Immutability and hash chaining remain mandatory.

---

# 1. Why SQLite

SQLite is selected because MIP is a local desktop research application and needs:

- transactional writes;
- reliable crash recovery;
- efficient querying of many sessions;
- report/filter/chart performance;
- schema migrations;
- indexed timelines;
- persistent profile/calibration history;
- a single locally backed-up evidence store;
- no external database service.

Do not introduce a network database server.

---

# 2. Database ownership

Only the Electron main process may open the authoritative SQLite database.

The renderer must never:

- open the database directly;
- execute SQL;
- receive a raw database connection;
- receive a generic SQL IPC method.

All access goes through domain repositories/services such as:

- SessionRepository;
- EvidenceRepository;
- ProfileRepository;
- AudioRecipeRepository;
- CalibrationRepository;
- AnalysisRepository;
- IntegrityRepository.

---

# 3. Driver abstraction

Implement a small database adapter boundary so the application is not scattered with driver-specific calls.

The selected SQLite binding must:

- be compatible with the chosen Electron runtime;
- support transactions;
- support parameterized statements;
- support BLOBs;
- support backup/checkpoint operations required by this document;
- have deterministic documented installation/build behavior.

Prefer the Electron/Node runtime's stable built-in SQLite API if it is production-stable in the exact selected runtime. Otherwise use a mature native binding such as `better-sqlite3` and include the required Electron rebuild/packaging configuration.

Do not use an in-memory/WebAssembly browser database as the authoritative store.

The implementation completion report must state the exact driver and why it was selected.

---

# 4. Database file and durability

Store the production database under the Electron application user-data directory, not inside the source repository.

Conceptually:

```text
<userData>/MIP/data/mip.sqlite3
```

Use SQLite durability settings appropriate to local evidence recording, including:

- `foreign_keys = ON`;
- WAL journal mode where supported;
- full or equivalently strong synchronous durability for formal evidence writes;
- a reasonable busy timeout;
- explicit transactions for multi-row evidence transitions.

Do not silently sacrifice evidence durability for benchmark speed.

---

# 5. Schema versioning and migrations

Maintain an explicit migration table, for example:

```text
schema_migrations
```

Every schema change must be versioned.

Migration rules:

- migrations are ordered;
- migrations run before normal application use;
- migrations are transactional where SQLite permits;
- failed migrations do not leave a half-upgraded database silently usable;
- migration result is logged;
- no destructive migration may silently discard session evidence;
- backup before destructive/complex migrations.

---

# 6. Core data model

The exact naming may vary, but the data model must represent these concepts cleanly.

## 6.1 sessions

Store stable session identity and non-secret lifecycle metadata, including:

- session_id;
- created_utc;
- participant label/reference;
- record type;
- profile version reference;
- status projection;
- reveal policy reference;
- active trial/block references where relevant;
- recovery state;
- app/engine versions.

The mutable status column is a convenience projection. The authoritative history is the append-only event chain.

## 6.2 trials

Separate trial identity from session identity.

Store:

- trial_id;
- session_id;
- trial sequence;
- trial type;
- committed configuration reference;
- current projection state.

## 6.3 blocks

Support grouped sessions/trials for:

- balanced assignment;
- block reveal;
- block analysis;
- future experimental designs.

## 6.4 session_commitments

Immutable commitment record containing the frozen effective configuration used by the formal session/trial.

Store canonical configuration text and SHA-256 fingerprint.

The commitment must include or reference:

- objective outcome space;
- participant mapping;
- request encoding;
- timing policy;
- machine-output policy;
- RNG provider/version and relevant seed/commitment data;
- session protocol;
- audio recipe/version;
- analysis plan;
- reveal policy;
- reporting profile;
- application/engine/audio versions;
- nonce where required.

## 6.5 evidence_events

Authoritative append-only event chain.

Minimum fields:

- session_id;
- trial_id nullable where session-level;
- seq;
- event_id;
- event_type;
- occurred_utc;
- monotonic_ns or equivalent monotonic timestamp;
- canonical payload;
- previous_hash;
- event_hash.

Unique constraints must prevent duplicate `(session_id, seq)` and duplicate event IDs.

## 6.6 machine_outputs

Lossless generated machine-output evidence.

For ordinary MIP output rates, one row per logical output is acceptable and preferred for clarity.

Store at minimum:

- session_id;
- trial_id;
- output_seq;
- generated_utc;
- monotonic timestamp;
- objective value encoded losslessly;
- timing region/window identifier;
- RNG provider/version;
- record hash or chain reference.

If a future profile produces output at a rate where row-per-output becomes inefficient, add a versioned chunk format rather than silently dropping timing or values.

## 6.7 raw_report_drafts

Mutable draft state only.

Drafts are not primary evidence.

They may be replaced/autosaved until lock.

## 6.8 raw_reports_locked

Immutable locked raw report.

Store:

- session_id;
- locked_utc;
- canonical report payload;
- SHA-256 lock hash;
- schema version.

After insertion, in-place UPDATE/DELETE is forbidden.

## 6.9 late_annotations

Append-only post-lock notes/recollections.

Never rewrite the locked raw report.

## 6.10 experiment_profiles and profile_versions

Store profile identity separately from immutable versions.

A used version is never silently mutated.

## 6.11 audio_recipes and audio_recipe_versions

Store recipe identity/provenance separately from immutable versions.

Preserve:

- recipe class/provenance;
- canonical recipe configuration;
- validation state;
- historical uncertainty notes;
- engine compatibility version.

## 6.12 calibrations

Calibration runs are first-class evidence, separate from participant sessions.

Store:

- calibration_id;
- provider/version;
- requested sample count;
- timing;
- counts/distribution statistics;
- provider metadata;
- canonical configuration;
- result hash;
- integrity status;
- optional linked raw calibration outputs where required.

## 6.13 analysis_results

Store deterministic derived results with explicit analysis version and input evidence fingerprint.

Derived analysis is reproducible and may be regenerated.

Never allow a stored analysis result to replace raw evidence.

---

# 7. Database-level immutability

Application conventions alone are insufficient for primary evidence.

Use database constraints/triggers to prohibit UPDATE and DELETE on immutable evidence tables after creation, including at minimum:

- evidence_events;
- session_commitments;
- raw_reports_locked;
- machine_outputs for formal evidence;
- late_annotations;
- immutable profile versions after first use;
- immutable audio-recipe versions after first use.

If a correction is needed, append a new correction/annotation event rather than rewriting history.

Mutable projection tables may be updated because they are not primary evidence.

---

# 8. Hash chain and canonicalization

Preserve the event hash-chain semantics from the earlier JSONL design.

For each event:

```text
current_hash = SHA-256(canonical(event_without_current_hash))
```

Canonicalization rules must be stable and versioned.

Store the canonicalization version with commitments/evidence when necessary for future verification.

Use real SHA-256 from the privileged runtime for authoritative evidence.

Do not use ad-hoc 32-bit checksums as cryptographic integrity evidence.

---

# 9. Machine-output integrity

Machine output is primary evidence.

At minimum provide:

- per-record or chunk integrity;
- ordered sequence constraints;
- final output-set fingerprint referenced by the session evidence chain;
- verification that no sequence values are missing, duplicated, or reordered without detection.

Do not rely only on database presence as proof of integrity.

---

# 10. Atomic session transitions

Important transitions must be transactional.

Examples:

- commitment creation + commitment event;
- session START transition + START event;
- raw-report lock + lock event + reveal-eligibility projection;
- reveal event + reveal projection;
- completion/failure finalization.

A crash between rows must not create a state that falsely looks complete.

---

# 11. Reveal security

Hidden objective/result data remains stored only in the privileged database/main process until reveal eligibility.

Before reveal:

- renderer queries must receive redacted session DTOs;
- report queries must omit hidden objective values;
- machine output routes/IPC methods must reject disclosure if they can reveal hidden information under the active policy;
- renderer caches must not contain hidden result data.

The main process is the authoritative reveal gate.

---

# 12. Crash recovery

On application startup:

- detect nonterminal sessions;
- inspect last authoritative event;
- classify incomplete/crash-recovered state;
- preserve all existing evidence;
- never fabricate missing events/output;
- present recovery state in Sessions & Reports.

If the audio/session engine was interrupted, append a recovery/deviation event once the application has enough information to do so honestly.

---

# 13. Backup and restore

Provide local backup support.

At minimum:

- explicit `Backup Now` action;
- automatic safe backup after important milestones such as completed/locked research sessions, subject to reasonable performance constraints;
- database-consistent backup mechanism;
- timestamped backup metadata;
- backup verification;
- restore workflow that never silently overwrites the only existing database without creating a safety copy.

A backup may contain hidden outcomes because it is an owner-local privileged artifact. It must never be exposed through participant-facing renderer views before reveal.

---

# 14. Export and portability

Although SQLite is authoritative at runtime, each session must be exportable as a self-contained evidence bundle for archival/review.

Export can include machine-readable files such as:

- manifest.json;
- events.jsonl or events.json;
- machine-output.csv/jsonl/binary;
- raw-report.json;
- analysis.json;
- audio-recipe.json;
- integrity.json;
- README/report summary.

These are export representations, not parallel writable primary stores.

The export bundle must include hashes sufficient to verify that it corresponds to the selected database evidence.

---

# 15. Query/report performance

Add indexes for common research queries, including where appropriate:

- session created time;
- status;
- profile/version;
- audio recipe/version;
- event `(session_id, seq)`;
- machine output `(session_id, trial_id, output_seq)`;
- calibration time/provider;
- block membership.

Do not load an entire long evidence history into UI memory when pagination/windowed queries are sufficient.

---

# 16. Migration from current JSON/JSONL runtime data

The Electron migration must not silently discard existing v1.0/v1.1 local runtime bundles.

Implement an explicit legacy import/migration tool that can:

- scan a user-selected legacy runtime directory;
- validate existing JSON/JSONL evidence as far as possible;
- import sessions into SQLite as legacy-import records;
- preserve original identifiers where collision-free;
- preserve original hashes and source filenames in migration metadata;
- never mark a legacy import as stronger integrity than the source evidence supports;
- produce an import report.

Do not automatically import unknown directories without owner action.

---

# 17. Acceptance tests

Before the storage migration is accepted, demonstrate:

1. database creation and migrations;
2. WAL/durability configuration;
3. exclusive session ID allocation;
4. transactional commitment;
5. append-only event chain;
6. DB-level UPDATE/DELETE rejection for immutable evidence;
7. machine-output ordering/integrity;
8. raw-report draft replacement before lock;
9. immutable locked report;
10. append-only late note;
11. reveal redaction before eligibility;
12. reveal after eligibility;
13. crash/incomplete recovery;
14. restart persistence;
15. profile version immutability;
16. audio recipe version immutability;
17. calibration persistence and history;
18. deterministic analysis regeneration from stored raw data;
19. backup creation/verification;
20. restore safety behavior;
21. session evidence export;
22. legacy JSON/JSONL import fixture;
23. corruption/tampering detection where covered by MIP integrity design.
