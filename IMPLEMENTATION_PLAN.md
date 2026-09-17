# Nourishwell execution plan

Last reviewed: 2026-09-02

This document is written for coding agents. [`TODO.md`](./TODO.md) is the status ledger; this file explains order, boundaries, acceptance criteria, and likely files. The current checkout contains a large uncommitted feature set, so preserve all existing changes and keep every new slice narrowly scoped.

## 1. Product and architecture facts

- Platform: TypeScript Vinext/OpenAI Sites application.
- Authentication: ChatGPT-owned headers through `app/chatgpt-auth.ts`.
- Structured persistence: Cloudflare D1 through `db/index.ts` and `db/schema.ts`.
- Private files: Cloudflare R2 through the `FILES` binding.
- Contracts: Zod schemas in `lib/contracts.ts`.
- UI: React, shadcn components, shared English/Vietnamese copy in `lib/copy.ts`.
- Timezone: `Asia/Bangkok`; metric units are the default.
- AI extraction: OpenAI Responses API with `store: false`; routine extraction model defaults to `gpt-5.6-luna`.
- Food sources: personal confirmed foods, Open Food Facts, USDA FoodData Central, Vietnam nutrition portal, then manual entry.
- Safety boundary: this is a private tracking/coaching aid, not diagnosis, medication guidance, a medical device, or a substitute for a clinician/PT/dietitian.

Do not replace this architecture. Do not add a second auth system, database, upload store, or client-authoritative health record.

## 2. What is actually implemented

The previous plan was stale. The following capabilities exist and should be extended rather than rebuilt:

1. Authenticated Today, Capture, Coach, Measurements, Workouts, Progress, and Settings surfaces.
2. Owner-scoped profile, target, health-focus, onboarding, encrypted-note, meal, saved-food, measurement, workout, reminder, analytics, export, upload, and deletion APIs.
3. Text/provider/barcode/photo food capture with mandatory editable review and immutable confirmed snapshots.
4. Private R2 upload lifecycle, image validation, expiry cleanup hooks, and default source deletion after confirmation.
5. Manual and report-photo measurement capture with explicit per-value confirmation and optional source retention.
6. Versioned starter health rules and separate findings by concern.
7. A readiness-gated, equipment-filtered starter workout plan, confirmed workout logs, and conservative check-ins.
8. Read-only deterministic Coach guidance and starter 30-day Progress analytics.
9. In-app reminders with recurring days, quiet hours, snooze, reschedule, pause/resume, and Today agenda.
10. Private CSV/PDF reports, full JSON archive, and typed-confirmation account deletion.

Current local evidence:

- `npx tsc --noEmit --incremental false`: passes.
- `npm test`: 41 files and 160 tests pass.
- `npm run build`: passes and emits 28 API route files.
- `npm run lint`: passes. Nineteen generated shadcn/mobile-hook findings are narrowly baselined with exact rule/file overrides; authored product code keeps the full rules.
- `npm audit --omit=dev`: zero vulnerabilities. Full audit retains four moderate, fix-unavailable development-only Drizzle Kit/esbuild advisories documented in `docs/dependency-risk.md`.
- Clean-D1 migration verification covers every SQL migration through `0021` and compares tables, columns, defaults, primary keys, and explicit indexes with `db/schema.ts`.
- Git working tree: dirty with the accumulated feature set; user owns commit/push.
- Deployment: configured but not verified; deployment remains out of scope until the user explicitly authorizes it.

## 3. Non-negotiable rules for every agent

1. Call `getChatGPTUser()` in every private route and return `401` when missing.
2. Constrain every user-owned query/update/delete by `ownerId` on the server. Never accept an owner ID from the client.
3. Define request/response schemas before a new endpoint. Parse external/AI responses before business logic or persistence.
4. Durable mutations require an idempotency key and a same-batch deduplication row. On replay, return the same resource shape when practical.
5. Account deletion is the documented exception: retaining a replay tombstone would retain account data after deletion. It still requires a valid key and exact typed confirmation.
6. AI output is an editable proposal. It may not auto-save food, measurements, targets, plan changes, or recommendations.
7. Deterministic safety gates execute before AI language. AI cannot override a red flag, diagnose, change medication, or invent facts.
8. Preserve immutable historical snapshots, prompt/model/rule/source versions, and missing-versus-zero nutrient semantics.
9. Delete uploaded health images after confirmed extraction by default. Retention must be explicit and revocable.
10. Keep keys and sensitive data server-side and out of URLs, logs, notifications, service-worker caches, and client bundles.
11. Add English and Vietnamese copy in the same slice. Do not add another hard-coded English error or notice.
12. Use `apply_patch` for edits. Preserve unrelated dirty-worktree changes.
13. Keep the slice commit-ready, but do not commit, push, or deploy unless the user explicitly asks now.
14. Do not check a broad TODO item when only a starter subset exists.

## 4. Immediate implementation sequence

### Slice S0.1 — Measurement extraction timeout, quota, and fixtures (complete 2026-09-01)

Completed without schema changes. `extractMeasurementsFromImage()` now uses a 20-second abortable provider boundary and distinct timeout/provider/refusal/malformed classifications. The route applies a per-owner quota before R2 reads, returns `Retry-After` on `429`, maps provider/timeouts to `503`, and retains manual-entry recovery. New adapter fixtures cover successful review, low confidence, timeout, refusal, malformed JSON/schema values, and prompt injection. Validation passed: typecheck, 22 test files / 64 tests, focused lint, production build, and `git diff --check`.

Use the food-image path as the reference implementation:

- `lib/openai-food-extraction.ts` already implements `AbortController`, a default 20-second timeout, `timed_out` classification, strict output parsing, and low-confidence review.
- `app/api/meals/extract/route.ts` already calls `consumeRequestQuota()` before reading R2 and returns `Retry-After`.

Required changes:

1. Extend `extractMeasurementsFromImage()` in `lib/openai-measurement-extraction.ts` with optional `fetchFn` and `timeoutMs`, an abort controller, and cleanup in `finally`.
2. Map abort to `OpenAIExtractionError('timed_out')`; keep `refused`, `malformed`, and `provider_failed` distinct.
3. Keep `store: false`, identity-free inputs, strict JSON schema, and the instruction that report text is untrusted data.
4. In `app/api/measurements/extract/route.ts`, validate the request and upload ownership first, then call `consumeRequestQuota('measurement_report_extraction', user.userId, { limit: 10, windowMs: 3_600_000 })` before R2 reads or OpenAI calls.
5. Return `429` with `Retry-After` and `Cache-Control: no-store` for quota exhaustion.
6. Return `503` for timeout/provider failure and `422` for refusal/malformed output. All failures must preserve manual entry.
7. Ensure exactly one `aiExecutions` row is written for every attempt that reaches provider configuration checking. Do not store report contents or response text.
8. Add `lib/openai-measurement-extraction.test.ts` with fixtures for success, forced review, timeout, refusal, malformed JSON, schema-invalid values, and a report containing prompt-injection instructions.

Acceptance criteria:

- No provider call survives the timeout.
- Quota rejection happens before R2 bytes are read.
- Low confidence never auto-saves and always remains editable.
- Execution metadata contains only owner/upload IDs, feature, model, versions, timing, status, and failure code.
- Typecheck, all tests, focused lint, build, and diff check pass.

Likely files:

- `lib/openai-measurement-extraction.ts`
- `lib/openai-measurement-extraction.test.ts`
- `app/api/measurements/extract/route.ts`
- `TODO.md`

Do not change food extraction, measurement persistence, UI layout, or schema in this slice.

### Slice S0.2 — Reminder replay correctness (complete 2026-09-01)

Completed before building the larger route-test harness. `PATCH /api/reminders/:id` now returns an owner-scoped `Reminder` plus `replayed: true` for non-delete action replays, and `{ id, deleted: true, replayed: true }` for a delete replay. The client rejects a successful non-delete response that lacks `reminder`. Route-level fixtures cover anonymous requests, owner isolation, all five actions, delete replay, and wrong-resource idempotency reuse. Validation passed: typecheck, 23 test files / 69 tests, focused Oxlint, production build, and `git diff --check`.

Problem:

- `PATCH /api/reminders/:id` returns only `{ id, replayed: true }` on idempotent replay.
- `actOnReminder()` expects `body.reminder` for every non-delete action and can replace an item with `undefined`.

Required behavior:

1. On replay, verify `resourceType === 'reminder_action'`.
2. Re-read the owner-scoped reminder.
3. For a replayed delete, return `{ id, deleted: true, replayed: true }` when the reminder is absent.
4. For pause/resume/snooze/reschedule replay, return the same `reminderSchema` response shape plus `replayed: true`.
5. Make the client reject a successful non-delete response that lacks `reminder` rather than inserting `undefined`.
6. Add tests for all five actions and wrong-resource key reuse.

Likely files:

- `app/api/reminders/[id]/route.ts`
- `app/dashboard.tsx` or extracted reminder client code
- route-test harness files
- `TODO.md`

### Slice S0.3 — Private route security harness (complete 2026-09-01)

Completed. `lib/private-route-test-harness.ts` provides deterministic test users, realistic request construction, seeded owner-visible rows, fake private object storage, and a disposable Miniflare D1 binding migrated from every repository SQL file. Upload and saved-food tests cover ownership/replay behavior; `lib/private-route-auth-matrix.test.ts` confirms anonymous rejection for all private product areas; and `lib/owner-isolation-route-matrix.test.ts` uses migrated D1 to prove cross-owner data is excluded from measurements, workout plans/logs, reminders, analytics, CSV exports, and report-photo confirmation. The account route requires the exact phrase before database work and intentionally retains no deletion replay marker. Exhaustive durable-mutation retry permutations remain a release-verification test expansion, not an unfulfilled harness dependency.

Required harness capabilities:

- supply or omit ChatGPT auth headers;
- isolate owner A and owner B;
- provide clean, disposable D1 state from migrations;
- provide fake R2 `put/get/delete` behavior;
- call route handlers with realistic `Request` objects;
- inspect status, body, database rows, and object state.

Minimum route matrix:

| Area               | Anonymous |          Wrong owner |  Valid owner |               Replay |
| ------------------ | --------: | -------------------: | -----------: | -------------------: |
| uploads            |       401 |                  404 |          yes |                  n/a |
| saved foods        |       401 |                  404 |          yes |                  yes |
| measurements       |       401 | reject source upload |          yes |                  yes |
| workout plans/logs |       401 |                  404 |          yes |                  yes |
| reminders          |       401 |                  404 |          yes |                  yes |
| analytics/exports  |       401 |    owner-only result |          yes |                  n/a |
| account deletion   |       401 |                  n/a | exact phrase | documented exception |

Never weaken production auth to make tests easy.

### Slice S0.4 — Archive/deletion inventory and memory safety — complete

The current full archive works for small personal datasets but buffers every D1 row and R2 object, converts images to base64, then builds one JSON string. That is not production-safe at large upload counts.

Required design work:

1. Create a single reviewed owner-data inventory covering every current owner-scoped table and R2 relationship.
2. Use it to drive or at least assert completeness for both export and deletion.
3. Define a public versioned archive contract that excludes storage keys, auth headers, encryption keys, and incidental internals.
4. Prefer a Cloudflare-compatible streaming archive. If that cannot be done in one slice, add a conservative preflight based on row count and total `byteSize`, return an explicit `413`, document the temporary limit, and leave streaming unchecked.
5. Do not read R2 contents for deleted/expired uploads. Represent unavailable objects explicitly.
6. Add failure-path tests before changing deletion order. A failed R2 delete must not falsely report full deletion.
7. Verify sensitive notes export decrypted data only after owner verification; if decryption is unavailable, preserve the encrypted record with an explicit format marker.

Implemented design:

- `lib/owner-data-inventory.ts` is the reviewed full owner-data inventory. Account deletion asserts its complete set; the public archive asserts its intentionally smaller portable-record set, excluding request-idempotency rows.
- Archive format is now `nourishwell-private-archive-v2`. It omits R2 storage keys and operational idempotency metadata. Sensitive notes are explicitly marked as plaintext only after successful configured decryption, otherwise as encrypted.
- Until a streaming archive is introduced, the server rejects archives over 25 readable uploads or 5 MB of readable upload bytes with `413` before any R2 reads. Deleted/expired/missing objects have an explicit unavailable-content state.
- Private-object or D1 deletion failures return `503` and never report successful account deletion. Retrying remains safe because no deletion receipt is retained.
- Focused Miniflare tests cover the archive boundary, unavailable R2 states, encryption fallback, R2/D1 failures, and owner isolation.

Likely files changed:

- `app/api/exports/archive/route.ts`
- `app/api/account/route.ts`
- new `lib/owner-data-inventory.ts`
- `lib/account-archive.ts`
- archive/deletion tests
- `TODO.md`

### Slice S0.5 — Migration reproducibility — complete

No product schema change belongs in this slice.

Implemented workflow:

1. The project now explicitly uses an SQL-first workflow: `drizzle/*.sql` plus `drizzle/meta/_journal.json` are the durable migration history. Snapshot JSON is deliberately not hand-maintained.
2. `lib/migration-integrity.test.ts` asserts the journal is exactly aligned with migrations `0000`–`0019`, applies every migration to clean Miniflare D1, and compares all application tables, columns, default presence, primary keys, and explicit indexes against `db/schema.ts`.
3. `docs/migrations.md` gives lower-model-safe rules for future schema work: update schema, next numbered migration, journal, and verification together; never edit an applied migration.
4. Future CI must run the normal test suite, which includes this migration integrity test.
5. Never edit an applied migration to make a drift test pass. Add a corrective migration when drift is real.

### Slice S0.6 — Dashboard decomposition and localization

Do this as behavior-preserving refactors, one surface at a time. Do not combine refactoring with new health logic.

Suggested order:

1. Extract shared API error helpers and request-id creation.
2. Extract Settings subsections: reminders, exports, deletion, onboarding, sensitive notes.
3. Extract Progress and Coach.
4. Extract Measurements and Workouts.
5. Extract Capture last because it has the most intertwined state.
6. Move hard-coded English text into typed copy after each extraction.
7. Add component tests for the extracted surface before moving to the next.

Keep `app/dashboard.tsx` as the composition shell. TanStack Query migration is a separate follow-up; do not mix it into extraction.

Completion note: S0.6 is complete. Today, Coach, and Progress use `components/dashboard/overview-surfaces.tsx`; Capture and Review use `components/dashboard/capture-surface.tsx`; Measurements uses `components/dashboard/measurements-surface.tsx`; Workouts, plan review, readiness, and workout logging use `components/dashboard/workout-readiness-surface.tsx`; Settings uses `components/dashboard/settings-surface.tsx` and its focused panels. Read bootstrap and all capture, measurement, workout, profile/settings, reminder, locale, and browser-effect actions live in focused modules/hooks. `app/dashboard.tsx` is now only the state/routing composition shell and contains no inline async actions.

The completed slice also centralizes authored English/Vietnamese feedback, distinguishes permission and request bootstrap failures, preserves cached state during recovery, exposes retry, disables private controls while offline without queueing writes, and adds live-region/navigation/reduced-motion semantics. `lib/dashboard-decomposition.test.ts` guards these boundaries. Do not weaken review/confirmation semantics while extending these modules.

S0.7 completion note: read caching now uses a dedicated TanStack Query provider and `useDashboardQuery`; health mutations remain explicit server writes and are configured never to pause for offline replay. Compatible framework/security updates remove all production audit findings, while the fix-unavailable development-only Drizzle Kit/esbuild chain is accepted and constrained in `docs/dependency-risk.md`. The 19 generated shadcn/mobile-hook lint findings are covered by exact rule/file overrides, and full repository lint is clean. Continue with P1 deterministic health safety; do not expand the lint baseline or introduce optimistic sensitive writes.

## 5. Product roadmap after stabilization

### P1 — Finish deterministic safety first

The app has the necessary records, but it currently evaluates them in separate places: readiness is checked by workout routes, onboarding symptoms are checked again in those routes, clinician restriction flags filter the catalog, workout pain/symptoms only affect a check-in, and pre/post glucose values are stored without a shared recommendation policy. Meal findings also use hard-coded targets and are not persisted with the confirmed meal. P1 closes those gaps without adding AI autonomy.

#### Slice P1.1 — Versioned effective safety context

Outcome: one pure resolver becomes the only source of recommendation eligibility. This slice creates the contract and read path; it does not change an active workout plan.

Completion note (2026-09-01): `effective-safety-context-1` now resolves owner-scoped onboarding, readiness, and recent workout-log facts into separate plan/progression/Coach exercise decisions. Settings captures under-18, pregnancy, and structured medication-risk inputs without using encrypted note text; Workouts displays bilingual read-only reason copy. `/api/safety-context` rejects anonymous access and excludes cross-owner facts. Missing/future/stale readiness and missing/invalid/reported glucose remain distinct, and no numeric glucose threshold was introduced. P1.2 must consume this resolver at mutation/recommendation boundaries rather than reimplementing its logic.

Required behavior:

1. Extend `onboardingDraftSchema` with structured fields that can represent under-18 input, pregnancy context, and medication-related exercise risk. Keep medication names/details in encrypted notes; the resolver receives flags only.
2. Define `effectiveSafetyContextSchema` with:
   - `contextVersion` and `evaluatedAt`;
   - source timestamps/record IDs where a source table has an ID;
   - normalized facts for eligibility, pregnancy, medication risk, readiness flags, clinician restriction flags, recent pain/concerning symptoms, and pre/post glucose availability;
   - separate decisions for `workout_plan`, `workout_progression`, and `coach_exercise`;
   - decision values `allowed`, `allowed_with_modifications`, and `blocked`;
   - stable reason codes and a copy key, never server-authored prose.
3. Implement a pure resolver in `lib/effective-safety-context.ts`. Precedence is: urgent/concerning symptom or ineligible age -> pregnancy/medication/readiness professional review -> clinician restriction modification/block -> recent pain/symptom hold -> allowed. A less severe fact must never erase a more severe result.
4. Define recency explicitly in one constant and mark old readiness/log data `stale`; do not silently treat stale as cleared. Use the existing `exerciseGlucoseRisk` boolean as the gate in P1.1. Preserve numeric glucose readings as facts with `reported`/`missing` state, but do not introduce medical thresholds yet.
5. Add an authenticated, owner-scoped `GET /api/safety-context` only if the dashboard needs to display the resolved result. It must query source rows server-side and return `Cache-Control: no-store`.
6. Add English/Vietnamese copy for every P1.1 reason code in the same slice. Under-18 and pregnancy paths must state that the app will not generate or progress a workout and should be reviewed with an appropriate professional; emergency copy is reserved for the existing acute symptom flags.

Acceptance tests:

- no readiness record, cleared readiness, needs-review readiness, and stale readiness;
- each acute symptom independently blocks all exercise recommendation domains;
- under-18 blocks plan/progression/coach exercise while still allowing neutral tracking;
- pregnancy or structured medication risk never produces an unrestricted exercise recommendation;
- clinician `avoid_resistance`, `avoid_impact`, and `avoid_high_intensity` produce modifications; a generic clinician stop/review flag blocks;
- any recent pain or concerning-symptom workout log blocks progression even when readiness was previously cleared;
- missing glucose remains missing; `0` is rejected as invalid input rather than interpreted as missing or safe;
- deterministic ordering of reason codes and stable output for the same input;
- anonymous route access is `401`, and owner A never receives owner B facts.

Likely files:

- `lib/contracts.ts` and `lib/contracts.test.ts`
- new `lib/effective-safety-context.ts` and test
- `app/api/safety-context/route.ts` plus route tests if the endpoint is added
- `lib/copy.ts`
- onboarding/settings modules under `components/dashboard/`
- `TODO.md` and this plan

Stop condition: P1.1 is complete only when the resolver and its inputs are persisted/read correctly and all tests above pass. Do not wire numeric glucose thresholds, persist meal findings, redesign Capture, or generate adaptive plans in this slice.

#### Slice P1.2 — Enforce safety gates at every recommendation boundary

Outcome: preview, confirmation, check-in/progression, and exercise-oriented Coach guidance all consume the same safety context and cannot disagree.

Required behavior:

1. Replace duplicated symptom/readiness checks in `app/api/workout-plans/preview/route.ts` and `app/api/workout-plans/route.ts` with the shared resolver. Re-resolve on confirmation so a stale preview cannot bypass a newer restriction.
2. Resolve safety again in `app/api/workout-checkins/route.ts`; store reason codes and safety-context version with the check-in proposal. Do not mutate the active plan.
3. Gate only exercise-oriented Coach guidance. Nutrition tracking and neutral record summaries remain available when exercise advice is blocked.
4. Add a separately versioned glucose exercise policy only after its source and unit assumptions are reviewed. Normalize `mg/dL`/`mmol/L` before comparison, define exact inclusive/exclusive boundaries as named constants, and return a professional-review decision rather than medication or carbohydrate dosing advice.
5. Every blocked response must expose a stable reason/copy key that the bilingual UI can render. AI is not involved in the decision.

Completed 2026-09-02. Preview, confirmation, check-in, and Coach exercise guidance now use the same owner-scoped resolver. The reviewed `ada-exercise-glucose-2026-1` policy normalizes units and has exact boundary tests. Migration `0020` stores the safety context version, decision, and reason codes on check-ins; replay, archive, authentication, owner-isolation, and stale-preview tests protect the enforcement boundary. No AI or dosing logic participates in the decision.

#### Slice P1.3 — Effective targets and immutable meal-finding snapshots

Outcome: every confirmed finding records the exact rule inputs and effective target used at that time.

Required behavior:

1. Reuse `selectTargets()` server-side and pass `{ metric, value, unit, authority }` into `evaluateMealHealthFindings()`; the rule engine must not query D1.
2. Extend `HealthFinding` with `targetMetric`, `targetAuthority`, and explicit observed-value state/provenance. A missing value is not numeric zero.
3. Add a `health_findings` JSON column to `meal_entries` in migration `0021`, the next unused numbered SQL migration. Persist the reviewed finding array in the same batch as the immutable nutrient snapshot and idempotency row.
4. Return persisted findings when historical meals are read. Never recompute history after target or rule changes.
5. Include the public finding snapshot in the private archive and deletion inventory; add schema-drift, replay, malformed-stored-data, and owner-isolation tests.

Completed 2026-09-02. Meal analysis now resolves effective targets with `selectTargets()` and records target metric/value/unit/authority plus observed availability and provenance in rule version `meal-starter-rules-5`. The editable review sends its exact finding array through confirmation; migration `0021` stores that array in the same batch as the immutable nutrition snapshot and idempotency row. Historical reads validate persisted data and never recompute it. Clean-D1, replay-after-target-change, malformed-data, owner-isolation, archive, reported-zero, and target-precedence tests protect the contract.

#### Slice P1.4 — Hydration, micronutrients, and structured purine categories

Outcome: remaining food rules operate only on available snapshot facts and provide inspectable evidence.

Required behavior:

1. Centralize access to additional nutrients so `reported`, `estimated`, and `unavailable` remain distinct through evaluation.
2. Add hydration/potassium/calcium/iron observations only when the relevant nutrient exists and units are supported. Do not issue deficiency diagnoses or infer a daily deficit from one meal.
3. Replace free-form substring-only purine checks with a versioned bilingual category map. Store the matched normalized ingredient, category, mapping version, and ambiguous/unresolved state in explanation inputs.
4. Keep rule output deterministic. If a source lacks the nutrient or recipe detail, emit no numeric finding and surface an unresolved-data note instead.

Completed 2026-09-02. `readNutrient()` now distinguishes reported or estimated values, explicit unavailability, reported zero, and unsupported units. Rule version `meal-starter-rules-6` emits serving-level water, potassium, calcium, and iron observations only for supported source units and makes no daily adequacy or deficiency claim. The versioned `purine-ingredient-categories-1` mapper uses phrase-safe bilingual categories, deduplicates normalized ingredients, and stores matched or unresolved evidence in typed explanation inputs. Capture always explains that missing/unsupported nutrients are unavailable rather than zero. Focus, boundary, unit, false-substring, bilingual evidence, and unresolved-recipe tests protect the behavior.

#### Slice P1.5 — Provenance/source separation UI

Outcome: the review screen makes the trust boundary obvious before save.

Required behavior:

1. Render five distinct concepts: user-confirmed/measured facts, provider/database values, estimates, deterministic rule results, and AI-written explanations.
2. Show snapshot source/reference/version, estimation level, per-nutrient availability, confidence, rule/version/evidence, and target authority with bilingual labels.
3. Do not relabel provider text as AI or deterministic rules as measured facts. Missing source metadata gets an explicit unavailable state.
4. Preserve the existing editable review and confirmation gate; this is a presentation slice, not a capture-flow rewrite.

Completed 2026-09-02. Capture now uses a five-concept provenance legend for user-confirmed facts, provider/database values, estimates, deterministic rules, and AI-written explanations. AI extraction is disclosed separately and cannot be mistaken for AI-authored health prose. The review exposes source/reference/version/confidence, snapshot basis, all supported nutrient availability states, rule/version/evidence, observed provenance, target authority, purine evidence, and explicit unavailable states. Semantic lists, definition lists, native keyboard-expandable details, focus-visible styling, responsive grids, and bilingual server-render tests protect accessibility and narrow-mobile behavior. The existing editable review and explicit confirmation action are unchanged.

Do not send encrypted free-text notes to AI by default anywhere in P1. Use structured flags; add a separate explicit permission feature if free text is ever required.

#### Slice P1.6 — Bilingual deterministic finding snapshots — complete

Completed 2026-09-02. New deterministic findings store exact English and Vietnamese explanation/action snapshots under `health-finding-presentation-1`; `meal-starter-rules-7` identifies the new rule output. Locale-aware presentation selects the saved language rather than translating at read time. The contract remains backward-compatible with historical English-only JSON snapshots, which are preserved unchanged and show an explicit fallback notice when the interface is Vietnamese. No D1 migration was needed. Contract, rule, persistence/replay, and bilingual server-render tests pass.

#### Slice P1.7 — Server-bound meal confirmation — complete

Completed 2026-09-06. Initial analysis and edited-fact refreshes now create owner-scoped, 30-minute reviews in `meal_analysis_reviews`. The server strips any submitted findings, resolves the current owner targets/focuses, recomputes deterministic findings, and stores the exact review plus a context fingerprint. Confirmation accepts only the review ID and occurrence time, rejects missing/wrong-owner, expired, consumed, malformed, or context-stale reviews, then atomically writes the meal, consumes the review, and records idempotency. The review ID is also the client retry key, so a lost response replays the original meal rather than creating another. Migration `0022` adds the review lifecycle and a unique nullable `meal_entries.review_id`; account deletion includes pending reviews and the portable archive omits review-operational data. Edited Capture facts invalidate the review and disable save until a fresh server review is displayed.

### P2 — Individualized PT

P1 review closure (2026-09-06): the effective-safety resolver, mutation-boundary enforcement, immutable bilingual finding snapshots, nutrient availability rules, provenance UI, and server-bound meal confirmation are implemented and validated. P2.1 is the next slice.

P2 replaces `starter-plan-1` in six dependency-ordered slices. The selection and adaptation core is deterministic. AI may later explain an already-decided proposal, but it may never choose exercises, calculate progression, relax restrictions, or activate a plan.

#### Slice P2.1 — Catalog governance and deterministic eligibility

Completed 2026-09-06. `exercise-catalog-contract-2` and catalog `starter-2` use bounded canonical capabilities, environment compatibility, contraindication tags, and explicit review evidence. Migration `0023` keeps every seed row `unreviewed`, canonicalizes legacy equipment labels, and adds version/category lookup support. The pure `exercise-eligibility-1` resolver evaluates equipment, environment, injury flags, clinician restrictions, and effective-safety decisions with stable exclusion/modification reasons and terminating substitution traversal. Bodyweight and gym access grant only themselves; wall, chair, band anchor, cable machine, and other capabilities must be declared independently. The existing `starter-plan-1` route/UI remain active but now consume the typed filter. No plan was generated, persisted, activated, superseded, or professionally approved by this slice.

Outcome: a versioned catalog can answer whether an exercise is eligible and why, without pretending draft content has professional approval.

Required behavior:

1. Extend `ExerciseCatalogEntry` with environment compatibility and review metadata. Use bounded enums, for example `reviewStatus: unreviewed | professionally_reviewed`; a reviewed row also needs a review date and non-secret reference. Do not store a reviewer name unless the user deliberately supplies it.
2. Replace `selectableWorkoutExercises()` equipment string aliases with a typed capability resolver. `bodyweight` means no handheld equipment; wall/chair/band anchor are separate capabilities. Gym may add declared capabilities, but it must not silently imply every future machine.
3. Return an eligibility result per exercise: `eligible`, stable exclusion reason codes, and unresolved requirements/substitutions. Environment, equipment, injury/contraindication tags, clinician restrictions, and `allowed_with_modifications` constraints are all inputs.
4. Validate the catalog as a graph: every bilingual field is present; every equipment/environment/tag is known; every substitution ID resolves; self references are rejected; output order is stable. Cycles may exist only if the resolver has a visited set and terminates deterministically.
5. Add migration `0023` only if the catalog table changes. Follow SQL-first rules and update `db/schema.ts`, journal metadata, clean-D1 verification, archive/delete behavior, and seed fixtures together.

Likely files:

- `lib/exercise-catalog.ts` and tests
- new `lib/exercise-eligibility.ts` and tests
- `lib/contracts.ts`
- `db/schema.ts`, `drizzle/0023_*.sql`, and `drizzle/meta/_journal.json`
- `app/api/exercises/route.ts` and route tests
- migration/archive/deletion fixtures

Acceptance tests:

- bodyweight-only does not require a wall; wall/chair/anchor remain explicit;
- home, outdoors, and gym compatibility is enforced;
- each injury and clinician restriction has deterministic exclusion/modification reasons;
- dangling/self substitutions and unknown tags fail catalog validation;
- unreviewed content is clearly returned as unreviewed and never upgraded by inference;
- anonymous access and owner-data boundaries remain unchanged.

Stop condition: no new weekly plan is generated or persisted. Do not mark professional review complete without real evidence.

#### Slice P2.2 — Versioned planning context and pure weekly planner

Completed 2026-09-06. The strict `workout-planning-context-1` builder selects only planning-safe onboarding, effective-safety, current-plan, and bounded recovery/adherence facts, retains source record IDs/timestamps, excludes account identity and encrypted notes, canonicalizes set-like inputs, and issues a stable SHA-256 digest. The pure `deterministic-weekly-planner-1` produces `workout-plan-v2` drafts with date-derived session IDs, catalog/safety/policy versions, review status, phased prescriptions, rationale keys, progression criteria, compatible substitutions, and explicit unresolved questions. Blocked safety returns no plan; restrictions and `allowed_with_modifications` filter or cap before goal selection; unavailable equipment/environment or unresolved substitutions produce an incomplete draft. Prescription and scheduling constants live in `conservative-prescription-policy-1`, which remains explicitly `unreviewed` with no fabricated evidence. This slice added no route, UI, persistence, migration, active-plan mutation, AI call, clock call, or random ID; `starter-plan-1` stays live until P2.3.

Outcome: identical reviewed inputs produce an identical, inspectable weekly draft.

Required behavior:

1. Build `WorkoutPlanningContext` server-side from the completed onboarding record, effective safety context, current active-plan reference, and a bounded recent adherence/recovery summary. Include source IDs/timestamps; exclude encrypted notes and account identity.
2. Define `WorkoutPlanV2` separately from the legacy literal `starter-plan-1`. It includes `plannerVersion`, `catalogVersion`, catalog review status, safety-context version, input digest, period/timezone, session schedule, warm-up, exercise prescriptions, aerobic work, mobility, cooldown, RPE, rests, rationale copy keys, progression criteria, substitutions, and unresolved questions.
3. Make the planner pure. Pass the planning date/timezone as input; do not call `new Date()`, D1, providers, or random-ID APIs inside it. Derive stable session IDs from plan position/purpose.
4. Select only eligible exercises. Apply safety modifications and clinician restrictions as hard constraints. A blocked context returns no draft. A missing capability or unresolved substitution produces an incomplete review result rather than a guessed exercise.
5. Keep prescription and progression constants in a separately versioned policy module whose evidence/review status is visible. Until qualified review, use conservative draft status and never describe it as professional PT.

Acceptance tests:

- stable output for identical input and stable change for one changed input;
- equipment, environment, available-day, goal, and training-history matrices;
- zero/one/seven-day and insufficient-catalog behavior;
- every safety decision and clinician restriction takes precedence over goal-driven selection;
- every prescription references an eligible catalog row and fits session duration;
- no AI/network/database dependency in the pure planner.

Stop condition: only pure modules/contracts/fixtures change. Keep the existing starter route/UI active until P2.3.

#### Slice P2.3 — Persisted preview and active-plan lifecycle

Outcome: confirmation activates the exact server preview the user reviewed, and only one plan is active.

Required behavior:

1. Add owner-scoped persisted previews with expiry, planning-context digest, complete V2 plan, and preview status. `POST /api/workout-plans/preview` creates the server draft; confirmation submits `{ idempotencyKey, previewId }`, not a client-editable plan.
2. Re-resolve safety and rebuild/digest material planning inputs at confirmation. Expired/already-consumed previews or changed safety/equipment/environment/availability return a stable stale-preview response and do not activate anything.
3. Use explicit lifecycle statuses such as `preview`, `active`, `superseded`, and `expired`. In one batch, activate the preview, supersede the prior active plan, and insert idempotency metadata. Preserve historical plans and logs.
4. Replay by idempotency resource ID and return that exact plan. Never implement replay as “return latest plan.”
5. Add migration `0024`, owner/date/status indexes, archive/delete updates, and strict parsing for legacy `starter-plan-1` versus V2 plans.

Acceptance tests:

- anonymous/wrong-owner access, preview expiry, stale input digest, changed safety, and changed catalog version;
- two concurrent confirmations cannot leave two active plans;
- replay after a later plan returns the original confirmed plan;
- failed batches do not supersede the old active plan;
- legacy plans/logs remain readable and clean-D1 migration passes.

Stop condition: only user-confirmed initial/replacement activation exists. No automatic substitution or progression yet.

Completed 2026-09-06. `workout_plan_previews` stores the owner-scoped V2 plan, canonical planning context/digest, catalog version, expiry, and activation state. Confirmation accepts no editable plan payload, re-resolves and rebuilds all material inputs, returns a stable stale conflict, and atomically supersedes/activates/deduplicates. Partial unique indexes enforce one active owner plan and one plan per preview; replay resolves the original resource even after supersession. Migration `0024` deterministically preserves the newest legacy confirmation as active and older confirmations as history.

#### Slice P2.4 — Exercise-level completion and recovery evidence

Outcome: adaptation uses actual prescription-level evidence instead of one aggregate sets/reps pair for the whole session.

Required behavior:

1. Extend the workout-log request/response with `exerciseResults[]`: planned exercise ID, `completed | modified | skipped`, actual sets/reps/duration/load, and optional catalog-approved substitution ID. Keep the current session RPE, enjoyment, heart rate, pain, symptoms, and canonical glucose facts.
2. Validate results against the immutable plan: no unknown/duplicate exercise IDs; substitutions must be eligible and linked; actual values need bounded units; a stopped-for-safety log cannot be counted as successful adherence.
3. Add a structured recovery input at the scheduled check-in: `good | some_fatigue | poor`, with optional bounded soreness/pain flags. Do not add free-text medical notes.
4. Persist immutable evidence in normalized rows or a queryable versioned JSON snapshot. Migration `0025` must preserve old aggregate logs and expose their lower data-completeness explicitly.
5. Return a specific original log on replay rather than the current list of logs.

Acceptance tests:

- completed, modified, skipped, and mixed sessions;
- duplicate/foreign exercise IDs, invalid substitutions, kg/lb, duration-only and sets/reps prescriptions;
- safety-stop behavior and glucose availability semantics remain unchanged;
- legacy aggregate log reads, replay isolation, wrong-owner access, archive/delete, and migration drift.

Stop condition: saving evidence never changes a prescription, proposal, or active plan.

Completed 2026-09-06. `workout-exercise-evidence-1` adds strict per-prescription completed/modified/skipped results with bounded set, repetition, duration, kg/lb load, and plan-linked substitution evidence. V2 writes validate the immutable active plan and persist normalized rows in the same batch as the session and dedup record; safety stops are never successful adherence, while glucose and session safety facts remain unchanged. Scheduled check-ins persist bounded recovery status and optional boolean soreness/pain flags. Migration `0025` labels legacy aggregates explicitly, archive/delete inventories cover portable evidence and operational previews, and exact replay returns the original log.

#### Slice P2.5 — Versioned adaptation and substitution proposals

Outcome: a scheduled check-in creates an evidence-backed proposal, and a second explicit action applies it.

Required behavior:

1. Define `WorkoutAdaptationProposal` with action `hold_for_review | maintain | progress | deload | substitute`, base plan ID/version, policy/catalog/safety versions, evidence record IDs, data completeness, reason codes, before/after prescriptions, unresolved questions, creation/expiry, and confirmation state.
2. Implement a pure policy with strict precedence: blocked or concerning safety facts -> hold; incompatible current capability/environment -> substitute; poor recovery or excess actual effort -> reviewed deload/maintain rule; insufficient evidence -> maintain; only reviewed progression criteria with adequate adherence/recovery -> progress.
3. Store exact thresholds and adjustment bounds in one versioned policy. Do not scatter percentages across routes. Test both sides of every threshold and do not progress from a single ambiguous/legacy aggregate.
4. Proposal creation never changes the active plan. Confirmation re-resolves safety and planning inputs, rejects stale proposals, then creates a new active plan and supersedes the base plan atomically. Dismissal changes only proposal status.
5. Add migration `0026`, owner/base-plan/status indexes, archive/delete coverage, and replay isolation.

Acceptance tests:

- every action and precedence collision;
- sparse, duplicate, stopped, and legacy logs;
- equipment/environment changes with valid and unresolved substitutions;
- stale safety/context/catalog/base plan, concurrent confirmation, wrong owner, and partial failure;
- no active-plan mutation from log creation or proposal generation.

Stop condition: deterministic proposal lifecycle is complete; AI is absent.

Completed 2026-09-07. `conservative-adaptation-policy-1` centralizes minimum evidence/adherence, effort boundaries, deload bounds, and progression increments. The pure engine implements all five actions with hard precedence and retains evidence provenance plus prescription-level before/after changes. The production policy remains honestly `unreviewed`, so progression is gated until P2.6 receives real external evidence; a synthetic reviewed test policy verifies the gated branch and exact boundaries. Migration `0026` adds owner-scoped proposal snapshots and indexes. Check-ins create inert proposals, dismissal is plan-neutral, and explicit confirmation re-resolves every material input before a transactional base-plan supersession and exact-plan activation. Replay is resource-specific, concurrent confirmation leaves one active plan, and proposals are included in archive/deletion coverage. No AI dependency was introduced.

#### Slice P2.6 — Workouts surface and external review gate

Outcome: the mobile user can understand, perform, review, and explicitly accept every plan change.

Required behavior:

1. Render plan provenance and review status, schedule, warm-up/main work/cooldown, prescriptions, rationale, progression criteria, substitutions, and unresolved questions in English and Vietnamese.
2. Add low-friction prescription-level logging and a structured recovery check-in. Safety stop controls and reason copy remain visually dominant.
3. Show before/after proposal differences and evidence summary. Initial activation, replacement, progression, deload, and substitution each require explicit confirmation; dismissing or going offline preserves the current active plan.
4. Cover narrow mobile layout, keyboard and screen-reader semantics, loading/empty/error/recovery, stale preview/proposal, safety block, and offline read-only mode. Never queue health writes offline.
5. Qualified review is external, not a code checkbox. Record the exact catalog and progression-policy versions, review date/reference, and resulting approved scope only after real review is supplied. Until then, disclose `unreviewed` and do not claim professional or clinician-approved PT.

Stop condition: P2 engineering is complete when P2.1-P2.6 validation passes. The product milestone remains externally gated until professional review evidence exists.

Engineering completed 2026-09-07. The Workouts surface now presents bilingual plan provenance and honest review status, responsive weekly sessions with phased prescriptions and compatible substitutions, explicit incomplete-plan questions, exercise-level completion/modification/skip evidence, structured recovery, and evidence-backed before/after adaptation proposals. Initial activation, replacement, substitution, progression, and deload remain preview-and-confirm operations; dismissal is plan-neutral. Offline mode is read-only and never queues sensitive workout writes, while expired previews/proposals and safety holds cannot be confirmed. The exact catalog and progression-policy review item remains open because no real qualified review evidence has been supplied; both remain visibly `unreviewed`, and the product makes no individualized physical-therapy claim.

Corrective review completed 2026-09-08. Adaptation now evaluates the `workout_progression` decision independently while retaining `workout_plan` constraints for exercise compatibility, and that progression decision participates in the proposal digest. Plan replacement remounts plan-bound logging and recovery forms, while preview expiry advances from a live timer. Load and glucose inputs must be positive one-decimal values that are exactly representable by scaled D1 integers. Concurrent identical check-ins catch the unique-key race and replay the committed check-in/proposal. P2.6 coverage now server-renders the real empty, offline active-plan, and safety-blocked components and uses DOM interaction tests for offline mutation disabling, keyboard preview, live expiry, safety gating, and plan-replacement state reset. The external professional-review gate remains open.

### P3 — Coach chat

Coach comes after route hardening and safety-context completion.

Required architecture:

- compact permission-checked context, not a raw database dump;
- facts and record IDs separated from deterministic findings;
- strict `CoachRecommendation` proposal schema;
- `OPENAI_COACH_MODEL`, default `gpt-5.6-terra`;
- `store: false` and no account identity;
- evidence IDs and confidence in every recommendation;
- confirmation before any target, meal, reminder, or plan mutation;
- prompt-injection fixtures for chat, labels, and reports.

### P4 — Complete analytics and reminders

1. Expand server analytics contracts and queries before changing Progress UI.
2. Add target adherence, measurement trends, workout volume/cardio/recovery, goals, and completeness.
3. Treat correlations as non-causal and show sample size/confidence limitations.
4. Add push subscriptions with neutral lock-screen text.
5. Add delivery attempts/history, missed-item policy, and a scheduled Worker.
6. Add scheduled expired-upload cleanup to the same operations milestone.

### P5 — Release hardening

- CI for typecheck/tests/lint policy/build/migrations;
- keep dependency compatibility/audit and the narrow generated-code lint baseline green; never force upgrades or broaden overrides casually;
- mobile end-to-end and accessibility testing;
- secret rotation, backup/restore, quotas, logging, archive, and deletion drills;
- physical iOS/Android camera/install/push validation;
- explicit deployment authorization, then verify Sites status `succeeded` and private access.

## 6. Validation protocol

Every slice must run:

```text
npx tsc --noEmit --incremental false
npm test
npm run build
git diff --check
```

Also run focused lint on every authored file and full `npm run lint`. The repository baseline is currently clean; do not broaden the generated-code overrides to hide authored findings.

Additional gates:

- API/auth work: anonymous, wrong-owner, valid-owner, and replay tests.
- Schema work: next migration, clean migration application, schema-drift verification.
- AI/provider work: success, timeout, refusal, malformed output, schema failure, low confidence, unavailable provider, and prompt injection.
- Safety work: exact thresholds, missing data, clinician precedence, red flags, and no automatic mutation.
- Destructive work: explicit confirmation, partial failure, retry, and completeness.
- UI work: English/Vietnamese, keyboard, screen reader, mobile layout, loading/empty/error/recovery.

## 7. Handoff template for lower-capability agents

At the end of a slice, report only verified facts:

1. What user-visible or safety behavior changed.
2. Exact files added or changed.
3. Tests added and the final test count.
4. Typecheck, focused lint, build, and diff-check results.
5. Migration number and verification result, if any.
6. What remains unchecked in `TODO.md`.
7. Whether changes are uncommitted, committed, pushed, or deployed. Never infer Git/deployment state.
