import { resolve } from 'node:path';
import { SqliteRelayStore } from '../apps/broker/src/storage/index.js';

interface PairingArguments {
  nickname: string;
  expiresMinutes: number;
  databasePath: string;
}

const readValue = (arguments_: string[], name: string): string | undefined => {
  const index = arguments_.indexOf(name);
  return index < 0 ? undefined : arguments_[index + 1];
};

function parseArguments(arguments_: string[]): PairingArguments {
  const nickname = readValue(arguments_, '--nickname')?.trim();
  if (!nickname || nickname.length > 64) {
    throw new Error('Relay-v1 migration only. Usage: pnpm pair:legacy --nickname <profile-name> [--expires-minutes 10] [--db <relay.sqlite>]');
  }
  const expiresMinutes = Number(readValue(arguments_, '--expires-minutes') ?? '10');
  if (!Number.isInteger(expiresMinutes) || expiresMinutes < 1 || expiresMinutes > 1_440) {
    throw new Error('--expires-minutes must be an integer between 1 and 1440.');
  }
  const databasePath = resolve(readValue(arguments_, '--db') ?? process.env.RELAY_DB_PATH ?? '.relay-data/relay.sqlite');
  return { nickname, expiresMinutes, databasePath };
}

const arguments_ = parseArguments(process.argv.slice(2));
const store = new SqliteRelayStore(arguments_.databasePath);
try {
  const expiresAt = new Date(Date.now() + arguments_.expiresMinutes * 60_000).toISOString();
  const pairingCode = store.createPairingCode(arguments_.nickname, expiresAt);
  store.audit('target.pairing_code_created', {
    targetAlias: arguments_.nickname,
    expiresAt,
    source: 'local_cli'
  });
  process.stdout.write(`${JSON.stringify({
    endpoint_nickname: arguments_.nickname,
    pairing_code: pairingCode,
    expires_at: expiresAt,
    database_path: arguments_.databasePath
  }, null, 2)}\n`);
} finally {
  store.close();
}
