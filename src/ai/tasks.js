/**
 * Les demandes adressees au modele.
 *
 * Chaque tache est une fonction pure : elle recoit le texte et son contexte, et
 * rend les parametres de la requete. Aucun appel reseau ici — c'est ce qui rend
 * ces taches verifiables sans cle et sans connexion, et c'est la partie qui
 * merite d'etre testee, le reste n'etant qu'un transport.
 */

import { countWords } from '../store/library.js';

/** Le modele doit connaitre la syntaxe d'annotation, sinon il la detruit. */
const SYNTAXE = `Le texte utilise une syntaxe d'annotation qu'il faut préserver et employer :
- **gras** : mot sur lequel l'orateur appuie
- ==surbrillance== : passage à ne pas manquer
- _italique_ : nuance, aparté
- # Titre : repère de structure, non prononcé
- (2s) : pause chronométrée, non prononcée
- [[note de scène]] : consigne de jeu, non prononcée`;

const ROLE = `Tu assistes un orateur qui prépare une prise de parole. Tu écris pour l'oreille, jamais pour l'œil : phrases courtes, une idée par phrase, aucune subordonnée qui oblige à relire. Tu respectes la voix de l'auteur — son vocabulaire, son niveau de langue, ses convictions — et tu ne lisses jamais un propos pour le rendre consensuel. Tu réponds en français.`;

/** Débit de parole retenu pour convertir une durée en nombre de mots. */
export const MOTS_PAR_MINUTE = 140;

/**
 * Les taches disponibles. Chacune produit `{ system, message, remplaceLeTexte }`.
 * `remplaceLeTexte` indique si la reponse est une nouvelle version du discours
 * ou un document separe.
 */
export const TACHES = {
  oral: {
    titre: 'Réécrire pour l’oral',
    description: 'Transforme un texte écrit en texte qui se dit',
    remplaceLeTexte: true,
    construire: (texte) => ({
      system: `${ROLE}\n\n${SYNTAXE}`,
      message: `Réécris ce texte pour qu'il se dise à voix haute.

Casse les phrases longues. Supprime les tournures qui ne passent qu'à l'écrit. Place des pauses (2s) aux endroits où l'orateur doit respirer ou laisser un silence porter. Mets en **gras** les mots à appuyer, et en ==surbrillance== les deux ou trois passages qui portent l'essentiel.

Ne change ni les idées, ni les exemples, ni l'ordre du propos. Ne rallonge pas : à longueur égale ou plus court.

Réponds uniquement par le texte réécrit, sans préambule ni commentaire.

---

${texte}`,
    }),
  },

  duree: {
    titre: 'Ajuster à une durée',
    description: 'Allonge ou raccourcit pour tenir dans le temps imparti',
    remplaceLeTexte: true,
    construire: (texte, { minutes }) => {
      const actuel = countWords(texte);
      const vise = Math.round(minutes * MOTS_PAR_MINUTE);
      const sens = vise < actuel ? 'raccourcir' : 'développer';
      const consigne = vise < actuel
        ? `Coupe ce qui est redondant, les exemples secondaires et les précautions oratoires. Garde intacts l'ouverture, la chute et les passages en ==surbrillance==.`
        : `Développe en ajoutant de la matière : un exemple concret, une objection traitée, une précision utile. N'ajoute ni remplissage ni répétition.`;
      return {
        system: `${ROLE}\n\n${SYNTAXE}`,
        message: `Ce discours fait ${actuel} mots. Il doit en faire environ ${vise}, pour tenir en ${minutes} minutes à un débit de ${MOTS_PAR_MINUTE} mots par minute. Il faut donc le ${sens}.

${consigne}

Conserve la voix de l'auteur et les annotations existantes.

Réponds uniquement par le texte ajusté, sans préambule ni commentaire.

---

${texte}`,
      };
    },
  },

  fiches: {
    titre: 'Fiches de secours',
    description: 'Les repères pour retrouver le fil si on le perd',
    remplaceLeTexte: false,
    construire: (texte) => ({
      system: ROLE,
      message: `Produis la fiche de secours de ce discours : ce que l'orateur regardera s'il perd le fil en pleine intervention.

Une ligne par idée, dans l'ordre. Chaque ligne commence par les trois ou quatre mots exacts qui ouvrent le passage, puis, après un tiret, l'idée en cinq mots maximum. Rien d'autre : ni titre, ni introduction, ni conclusion.

Ce document doit se parcourir d'un coup d'œil, debout, sous tension.

---

${texte}`,
    }),
  },

  questions: {
    titre: 'Questions du public',
    description: 'Ce qu’on va vous demander, et par où ça fait mal',
    remplaceLeTexte: false,
    construire: (texte) => ({
      system: `${ROLE}\n\nTu ne ménages pas l'auteur : une objection molle ne lui sert à rien.`,
      message: `Anticipe les questions que ce discours va provoquer.

Donne les six plus probables, la plus redoutable en premier. Pour chacune : la question telle qu'elle sera posée, puis en deux ou trois phrases ce qui la rend difficile et sur quoi appuyer pour y répondre.

Inclus au moins deux objections de fond — celles qui contestent la thèse, pas celles qui demandent une précision. Si le discours a un angle mort, nomme-le.

---

${texte}`,
    }),
  },
};

/**
 * Prepare la requete d'une tache.
 * @param {keyof TACHES} nom
 * @param {string} texte
 * @param {object} [contexte]
 */
export function preparer(nom, texte, contexte = {}) {
  const tache = TACHES[nom];
  if (!tache) throw new Error(`Tâche inconnue : ${nom}`);
  if (!texte?.trim()) throw new Error('Le texte est vide.');
  return { ...tache.construire(texte, contexte), tache: nom, remplaceLeTexte: tache.remplaceLeTexte };
}
