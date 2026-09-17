# Nourishwell v0.1 usable release plan

Last updated: 2026-09-17

## Release decision

v0.1 is a private, single-owner release for the current user. It will run on
Cloudflare Workers with the existing D1 and private R2 data model. Cloudflare
Access protects the entire application hostname with one-time PIN login limited
to the owner's exact email address.

Cloudflare Access is both an outer access gate and an identity provider. The
Worker must still validate every `Cf-Access-Jwt-Assertion` signature, issuer,
audience, and expiry before using its claims. A valid Access identity is mapped
to a stable internal `ownerId` through D1. Email is display/audit metadata,
not the database ownership key and never an automatic linking mechanism.

The current ChatGPT authentication remains a local fallback until the
Cloudflare path passes production smoke tests. Removing it is a deliberate
post-cutover step, not part of the first deployment. This is a fresh personal
installation: no existing health records or image objects need to be copied.
The ordered schema migrations are still necessary to initialize the empty D1.

## What makes v0.1 usable

The release must support both everyday personal use and realistic testing:

1. Finish onboarding and edit the personal health context without entering
   secrets into logs or test fixtures.
2. Capture food by text, provider search, barcode camera, meal photo, or
   nutrition-label photo; review and edit the proposal before saving.
3. Record measurements manually or from a report photo, with review before save
   and optional source-image retention.
4. Review, explicitly activate, perform, and log a workout plan; record recovery
   and explicitly accept or dismiss adaptation proposals.
5. Inspect Today and Progress summaries, reuse saved foods, and manage in-app
   reminders.
6. Export CSV, PDF, and the private archive, and permanently delete account data
   with typed confirmation.
7. Use the app on a phone-sized browser with useful loading, empty, error,
   offline-read-only, and retry states.

## Explicit non-claims

- Food-photo and report-photo results are estimates or extraction proposals,
  never silently accepted measurements.
- Workout catalog and progression policy remain `unreviewed` until real
  qualified review evidence is supplied.
- Coach remains deterministic and read-only; v0.1 does not claim AI coaching.
- Reminders are in-app only; v0.1 does not claim push delivery.
- v0.1 is private personal software, not a public multi-user service or a
  medical device.

## Architecture and identity boundary

```text
Browser
  -> Cloudflare Access application (deny by default; exact owner email via OTP)
  -> Worker validates Cf-Access-Jwt-Assertion against Access JWKS
  -> D1 auth_identities lookup by (provider, issuer, subject)
  -> stable internal ownerId
  -> owner-filtered D1 rows and private R2 objects
```

The identity table is intentionally small:

- `provider`: `cloudflare_access`
- `issuer`: exact Access team domain from the validated JWT
- `subject`: stable Access JWT subject
- `owner_id`: the stable owner identifier used by all health records
- `email_at_link`: informational snapshot only

Unknown but correctly signed identities receive `403` and are never linked by
matching email. Initial linking is an explicit one-time D1 administration step.
For this fresh installation, generate the owner ID once when the verified
Access subject is available. No historical owner-ID rewrite is needed.

## Delivery slices

### V0.1.1 — Cloudflare Access foundation

- [x] Record the personal-only release scope and cutover strategy in this plan.
- [x] Add a versioned D1 identity-mapping table and include it in account
      deletion, but not in the portable health archive.
- [x] Add RS256 Access JWT verification with exact issuer and audience checks,
      expiry validation, required subject/email claims, and explicit unmapped-user
      rejection.
- [x] Add focused tests for forged, expired, wrong-issuer, wrong-audience,
      missing-claim, and same-email/different-subject cases.
- [x] Add the route-level auth adapter so ChatGPT mode retains its existing
      `401` behavior while Access mode returns `403` for missing, invalid, or
      unmapped Access identity.
- [x] Add Worker variables `AUTH_MODE`, `CF_ACCESS_TEAM_DOMAIN`, and
      `CF_ACCESS_AUD`; keep secrets out of tracked configuration.
- [x] Add a one-time, operator-only identity-link command. Do not add a public
      bootstrap endpoint.

The route adapter defaults to `AUTH_MODE=chatgpt`. In
`AUTH_MODE=cloudflare_access`, it validates and maps Access before routing, then
overwrites the internal owner headers. Invalid or unmapped identities receive a
uniform `403`; invalid configuration or D1 failure receives a closed `503`.

After migration `0027` is applied and the Access JWT subject is known, link it
once with:

```text
npm run auth:link-cloudflare -- --database <database> --owner-id <stable-owner-id> --team-domain <https://team.cloudflareaccess.com> --subject <access-subject> --email <owner-email> --remote
```

The command requires an explicit `--local` or `--remote`, validates every input,
uses a temporary SQL file, and performs a plain insert so it cannot overwrite or
silently reassign an existing identity.

Foundation validation completed on 2026-09-10: TypeScript, full Oxlint, 56 test
files / 254 tests, production Vinext build, focused formatting, clean-D1
migration coverage, operator-command validation, and `git diff --check` pass.
The Cloudflare auth mode was activated on the private Worker on 2026-09-17.

### V0.1.2 — Cloudflare runtime cutover

- [x] Add a local release-preparation command that creates a dedicated Workers
      configuration from the built Vinext worker with
      a current compatibility date, `nodejs_compat`, D1/R2 bindings, and Workers
      logs enabled with health-data-safe structured events.
- [x] Select `nourishwell-prod` D1 and `nourishwell-private` R2. Export the
      initially empty D1 locally, then apply all 28 ordered schema migrations
      remotely. On 2026-09-17 Wrangler reported no pending migrations; D1 has
      24 tables. No old user-data migration is needed.
- [x] Confirm the fresh D1/R2 have no previous user content to copy.
- [x] Configure the custom hostname and a Cloudflare Access self-hosted
      application covering the entire hostname.
- [x] Confirm the existing `health.namhuynh.io.vn` Access application uses
      one-time PIN with an Allow policy for exactly the owner email. The Worker
      custom domain was attached on 2026-09-17.
- [x] After first owner OTP sign-in, link the observed `(issuer, subject)` to a
      new stable internal owner ID. Cloudflare reported a successful one-time-PIN
      login at 05:04 UTC, and production D1 now contains exactly one matching
      identity row. Access mode denies unmapped subjects. Anonymous requests to
      the page, API, and static asset redirect to the team Access login.
- [x] Confirm the owner can load the authenticated dashboard. The owner
      reported seeing it after refreshing the linked session on 2026-09-17.
- [ ] Complete first-use onboarding and core-flow smoke tests with real owner
      inputs; do not seed fabricated personal health data.
- [x] Deploy after explicit owner approval. This is the first Worker version,
      so there is no previous production Worker version to roll back to.

After `npm run build`, prepare the ignored release configuration with:

```text
npm run release:prepare-cloudflare -- --database-name <name> --database-id <uuid> --bucket-name <name> --team-domain <https://team.cloudflareaccess.com> --access-aud <aud> --hostname <host>
```

This writes `dist/server/wrangler.release.json`. It does not provision, migrate,
copy, or deploy anything. The generated file deliberately enables Access mode
and contains only resource identifiers and non-secret Access configuration.
The release configuration disables `workers.dev` and preview URLs and binds
only the Access-protected custom hostname. Before deployment, securely set
`OPENAI_API_KEY` for photo extraction, `USDA_FDC_API_KEY` for provider search,
and a new 32-byte base64 `HEALTH_DATA_ENCRYPTION_KEY` as Worker secrets. Never
put those values in this file, tracked config, command output, or chat. The
release configuration declares all three as required so a deployment without
them fails validation. On 2026-09-17 the owner approved reuse of the local API
keys; a fresh note-encryption key was generated. The three secrets were sent
with the deployment, and their ignored local recovery copy is
`.env.production.local`. Back up its encryption key in a password manager.

Deployment record: `nourishwell-private` version
`2044a8c7-fe2f-4f29-824b-46c994695b73` was deployed on 2026-09-17 at
05:00 UTC to `health.namhuynh.io.vn`. The Access application ID is
`adfbd453-2ef2-4927-a72c-119497853c77`; its AUD is the configured
`CF_ACCESS_AUD`. Cloudflare reports `workers.dev` and preview URLs disabled,
three named secrets present, and this version at 100% traffic. The pre-schema
empty D1 export is `.wrangler/nourishwell-prod-pre-schema-2026-09-17.sql`.
Owner OTP sign-in, subject linking, and authenticated dashboard access are
complete. Core-flow smoke tests remain open. The first linking attempt exposed a Windows
Node `spawn EINVAL` issue in the operator script; the script now launches the
installed Wrangler JavaScript directly. No row was written by the failed
attempt, and the successful retry created exactly one identity row.
The R2 bucket has no custom domain and its public `r2.dev` URL is disabled.

Production dependency audit on 2026-09-17 reported one moderate `qs`
advisory through the `shadcn` CLI dependency; no high or critical advisories
were reported. `npm audit fix --dry-run --omit=dev` proposed removing many
development packages, so no automatic dependency rewrite was applied during
this initial release. Reassess the CLI dependency separately.

### V0.1.3 — Core-flow readiness

- [ ] Run a clean onboarding flow in English and Vietnamese and confirm reload
      persistence.
- [ ] Test manual meal, provider search, barcode, meal photo, and label photo
      through editable review, confirmation, history, and deletion.
- [ ] Test manual measurements and report-photo extraction, including rejected
      files, low confidence, provider timeout, retention consent, and source deletion.
- [ ] Test workout preview/activation, exercise-level logging, recovery,
      adaptation proposal confirmation/dismissal, stale state, and safety stops.
- [ ] Test saved foods, analytics empty/populated states, reminder actions,
      export formats, and full deletion completeness.

### V0.1.4 — Release verification

- [ ] Pass TypeScript, full tests, full lint, production build, migration checks,
      and `git diff --check`.
- [ ] Resolve or explicitly record every current production dependency advisory;
      do not use a forced breaking upgrade to make the count disappear.
- [ ] Test current iOS Safari and Android Chrome for camera capture, install/PWA,
      narrow layout, keyboard/screen-reader basics, and offline read-only behavior.
- [ ] Verify Access: owner OTP succeeds, another email is denied, missing/forged/
      expired/wrong-AUD tokens are denied, and unknown valid subjects receive `403`.
- [ ] Verify data: new records appear under the mapped owner, no second
      owner is created, R2 images remain private, exports work, and deletion removes
      the identity mapping plus all owner data.
- [ ] Record the deployed Worker version, migration boundary, Access application
      AUD, backup location, rollback procedure, and smoke-test timestamp without
      recording health content or tokens.

## Go/no-go gate

v0.1 is usable only when the core-flow and release-verification checklists pass
on the deployed private hostname. A successful local build alone is not release
evidence. External workout professional review, AI Coach chat, push reminders,
and public/multi-user authentication stay outside this gate.

## Later sharing or public release

Do not broaden the personal Access policy into public identity. A later shared
release needs a product-owned auth provider, user/account lifecycle, consent and
privacy work, abuse controls, quotas, support/recovery flows, and tenant-aware
authorization tests. The same `auth_identities` table allows a new provider to
link to an existing owner through an explicit authenticated migration ceremony;
historical health rows still keep their internal owner ID.
