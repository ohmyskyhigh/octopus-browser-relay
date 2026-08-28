import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createRelayApplication } from '../apps/broker/src/bootstrap.js';

const token = 'smoke-admin-token-that-is-long-enough';
const application = createRelayApplication({
  host: '127.0.0.1', mcpPort: 0, wsPort: 0, dbPath: ':memory:', logLevel: 'silent',
  heartbeatTimeoutMs: 5_000, errorThreshold: 3, leaseTtlMs: 60_000, adminToken: token
});
await application.start();
const client = new Client({ name: 'smoke-test', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } });
try {
  const { port } = application.mcpGateway.address();
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } }
  }));
  const tools = await client.listTools();
  if (tools.tools.length !== 14) throw new Error(`Expected 14 MCP tools, received ${tools.tools.length}.`);
  const health = await client.callTool({ name: 'broker_health', arguments: {} });
  if (health.isError) throw new Error('broker_health returned an error.');
  console.log(JSON.stringify({ status: 'PASS', tools: tools.tools.length, health: health.structuredContent }, null, 2));
} finally {
  await client.close();
  await application.stop();
}
