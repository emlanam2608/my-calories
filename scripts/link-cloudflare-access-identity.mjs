import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const usage = `Usage:
  npm run auth:link-cloudflare -- --database <name-or-id> --owner-id <existing-owner-id> --team-domain <https://team.cloudflareaccess.com> --subject <access-subject> --email <owner-email> (--local | --remote)

The command performs one insert and refuses to overwrite an existing identity.
Use --validate-only instead of --local/--remote to validate inputs without writing.`;

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  console.log(usage);
  process.exit(0);
}

const input = validateOptions(options);
if (options.validateOnly) {
  console.log(
    `Cloudflare Access identity link is valid for ${input.database} (${input.mode}).`,
  );
  process.exit(0);
}

const tempDirectory = await mkdtemp(
  join(tmpdir(), 'nourishwell-access-identity-'),
);
const sqlPath = join(tempDirectory, 'link.sql');
const logsDirectory = resolve('.wrangler', 'logs');
await mkdir(logsDirectory, { recursive: true });

try {
  const sql = `INSERT INTO auth_identities (id, owner_id, provider, issuer, subject, email_at_link, linked_at)
VALUES (${sqlLiteral(randomUUID())}, ${sqlLiteral(input.ownerId)}, 'cloudflare_access', ${sqlLiteral(input.teamDomain)}, ${sqlLiteral(input.subject)}, ${sqlLiteral(input.email)}, ${Date.now()});\n`;
  await writeFile(sqlPath, sql, { encoding: 'utf8', flag: 'wx' });

  const wranglerScript = resolve('node_modules', 'wrangler', 'bin', 'wrangler.js');
  const exitCode = await run(process.execPath, [
    wranglerScript,
    'd1',
    'execute',
    input.database,
    input.mode === 'remote' ? '--remote' : '--local',
    '--file',
    sqlPath,
    '--yes',
  ]);
  if (exitCode !== 0) {
    throw new Error(
      'Identity link failed. No existing mapping was overwritten; inspect the Wrangler error before retrying.',
    );
  }
  console.log(
    `Linked the Cloudflare Access subject to owner ${input.ownerId} in ${input.database} (${input.mode}).`,
  );
} finally {
  await unlink(sqlPath).catch(() => undefined);
  await rmdir(tempDirectory).catch(() => undefined);
}

function parseArguments(argumentsList) {
  const parsed = {
    database: '',
    email: '',
    help: false,
    local: false,
    ownerId: '',
    remote: false,
    subject: '',
    teamDomain: '',
    validateOnly: false,
  };
  const valueOptions = new Map([
    ['--database', 'database'],
    ['--email', 'email'],
    ['--owner-id', 'ownerId'],
    ['--subject', 'subject'],
    ['--team-domain', 'teamDomain'],
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (argument === '--local' || argument === '--remote') {
      parsed[argument.slice(2)] = true;
      continue;
    }
    if (argument === '--validate-only') {
      parsed.validateOnly = true;
      continue;
    }
    const property = valueOptions.get(argument);
    const value = argumentsList[index + 1];
    if (!property || !value || value.startsWith('--')) {
      fail(`Unknown or incomplete argument: ${argument}`);
    }
    if (parsed[property]) fail(`Duplicate argument: ${argument}`);
    parsed[property] = value;
    index += 1;
  }
  return parsed;
}

function validateOptions(optionsToValidate) {
  const database = boundedValue(optionsToValidate.database, 'database', 128);
  if (!/^[A-Za-z0-9_-]+$/.test(database))
    fail(
      'database may contain only letters, numbers, underscores, and hyphens',
    );
  const ownerId = boundedValue(optionsToValidate.ownerId, 'owner-id', 255);
  const subject = boundedValue(optionsToValidate.subject, 'subject', 512);
  const email = boundedValue(
    optionsToValidate.email,
    'email',
    320,
  ).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('email is invalid');

  let teamDomain;
  try {
    const parsed = new URL(optionsToValidate.teamDomain);
    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname.endsWith('.cloudflareaccess.com') ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      (parsed.pathname !== '/' && parsed.pathname !== '') ||
      parsed.search ||
      parsed.hash
    ) {
      fail('team-domain must be an HTTPS Cloudflare Access team origin');
    }
    teamDomain = parsed.origin;
  } catch {
    fail('team-domain must be an HTTPS Cloudflare Access team origin');
  }

  const modeCount =
    Number(optionsToValidate.local) + Number(optionsToValidate.remote);
  if (optionsToValidate.validateOnly) {
    if (modeCount !== 0)
      fail('--validate-only cannot be combined with --local or --remote');
  } else if (modeCount !== 1) {
    fail('choose exactly one of --local or --remote');
  }

  return {
    database,
    email,
    mode: optionsToValidate.validateOnly
      ? 'validation only'
      : optionsToValidate.remote
        ? 'remote'
        : 'local',
    ownerId,
    subject,
    teamDomain,
  };
}

function boundedValue(value, label, maximumLength) {
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

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function run(command, argumentsList) {
  return new Promise((resolveExitCode, reject) => {
    const child = spawn(command, argumentsList, {
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: resolve('.wrangler', 'logs'),
        WRANGLER_WRITE_LOGS: 'false',
      },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => resolveExitCode(code ?? 1));
  });
}

function fail(message) {
  console.error(`${message}\n\n${usage}`);
  process.exit(1);
}
