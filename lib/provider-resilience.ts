type CircuitState = { failures: number; openUntil: number };

const circuits = new Map<string, CircuitState>();
const timeoutMs = 7_000;
const maximumAttempts = 2;
const failuresBeforeOpen = 3;
const cooldownMs = 60_000;

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super(`${provider} is temporarily unavailable.`);
    this.name = 'ProviderUnavailableError';
  }
}

export async function fetchProvider(
  provider: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const state = circuits.get(provider);
  if (state && state.openUntil > Date.now())
    throw new ProviderUnavailableError(provider);

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!isRetryableStatus(response.status)) {
        if (response.ok) circuits.delete(provider);
        return response;
      }
      if (attempt === maximumAttempts - 1) {
        recordFailure(provider);
        throw new ProviderUnavailableError(provider);
      }
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      if (attempt === maximumAttempts - 1) {
        recordFailure(provider);
        throw new ProviderUnavailableError(provider);
      }
    }
    await pause(250 * (attempt + 1));
  }
  throw new ProviderUnavailableError(provider);
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function recordFailure(provider: string) {
  const previous = circuits.get(provider);
  const failures = (previous?.failures ?? 0) + 1;
  circuits.set(provider, {
    failures,
    openUntil: failures >= failuresBeforeOpen ? Date.now() + cooldownMs : 0,
  });
}

function pause(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
