# Dependency and lint release gate

Last reviewed: 2026-09-01 (Asia/Bangkok)

## Compatible security updates applied

The S0.7 audit started with 22 advisory chains: 9 high and 13 moderate. The app now uses patched, compatible versions of the affected runtime and build packages:

- React, React DOM, and `react-server-dom-webpack` 19.2.8.
- Vinext 1.0.0-beta.8 and `@vitejs/plugin-rsc` 0.5.34.
- Vite 8.2.2, `@cloudflare/vite-plugin` 1.54.2, Wrangler 4.127.1, and Cloudflare Workers types 5.20260901.1.
- `sharp` 0.35.2, `undici` 7.29.0, and `ws` 8.21.0 in the installed dependency graph.
- Vinext beta.8 no longer installs the vulnerable `image-size` package.

`@vitejs/plugin-react` 6.1.1 was tested but npm rejected its optional Babel peer graph. Version 6.0.2 remains because Vite itself is patched and the production audit is clean. No `--force`, `--legacy-peer-deps`, or `npm audit fix --force` command was used.

The D1 tests retain Miniflare 4.20260730.0 as an explicit development dependency because its public test API matches the existing disposable-D1 harness. The deployed Cloudflare toolchain uses its own current Miniflare version. An npm override raises the test dependency's `undici` to 7.29.0.

## Accepted residual risk

`npm audit --omit=dev` reports zero production vulnerabilities. The full audit reports four moderate development-only entries in one chain:

`drizzle-kit` -> `@esbuild-kit/esm-loader` -> `@esbuild-kit/core-utils` -> `esbuild <= 0.24.2`

The upstream graph currently reports no compatible fix. This app uses Drizzle Kit as a local migration generator, not as a public or production server. Until a compatible release removes the chain:

- do not expose Drizzle Kit or its esbuild development server to a network;
- do not browse untrusted sites while running affected development tooling;
- keep committed SQL plus migration-integrity tests authoritative; and
- re-run both production and full audits when updating Drizzle Kit.

This is an accepted local-development residual risk, not a claim that the dependency is safe in arbitrary use.

## Generated-component lint baseline

The initial full Oxlint run reported 19 findings: 18 in generated `components/ui` shadcn files and one in the generated `hooks/use-mobile.ts`. `.oxlintrc.json` now disables only the exact generated-code rules responsible for that known baseline:

- generated semantic-role/a11y wrapper findings;
- generated React compiler effect findings; and
- generated chart template-expression findings.

All other rules remain active in those files, and every rule remains active for authored product code. A full repository `npm run lint` must remain clean; new authored findings must be fixed rather than added to this baseline.
