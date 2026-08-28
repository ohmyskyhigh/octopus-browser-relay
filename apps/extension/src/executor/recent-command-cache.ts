const CACHE_KEY = 'recentCommandResults';
const MAX_COMMANDS = 200;

export interface CachedCommandResult {
  ok: boolean;
  output?: unknown;
  errorCode?: string;
}

export async function getCachedResult(commandId: string): Promise<CachedCommandResult | null> {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const cache = stored[CACHE_KEY];
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return null;
  const value = (cache as Record<string, unknown>)[commandId];
  return value && typeof value === 'object' ? value as CachedCommandResult : null;
}

export async function rememberResult(commandId: string, result: CachedCommandResult): Promise<void> {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const current = stored[CACHE_KEY] && typeof stored[CACHE_KEY] === 'object' && !Array.isArray(stored[CACHE_KEY])
    ? stored[CACHE_KEY] as Record<string, CachedCommandResult>
    : {};
  const entries = [[commandId, result] as const, ...Object.entries(current).filter(([id]) => id !== commandId)].slice(0, MAX_COMMANDS);
  await chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries) });
}
