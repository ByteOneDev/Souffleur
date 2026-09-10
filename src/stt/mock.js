/**
 * Moteur vocal simule.
 *
 * Il rejoue un texte connu en y injectant les erreurs reelles d'une lecture a
 * voix haute captee par un micro : mots avales, substitutions homophones,
 * hesitations, bruit. C'est ce qui rend le spike mesurable sans micro et sans
 * dependre du hasard : la graine fixe le scenario.
 */

/** PRNG deterministe (mulberry32) : meme graine, meme scenario. */
export function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Confusions typiques d'un moteur vocal francais.
const CONFUSIONS = new Map(Object.entries({
  ces: 'ses', ses: 'ces', est: 'et', et: 'est', a: 'as', ou: 'ou',
  son: 'sont', sont: 'son', peu: 'peut', peut: 'peu', ce: 'se', se: 'ce',
  la: 'la', ils: 'il', il: 'ils', tout: 'tous', tous: 'tout',
}));

const FILLERS = ['euh', 'hum', 'donc', 'voila'];

/** Corrompt un mot comme le ferait un moteur vocal (voisinage graphique). */
function corrupt(word, random) {
  const confusion = CONFUSIONS.get(word);
  if (confusion && random() < 0.6) return confusion;
  if (word.length <= 3) return word;
  const at = Math.floor(random() * word.length);
  const mode = random();
  if (mode < 0.4) return word.slice(0, at) + word.slice(at + 1);          // omission
  if (mode < 0.7) return word.slice(0, at) + word[at] + word.slice(at);   // doublement
  return word.slice(0, at) + 'e' + word.slice(at + 1);                    // substitution
}

/**
 * Produit la suite de mots "entendus" pour une lecture du texte.
 *
 * @param {string[]} words mots du texte, dans l'ordre
 * @param {object} [scenario]
 * @param {number} [scenario.seed]
 * @param {number} [scenario.errorRate]   taux de substitution
 * @param {number} [scenario.dropRate]    mots non captes
 * @param {number} [scenario.fillerRate]  hesitations inserees
 * @param {[number,number]} [scenario.skip]   segment saute par le lecteur
 * @param {[number,number]} [scenario.repeat] segment repete par le lecteur
 * @param {{at:number, words:string[]}} [scenario.improvise] aparte hors texte
 * @returns {{spoken:string, expected:number}[]} mot entendu + index de texte attendu
 */
export function simulateReading(words, scenario = {}) {
  const {
    seed = 1, errorRate = 0, dropRate = 0, fillerRate = 0,
    skip = null, repeat = null, improvise = null,
  } = scenario;
  const random = makeRandom(seed);
  const output = [];

  const emit = (word, expected) => {
    if (random() < fillerRate) output.push({ spoken: FILLERS[Math.floor(random() * FILLERS.length)], expected });
    if (random() < dropRate) return;
    output.push({ spoken: random() < errorRate ? corrupt(word, random) : word, expected });
  };

  for (let i = 0; i < words.length; i++) {
    if (skip && i >= skip[0] && i < skip[1]) continue;
    if (improvise && i === improvise.at) {
      for (const extra of improvise.words) output.push({ spoken: extra, expected: i - 1 });
    }
    emit(words[i], i);
    if (repeat && i === repeat[1] - 1) {
      for (let j = repeat[0]; j < repeat[1]; j++) emit(words[j], j);
    }
  }
  return output;
}
