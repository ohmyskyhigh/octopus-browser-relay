import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const source = 'packages/storage/src/sqlite/migrations';
const destination = 'dist/packages/storage/src/sqlite/migrations';
mkdirSync(destination, { recursive: true });
for (const file of readdirSync(source).filter((candidate) => candidate.endsWith('.sql'))) {
  cpSync(`${source}/${file}`, `${destination}/${file}`);
}
