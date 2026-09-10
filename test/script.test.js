import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../src/script/parse.js';
import { buildFragments, renderHtml } from '../src/script/render.js';
import { tokenize } from '../src/align/tokenize.js';

test('les annotations sortent du texte prononce', () => {
  // Un '#' n'ouvre une section qu'en debut de ligne — ailleurs, c'est du texte.
  const script = parseScript('Bonjour **tous**. (2s) [[sourire]]\n# Suite\nVoila.');
  assert.ok(!script.spoken.includes('**'));
  assert.ok(!script.spoken.includes('(2s)'));
  assert.ok(!script.spoken.includes('sourire'));
  assert.ok(!script.spoken.includes('Suite'));
  assert.ok(script.spoken.includes('Bonjour tous'));
});

test('les styles pointent sur les bons caracteres', () => {
  const script = parseScript('Je dis **ceci** et pas cela.');
  const bold = script.styles.find((s) => s.style === 'bold');
  assert.equal(script.spoken.slice(bold.start, bold.end), 'ceci');
});

test('les trois styles coexistent', () => {
  const script = parseScript('**gras** ==surbrillance== _italique_');
  assert.deepEqual(script.styles.map((s) => s.style).sort(), ['bold', 'italic', 'mark']);
});

test('une pause conserve sa duree', () => {
  const { inserts } = parseScript('Un temps. (1,5s) Puis la suite.');
  const pause = inserts.find((i) => i.kind === 'pause');
  assert.equal(pause.seconds, 1.5);
});

test('les sections sont relevees pour le decoupage', () => {
  const { sections } = parseScript('# Intro\nBonjour.\n\n# Conclusion\nMerci.');
  assert.deepEqual(sections.map((s) => s.title), ['Intro', 'Conclusion']);
});

test('une marque non refermee ne mange pas le texte', () => {
  const script = parseScript('Un **debut sans fin');
  assert.ok(script.spoken.includes('Un debut sans fin'));
  assert.equal(script.styles.length, 1);
});

test('le rendu couvre chaque mot alignable', () => {
  const script = parseScript('# Titre\nMesdames, **messieurs**, bonsoir. (2s) Merci _a vous_.');
  const tokens = tokenize(script.spoken);
  const fragments = buildFragments(script, tokens);
  const rendered = new Set(fragments.filter((f) => f.tokenIndex !== null).map((f) => f.tokenIndex));
  assert.equal(rendered.size, tokens.length, 'tous les jetons doivent etre affichables');
});

test('le rendu restitue le texte prononce sans perte', () => {
  const script = parseScript('Mesdames, **messieurs** : bonsoir (2s) a _tous_ !');
  const fragments = buildFragments(script, tokenize(script.spoken));
  const restored = fragments.filter((f) => f.type === 'text').map((f) => f.text).join('');
  assert.equal(restored, script.spoken);
});

test('un # en milieu de ligne reste du texte ordinaire', () => {
  const script = parseScript('Le mot-diese # ne coupe pas la phrase.');
  assert.ok(script.spoken.includes('# ne coupe pas'));
  assert.equal(script.sections.length, 0);
});

test('une pause s affiche en toutes lettres, sans pictogramme', () => {
  const script = parseScript('Un temps. (2s) Puis la suite.');
  const html = renderHtml(buildFragments(script, tokenize(script.spoken)));
  assert.match(html, /insert-pause">pause 2s</);
  // Un caractere hors ASCII imprimable retomberait sur un carre en chasse fixe.
  assert.ok(!/[\u2000-\u2BFF\uFE0F]/.test(html), 'aucun pictogramme dans le rendu');
});

test('le html echappe le contenu injecte et porte les index', () => {
  const script = parseScript('Un <script>alert(1)</script> et **gras**');
  const html = renderHtml(buildFragments(script, tokenize(script.spoken)));
  // Aucune balise ne doit survivre : seules celles produites par le rendu.
  const tags = [...html.matchAll(/<\/?([a-z]+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tags)], ['span']);
  assert.ok(html.includes('&lt;'), 'les chevrons doivent etre echappes');
  assert.ok(html.includes('class="w bold"'));
  assert.ok(/data-i="\d+"/.test(html));
});
