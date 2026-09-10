import test from 'node:test';
import assert from 'node:assert/strict';
import { Library, memoryStorage, inferTitle, countWords, estimateSeconds } from '../src/store/library.js';

const fresh = () => new Library(memoryStorage());

test('un titre se deduit de la premiere section', () => {
  assert.equal(inferTitle('# Discours de rentrée\n\nMesdames...'), 'Discours de rentrée');
});

test('sans section, le titre vient des premiers mots', () => {
  assert.equal(inferTitle('Mesdames, messieurs, bonsoir à toutes et à tous.'),
    'Mesdames, messieurs, bonsoir à toutes');
});

test('un titre ne se termine pas sur un mot suspendu', () => {
  // Couper mecaniquement a sept mots produit « ... la lumiere et de » : correct,
  // mais illisible dans une liste.
  assert.equal(inferTitle('Celui qui ne cherche pas la lumiere et de surcroit se tait'),
    'Celui qui ne cherche pas la lumiere');
  assert.equal(inferTitle('Voici le'), 'Voici');
  assert.equal(inferTitle('de'), 'de', 'un mot unique reste le titre');
});

test('un texte vide reste nommable', () => {
  assert.equal(inferTitle('   '), 'Sans titre');
});

test('le comptage ignore les annotations mais pas les mots', () => {
  assert.equal(countWords('Mesdames, **messieurs** : bonsoir.'), 3);
});

test('la duree estimee suit le debit', () => {
  const source = Array.from({ length: 140 }, () => 'mot').join(' ');
  assert.equal(Math.round(estimateSeconds(source, 140)), 60);
  assert.equal(Math.round(estimateSeconds(source, 70)), 120);
});

test('creer, relire, modifier, supprimer', () => {
  const library = fresh();
  const entry = library.create({ source: '# Ouverture\nBonsoir.' });
  assert.equal(entry.title, 'Ouverture');
  assert.equal(library.get(entry.id).source, '# Ouverture\nBonsoir.');

  const updated = library.update(entry.id, { source: '# Cloture\nMerci.' });
  assert.equal(updated.source, '# Cloture\nMerci.');
  assert.notEqual(updated.updatedAt, undefined);

  assert.equal(library.remove(entry.id), true);
  assert.equal(library.get(entry.id), null);
  assert.equal(library.remove(entry.id), false, 'supprimer deux fois ne ment pas');
});

test('un titre efface se rededuit au lieu de disparaitre', () => {
  const library = fresh();
  const entry = library.create({ source: '# Premier', title: 'Choisi' });
  const updated = library.update(entry.id, { title: '   ', source: '# Second' });
  assert.equal(updated.title, 'Second');
});

test('la duplication ne partage pas l identite', () => {
  const library = fresh();
  const entry = library.create({ source: 'Texte', profile: 'lecture', targetMinutes: 5 });
  const copy = library.duplicate(entry.id);
  assert.notEqual(copy.id, entry.id);
  assert.equal(copy.profile, 'lecture');
  assert.equal(copy.targetMinutes, 5);
  assert.match(copy.title, /copie/);
  assert.equal(library.all().length, 2);
});

test('le plus recemment modifie remonte en tete', async () => {
  const library = fresh();
  const premier = library.create({ source: 'Un' });
  library.create({ source: 'Deux' });
  await new Promise((r) => setTimeout(r, 5));
  library.update(premier.id, { source: 'Un, corrigé' });
  assert.equal(library.recent()[0].id, premier.id);
});

test('un stockage corrompu n empeche pas d ouvrir l application', () => {
  const library = new Library(memoryStorage({ 'prompteur.bibliotheque.v1': '{ ceci n est pas du json' }));
  assert.deepEqual(library.all(), []);
  assert.ok(library.create({ source: 'Reprise' }).id);
});

test('un stockage refuse ne fait pas echouer la bibliotheque', () => {
  const refusing = { getItem() { throw new Error('refus'); }, setItem() { throw new Error('refus'); }, removeItem() {} };
  const library = new Library(refusing);
  assert.deepEqual(library.all(), [], 'la lecture doit degrader proprement');
});
