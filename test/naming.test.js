import test from 'node:test';
import assert from 'node:assert/strict';
import { fileName, clock } from '../src/store/naming.js';

test('le nom du fichier porte le titre et la date', () => {
  const nom = fileName('Répétition générale', new Date(2026, 8, 24, 9, 5), 'webm');
  assert.equal(nom, 'repetition-generale-2026-09-24-09h05.webm');
});

test('un titre vide ou impronongable retombe sur un nom utilisable', () => {
  const date = new Date(2026, 0, 2, 14, 30);
  assert.equal(fileName('', date, 'ogg'), 'souffleur-2026-01-02-14h30.ogg');
  assert.equal(fileName('«»  ///  ', date, 'ogg'), 'souffleur-2026-01-02-14h30.ogg');
  assert.equal(fileName(null, date, 'ogg'), 'souffleur-2026-01-02-14h30.ogg');
});

test('un titre tres long est coupe, jamais le reste du nom', () => {
  const nom = fileName('mot '.repeat(60), new Date(2026, 8, 24, 9, 5), 'webm');
  assert.ok(nom.endsWith('-2026-09-24-09h05.webm'), nom);
  assert.ok(nom.length < 90, `nom de ${nom.length} caracteres`);
});

test('la duree se lit en minutes et secondes', () => {
  assert.equal(clock(0), '00:00');
  assert.equal(clock(61.4), '01:01');
  assert.equal(clock(-5), '00:00');
});
