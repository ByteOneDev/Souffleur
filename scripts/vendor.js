/**
 * Regroupe les ressources tierces dans `vendor/`.
 *
 * L'application se sert directement de fichiers issus de npm (le moteur Vosk,
 * la police). Pointer vers `node_modules` fonctionne en developpement mais ne
 * s'embarque pas : ni Electron ni Capacitor n'emportent l'arborescence npm.
 * Ce script copie le strict necessaire dans un dossier unique, qui devient le
 * seul a livrer.
 */
import { mkdir, copyFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';

const run = promisify(execFile);

const ROOT = new URL('..', import.meta.url).pathname;

const FICHIERS = [
  ['node_modules/vosk-browser/dist/vosk.js', 'vendor/vosk/vosk.js'],
  ...['400-normal', '400-italic', '500-normal', '700-normal'].map((face) => [
    `node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${face}.woff2`,
    `vendor/fonts/jetbrains-mono-latin-${face}.woff2`,
  ]),
];

let total = 0;
for (const [from, to] of FICHIERS) {
  const source = join(ROOT, from);
  const target = join(ROOT, to);
  try {
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    total += (await stat(target)).size;
  } catch (error) {
    console.error(`Ressource manquante : ${from}\n  → lancez « npm install » d'abord.`);
    process.exit(1);
  }
}
// Le SDK Anthropic est concu pour Node ou pour un empaqueteur. L'application,
// elle, n'a volontairement aucune etape de compilation — c'est ce qui permet a
// Electron et Capacitor de servir les memes fichiers. On produit donc ici, une
// fois pour toutes, un artefact statique autonome, exactement comme le moteur
// vocal : l'application reste sans compilation, et le SDK officiel est utilise
// tel quel plutot que reimplemente a la main.
const sdkEntree = join(ROOT, 'node_modules/@anthropic-ai/sdk/index.mjs');
const sdkSortie = join(ROOT, 'vendor/anthropic/sdk.mjs');
try {
  await mkdir(dirname(sdkSortie), { recursive: true });
  await run('npx', ['esbuild', sdkEntree, '--bundle', '--format=esm',
    '--platform=browser', '--target=es2022', '--minify', `--outfile=${sdkSortie}`]);
  const { size } = await stat(sdkSortie);
  total += size;
  console.log(`vendor/anthropic/sdk.mjs : ${(size / 1024).toFixed(0)} Ko`);
} catch (error) {
  console.warn('SDK Anthropic non empaqueté — les fonctions d’assistance seront indisponibles.');
}

console.log(`vendor/ : ${FICHIERS.length + 1} fichiers, ${(total / 1048576).toFixed(1)} Mo`);
