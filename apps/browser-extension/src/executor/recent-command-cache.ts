const LEGACY_CACHE_KEY = 'recentCommandResults';
const ATTEMPT_CACHE_KEY = 'recentAttemptOutcomesV2';
const DEFAULT_MAX_ATTEMPTS = 128;
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;

export interface CachedCommandResult {
  ok: boolean;
  output?: unknown;
  errorCode?: string;
}

export interface AttemptError {
  code: string;
  message: string;
}

export interface RecentAttemptOutcome {
  attemptId: string;
  connectionGeneration: number;
  inventoryGeneration: number;
  tabId?: number;
  windowId?: number;
  windowGeneration?: number;
  tabGeneration?: number;
  attachmentGeneration?: number;
  operation: string;
  recordedAt: string;
  ok: boolean;
  output?: unknown;
  error?: AttemptError;
}

export interface AttemptLookup {
  attemptId: string;
  connectionGeneration: number;
  tabId?: number;
  windowId?: number;
  windowGeneration?: number;
  tabGeneration?: number;
  attachmentGeneration?: number;
}

export interface ReconciliationLookup {
  attemptId: string;
  tabId?: number;
  windowId?: number;
  windowGeneration?: number;
  tabGeneration?: number;
  attachmentGeneration?: number | null;
}

export interface LocalStorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface RecentAttemptCacheOptions {
  maxAttempts?: number;
  maxBytes?: number;
  maxAgeMs?: number;
  now?: () => number;
}

const jsonSize = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;

export class RecentAttemptCache {
  private readonly maxAttempts: number;
  private readonly maxBytes: number;
  private readonly maxAgeMs: number;
  private readonly now: () => number;
  private updateTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: LocalStorageArea = chrome.storage.local,
    options: RecentAttemptCacheOptions = {}
  ) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    this.now = options.now ?? Date.now;
  }

  async get(lookup: AttemptLookup): Promise<RecentAttemptOutcome | null> {
    await this.updateTail;
    const entries = await this.read();
    const outcome = entries.find((entry) => entry.attemptId === lookup.attemptId);
    if (!outcome || this.isExpired(outcome)) return null;
    if (outcome.connectionGeneration !== lookup.connectionGeneration) return null;
    if (lookup.tabId !== undefined && outcome.tabId !== lookup.tabId) return null;
    if (lookup.windowId !== undefined && outcome.windowId !== lookup.windowId) return null;
    if (lookup.windowGeneration !== undefined && outcome.windowGeneration !== lookup.windowGeneration) return null;
    if (lookup.tabGeneration !== undefined && outcome.tabGeneration !== lookup.tabGeneration) return null;
    if (lookup.attachmentGeneration !== undefined && outcome.attachmentGeneration !== lookup.attachmentGeneration) return null;
    return outcome;
  }

  async getForReconciliation(lookup: ReconciliationLookup): Promise<RecentAttemptOutcome | null> {
    await this.updateTail;
    const entries = await this.read();
    const outcome = entries.find((entry) => entry.attemptId === lookup.attemptId);
    if (!outcome || this.isExpired(outcome)) return null;
    if (lookup.tabId !== undefined && outcome.tabId !== lookup.tabId) return null;
    if (lookup.windowId !== undefined && outcome.windowId !== lookup.windowId) return null;
    if (lookup.windowGeneration !== undefined && outcome.windowGeneration !== lookup.windowGeneration) return null;
    if (lookup.tabGeneration !== undefined && outcome.tabGeneration !== lookup.tabGeneration) return null;
    if (lookup.attachmentGeneration !== undefined
      && (outcome.attachmentGeneration ?? null) !== lookup.attachmentGeneration) return null;
    return outcome;
  }

  remember(outcome: RecentAttemptOutcome): Promise<void> {
    const update = this.updateTail.then(async () => {
      const existing = await this.read();
      const candidates = [outcome, ...existing.filter((entry) => entry.attemptId !== outcome.attemptId && !this.isExpired(entry))]
        .slice(0, this.maxAttempts);
      const bounded: RecentAttemptOutcome[] = [];
      let bytes = 2;
      for (const candidate of candidates) {
        const candidateBytes = jsonSize(candidate) + (bounded.length === 0 ? 0 : 1);
        if (candidateBytes > this.maxBytes) continue;
        if (bytes + candidateBytes > this.maxBytes) break;
        bounded.push(candidate);
        bytes += candidateBytes;
      }
      await this.storage.set({ [ATTEMPT_CACHE_KEY]: bounded });
    });
    this.updateTail = update.catch(() => undefined);
    return update;
  }

  private async read(): Promise<RecentAttemptOutcome[]> {
    const stored = await this.storage.get(ATTEMPT_CACHE_KEY);
    const value = stored[ATTEMPT_CACHE_KEY];
    if (!Array.isArray(value)) return [];
    return value.filter(isRecentAttemptOutcome);
  }

  private isExpired(outcome: RecentAttemptOutcome): boolean {
    const recorded = Date.parse(outcome.recordedAt);
    return !Number.isFinite(recorded) || this.now() - recorded > this.maxAgeMs;
  }
}

function isRecentAttemptOutcome(value: unknown): value is RecentAttemptOutcome {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<RecentAttemptOutcome>;
  return typeof candidate.attemptId === 'string'
    && Number.isInteger(candidate.connectionGeneration)
    && Number.isInteger(candidate.inventoryGeneration)
    && (candidate.tabId === undefined || Number.isInteger(candidate.tabId))
    && (candidate.windowId === undefined || Number.isInteger(candidate.windowId))
    && (candidate.windowGeneration === undefined || Number.isInteger(candidate.windowGeneration))
    && (candidate.tabGeneration === undefined || Number.isInteger(candidate.tabGeneration))
    && (candidate.attachmentGeneration === undefined || Number.isInteger(candidate.attachmentGeneration))
    && typeof candidate.operation === 'string'
    && typeof candidate.recordedAt === 'string'
    && typeof candidate.ok === 'boolean';
}

// Protocol-v1 compatibility stays isolated from the relay-v2 reconciliation cache.
export async function getCachedResult(commandId: string): Promise<CachedCommandResult | null> {
  const stored = await chrome.storage.local.get(LEGACY_CACHE_KEY);
  const cache = stored[LEGACY_CACHE_KEY];
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return null;
  const value = (cache as Record<string, unknown>)[commandId];
  return value && typeof value === 'object' ? value as CachedCommandResult : null;
}

export async function rememberResult(commandId: string, result: CachedCommandResult): Promise<void> {
  const stored = await chrome.storage.local.get(LEGACY_CACHE_KEY);
  const current = stored[LEGACY_CACHE_KEY] && typeof stored[LEGACY_CACHE_KEY] === 'object' && !Array.isArray(stored[LEGACY_CACHE_KEY])
    ? stored[LEGACY_CACHE_KEY] as Record<string, CachedCommandResult>
    : {};
  const entries = [[commandId, result] as const, ...Object.entries(current).filter(([id]) => id !== commandId)].slice(0, 200);
  await chrome.storage.local.set({ [LEGACY_CACHE_KEY]: Object.fromEntries(entries) });
}
