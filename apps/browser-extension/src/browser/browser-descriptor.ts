export interface BrowserDescriptor {
  product: string;
  version: string;
  userAgent: string | null;
}

export function detectBrowserDescriptor(userAgent = globalThis.navigator?.userAgent ?? ''): BrowserDescriptor {
  const match = /(?:Chrome|Chromium)\/([^\s]+)/.exec(userAgent);
  const isAdsPower = /AdsPower/i.test(userAgent);
  return {
    product: isAdsPower ? 'AdsPower Chromium' : 'Chromium',
    version: match?.[1] ?? 'unknown',
    userAgent: userAgent || null
  };
}

