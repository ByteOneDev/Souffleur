/**
 * Assemble l'application dans `www/`.
 *
 * Capacitor et Electron veulent un dossier autonome : une page d'entree et
 * tout ce dont elle a besoin, sans remonter dans l'arborescence du depot.
 */
import { cp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'www');
const CONTENU = ['index.html', 'src', 'vendor', 'tools', 'models'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const nom of CONTENU) {
  try {
    await cp(join(ROOT, nom), join(OUT, nom), { recursive: true });
  } catch (error) {
    // `models/` est absent tant que l'utilisateur n'a pas telecharge le modele
    // vocal : ce n'est pas une erreur de construction.
    if (nom !== 'models') throw error;
  }
}
console.log('www/ construit');
