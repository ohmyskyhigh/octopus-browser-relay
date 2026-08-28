import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RealWorldRunManifestSchema } from './run-manifest.schema.js';

const arg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};
const runId = arg('run-id');
if (!runId) throw new Error('--run-id is required.');
const root = resolve('artifacts', 'real-world', runId);
const manifest = RealWorldRunManifestSchema.parse(JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')));
const roles = ['A', 'B', 'C'] as const;
const revisions = new Map(roles.map((role) => [role, 0]));

await waitFor(() => roles.every((role) => existsSync(resolve(root, 'ready', `${role}.json`))), 120_000, 'three bound agent roles to become ready');

const instruct = (role: typeof roles[number], scenario: string, actions: unknown[], stop = false): number => {
  const revision = (revisions.get(role) ?? 0) + 1;
  revisions.set(role, revision);
  atomicWrite(resolve(root, 'instructions', `${role}.json`), { revision, scenario, actions, stop });
  return revision;
};
const waitResult = async (role: typeof roles[number], revision: number): Promise<Record<string, unknown>> => {
  const path = resolve(root, 'results', `${role}-${revision}.json`);
  await waitFor(() => existsSync(path), 180_000, `${role} revision ${revision}`);
  const result = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  if (result.status !== 'PASS') throw new Error(`${role} ${String(result.scenario)} failed: ${String(result.error)}`);
  return result;
};

const rw1 = manifest.targets.map((target, index) => {
  const role = roles[index]!;
  return [role, instruct(role, 'RW-1 parallel dedicated bindings', [{ type: 'dispatch', operation: 'snapshot', parameters: {}, idempotencyKey: `${runId}-rw1-${role}` }])] as const;
});
await Promise.all(rw1.map(([role, revision]) => waitResult(role, revision)));

const rw2 = roles.map((role) => [role, instruct(role, 'RW-2 durable serialization', Array.from({ length: 3 }, (_, index) => ({
  type: 'dispatch', operation: index % 2 === 0 ? 'snapshot' : 'list_tabs', parameters: {}, idempotencyKey: `${runId}-rw2-${role}-${index}`
})))] as const);
await Promise.all(rw2.map(([role, revision]) => waitResult(role, revision)));

const acquireRevision = instruct('A', 'RW-3 bound lease lifecycle', [
  { type: 'acquire', sessionKey: 'rw3', ttlMs: 60_000 },
  { type: 'dispatch', sessionKey: 'rw3', operation: 'snapshot', parameters: {}, idempotencyKey: `${runId}-rw3-A` },
  { type: 'release', sessionKey: 'rw3' }
]);
await waitResult('A', acquireRevision);

const rw4 = roles.map((role, roleIndex) => {
  const actions = Array.from({ length: 6 }, (_, actionIndex) => {
    return { type: 'dispatch', operation: actionIndex % 2 === 0 ? 'snapshot' : 'list_tabs', parameters: {}, idempotencyKey: `${runId}-rw4-${role}-${roleIndex}-${actionIndex}` };
  });
  return [role, instruct(role, 'RW-4 parallel dedicated load', actions)] as const;
});
await Promise.all(rw4.map(([role, revision]) => waitResult(role, revision)));

const stopResults = roles.map((role) => [role, instruct(role, 'complete', [], true)] as const);
await Promise.all(stopResults.map(([role, revision]) => waitResult(role, revision)));
console.log(JSON.stringify({ status: 'PASS', runId, scenarios: ['RW-1', 'RW-2', 'RW-3', 'RW-4'] }, null, 2));

async function waitFor(condition: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}.`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
}

function atomicWrite(path: string, value: unknown): void {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2));
  renameSync(temporary, path);
}
