import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

const sourcePath = '.env.local';
const outputPath = '.env.production.local';
const source = parseEnv(await readFile(sourcePath, 'utf8'));
const openAiKey = requiredSecret(source, 'OPENAI_API_KEY');
const usdaKey = requiredSecret(source, 'USDA_FDC_API_KEY');
const encryptionKey = randomBytes(32).toString('base64');

await writeFile(
  outputPath,
  `${JSON.stringify({
    OPENAI_API_KEY: openAiKey,
    USDA_FDC_API_KEY: usdaKey,
    HEALTH_DATA_ENCRYPTION_KEY: encryptionKey,
  }, null, 2)}\n`,
  { encoding: 'utf8', flag: 'wx', mode: 0o600 },
);

console.log(`Prepared ${outputPath} with three secrets. No values were printed.`);
console.log('Keep this ignored file safe until its encryption key is backed up.');

function requiredSecret(source, name) {
  const value = source[name];
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error(`${name} must be a non-empty single-line value in ${sourcePath}`);
  }
  if (/[\r\n]/.test(value)) {
    throw new Error(`${name} must be a single-line value in ${sourcePath}`);
  }
  return value;
}
