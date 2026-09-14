/**
 * Moteur d'alignement parole -> texte connu.
 *
 * Le probleme n'est PAS de la dictee : le texte est connu d'avance. On ne
 * cherche pas "qu'a dit l'orateur ?" mais "ou en est-il dans ce texte ?".
 * Cela autorise un moteur vocal mediocre : on compare a un vocabulaire ferme,
 * dans une fenetre de quelques dizaines de mots autour de la position courante.
 *
 * Methode : alignement local de Smith-Waterman entre les derniers mots
 * reconnus et la fenetre de texte, avec penalites de trou asymetriques :
 *  - sauter un mot du TEXTE est peu couteux  (le lecteur avale des mots,
 *    le moteur en perd)
 *  - inserer un mot RECONNU absent du texte est peu couteux aussi
 *    (hesitations, "euh", improvisation, bruit)
 * Ce sont exactement les deux formes d'erreur d'une lecture reelle.
 */

import { tokenizeSpoken } from './tokenize.js';
import { wordScore } from './similarity.js';

const DEFAULTS = {
  bufferSize: 10,       // mots reconnus conserves pour l'appariement
  backWindow: 20,       // marge de recul : c'est le mecanisme de rattrapage
  forwardWindow: 32,    // on peut avancer beaucoup (mots avales, saut de ligne)
  gapText: -0.18,       // le lecteur/moteur a saute un mot du texte
  gapSpoken: -0.30,     // mot entendu absent du texte (hesitation, bruit)
  minScore: 1.15,       // score minimal pour deplacer le curseur
  minConfidence: 0.35,  // score rapporte au maximum theorique
  localityPenalty: 0.035, // preference pour la continuite de lecture
  lostThreshold: 3,     // echecs consecutifs avant recherche globale
};

/**
 * Deux usages, deux reglages — mesures, pas devines (voir test/bench.js).
 *
 * L'arbitrage est dans la taille du tampon : un tampon long apporte du contexte
 * et desambigue les textes repetitifs (anaphores, refrains), mais reagit plus
 * lentement quand l'orateur saute ailleurs. Lire un texte au mot pres et parler
 * a partir de notes ne demandent donc pas les memes valeurs.
 */
export const PROFILES = {
  /** Lecture : le texte est suivi mot a mot. On privilegie la precision. */
  lecture: {
    bufferSize: 12,
    backWindow: 22,
    forwardWindow: 26,
    gapSpoken: -0.35,   // peu d'ecarts attendus hors du texte
    minScore: 1.2,
  },
  /** Discours : l'orateur brode, saute, reformule. On privilegie la reactivite. */
  discours: {
    bufferSize: 8,
    backWindow: 20,
    forwardWindow: 40,
    gapSpoken: -0.22,   // l'improvisation est la norme, pas une anomalie
    gapText: -0.14,     // sauter des mots du texte est attendu
    minScore: 1.05,
    lostThreshold: 2,   // on repart chercher plus vite dans tout le texte
  },
};

/** Reglages d'un profil nomme, completes par les valeurs par defaut. */
export function profileOptions(name, overrides = {}) {
  return { ...DEFAULTS, ...(PROFILES[name] ?? {}), ...overrides };
}

/**
 * Alignement local entre `window` (jetons de texte) et `spoken` (mots reconnus).
 * Retourne le meilleur segment de texte correspondant, ou null.
 */
function localAlign(windowTokens, spoken, opts, anchor) {
  const rows = windowTokens.length;
  const cols = spoken.length;
  if (!rows || !cols) return null;

  // H[i][j] = meilleur score d'un alignement local finissant en (i, j).
  const H = Array.from({ length: rows + 1 }, () => new Float64Array(cols + 1));
  // Direction retenue, pour le retour arriere : 0 stop, 1 diag, 2 haut, 3 gauche.
  const P = Array.from({ length: rows + 1 }, () => new Uint8Array(cols + 1));

  const candidates = [];
  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      const diag = H[i - 1][j - 1] + wordScore(windowTokens[i - 1], spoken[j - 1]);
      const up = H[i - 1][j] + opts.gapText;
      const left = H[i][j - 1] + opts.gapSpoken;
      let best = 0;
      let dir = 0;
      if (diag > best) { best = diag; dir = 1; }
      if (up > best) { best = up; dir = 2; }
      if (left > best) { best = left; dir = 3; }
      H[i][j] = best;
      P[i][j] = dir;
      // Seuls les alignements consommant les DERNIERS mots entendus nous
      // renseignent sur la position actuelle du lecteur.
      if (best > 0 && j >= cols - 1) candidates.push({ i, j, score: best });
    }
  }
  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  let winner = null;
  for (const candidate of candidates.slice(0, 8)) {
    let { i, j } = candidate;
    // Le chemin retenu dit mot par mot ce qui a ete reellement entendu : on
    // garde ces index, car ce sont eux qui distinguent plus tard un mot lu
    // d'un mot enjambe.
    const hits = [];
    while (i > 0 && j > 0 && P[i][j] !== 0) {
      if (P[i][j] === 1) {
        if (wordScore(windowTokens[i - 1], spoken[j - 1]) > 0) hits.push(windowTokens[i - 1].index);
        i--; j--;
      }
      else if (P[i][j] === 2) i--;
      else j--;
    }
    const startIndex = windowTokens[i]?.index ?? windowTokens[0].index;
    // A score egal, on privilegie la lecture continue plutot qu'un saut lointain.
    const adjusted = candidate.score - opts.localityPenalty * Math.abs(startIndex - anchor);
    if (!winner || adjusted > winner.adjusted) {
      winner = {
        adjusted,
        score: candidate.score,
        matched: hits.length,
        hits,
        startIndex,
        endIndex: windowTokens[candidate.i - 1].index,
      };
    }
  }
  return winner;
}

export class Aligner {
  /**
   * @param {ReturnType<import('./tokenize.js').tokenize>} tokens
   * @param {Partial<typeof DEFAULTS> & {profile?: 'lecture'|'discours'}} [options]
   */
  constructor(tokens, options = {}) {
    this.tokens = tokens;
    const { profile, ...rest } = options;
    this.profile = profile ?? null;
    this.opts = profile ? profileOptions(profile, rest) : { ...DEFAULTS, ...rest };
    this.reset();
  }

  reset() {
    /** Index du dernier jeton confirme ; -1 avant le premier mot. */
    this.cursor = -1;
    this.confidence = 0;
    this.lostStreak = 0;
    this.buffer = [];
    this.history = [];
    /** Index des mots du texte reellement entendus depuis le debut. */
    this.heard = new Set();
    /** Compteur de revision : change des que le verdict d'un mot bouge. */
    this.revision = 0;
  }

  /**
   * Change de profil en cours de route, sans perdre la position ni ce qui a
   * deja ete entendu : on ne change que la maniere de suivre, pas l'endroit ou
   * l'on en est.
   */
  setProfile(name, overrides = {}) {
    this.profile = name;
    this.opts = profileOptions(name, overrides);
    if (this.buffer.length > this.opts.bufferSize) {
      this.buffer = this.buffer.slice(-this.opts.bufferSize);
    }
  }

  /** Position de lecture actuelle, bornee au texte. */
  get position() {
    return Math.min(Math.max(this.cursor, -1), this.tokens.length - 1);
  }

  get isLost() {
    return this.lostStreak >= this.opts.lostThreshold;
  }

  get progress() {
    return this.tokens.length ? (this.cursor + 1) / this.tokens.length : 0;
  }

  /**
   * Injecte un fragment reconnu par le moteur vocal.
   * @param {string} chunk texte brut renvoye par le moteur
   * @param {number} [timestamp] horodatage (ms) pour le calcul de debit
   * @returns {{cursor:number, moved:boolean, confidence:number, lost:boolean}}
   */
  push(chunk, timestamp = Date.now()) {
    const words = tokenizeSpoken(chunk);
    if (!words.length) return this.state();

    this.buffer.push(...words);
    if (this.buffer.length > this.opts.bufferSize) {
      this.buffer = this.buffer.slice(-this.opts.bufferSize);
    }
    return this.resolve(timestamp);
  }

  /**
   * Remplace le tampon courant (mode "hypothese partielle" : le moteur revoit
   * sa transcription des derniers mots au lieu de l'etendre).
   */
  replace(chunk, timestamp = Date.now()) {
    const words = tokenizeSpoken(chunk);
    if (!words.length) return this.state();
    this.buffer = words.slice(-this.opts.bufferSize);
    return this.resolve(timestamp);
  }

  resolve(timestamp) {
    const before = this.cursor;
    const anchor = this.cursor + 1;

    let result = this.tryWindow(
      Math.max(0, anchor - this.opts.backWindow),
      Math.min(this.tokens.length, anchor + this.opts.forwardWindow),
      anchor,
    );

    // Rien de coherent localement : le lecteur a peut-etre saute une section,
    // change de paragraphe, ou repris ailleurs. On cherche dans tout le texte.
    if (!result && this.isLost) {
      result = this.tryWindow(0, this.tokens.length, anchor);
    }

    if (result) {
      this.cursor = result.endIndex;
      this.confidence = result.confidence;
      this.lostStreak = 0;
      // Le verdict d'un mot n'est jamais definitif tant qu'il est dans la
      // fenetre : une hypothese partielle corrigee peut le rendre a la lecture.
      for (const index of result.hits) this.heard.add(index);
      this.revision++;
      this.history.push({ index: this.cursor, timestamp });
      if (this.history.length > 200) this.history.shift();
    } else {
      this.lostStreak++;
      this.confidence = Math.max(0, this.confidence - 0.2);
    }
    return { ...this.state(), moved: this.cursor !== before };
  }

  tryWindow(lo, hi, anchor) {
    const windowTokens = this.tokens.slice(lo, hi);
    const best = localAlign(windowTokens, this.buffer, this.opts, anchor);
    if (!best) return null;

    const maxPossible = this.buffer.length;
    const confidence = Math.max(0, Math.min(1, best.score / maxPossible));
    if (best.score < this.opts.minScore || confidence < this.opts.minConfidence) return null;
    // Un seul mot apparie sur tout le tampon, c'est une coincidence, pas une lecture.
    if (best.matched < 2 && this.buffer.length >= 3) return null;
    return { ...best, confidence };
  }

  /**
   * Un mot deja depasse que le moteur n'a jamais entendu : escamote par le
   * lecteur, ou dit de travers. Le mot courant et la suite ne sont pas juges —
   * on ne reproche pas a l'orateur ce qu'il n'a pas encore lu.
   */
  isMissed(index) {
    return index >= 0 && index < this.cursor && !this.heard.has(index);
  }

  state() {
    return {
      cursor: this.cursor,
      confidence: this.confidence,
      lost: this.isLost,
      progress: this.progress,
      moved: false,
    };
  }

  /** Mots par minute observes sur les `seconds` dernieres secondes. */
  wordsPerMinute(seconds = 20, now = Date.now()) {
    const cutoff = now - seconds * 1000;
    const recent = this.history.filter((h) => h.timestamp >= cutoff);
    if (recent.length < 2) return null;
    const span = (recent[recent.length - 1].timestamp - recent[0].timestamp) / 60000;
    const words = recent[recent.length - 1].index - recent[0].index;
    if (span <= 0 || words <= 0) return null;
    return words / span;
  }

  /** Secondes restantes estimees au rythme actuel. */
  remainingSeconds(now = Date.now()) {
    const wpm = this.wordsPerMinute(30, now);
    if (!wpm) return null;
    return ((this.tokens.length - 1 - this.cursor) / wpm) * 60;
  }
}
