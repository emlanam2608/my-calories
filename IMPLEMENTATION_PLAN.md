# Nourishwell execution plan

Last reviewed: 2026-08-31

This document is the implementation guide for coding agents. `TODO.md` is the status ledger. Complete tasks in the order below unless the user explicitly changes priority.

## 1. Non-negotiable engineering rules

1. Preserve the existing Vinext/Sites architecture. Use ChatGPT sign-in from `app/chatgpt-auth.ts`, D1 through `db/index.ts`, private R2 through the `FILES` binding, Zod contracts, and the existing English/Vietnamese copy structure.
2. Every private API must call `getChatGPTUser()` and reject anonymous requests. Every user-owned query and mutation must constrain by `ownerId` on the server. Never trust an owner ID from the client.
3. Every durable mutation must accept an idempotency key, validate it, and write a `request_deduplications` record in the same D1 batch as the resource. A replay must return the previously saved result when practical.
4. Add request and response Zod schemas before implementing an endpoint. Parse provider and AI output before it reaches business logic or storage.
5. Add D1 schema changes to `db/schema.ts`, create the next numbered SQL migration, inspect it, and append its entry to `drizzle/meta/_journal.json`. Do not edit an already-applied migration.
6. Historical health and nutrition records are snapshots. Never recalculate old records when a provider, prompt, rule, or catalog version changes.
7. AI output is always an editable proposal. It cannot auto-save food, measurements, targets, recommendations, or workout changes.
8. Deterministic safety rules run before AI explanations. AI cannot override a red flag, diagnose, recommend medication changes, or invent measurements or nutrient values.
9. Do not store uploaded health images permanently by default. Delete source images after confirmed extraction unless the user explicitly opts in to retention.
10. Keep secrets server-side. Do not put API keys or sensitive health data in client bundles, URLs, logs, notification text, or service-worker caches.
11. Add both English and Vietnamese copy for every user-facing feature in the same task.
12. A task is complete only when its acceptance criteria pass and `TODO.md` is updated. Do not check broad parent items when only a starter subset exists.

## 2. Required validation for every task

Run at minimum:

```text
npx tsc --noEmit --incremental false
npm test
npm run build
git diff --check
```

Run focused lint for authored files. The repository currently has 19 known lint errors in generated shadcn components and `hooks/use-mobile.ts`; do not add new errors. Do not modify generated primitives solely to silence lint unless that cleanup is the assigned task.

For schema work, verify the new SQL migration matches `db/schema.ts`. For authentication or ownership work, add negative tests for anonymous and wrong-owner access. For safety logic, add boundary and precedence tests.

## 3. Current verified baseline

The following behavior exists and should be extended rather than rebuilt:

- Authenticated dashboard and 11 authenticated API surfaces.
- D1-backed meals, targets, health focuses, measurements, workout readiness, exercise catalog, workout plans, workout logs, and workout check-ins.
- Open Food Facts, USDA FoodData Central, and Vietnam nutrition portal adapters with cache, timeout/retry, circuit breaker, quota, and manual fallback.
- Immutable meal snapshots and review-before-save behavior.
- Deterministic starter findings for sodium, fiber/energy patterns, and purine ingredient signals.
- Measurement unit conversion for weight, glucose, cholesterol, and uric acid.
- Readiness-gated starter workout plans, explicit confirmation, detailed workout logs, and conservative check-ins.
- English/Vietnamese copy infrastructure, PWA manifest/service worker, and social preview.
- Current quality result: TypeScript passes, 27 unit tests pass, production build passes.

Known limitations that must not be described as finished:

- Typed meal parsing is deterministic local logic, not OpenAI extraction.
- Barcode capture is text entry, not a camera scanner.
- No meal, label, or lab photo workflow exists.
- No complete onboarding, Coach, Progress analytics, reminder UI/worker, export, or account deletion exists.
- The starter exercise catalog is small and not clinician-reviewed.
- Workout plans are fixed starter templates and are not equipment-aware.
- No production deployment has been verified as successful.

## 4. Ordered implementation milestones

### M1 — Profile, restrictions, and equipment foundation

Implement these tasks in order.

#### M1.1 Structured onboarding schema and API

Add owner-scoped storage and contracts for:

- goal, height, weight reference, age/date of birth, sex used for metabolic calculation, activity level;
- food preferences and allergies;
- health conditions as user-reported tracking context, not diagnoses;
- injuries, exercise symptoms, training history, sleep, available days;
- available equipment and environment;
- clinician restrictions and target provenance.

Avoid free-text medication/health notes until M1.2 encryption exists. Use enumerated values where possible.

Acceptance criteria:

- `GET` and idempotent `PUT` APIs return only the authenticated owner's profile.
- Partial onboarding can be resumed, with an explicit completion state.
- Unit, locale, timezone, and target-authority behavior remain compatible with current data.
- Tests cover malformed values, target precedence, and cross-owner isolation.

Likely files: `db/schema.ts`, `drizzle/0013_*.sql`, `lib/contracts.ts`, `app/api/profile/*`, `app/dashboard.tsx`, `lib/copy.ts`.

#### M1.2 Encrypt sensitive fields

Add application-level authenticated encryption for medication names, clinician notes, restrictions requiring free text, and sensitive symptom notes. Store key version and ciphertext; never store plaintext duplicates.

Acceptance criteria:

- Encryption key comes from a server secret and supports future rotation.
- Tampered ciphertext fails closed.
- API responses decrypt only after ownership verification.
- Logs and errors never include plaintext.
- Unit tests cover round-trip, wrong-key/version, and tampering.

#### M1.3 Onboarding UI and readiness linkage

Build a bilingual, resumable mobile onboarding flow. Readiness and workout-plan generation must consume persisted restrictions/equipment rather than only local UI state.

Acceptance criteria:

- A clinician restriction or safety flag blocks affected recommendations.
- Under-18, pregnancy, severe symptom, and medication-risk answers route to conservative professional guidance instead of a generated plan.
- No plan change is saved without confirmation.

### M2 — Rich nutrition contracts and deterministic rules

#### M2.1 Expand the nutrient model

Extend `NutritionSnapshot` with carbohydrates, total and added sugar, total and saturated fat, cholesterol, potassium, calcium, iron, alcohol, and hydration-relevant fields. Each field must support `value`, `unit`, and availability/estimation state; missing is not zero.

Acceptance criteria:

- Existing meal snapshots remain readable through backward-compatible parsing or migration.
- Provider adapters map only values actually returned by their source.
- Aggregation tests distinguish missing values from measured zero.

#### M2.2 Expand the versioned rule engine

Add separate versioned findings for configured concerns. Clinician-defined targets override user and guideline values. Do not create a universal health score.

Acceptance criteria:

- Rules cover calories, protein, fiber, carbohydrates, added sugar, sodium, saturated fat, hydration, alcohol, relevant micronutrients, and structured purine-risk categories where data is available.
- Every finding stores rule code/version, observed fact, target/provenance, evidence identifier, and suggested actions.
- Missing nutrient data yields a data-limit message, not a fabricated conclusion.
- Tests cover exact boundaries and conflicting clinician targets.

### M3 — AI meal and label capture

#### M3.1 Private transient upload lifecycle

Implement authenticated R2 upload creation, ownership metadata, expiry, fetch authorization, and deletion. Validate MIME type, extension, file size, and image dimensions. Never serve health uploads publicly.

Acceptance criteria:

- Wrong-owner access is rejected.
- Expired and confirmed-deleted objects cannot be fetched.
- Object keys contain random IDs, not account identity or diagnoses.
- Security tests cover content-type spoofing and oversized files.

#### M3.2 Strict OpenAI extraction adapter

Use the OpenAI Responses API with text/image inputs and a strict `FoodAnalysis` schema. Use `OPENAI_EXTRACTION_MODEL`, defaulting to `gpt-5.6-luna`; set response storage off. Send no account identity.

Acceptance criteria:

- Extract foods, bilingual names, portions, preparation, ingredients, barcode/label values, confidence, and unresolved questions.
- Treat image/label text as untrusted data, never as instructions.
- Malformed, refused, timed-out, or low-confidence responses produce an editable manual-review state.
- Record model, prompt version, schema version, latency, and success/failure without hidden reasoning or sensitive prompt contents.
- Contract fixtures cover Vietnamese dishes, mixed language, poor images, ambiguous portions, and prompt injection text.

#### M3.3 Unified capture and confirmation flow

Connect text, meal photo, nutrition-label photo, barcode, and provider search to the existing review/save path. Add a real camera barcode scanner only after manual barcode entry remains available as fallback.

Acceptance criteria:

- No AI or provider result auto-saves.
- User can edit foods, ingredients, serving, and nutrients before confirmation.
- Confirmed save creates an immutable snapshot and deletes the transient source image by default.

### M4 — Measurement and report-photo extraction

Reuse the transient upload and AI execution infrastructure from M3. Do not create a separate upload system.

Acceptance criteria:

- Extract weight, BP, glucose, cholesterol panel, uric acid, unit, timestamp, and context into a strict proposal schema.
- Every value and unit is independently editable and must be confirmed.
- Ambiguous units or analytes are unresolved questions, never inferred silently.
- Source image is deleted after confirmation unless retention is explicitly selected.

### M5 — Equipment-aware professional PT

#### M5.1 Complete and review the exercise catalog

Expand the catalog to bodyweight, mobility, bicycle, mini treadmill, resistance bands, dumbbells, and gym equipment. Obtain clinician/PT review before marking the parent task complete.

Acceptance criteria:

- Every exercise has bilingual technique, regression, progression, equipment, muscle groups, contraindication tags, and safe substitutions.
- Catalog version is stored in each confirmed plan.

#### M5.2 Equipment-aware plan prescriptions

Replace fixed exercise selection with deterministic filtering by persisted equipment, environment, restrictions, readiness, and recent safety logs. Add warm-up, strength/aerobic work, mobility, cooldown, sets, reps, rest, RPE, rationale, progression criteria, and safety checks.

Acceptance criteria:

- Missing equipment selects a reviewed substitution or leaves an unresolved plan question.
- Equipment changes generate a preview only; the current plan remains active until confirmation.
- Unsafe glucose, pain, symptoms, or clinician restrictions override progression.

#### M5.3 Scheduled adaptation

Extend check-ins from `hold/repeat/maintain` to confirmed `progress/maintain/deload/substitute` proposals. Never mutate the plan directly from a log.

Acceptance criteria:

- Adaptation uses adherence, recovery, pain/symptoms, enjoyment, RPE, volume, and applicable glucose context.
- Each decision stores inputs, deterministic rule version, outcome, and confirmation status.

### M6 — Coach

Build Coach only after M1–M3 supply reliable profile and nutrition data.

Acceptance criteria:

- Context builder includes only permission-checked profile facts, recent logs, remaining targets, active plan, and deterministic findings.
- `OPENAI_COACH_MODEL` defaults to `gpt-5.6-terra`.
- Coach output cites internal evidence record IDs and clearly distinguishes facts, estimates, rules, and AI explanation.
- `CoachRecommendation` proposals cannot mutate meals, targets, reminders, or plans without confirmation.
- Prompt-injection fixtures cover food labels, uploaded reports, and user chat.

### M7 — Progress, reminders, and reports

Implement in this order:

1. server-side analytics queries and response contracts;
2. Progress UI with nutrition adherence, measurements, workout consistency/volume/cardio, recovery, goals, and data completeness;
3. non-causal correlations with sample size and confidence warnings;
4. reminder CRUD, quiet hours, snooze/reschedule, delivery history;
5. private web-push subscription flow with diagnosis-free notification text;
6. scheduled Worker dispatch;
7. selected-range CSV export, then PDF clinician report;
8. full account export and permanent deletion across D1/R2/derived records.

Acceptance criteria:

- Analytics are computed from owner-scoped server data, never demo arrays.
- Lock-screen notification text contains no diagnoses or readings.
- Exports require deliberate user action and create no public links.
- Deletion tests prove removal of uploads, records, subscriptions, execution metadata, and derived data.

### M8 — Release hardening

Do not enter real sensitive health data before this milestone.

- Add API authentication/ownership/idempotency tests.
- Add mobile end-to-end tests for nutrition, measurements, workouts, reminders, export, and deletion.
- Restore complete Drizzle snapshots or document and test the chosen reproducible migration process.
- Resolve or intentionally baseline generated-component lint errors.
- Review the current 22 dependency advisories (9 high, 13 moderate). Do not use forced upgrades; update only to compatible verified releases.
- Add CI for typecheck, tests, lint policy, build, migration verification, and security tests.
- Verify backup/restore, secret rotation, least-privilege bindings, redacted logs, quotas, and deletion completeness.
- Deploy through the configured Sites project and verify the deployment reaches `succeeded` with private access.
- Validate camera, install, offline, and push behavior on physical iOS and Android devices.

## 5. Definition of the first usable private MVP

The private MVP is ready for personal testing only when all of these are true:

- M1 profile/restriction foundation is complete.
- M2 rich nutrition snapshots and core rules are complete.
- M3 meal/label capture works end to end with mandatory confirmation.
- Existing measurement and workout flows pass ownership and safety tests.
- Full data export and permanent deletion work.
- High-risk dependency and deployment findings are reviewed.
- No claim of HIPAA, medical-device, diagnostic, or clinical-decision-system compliance is shown.
