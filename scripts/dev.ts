import * as esbuild from 'esbuild';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentType, resolveStaticFile } from './staticFiles.ts';

const dirName = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
// Loopback only. The dev server reads files off disk with no authentication,
// so it has no business being reachable from the rest of the network.
const HOST = '127.0.0.1';
const ROOT_DIR = path.resolve(dirName, '..');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

async function start(): Promise<void> {
  const clients: http.ServerResponse[] = [];

  const ctx = await esbuild.context({
    entryPoints: ['src/main.tsx'],
    bundle: true,
    outfile: 'dist/app.js',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    platform: 'browser',
    sourcemap: true,
    plugins: [
      {
        name: 'reload-plugin',
        setup(build) {
          build.onEnd(() => {
            console.log('Build ended, reloading...');
            clients.forEach(res => res.write('data: update\n\n'));
          });
        },
      },
    ],
  });

  await ctx.watch();

  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '', `http://${req.headers.host}`);

    if (pathname === '/esbuild') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      clients.push(res);
      return;
    }

    // The repository root first, then public/. The dev bundle under dist/ needs
    // no special case: it is already inside the root.
    const resolved = resolveStaticFile(pathname, [ROOT_DIR, PUBLIC_DIR], fs.existsSync);

    if (resolved.kind === 'forbidden') {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (resolved.kind === 'not-found') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const { filePath } = resolved;

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      if (path.extname(filePath) === '.html') {
        res.end(
          content.toString('utf-8') +
            '<script>new EventSource("/esbuild").onmessage = () => location.reload()</script>',
        );
      } else {
        res.end(content);
      }
    });
  });

  server.listen(PORT, HOST, () => console.log(`Listening on http://localhost:${PORT}`));
}

start().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
