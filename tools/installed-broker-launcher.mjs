import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const bootstrapRoot = dirname(fileURLToPath(import.meta.url));
const state = JSON.parse(await readFile(resolve(bootstrapRoot, 'current-release.json'), 'utf8'));
if (typeof state.brokerEntry !== 'string') throw new Error('The installed release has no broker entry.');
await import(pathToFileURL(state.brokerEntry).href);
