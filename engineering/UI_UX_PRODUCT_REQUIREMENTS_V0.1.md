# MIP UI/UX Product Requirements v0.1

## Status

`ACTIVE — FIRST-BUILD PRODUCT/INTERFACE REQUIREMENT`

## Purpose

The first MIP application must be scientifically rigorous **and** genuinely pleasant, clear, fast, and confidence-inspiring to use. The project owner should not feel that the research engine is a raw developer tool, a collection of debug forms, or a visually unfinished prototype.

This file defines the mandatory user-interface and user-experience requirements for the first local-computer build.

The scientific engine remains more important than visual decoration, but a poor interface can itself create protocol mistakes, wrong configuration, accidental reveal, missed fields, confusion, and unusable reports. Therefore UI/UX quality is a research-integrity requirement as well as a product-quality requirement.

---

# 1. Application language

The complete application UI must be **English-only** for the first build.

This includes:

- navigation;
- buttons;
- labels;
- helper text;
- tooltips;
- validation messages;
- warnings;
- modal dialogs;
- report headings;
- chart labels;
- session status labels;
- audio labels;
- configuration editors;
- empty states;
- export labels;
- error screens;
- test/demo fixtures visible in the UI.

Do not mix Persian and English inside the application.

Repository documentation remains English as already required.

---

# 2. Product-design principle

The application should feel like a focused local research instrument, not an admin dashboard template.

Design for:

- clarity;
- calmness;
- scientific credibility;
- low cognitive load;
- strong visual hierarchy;
- obvious next actions;
- excellent input ergonomics;
- excellent report readability;
- prevention of accidental destructive/invalid actions;
- progressive disclosure of complexity.

Avoid:

- dense walls of controls;
- giant raw JSON-first workflows;
- developer terminology on the main participant path;
- browser-default-looking forms;
- excessive animation;
- decorative gradients that reduce readability;
- gimmicky science-fiction visuals;
- hidden state changes;
- ambiguous icons without text;
- color as the only status indicator.

A restrained modern visual system is preferred.

---

# 3. Design system

Implement a small reusable design system rather than styling each screen independently.

Define and reuse:

- typography scale;
- spacing scale;
- border radius rules;
- surface/elevation rules;
- form-control sizes;
- button hierarchy;
- semantic status treatments;
- card/panel patterns;
- table patterns;
- chart container patterns;
- modal/dialog patterns;
- alert/warning patterns;
- empty/loading/error states.

Use CSS variables/design tokens for repeated visual values.

The UI should remain consistent across the application.

---

# 4. Layout

Desktop-first local-browser layout.

The first build is not a mobile application, but the browser UI should still degrade gracefully on a narrower window.

Recommended shell:

- persistent left navigation or similarly stable primary navigation;
- clear page title and page-level actions;
- content area with sensible maximum widths for forms/reports;
- full-width use only where logs, charts, or tables benefit from it.

Primary navigation:

1. `Start Research Session`
2. `Audio Lab`
3. `Experiment Profiles`
4. `Calibration`
5. `Sessions & Reports`

Secondary/advanced tools should not clutter primary navigation unless genuinely needed.

---

# 5. Home / launch experience

The launch screen should immediately answer:

- What can I do now?
- What profile will I run?
- Is the system healthy?
- Are there incomplete sessions requiring attention?

Provide clear cards/actions for the five primary areas.

Show lightweight system status such as:

- active engine version;
- runtime-data location;
- random-source health;
- configuration validity;
- incomplete/recoverable session count if nonzero.

Do not show hidden scientific outcomes on the home screen.

---

# 6. Start Research Session — premium-quality workflow

Starting a research session must be one of the best-designed flows in the application.

Use a guided sequence/wizard with clearly visible progress.

Recommended steps:

## Step 1 — Choose experiment profile

Show profile cards or a clean selector with:

- human-readable name;
- concise purpose;
- active status;
- timing mode;
- outcome space;
- request assignment;
- audio condition/pool;
- reveal policy;
- whether it is `Operational`, `Dry Run`, `Experimental`, or `Historical Reconstruction`.

Allow `View details` without leaving the flow.

Do not expose a wall of low-level fields here.

## Step 2 — Pre-session state

Collect required baseline fields using well-designed grouped inputs.

Use appropriate controls:

- sliders or segmented scales for 0–10 ratings;
- time/duration controls for sleep/time-since-waking;
- select/radio groups for categorical fields;
- concise optional notes.

Use labels plus short helper text where needed.

Do not require unnecessary fields.

## Step 3 — Assignment / participant target

Resolve the objective requested state through the configured assignment policy.

Show participant-facing target prominently and clearly.

If the first profile uses literal binary labels, the target should be visually unmistakable.

Also show the configured encoding guidance in a simple, calm layout.

Require explicit memory confirmation before proceeding.

Never accidentally expose future machine output or hidden condition metadata.

## Step 4 — Session readiness review

Provide a clean preflight summary:

- experiment profile;
- request assignment policy;
- participant-facing target;
- timing semantics;
- machine-output policy;
- selected audio recipe;
- audio verification status;
- random source;
- session protocol;
- analysis plan;
- reveal policy.

Use human-readable labels, not only IDs.

Provide a collapsible advanced section with exact IDs, versions, hashes, and effective JSON.

Show validation status prominently.

If anything mandatory is invalid, START remains disabled and the exact corrective action is clear.

## Step 5 — Commit and START

After commitment, visually indicate that the session configuration is frozen.

Use one dominant `START SESSION` control.

Prevent accidental double-start.

After START, transition cleanly into hands-free mode.

---

# 7. Hands-free active-session screen

The active-session screen must be intentionally minimal and non-distracting.

It must not require interaction during the altered-state portion.

Display only information that is safe and useful under the active protocol.

Potential elements:

- subtle session-running status;
- current protocol stage only if the profile allows it;
- neutral visual indication that the application is active;
- optional software stop control as a convenience, not a required safety mechanism.

Do not display:

- hidden outputs;
- live requested-direction performance;
- trend charts;
- countdowns unless the selected protocol explicitly allows them;
- debug information;
- anything that can contaminate the session.

The screen should be safe to leave visually unattended.

---

# 8. Return and raw-report workflow

After the return cue, guide the participant into the report without exposing hidden outcome data.

The report screen must be exceptionally clear because it captures primary subjective evidence.

Use grouped sections with meaningful headings.

Support:

- autosave draft state;
- completion indicators per section;
- `Unknown` / `Not experienced` choices where relevant;
- sensible rating controls;
- free-text areas with adequate space;
- timeline inputs that do not force false precision;
- clear distinction between raw observation and interpretation.

The subjective-time section must occur before actual elapsed time is shown.

Before lock, clearly explain that locking creates an immutable raw report.

Use a deliberate confirmation dialog for `LOCK RAW REPORT`.

After lock:

- show a clear `Locked` state;
- make fields read-only;
- do not offer an edit affordance;
- provide a separate mechanism for append-only late recollections.

---

# 9. Reveal experience

When reveal becomes eligible, the reveal screen should be clear and restrained.

Show:

- requested objective state;
- participant-facing label;
- generated outcome/result;
- primary endpoint result;
- timing status;
- protocol deviations if any;
- integrity status.

Do not use celebratory animations, confetti, dramatic red/green judgment, or wording that implies proof of a mechanism.

Use neutral scientific language such as:

- `Match`
- `No Match`
- `Directional deviation`
- `Primary endpoint met/not met`
- `Exploratory finding`
- `Protocol deviation`

A single result must never be presented as a conclusion that a condition works.

---

# 10. Sessions & Reports — core review workspace

This area is a major product surface, not an afterthought.

## Session list

Provide a polished searchable/filterable table or card-table hybrid.

Columns/fields should include as appropriate:

- session ID;
- date/time;
- profile;
- status;
- audio;
- timing mode;
- requested state;
- result availability;
- integrity status;
- protocol deviation indicator.

Filters should support at least:

- date range;
- profile;
- status;
- audio condition;
- timing mode;
- complete/incomplete/aborted;
- integrity pass/fail;
- result category after reveal eligibility.

Do not hide failed/aborted sessions by default.

## Session detail

Use tabs or a similarly strong information architecture:

1. `Overview`
2. `Timeline`
3. `Machine Output`
4. `Raw Report`
5. `Analysis`
6. `Audio & Configuration`
7. `Integrity`
8. `Files / Export`

### Overview

Show high-value summary cards and key session metadata.

### Timeline

Show the ordered event timeline visually with exact timestamps available on demand.

Make stage transitions, request/release, target windows, return, report lock, reveal, warnings, and errors easy to distinguish.

### Machine Output

Provide raw-data inspection plus visual summaries.

For stream profiles include readable charts for:

- cumulative requested-direction deviation;
- fixed-window deviations;
- declared primary window;
- exploratory neighboring windows;
- threshold/change-point markers where configured.

Primary and exploratory regions must be visually differentiated and labeled.

Never visually promote the strongest exploratory window as if it were primary.

### Raw Report

Show the immutable report exactly as locked, with a visible hash/status.

Show late recollections separately.

### Analysis

Use a structured report layout with sections, summary metrics, charts, caveats, and exact analysis-plan/version information.

### Audio & Configuration

Show human-readable configuration first, with advanced exact parameters/hashes available through disclosure panels.

### Integrity

Show a clear integrity verdict and detailed checks:

- event-chain verification;
- file-hash verification;
- configuration snapshot verification;
- audio artifact verification;
- raw-report lock verification.

### Files / Export

Allow exporting the complete session evidence bundle and show exactly what is included.

---

# 11. Reports — visual and analytical quality

Reports must be useful to a human researcher, not just JSON dumps.

Every deterministic report should have:

- clean title/header;
- session/profile identity;
- status and integrity summary;
- concise executive factual summary;
- primary endpoint section;
- timing section;
- machine-output section;
- participant-state section;
- subjective-time section;
- protocol-deviation section;
- audio/configuration section;
- hashes/integrity section;
- analysis-version section;
- clearly separated exploratory findings.

Use tables where comparison is easier than prose.

Use charts only when they improve understanding.

All charts must have:

- clear title;
- labeled axes;
- units;
- legend when needed;
- primary/exploratory distinction;
- no misleading truncated scales unless explicitly justified.

Provide a print-friendly report style.

---

# 12. Cross-session / block reports

When scientifically compatible sessions are compared, provide a polished comparison workspace.

Possible views:

- session count and compatibility summary;
- outcome correspondence rate;
- directional-deviation distribution;
- audio-condition comparison;
- timing-condition comparison;
- subjective-state comparison;
- subjective-time distortion comparison;
- abort/forgotten-target rates;
- integrity/protocol-deviation counts.

Clearly state inclusion/exclusion rules.

If profiles are materially incompatible, do not silently pool them. Explain why they are separated.

---

# 13. Experiment Profiles UX

Profiles are powerful but should remain understandable.

Provide:

- profile list with status badges;
- duplicate action;
- compare versions;
- edit-as-new-version workflow;
- validation state;
- human-readable summary;
- read-only effective JSON view;
- dependency references.

Organize profile editing into logical sections:

1. `Identity`
2. `Request Assignment`
3. `Outcome Space`
4. `Participant Mapping`
5. `Request Encoding`
6. `Timing`
7. `Machine Output`
8. `Random Source`
9. `Session Protocol`
10. `Audio`
11. `Analysis`
12. `Reveal`
13. `Reporting`

Use progressive disclosure.

Do not put every advanced field on one page.

Validation errors must be inline, specific, and actionable.

Show a final effective preview before saving a new version.

---

# 14. Audio Lab UX

The Audio Lab should be extremely easy for ordinary use.

Top-level modes:

1. `Presets`
2. `Quick Generator`
3. `Simple Custom`
4. `Advanced Custom`
5. `Historical / Layered Reconstruction`

## Presets

Show the three initial presets as clean selectable cards.

Display actual left/right frequencies and provenance/status.

One click selects; one primary button starts playback.

## Quick Generator

The user should normally enter one center value and get derived channels automatically under the selected template.

Example:

center 396 Hz + 4-Hz centered template -> left 394 / right 398.

Show derived values immediately and read-only.

## Simple Custom

Group only commonly useful controls.

## Advanced Custom

Expose all supported primitives in organized collapsible groups.

## Historical / Layered Reconstruction

Show provenance prominently.

Clearly distinguish:

- documented patent example;
- patent-grounded reconstruction;
- MIP experimental reconstruction;
- historical candidate with incomplete parameters;
- source-verified historical reconstruction.

Incomplete historical recipes should visibly list missing required parameters.

## Playback

Provide excellent transport controls:

- Play;
- Pause;
- Resume;
- Stop;
- elapsed playback time;
- current recipe/status.

Do not impose a hidden duration limit on Audio Lab live preview.

## Save / render

Separate `Save Recipe` from `Render for Formal Session`.

Make it impossible to confuse unsaved preview state with frozen formal audio.

---

# 15. Formal audio render UX

For formal layered audio, provide a guided render/verification flow:

1. select versioned recipe;
2. select/derive formal session duration/timeline;
3. review exact manifest inputs;
4. render;
5. show progress/status;
6. run verification;
7. show pass/fail checklist;
8. show hashes;
9. mark artifact eligible/ineligible for formal session.

A failed verification must be visually obvious and must prevent session selection/START.

Do not bury missing historical parameters in a log file; show them clearly in the UI.

---

# 16. Calibration UX

Calibration should support quick trustworthy operation.

Provide:

- random-source selector;
- outcome-space selector;
- sample/block size;
- start action;
- progress state;
- generated counts/distribution;
- bias/uniformity summaries;
- serial-correlation summary where implemented;
- integrity/hash information;
- save/export result.

Clearly label calibration as `No participant request/intention`.

---

# 17. Inputs

All user inputs must be carefully designed.

Requirements:

- clear labels always visible;
- no placeholder-only labeling;
- helper text only where it adds value;
- sensible defaults only when scientifically safe;
- units shown next to numeric inputs;
- correct numeric step/min/max behavior;
- immediate validation where helpful;
- server-side validation remains authoritative;
- disabled states explain why;
- destructive/locking actions require deliberate confirmation;
- date/time fields show timezone context;
- sliders display exact numeric value;
- long configuration IDs are not required for normal selection.

Do not silently coerce scientifically invalid values.

---

# 18. Outputs and status communication

Every important state should be visible and unambiguous.

Examples:

- `Draft`
- `Validated`
- `Committed`
- `Running`
- `Returned`
- `Raw Report Pending`
- `Raw Report Locked`
- `Reveal Eligible`
- `Revealed`
- `Completed`
- `Aborted`
- `Incomplete`
- `Protocol Deviation`
- `Integrity Verified`
- `Integrity Failed`

Use icon + text + visual treatment rather than color alone.

---

# 19. Error handling

Errors must be useful.

Bad:

`Invalid configuration`

Good:

`Timing policy RELATIVE_DELAY references anchor "request_complete", but the selected session protocol does not emit that anchor.`

For user-facing errors:

- state what failed;
- state whether data are safe;
- state whether the session can continue;
- provide the next recovery action when possible;
- preserve technical detail in an expandable section.

Never erase evidence because an operation failed.

---

# 20. Accessibility and usability

Implement reasonable accessibility from the first build:

- semantic HTML;
- keyboard navigation;
- visible focus states;
- proper label/control association;
- sufficient contrast;
- status not communicated by color alone;
- buttons large enough for reliable use;
- charts accompanied by numerical/table summaries where practical.

---

# 21. Performance

UI should feel immediate for ordinary navigation and forms.

Do not load enormous raw machine-output files into the browser unnecessarily.

Use pagination, streaming, sampling for display, or server-side summarization while preserving raw evidence on disk.

Large logs should remain reviewable without freezing the interface.

---

# 22. No hidden science behind visual polish

Visual quality must never weaken scientific safeguards.

Never hide:

- protocol deviations;
- failed integrity checks;
- aborted sessions;
- missing fields;
- exploratory status;
- reconstruction provenance;
- incompatibility between sessions.

A beautiful report that misrepresents evidence is a failed implementation.

---

# 23. Required UI/UX acceptance demonstrations

Before owner review, Codex must demonstrate and document at minimum:

1. complete English-only application UI;
2. polished navigation and consistent design system;
3. end-to-end Start Research Session wizard;
4. clear target-memory confirmation;
5. clean hands-free active screen;
6. raw-report workflow with autosave draft and immutable lock;
7. server-gated reveal UX;
8. polished Sessions & Reports list with filters;
9. session detail tabs/views;
10. readable event timeline;
11. machine-output visualization with primary vs exploratory regions clearly distinguished;
12. readable deterministic session report;
13. integrity review interface;
14. export workflow;
15. experiment profile editor with progressive disclosure and validation;
16. Audio Lab preset/quick/simple/advanced/historical modes;
17. formal layered-audio render + verification workflow;
18. calibration interface;
19. meaningful empty/loading/error states;
20. keyboard-accessible core workflows;
21. print-friendly session report;
22. narrow-window usability check.

UI/UX must not be reported as complete merely because every route exists.

The owner should be able to operate the main application flows without reading raw JSON or source code.
