import { afterEach, describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createRelayApplication, type RelayApplication } from '../../apps/broker/src/bootstrap.js';

describe('MCP gateway', () => {
  let application: RelayApplication | null = null;
  let client: Client | null = null;

  afterEach(async () => {
    if (client) await client.close();
    if (application) await application.stop();
  });

  it('authenticates and exposes sanitized production tools over Streamable HTTP', async () => {
    const adminToken = 'test-admin-token-that-is-long-enough';
    application = createRelayApplication({
      host: '127.0.0.1',
      mcpPort: 0,
      wsPort: 0,
      dbPath: ':memory:',
      logLevel: 'silent',
      heartbeatTimeoutMs: 5_000,
      errorThreshold: 3,
      leaseTtlMs: 60_000,
      adminToken
    });
    await application.start();
    const { port } = application.mcpGateway.address();
    client = new Client({ name: 'integration-test', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${adminToken}` } }
    });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'list_targets', 'get_my_binding', 'get_target', 'acquire_session', 'release_session', 'dispatch', 'get_command',
      'pair_target', 'bind_agent', 'unbind_agent', 'list_bindings', 'rename_target', 'revoke_target', 'broker_health'
    ]));
    const pairing = await client.callTool({ name: 'pair_target', arguments: { alias: 'profile-a', expiresInMs: 60_000 } });
    expect(pairing.isError).not.toBe(true);
    expect(JSON.stringify(pairing.structuredContent)).toContain('pairingCode');
    const pairingCode = String((pairing.structuredContent as Record<string, unknown>).pairingCode);
    application.store.consumePairingCode(pairingCode, { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }, ['list_tabs']);
    const agent = application.store.createAgent('bound-agent', ['targets:read', 'browser:read']);
    const binding = await client.callTool({ name: 'bind_agent', arguments: { principalId: agent.principal.principalId, alias: 'profile-a' } });
    expect(binding.isError).not.toBe(true);
    expect(String((binding.structuredContent as Record<string, unknown>).bindingRef)).toMatch(/^br_[A-Za-z0-9_-]{32}$/);
    const targets = await client.callTool({ name: 'list_targets', arguments: {} });
    expect(JSON.stringify(targets.structuredContent)).toContain('profile-a');
    expect(JSON.stringify(targets)).not.toContain('targetId');
  });

  it('rejects missing credentials before MCP parsing', async () => {
    const adminToken = 'another-test-admin-token-long-enough';
    application = createRelayApplication({
      host: '127.0.0.1', mcpPort: 0, wsPort: 0, dbPath: ':memory:', logLevel: 'silent',
      heartbeatTimeoutMs: 5_000, errorThreshold: 3, leaseTtlMs: 60_000, adminToken
    });
    await application.start();
    const { port } = application.mcpGateway.address();
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(401);
  });
});
