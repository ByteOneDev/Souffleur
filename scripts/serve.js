/**
 * Serveur statique minimal pour essayer l'application.
 *
 *   npm run dev          http://localhost:5173
 *   npm run dev:https    https://<adresse-du-reseau-local>:5173
 *
 * Le mode HTTPS existe pour une raison precise : un navigateur ne donne acces
 * au micro que dans un « contexte securise ». `localhost` en est un, mais pas
 * `http://192.168.x.x`. Sans chiffrement, un telephone du reseau local peut
 * afficher l'application mais jamais l'ecouter — ce qui rend le test du moteur
 * vocal impossible sur Android.
 *
 * Le certificat est auto-signe : le telephone affichera un avertissement, a
 * accepter une fois. Il ne protege rien contre un tiers, il sert uniquement a
 * obtenir le contexte securise qu'exige le navigateur.
 */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, mkdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';

const run = promisify(execFile);
const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 5173);
const HTTPS = process.argv.includes('--https');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.zip': 'application/zip',
};

/** Adresses IPv4 de la machine sur le reseau local. */
function adressesLocales() {
  return Object.values(networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

/**
 * Certificat auto-signe, engendre une seule fois et couvrant les adresses
 * locales : sans elles dans le certificat, le telephone refuse la connexion
 * avant meme de proposer l'avertissement.
 */
async function certificat() {
  const dossier = join(ROOT, '.certs');
  const cle = join(dossier, 'dev-key.pem');
  const cert = join(dossier, 'dev-cert.pem');
  try {
    await access(cle);
    await access(cert);
  } catch {
    await mkdir(dossier, { recursive: true });
    const noms = ['DNS:localhost', 'IP:127.0.0.1', ...adressesLocales().map((a) => `IP:${a}`)];
    await run('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365',
      '-keyout', cle, '-out', cert,
      '-subj', '/CN=souffleur-dev',
      '-addext', `subjectAltName=${noms.join(',')}`,
    ]);
    console.log(`Certificat engendré pour : ${noms.join(', ')}`);
  }
  return { key: await readFile(cle), cert: await readFile(cert) };
}

async function repondre(request, response) {
  const chemin = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  const fichier = join(ROOT, normalize(chemin === '/' ? '/index.html' : chemin).replace(/^(\.\.[/\\])+/, ''));
  try {
    const corps = await readFile(fichier);
    // Pas d'isolation cross-origin : le build WebAssembly de Vosk n'utilise pas
    // SharedArrayBuffer (verifie), et COEP bloquerait les ressources tierces.
    response.writeHead(200, { 'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream' });
    response.end(corps);
  } catch {
    response.writeHead(404).end('Introuvable');
  }
}

const serveur = HTTPS
  ? createHttpsServer(await certificat(), repondre)
  : createHttpServer(repondre);

serveur.listen(PORT, () => {
  const schema = HTTPS ? 'https' : 'http';
  console.log(`Souffleur : ${schema}://localhost:${PORT}`);
  if (HTTPS) {
    for (const adresse of adressesLocales()) {
      console.log(`  depuis le téléphone : ${schema}://${adresse}:${PORT}/tools/android-check.html`);
    }
    console.log('  (le téléphone affichera un avertissement de certificat : l’accepter une fois)');
  } else if (adressesLocales().length) {
    console.log('  pour tester depuis un téléphone, utilisez « npm run dev:https »');
    console.log('  (le micro est refusé hors contexte sécurisé)');
  }
});
