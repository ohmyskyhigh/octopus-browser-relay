import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('extension manifest', () => {
  it('uses MV3, Chrome 116+, no remote code, and loopback-only host access', () => {
    const manifest = JSON.parse(readFileSync('apps/extension/manifest.json', 'utf8')) as Record<string, unknown>;
    expect(manifest.manifest_version).toBe(3);
    expect(Number(manifest.minimum_chrome_version)).toBeGreaterThanOrEqual(116);
    expect(manifest.host_permissions).toEqual(['http://127.0.0.1/*', 'http://localhost/*']);
    expect(manifest.permissions).toContain('nativeMessaging');
    expect(manifest.permissions).toContain('alarms');
    expect(manifest.permissions).toContain('tabGroups');
    expect(manifest.permissions).toContain('debugger');
    expect(typeof manifest.key).toBe('string');
    expect(JSON.stringify(manifest)).not.toContain("'unsafe-eval'");
    expect(JSON.stringify(manifest)).not.toContain('https://*/*');
  });
});
