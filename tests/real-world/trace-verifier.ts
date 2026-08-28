import type { StoredCommand, StoredTraceEvent } from '../../packages/storage/src/index.js';
import type { RealWorldRunManifest } from './run-manifest.schema.js';

export interface VerificationFinding {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  commandId?: string;
}

export interface RealWorldReport {
  runId: string;
  status: 'PASS' | 'FAIL' | 'ENVIRONMENT_NOT_READY';
  commandCount: number;
  successfulCommands: number;
  terminalCommands: number;
  ackLatencyP95Ms: number | null;
  findings: VerificationFinding[];
}

const requiredStages = ['MCP_ACCEPT', 'BINDING_VALIDATED', 'POLICY_DECISION', 'COMMAND_COMMIT', 'WS_SEND', 'EXT_ACK', 'EXT_RESULT'] as const;

const percentile = (values: number[], value: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] ?? null;
};

export function verifyRealWorldRun(manifest: RealWorldRunManifest, commands: StoredCommand[], events: StoredTraceEvent[]): RealWorldReport {
  const findings: VerificationFinding[] = [];
  const markerByAlias = new Map(manifest.targets.map((target) => [target.alias, target.marker]));
  const eventsByCommand = new Map<string, StoredTraceEvent[]>();
  for (const event of events) {
    if (!event.commandId) continue;
    const current = eventsByCommand.get(event.commandId) ?? [];
    current.push(event);
    eventsByCommand.set(event.commandId, current);
  }
  const ackLatencies: number[] = [];
  for (const command of commands) {
    const commandEvents = eventsByCommand.get(command.commandId) ?? [];
    if (!command.bindingRef.startsWith('br_')) {
      findings.push({ severity: 'error', code: 'BINDING_REF_MISSING', message: 'Command does not contain a valid broker bindingRef.', commandId: command.commandId });
    }
    if (commandEvents.some((event) => event.bindingRef !== command.bindingRef)) {
      findings.push({ severity: 'error', code: 'BINDING_TRACE_MISMATCH', message: 'Trace bindingRef does not match the durable command.', commandId: command.commandId });
    }
    let previousIndex = -1;
    for (const stage of requiredStages) {
      const index = commandEvents.findIndex((event, eventIndex) => eventIndex > previousIndex && event.stage === stage);
      if (index < 0) {
        findings.push({ severity: 'error', code: 'TRACE_STAGE_MISSING', message: `Missing ordered stage ${stage}.`, commandId: command.commandId });
        break;
      }
      previousIndex = index;
    }
    const resultIndex = commandEvents.findIndex((event) => event.stage === 'EXT_RESULT');
    const observedAfterResult = commandEvents.findIndex((event, index) => index > resultIndex && event.stage === 'MCP_OBSERVED');
    if (resultIndex >= 0 && observedAfterResult < 0) {
      findings.push({ severity: 'error', code: 'RESULT_NOT_OBSERVED', message: 'No MCP observation occurred after the extension result.', commandId: command.commandId });
    }
    const accept = commandEvents.find((event) => event.stage === 'MCP_ACCEPT');
    const ack = commandEvents.find((event) => event.stage === 'EXT_ACK');
    if (accept && ack) ackLatencies.push(Date.parse(ack.observedAt) - Date.parse(accept.observedAt));
    const expectedMarker = markerByAlias.get(command.targetAlias);
    const actualMarker = findMarker(command.result?.output);
    if (expectedMarker && command.state === 'SUCCEEDED' && actualMarker !== expectedMarker) {
      findings.push({ severity: 'error', code: 'TARGET_MARKER_MISMATCH', message: `Expected ${expectedMarker}, received ${String(actualMarker)}.`, commandId: command.commandId });
    }
  }
  const terminalStates = new Set(['SUCCEEDED', 'FAILED', 'REJECTED', 'TIMED_OUT', 'UNKNOWN_OUTCOME']);
  const terminalCommands = commands.filter((command) => terminalStates.has(command.state)).length;
  if (terminalCommands !== commands.length) {
    findings.push({ severity: 'error', code: 'NON_TERMINAL_COMMANDS', message: `${commands.length - terminalCommands} commands did not reach a terminal state.` });
  }
  const serialized = JSON.stringify({ commands, events, findings });
  for (const forbidden of ['token_hash', 'public_key_jwk', 'privateTargetId', 'pairingCode']) {
    if (serialized.includes(forbidden)) findings.push({ severity: 'error', code: 'SENSITIVE_FIELD_LEAK', message: `Report contains forbidden field ${forbidden}.` });
  }
  return {
    runId: manifest.runId,
    status: findings.some((finding) => finding.severity === 'error') ? 'FAIL' : 'PASS',
    commandCount: commands.length,
    successfulCommands: commands.filter((command) => command.state === 'SUCCEEDED').length,
    terminalCommands,
    ackLatencyP95Ms: percentile(ackLatencies, 0.95),
    findings
  };
}

function findMarker(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const object = value as Record<string, unknown>;
  if (typeof object.marker === 'string') return object.marker;
  if (typeof object.title === 'string' && /^fixture-[A-C]$/.test(object.title)) return object.title;
  for (const candidate of [object.document, object.tab]) {
    const marker = findMarker(candidate);
    if (marker) return marker;
  }
  if (Array.isArray(object.tabs)) {
    for (const tab of object.tabs) {
      const marker = findMarker(tab);
      if (marker) return marker;
    }
  }
  return undefined;
}
