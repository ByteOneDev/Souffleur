import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/align/tokenize.js';
import { Aligner } from '../src/align/aligner.js';
import { simulateReading } from '../src/stt/mock.js';
import { SPEECH } from './fixtures.js';

const tokens = tokenize(SPEECH);
const words = tokens.map((t) => t.norm);

/**
 * Rejoue une lecture simulee et mesure la qualite du suivi.
 * `drift` = ecart en mots entre la position affichee et la position reelle.
 */
function run(scenario, options = {}) {
  const aligner = new Aligner(tokens, options);
  const heard = simulateReading(words, scenario);
  const drifts = [];
  let clock = 0;
  for (const { spoken, expected } of heard) {
    clock += 400; // ~150 mots/minute
    aligner.push(spoken, clock);
    if (aligner.cursor >= 0) drifts.push(Math.abs(aligner.cursor - expected));
  }
  drifts.sort((a, b) => a - b);
  return {
    aligner,
    final: aligner.cursor,
    total: tokens.length,
    median: drifts[Math.floor(drifts.length / 2)] ?? Infinity,
    p90: drifts[Math.floor(drifts.length * 0.9)] ?? Infinity,
    within3: drifts.filter((d) => d <= 3).length / drifts.length,
  };
}

test('le texte de reference est substantiel', () => {
  assert.ok(tokens.length > 130, `seulement ${tokens.length} jetons`);
});

test('lecture parfaite : le curseur colle au mot', () => {
  const r = run({ seed: 1 });
  assert.equal(r.median, 0);
  assert.ok(r.within3 > 0.98, `within3=${r.within3}`);
  assert.ok(r.final >= r.total - 3, `fin a ${r.final}/${r.total}`);
});

test('moteur vocal mediocre : 25% de mots errones', () => {
  const r = run({ seed: 7, errorRate: 0.25 });
  assert.ok(r.median <= 1, `median=${r.median}`);
  assert.ok(r.within3 > 0.9, `within3=${r.within3}`);
  assert.ok(r.final >= r.total - 6, `fin a ${r.final}/${r.total}`);
});

test('mots avales par le lecteur ou perdus par le micro', () => {
  const r = run({ seed: 11, dropRate: 0.2, errorRate: 0.1 });
  assert.ok(r.median <= 2, `median=${r.median}`);
  assert.ok(r.within3 > 0.85, `within3=${r.within3}`);
});

test('hesitations et mots parasites hors texte', () => {
  const r = run({ seed: 13, fillerRate: 0.15, errorRate: 0.1 });
  assert.ok(r.median <= 2, `median=${r.median}`);
  assert.ok(r.within3 > 0.85, `within3=${r.within3}`);
});

test('conditions reelles combinees (salle calme, micro proche)', () => {
  const r = run({ seed: 21, errorRate: 0.12, dropRate: 0.08, fillerRate: 0.05 });
  assert.ok(r.median <= 1, `median=${r.median}`);
  assert.ok(r.within3 > 0.92, `within3=${r.within3}`);
  assert.ok(r.final >= r.total - 5, `fin a ${r.final}/${r.total}`);
});

test('le lecteur saute un paragraphe entier : le curseur le rattrape', () => {
  const aligner = new Aligner(tokens);
  const heard = simulateReading(words, { seed: 5, errorRate: 0.1, skip: [40, 75] });
  let clock = 0;
  for (const { spoken } of heard) aligner.push(spoken, (clock += 400));
  assert.ok(aligner.cursor >= tokens.length - 6, `fin a ${aligner.cursor}/${tokens.length}`);
});

test('le lecteur repete une phrase : pas de decrochage', () => {
  const r = run({ seed: 9, errorRate: 0.1, repeat: [30, 40] });
  assert.ok(r.p90 <= 12, `p90=${r.p90}`);
  assert.ok(r.final >= r.total - 5, `fin a ${r.final}/${r.total}`);
});

test('aparte improvise de 12 mots hors script', () => {
  const improvise = { at: 60, words: 'et la je vais vous raconter une anecdote qui date de l an dernier'.split(' ') };
  const r = run({ seed: 17, errorRate: 0.1, improvise });
  assert.ok(r.median <= 3, `median=${r.median}`);
  assert.ok(r.final >= r.total - 5, `fin a ${r.final}/${r.total}`);
});

test('silence puis reprise ailleurs dans le texte', () => {
  const aligner = new Aligner(tokens);
  let clock = 0;
  for (const { spoken } of simulateReading(words.slice(0, 25), { seed: 3 })) {
    aligner.push(spoken, (clock += 400));
  }
  const afterPause = aligner.cursor;
  assert.ok(afterPause >= 20 && afterPause <= 26, `curseur=${afterPause}`);

  // L'orateur reprend 90 mots plus loin, sans transition.
  clock += 20000;
  for (const { spoken } of simulateReading(words.slice(110, 140), { seed: 3 })) {
    aligner.push(spoken, (clock += 400));
  }
  assert.ok(aligner.cursor >= 130 && aligner.cursor <= 145, `reprise a ${aligner.cursor}`);
});

test('bruit pur : le curseur ne part pas au hasard', () => {
  const aligner = new Aligner(tokens);
  let clock = 0;
  for (const { spoken } of simulateReading(words.slice(0, 30), { seed: 2 })) {
    aligner.push(spoken, (clock += 400));
  }
  const before = aligner.cursor;
  for (const noise of 'wxcv qsdf zzz brrr tchak flump grmbl xylo'.split(' ')) {
    aligner.push(noise, (clock += 400));
  }
  assert.ok(Math.abs(aligner.cursor - before) <= 4, `derive de ${aligner.cursor - before} mots sur du bruit`);
  assert.ok(aligner.isLost, 'le moteur devrait se signaler comme perdu');
});

test('debit et temps restant sont estimes', () => {
  const aligner = new Aligner(tokens);
  let clock = 0;
  for (const { spoken } of simulateReading(words.slice(0, 60), { seed: 4 })) {
    aligner.push(spoken, (clock += 400));
  }
  const wpm = aligner.wordsPerMinute(60, clock);
  assert.ok(wpm > 100 && wpm < 200, `wpm=${wpm}`);
  assert.ok(aligner.remainingSeconds(clock) > 0);
});

// --- Profils lecture / discours -------------------------------------------
// Ces deux profils ne sont pas des etiquettes : ils encodent un arbitrage
// mesure entre precision sur texte repetitif et reactivite aux sauts.

import { PROFILES, profileOptions } from '../src/align/aligner.js';

const ANAPHORE = `
Je vous le dis, la liberté est un combat. Je vous le dis, la liberté est un devoir.
Je vous le dis, la liberté est une exigence. Nous devons agir, nous devons agir vite,
nous devons agir ensemble. Ils ont dit que c'était impossible. Ils ont dit que c'était
trop tard. Je vous le dis, la liberté est un combat qui ne finit jamais.
`.repeat(2);

function quality(text, scenario, options) {
  const localTokens = tokenize(text);
  const localWords = localTokens.map((t) => t.norm);
  const drifts = [];
  for (const seed of [1, 2, 3, 5, 7]) {
    const aligner = new Aligner(localTokens, options);
    let clock = 0;
    for (const { spoken, expected } of simulateReading(localWords, { ...scenario, seed })) {
      aligner.push(spoken, (clock += 400));
      if (aligner.cursor >= 0) drifts.push(Math.abs(aligner.cursor - expected));
    }
  }
  return drifts.filter((d) => d <= 3).length / drifts.length;
}

test('les deux profils existent et heritent des valeurs par defaut', () => {
  assert.deepEqual(Object.keys(PROFILES).sort(), ['discours', 'lecture']);
  const options = profileOptions('discours');
  assert.equal(options.bufferSize, PROFILES.discours.bufferSize);
  assert.ok(options.minConfidence > 0, 'les defauts doivent completer le profil');
});

test('profil lecture : meilleur sur un texte a anaphores', () => {
  const lecture = quality(ANAPHORE, { errorRate: 0.15 }, { profile: 'lecture' });
  const discours = quality(ANAPHORE, { errorRate: 0.15 }, { profile: 'discours' });
  assert.ok(lecture > 0.95, `lecture=${lecture}`);
  assert.ok(lecture >= discours, `lecture=${lecture} discours=${discours}`);
});

test('profil discours : meilleur quand l orateur improvise et saute', () => {
  const scenario = {
    errorRate: 0.15,
    fillerRate: 0.2,
    improvise: { at: 55, words: 'alors permettez moi une petite parenthese tres rapide sur ce point precis'.split(' ') },
  };
  const discours = quality(SPEECH, scenario, { profile: 'discours' });
  const lecture = quality(SPEECH, scenario, { profile: 'lecture' });
  assert.ok(discours > 0.9, `discours=${discours}`);
  assert.ok(discours >= lecture, `discours=${discours} lecture=${lecture}`);
});

test('le texte a anaphores reste suivi malgre l ambiguite', () => {
  const within3 = quality(ANAPHORE, { errorRate: 0.2, dropRate: 0.15 }, { profile: 'lecture' });
  assert.ok(within3 > 0.9, `within3=${within3}`);
});

// --- Fautes de lecture -----------------------------------------------------
// L'aligneur ne dit pas seulement ou en est l'orateur : il sait aussi quels
// mots il a laisses derriere lui sans jamais les prononcer.

test('lecture propre : aucun mot signale derriere le curseur', () => {
  const aligner = new Aligner(tokens, { profile: 'lecture' });
  let clock = 0;
  for (const { spoken } of simulateReading(words, { seed: 1 })) aligner.push(spoken, (clock += 400));

  const manques = tokens.filter((t) => aligner.isMissed(t.index));
  assert.ok(manques.length <= 2, `${manques.length} faux positifs : ${manques.map((t) => t.norm)}`);
});

test('un paragraphe saute : les mots enjambes sont signales', () => {
  const aligner = new Aligner(tokens);
  let clock = 0;
  for (const { spoken } of simulateReading(words, { seed: 5, skip: [40, 75] })) {
    aligner.push(spoken, (clock += 400));
  }

  const saute = [];
  for (let i = 40; i < 75; i++) if (aligner.isMissed(i)) saute.push(i);
  assert.ok(saute.length > 25, `seulement ${saute.length} mots sur 35 signales`);

  // Et le reste du texte, lui, a bien ete lu.
  const ailleurs = tokens.filter((t) => (t.index < 40 || t.index >= 75) && aligner.isMissed(t.index));
  assert.ok(ailleurs.length <= 4, `${ailleurs.length} faux positifs hors du saut`);
});

test('rien n est reproche avant d avoir ete depasse', () => {
  const aligner = new Aligner(tokens);
  let clock = 0;
  for (const { spoken } of simulateReading(words.slice(0, 30), { seed: 3 })) {
    aligner.push(spoken, (clock += 400));
  }
  assert.equal(aligner.isMissed(aligner.cursor), false, 'le mot courant n est pas juge');
  for (let i = aligner.cursor; i < tokens.length; i++) {
    assert.equal(aligner.isMissed(i), false, `le mot ${i} n a pas encore ete lu`);
  }
});

test('reprendre a zero efface les fautes precedentes', () => {
  const aligner = new Aligner(tokens);
  let clock = 0;
  for (const { spoken } of simulateReading(words, { seed: 5, skip: [40, 75] })) {
    aligner.push(spoken, (clock += 400));
  }
  assert.ok(aligner.isMissed(50), 'le saut devrait etre signale avant la remise a zero');
  aligner.reset();
  assert.equal(aligner.isMissed(50), false);
});

test('changer de profil ne fait pas perdre sa place', () => {
  const aligner = new Aligner(tokens, { profile: 'discours' });
  let clock = 0;
  for (const { spoken } of simulateReading(words.slice(0, 40), { seed: 5 })) {
    aligner.push(spoken, (clock += 400));
  }
  const place = aligner.cursor;
  const entendus = aligner.heard.size;
  assert.ok(place > 30, `curseur=${place}`);

  aligner.setProfile('lecture');
  assert.equal(aligner.cursor, place, 'le curseur doit rester ou il est');
  assert.equal(aligner.heard.size, entendus, 'ce qui a ete entendu le reste');
  assert.equal(aligner.opts.bufferSize, PROFILES.lecture.bufferSize);
  assert.ok(aligner.opts.minConfidence > 0, 'les defauts completent le nouveau profil');

  // Et le suivi continue depuis la, sans repartir de zero.
  for (const { spoken } of simulateReading(words.slice(40, 70), { seed: 5 })) {
    aligner.push(spoken, (clock += 400));
  }
  assert.ok(aligner.cursor >= 65 && aligner.cursor <= 72, `suite a ${aligner.cursor}`);
});

test('le tampon est retaille quand le nouveau profil en demande moins', () => {
  const aligner = new Aligner(tokens, { profile: 'lecture' });
  let clock = 0;
  for (const { spoken } of simulateReading(words.slice(0, 30), { seed: 1 })) {
    aligner.push(spoken, (clock += 400));
  }
  assert.equal(aligner.buffer.length, PROFILES.lecture.bufferSize);
  aligner.setProfile('discours');
  assert.equal(aligner.buffer.length, PROFILES.discours.bufferSize);
});
