/**
 * Export du script vers des formats qu'on peut emporter.
 *
 * Deux sorties, deux usages.
 *
 * Le **Markdown** est la forme portable : le fichier s'ouvre dans n'importe
 * quel editeur, et il revient dans Souffleur sans perdre une annotation. C'est
 * pourquoi rien n'y est ajoute — ni en-tete, ni metadonnees. L'analyseur du
 * projet ne connait pas de syntaxe de commentaire : la moindre ligne ajoutee
 * reviendrait comme du texte a prononcer. Le titre et la date vivent donc dans
 * le nom du fichier, ou ils ne genent personne.
 *
 * La **page HTML** est la forme imprimable : elle passe par le meme decoupage
 * en fragments que le prompteur, donc elle montre exactement ce qu'on lit —
 * gras, surbrillances, pauses et consignes de jeu compris. Autonome, sans
 * feuille de style ni police a aller chercher : on l'imprime pour poser le
 * script sur le pupitre, ou on l'envoie a quelqu'un qui n'a pas le logiciel.
 */

import { buildFragments, renderHtml } from './render.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ESCAPES[ch]);

/**
 * Le script en Markdown, tel quel.
 *
 * Les fins de ligne sont normalisees et le fichier se termine par un saut de
 * ligne : deux details que tout outil de texte attend, et dont l'absence se
 * voit tout de suite dans un editeur ou un differentiel.
 */
export function toMarkdown(source) {
  const texte = String(source ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '');
  return texte.endsWith('\n') ? texte : `${texte}\n`;
}

/** Date lisible par un lecteur francais, pas par une machine. */
function dateLisible(date) {
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  return `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Sous la minute, on ne dit pas « 0 min 48 » : on dit « 48 s ». */
const dureeLisible = (seconds) => {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')}`;
};

/**
 * Page autonome, prete a imprimer.
 *
 * @param {{spoken:string, styles:Array, inserts:Array}} script
 * @param {ReturnType<import('../align/tokenize.js').tokenize>} tokens
 * @param {{title?:string, date?:Date, words?:number, seconds?:number}} [meta]
 */
export function toPrintableHtml(script, tokens, meta = {}) {
  const { title = '', date = new Date(), words = 0, seconds = 0 } = meta;
  const titre = String(title).trim() || 'Discours';

  const reperes = [
    dateLisible(date),
    `${words} mot${words > 1 ? 's' : ''}`,
    seconds ? `≈ ${dureeLisible(seconds)}` : null,
  ].filter(Boolean).join(' · ');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titre)}</title>
<style>
/* Les couleurs sont ecrites ici : la page doit tenir seule, sans jetons. */
:root {
  --paper: #ffffff; --ink: #221f1a; --ink-faint: #8b8471;
  --rule: #d9d1c0; --ribbon: #b4362c; --ribbon-soft: #f0dcd8;
  --cool: #2c5d94; --cool-soft: #dce7f2;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 48px 24px 72px;
  background: var(--paper); color: var(--ink);
  font: 400 12pt/1.7 'Iowan Old Style', Palatino, Georgia, serif;
}
main { max-width: 34em; margin: 0 auto; }
header { border-bottom: 1px solid var(--rule); padding-bottom: 14px; margin-bottom: 36px; }
h1 { font-size: 20pt; line-height: 1.2; margin: 0 0 8px; font-weight: 600; }
.reperes {
  margin: 0; font-size: 8.5pt; color: var(--ink-faint);
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  text-transform: uppercase; letter-spacing: .12em;
}

/* Les memes classes que le prompteur : le rendu vient du meme code. */
.bold { font-weight: 700; }
.italic { font-style: italic; }
.mark { background: var(--cool-soft); border-radius: 2px; padding: 0 .08em; }
.para-break { display: block; height: .85em; }

.insert {
  display: inline-block;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: .62em; font-weight: 500;
  letter-spacing: .12em; text-transform: uppercase;
  padding: .25em .6em; border-radius: 2px; margin: 0 .3em;
  vertical-align: middle;
}
.insert-pause { background: var(--cool-soft); color: var(--cool); }
.insert-note { background: var(--ribbon-soft); color: var(--ribbon); }
.insert-section {
  display: block; background: none; padding: 0 0 .4em;
  margin: 1.6em 0 .7em; font-size: .58em; color: var(--ink-faint);
  border-bottom: 1px solid var(--rule);
}

/*
 * La largeur se mesure en « em », donc sur la taille de police de l'element :
 * un pied de page en 8 pt tirait un filet aux deux tiers de la colonne. Le
 * cadre garde la taille du texte, et seul son contenu rapetisse.
 */
footer { max-width: 34em; margin: 48px auto 0; padding-top: 12px; border-top: 1px solid var(--rule); }
footer small {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 8pt; color: var(--ink-faint);
}

@media print {
  /* Le lecteur tient la feuille : de la marge pour le pouce, et des reperes
     de structure qui ne se retrouvent pas seuls en bas de page. */
  @page { margin: 18mm 16mm; }
  body { padding: 0; font-size: 11.5pt; }
  main, footer { max-width: none; }
  .insert-section { break-after: avoid; page-break-after: avoid; }
  footer { position: fixed; bottom: 0; border: 0; }
}
</style>
</head>
<body>
<main>
  <header>
    <h1>${escapeHtml(titre)}</h1>
    <p class="reperes">${escapeHtml(reperes)}</p>
  </header>
  ${renderHtml(buildFragments(script, tokens))}
</main>
<footer><small>Souffleur</small></footer>
</body>
</html>
`;
}
