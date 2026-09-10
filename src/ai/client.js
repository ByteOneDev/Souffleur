/**
 * Appel du modele, via le SDK officiel Anthropic.
 *
 * Le SDK est charge depuis vendor/ : un artefact statique produit une fois a
 * l'installation, ce qui evite d'introduire une etape de compilation dans une
 * application qui n'en a volontairement aucune.
 *
 * Deux choix meritent d'etre explicites :
 *
 * - La reponse est diffusee en continu. Reecrire un discours prend parfois une
 *   minute : mieux vaut voir le texte arriver que fixer un indicateur.
 * - La cle circule depuis le navigateur, ce que le SDK exige de declarer. C'est
 *   assume : chacun fournit la sienne, elle ne quitte pas son appareil, et
 *   aucune cle n'est livree avec l'application. Le prix a payer est qu'elle est
 *   lisible par qui a acces a l'appareil — comme n'importe quel mot de passe
 *   enregistre dans un navigateur.
 */

import { preparer } from './tasks.js';

const MODELE = 'claude-opus-5';
const CHEMIN_SDK = '../../vendor/anthropic/sdk.mjs';

let Anthropic = null;

async function chargerSdk() {
  if (Anthropic) return Anthropic;
  try {
    const module = await import(CHEMIN_SDK);
    Anthropic = module.default;
    return Anthropic;
  } catch (cause) {
    throw new Error("Bibliothèque d'assistance absente — lancez « npm install ».", { cause });
  }
}

/** Message lisible a partir des erreurs typees du SDK. */
function expliquer(erreur, sdk) {
  if (erreur instanceof sdk.AuthenticationError) return 'Clé refusée : vérifiez-la dans les réglages.';
  if (erreur instanceof sdk.PermissionDeniedError) return "Cette clé n'a pas accès à ce modèle.";
  if (erreur instanceof sdk.RateLimitError) return 'Trop de demandes : réessayez dans un instant.';
  if (erreur instanceof sdk.BadRequestError) return `Demande refusée : ${erreur.message}`;
  if (erreur instanceof sdk.APIConnectionError) return 'Aucune connexion au service.';
  if (erreur instanceof sdk.APIError) return `Service indisponible (${erreur.status}).`;
  return erreur?.message ?? 'Échec inattendu.';
}

/**
 * Execute une tache et diffuse le resultat.
 *
 * @param {object} options
 * @param {string} options.cle
 * @param {string} options.tache      nom de la tache (voir tasks.js)
 * @param {string} options.texte
 * @param {object} [options.contexte] parametres de la tache (ex. { minutes })
 * @param {(fragment:string)=>void} [options.surTexte] appele a chaque fragment
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{texte:string, remplaceLeTexte:boolean, usage:object}>}
 */
export async function executer({ cle, tache, texte, contexte, surTexte, signal }) {
  const sdk = await chargerSdk();
  const requete = preparer(tache, texte, contexte);

  const client = new sdk({ apiKey: cle, dangerouslyAllowBrowser: true });

  try {
    const flux = client.messages.stream({
      model: MODELE,
      max_tokens: 32000,
      system: requete.system,
      // Reecrire un discours demande du jugement, pas de la transformation
      // mecanique : la reflexion adaptative ameliore nettement le resultat.
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: requete.message }],
    }, { signal });

    if (surTexte) flux.on('text', (fragment) => surTexte(fragment));

    const message = await flux.finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new Error("Le modèle a décliné cette demande.");
    }

    const resultat = message.content
      .filter((bloc) => bloc.type === 'text')
      .map((bloc) => bloc.text)
      .join('')
      .trim();

    return { texte: resultat, remplaceLeTexte: requete.remplaceLeTexte, usage: message.usage };
  } catch (erreur) {
    if (erreur?.name === 'AbortError') throw erreur;
    throw new Error(expliquer(erreur, sdk), { cause: erreur });
  }
}
