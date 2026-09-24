import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../src/script/parse.js';
import { tokenize } from '../src/align/tokenize.js';
import { toMarkdown, toPrintableHtml } from '../src/script/export.js';

const SOURCE = `# Ouverture

Mesdames, messieurs, bonsoir. (2s) [[balayer la salle]]

Une **évidence** que nous avons oubliée : la technique n'est ==jamais neutre==.`;

const rendre = (source, meta = {}) => {
  const script = parseScript(source);
  return toPrintableHtml(script, tokenize(script.spoken), meta);
};

// --- Markdown ---------------------------------------------------------------

test('le markdown rend le texte tel quel : il doit revenir sans perte', () => {
  const exporte = toMarkdown(SOURCE);
  // Ce qui ressort doit se reanalyser a l'identique, annotations comprises.
  const avant = parseScript(SOURCE);
  const apres = parseScript(exporte);
  assert.equal(apres.spoken.trim(), avant.spoken.trim());
  assert.deepEqual(apres.sections, avant.sections);
  assert.equal(apres.inserts.length, avant.inserts.length);
});

test('le markdown n ajoute aucune ligne qui se prononcerait', () => {
  const exporte = toMarkdown(SOURCE);
  // Un en-tete de metadonnees reviendrait comme du texte a dire : l analyseur
  // du projet ne connait pas de syntaxe de commentaire.
  assert.ok(!exporte.includes('---'), 'pas d en-tete YAML');
  assert.ok(!exporte.includes('<!--'), 'pas de commentaire HTML');
  assert.ok(exporte.startsWith('# Ouverture'), exporte.slice(0, 40));
});

test('les fins de ligne sont normalisees et le fichier se termine proprement', () => {
  const exporte = toMarkdown('Premiere ligne.\r\nDeuxieme ligne.   \r\n\r\nTroisieme.');
  assert.ok(!exporte.includes('\r'), 'aucun retour chariot');
  assert.ok(!/[ \t]+\n/.test(exporte), 'aucune espace en fin de ligne');
  assert.ok(exporte.endsWith('\n'));
  assert.ok(!exporte.endsWith('\n\n'), 'un seul saut final');
});

test('un texte vide ne produit pas un fichier casse', () => {
  assert.equal(toMarkdown(''), '\n');
  assert.equal(toMarkdown(null), '\n');
});

// --- Page imprimable --------------------------------------------------------

test('la page est autonome : rien a aller chercher ailleurs', () => {
  const html = rendre(SOURCE, { title: 'Ouverture', words: 18, seconds: 75 });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<style>'), 'la feuille de style est embarquee');
  assert.ok(!/<link[^>]+stylesheet/.test(html), 'aucune feuille distante');
  assert.ok(!/<script/.test(html), 'aucun script');
  assert.ok(!/https?:\/\//.test(html), 'aucune adresse distante');
});

test('la page porte le titre, la date et les reperes du texte', () => {
  const html = rendre(SOURCE, { title: 'Ouverture', date: new Date(2026, 8, 24), words: 147, seconds: 72 });
  assert.ok(html.includes('<title>Ouverture</title>'));
  assert.ok(html.includes('<h1>Ouverture</h1>'));
  assert.ok(html.includes('24/09/2026'), 'la date en clair');
  assert.ok(html.includes('147 mots'));
  assert.ok(html.includes('≈ 1 min 12'), 'la duree estimee');
});

test('sous la minute, la duree ne se dit pas « 0 min 48 »', () => {
  const html = rendre('Bonsoir.', { seconds: 48 });
  assert.ok(html.includes('≈ 48 s'), html.match(/reperes">[^<]*/)?.[0]);
  assert.ok(!html.includes('0 min'));
});

test('sans titre, la page en porte un quand meme', () => {
  const html = rendre('Bonsoir.', { title: '   ' });
  assert.ok(html.includes('<title>Discours</title>'));
});

test('un seul mot ne se dit pas « 1 mots »', () => {
  const html = rendre('Bonsoir.', { words: 1 });
  assert.ok(html.includes('1 mot ·') || html.includes('1 mot<'), html.match(/reperes">[^<]*/)?.[0]);
  assert.ok(!html.includes('1 mots'));
});

test('la mise en page reprend celle du prompteur', () => {
  const html = rendre(SOURCE);
  assert.ok(html.includes('class="insert insert-section">Ouverture</span>'), 'la section');
  assert.ok(html.includes('insert-pause'), 'la pause');
  assert.ok(html.includes('insert-note'), 'la consigne de jeu');
  assert.ok(/class="w bold"[^>]*>évidence/.test(html), 'le gras');
  assert.ok(html.includes('mark'), 'la surbrillance');
});

test('le texte prononce se retrouve entier dans la page', () => {
  const html = rendre(SOURCE);
  const corps = html.slice(html.indexOf('</header>'), html.indexOf('</main>'));
  const nu = corps.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  for (const mot of ['Mesdames', 'messieurs', 'bonsoir', 'évidence', 'oubliée', 'technique', 'neutre']) {
    assert.ok(nu.includes(mot), `« ${mot} » manque dans la page`);
  }
});

test('un titre qui porte des chevrons ne casse pas la page', () => {
  const html = rendre('Bonsoir.', { title: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<script>alert'), 'le titre doit etre echappe');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('les consignes de jeu ne sont pas prononcees, mais restent visibles', () => {
  const script = parseScript('Bonsoir. [[regarder le public]] Merci.');
  const html = toPrintableHtml(script, tokenize(script.spoken));
  assert.ok(html.includes('regarder le public'), 'la consigne est imprimee');
  assert.ok(!script.spoken.includes('regarder le public'), 'mais elle n est pas dans le texte dit');
});

test('la feuille prevoit l impression', () => {
  const html = rendre(SOURCE);
  assert.ok(html.includes('@media print'), 'des regles d impression');
  assert.ok(html.includes('@page'), 'des marges de page');
});
