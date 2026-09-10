/**
 * Serveur statique minimal pour essayer le spike.
 * Aucune dependance : `npm run dev`, puis http://localhost:5173
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 5173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.gz': 'application/gzip',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
};

createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  const file = join(ROOT, normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, ''));
  try {
    const body = await readFile(file);
    // Pas d'isolation cross-origin : le build WebAssembly de Vosk n'utilise pas
    // SharedArrayBuffer (verifie), et COEP bloquerait les ressources tierces.
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Introuvable');
  }
}).listen(PORT, () => console.log(`Prompteur : http://localhost:${PORT}`));
