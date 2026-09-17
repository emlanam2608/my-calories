import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourcePath = resolve('dist', 'server', 'wrangler.json');
const outputPath = resolve('dist', 'server', 'wrangler.release.json');

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const release = validateOptions(options);
const generated = JSON.parse(await readFile(sourcePath, 'utf8'));
validateGeneratedConfig(generated);

const config = {
  ...generated,
  name: release.workerName,
  workers_dev: false,
  preview_urls: false,
  routes: [{ pattern: release.hostname, custom_domain: true }],
  secrets: {
    required: [
      'OPENAI_API_KEY',
      'USDA_FDC_API_KEY',
      'HEALTH_DATA_ENCRYPTION_KEY',
    ],
  },
  vars: {
    ...generated.vars,
    AUTH_MODE: 'cloudflare_access',
    CF_ACCESS_AUD: release.accessAud,
    CF_ACCESS_TEAM_DOMAIN: release.teamDomain,
  },
  d1_databases: [
    {
      binding: 'DB',
      database_name: release.databaseName,
      database_id: release.databaseId,
      migrations_dir: '../.openai/drizzle',
    },
  ],
  r2_buckets: [
    {
      binding: 'FILES',
      bucket_name: release.bucketName,
    },
  ],
  observability: {
    enabled: true,
    logs: {
      enabled: true,
      invocation_logs: true,
    },
  },
};

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'w',
});

console.log(`Prepared ${outputPath}`);
console.log(
  'Review it, run Wrangler with --dry-run, and deploy only with explicit authorization.',
);

function parseArguments(argumentsList) {
  const parsed = {};
  const valueOptions = new Map([
    ['--access-aud', 'accessAud'],
    ['--bucket-name', 'bucketName'],
    ['--database-id', 'databaseId'],
    ['--database-name', 'databaseName'],
    ['--hostname', 'hostname'],
    ['--team-domain', 'teamDomain'],
    ['--worker-name', 'workerName'],
  ]);

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }

    const key = valueOptions.get(argument);
    if (!key) fail(`unknown option: ${argument}`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith('--')) fail(`missing value for ${argument}`);
    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function validateOptions(optionsToValidate) {
  const accessAud = boundedValue(
    optionsToValidate.accessAud,
    '--access-aud',
    256,
  );
  const bucketName = boundedValue(
    optionsToValidate.bucketName,
    '--bucket-name',
    63,
  );
  const databaseId = boundedValue(
    optionsToValidate.databaseId,
    '--database-id',
    36,
  );
  const databaseName = boundedValue(
    optionsToValidate.databaseName,
    '--database-name',
    64,
  );
  const hostname = normalizeHostname(optionsToValidate.hostname);
  const teamDomain = normalizeTeamDomain(optionsToValidate.teamDomain);
  const workerName = boundedValue(
    optionsToValidate.workerName ?? 'nourishwell-private',
    '--worker-name',
    63,
  );

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(workerName)) {
    fail(
      '--worker-name must use lowercase letters, numbers, and internal hyphens',
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      databaseId,
    )
  ) {
    fail('--database-id must be a UUID');
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(databaseName)) {
    fail('--database-name contains unsupported characters');
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(bucketName)) {
    fail(
      '--bucket-name must use lowercase letters, numbers, and internal hyphens',
    );
  }

  return {
    accessAud,
    bucketName,
    databaseId,
    databaseName,
    hostname,
    teamDomain,
    workerName,
  };
}

function validateGeneratedConfig(config) {
  if (config.main !== 'index.js' || config.assets?.directory !== '../client') {
    fail(
      'the generated Vinext Worker layout is not recognized; rebuild and review',
    );
  }
  if (
    !config.compatibility_date ||
    !config.compatibility_flags?.includes('nodejs_compat')
  ) {
    fail(
      'the generated Worker must have a compatibility date and nodejs_compat',
    );
  }
}

function normalizeTeamDomain(value) {
  const raw = boundedValue(value, '--team-domain', 255);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('--team-domain must be a valid URL');
  }
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname.endsWith('.cloudflareaccess.com')
  ) {
    fail('--team-domain must be an https://<team>.cloudflareaccess.com origin');
  }
  return url.origin;
}

function normalizeHostname(value) {
  const hostname = boundedValue(value, '--hostname', 253).toLowerCase();
  if (
    hostname.includes('://') ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(hostname)
  ) {
    fail('--hostname must be a DNS hostname without a scheme or path');
  }
  return hostname;
}

function boundedValue(value, label, maximumLength) {
  if (typeof value !== 'string') fail(`${label} is required`);
  const normalized = value.trim();
  const hasControlCharacter = [...normalized].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
  });
  if (!normalized || normalized.length > maximumLength || hasControlCharacter) {
    fail(`${label} must contain 1-${maximumLength} printable characters`);
  }
  return normalized;
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function printHelp() {
  console.log(`Usage:
  npm run release:prepare-cloudflare -- --database-name <name> --database-id <uuid> --bucket-name <name> --team-domain <https://team.cloudflareaccess.com> --access-aud <aud> --hostname <host> [--worker-name <name>]

Run npm run build first. This writes an ignored dist/server/wrangler.release.json
with Cloudflare Access enabled. It does not create resources, migrate data, or deploy.`);
}
