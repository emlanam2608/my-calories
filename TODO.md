# Nourishwell implementation tracker

Last reviewed: 2026-08-31

Implementation details, task ordering, safety constraints, acceptance criteria, and likely files are maintained in [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md). Agents should read it before starting the next unchecked task.

This file tracks the gap between the current interactive prototype and the planned private nutrition and fitness coach. Check an item only after the behavior is implemented, tested, and no longer uses placeholder data.

## Current status

- [x] Scaffold the TypeScript Sites application with shadcn, ChatGPT authentication capability, D1, and R2 bindings.
- [x] Build responsive Today, Capture, Measurements, Workouts, and Settings surfaces.
- [x] Add a mobile navigation flow and initial English/Vietnamese navigation labels.
- [x] Add editable meal-review UI with confidence and source labels.
- [x] Add initial D1 schema and migration for profiles, targets, meals, measurements, workout sessions, and reminders.
- [x] Add safe-language UI disclaimers and visible stop-training warnings.
- [x] Pass TypeScript validation with `npx tsc --noEmit --incremental false`.
- [x] Protect the dashboard and meal APIs with ChatGPT sign-in checks.
- [x] Add Zod validation for the typed-meal analysis and save contracts.
- [x] Persist confirmed typed meals in D1 with immutable nutrition snapshots, owner filtering, and idempotency records.
- [x] Replace the meal log’s browser-only state with authenticated API reads and writes.
- [x] Add a review-first deterministic typed-food estimate with visible confidence, serving assumptions, source version, and safety note.
- [x] Load nutrition targets from the authenticated profile endpoint and apply clinician-defined, user-defined, then guideline-default precedence.
- [x] Add private target settings that persist user-defined calories, protein, fiber, and sodium with validation and idempotency; clinician-defined targets remain authoritative.
- [x] Add authenticated manual measurement entry and private history for weight, blood pressure, glucose, cholesterol, and uric acid.
- [x] Add unit coverage for target precedence and deterministic meal-level health rules.
- [ ] Replace all hard-coded demo data and client-only state with authenticated server data.
- [ ] Complete the bilingual product; most page content is currently English-only.

## P0 - Private, persistent foundation

- [x] Require ChatGPT sign-in on every currently implemented private page and server endpoint; future endpoints must preserve this invariant.
- [x] Add server-side ownership checks for every currently implemented user-owned read and mutation; uploads, exports, and deletion remain unimplemented.
- [x] Add Zod request and response contracts for currently implemented product API boundaries.
- [x] Require idempotency keys on currently implemented durable write endpoints; complete audit metadata remains pending.
- [ ] Add D1 repositories and API routes for profiles, targets, meals, measurements, plans, workout logs, coach messages, reminders, analytics, and exports.
- [ ] Replace React-only meal, workout, settings, and coach state with TanStack Query backed by those endpoints.
- [ ] Expand the schema for conditions, allergies, medications, injuries, symptoms, clinician restrictions, food aliases, recipes, meal items, nutrient snapshots, exercise catalog, plans, sessions, sets, coach reviews, push subscriptions, uploads, and AI/rule execution records.
- [x] Change numeric health targets and measurement values from text storage to validated numeric/scaled fields before real data is collected.
- [ ] Add confirmation state and provenance to measurements and all AI-derived records.
- [ ] Add application-level encryption for health notes and medication fields.
- [ ] Add database indexes for every owner-and-date dashboard and analytics query.
- [ ] Restore a complete Drizzle migration metadata snapshot so future migrations are reproducible.
- [x] Add an `.env.example` containing runtime key names only, with no secrets.
- [x] Configure a production Sites project ID with D1 and R2 logical bindings.
- [ ] Verify a real private Sites deployment reaches `succeeded` and enforces intended access.

## P0 - Safety and deterministic health rules

- [ ] Complete onboarding for preferences, allergies, user-reported contexts, injuries/symptoms, medication fields, and free-text clinician notes; the current Settings flow covers planning basics only.
- [x] Add resumable, authenticated structured onboarding storage and API plus a bilingual Settings flow for goal, demographics, activity, sleep, training history, availability, equipment, environments, and enumerated clinician exercise restrictions. Encrypted medication/clinical notes and richer health-profile fields remain pending.
- [x] Require completed profile planning basics before workout-plan preview or confirmation, filter the starter plan by saved equipment and `avoid_resistance`, and reject stale confirmations that no longer match those saved restrictions.
- [x] Implement target authority precedence: clinician-defined, then user-defined, then guideline default.
- [x] Add versioned deterministic meal-level checks for sodium, fiber, and energy, shown as non-diagnostic condition-specific findings that never change nutrient facts.
- [x] Add private, persistent health-focus selection for blood pressure, cholesterol, blood glucose, and uric acid; meal reviews filter checks to selected focuses.
- [x] Add a private, persistent readiness and contraindication screen before any workout plan is generated; reported red flags pause plan generation and show professional/urgent-care guidance.
- [ ] Implement versioned deterministic rules for calories, protein, fiber, carbohydrates, added sugar, sodium, saturated fat, hydration, alcohol, micronutrients, and purine-risk categories.
- [x] Return separate starter findings for blood pressure, cholesterol, blood glucose, uric acid, and weight management without one opaque health score; expand nutrient/rule coverage before marking the full engine complete.
- [ ] Disable affected recommendations when red flags, unsafe glucose readings, pain, concerning symptoms, medication risks, or clinician restrictions apply.
- [ ] Add urgent/professional-care guidance copy for each reviewed red-flag scenario.
- [ ] Keep measured facts, database values, estimates, deterministic findings, and AI explanations visibly distinct in the UI and stored records.
- [ ] Ensure AI explanations cannot alter nutrient values, diagnose, change medication, or override safety rules.

## P1 - Nutrition vertical slice

- [ ] Define and test the strict `FoodAnalysis`, `NutritionSnapshot`, and `HealthFinding` schemas.
- [ ] Add text and image extraction through the OpenAI Responses API with storage disabled and identity excluded.
- [ ] Make the routine extraction model configurable, defaulting to `gpt-5.6-luna`.
- [ ] Upload meal and label photos to private R2 with authorization, expiry, deletion, and redacted logs.
- [ ] Add a real barcode scanner/capture path.
- [ ] Resolve confirmed user recipes and foods before external providers.
- [x] Integrate Open Food Facts for packaged-food barcode lookup, ingredient text, and available label nutrition; missing records remain manual-review entries.
- [x] Integrate direct Vietnam Institute of Nutrition portal lookups for Vietnamese dishes and ingredients, with database basis, provenance, and mandatory review.
- [x] Integrate USDA FoodData Central Foundation Foods search for generic ingredients and detailed nutrients, gated by a private `USDA_FDC_API_KEY`.
- [ ] Import and normalize a licensed/approved Vietnamese food composition catalog.
- [x] Add editable manual nutrient entry when a barcode has no trustworthy match.
- [x] Cache normalized provider matches and AI-independent nutrient results in D1 for seven days, using hashed cache keys and no personal meal records.
- [x] Add provider timeouts, bounded retry/backoff, a best-effort circuit breaker, and editable manual-entry fallback for unavailable food providers.
- [x] Add a private per-owner, per-feature analysis quota with retry timing; it is intentionally best-effort per worker isolate until production distributed limits are configured.
- [x] Record serving assumptions, provider reference, source version, estimation level, barcode, and confidence in immutable meal snapshots.
- [x] Send malformed, ambiguous, unmatched-barcode, and low-confidence results to review; never auto-save them.
- [x] Aggregate confirmed meals into the Today dashboard and remaining personal targets.
- [x] Generate deterministic concern-specific meal findings and practical substitutions for sodium, fiber patterns, meal energy, and detected purine-risk ingredients; glucose and purine checks state their data limits.
- [ ] Add durable distributed quotas for food providers and future AI work before multi-device or multi-user release.

## P1 - Measurements and coach

- [x] Implement manual weight, blood pressure, glucose, cholesterol, and uric acid entry in validated standard units.
- [x] Add custom lab entry with a user-provided test name, unit, and timestamp.
- [x] Add safe analyte-specific unit conversion for weight, glucose, cholesterol, and uric acid; custom labs remain unit-preserving and are never inferred.
- [ ] Implement confirm-before-save extraction from measurement and report photos.
- [ ] Delete source report images after confirmation by default; retain only with explicit consent.
- [ ] Build the permission-checked compact context supplied to coach chat.
- [ ] Implement evidence-linked `CoachRecommendation` records that require confirmation before changing meals, targets, or plans.
- [ ] Make the nuanced coach model configurable, defaulting to `gpt-5.6-terra`.
- [ ] Add weekly nutrition reviews and safe substitution suggestions.
- [ ] Record model, prompt, rule, and provider versions without hidden reasoning or sensitive prompt contents.
- [ ] Add prompt-injection defenses for untrusted food labels, reports, and coach input.

## P1 - Professional PT system

- [ ] Create and review a bilingual exercise catalog for bodyweight, mobility, bicycle, mini treadmill, resistance bands, dumbbells, and gym equipment.
- [x] Add a versioned, bilingual starter catalog for mobility, bodyweight, bicycle, mini treadmill, and resistance-band movements; it is not yet clinician-reviewed or comprehensive.
- [x] Store technique, regressions, progressions, equipment, muscle groups, contraindication tags, and substitutions for each starter-catalog exercise.
- [ ] Generate weekly plans with warm-up, strength, aerobic work, mobility, cooldown, duration, sets/reps, rest, RPE, rationale, progression criteria, and safety checks.
- [x] Add a readiness-gated, deterministic three-session starter-week preview and explicit-confirmation save flow with duration, RPE, rationale, selected exercises, and stop-training guidance; warm-ups, cooldowns, sets/reps, and individual adaptation remain to be added.
- [x] Log completion, sets, reps, load, duration, heart rate, RPE, pain, symptoms, enjoyment, and optional pre/post-workout glucose.
- [x] Persist owner-scoped completion logs for confirmed-plan sessions with sets, reps, load, duration, heart rate, RPE, enjoyment, pain, concerning-symptom flags, and optional pre/post-exercise glucose.
- [ ] Adapt only at scheduled check-ins using adherence and recovery: progress, maintain, deload, or substitute.
- [x] Add a persistent, user-triggered weekly check-in that uses logged adherence and safety flags to recommend hold, repeat, or maintain; it never mutates a plan automatically and progression/deload/substitution remain to be added.
- [ ] Make equipment and environment changes regenerate safe equivalents only after user confirmation.
- [x] Replace the browser-only workout completion state with persistent, confirmed plan and session-log records; plan generation remains a fixed starter template.

## P2 - Reminders, analytics, and reports

- [ ] Add timezone-aware reminders with Asia/Bangkok default, quiet hours, snooze, reschedule, missed-item handling, and delivery history.
- [ ] Add a web-push subscription and permission flow with diagnosis-free lock-screen text.
- [ ] Build and deploy a scheduled Worker that dispatches due reminders against the private backend.
- [ ] Replace demo charts with calorie/nutrient adherence, weight, BP, glucose, uric-acid, workout consistency, volume, cardio, recovery, goal progress, and completeness analytics.
- [ ] Label correlations as non-causal and show sample size plus confidence warnings.
- [ ] Implement deliberate date-range PDF and CSV clinician exports with no public sharing link.
- [ ] Implement full data export and permanent account-data deletion, including uploads and derived records.

## P2 - PWA and product completion

- [x] Add web app manifest, install icon metadata, theme metadata, and a privacy-preserving service worker.
- [x] Cache only public shell assets and an offline fallback; do not cache authenticated HTML/API data or queue sensitive writes.
- [ ] Add camera permission, offline, empty, unavailable-provider, retry, and recovery states.
- [ ] Translate all content and data labels into Vietnamese and English, and update document language dynamically.
- [ ] Replace the fixed date, profile name, targets, chart values, and advice with localized live data.
- [ ] Add complete keyboard, screen-reader, focus, contrast, and reduced-motion support.
- [x] Add application-level social metadata and approved preview artwork without private user data.

## Quality and release gates

- [ ] Add unit tests for conversions, aggregation, target precedence, health rules, progression, contraindications, scheduling, and analytics.
- [ ] Add AI/provider contract fixtures, including malformed and low-confidence responses.
- [ ] Add the bilingual Vietnamese-food regression set described in the product plan.
- [ ] Add safety scenario tests for hypertension, glucose boundaries, medication flags, gout flare, pain, pregnancy/under-18, and conflicting clinician targets.
- [ ] Add mobile end-to-end tests for capture through correction/save, coaching, workouts, reminders, analytics, export, and deletion.
- [ ] Add security tests for cross-user access, upload authorization, prompt injection, secret leakage, notification privacy, rate limits, and deletion completeness.
- [ ] Resolve or intentionally baseline the 19 current lint errors in generated shadcn components and hooks.
- [ ] Review dependency advisories; the 2026-08-31 audit reports 22 vulnerabilities, including 9 high and 13 moderate, largely in the Vinext/Vite/Cloudflare toolchain. Do not force-upgrade without compatibility validation.
- [ ] Run typecheck, lint, unit, contract, end-to-end, accessibility, installability, and production build checks in CI.
- [ ] Verify a real Sites deployment reaches `succeeded`; a local build alone is not a release.
- [ ] Validate iOS and Android camera/install/push behavior on physical devices.
- [ ] Review backups, secret rotation, least-privilege bindings, redacted logs, quotas, and deletion completeness before real health data is entered.

## Recommended next milestone

Complete **M1 — Profile, restrictions, and equipment foundation** from `IMPLEMENTATION_PLAN.md`. The first task is structured, resumable onboarding storage and authenticated APIs. Do not start AI coaching or adaptive workout generation until persisted restrictions and equipment are available.

## Review notes

- The application now has functioning authenticated D1-backed meal, measurement, target, readiness, workout-plan, workout-log, and check-in flows.
- Typed meal analysis still uses deterministic local parsing; provider searches are real, but OpenAI and image extraction are not implemented.
- The visible surfaces are Today, Capture, Measurements, Workouts, and Settings. Coach and Progress do not yet exist.
- Equipment management, reminders, analytics, clinician reports, full export, account deletion, real camera barcode scanning, and image upload processing remain unimplemented.
- Workout generation is a conservative fixed starter template; it is not yet equipment-aware or individually adaptive.
- TypeScript, 27 unit tests, and the production build pass. Full lint currently fails with 19 known errors in generated UI primitives/hooks.
- A Sites project ID is configured, but successful private production deployment has not been verified.
