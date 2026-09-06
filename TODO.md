# Nourishwell implementation tracker

Last reviewed: 2026-09-02

This is the status ledger. Read [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) before implementing an unchecked item. Work from the top of the **Next execution queue**, complete one bounded slice at a time, and update both documents when facts change.

## Working agreement

- Keep each slice commit-ready, but do not commit, push, or deploy unless the user explicitly asks in the current conversation.
- Preserve ChatGPT authentication, D1 ownership filters, private R2 storage, Zod contracts, immutable health snapshots, confirmation gates, and English/Vietnamese copy.
- Do not enter real sensitive health data or describe the app as production-ready while the release blockers below remain open.
- A checked item means the behavior exists and has proportional tests. A starter or partial implementation stays unchecked and must say what is missing.

## Verified baseline

- [x] TypeScript Sites/Vinext app with shadcn, ChatGPT sign-in, D1, private R2, PWA metadata, offline shell, and bilingual copy infrastructure.
- [x] Seven working surfaces: Today, Capture, Coach, Measurements, Workouts, Progress, and Settings.
- [x] Twenty-nine API route files with authenticated handlers for profile, meal analysis/review, meals, uploads, measurements, safety context, workouts, reminders, analytics, exports, saved foods, and deletion.
- [x] Resumable profile/onboarding storage for goals, demographics, activity, sleep, availability, equipment, environments, and structured clinician restrictions.
- [x] AES-GCM storage for medication, clinician, and symptom notes with key versioning and owner-only decryption.
- [x] Target precedence: clinician-defined, then user-defined, then conservative guideline defaults.
- [x] Text, provider-search, barcode-camera, meal-photo, and nutrition-label capture all lead to an editable review before save.
- [x] Open Food Facts, USDA FoodData Central, and Vietnam nutrition portal adapters with provenance, caching, provider resilience, and manual fallback.
- [x] Immutable meal snapshots preserve serving assumptions, source/version, confidence, availability state, and reported additional nutrients.
- [x] Private transient uploads validate type/header/dimensions, enforce ownership, expire, and delete after confirmed extraction by default.
- [x] Manual measurements plus report-photo proposals for weight, BP, glucose, cholesterol, uric acid, and custom labs; every value remains editable and confirm-before-save.
- [x] Explicit report-image retention consent and later deletion without deleting the confirmed measurement.
- [x] Deterministic, concern-specific starter findings for energy, protein, fiber, sodium, carbohydrate, sugar, saturated fat, alcohol, and purine ingredient signals.
- [x] Readiness-gated, equipment-filtered starter workout plan; explicit plan confirmation; detailed workout logs; conservative weekly check-in.
- [x] Private saved-food/recipe reuse and deletion.
- [x] Read-only deterministic Coach guidance; it does not mutate records and is not yet AI coach chat.
- [x] Owner-scoped 30-day starter analytics with non-causal trend language and sample sizes.
- [x] Private reminder CRUD, pause/resume, reschedule, one-hour snooze, quiet-hours deferral, and Today agenda preview.
- [x] Date-range CSV/PDF clinician downloads, a versioned private JSON archive, and typed-confirmation account-data deletion.
- [x] Current local validation: full Oxlint passes; TypeScript passes; 43 test files / 170 tests pass; production Vinext/Sites build passes; production dependency audit reports zero vulnerabilities.

## Current non-claims and known debt

- [x] Full repository Oxlint is clean. The 19 generated shadcn/mobile-hook findings are narrowly baselined by exact file and rule; authored product code retains the full rule set.
- [x] Dependency review is complete for S0. Production audit is clean; four moderate, fix-unavailable development-only Drizzle Kit/esbuild advisories are accepted and documented in `docs/dependency-risk.md`.
- [x] Migration metadata is reproducible under the documented SQL-first policy; the journal and clean-D1 schema/index verification cover migrations `0000`–`0021`.
- [x] Route-level authentication, wrong-owner, idempotency replay, deletion-completeness, and archive-isolation tests exist.
- [x] `app/dashboard.tsx` is a 492-line composition shell. Seven surfaces, read bootstrap, mutations, and browser effects are extracted into focused modules under `components/dashboard/` and `lib/`.
- [x] Authored presentation copy is bilingual. Provider values and rule-returned provenance remain source data and are intentionally not silently translated.
- [ ] Reminder notifications are delivered. Only the private in-app agenda exists; there is no push subscription, delivery worker, missed-item processing, or history.
- [ ] Coach is an AI chat. The current Coach is deterministic, read-only guidance without `CoachRecommendation` persistence.
- [ ] Workout adaptation is individualized. The current plan remains a conservative three-session starter template.
- [ ] Progress analytics are complete. Current analytics do not yet calculate target adherence, workout volume, cardio consistency, recovery, goal progress, or confidence estimates.
- [ ] A private production deployment has been verified. Local build success is not deployment evidence.

## Next execution queue — do these in order

### S0.1 — Harden measurement-report AI extraction (complete 2026-09-01)

- [x] Add a bounded timeout/abort path to `lib/openai-measurement-extraction.ts` and classify timeout separately from provider failure.
- [x] Apply the existing per-owner/per-feature request quota before reading R2 bytes or calling OpenAI.
- [x] Return retry timing for quota exhaustion and `503` for timeout/provider unavailability; preserve manual entry.
- [x] Add adapter tests for timeout, refusal, malformed JSON, low-confidence/manual review, and prompt-injection text.
- [x] Record one redacted execution row per attempt without storing image text, identity, or hidden reasoning.

Validation: `npx tsc --noEmit --incremental false`, `npm test` (22 files / 64 tests), `npm run build`, `git diff --check`, and focused ESLint all passed. Next: S0.2.

### S0.2 — Reminder replay correctness (complete 2026-09-01)

- [x] Fix reminder action replay so it returns the current `Reminder` response instead of only an ID; the client must never replace a reminder with `undefined`. Route tests cover anonymous rejection, owner-scoped replay, all five actions, delete replay, and wrong-resource key reuse.

S0.2 validation: `npx tsc --noEmit --incremental false`, `npm test` (23 files / 69 tests), `npm run build`, `git diff --check`, and focused Oxlint all passed.

### S0.3 — Private route security harness (complete 2026-09-01)

- [x] Add reusable route fixtures for anonymous/owner identities, realistic private-route requests, seeded owner-visible rows, and fake R2 `put/get/delete` objects.
- [x] Cover private upload retrieval: anonymous is `401`, a missing/wrong-owner upload is `404` without an R2 read, and a valid owner receives private no-store bytes.
- [x] Cover saved-food reads and replay safety: anonymous is `401`, owner-visible rows are isolated, and a replay returns its original ID while a cross-resource idempotency key is `409`.
- [x] Add a disposable Miniflare D1 binding migrated from every repository SQL file; verify the expected tables exist after a clean migration.
- [x] Test anonymous rejection across measurements, workout plans/logs, reminders, analytics, exports, and account deletion; test real-D1 owner isolation for measurements, workout plans/logs, reminders, analytics, exports, and report-upload references.
- [x] Cover idempotency replay and wrong-resource keys for the high-risk reminder and saved-food mutations; retain exhaustive per-endpoint mutation permutations as release-verification coverage.
- [x] Document the account-deletion exception: the route requires a valid idempotency key and exact phrase, but deliberately retains no replay marker after permanent owner-data deletion.

S0.3 validation: `npx tsc --noEmit --incremental false`, `npm test` (28 files / 91 tests), `npm run build`, `git diff --check`, and focused Oxlint all passed. Next: S0.4 archive/deletion hardening.

### S0.4 — Harden full export and permanent deletion — complete

- [x] Keep JSON export temporary and bounded: preflight readable uploads at 25 objects / 5 MB, return `413` before R2 reads, and leave streaming archive work for a later scale slice.
- [x] Define one shared owner-data inventory covering every owner-scoped D1 table; assert the full set for deletion and the reviewed public subset for export.
- [x] Version and sanitize the public archive: omit R2 storage keys and request-idempotency metadata; expose upload content only as included base64 or an explicit unavailable state.
- [x] Test preflight, retained/missing/deleted/expired upload behavior, encrypted-note fallback markers, R2 failure, D1 failure, retry-safe responses, and cross-owner deletion isolation. Encryption round-trip/tamper tests remain in `health-note-encryption.test.ts`.
- [x] Delete profiles, targets, onboarding, encrypted notes, uploads, AI executions, foods, focuses, meals, measurements, workout sessions/readiness/plans/check-ins, reminders, and deduplication rows after private-object deletion succeeds.

S0.4 validation: focused archive/deletion tests, TypeScript, full tests, production build, `git diff --check`, and focused Oxlint passed. Next: S0.5 migration reproducibility.

### S0.5 — Restore migration reproducibility — complete

- [x] Adopt and document SQL-first migrations: committed SQL plus `drizzle/meta/_journal.json` are authoritative; do not hand-author Drizzle snapshots.
- [x] Validate the restored journal metadata for migrations `0000`–`0019` against every ordered SQL filename without changing applied SQL.
- [x] Add a clean-D1 migration integrity test that compares every application table, column, default presence, primary key, and explicit index to `db/schema.ts`.
- [x] Require every future schema task to update `db/schema.ts`, the next numbered SQL migration, journal metadata, and clean-D1 verification together; see `docs/migrations.md`.

S0.5 validation: focused migration tests, TypeScript, full tests, production build, `git diff --check`, and focused Oxlint passed. Next: S0.6 dashboard decomposition and localization.

### S0.6 — Reduce UI regression risk and finish localization

- [x] Extract Today, Capture, Coach, Measurements, Workouts, Progress, Settings, and their data hooks from `app/dashboard.tsx` without changing the review/confirmation boundaries. All seven surfaces now live under `components/dashboard/`; read bootstrap, capture, measurements, workouts, profile/settings, reminders, locale, and browser effects use focused modules/hooks. `app/dashboard.tsx` is the state and routing composition shell and contains no inline async actions.
- [x] Move authored user-visible notices, validation messages, measurement labels, recovery text, and errors into typed `lib/copy.ts` entries in both English and Vietnamese. Provider/rule-returned text remains provenance data and is not rewritten by the presentation layer.
- [x] Add loading, empty, offline read-only, permission-denied, retry, and recovery states across the dashboard. Required bootstrap failures preserve already loaded state and expose retry; private controls are disabled offline and sensitive writes are never queued.
- [x] Add authored-UI keyboard and screen-reader semantics (`aria-current`, live status/alerts, disabled offline fieldset), shared focus-visible controls, contrast-preserving theme colors, and a global reduced-motion fallback. `lib/dashboard-decomposition.test.ts` protects the extraction and recovery contract.

S0.6 validation: focused authored-code Oxlint, TypeScript, 32 test files / 106 tests, production build, and `git diff --check` passed. TanStack Query remains a deliberately separate migration slice under S0.7, as required by `IMPLEMENTATION_PLAN.md`.

### S0.7 — Query migration, dependency, and lint release gate

- [x] Introduce TanStack Query as its own read-caching migration slice. `QueryProvider`, `useDashboardQuery`, and the tested query defaults cache only owner-scoped reads; D1/server records remain authoritative, writes retain explicit confirmation, and mutations are configured never to pause for offline replay.
- [x] Review and update the direct/transitive advisory graph. Patched React/RSC, Vinext, Vite, Cloudflare tooling, `sharp`, `undici`, and `ws` are installed; the vulnerable Vinext `image-size` dependency is gone.
- [x] Apply only compatible dependency updates and validate them against the D1 harness and Vinext/Sites build. No forced or legacy peer resolution and no `npm audit fix --force` were used.
- [x] Record the accepted residual development-tool risk in `docs/dependency-risk.md`. Production audit: zero vulnerabilities. Full audit: four moderate entries in the fix-unavailable Drizzle Kit/esbuild chain.
- [x] Intentionally baseline the 19 generated shadcn/mobile-hook findings with rule-specific overrides. Full repository Oxlint is clean and all rules remain active for authored product code.

S0.7 validation: full Oxlint, TypeScript, 33 test files / 107 tests, clean-D1 migration/security tests, production Vinext/Sites build, production and full dependency audits, and `git diff --check` passed. Next: P1 deterministic health safety.

## Product milestones after S0

### P1 — Complete deterministic health safety

Execute only the first unchecked slice below. Do not combine safety-context, health-rule persistence, and provenance UI into one change.

#### P1.1 — Versioned effective safety context (complete 2026-09-01)

- [x] Add structured onboarding fields for adult eligibility/pregnancy context and medication-related exercise risk without exposing encrypted note text.
- [x] Define a pure, versioned `EffectiveSafetyContext` contract and resolver from onboarding flags, the latest readiness record, clinician restrictions, and recent workout pain/symptom/glucose facts.
- [x] Return domain-specific decisions for `workout_plan`, `workout_progression`, and `coach_exercise`: `allowed`, `allowed_with_modifications`, or `blocked`, with stable reason codes and source record IDs/timestamps.
- [x] Treat absent, stale, invalid, and zero values distinctly. No numeric glucose thresholds were added; P1.1 uses the existing structured glucose-risk answer and records pre/post values only as facts.
- [x] Add pure boundary/precedence tests, anonymous rejection, and real-D1 owner-isolation coverage. `/api/safety-context` is read-only and no active plan or recommendation is mutated.

P1.1 validation: full Oxlint, TypeScript, 34 test files / 130 tests, production Vinext/Sites build, and `git diff --check` passed. No schema migration was required because the new structured fields use the existing onboarding JSON record. Next: P1.2 deterministic enforcement.

#### P1.2 — Enforce deterministic recommendation gates

- [x] Apply the same resolver before workout preview, plan confirmation, scheduled check-in/progression proposals, and exercise-oriented Coach guidance.
- [x] Add a reviewed, versioned glucose exercise policy with canonical-unit conversion before using pre/post-workout readings; test exact low/high boundaries and missing readings.
- [x] Ensure pain, concerning symptoms, readiness red flags, clinician restrictions, pregnancy context, and under-18 status override progression. AI language may only explain the deterministic outcome.
- [x] Add complete English/Vietnamese urgent, stop-activity, and professional-review copy for every reason code; keep emergency language specific and non-diagnostic.

P1.2 validation: the shared owner-scoped resolver is enforced at preview, confirmation, check-in, and Coach exercise boundaries; migration `0020` persists each check-in's safety version, decision, and reason codes; unit, boundary, stale-preview, replay, archive, authentication, and owner-isolation tests pass. Full validation: Oxlint, TypeScript, 36 test files / 140 tests, production build, and `git diff --check`. Next: P1.3 immutable finding snapshots.

#### P1.3 — Effective targets and immutable finding snapshots

- [x] Pass effective targets, including authority, into the meal rule engine rather than using hard-coded target values in findings.
- [x] Extend `HealthFinding` with target metric/authority and explicit observed-value availability/provenance; preserve missing versus reported zero.
- [x] Add migration `0021` to persist the exact confirmed finding array with each meal, including rule version, evidence source, effective target, and authority. Historical reads validate and return the stored array without recomputation.
- [x] Update schema, SQL-first journal metadata, archive/delete coverage, clean-D1 verification, and replay tests together.

P1.3 validation: owner-scoped analysis resolves clinician/user/default target precedence server-side; edited reviews use the same effective-target snapshot; confirmation persists findings in the meal/idempotency batch. Tests cover authority and provenance, reported zero, target changes after save, replay immutability, malformed stored data, private archive inclusion, owner isolation, and migration drift. Full validation: Oxlint, TypeScript, 37 test files / 144 tests, production build, and `git diff --check`. Next: P1.4 nutrient availability and structured purine categories.

#### P1.4 — Complete nutrient/purine rules

- [x] Add hydration and micronutrient observations only for nutrients explicitly reported or estimated in supported units from the immutable snapshot; reported zero stays zero and unavailable/unsupported values produce no numeric finding.
- [x] Replace substring-only purine detection with versioned bilingual ingredient categories that retain normalized ingredient/category evidence and an unresolved state for ambiguous recipes.
- [x] Add exact threshold, focus filtering, estimated/reported/unavailable, supported-unit, false-substring, duplicate-normalization, and bilingual explanation-input tests. Rule outputs remain deterministic and non-diagnostic.

P1.4 validation: `readNutrient()` centralizes availability semantics; rule version `meal-starter-rules-6` adds serving-level water/potassium/calcium/iron observations without daily adequacy or deficiency claims. `purine-ingredient-categories-1` records bilingual matched evidence and unresolved recipe detail. Full validation: Oxlint, TypeScript, 39 test files / 154 tests, production build, and `git diff --check`. Next: P1.5 provenance/source separation UI.

#### P1.5 — Source separation in the UI

- [x] Show separate statuses for user-confirmed facts, provider/database values, estimates, deterministic rule findings, and AI-authored explanations. AI-assisted extraction is disclosed separately and AI explanations are explicitly absent from the current review contract.
- [x] Display source/reference/version/confidence, value basis, per-nutrient availability, observed provenance, rule/version/evidence, and effective target authority without implying that an estimate is measured or that provider text is AI/rule output.
- [x] Add English/Vietnamese copy plus semantic lists/definition lists, keyboard-expandable nutrient details, screen-reader labels, narrow-mobile layouts, and explicit missing-provenance states.

P1.5 validation: `reviewProvenanceStates()` protects the five-concept trust boundary and the Capture review renders it through focused provenance components. Bilingual server-render tests cover missing references, reported zero, AI extraction disclosure, deterministic evidence, clinician authority, keyboard semantics, responsive classes, and the unchanged editable confirmation gate. Full validation: Oxlint, TypeScript, 41 test files / 160 tests, production build, and `git diff --check`. P1 deterministic health safety is complete. Next: P2 individualized PT.

#### P1.6 — Bilingual deterministic finding snapshots (complete 2026-09-02)

- [x] Store every new deterministic rule explanation and suggested action as an immutable English/Vietnamese presentation snapshot with version `health-finding-presentation-1`.
- [x] Render the saved language selected by the profile locale. Historical English-only findings remain readable without rewriting their snapshot and disclose the fallback when Vietnamese is selected.
- [x] Keep rule facts, evidence, targets, and localized presentation in one validated `HealthFinding`; rule version `meal-starter-rules-7` identifies the new output.

P1.6 validation: localized and legacy schema paths, both locale renderings, historical fallback disclosure, every triggered rule output, immutable persistence/replay, TypeScript, full Oxlint, 42 test files / 164 tests, production Vinext/Sites build, and `git diff --check` pass. No migration was required because `health_findings` is an existing versioned JSON snapshot.

#### P1.7 — Bind meal confirmation to a server-issued review (complete 2026-09-06)

- [x] Issue an owner-scoped, 30-minute D1 review from initial analysis and edited-fact re-review. Client-supplied findings are stripped and recomputed from current server targets/focuses.
- [x] Confirm meals only with `{ reviewId, occurredAt, idempotencyKey }`; persist the exact reviewed nutrition snapshot and findings, consume the review once, and use the review ID as the stable retry key.
- [x] Reject missing/wrong-owner, expired, already-consumed, malformed, or target/focus-stale reviews without saving. Editing nutrients, serving, or ingredients invalidates the UI review and disables confirmation until refreshed.
- [x] Keep pending reviews private and deletable with account data; omit operational review IDs and pending reviews from the portable archive.

P1.7 validation: migration `0022`, schema/journal/clean-D1 parity, client-finding rejection, server recomputation, authentication, owner isolation, expiry, stale context, single consumption, replay, archive sanitization, deletion completeness, bilingual UI state, TypeScript, full Oxlint, 43 test files / 170 tests, production Vinext/Sites build, and `git diff --check` pass. P1 review debt is closed; next is P2.1.

### P2 — Individualized PT and scheduled adaptation

Execute only the first unchecked slice. P2 is deterministic; do not call AI to select exercises, calculate progression, or override the effective safety context.

#### P2.1 — Catalog governance and deterministic eligibility

- [ ] Version the exercise-catalog contract and add environment compatibility plus review metadata (`review_status`, reviewed version/date/reference). Never fabricate a PT/clinician approval; seed rows remain explicitly `unreviewed` until real sign-off is supplied.
- [ ] Replace ad-hoc equipment aliases with one typed capability resolver. Represent no-equipment/bodyweight, wall, chair, anchor, bicycle, mini treadmill, bands, dumbbells, and gym capabilities explicitly.
- [ ] Add pure candidate filtering for equipment/capabilities, environment, injury tags, clinician restrictions, and effective-safety modifications. Return stable exclusion reason codes and unresolved substitution IDs.
- [ ] Add catalog integrity tests for bilingual fields, known equipment/environment/tag values, dangling/self substitutions, deterministic ordering, and every supported onboarding setup having either a candidate or an explicit unresolved result.
- [ ] If schema changes are required, use migration `0023` and update schema, journal, clean-D1, archive/delete inventory, and route fixtures together.

Stop: do not generate a new plan, change the active plan, or mark content professionally reviewed in P2.1.

#### P2.2 — Versioned planning context and pure weekly planner

- [ ] Define a server-built `WorkoutPlanningContext` containing onboarding goal/training history, available days, equipment capabilities, environments, effective safety decision/reasons, current plan ID/version, and a bounded recovery/adherence summary with source record IDs.
- [ ] Implement a pure, deterministic planner that returns warm-up, strength/aerobic/mobility/cooldown prescriptions, duration, sets/reps/rest, RPE, rationale copy keys, progression criteria, substitutions, and unresolved questions.
- [ ] Record `planner_version`, `catalog_version`, catalog review status, safety-context version, and input digest in every draft. Stable input must produce stable output; no timestamps or random IDs inside the pure planner.
- [ ] Apply `allowed_with_modifications` constraints as hard filters/caps. `blocked` returns no plan. Missing capability or unresolved substitution returns a reviewable incomplete draft, never a guessed exercise.
- [ ] Test equipment/environment/availability combinations, goal and experience variants, all restriction precedence, zero/one/seven available days, deterministic ordering, and no eligible exercise paths.

Stop: P2.2 returns pure drafts/fixtures only. Do not persist previews or alter the existing API/UI yet.

#### P2.3 — Persisted previews and active-plan lifecycle

- [ ] Persist owner-scoped, expiring workout-plan previews with their exact planning context/digest and immutable generated plan. Confirmation accepts a `previewId`, not an editable plan body.
- [ ] On confirmation, re-resolve safety and planning inputs; reject expired or stale previews with `409/422` and require regeneration.
- [ ] In one D1 batch, create the new active plan, supersede the prior active plan, and write the idempotency record. Enforce at most one active plan per owner in application logic and tests.
- [ ] Preserve completed historical plans/logs. Replay must return the originally confirmed plan, not whichever plan is newest.
- [ ] Add migration `0024` plus anonymous, wrong-owner, stale-preview, double-confirmation, cross-resource idempotency, partial-failure, archive/delete, and clean-migration tests.

Stop: do not create automatic replacement or adaptation proposals in P2.3.

#### P2.4 — Exercise-level completion and recovery evidence

- [ ] Extend workout logging with per-prescription results: exercise ID, completed/modified/skipped state, actual sets/reps/duration/load, and selected substitution ID. Keep pain/concerning symptoms and glucose facts at their current safety boundary.
- [ ] Add a short scheduled-check-in input for recovery (`good`, `some_fatigue`, `poor`) and optional structured soreness/pain flags; do not collect new free-text health notes.
- [ ] Validate every result against the immutable active-plan prescription and catalog snapshot. Preserve reported zero/missing distinctions where applicable and reject exercises not in the session.
- [ ] Add migration `0025`, immutable response contracts, replay isolation, archive/delete coverage, and tests for mixed completed/skipped sessions, substitutions, load units, safety stops, and malformed plan references.

Stop: logging evidence must not mutate or progress a plan.

#### P2.5 — Versioned adaptation and substitution proposals

- [ ] Replace the starter check-in result with a pure, versioned proposal engine whose actions are `hold_for_review`, `maintain`, `progress`, `deload`, or `substitute`.
- [ ] Use only confirmed plan prescriptions, completed exercise results, adherence, RPE/recovery, current capabilities/environment, and the freshly resolved safety context. Store evidence record IDs, rule reasons, before/after prescriptions, confidence/data-completeness, and unresolved questions.
- [ ] Precedence is: blocked/concerning safety -> hold; incompatible equipment/environment -> substitute; poor recovery/excess effort -> deload or maintain; insufficient evidence -> maintain; reviewed progression criteria met -> progress. Exact thresholds live in one reviewed policy module with boundary tests.
- [ ] Persist proposals without changing the active plan. Confirmation re-resolves safety/context and, if still valid, creates a new active plan and supersedes the prior plan atomically.
- [ ] Add migration `0026` and tests for every action, exact thresholds, sparse/duplicate logs, stale proposals, restriction changes, owner isolation, replay, and no mutation before confirmation.

Stop: no AI-generated progression and no direct mutation from a workout log or check-in POST.

#### P2.6 — Workouts UI and professional-review gate

- [ ] Replace the starter-only Workouts UI with bilingual plan context, review-status disclosure, weekly schedule, prescription details, substitutions/unresolved questions, exercise-level logging, recovery check-in, and before/after adaptation preview.
- [ ] Require explicit confirmation for initial activation, replacement, substitution, progression, and deload. A dismiss action leaves the active plan unchanged.
- [ ] Add mobile, keyboard, screen-reader, loading/empty/offline/recovery, stale-preview, and safety-blocked component coverage without queueing sensitive writes offline.
- [ ] Obtain and record real qualified review of catalog and progression-policy versions before checking the professional-review item complete. Until then, label the content unreviewed and do not claim individualized professional PT.

P2 is complete only after P2.1–P2.6 pass the repository validation protocol and the external professional-review evidence is real. Engineering may finish while that final external gate remains open.

### P3 — Coach chat and weekly review

- [ ] Build a permission-checked compact context containing only necessary profile facts, recent confirmed logs, remaining targets, active plan, and deterministic findings.
- [ ] Add strict `CoachRecommendation` contracts and owner-scoped proposal records with evidence record IDs and confirmation state.
- [ ] Add `OPENAI_COACH_MODEL` to `.env.example`, defaulting to `gpt-5.6-terra`; set OpenAI response storage off.
- [ ] Add prompt-injection defenses and fixtures for user chat, food labels, and report text.
- [ ] Add bilingual weekly nutrition reviews and safe substitution ranking without inventing nutrient values or mutating records.

### P4 — Complete analytics and notifications

- [ ] Expand Progress to target adherence, weight/BP/glucose/uric-acid trends, workout volume/cardio minutes, recovery, goal progress, and data completeness.
- [ ] Show correlations only as non-causal observations with sample size and confidence warnings.
- [ ] Add push-subscription storage and permission UX with diagnosis-free lock-screen text.
- [ ] Add reminder delivery/missed-item history and a scheduled Worker using the same owner-scoped backend.
- [ ] Add a scheduled cleanup path for expired private uploads and unconsumed meal-analysis reviews.

### P5 — Release verification

- [ ] Add mobile end-to-end tests for capture/review/save, measurements, workouts, reminders, analytics, exports, and deletion.
- [ ] Expand route replay permutations to every durable mutation, including retry-after-failed-write behavior, before release.
- [ ] Add CI for typecheck, unit/contract/security tests, lint policy, build, and migration verification.
- [ ] Verify secrets, key rotation, backups/restore, least-privilege bindings, quotas, redacted logs, archive size, and deletion completeness.
- [ ] Validate install, offline shell, camera/barcode, and push behavior on physical iOS and Android devices.
- [ ] Deploy only when explicitly authorized; verify the Sites operation reaches `succeeded` and private access works.

## Validation required for every slice

```text
npx tsc --noEmit --incremental false
npm test
npm run build
git diff --check
```

Run focused lint on authored files. For schema changes, verify the migration on a clean database. For private routes, add anonymous and wrong-owner tests. For safety logic, test exact boundaries and precedence.
