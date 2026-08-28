import { describe, expect, it } from 'vitest';
import type { StoredCommand, StoredTraceEvent } from '../../packages/storage/src/index.js';
import type { RealWorldRunManifest } from './run-manifest.schema.js';
import { verifyRealWorldRun } from './trace-verifier.js';

const manifest: RealWorldRunManifest = {
  runId: 'rw-test-0001', createdAt: new Date().toISOString(), brokerVersion: '0.2.0', extensionVersion: '0.1.0', protocolVersion: 1,
  dbPath: 'test.sqlite', adminTokenFile: 'admin-token.txt', mcpUrl: 'http://127.0.0.1:7331/mcp', relayUrl: 'ws://127.0.0.1:7332/relay',
  fixtureBaseUrl: 'http://127.0.0.1:7340', extensionPath: 'apps/extension/dist',
  targets: ['A', 'B', 'C'].map((letter) => ({ alias: `rw-profile-${letter.toLowerCase()}`, marker: `fixture-${letter}`, fixtureUrl: `http://127.0.0.1:7340/fixture/${letter}` })),
  agents: ['A', 'B', 'C'].map((role, index) => ({
    role: role as 'A' | 'B' | 'C',
    principalId: `00000000-0000-4000-8000-00000000000${index}`,
    principalLabel: `agent-${role}`,
    tokenFile: `${role}.token`,
    roleCard: `${role}.md`
  }))
};

const command = {
  commandId: '11111111-1111-4111-8111-111111111111', requestId: 'req', principalId: 'agent-A', runId: manifest.runId,
  bindingRef: `br_${'a'.repeat(32)}`, targetId: 'private', targetAlias: 'rw-profile-a', operation: 'list_tabs', parameters: {}, idempotencyClass: 'read',
  idempotencyKey: null, state: 'SUCCEEDED', decision: { disposition: 'deliver', reasonCode: 'TARGET_READY', evaluatedStatusVersion: 1 },
  deadlineAt: new Date(Date.now() + 1000).toISOString(), deliveredEpoch: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  result: { commandId: '11111111-1111-4111-8111-111111111111', state: 'SUCCEEDED', output: { marker: 'fixture-A' } }
} satisfies StoredCommand;

const events = ['MCP_ACCEPT', 'BINDING_VALIDATED', 'POLICY_DECISION', 'COMMAND_COMMIT', 'WS_SEND', 'EXT_ACK', 'EXT_RESULT', 'MCP_OBSERVED'].map((stage, index) => ({
  runId: manifest.runId, requestId: 'req', commandId: command.commandId, targetAlias: command.targetAlias, principalId: command.principalId,
  bindingRef: command.bindingRef,
  stage: stage as StoredTraceEvent['stage'], connectionEpoch: index >= 3 ? 1 : null, outcomeCode: null,
  observedAt: new Date(Date.now() + index * 10).toISOString()
})) satisfies StoredTraceEvent[];

describe('real-world trace verifier', () => {
  it('passes a complete correlated marker trace', () => {
    expect(verifyRealWorldRun(manifest, [command], events).status).toBe('PASS');
  });

  it('fails missing stages and wrong target markers', () => {
    const wrong = { ...command, result: { ...command.result, output: { marker: 'fixture-B' } } };
    const report = verifyRealWorldRun(manifest, [wrong], events.filter((event) => event.stage !== 'EXT_ACK'));
    expect(report.status).toBe('FAIL');
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(['TRACE_STAGE_MISSING', 'TARGET_MARKER_MISMATCH']));
  });
});
