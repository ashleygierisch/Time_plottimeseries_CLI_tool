import * as esbuild from 'esbuild';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirName = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
// Loopback only. The dev server reads files off disk with no authentication,
// so it has no business being reachable from the rest of the network.
const HOST = '127.0.0.1';
const ROOT_DIR = path.resolve(dirName, '..');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

/** Guards against a request path escaping the directory it is served from. */
function isInside(directory: string, filePath: string): boolean {
  const relative = path.relative(directory, filePath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}


async function start(): Promise<void> {
  const clients: http.ServerResponse[] = [];

  const ctx = await esbuild.context({
    entryPoints: ['src/main.tsx'],
    bundle: true,
    outfile: 'dist/app.js',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    platform: 'browser',
    sourcemap: true,
    plugins: [{
      name: 'reload-plugin',
      setup(build) {
        build.onEnd(() => {
          console.log('Build ended, reloading...');
          clients.forEach(res => res.write('data: update\n\n'));
        });
      },
    }],
  });

  await ctx.watch();

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    let filePath: string;

    if (pathname === '/esbuild') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      clients.push(res);
      return;
    } else if (pathname === '/dist/app.js.map') { // Sourcemap
      filePath = path.resolve(ROOT_DIR, 'dist', 'app.js.map');
    } else if (pathname === '/dist/app.css') { // CSS Bundle
      filePath = path.resolve(ROOT_DIR, 'dist', 'app.css');
    } else {
      filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);
    }

    // Check public if not found in root
    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, pathname);
    }

    if (!isInside(ROOT_DIR, filePath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.csv': 'text/csv',
      '.map': 'application/json',
    };

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      if (ext === '.html') {
        res.end(content.toString('utf-8') + '<script>new EventSource("/esbuild").onmessage = () => location.reload()</script>');
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
