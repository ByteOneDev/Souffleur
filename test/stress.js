/**
 * Recherche du point de rupture.
 *
 * Deux risques que le bench nominal ne couvre pas :
 *  1. un texte REPETITIF (refrain, anaphore, litanie) ou plusieurs passages
 *     se ressemblent : l'alignement local peut se fixer au mauvais endroit ;
 *  2. un texte LONG : cout de calcul et ambiguite croissante.
 */
import { tokenize } from '../src/align/tokenize.js';
import { Aligner } from '../src/align/aligner.js';
import { simulateReading } from '../src/stt/mock.js';

const REPETITIF = `
Je vous le dis, la liberté est un combat. Je vous le dis, la liberté est un devoir.
Je vous le dis, la liberté est une exigence. Nous devons agir, nous devons agir vite,
nous devons agir ensemble. Ils ont dit que c'était impossible. Ils ont dit que c'était
trop tôt. Ils ont dit que c'était trop tard. Je vous le dis, la liberté est un combat
qui ne finit jamais, et nous devons agir maintenant, tous ensemble, sans attendre.
`.repeat(3);

function measure(text, scenario) {
  const tokens = tokenize(text);
  const words = tokens.map((t) => t.norm);
  const drifts = [];
  const started = performance.now();
  let pushes = 0;
  for (const seed of [1, 2, 3, 5, 7]) {
    const aligner = new Aligner(tokens);
    let clock = 0;
    for (const { spoken, expected } of simulateReading(words, { ...scenario, seed })) {
      aligner.push(spoken, (clock += 400));
      pushes++;
      if (aligner.cursor >= 0) drifts.push(Math.abs(aligner.cursor - expected));
    }
  }
  const elapsed = performance.now() - started;
  drifts.sort((a, b) => a - b);
  const pct = (p) => drifts[Math.min(drifts.length - 1, Math.floor(drifts.length * p))];
  return {
    mots: tokens.length,
    median: pct(0.5), p90: pct(0.9), max: drifts[drifts.length - 1],
    within3: (drifts.filter((d) => d <= 3).length / drifts.length * 100).toFixed(1) + '%',
    'us/mot': (elapsed * 1000 / pushes).toFixed(0),
  };
}

console.log('--- Texte tres repetitif (anaphores, refrains) ---');
console.table({
  'parfait': measure(REPETITIF, {}),
  'erreurs 20%': measure(REPETITIF, { errorRate: 0.2 }),
  'degrade': measure(REPETITIF, { errorRate: 0.3, dropRate: 0.2, fillerRate: 0.1 }),
});

console.log('\n--- Corruption severe sur texte normal ---');
const NORMAL = `Mesdames et messieurs, je voudrais ce soir vous parler d'une chose simple
et pourtant difficile a dire : le courage ordinaire. Celui qui ne fait pas de bruit,
qui ne cherche pas la lumiere, et qui pourtant tient le monde debout jour apres jour.`.repeat(4);
console.table({
  'erreurs 50%': measure(NORMAL, { errorRate: 0.5 }),
  'erreurs 60% + perte 30%': measure(NORMAL, { errorRate: 0.6, dropRate: 0.3 }),
  'perte 50%': measure(NORMAL, { dropRate: 0.5 }),
  'hesitations 40%': measure(NORMAL, { fillerRate: 0.4 }),
});

console.log('\n--- Discours long (charge de calcul) ---');
const LONG = NORMAL.repeat(12);
console.table({ 'texte long': measure(LONG, { errorRate: 0.15, dropRate: 0.1 }) });
