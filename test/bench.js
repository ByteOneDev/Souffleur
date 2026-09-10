/**
 * Mesure la qualite de l'alignement, scenario par scenario.
 * Les tests disent "ca passe" ; le bench dit "de combien".
 */
import { tokenize } from '../src/align/tokenize.js';
import { Aligner } from '../src/align/aligner.js';
import { simulateReading } from '../src/stt/mock.js';
import { SPEECH } from './fixtures.js';

const tokens = tokenize(SPEECH);
const words = tokens.map((t) => t.norm);

function measure(scenario, options) {
  const drifts = [];
  let finals = 0;
  const seeds = [1, 2, 3, 5, 7, 11, 13, 17, 19, 23];
  for (const seed of seeds) {
    const aligner = new Aligner(tokens, options);
    let clock = 0;
    for (const { spoken, expected } of simulateReading(words, { ...scenario, seed })) {
      aligner.push(spoken, (clock += 400));
      if (aligner.cursor >= 0) drifts.push(Math.abs(aligner.cursor - expected));
    }
    finals += aligner.cursor >= tokens.length - 5 ? 1 : 0;
  }
  drifts.sort((a, b) => a - b);
  const pct = (p) => drifts[Math.min(drifts.length - 1, Math.floor(drifts.length * p))];
  return {
    median: pct(0.5),
    p90: pct(0.9),
    p99: pct(0.99),
    max: drifts[drifts.length - 1],
    within1: (drifts.filter((d) => d <= 1).length / drifts.length),
    within3: (drifts.filter((d) => d <= 3).length / drifts.length),
    finished: finals / seeds.length,
  };
}

const SCENARIOS = {
  'lecture parfaite': {},
  'erreurs 10%': { errorRate: 0.1 },
  'erreurs 25%': { errorRate: 0.25 },
  'erreurs 40%': { errorRate: 0.4 },
  'mots perdus 20%': { dropRate: 0.2 },
  'mots perdus 35%': { dropRate: 0.35 },
  'hesitations 15%': { fillerRate: 0.15 },
  'salle calme (realiste)': { errorRate: 0.12, dropRate: 0.08, fillerRate: 0.05 },
  'conditions degradees': { errorRate: 0.3, dropRate: 0.25, fillerRate: 0.15 },
  'saut de paragraphe': { errorRate: 0.1, skip: [40, 75] },
  'repetition de phrase': { errorRate: 0.1, repeat: [30, 40] },
  'aparte 12 mots': { errorRate: 0.1, improvise: { at: 60, words: 'et la je vais vous raconter une anecdote qui date de l an dernier'.split(' ') } },
};

const pad = (s, n) => String(s).padEnd(n);
const pc = (v) => `${(v * 100).toFixed(1)}%`.padStart(6);

console.log(`Texte de reference : ${tokens.length} mots\n`);
console.log(pad('scenario', 26), pad('median', 8), pad('p90', 6), pad('p99', 6), pad('max', 6), pad('<=1 mot', 8), pad('<=3 mots', 9), 'termine');
console.log('-'.repeat(90));
for (const [name, scenario] of Object.entries(SCENARIOS)) {
  const m = measure(scenario);
  console.log(pad(name, 26), pad(m.median, 8), pad(m.p90, 6), pad(m.p99, 6), pad(m.max, 6), pc(m.within1), ' ', pc(m.within3), ' ', pc(m.finished));
}
