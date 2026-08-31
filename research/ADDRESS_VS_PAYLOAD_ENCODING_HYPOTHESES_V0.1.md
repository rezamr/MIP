# MIP Address-vs-Payload Encoding Hypotheses v0.1

## Status

`PRE-CODEX RESEARCH NOTE — MECHANISM UNKNOWN`

## Purpose

Clarify a recurring conceptual question in MIP: if the hypothesized MATRIX does not literally parse ordinary human symbols, words, digits, or clock notation, how can coordinate remote viewing and MIP binary REQUEST tasks be represented coherently?

The historical record does **not** establish that a MATRIX "understands only feelings." That statement must remain a working hypothesis, not a fact.

## Historical coordinate-remote-viewing lesson

Declassified SRI/Army materials show that viewers were sometimes given geographic coordinates as the sole target reference. In Stage I of Coordinate Remote Viewing, the coordinate was followed by a rapid kinesthetic ideogram intended to capture the site's overall gestalt/motion rather than a visual picture.

A 1980 SRI report explicitly described CRV as target access through an abstract locator and noted that good results had reportedly also been obtained with specially constructed arbitrary coordinate systems. The authors interpreted this as suggestive of goal orientation rather than a mechanism tied literally to geographic-coordinate semantics.

A separate Army session is especially important because erroneous coordinates reportedly led the viewer to describe the location actually indicated by those coordinates rather than the experimenter's intended Air Force Base target. This historical observation pulls in the opposite direction: under at least one reported session, the concrete coordinate address appeared to matter.

Therefore the archival record does not justify one simple rule such as "coordinates are meaningless" or "the system literally reads numbers." Both address-specific and goal-oriented models remain testable.

## MIP conceptual separation

MIP should distinguish:

1. **Address / locator** — what identifies the target or requested state.
2. **Payload / desired outcome** — what state is requested.
3. **Human representation** — how the participant internally encodes the request.
4. **Machine representation** — the objective physical/computational state that will later be scored.

These layers need not use the same representation.

Example:

- machine state = binary bit `1`;
- human-facing label = numeral `1`;
- internal representation = upright stroke + upward kinesthetic motion + completion/target feeling;
- scored endpoint = machine output equals bit `1`.

The numeral is therefore only one possible human label for the objective target state.

## Primary implication for binary REQUEST

Do not assume the participant must somehow teach MATRIX the Arabic numeral `1` or `0`.

The participant can encode the **desired endpoint** using a deliberately stable multimodal target bundle.

Candidate initial bundles:

### Target state 1

- semantic label: one;
- simple visual form: upright stroke;
- kinesthetic form: upward/straight movement;
- affective state: neutral-to-moderate sense of completion/certainty;
- endpoint concept: the machine is in the state we call `1`.

### Target state 0

- semantic label: zero;
- simple visual form: closed loop/circle;
- kinesthetic form: closed/circular movement;
- affective state: the same neutral-to-moderate completion/certainty intensity;
- endpoint concept: the machine is in the state we call `0`.

The affective intensity should remain matched across 0 and 1 so emotional asymmetry does not become a confound.

## Why a multimodal bundle is useful

If the effect, if any, is semantic, the verbal/goal component may matter.

If it is symbolic, the simple shape may matter.

If it is kinesthetic/gestalt-like, the movement/form component may matter.

If it is primarily goal-oriented, the completed-end-state intention may matter while the particular symbol does not.

A composite bundle is therefore a reasonable operational baseline, but later experiments should isolate components rather than assume which one works.

## Critical experimental upgrade: arbitrary mapping

A later test should deliberately separate symbol semantics from requested machine state.

Example precommitted mapping:

- `BLUE` -> machine state `1`
- `GOLD` -> machine state `0`

or two arbitrary nonsemantic shapes/tokens mapped to the two machine states.

If performance follows the **mapping/goal** despite the arbitrary symbol, that would support a goal/address model over literal digit semantics.

If performance follows the literal numeral more strongly than arbitrary mappings, that would suggest representation specificity.

If only kinesthetic/affective bundles work, that would support a different channel model.

None of these outcomes establishes a metaphysical mechanism by itself.

## Better physical-state variant

To reduce dependence on human digit semantics, MIP may later define two objectively distinct machine outcomes and treat `0` and `1` only as database labels.

Examples:

- upper indicator vs lower indicator;
- left channel vs right channel;
- state A vs state B;
- two physical device states.

The participant requests the desired state/gestalt; analysis maps the state back to binary labels afterward.

This is especially useful when testing the hypothesis that the interaction tracks physical/goal states rather than written symbols.

## Recommended first baseline

For the first participant profile, preserve binary machine outcomes for clean statistics but use a symmetric multimodal request bundle rather than relying on the numeral alone.

Suggested operational representation:

`semantic target + simple shape + simple kinesthetic form + matched completion/certainty feeling + release`

Do not make 1 emotionally "positive" and 0 emotionally "negative." Both are equally valid targets.

## Later encoding-comparison program

After the baseline is stable, compare one variable at a time:

1. semantic numeral only;
2. visual numeral/shape only;
3. kinesthetic/gestalt only;
4. completion/goal state only;
5. combined bundle;
6. arbitrary symbol-to-state mapping;
7. physical-state request without participant-facing numeric semantics.

This turns the philosophical question "what does MATRIX understand?" into an experimentally testable encoding question.

## Current conclusion

MIP should not encode into software the assumption that MATRIX understands digits, words, or only feelings.

The software should keep machine outcome, participant-facing label, internal encoding protocol, and scoring endpoint as separate configurable objects.

That architecture allows later experiments to determine whether any observed correspondence tracks literal symbols, arbitrary addresses, kinesthetic gestalts, affect, completed-goal representation, or none of them.
