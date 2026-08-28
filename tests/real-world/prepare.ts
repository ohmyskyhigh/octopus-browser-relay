import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { SqliteRelayStore } from '../../packages/storage/src/index.js';
import { RealWorldRunManifestSchema, type RealWorldRunManifest } from './run-manifest.schema.js';

const arg = (name: string, fallback?: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

const runId = arg('run-id', `rw-${new Date().toISOString().replace(/[:.]/g, '-')}`)!;
const root = resolve('artifacts', 'real-world', runId);
const manifestPath = resolve(root, 'manifest.json');
if (existsSync(manifestPath)) {
  const existing = RealWorldRunManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
  console.log(JSON.stringify({ status: 'READY', runId: existing.runId, manifestPath }, null, 2));
  process.exit(0);
}

const dbPath = resolve(arg('db', '.relay-data/relay.sqlite')!);
const extensionPath = resolve('apps/extension/dist');
if (!existsSync(resolve(extensionPath, 'manifest.json'))) throw new Error('Extension build is missing. Run pnpm build:extension first.');
mkdirSync(root, { recursive: true });
mkdirSync(resolve(root, 'credentials'), { recursive: true });
mkdirSync(resolve(root, 'role-cards'), { recursive: true });
mkdirSync(resolve(root, 'ready'), { recursive: true });
mkdirSync(resolve(root, 'instructions'), { recursive: true });
mkdirSync(resolve(root, 'results'), { recursive: true });

const store = new SqliteRelayStore(dbPath);
const roles = ['A', 'B', 'C'] as const;
const agents: RealWorldRunManifest['agents'] = roles.map((role) => {
  const token = randomBytes(32).toString('base64url');
  const created = store.createAgent(`real-world-agent-${role}-${runId}`, ['targets:read', 'sessions:write', 'browser:read', 'browser:write'], token);
  const tokenFile = resolve(root, 'credentials', `agent-${role}.token`);
  writeFileSync(tokenFile, token, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  const roleCard = resolve(root, 'role-cards', `agent-${role}.md`);
  writeFileSync(roleCard, `# Real-World Relay Agent ${role}\n\nRun this command from the relay workspace and leave it running:\n\n\`\`\`powershell\npnpm tsx tests/real-world/agent-role.ts --run-id=${runId} --role=${role}\n\`\`\`\n\nDo not open or paste the token file. Report READY after the command says it is waiting.\n`);
  return { role, principalId: created.principal.principalId, principalLabel: `real-world-agent-${role}`, tokenFile, roleCard };
});

const targetLetters = ['A', 'B', 'C'] as const;
const targets = targetLetters.map((letter) => ({
  alias: `rw-profile-${letter.toLowerCase()}`,
  marker: `fixture-${letter}`,
  fixtureUrl: `http://127.0.0.1:7340/fixture/${letter}`
}));
const pairingSteps: string[] = [
  '# U1 Browser Setup',
  '',
  `Load unpacked extension from: ${extensionPath}`,
  '',
  'On Chrome 142+, reload the unpacked extension after a rebuild, open its options page, click **Save and connect**, and allow the local-network prompt.',
  ''
];
for (const target of targets) {
  const existing = store.getTargetByAlias(target.alias);
  if (existing) {
    pairingSteps.push(`- ${target.alias}: already paired; open ${target.fixtureUrl}`);
  } else {
    const code = store.createPairingCode(target.alias, new Date(Date.now() + 4 * 60 * 60_000).toISOString());
    pairingSteps.push(`- ${target.alias}: open ${target.fixtureUrl}; enter pairing code ${code}`);
  }
}
pairingSteps.push('', 'Keep all three Chrome profile windows open. Do not paste these codes into chat.');
writeFileSync(resolve(root, 'U1-browser-setup.md'), pairingSteps.join('\n'), { encoding: 'utf8', mode: 0o600 });
store.close();

const manifest: RealWorldRunManifest = {
  runId,
  createdAt: new Date().toISOString(),
  brokerVersion: '0.2.0',
  extensionVersion: '0.1.0',
  protocolVersion: 1,
  dbPath,
  adminTokenFile: resolve(dirname(dbPath), 'admin-token.txt'),
  mcpUrl: 'http://127.0.0.1:7331/mcp',
  relayUrl: 'ws://127.0.0.1:7332/relay',
  fixtureBaseUrl: 'http://127.0.0.1:7340',
  extensionPath,
  targets,
  agents
};
const temporary = `${manifestPath}.tmp`;
writeFileSync(temporary, JSON.stringify(manifest, null, 2));
renameSync(temporary, manifestPath);
console.log(JSON.stringify({ status: 'ACTION_REQUIRED', checkpoint: 'U1', runId, manifestPath, instructions: resolve(root, 'U1-browser-setup.md') }, null, 2));
