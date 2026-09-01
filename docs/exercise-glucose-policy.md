# Exercise glucose review policy

Last reviewed: 2026-09-02

Policy version: `ada-exercise-glucose-2026-1`

This policy is a deterministic exercise-safety gate, not a diagnosis or a medication, insulin, or carbohydrate-dosing protocol. It normalizes confirmed glucose values to `mmol/L` before comparison and asks for professional review when a value falls outside the reviewed range.

## Reviewed sources

- [ADA Standards of Care in Diabetes—2026, section 5](https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932/5-Facilitating-Positive-Health-Behaviors-and-Well) describes individualized precautions and a pre-exercise carbohydrate review point below `90 mg/dL` (`5.0 mmol/L`) for people using insulin or insulin secretagogues.
- [ADA position statement on physical activity and diabetes](https://diabetesjournals.org/care/article/39/11/2065/37249/Physical-Activity-Exercise-and-Diabetes-A-Position) provides a general pre-exercise target range of `90–250 mg/dL` (`5.0–13.9 mmol/L`) and ketone/intensity cautions above that range.
- [ADA Blood Glucose and Exercise](https://diabetes.org/health-wellness/fitness/blood-glucose-and-exercise) advises treating and rechecking a reading at or below `100 mg/dL` before resuming activity. Nourishwell uses that value only as a conservative post-exercise recovery-review trigger.

## App boundaries

- Pre-exercise values from `5.0` through `13.9 mmol/L`, inclusive, do not add a glucose-specific block. Values outside that range block exercise recommendations pending review.
- Post-exercise values at or below `5.6 mmol/L` request recovery review; values above `13.9 mmol/L` request professional review. These rules do not prescribe treatment.
- Missing remains missing. Zero, non-finite, or non-positive values are invalid rather than safe.
- A glucose decision is one input to the broader effective safety context. Pain, symptoms, readiness flags, pregnancy context, age eligibility, medication-risk flags, and clinician restrictions can produce a stricter outcome.
- The resolver considers recent confirmed workout facts. The app must not present an older reading as a current diagnosis or silently progress a plan from it.

Any future threshold change requires a new policy version, boundary tests, bilingual reason copy, and a review of stored check-in provenance.
