import test from 'node:test';
import assert from 'node:assert/strict';
import { TACHES, preparer, MOTS_PAR_MINUTE } from '../src/ai/tasks.js';
import { formeValide, masquer, lireCle, ecrireCle, effacerCle } from '../src/ai/key.js';
import { memoryStorage } from '../src/store/library.js';

const DISCOURS = `# Ouverture

Mesdames, messieurs, il convient de rappeler, ainsi qu'il a été démontré par
ailleurs, que la **technique** n'est ==jamais neutre==.`;

test('les quatre tâches sont disponibles et décrites', () => {
  assert.deepEqual(Object.keys(TACHES).sort(), ['duree', 'fiches', 'oral', 'questions']);
  for (const [nom, tache] of Object.entries(TACHES)) {
    assert.ok(tache.titre, `${nom} sans titre`);
    assert.ok(tache.description, `${nom} sans description`);
    assert.equal(typeof tache.remplaceLeTexte, 'boolean');
  }
});

test('seules les réécritures remplacent le texte', () => {
  assert.equal(TACHES.oral.remplaceLeTexte, true);
  assert.equal(TACHES.duree.remplaceLeTexte, true);
  assert.equal(TACHES.fiches.remplaceLeTexte, false);
  assert.equal(TACHES.questions.remplaceLeTexte, false);
});

test('la requête contient le texte et enseigne la syntaxe d’annotation', () => {
  const r = preparer('oral', DISCOURS);
  assert.ok(r.message.includes('technique'), 'le texte doit être transmis');
  // Sans cette explication, le modele detruit les annotations existantes.
  for (const marque of ['**gras**', '==surbrillance==', '(2s)', '[[note de scène]]']) {
    assert.ok(r.system.includes(marque), `syntaxe absente : ${marque}`);
  }
});

test('ajuster à une durée calcule la cible et choisit le sens', () => {
  const long = Array.from({ length: 600 }, () => 'mot').join(' ');
  const raccourcir = preparer('duree', long, { minutes: 2 });
  assert.ok(raccourcir.message.includes('600 mots'));
  assert.ok(raccourcir.message.includes(String(2 * MOTS_PAR_MINUTE)));
  assert.match(raccourcir.message, /raccourcir/);

  const allonger = preparer('duree', long, { minutes: 10 });
  assert.match(allonger.message, /développer/);
});

test('les tâches d’analyse ne demandent pas de préambule', () => {
  const fiches = preparer('fiches', DISCOURS);
  assert.match(fiches.message, /ni titre, ni introduction/);
});

test('une tâche inconnue ou un texte vide sont refusés', () => {
  assert.throws(() => preparer('inexistante', DISCOURS), /Tâche inconnue/);
  assert.throws(() => preparer('oral', '   '), /vide/);
});

test('la forme d’une clé est vérifiée avant tout appel', () => {
  assert.equal(formeValide('sk-ant-api03-' + 'a'.repeat(40)), true);
  assert.equal(formeValide('sk-ant-court'), false);
  assert.equal(formeValide('une-phrase-au-hasard'), false);
  assert.equal(formeValide(''), false);
  assert.equal(formeValide(undefined), false);
});

test('une clé affichée reste illisible', () => {
  const cle = 'sk-ant-api03-' + 'x'.repeat(40) + 'FIN9';
  const masquee = masquer(cle);
  assert.ok(masquee.length < 20, 'le masque doit être court');
  assert.ok(!masquee.includes('x'.repeat(10)), 'le corps de la clé ne doit pas fuiter');
  assert.ok(masquee.endsWith('FIN9'), 'les derniers caractères aident à la reconnaître');
});

test('la clé se range et se retire du stockage local', () => {
  const stockage = memoryStorage();
  assert.equal(lireCle(stockage), null);
  ecrireCle('sk-ant-api03-' + 'b'.repeat(40), stockage);
  assert.ok(lireCle(stockage).startsWith('sk-ant-'));
  effacerCle(stockage);
  assert.equal(lireCle(stockage), null);
});

test('un stockage refusé ne fait pas échouer l’application', () => {
  const refus = { getItem() { throw new Error('refus'); }, setItem() { throw new Error('refus'); }, removeItem() { throw new Error('refus'); } };
  assert.equal(lireCle(refus), null);
  assert.equal(ecrireCle('sk-ant-api03-' + 'c'.repeat(40), refus), false);
  assert.doesNotThrow(() => effacerCle(refus));
});
