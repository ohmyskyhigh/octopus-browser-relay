import { createServer, type IncomingMessage, type Server } from 'node:http';
import { McpServer, createMcpHandler, type AuthInfo, type McpRequestContext } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { AgentPrincipal } from '../../protocol/src/index.js';
import {
  AcquireSessionInputSchema,
  BindAgentInputSchema,
  BrokerHealthInputSchema,
  DispatchInputSchema,
  GetCommandInputSchema,
  GetMyBindingInputSchema,
  GetTargetInputSchema,
  ListBindingsInputSchema,
  ListTargetsInputSchema,
  PairTargetInputSchema,
  RelayError,
  ReleaseSessionInputSchema,
  RenameTargetInputSchema,
  RevokeTargetInputSchema,
  UnbindAgentInputSchema
} from '../../protocol/src/index.js';
import type { BrokerCore } from '../../broker-core/src/index.js';
import type { RelayRepositories } from '../../storage/src/index.js';
import { authenticateRequest, rejectUnauthorized } from './auth.js';

type NodeRequestWithAuth = IncomingMessage & { auth?: AuthInfo };

export interface McpGatewayOptions {
  host: string;
  port: number;
  serviceVersion: string;
  health: () => Record<string, unknown>;
}

export class McpGateway {
  private readonly httpServer: Server;

  constructor(
    private readonly broker: BrokerCore,
    private readonly store: RelayRepositories,
    private readonly options: McpGatewayOptions
  ) {
    const mcpHandler = createMcpHandler((context) => this.createMcpServer(context), {
      legacy: 'stateless',
      responseMode: 'json',
      onerror: (error) => console.error('MCP handler error:', error.message)
    });
    const nodeHandler = toNodeHandler(mcpHandler, {
      onerror: (error) => console.error('MCP adapter error:', error.message)
    });
    this.httpServer = createServer(async (request, response) => {
      if (!this.allowedHost(request.headers.host)) {
        response.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'FORBIDDEN_HOST' }));
        return;
      }
      if (request.url === '/health' && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: 'ok', ...this.options.health() }));
        return;
      }
      if (request.url !== '/mcp') {
        response.writeHead(404).end();
        return;
      }
      const auth = authenticateRequest(request, this.store);
      if (!auth) {
        rejectUnauthorized(response);
        return;
      }
      (request as NodeRequestWithAuth).auth = auth;
      await nodeHandler(
        request as unknown as Parameters<typeof nodeHandler>[0],
        response as unknown as Parameters<typeof nodeHandler>[1]
      );
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.httpServer.once('error', reject);
      this.httpServer.listen(this.options.port, this.options.host, () => {
        this.httpServer.off('error', reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => this.httpServer.close((error) => error ? reject(error) : resolve()));
  }

  address(): { host: string; port: number } {
    const address = this.httpServer.address();
    if (!address || typeof address === 'string') return { host: this.options.host, port: this.options.port };
    return { host: address.address, port: address.port };
  }

  private createMcpServer(context: McpRequestContext): McpServer {
    const principal = this.principal(context.authInfo);
    const server = new McpServer({
      name: 'octopus-browser-relay',
      version: this.options.serviceVersion
    });

    server.registerTool('list_targets', {
      title: 'List browser targets',
      description: 'List sanitized targets visible to this principal; dedicated agents see only their bound target.',
      inputSchema: ListTargetsInputSchema
    }, async () => this.toolResult(() => ({ targets: this.broker.listTargets(principal) })));

    server.registerTool('get_my_binding', {
      title: 'Get my browser binding',
      description: 'Return the calling agent’s opaque bindingRef and sanitized bound-target status.',
      inputSchema: GetMyBindingInputSchema
    }, async () => this.toolResult(() => this.broker.getMyBinding(principal)));

    server.registerTool('get_target', {
      title: 'Get browser target',
      description: 'Get the sanitized target snapshot selected by an owned bindingRef.',
      inputSchema: GetTargetInputSchema
    }, async ({ bindingRef }) => this.toolResult(() => this.broker.getTarget(principal, bindingRef)));

    server.registerTool('acquire_session', {
      title: 'Acquire browser session',
      description: 'Acquire an exclusive, time-bounded lease and opaque session handle.',
      inputSchema: AcquireSessionInputSchema
    }, async ({ bindingRef, ttlMs, waitMs }) => this.toolResult(() => this.broker.acquireSession(principal, bindingRef, ttlMs, waitMs)));

    server.registerTool('release_session', {
      title: 'Release browser session',
      description: 'Release a session handle owned by the calling principal.',
      inputSchema: ReleaseSessionInputSchema
    }, async ({ bindingRef, sessionHandle }) => this.toolResult(() => {
      this.broker.releaseSession(principal, bindingRef, sessionHandle);
      return { released: true };
    }));

    server.registerTool('dispatch', {
      title: 'Dispatch browser command',
      description: 'Submit durable browser work through broker routing, leases, and correlation.',
      inputSchema: DispatchInputSchema
    }, async (input) => this.toolResult(() => this.broker.dispatch({
      principal,
      ...(input.runId === undefined ? {} : { runId: input.runId }),
      bindingRef: input.bindingRef,
      ...(input.sessionHandle === undefined ? {} : { sessionHandle: input.sessionHandle }),
      operation: input.operation,
      parameters: input.parameters,
      idempotencyClass: input.idempotencyClass,
      waitMs: input.waitMs,
      deadlineMs: input.deadlineMs,
      ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey })
    })));

    server.registerTool('get_command', {
      title: 'Get command',
      description: 'Read durable command state and result for the calling principal.',
      inputSchema: GetCommandInputSchema
    }, async ({ bindingRef, commandId }) => this.toolResult(() => this.broker.getCommand(principal, bindingRef, commandId)));

    server.registerTool('pair_target', {
      title: 'Create target pairing code',
      description: 'Admin-only: create a short-lived, one-use extension pairing code.',
      inputSchema: PairTargetInputSchema
    }, async ({ alias, expiresInMs }) => this.toolResult(() => this.broker.createPairingCode(principal, alias, expiresInMs)));

    server.registerTool('bind_agent', {
      title: 'Bind agent to extension target',
      description: 'Admin-only: create one exclusive principal-to-target binding and return its opaque bindingRef.',
      inputSchema: BindAgentInputSchema
    }, async ({ principalId, alias }) => this.toolResult(() => this.broker.bindAgent(principal, principalId, alias)));

    server.registerTool('unbind_agent', {
      title: 'Unbind agent from extension target',
      description: 'Admin-only: revoke the active dedicated binding for one principal.',
      inputSchema: UnbindAgentInputSchema
    }, async ({ principalId }) => this.toolResult(() => {
      this.broker.unbindAgent(principal, principalId);
      return { unbound: true, principalId };
    }));

    server.registerTool('list_bindings', {
      title: 'List active agent bindings',
      description: 'Admin-only: list active opaque bindings and their safe target aliases.',
      inputSchema: ListBindingsInputSchema
    }, async () => this.toolResult(() => ({ bindings: this.broker.listBindings(principal) })));

    server.registerTool('rename_target', {
      title: 'Rename target',
      description: 'Admin-only: change a target alias.',
      inputSchema: RenameTargetInputSchema
    }, async ({ alias, newAlias }) => this.toolResult(() => {
      this.broker.renameTarget(principal, alias, newAlias);
      return { renamed: true, alias: newAlias };
    }));

    server.registerTool('revoke_target', {
      title: 'Revoke target',
      description: 'Admin-only: revoke a target and fence its live socket and lease.',
      inputSchema: RevokeTargetInputSchema
    }, async ({ alias }) => this.toolResult(() => {
      this.broker.revokeTarget(principal, alias);
      return { revoked: true, alias };
    }));

    server.registerTool('broker_health', {
      title: 'Broker health',
      description: 'Return sanitized broker readiness and queue/connection summary.',
      inputSchema: BrokerHealthInputSchema
    }, async () => this.toolResult(() => ({ status: 'ok', version: this.options.serviceVersion, ...this.options.health() })));

    return server;
  }

  private principal(authInfo: AuthInfo | undefined): AgentPrincipal {
    if (!authInfo) throw new Error('Authenticated MCP context is required.');
    return {
      principalId: authInfo.clientId,
      displayName: typeof authInfo.extra?.displayName === 'string' ? authInfo.extra.displayName : authInfo.clientId,
      scopes: authInfo.scopes
    };
  }

  private async toolResult<T>(operation: () => T | Promise<T>): Promise<{
    content: [{ type: 'text'; text: string }];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  }> {
    try {
      const result = await operation();
      const structuredContent = this.asObject(result);
      return { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent };
    } catch (error) {
      const relay = error instanceof RelayError ? error : null;
      const body = {
        error: relay?.code ?? 'INTERNAL_ERROR',
        message: relay?.message ?? (error instanceof Error ? error.message : 'Unknown error.'),
        ...(relay?.retryAfterMs === undefined ? {} : { retryAfterMs: relay.retryAfterMs })
      };
      return { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body, isError: true };
    }
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    return { value };
  }

  private allowedHost(hostHeader: string | undefined): boolean {
    if (!hostHeader) return false;
    const hostname = hostHeader.replace(/^\[/, '').split(']')[0]!.split(':')[0]!.toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  }
}
