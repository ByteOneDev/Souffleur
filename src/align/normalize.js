/**
 * Normalisation du francais pour l'alignement texte <-> parole.
 *
 * L'objectif n'est pas de produire du francais correct, mais de ramener le
 * texte ecrit et la sortie du moteur vocal vers une forme commune : sans
 * accents, sans ponctuation, sans casse, et avec les nombres ecrits en toutes
 * lettres (le texte contient "2025", le lecteur dit "deux mille vingt cinq").
 */

const ACCENTS = { a: 'àáâãäå', c: 'ç', e: 'èéêë', i: 'ìíîï', n: 'ñ', o: 'òóôõö', u: 'ùúûü', y: 'ýÿ' };

const ACCENT_MAP = (() => {
  const map = new Map();
  for (const [plain, accented] of Object.entries(ACCENTS)) {
    for (const ch of accented) map.set(ch, plain);
  }
  map.set('æ', 'ae');
  map.set('œ', 'oe');
  return map;
})();

export function stripAccents(input) {
  let out = '';
  for (const ch of input) out += ACCENT_MAP.get(ch) ?? ch;
  return out;
}

const UNITS = ['zero', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix sept', 'dix huit', 'dix neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre vingt', 'quatre vingt'];

/** Convertit un entier 0..999 en mots francais (forme parlee, sans traits d'union). */
function belowThousand(n) {
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rest = n % 10;
    // 70-79 et 90-99 se disent "soixante dix" / "quatre vingt dix"
    if (tens === 7 || tens === 9) return `${TENS[tens]} ${UNITS[10 + rest]}`;
    if (rest === 0) return TENS[tens];
    if (rest === 1 && tens !== 8) return `${TENS[tens]} et un`;
    return `${TENS[tens]} ${UNITS[rest]}`;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`;
  return rest === 0 ? head : `${head} ${belowThousand(rest)}`;
}

/** Convertit un entier positif en mots francais. Couvre jusqu'au milliard. */
export function numberToFrenchWords(value) {
  let n = Math.trunc(Math.abs(value));
  if (n === 0) return 'zero';
  const parts = [];
  const billions = Math.floor(n / 1_000_000_000);
  n %= 1_000_000_000;
  const millions = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;

  if (billions) parts.push(`${belowThousand(billions)} milliard${billions > 1 ? 's' : ''}`);
  if (millions) parts.push(`${belowThousand(millions)} million${millions > 1 ? 's' : ''}`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${belowThousand(thousands)} mille`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

const SYMBOLS = new Map([
  ['%', ' pour cent '],
  ['€', ' euros '],
  ['$', ' dollars '],
  ['&', ' et '],
  ['+', ' plus '],
  ['=', ' egal '],
  ['°', ' degres '],
]);

/**
 * Developpe les symboles et les nombres d'une chaine brute.
 * Retourne une chaine de meme "sens" mais prononcable mot a mot.
 */
export function expandSymbols(input) {
  let out = '';
  for (const ch of input) out += SYMBOLS.get(ch) ?? ch;
  return out;
}

/**
 * Normalise un mot isole : minuscules, sans accents, sans ponctuation.
 * Un nombre est developpe en plusieurs mots, d'ou le retour sous forme de liste.
 */
export function normalizeWord(word) {
  const base = stripAccents(word.toLowerCase());
  if (/^\d+$/.test(base)) return numberToFrenchWords(Number(base)).split(' ');
  // Ordinaux courants : 1er, 2e, 3eme...
  const ordinal = base.match(/^(\d+)(er|ere|e|eme|emes|ers|es)$/);
  if (ordinal) {
    const n = Number(ordinal[1]);
    if (n === 1) return ['premier'];
    const words = numberToFrenchWords(n).split(' ');
    words[words.length - 1] += 'ieme';
    return words;
  }
  const cleaned = base.replace(/[^a-z0-9]/g, '');
  return cleaned ? [cleaned] : [];
}
