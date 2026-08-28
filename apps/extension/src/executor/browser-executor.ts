const safeUrl = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('INVALID_URL');
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('BLOCKED_URL_SCHEME');
  return url.href;
};

const tabView = (tab: chrome.tabs.Tab): Record<string, unknown> => ({
  id: tab.id,
  windowId: tab.windowId,
  active: tab.active,
  pinned: tab.pinned,
  title: tab.title ?? null,
  url: tab.url ?? null,
  status: tab.status ?? null
});

export async function executeBrowserCommand(operation: string, rawParameters: unknown): Promise<unknown> {
  const parameters = rawParameters !== null && typeof rawParameters === 'object' ? rawParameters as Record<string, unknown> : {};
  switch (operation) {
    case 'list_tabs':
      return { tabs: (await chrome.tabs.query({})).map(tabView) };
    case 'get_active_tab': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('NO_ACTIVE_TAB');
      return { tab: tabView(tab) };
    }
    case 'open_url': {
      const tab = await chrome.tabs.create({ url: safeUrl(parameters.url), active: parameters.active !== false });
      return { tab: tabView(tab) };
    }
    case 'activate_tab': {
      if (!Number.isInteger(parameters.tabId)) throw new Error('INVALID_TAB_ID');
      const tab = await chrome.tabs.update(Number(parameters.tabId), { active: true });
      if (!tab) throw new Error('TAB_NOT_FOUND');
      return { tab: tabView(tab) };
    }
    case 'navigate': {
      const tabId = Number.isInteger(parameters.tabId) ? Number(parameters.tabId) : undefined;
      const target = tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
      if (target === undefined) throw new Error('NO_ACTIVE_TAB');
      const tab = await chrome.tabs.update(target, { url: safeUrl(parameters.url) });
      if (!tab) throw new Error('TAB_NOT_FOUND');
      return { tab: tabView(tab) };
    }
    case 'snapshot': {
      const tabId = Number.isInteger(parameters.tabId) ? Number(parameters.tabId) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
      if (tabId === undefined) throw new Error('NO_ACTIVE_TAB');
      const tab = await chrome.tabs.get(tabId);
      const url = tab.url ? new URL(tab.url) : null;
      if (!url || (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')) {
        return { tab: tabView(tab), document: null, reason: 'DOM snapshot is restricted to loopback fixtures.' };
      }
      const maxChars = Number.isInteger(parameters.maxChars) ? Math.min(50_000, Math.max(128, Number(parameters.maxChars))) : 10_000;
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (limit: number) => ({ title: document.title, text: document.body?.innerText.slice(0, limit) ?? '' }),
        args: [maxChars]
      });
      return { tab: tabView(tab), document: injection?.result ?? null };
    }
    default:
      throw new Error('CAPABILITY_UNSUPPORTED');
  }
}

export const extensionCapabilities = ['list_tabs', 'get_active_tab', 'open_url', 'activate_tab', 'navigate', 'snapshot'] as const;
