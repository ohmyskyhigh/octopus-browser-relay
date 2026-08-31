import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SqliteRelayStore } from '../../apps/broker/src/storage/index.js';
import { RealWorldRunManifestSchema } from './run-manifest.schema.js';
import { verifyRealWorldRun } from './trace-verifier.js';

const runId = process.argv.find((value) => value.startsWith('--run-id='))?.slice('--run-id='.length);
if (!runId) throw new Error('--run-id is required.');
const root = resolve('artifacts', 'real-world', runId);
const manifest = RealWorldRunManifestSchema.parse(JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')));
const store = new SqliteRelayStore(manifest.dbPath);
const commands = store.listCommandsByRunId(runId);
const events = store.listTrace(runId);
const report = verifyRealWorldRun(manifest, commands, events);
store.close();
mkdirSync(resolve(root, 'report'), { recursive: true });
writeFileSync(resolve(root, 'report', 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(resolve(root, 'report', 'report.md'), [
  `# Browser Relay Real-World Report`,
  ``,
  `- Run: ${report.runId}`,
  `- Status: ${report.status}`,
  `- Commands: ${report.commandCount}`,
  `- Successful: ${report.successfulCommands}`,
  `- Terminal: ${report.terminalCommands}`,
  `- ACK latency p95: ${report.ackLatencyP95Ms ?? 'n/a'} ms`,
  ``,
  `## Findings`,
  ``,
  ...(report.findings.length ? report.findings.map((finding) => `- ${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}${finding.commandId ? ` (${finding.commandId})` : ''}`) : ['- None'])
].join('\n'));
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
