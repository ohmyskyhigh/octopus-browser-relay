import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SqliteRelayStore } from '../../packages/storage/src/index.js';
import { RealWorldRunManifestSchema } from './run-manifest.schema.js';

const argument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};

const runId = argument('run-id');
if (!runId) throw new Error('--run-id is required');

const workspace = resolve('.');
const runRoot = resolve(workspace, 'artifacts', 'real-world', runId);
const manifest = RealWorldRunManifestSchema.parse(
  JSON.parse(readFileSync(resolve(runRoot, 'manifest.json'), 'utf8'))
);
const outputRoot = resolve(workspace, 'outputs', 'profile-aware-browser-relay-test');
const validityMs = 4 * 60 * 60_000;
const expiresAt = new Date(Date.now() + validityMs).toISOString();
const store = new SqliteRelayStore(manifest.dbPath);

function instructions(extensionPath: string, nativeCompanionPath: string, targetLines: string[]): string {
  return [
    '# U1 Browser Setup',
    '',
    `Load unpacked extension from: ${extensionPath}`,
    `Native companion package: ${nativeCompanionPath}`,
    '',
    'Native companion setup (same path for Chrome and AdsPower):',
    '',
    '1. The native companion has been installed for the current Windows user. If it is ever moved or unregistered, run `install.ps1` from the native companion package.',
    '2. In every Chrome or AdsPower profile, remove the previous Browser Relay extension, then choose **Load unpacked** and select the extension path above.',
    '3. Confirm the extension ID on `chrome://extensions` is `caekiojlchhifdomfghejkbfpmaklafe`.',
    '4. Open the extension options. Keep **Transport** set to **Native companion (recommended)** and Broker URL set to `ws://127.0.0.1:7332/relay`.',
    '5. Enter the one-time code for that profile below, then click **Save and connect**.',
    '6. Expected result: `Status: connected · alias <profile alias> · native`. No AdsPower local-network permission is required for this transport.',
    '7. If the broker reports an expired code, use the newly generated code below and click **Save and connect** again.',
    '',
    ...targetLines,
    '',
    `These one-use codes expire at ${expiresAt}.`,
    'Keep all three Chrome profile windows open. Do not paste these codes into chat.',
    ''
  ].join('\n');
}

try {
  const targetLines = manifest.targets.map((target) => {
    const existing = store.getTargetByAlias(target.alias);
    if (existing) return `- ${target.alias}: already paired; open ${target.fixtureUrl}`;
    const code = store.createPairingCode(target.alias, expiresAt);
    return `- ${target.alias}: open ${target.fixtureUrl}; enter pairing code ${code}`;
  });

  const artifactPath = resolve(runRoot, 'U1-browser-setup.md');
  const outputPath = resolve(outputRoot, 'U1-browser-setup.md');
  writeFileSync(
    artifactPath,
    instructions(manifest.extensionPath, resolve(outputRoot, 'native-companion'), targetLines),
    { encoding: 'utf8', mode: 0o600 }
  );
  writeFileSync(
    outputPath,
    instructions(
      resolve(outputRoot, 'extension-unpacked'),
      resolve(outputRoot, 'native-companion'),
      targetLines
    ),
    { encoding: 'utf8', mode: 0o600 }
  );
  chmodSync(artifactPath, 0o600);
  chmodSync(outputPath, 0o600);
  console.log(JSON.stringify({ status: 'PAIRING_CODES_REFRESHED', runId, expiresAt, instructionFiles: 2 }, null, 2));
} finally {
  store.close();
}
