import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import {
  McpServer,
  fromJsonSchema,
  type CallToolResult
} from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import {
  MCP_TOOL_CATALOG,
  mcpToolInputJsonSchemas,
  mcpToolOutputJsonSchemas,
  parseMcpToolInput,
  parseMcpToolOutput,
  type McpToolName
} from '../../protocol/src/index.js';
import type { StdioAdapterConfig } from './config.js';

export interface RunningStdioAdapter {
  close(): Promise<void>;
}

const title = (tool: McpToolName): string => tool
  .split('_')
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

// Hand-wired stdio currently negotiates the 2025 MCP era. Its wire codec
// wraps structured output as `{result: ...}` when the advertised schema has a
// typeless `$ref` root. Every canonical Octopus result is an object, so stamp
// that known root type and keep the broker's structured result shape intact.
const objectRootOutputSchema = (tool: McpToolName): Record<string, unknown> => ({
  ...mcpToolOutputJsonSchemas[tool],
  type: 'object'
});

/**
 * Bridges one agent-owned stdio MCP process to the local HTTP broker. The
 * remote HTTP acknowledgement proves delivery to this adapter process; MCP
 * has no transaction spanning that handoff and the subsequent stdout write.
 * Consequently, a process crash in that narrow interval can dispatch a ticket
 * whose acknowledgement the agent runtime did not receive. The broker-issued
 * request_ref remains the only request identity and is never synthesized here.
 */
export async function startStdioAdapter(config: StdioAdapterConfig): Promise<RunningStdioAdapter> {
  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${config.bearerToken}`,
    'x-octopus-runtime': config.identity.runtimeName,
    'x-octopus-runtime-session': config.identity.runtimeSessionKey,
    ...(config.identity.parentRuntimeSessionKey === undefined
      ? {}
      : { 'x-octopus-parent-runtime-session': config.identity.parentRuntimeSessionKey })
  };
  const remoteClient = new Client({
    name: 'octopus-browser-relay-stdio-adapter',
    version: config.serviceVersion
  }, { versionNegotiation: { mode: 'auto' } });
  await remoteClient.connect(new StreamableHTTPClientTransport(config.brokerUrl, {
    requestInit: { headers: requestHeaders }
  }));

  const server = new McpServer({
    name: 'octopus-browser-relay',
    version: config.serviceVersion
  });
  for (const definition of MCP_TOOL_CATALOG) {
    server.registerTool(definition.name, {
      title: title(definition.name),
      description: definition.description,
      inputSchema: fromJsonSchema(mcpToolInputJsonSchemas[definition.name]),
      outputSchema: fromJsonSchema(objectRootOutputSchema(definition.name))
    }, async (rawInput): Promise<CallToolResult> => {
      const input = parseMcpToolInput(definition.name, rawInput);
      const result = await remoteClient.callTool({
        name: definition.name,
        arguments: input as Record<string, unknown>
      });
      if (!result.isError && result.structuredContent !== undefined) {
        parseMcpToolOutput(definition.name, result.structuredContent);
      }
      // Rebuild the result instead of forwarding the remote server's `_meta`.
      // The stdio server adds its own server metadata and otherwise preserves
      // the broker's content and structured output byte-for-byte.
      return {
        content: result.content,
        ...(result.structuredContent === undefined ? {} : { structuredContent: result.structuredContent }),
        ...(result.isError === undefined ? {} : { isError: result.isError })
      };
    });
  }

  const stdioTransport = new StdioServerTransport();
  try {
    await server.connect(stdioTransport);
  } catch (error) {
    await remoteClient.close();
    throw error;
  }

  let closing: Promise<void> | null = null;
  return {
    close: () => {
      closing ??= Promise.allSettled([server.close(), remoteClient.close()]).then((results) => {
        const rejection = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (rejection) throw rejection.reason;
      });
      return closing;
    }
  };
}
