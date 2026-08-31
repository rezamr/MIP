# MIP Session Template

> Use this Markdown template for durable/manual session documentation and repository summaries. Do not delete unanswered fields; use `UNKNOWN`, `NOT MEASURED`, or `NOT APPLICABLE`.
>
> Formal software-recorded sessions additionally have a runtime evidence bundle governed by `engineering/SESSION_DATA_INTEGRITY_AND_REVIEW_REQUIREMENTS_V0.1.md`. This Markdown record must never replace, rewrite, or silently correct the locked runtime evidence.

## Record status / identity

- Session ID: `S####`
- Trial ID:
- Block ID:
- Session class: `CS-EXPLORE` / `CS-READ` / `CS-REQUEST` / `CS-INFLUENCE` / `CS-WRITE` / `CS-TRANSFER` / `CS-STORE` / `CS-RETRIEVE` / `CS-QUERY` / `CS-TARGETED-RETRIEVAL` / `CS-HANDSHAKE` / `CS-CONTROL` / `CS-REPLICATION`
- Record type: `CONTEMPORANEOUS RECORD` / `RECONSTRUCTED FROM MEMORY` / `SOFTWARE RUNTIME SUMMARY`
- Session date:
- Report written at:
- Participant ID/label:
- Experiment ID:
- Experiment profile ID/version:
- Session protocol ID/version:
- Application/engine version:
- Analysis-plan ID/version:
- Reveal-policy ID/version:
- Condition code:
- Blinding status:
- Runtime evidence bundle path/reference:
- Commitment SHA-256:
- Effective config fingerprint/hash:
- Terminal event-chain hash:
- Integrity status: `VALID` / `INVALID` / `INCOMPLETE` / `LEGACY_UNVERIFIABLE` / `NOT APPLICABLE`

---

# 1. Objective target / request architecture

## Track

- Track: `READ` / `REQUEST-INFLUENCE` / `CONTROL` / `OTHER`
- Objective outcome-space ID/version:
- Outcome-space type/size:
- Nominal null probability for exact endpoint, if applicable:
- Request-assignment policy:
- Objective requested state, if applicable:
- Participant-facing mapping ID/version:
- Participant-facing requested label:
- Request-encoding profile ID/version:
- Exact participant-facing instruction/script version:
- Timing-policy ID/version:
- Participant-facing timing semantics: immediate / next eligible / relative delay / absolute time / window / pre-generated / other
- Machine-output policy ID/version:
- RNG provider ID/version/source type:
- Primary endpoint:
- Primary timing region/window:
- Exploratory timing regions/windows:

## Pre-generated / hidden target fields where applicable

- Hidden target generated before participant action? yes/no/not applicable
- Hidden-target commitment/hash:
- Hidden-target generation time UTC:
- Participant access audit status:

---

# 2. Pre-session state

- Sleep duration last night:
- Time since waking:
- Food/caffeine in previous 4 hours:
- Alcohol/recreational substances in previous 24 hours:
- Medication changes relevant to session:
- Physical fatigue 0–10:
- Sleepiness 0–10:
- Anxiety 0–10:
- Baseline mood 0–10:
- Concentration 0–10:
- Expectation that something unusual will happen 0–10:
- Prior knowledge of objective target, if any:
- Exact session intention / question:
- Assigned participant-facing target memorized before START? yes/no/not applicable
- Memory confirmation time UTC:

## Environment

- Location:
- Body position:
- Eyes open/closed:
- Lighting:
- Room temperature:
- External noise:
- Phone state: off / airplane / silent / active
- Interruptions expected:
- Headphones:
- Audio interface/device:
- Playback software/runtime:
- User listening-level setting:

---

# 3. Audio configuration

- Audio recipe ID/version:
- Audio provenance/status:
- Recipe snapshot hash:
- Generated WAV hash, if applicable:
- Audio manifest hash:
- Sample rate requested:
- Actual playback/audio-context sample rate if measured:
- Bit depth/container for finite WAV, if applicable:
- Carrier/base frequency or frequencies:
- Left-channel frequency/frequencies:
- Right-channel frequency/frequencies:
- Binaural difference frequency/frequencies:
- Monaural components:
- Phase relationship:
- Amplitude/gain:
- AM:
- FM:
- Panning:
- Noise/ambience:
- Noise seed/algorithm where applicable:
- Voice/script:
- Cue assets/parameters/hash:
- Audio start UTC / monotonic offset:
- Audio stop/end UTC / monotonic offset:
- Audio interruption/failure/underrun detected:

> Digital recipe/source reproducibility does not by itself prove identical physical acoustic pressure at the ear unless measured.

---

# 4. Machine and session timing

Use UTC as authoritative for absolute event time and monotonic timing for durations/order where available.

- Session created UTC:
- Commitment UTC:
- START UTC:
- Audio start UTC:
- Hidden stream start UTC, if applicable:
- Request cue UTC:
- Request encoding start UTC:
- Request encoding end UTC:
- Release start UTC:
- Release end UTC:
- Requested/scheduled target event/window UTC, if applicable:
- Scheduler wake UTC, if applicable:
- Actual machine generation/event UTC:
- Target/window end UTC:
- Return cue UTC:
- Participant return confirmation UTC:
- Raw-report start UTC:
- Raw-report lock UTC:
- Reveal UTC:
- Session close UTC:
- Actual elapsed duration:
- Request-to-target delay:
- Scheduler timing error/lateness:
- Clock discontinuity/sleep/process restart detected:
- Timing-valid flag:
- Timing-deviation reason:

## Subjective time — recorded before actual elapsed time is shown

- Estimated total session duration:
- Estimated request-cue-to-return duration:
- Time felt: compressed / expanded / discontinuous / ordinary / unknown
- Confidence in subjective estimate:

---

# 5. RAW REPORT — lock before interpretation or reveal

Write events in the order remembered. Preserve exact wording where possible.

## Timeline

- T+00:00 —
- T+__:__ —
- T+__:__ —

## Raw free report

[Write here]

## Request/encoding self-report — before reveal

- Participant-facing target remembered correctly? yes/no/unknown/not applicable
- Request forgotten at any point? yes/no
- Representation modality actually used: visual / internal verbal / kinesthetic / spatial / abstract / mixed / other
- Representation clarity 0–10:
- Affect intensity 0–10:
- Certainty/completion intensity 0–10:
- Followed configured wording/goal? yes/no/partly/unknown
- Urge to change requested target? yes/no; details:
- Spontaneous conflicting number/label/state before reveal:
- Perceived acknowledgement-like event? yes/no/unknown
- Exact raw acknowledgement description:
- Pre-reveal belief that request succeeded: yes / no / uncertain / not applicable
- Confidence in that belief:

## Interruptions / deviations noticed by participant

- Notification:
- Phone call:
- External voice/noise:
- Body movement:
- Equipment issue:
- Unexpected screen interaction:
- Headphone/audio issue:
- Other:

## End reason

- Planned completion / interruption / discomfort / deliberate termination / sleep / application failure / other:
- Exact termination thought/command if any:
- Approximate termination time relative to cues:

---

# 6. Mandatory post-session phenomenology questionnaire

## A. State and time

1. Did you experience a state clearly different from ordinary rest? 0–10:
2. When did the first clear change appear relative to cues?
3. Did perceived time change? yes/no/unknown
4. Did the state deepen, fluctuate, or remain stable?
5. Strongest-state period relative to cues:
6. Alertness during strongest period 0–10:

## B. Auditory phenomena

7. Any sound not clearly attributable to the recording/environment? yes/no
8. Humming? yes/no
9. Buzzing? yes/no
10. Roaring? yes/no
11. Motor-like sound? yes/no
12. Boom/pulse? yes/no
13. Human-like voice? yes/no
14. Internal/non-spatial or spatially located?
15. Continuous or intermittent?
16. Did it precede, coincide with, or follow vibration/rotation?
17. Intensity 0–10:

## C. Visual phenomena

18. Light? yes/no
19. Color(s):
20. Geometric form? yes/no
21. Scene/environment? yes/no
22. Person/figure? yes/no
23. Object? yes/no
24. Static or dynamic?
25. Intentionally imagined or spontaneous?
26. Could you voluntarily change it?
27. Clarity 0–10:
28. Realism 0–10:

## D. Somatic / vestibular phenomena

29. Vibration? yes/no
30. Pulse? yes/no
31. Rotation/spinning? yes/no
32. Floating? yes/no
33. Falling? yes/no
34. Rising? yes/no
35. Expansion/contraction? yes/no
36. Sensation moving feet -> head? yes/no
37. Sensation moving head -> feet? yes/no
38. Clockwise/counterclockwise/unclear:
39. Numbness? yes/no
40. Heaviness? yes/no
41. Lightness? yes/no
42. Temperature change? yes/no
43. Exact body location(s):
44. Intensity 0–10:

## E. Energy-model phenomenology

> This section records perception only; it does not assume a physical energy field.

45. Perceived flow? yes/no
46. Direction:
47. Continuous or pulsed?
48. Inside body / around body / both / unclear:
49. Perceived color:
50. Perceived geometry:
51. Boundary/field sensation? yes/no
52. REBAL-like structure? yes/no
53. Did it change without deliberate imagery?
54. Did an external interruption alter it?

## F. Agency and control

55. Overall voluntary control 0–10:
56. Did anything begin without deliberate intention? yes/no
57. Could you stop/change it voluntarily? yes/no/partly
58. Sensed presence? yes/no
59. Felt observed? yes/no
60. Felt interaction? yes/no
61. Perceived autonomous behavior? yes/no
62. Did anything violate your expectation? yes/no
63. Did anything occur that you were not trying to imagine? yes/no
64. Any change in voluntary facial/body/emotional expression? Describe without interpretation:

## G. Affect

65. Calm 0–10:
66. Joy 0–10:
67. Fear 0–10:
68. Sadness 0–10:
69. Awe 0–10:
70. Excitement/arousal 0–10:
71. Crying? yes/no
72. Laughter? yes/no
73. Involuntary emotional expression? yes/no
74. Peak intensity 0–10:
75. What occurred immediately before the peak?
76. Duration of post-session emotional/autonomic after-effect:

## H. Information / query

77. Was a specific question asked? yes/no
78. Exact wording:
79. When relative to protocol cues?
80. Did anything feel like a response? yes/no
81. Response modality: image / word / sound / feeling / knowing / number / geometry / other
82. Exact raw response before interpretation:
83. Confidence 0–100%:
84. Did the response differ from expectation?
85. Did it contain a specific falsifiable element?

## I. Outbound / payload

86. Was information intentionally transmitted? yes/no
87. Exact payload:
88. Payload type: image / symbol / number / binary / word / emotion / intention / other
89. Was payload selected before or during the session?
90. Transmission duration:
91. Representation method:
92. Did transmission feel like effort, projection, release, broadcast, placement, or other?
93. Conceptualized destination:
94. Was any acknowledgement perceived? yes/no
95. Exact acknowledgement before interpretation:

---

# 7. Runtime protocol deviations / failures

For software-recorded sessions, copy/summarize from authoritative event/deviation records without altering them.

- Forgotten request:
- Participant abort:
- External interruption:
- Audio failure/disconnect:
- Unexpected screen interaction:
- Browser refresh:
- Process/application crash:
- Computer sleep/resume:
- Late target/output:
- Logging failure:
- Timing invalid:
- Hidden-information leakage suspected/reported:
- Post-commit configuration inconsistency:
- Other deviation:
- Analysis eligibility consequence under frozen plan:

---

# 8. Late recollections

Do not modify the raw report. Add later memories with the time/date remembered.

- Recorded at:
- Recollection:
- Occurred before or after target reveal when remembered:

---

# 9. Target / ground truth — fill/show only after reveal policy permits

- Target/output system:
- Objective target/output-space version:
- Target/output ID/index:
- Target generation method:
- Target generation UTC:
- Machine-output block/reference hash:
- Target commitment/hash where applicable:
- Reveal UTC:
- True target/output:
- Decoys, if applicable:
- Exact requested-state match, if applicable:

---

# 10. Deterministic scoring / analysis

- Analysis plan/version:
- Primary endpoint:
- Eligible trial? yes/no; reason:
- Exact match result:
- Requested-direction count `k`:
- Window size `n`:
- Requested-direction proportion:
- Signed deviation from null:
- Chance/null model:
- Binomial/exact probability if declared:
- Confidence interval method/value if declared:
- Temporal primary-region result:
- Pre-window result(s):
- Immediate-post result(s):
- Later exploratory result(s):
- Threshold/sustained crossing if configured:
- Exploratory change-point result if configured:
- Multiple-comparison handling if applicable:
- Cross-session comparability status:

## Raw matches

[Describe without stretching semantics]

## Raw misses/nulls

[Record equally carefully]

---

# 11. Integrity review

For software-recorded sessions:

- Event-chain verification:
- Machine-output hash linkage:
- Config snapshot verification:
- Commitment verification:
- Raw-report lock hash verification:
- Audio/manifest hash verification:
- Integrity-manifest verification:
- Final verifier status:
- Any corrupted/missing file:

If integrity is invalid/incomplete, do not silently treat the result as equivalent to a fully verified session.

---

# 12. Interpretation — written after raw lock/reveal

## Candidate interpretations

1.
2.
3.

## Conventional explanations considered

1.
2.

## Unconventional hypotheses considered

1.
2.

## Current conclusion

- Evidence level: L0 / L1 / L2 / L3 / L4 / L5 / L6
- Conclusion:
- Confidence:
- What this session does **not** establish:

---

# 13. Follow-up

- Replicate unchanged? yes/no
- Change one parameter? Which?
- New control required?
- New measurement required?
- New timing profile required?
- New mapping/encoding comparison required?
- New research question created?
- Safety/termination procedure change required?
- Software/logging issue created?
- Next session recommendation:
