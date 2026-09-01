# Nourishwell implementation tracker

Last reviewed: 2026-09-01

This is the status ledger. Read [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) before implementing an unchecked item. Work from the top of the **Next execution queue**, complete one bounded slice at a time, and update both documents when facts change.

## Working agreement

- Keep each slice commit-ready, but do not commit, push, or deploy unless the user explicitly asks in the current conversation.
- Preserve ChatGPT authentication, D1 ownership filters, private R2 storage, Zod contracts, immutable health snapshots, confirmation gates, and English/Vietnamese copy.
- Do not enter real sensitive health data or describe the app as production-ready while the release blockers below remain open.
- A checked item means the behavior exists and has proportional tests. A starter or partial implementation stays unchecked and must say what is missing.

## Verified baseline

- [x] TypeScript Sites/Vinext app with shadcn, ChatGPT sign-in, D1, private R2, PWA metadata, offline shell, and bilingual copy infrastructure.
- [x] Seven working surfaces: Today, Capture, Coach, Measurements, Workouts, Progress, and Settings.
- [x] Twenty-seven API route files with authenticated handlers for profile, meals, uploads, measurements, workouts, reminders, analytics, exports, saved foods, and deletion.
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
- [x] Current local validation: full Oxlint passes; TypeScript passes; 33 test files / 107 tests pass; production Vinext/Sites build passes; production dependency audit reports zero vulnerabilities.

## Current non-claims and known debt

- [x] Full repository Oxlint is clean. The 19 generated shadcn/mobile-hook findings are narrowly baselined by exact file and rule; authored product code retains the full rule set.
- [x] Dependency review is complete for S0. Production audit is clean; four moderate, fix-unavailable development-only Drizzle Kit/esbuild advisories are accepted and documented in `docs/dependency-risk.md`.
- [x] Migration metadata is reproducible under the documented SQL-first policy; the journal and clean-D1 schema/index verification cover migrations `0000`–`0019`.
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

#### P1.1 — Versioned effective safety context (next)

- [ ] Add structured onboarding fields for adult eligibility/pregnancy context and medication-related exercise risk without exposing encrypted note text.
- [ ] Define a pure, versioned `EffectiveSafetyContext` contract and resolver from onboarding flags, the latest readiness record, clinician restrictions, and recent workout pain/symptom/glucose facts.
- [ ] Return domain-specific decisions for `workout_plan`, `workout_progression`, and `coach_exercise`: `allowed`, `allowed_with_modifications`, or `blocked`, with stable reason codes and source record IDs/timestamps.
- [ ] Treat absent, stale, invalid, and zero values distinctly. Do not invent numeric glucose thresholds in this slice; use the existing structured glucose-risk answer until P1.2 policy constants are reviewed.
- [ ] Add pure boundary/precedence tests and owner-scoped route tests. This slice may expose a read-only safety-context endpoint, but must not alter an active plan or recommendation.

#### P1.2 — Enforce deterministic recommendation gates

- [ ] Apply the same resolver before workout preview, plan confirmation, scheduled check-in/progression proposals, and exercise-oriented Coach guidance.
- [ ] Add a reviewed, versioned glucose exercise policy with canonical-unit conversion before using pre/post-workout readings; test exact low/high boundaries and missing readings.
- [ ] Ensure pain, concerning symptoms, readiness red flags, clinician restrictions, pregnancy context, and under-18 status override progression. AI language may only explain the deterministic outcome.
- [ ] Add complete English/Vietnamese urgent, stop-activity, and professional-review copy for every reason code; keep emergency language specific and non-diagnostic.

#### P1.3 — Effective targets and immutable finding snapshots

- [ ] Pass effective targets, including authority, into the meal rule engine rather than using hard-coded target values in findings.
- [ ] Extend `HealthFinding` with target metric/authority and explicit observed-value availability/provenance; preserve missing versus reported zero.
- [ ] Add the next unused migration (currently `0020`) to persist the exact confirmed finding array with each meal, including rule version, evidence source, effective target, and authority. Never recompute historical findings on read.
- [ ] Update schema, SQL-first journal metadata, archive/delete inventory, clean-D1 verification, and replay tests together.

#### P1.4 — Complete nutrient/purine rules

- [ ] Add hydration and micronutrient observations only for nutrients explicitly reported or estimated in the immutable snapshot; no finding may treat unavailable as zero.
- [ ] Replace substring-only purine detection with a versioned structured ingredient-category mapping that retains matched ingredient/category evidence and an unresolved state for ambiguous recipes.
- [ ] Add exact threshold, focus filtering, estimated/reported/unavailable, and bilingual explanation-input tests. Keep rule outputs deterministic and non-diagnostic.

#### P1.5 — Source separation in the UI

- [ ] Show separate badges/sections for user-measured or confirmed facts, provider/database values, estimates, deterministic rule findings, and AI-authored explanations.
- [ ] Display source/version/confidence and target authority without implying that an estimate is measured or that AI text is a rule result.
- [ ] Add English/Vietnamese copy plus keyboard, screen-reader, narrow-mobile, and missing-provenance states.

### P2 — Individualized PT and scheduled adaptation

- [ ] Expand and obtain professional review for the bilingual exercise catalog.
- [ ] Replace the fixed starter week with deterministic selection from equipment, environment, availability, restrictions, recent logs, and recovery.
- [ ] Generate safe substitution previews after equipment/environment changes; never replace the active plan without confirmation.
- [ ] Extend check-ins to versioned `progress`, `maintain`, `deload`, and `substitute` proposals with stored evidence and explicit confirmation.

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
- [ ] Add a scheduled cleanup path for expired private uploads.

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
