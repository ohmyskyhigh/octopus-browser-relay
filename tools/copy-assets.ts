import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const source = 'apps/broker/src/storage/sqlite/migrations';
const destination = 'dist/broker/src/storage/sqlite/migrations';
mkdirSync(destination, { recursive: true });
for (const file of readdirSync(source).filter((candidate) => candidate.endsWith('.sql'))) {
  cpSync(`${source}/${file}`, `${destination}/${file}`);
}
