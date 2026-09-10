/**
 * Construction du rendu du prompteur.
 *
 * Le texte est decoupe en fragments homogenes : chaque fragment porte le meme
 * jeu de styles et appartient au meme mot. Un fragment qui correspond a un mot
 * alignable recoit son index : c'est par cet index que le suivi vocal viendra
 * ensuite eclairer le texte, sans jamais reconstruire le DOM.
 */

/**
 * @param {{spoken:string, styles:Array, inserts:Array}} script
 * @param {ReturnType<import('../align/tokenize.js').tokenize>} tokens
 */
export function buildFragments(script, tokens) {
  const { spoken, styles, inserts } = script;

  // Toutes les positions ou le rendu peut changer de nature.
  const boundaries = new Set([0, spoken.length]);
  for (const range of styles) { boundaries.add(range.start); boundaries.add(range.end); }
  for (const token of tokens) { boundaries.add(token.start); boundaries.add(token.end); }
  for (const insert of inserts) boundaries.add(insert.at);
  const points = [...boundaries].filter((p) => p >= 0 && p <= spoken.length).sort((a, b) => a - b);

  const insertsAt = new Map();
  for (const insert of inserts) {
    if (!insertsAt.has(insert.at)) insertsAt.set(insert.at, []);
    insertsAt.get(insert.at).push(insert);
  }

  // Index des mots par position, pour retrouver le jeton d'un fragment.
  const tokenAt = new Map();
  for (const token of tokens) {
    for (let p = token.start; p < token.end; p++) {
      if (!tokenAt.has(p)) tokenAt.set(p, token.index);
    }
  }

  const fragments = [];
  for (let k = 0; k < points.length; k++) {
    for (const insert of insertsAt.get(points[k]) ?? []) {
      fragments.push({ type: 'insert', text: insert.text, kind: insert.kind, seconds: insert.seconds, styles: [], tokenIndex: null });
    }
    const start = points[k];
    const end = points[k + 1];
    if (end === undefined || end === start) continue;

    const text = spoken.slice(start, end);
    const active = styles.filter((range) => range.start <= start && range.end >= end).map((range) => range.style);
    fragments.push({
      type: 'text',
      text,
      styles: [...new Set(active)],
      tokenIndex: tokenAt.has(start) ? tokenAt.get(start) : null,
    });
  }
  return fragments;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const escapeHtml = (value) => String(value).replace(/[&<>]/g, (ch) => ESCAPES[ch]);

/** Rendu HTML des fragments. Une ligne vide devient une rupture de paragraphe. */
export function renderHtml(fragments) {
  let html = '';
  for (const fragment of fragments) {
    if (fragment.type === 'insert') {
      // Pas de pictogramme : les polices a chasse fixe n'ont pas le symbole
      // de pause et affichent un carre de substitution a la place.
      const label = fragment.kind === 'pause'
        ? `pause ${escapeHtml(fragment.text)}`
        : escapeHtml(fragment.text);
      html += `<span class="insert insert-${fragment.kind}">${label}</span>`;
      continue;
    }
    const parts = fragment.text.split(/\n{2,}/);
    parts.forEach((part, index) => {
      if (index > 0) html += '<span class="para-break"></span>';
      if (!part) return;
      const classes = ['w', ...fragment.styles];
      const attrs = fragment.tokenIndex === null ? '' : ` data-i="${fragment.tokenIndex}"`;
      html += `<span class="${classes.join(' ')}"${attrs}>${escapeHtml(part)}</span>`;
    });
  }
  return html;
}
