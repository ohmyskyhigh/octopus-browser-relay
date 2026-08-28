import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const executable = resolve(process.argv[2] ?? 'work/native-host/relay-native-host.exe');
const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'inherit'] });
const messages: unknown[] = [];
let pending = Buffer.alloc(0);

function frame(value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function fail(message: string): never {
  child.kill();
  throw new Error(message);
}

child.stdout.on('data', (chunk: Buffer) => {
  pending = Buffer.concat([pending, chunk]);
  while (pending.length >= 4) {
    const length = pending.readUInt32LE(0);
    if (pending.length < 4 + length) return;
    messages.push(JSON.parse(pending.subarray(4, 4 + length).toString('utf8')) as unknown);
    pending = pending.subarray(4 + length);
  }
});

child.stdin.write(frame({ nativeControl: { type: 'CONNECT', url: 'ws://127.0.0.1:7332/relay' } }));

const deadline = Date.now() + 8_000;
while (Date.now() < deadline) {
  const ready = messages.find((message) =>
    (message as { nativeControl?: { type?: string } }).nativeControl?.type === 'READY');
  if (ready) break;
  await new Promise((resolveWait) => setTimeout(resolveWait, 25));
}

if (!messages.some((message) =>
  (message as { nativeControl?: { type?: string } }).nativeControl?.type === 'READY')) {
  fail(`Native companion did not become ready: ${JSON.stringify(messages)}`);
}

child.stdin.write(frame({
  protocolVersion: 1,
  messageId: randomUUID(),
  sentAt: new Date().toISOString(),
  type: 'HELLO',
  payload: {}
}));

while (Date.now() < deadline) {
  if (messages.some((message) => (message as { type?: string }).type === 'ERROR')) break;
  await new Promise((resolveWait) => setTimeout(resolveWait, 25));
}

if (!messages.some((message) => (message as { type?: string }).type === 'ERROR')) {
  fail(`Broker response was not relayed back: ${JSON.stringify(messages)}`);
}

child.stdin.end();
console.log(JSON.stringify({ ok: true, checks: ['native-ready', 'extension-to-broker', 'broker-to-extension'] }));
