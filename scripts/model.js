/**
 * Telecharge le modele vocal francais dans `models/`.
 *
 * Ce script existe pour supprimer une classe entiere d'erreurs. Les
 * instructions manuelles demandaient un `cd models` puis un `curl`, ce qui
 * laissait l'utilisateur dans le mauvais dossier pour la suite — et deposait le
 * modele n'importe ou si la commande etait lancee ailleurs que dans le depot.
 *
 * Un script npm s'execute toujours depuis la racine du projet : le modele
 * atterrit au bon endroit quel que soit le dossier courant.
 *
 *   npm run model
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const NOM = process.env.VOSK_MODEL ?? 'vosk-model-small-fr-0.22';
const URL_MODELE = `https://alphacephei.com/vosk/models/${NOM}.zip`;
const DESTINATION = join(ROOT, 'models', `${NOM}.zip`);

/** Une archive valide commence par « PK » (zip) ou 0x1f8b (gzip). */
function formatReconnu(octets) {
  if (octets[0] === 0x50 && octets[1] === 0x4b) return 'zip';
  if (octets[0] === 0x1f && octets[1] === 0x8b) return 'gzip';
  return null;
}

const mo = (octets) => `${(octets / 1048576).toFixed(1)} Mo`;

try {
  const existant = await stat(DESTINATION);
  if (existant.size > 1_000_000) {
    console.log(`Modèle déjà présent : models/${NOM}.zip (${mo(existant.size)})`);
    process.exit(0);
  }
  console.log('Fichier présent mais trop petit : nouveau téléchargement.');
} catch {
  // Absent : c'est le cas normal.
}

console.log(`Téléchargement de ${URL_MODELE}`);
const reponse = await fetch(URL_MODELE, { redirect: 'follow' });
if (!reponse.ok) {
  console.error(`Échec : le serveur a répondu ${reponse.status}.`);
  console.error('Vérifiez votre connexion, ou téléchargez le fichier à la main');
  console.error(`et placez-le dans models/${NOM}.zip`);
  process.exit(1);
}

const attendu = Number(reponse.headers.get('content-length') ?? 0);
if (attendu) console.log(`  taille annoncée : ${mo(attendu)}`);

const morceaux = [];
let recu = 0;
let dernierPourcent = -10;
for await (const morceau of reponse.body) {
  morceaux.push(morceau);
  recu += morceau.length;
  if (attendu) {
    const pourcent = Math.floor((recu / attendu) * 100);
    if (pourcent >= dernierPourcent + 10) {
      dernierPourcent = pourcent;
      console.log(`  ${pourcent} %`);
    }
  }
}

const donnees = Buffer.concat(morceaux);
const format = formatReconnu(donnees);
if (!format) {
  console.error('Le fichier reçu n’est pas une archive : téléchargement interrompu ou page d’erreur.');
  process.exit(1);
}

await mkdir(join(ROOT, 'models'), { recursive: true });
await writeFile(DESTINATION, donnees);
console.log(`Modèle enregistré : models/${NOM}.zip (${mo(donnees.length)}, format ${format})`);
console.log('Lancez maintenant « npm run dev » ou « npm run dev:https ».');
