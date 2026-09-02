# MIP Audio Source Provenance and Verification Register v0.1

Status: active engineering register for MIP 1.2.0.

This register is the human-readable companion to the immutable
`parameterProvenance` object stored in every versioned audio recipe.  A recipe
class is a summary; it never upgrades a component whose source status is
unknown.  Software verification means that the implementation matches the
declared recipe.  It is not historical or scientific verification.

## Authority and source boundary

The implementation follows `engineering/ACTIVE_IMPLEMENTATION_AUTHORITY_V0.1.md`
and the active audio requirements.  US Patent 5,356,368 is used only for the
capability/architecture claims recorded in
`engineering/AUDIO_SYNTHESIS_REQUIREMENTS_V0.1.md` and
`engineering/HISTORICAL_HEMISYNC_RENDER_REQUIREMENTS_V0.1.md`.  Those documents
do not establish MIP's exact sample rate, carrier set, gain, phase, filter
coefficient, delay range, timing, or historical track assignment.

## Traceability table

| Recipe ID | Component / parameter | Effective value | Provenance class | Primary source / MIP authority reference | Source status | Derivation / reconstruction rule | Implementation location | Verification test | Historical-exactness status | Open question |
|---|---|---:|---|---|---|---|---|---|---|---|
| A-U396-4 | Primary carrier L/R | 394 / 398 Hz | MIP_OPERATIONAL_DEFINED | Active authority §10 | MIP component condition | Center 396 and 4-Hz difference are the documented MIP baseline | `public/audio-core.js` `BUILTIN_RECIPES` | `audio-core-v12.test.js` pure reference | MIP-defined; not historical exact | None for this component condition |
| A-U396-4 | Carrier gain, phase, waveform, headroom, master/ramp | 0.25/0.25, 0/0, sine, -3 dB, 0.8/0.01 s | MIP_OPERATIONAL_DEFINED | Active authority §10; audio requirements | Operational definition | Explicit component-test defaults; not inferred from a historical recording | `public/audio-core.js` | gain/reference and ramp tests | Not claimed historical | Whether any historical track used these values is unknown |
| A-U396-4 | Noise, AM, FM, delay, comb, sweep, cues, voice | null / empty | MIP_OPERATIONAL_DEFINED | Simple-preset contract | Explicitly absent | No layer is injected by renderer, controller, or worklet | `public/audio-core.js` | simple-preset layer audit | Not claimed historical | None; this is an isolation condition |
| A-U396-4 (formal session) | Protocol cue track | `MIP_PROTOCOL_CUES_V1` only for a timed protocol with explicitly declared audible stages; `null`/empty for participant-paced STOP/RETURN | MIP_OPERATIONAL_DEFINED | Active playbook cue architecture | Separate from the recipe component condition | Timed cues are generated from the committed protocol timeline, stored in the effective session audio configuration, and never added to `recipe.cues`; `STOP_ANCHORED_INTEGER_RANGE_V1` uses `cueMode = NONE` and `protocolCueCount = 0` | `src/main/sessions/protocol-cues.js`, `public/audio-core.js` | protocol-cue separation/policy tests | Not a recipe/historical audio claim | Exact acoustic path remains outside PCM evidence |
| A-P100-104 | Primary carrier L/R | 100 / 104 Hz | PRIMARY_SOURCE_VERIFIED (pair only) | Active authority §10; documented comparator reference | Comparator pair documented; not a full historical environment | Exact pair is retained; no centered-396 reinterpretation | `public/audio-core.js` | `PURE_100_104` reference | Documented patent comparator, not historical-exact recording | Meaning of any “base” wording in other reports remains unresolved |
| A-P100-104 | Gain, phase, waveform, headroom, master/ramp | 0.25/0.25, 0/0, sine, -3 dB, 0.8/0.01 s | MIP_OPERATIONAL_DEFINED | Active authority §10 | Operational definition | Values are engineering defaults, not patent measurements | `public/audio-core.js` | gain/reference and ramp tests | Not historical exact | Exact source-level component levels are not established |
| A-SHAM-0 | Matched carrier L/R | 396 / 396 Hz | MIP_OPERATIONAL_DEFINED | Active authority §10 | Sham-control definition | Matched channels deliberately remove the binaural difference | `public/audio-core.js` | `PURE_SHAM_396_396` reference | SHAM CONTROL | None |
| A-SHAM-0 | All other layers | null / empty | MIP_OPERATIONAL_DEFINED | Simple-preset contract | Explicitly absent | No hidden noise/effect/modulation layer | `public/audio-core.js` | simple-preset layer audit | SHAM CONTROL | None |
| MIP_LAYERED_EXPERIMENTAL_V1 | 394/398 primary carrier | 394 / 398 Hz | MIP_OPERATIONAL_DEFINED | Active authority §10 | Reuses the MIP component condition as one layer | `public/audio-core.js` | `LAYERED_MIP_EXPERIMENTAL` fixture | Experimental reconstruction | Not a CENTER LANE assignment |
| MIP_LAYERED_EXPERIMENTAL_V1 | 200/204 secondary carrier | 200 / 204 Hz | MIP_RECONSTRUCTION_PARAMETER | Active authority §12; source queue V-04 | “Base + 4 Hz” opposite-ear meaning is unresolved | Explicit experimental pair; never presented as verified CENTER LANE | `public/audio-core.js` | multi-carrier/channel tests | Patent-architecture reconstruction only | What “base” means and whether this was simultaneous |
| MIP_LAYERED_EXPERIMENTAL_V1 | 100/101.5 Septon layer | 100 / 101.5 Hz | MIP_RECONSTRUCTION_PARAMETER | Source queue V-04 | Opposite-ear assignment unresolved | Explicit experimental pair, not a historical claim | `public/audio-core.js` | multi-carrier/channel tests | Patent-architecture reconstruction only | Source-level channel semantics |
| MIP_LAYERED_EXPERIMENTAL_V1 | Phased-pink algorithm | `PHASED_PINK_PATENT_5356368`, v1 | PRIMARY_SOURCE_VERIFIED (architecture) | US 5,356,368; audio requirements | Capability/architecture supported | Implementation follows the declared capability; exact historical values are separate | `public/audio-core.js` | phased-pink deterministic fixture | Patent-architecture reconstruction | Exact source timing/filter details |
| MIP_LAYERED_EXPERIMENTAL_V1 | LFSR update clock | one advance per rendered PCM frame | MIP_RECONSTRUCTION_PARAMETER | US 5,356,368 timing ambiguity; §9 addendum | Not unambiguously established by source | Deterministic MIP semantics; `algorithmVersion` and `updateSemantics` are exposed | `public/audio-core.js` | LFSR period and shared-core tests | Never historically exact | Historical noise update clock |
| MIP_LAYERED_EXPERIMENTAL_V1 | Noise alpha, seed, delay range, comb mix | 0.65, 5356368, 44–662, 0.5 | MIP_RECONSTRUCTION_PARAMETER | Audio requirements / addendum | Exact values not source-verified | Explicit versioned engineering choices | `public/audio-core.js` | phased-pink, delay/comb fixtures | Never historically exact | Source coefficients/range |
| MIP_LAYERED_EXPERIMENTAL_V1 | Noise sweep rate | 0.125 Hz | PRIMARY_SOURCE_DERIVED | US 5,356,368; audio requirements | Approximate “near 1/8 Hz” capability | Derive 1/8 as 0.125 Hz; derivation metadata is stored | `public/audio-core.js` | stereo sweep/phased-pink fixture | Derived architecture value, not historical track proof | Exact historical rate and phase |
| MIP_LAYERED_EXPERIMENTAL_V1 | Effects, envelope, levels, phases | explicit recipe values | MIP_RECONSTRUCTION_PARAMETER | Addendum §§8–13 | Not source-verified as exact MIP values | Versioned reconstruction choices; each path has an explicit class | `public/audio-core.js` | DSP/gain/envelope fixtures | Never historically exact | Historical mix/timing |
| QUICK_CUSTOM | Centered pair and preview master gain | user supplied | USER_DEFINED | Audio Lab owner input | Exploratory preview only; no historical verification | Derived L=center−beat/2, R=center+beat/2 with owner-input derivation metadata; must be saved/versioned for formal use | `src/audio.js`, `public/app.js` | quick/custom PCM test | Not historical exact | Owner's intended use |

## Active-layer and verification projections

The UI obtains `activeLayers`, `parameterProvenance`, and
`engineeringVerification` from the repository-backed effective recipe.  The
projection explicitly distinguishes `ACTIVE` from `NONE` for every material
layer.  A PASS in engineering verification means a deterministic software
fixture passed; it does not change the provenance class or historical badge.

## Unresolved historical questions

1. The exact meaning of `base` in the reported 1984 CENTER LANE values “100 Hz
   base + 1.5 Hz binaural beat” and “200 Hz base + 4 Hz binaural beat” is still
   `PENDING PRIMARY-SOURCE-VERIFICATION` (source queue V-04/U-08).
2. No enabled recipe claims a complete or historically exact CENTER LANE
   waveform.  Opposite-ear values, simultaneous use, levels, phases, AM/FM,
   noise, delay, sequencing, and timing remain unresolved unless explicitly
   marked reconstruction.
3. The patent establishes architecture/capability, not a complete MIP recipe.
   In particular, LFSR clock/update timing, filter coefficients, delay limits,
   mix coefficients, sample rate, and historical track assignment are open.
4. A physical owner observation is a separate Audio Health record.  It cannot
   modify this register, a recipe, a provenance class, or an analysis result.

## Historical badges permitted by this register

`MIP DEFINED`, `DOCUMENTED PATENT COMPARATOR`, `PATENT-ARCHITECTURE
RECONSTRUCTION`, `SHAM CONTROL`, and `HISTORICAL CANDIDATE — INCOMPLETE` are
allowed where their definitions above apply.  `PRIMARY-SOURCE VERIFIED
HISTORICAL RECONSTRUCTION` is not currently assigned to any built-in recipe.
