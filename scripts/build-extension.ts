import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

const outdir = 'apps/extension/dist';
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: {
    'service-worker': 'apps/extension/src/service-worker.ts',
    options: 'apps/extension/src/options.ts'
  },
  outdir,
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  sourcemap: true,
  minify: false,
  logLevel: 'info'
});

cpSync('apps/extension/manifest.json', `${outdir}/manifest.json`);
cpSync('apps/extension/options.html', `${outdir}/options.html`);
