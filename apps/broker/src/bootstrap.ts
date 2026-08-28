import pino, { type Logger } from 'pino';
import { BrokerCore } from '../../../packages/broker-core/src/index.js';
import { ExtensionGateway } from '../../../packages/extension-gateway/src/index.js';
import { McpGateway } from '../../../packages/mcp-gateway/src/index.js';
import { SqliteRelayStore } from '../../../packages/storage/src/index.js';
import type { RelayConfig } from './config.js';

export interface RelayApplication {
  store: SqliteRelayStore;
  broker: BrokerCore;
  extensionGateway: ExtensionGateway;
  mcpGateway: McpGateway;
  adminToken: string;
  logger: Logger;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createRelayApplication(config: RelayConfig): RelayApplication {
  const logger = pino({ level: config.logLevel, redact: ['req.headers.authorization', '*.token', '*.pairingCode', '*.publicKeyJwk'] });
  const store = new SqliteRelayStore(config.dbPath);
  const existingAdmin = store.authenticateAgent(config.adminToken);
  if (!existingAdmin) {
    store.createAgent('Local relay administrator', [
      'broker:admin',
      'targets:read',
      'sessions:write',
      'browser:read',
      'browser:write'
    ], config.adminToken);
  }
  const broker = new BrokerCore(store, {
    heartbeatTimeoutMs: config.heartbeatTimeoutMs,
    errorThreshold: config.errorThreshold
  });
  const extensionGateway = new ExtensionGateway(broker, store, { host: config.host, port: config.wsPort });
  broker.setTransport(extensionGateway);
  const mcpGateway = new McpGateway(broker, store, {
    host: config.host,
    port: config.mcpPort,
    serviceVersion: '0.2.0',
    health: () => ({
      connectedTargets: store.listTargets().filter((target) => broker.stateIndex.connectionEpoch(target.targetId) !== null).length,
      targetCount: store.listTargets().length,
      bindingCount: store.listBindings().length,
      protocolVersion: 1,
      mcpContractVersion: 2
    })
  });
  let sweepTimer: NodeJS.Timeout | null = null;
  return {
    store,
    broker,
    extensionGateway,
    mcpGateway,
    adminToken: config.adminToken,
    logger,
    async start() {
      broker.recover();
      await extensionGateway.start();
      await mcpGateway.start();
      sweepTimer = setInterval(() => {
        broker.sweep();
        extensionGateway.sweepHeartbeat(config.heartbeatTimeoutMs);
      }, Math.min(1_000, Math.max(250, Math.floor(config.heartbeatTimeoutMs / 4))));
      sweepTimer.unref();
      logger.info({ mcp: mcpGateway.address(), relay: extensionGateway.address() }, 'Octopus Browser Relay started');
    },
    async stop() {
      if (sweepTimer) clearInterval(sweepTimer);
      await mcpGateway.stop();
      await extensionGateway.stop();
      store.close();
      logger.info('Octopus Browser Relay stopped');
    }
  };
}
