/**
 * Applique au manifeste Android ce que le gabarit de Capacitor n'y met pas.
 *
 * Le gabarit ne declare que l'acces internet. Deux ajouts sont indispensables,
 * et leur oubli ne produit aucune erreur comprehensible : sans RECORD_AUDIO la
 * WebView refuse le micro en silence, et sans declarer le micro facultatif on
 * exclut inutilement les appareils qui n'en ont pas.
 *
 * Ce script est idempotent : il se relance sans dommage apres une
 * regeneration de la plateforme Android.
 */
import { readFile, writeFile } from 'node:fs/promises';

const MANIFESTE = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url).pathname;

const AJOUTS = `
    <!-- Le micro est le coeur de l'outil : sans cette declaration, la WebView
         refuse getUserMedia sans message d'erreur exploitable. -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <!-- Non requis a l'installation : sans micro l'application reste utilisable
         en defilement manuel, il n'y a pas de raison d'exclure un appareil. -->
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
`;

const contenu = await readFile(MANIFESTE, 'utf8');
if (contenu.includes('RECORD_AUDIO')) {
  console.log('manifeste Android : déjà à jour');
} else {
  const cible = '    <uses-permission android:name="android.permission.INTERNET" />';
  if (!contenu.includes(cible)) throw new Error('manifeste inattendu : ajout impossible');
  await writeFile(MANIFESTE, contenu.replace(cible, cible + '\n' + AJOUTS));
  console.log('manifeste Android : micro déclaré');
}
