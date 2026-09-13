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
import { dirname, join } from 'node:path';

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
console.log(`vendor/ : ${FICHIERS.length} fichiers, ${(total / 1048576).toFixed(1)} Mo`);
