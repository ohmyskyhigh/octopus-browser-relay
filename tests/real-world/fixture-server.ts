import { createServer } from 'node:http';

export interface FixtureServer {
  port: number;
  close(): Promise<void>;
}

export async function startFixtureServer(port = 7340): Promise<FixtureServer> {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    if (url.pathname === '/health') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    const match = /^\/fixture\/([A-C])$/.exec(url.pathname);
    if (!match) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    const marker = `fixture-${match[1]}`;
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'"
    });
    response.end(`<!doctype html><html><head><title>${marker}</title></head><body><main><h1>${marker}</h1><p data-relay-marker="${marker}">Profile isolation fixture.</p></main></body></html>`);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server has no TCP address.');
  return {
    port: address.port,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const port = Number(process.argv.find((arg) => arg.startsWith('--port='))?.split('=')[1] ?? 7340);
  const fixture = await startFixtureServer(port);
  console.error(`Real-world fixture server listening on http://127.0.0.1:${fixture.port}`);
}
