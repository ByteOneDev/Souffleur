/** Distance de Levenshtein, bornee pour eviter le cout sur les mots longs. */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Ratio de similarite 0..1 entre deux chaines. */
export function ratio(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshtein(a, b) / longest;
}

export const MISMATCH = -0.45;

/**
 * Score de similarite entre un jeton du texte et un mot reconnu.
 *
 * Positif = les deux mots sont probablement le meme ; negatif = ils divergent.
 * Les paliers refletent la fiabilite de chaque indice : identite exacte,
 * homophonie, puis ressemblance graphique ou phonetique partielle.
 */
export function wordScore(token, spoken) {
  if (token.norm === spoken.norm) return 1;

  const short = Math.min(token.norm.length, spoken.norm.length) <= 2;
  if (token.phon && token.phon === spoken.phon) return short ? 0.9 : 0.85;
  // Sur les mots tres courts ("de", "le", "et"), toute approximation est du bruit.
  if (short) return MISMATCH;

  const graphic = ratio(token.norm, spoken.norm);
  if (graphic >= 0.75) return 0.4 + (graphic - 0.75) * 1.6;   // 0.40 -> 0.80

  const phonetic = token.phon && spoken.phon ? ratio(token.phon, spoken.phon) : 0;
  if (phonetic >= 0.75) return 0.35 + (phonetic - 0.75) * 1.4; // 0.35 -> 0.70

  return MISMATCH;
}
