/**
 * Decoupage du texte en jetons alignables.
 *
 * Chaque jeton conserve sa position exacte dans le texte source (start/end) :
 * c'est ce qui permet a l'interface de surligner le mot d'origine, avec sa
 * casse, ses accents et sa ponctuation, alors que l'alignement travaille sur
 * une forme normalisee.
 */

import { normalizeWord, expandSymbols } from './normalize.js';
import { phoneticCode } from './phonetic.js';

// Un "mot" au sens de la lecture : lettres accentuees, chiffres, et le trait
// d'union / l'apostrophe qui seront ensuite eclates en jetons distincts.
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;

/**
 * @param {string} text
 * @returns {{index:number, raw:string, norm:string, phon:string, start:number, end:number}[]}
 */
export function tokenize(text) {
  const tokens = [];
  const source = expandSymbols(text);
  for (const match of source.matchAll(WORD_RE)) {
    const raw = match[0];
    const start = match.index;
    // "aujourd'hui", "vingt-cinq" : un seul mot ecrit, plusieurs mots prononces.
    const pieces = raw.split(/['’\-]/).filter(Boolean);
    let offset = 0;
    for (const piece of pieces) {
      const pieceStart = start + raw.indexOf(piece, offset);
      offset = raw.indexOf(piece, offset) + piece.length;
      for (const norm of normalizeWord(piece)) {
        tokens.push({
          index: tokens.length,
          raw: piece,
          norm,
          phon: phoneticCode(norm),
          start: pieceStart,
          end: pieceStart + piece.length,
        });
      }
    }
  }
  return tokens;
}

/** Meme traitement pour la sortie du moteur vocal (pas de positions a garder). */
export function tokenizeSpoken(text) {
  const words = [];
  for (const match of expandSymbols(String(text)).matchAll(WORD_RE)) {
    for (const piece of match[0].split(/['’\-]/).filter(Boolean)) {
      for (const norm of normalizeWord(piece)) {
        words.push({ norm, phon: phoneticCode(norm) });
      }
    }
  }
  return words;
}
