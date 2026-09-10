/**
 * Codage phonetique approximatif du francais.
 *
 * Pourquoi : un moteur vocal se trompe rarement au hasard. Il confond des mots
 * qui *sonnent* pareil ("ces" / "ses" / "c'est", "vin" / "vingt"). Comparer les
 * codes phonetiques rattrape ces erreurs la ou une comparaison lettre a lettre
 * echoue.
 *
 * Ce n'est pas une transcription IPA : c'est un hash volontairement grossier,
 * concu pour que deux homophones francais donnent la meme chaine.
 */

import { stripAccents } from './normalize.js';

// Applique dans l'ordre : chaque regle suppose que les precedentes sont passees.
const RULES = [
  // Digrammes et trigrammes consonantiques
  [/ph/g, 'f'],
  [/tch/g, 'C'],
  [/sch/g, 'S'],
  [/ch/g, 'S'],
  [/gn/g, 'N'],
  [/qu/g, 'k'],
  [/q/g, 'k'],
  [/gu([eiy])/g, 'g$1'],
  [/ck/g, 'k'],
  [/x/g, 'ks'],
  [/w/g, 'v'],
  [/h/g, ''],

  // Voyelles composees (avant les nasales, sinon "eau" casse "an")
  [/eau/g, 'o'],
  [/au/g, 'o'],
  [/ou/g, 'U'],
  [/oi/g, 'wa'],
  [/e[iy]/g, 'E'],
  [/ai/g, 'E'],
  [/eu/g, '2'],
  [/oeu/g, '2'],

  // Nasales : uniquement si non suivies d'une voyelle ou d'un n/m redouble
  [/([aeo])[nm](?![aeiouy2UEnm])/g, '$1~'],
  [/a~/g, '@'],
  [/e~/g, '@'],
  [/o~/g, 'O'],
  [/([iy])[nm](?![aeiouy2UEnm])/g, '5'],
  [/u[nm](?![aeiouy2UEnm])/g, '5'],
  [/E[nm](?![aeiouy2UEnm])/g, '5'],

  // Consonnes dependant du contexte
  [/c([eiy5E])/g, 's$1'],
  [/c/g, 'k'],
  [/g([eiy5E])/g, 'j$1'],
  [/([aeiouy2UEO@5])s([aeiouy2UEO@5])/g, '$1z$2'],
  [/ti([oO])n/g, 'si$1n'],
];

// Consonnes muettes en fin de mot francais (les "t" de "chat", "s" du pluriel...)
const FINAL_SILENT = /[tdspzxg]+$/;

/**
 * Retourne le code phonetique d'un mot deja normalise (minuscule, sans accent).
 * Deux homophones doivent produire la meme chaine.
 */
export function phoneticCode(word) {
  let s = stripAccents(String(word).toLowerCase()).replace(/[^a-z]/g, '');
  if (!s) return '';
  for (const [pattern, replacement] of RULES) s = s.replace(pattern, replacement);
  s = s.replace(/(.)\1+/g, '$1');          // doubles consonnes : "elle" -> "ele"
  s = s.replace(/e$/, '');                  // e muet final
  if (s.length > 1) s = s.replace(FINAL_SILENT, ''); // consonnes finales muettes
  s = s.replace(/r$/, 'r');
  return s || stripAccents(word.toLowerCase()).slice(0, 1);
}
