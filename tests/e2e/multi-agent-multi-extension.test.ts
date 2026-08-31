import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createRelayApplication, type RelayApplication } from '../../apps/broker/src/runtime/bootstrap.js';
import {
  MAX_RELAY_V2_ENVELOPE_BYTES,
  createRelayV2Envelope,
  parseRelayV2Envelope,
  type RelayV2Envelope,
  type RelayV2MessageType,
  type RelayV2PayloadByType
} from '../../apps/shared/protocol/src/index.js';

const waitFor = async (condition: () => boolean | Promise<boolean>, timeoutMs = 8_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

interface SimulatedTab {
  tabId: number;
  groupId: number | null;
  attached: boolean;
}

class SimulatedV2Extension {
  private socket: WebSocket | null = null;
  private endpointId = '';
  private connectionGeneration = 0;
  private inventoryGeneration = 1;
  private nextTabId: number;
  private readonly tabs = new Map<number, SimulatedTab>();
  private groupTitle = '';
  readonly executedCdp: string[] = [];

  constructor(
    readonly marker: string,
    private readonly windowId: number,
    private readonly groupId: number,
    firstTabId: number
  ) {
    this.nextTabId = firstTabId;
  }

  async pair(url: string, proposedNickname: string, pairingCode: string): Promise<void> {
    const keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const publicKeyJwk = keys.publicKey.export({ format: 'jwk' }) as RelayV2PayloadByType['HELLO']['publicKeyJwk'];
    this.socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      this.socket!.once('open', resolve);
      this.socket!.once('error', reject);
    });

    const pairedNext = this.nextMessage();
    this.send('HELLO', {
      publicKeyJwk,
      pairingCode,
      proposedNickname,
      extensionVersion: '0.3.0-test',
      browser: { product: 'Chrome', version: '140.0.0.0', userAgent: null },
      supportedProtocolVersions: [2],
      capabilityManifestIds: ['octopus-extension-baseline-v1'],
      maxEnvelopeBytes: MAX_RELAY_V2_ENVELOPE_BYTES
    });
    const paired = await pairedNext as RelayV2Envelope<'PAIRED'>;
    expect(paired.type).toBe('PAIRED');
    this.endpointId = paired.payload.endpointId;

    const challengeNext = this.nextMessage();
    this.send('HELLO', {
      endpointId: this.endpointId,
      publicKeyJwk,
      proposedNickname,
      extensionVersion: '0.3.0-test',
      browser: { product: 'Chrome', version: '140.0.0.0', userAgent: null },
      supportedProtocolVersions: [2],
      capabilityManifestIds: ['octopus-extension-baseline-v1'],
      maxEnvelopeBytes: MAX_RELAY_V2_ENVELOPE_BYTES
    });
    const challenge = await challengeNext as RelayV2Envelope<'CHALLENGE'>;
    this.connectionGeneration = challenge.payload.connectionGeneration;
    const readyNext = this.nextMessage();
    this.send('AUTH', {
      endpointId: this.endpointId,
      signature: sign('sha256', Buffer.from(challenge.payload.nonce), {
        key: keys.privateKey,
        dsaEncoding: 'ieee-p1363'
      }).toString('base64url'),
      connectionGeneration: this.connectionGeneration,
      selectedProtocolVersion: 2
    });
    const ready = await readyNext;
    expect(ready.type).toBe('READY');

    this.socket.on('message', (data) => this.onMessage(data));
    this.sendInventory(randomUUID());
  }

  async close(): Promise<void> {
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      this.socket!.once('close', resolve);
      this.socket!.close(1000, 'fixture complete');
    });
  }

  private nextMessage(): Promise<RelayV2Envelope> {
    return new Promise((resolve, reject) => {
      const onMessage = (data: WebSocket.RawData): void => {
        cleanup();
        try { resolve(parseRelayV2Envelope(JSON.parse(data.toString()) as unknown)); }
        catch (error) { reject(error); }
      };
      const onClose = (): void => {
        cleanup();
        reject(new Error('Socket closed before relay-v2 message.'));
      };
      const cleanup = (): void => {
        this.socket!.off('message', onMessage);
        this.socket!.off('close', onClose);
      };
      this.socket!.once('message', onMessage);
      this.socket!.once('close', onClose);
    });
  }

  private onMessage(data: WebSocket.RawData): void {
    const message = parseRelayV2Envelope(JSON.parse(data.toString()) as unknown);
    if (message.type === 'INVENTORY_REQUEST') {
      this.sendInventory(message.payload.attemptId);
      return;
    }
    if (message.type === 'CREATE_TAB') {
      const tabId = this.nextTabId++;
      this.tabs.set(tabId, { tabId, groupId: message.payload.group?.tabGroupId ?? null, attached: false });
      this.succeed(message, {
        tab: {
          tabId,
          tabGeneration: 1,
          windowId: this.windowId,
          windowGeneration: 1,
          title: `${this.marker} managed tab`,
          url: 'about:blank'
        },
        group: message.payload.group
      }, { tabGeneration: 1, groupGeneration: message.payload.group?.groupGeneration ?? null });
      return;
    }
    if (message.type === 'GROUP_TABS') {
      for (const locator of message.payload.tabs) {
        const tab = this.tabs.get(locator.tabId);
        if (tab) tab.groupId = this.groupId;
      }
      const group = {
        tabGroupId: this.groupId,
        groupGeneration: 1,
        windowId: this.windowId,
        windowGeneration: 1
      };
      this.succeed(message, { group, tabs: message.payload.tabs }, { groupGeneration: 1 });
      return;
    }
    if (message.type === 'RENAME_GROUP') {
      this.groupTitle = message.payload.title;
      this.succeed(message, { group: { ...message.payload.group, title: this.groupTitle } }, { groupGeneration: 1 });
      return;
    }
    if (message.type === 'ATTACH_DEBUGGER') {
      const tab = this.tabs.get(message.payload.tab.tabId);
      if (tab) tab.attached = true;
      this.succeed(message, { attachmentGeneration: 1, protocolVersion: '1.3' }, {
        tabGeneration: message.payload.tab.tabGeneration,
        attachmentGeneration: 1
      });
      return;
    }
    if (message.type === 'SEND_CDP') {
      this.executedCdp.push(message.payload.method);
      this.succeed(message, {
        rawResult: { marker: this.marker, sequence: this.executedCdp.length },
        sessionId: null
      }, {
        tabGeneration: message.payload.tab.tabGeneration,
        attachmentGeneration: message.payload.expected.attachmentGeneration ?? 1
      });
    }
  }

  private sendInventory(attemptId: string): void {
    this.send('INVENTORY_SNAPSHOT', {
      attemptId,
      connectionGeneration: this.connectionGeneration,
      inventoryGeneration: this.inventoryGeneration,
      capturedAt: new Date().toISOString(),
      browser: { product: 'Chrome', version: '140.0.0.0', userAgent: null },
      windows: [{
        windowId: this.windowId,
        windowGeneration: 1,
        focused: true,
        incognito: false,
        type: 'normal',
        state: 'normal',
        groups: this.groupTitle.length === 0 ? [] : [{
          tabGroupId: this.groupId,
          groupGeneration: 1,
          windowId: this.windowId,
          title: this.groupTitle,
          color: 'blue',
          collapsed: false
        }],
        tabs: [...this.tabs.values()].map((tab) => ({
          tabId: tab.tabId,
          tabGeneration: 1,
          windowId: this.windowId,
          groupId: tab.groupId,
          openerTabId: null,
          active: true,
          pinned: false,
          discarded: false,
          status: 'complete',
          url: 'about:blank',
          title: `${this.marker} managed tab`,
          debugger: {
            attached: tab.attached,
            attachmentGeneration: tab.attached ? 1 : null,
            protocolVersion: tab.attached ? '1.3' : null
          }
        }))
      }]
    });
  }

  private succeed<Type extends Exclude<RelayV2MessageType,
    'HELLO' | 'CHALLENGE' | 'AUTH' | 'PAIRED' | 'READY' | 'HEARTBEAT' | 'INVENTORY_REQUEST'
    | 'INVENTORY_SNAPSHOT' | 'ACK' | 'OPERATION_RESULT' | 'CDP_EVENT' | 'DEBUGGER_DETACHED' | 'ERROR'>>(
    message: RelayV2Envelope<Type>,
    result: NonNullable<RelayV2PayloadByType['OPERATION_RESULT']['result']>,
    generations: {
      tabGeneration?: number | null;
      groupGeneration?: number | null;
      attachmentGeneration?: number | null;
    } = {}
  ): void {
    this.inventoryGeneration += 1;
    this.send('ACK', {
      attemptId: message.payload.attemptId,
      operation: message.type,
      expected: message.payload.expected,
      connectionGeneration: this.connectionGeneration,
      acceptedAt: new Date().toISOString()
    });
    this.send('OPERATION_RESULT', {
      attemptId: message.payload.attemptId,
      operation: message.type,
      expected: message.payload.expected,
      observed: {
        connectionGeneration: this.connectionGeneration,
        inventoryGeneration: this.inventoryGeneration,
        tabGeneration: generations.tabGeneration ?? null,
        groupGeneration: generations.groupGeneration ?? null,
        attachmentGeneration: generations.attachmentGeneration ?? null
      },
      outcome: 'succeeded',
      result,
      error: null,
      completedAt: new Date().toISOString()
    });
  }

  private send<Type extends RelayV2MessageType>(type: Type, payload: RelayV2PayloadByType[Type]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('Fixture socket is not open.');
    this.socket.send(JSON.stringify(createRelayV2Envelope(type, payload)));
  }
}

async function connectAgent(port: number, token: string, session: string): Promise<Client> {
  const client = new Client({ name: session, version: '0.3.0-test' }, { versionNegotiation: { mode: 'auto' } });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-octopus-runtime': 'codex',
        'x-octopus-runtime-session': session
      }
    }
  }));
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(JSON.stringify(result.structuredContent ?? result.content));
  return result.structuredContent as Record<string, unknown>;
}

const ticketRef = (output: Record<string, unknown>): string =>
  String(((output.facts as { ticket: { request_ref: string } }).ticket).request_ref);

async function waitTicket(client: Client, requestRef: string): Promise<Record<string, unknown>> {
  let ticket: Record<string, unknown> = {};
  await waitFor(async () => {
    const response = await call(client, 'get_browser_request', { request_ref: requestRef });
    ticket = (response.facts as { ticket: Record<string, unknown> }).ticket;
    return ['succeeded', 'failed', 'cancelled'].includes(String(ticket.state));
  });
  return ticket;
}

describe('multi-agent / multi-extension canonical real transport path', () => {
  let app: RelayApplication | null = null;
  const clients: Client[] = [];
  const extensions: SimulatedV2Extension[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) await client.close();
    for (const extension of extensions.splice(0)) await extension.close();
    if (app) await app.stop();
    app = null;
  });

  it('isolates three agent sessions while relaying CDP to three designated browser-profile endpoints', async () => {
    const adminToken = 'e2e-admin-token-that-is-long-enough';
    app = createRelayApplication({
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
    const agentRecords = ['a', 'b', 'c'].map((name) => app!.store.createAgent(
      `agent-${name}`,
      ['targets:read', 'sessions:write', 'browser:read', 'browser:write']
    ));
    await app.start();
    const mcpPort = app.mcpGateway.address().port;
    const relayPort = app.extensionGateway.address().port;
    const aliases = ['mintwave', 'calmreef', 'brightstar'];
    const pairingCodes = ['MINT-WAVE', 'CALM-REEF', 'BRIGHT-STAR'];

    for (const [index, alias] of aliases.entries()) {
      const extension = new SimulatedV2Extension(
        `fixture-${String.fromCharCode(65 + index)}`,
        100 + index,
        200 + index,
        300 + index * 10
      );
      extensions.push(extension);
      await extension.pair(`ws://127.0.0.1:${relayPort}/relay`, alias, pairingCodes[index]!);
    }
    await waitFor(() => aliases.every((alias) => {
      const endpoint = app!.store.canonical.logical.getEndpointByNickname(alias);
      return endpoint !== null && app!.store.canonical.logical.listWindows(endpoint.endpointRef).length === 1;
    }));

    for (const [index, record] of agentRecords.entries()) {
      clients.push(await connectAgent(mcpPort, record.token, `agent-session-${index}`));
    }

    const workspaceTickets = await Promise.all(aliases.map((alias, index) => call(
      clients[index]!,
      'request_browser_workspace',
      { required_workspace_count: 1, designated_endpoints: [{ endpoint_nickname: alias }] }
    )));
    const workspaceResults = await Promise.all(workspaceTickets.map((accepted, index) =>
      waitTicket(clients[index]!, ticketRef(accepted))));
    expect(
      workspaceResults.map((ticket) => ticket.state),
      JSON.stringify(workspaceResults, null, 2)
    ).toEqual(['succeeded', 'succeeded', 'succeeded']);

    const assignments = workspaceResults.map((ticket) => {
      const result = ticket.result as { facts: { resolved: Array<{
        workspace: { workspace_ref: string };
        tabs: Array<{ tab_ref: string }>;
      }> } };
      return {
        workspaceRef: result.facts.resolved[0]!.workspace.workspace_ref,
        tabRef: result.facts.resolved[0]!.tabs[0]!.tab_ref
      };
    });

    const commandReceipts = await Promise.all(assignments.map((assignment, index) => call(
      clients[index]!,
      'send_cdp_command',
      {
        workspace_ref: assignment.workspaceRef,
        target: { kind: 'tab', tab_ref: assignment.tabRef },
        method: 'Runtime.evaluate',
        params: { expression: `${index} + 1` }
      }
    )));
    const commands = await Promise.all(commandReceipts.map((accepted, index) =>
      waitTicket(clients[index]!, ticketRef(accepted))));
    expect(commands.map((ticket) => {
      const result = ticket.result as { facts: { command: { result: { marker: string } } } };
      return result.facts.command.result.marker;
    })).toEqual(['fixture-A', 'fixture-B', 'fixture-C']);
    expect(extensions.map((extension) => extension.executedCdp)).toEqual([
      ['Runtime.evaluate'],
      ['Runtime.evaluate'],
      ['Runtime.evaluate']
    ]);

    const crossSession = await call(clients[0]!, 'send_cdp_command', {
      workspace_ref: assignments[1]!.workspaceRef,
      target: { kind: 'tab', tab_ref: assignments[1]!.tabRef },
      method: 'Runtime.evaluate',
      params: { expression: '42' }
    });
    expect(crossSession).toMatchObject({
      disposition: 'rejected',
      problem: { code: 'WORKSPACE_NOT_OWNED' }
    });
    expect(extensions[1]!.executedCdp).toEqual(['Runtime.evaluate']);
  });
});
