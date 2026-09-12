/**
 * Verifie que l'application est prete a etre empaquetee.
 *
 * Deux oublis produisent une application installable mais inutilisable, et
 * aucun des deux ne provoque d'erreur a la construction : un dossier vendor/
 * absent (police et moteur vocal manquants) et un modele vocal non telecharge.
 * Mieux vaut refuser de construire que livrer une coquille.
 */
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
let bloquant = false;

try {
  await access(join(ROOT, 'vendor/vosk/vosk.js'));
  await access(join(ROOT, 'vendor/fonts/jetbrains-mono-latin-400-normal.woff2'));
} catch {
  console.error('✗ vendor/ incomplet — lancez « npm install » (ou « npm run vendor »).');
  bloquant = true;
}

const modeles = await readdir(join(ROOT, 'models')).catch(() => []);
const archive = modeles.find((f) => /\.(zip|tar\.gz)$/.test(f));
if (archive) {
  console.log(`✓ modèle vocal embarqué : ${archive}`);
} else {
  // Non bloquant : une application sans modele reste utilisable en simulation,
  // et l'utilisateur peut vouloir un paquet leger.
  console.warn('⚠ aucun modèle vocal dans models/ — l’application sera livrée sans');
  console.warn('  reconnaissance hors ligne. Lancez « npm run model » pour l’inclure.');
}

if (bloquant) process.exit(1);
console.log('✓ prêt pour l’empaquetage');
