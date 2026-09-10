/**
 * Analyse du script annote.
 *
 * Un texte de discours n'est pas qu'une suite de mots : il porte des
 * indications qui ne se prononcent pas (respirer ici, regarder le public) et
 * des mises en valeur qui guident la voix. Le parseur separe donc deux plans :
 *
 *  - `spoken` : le texte reellement prononce, seul materiau de l'alignement ;
 *  - `styles` et `inserts` : les annotations, positionnees sur les coordonnees
 *    de `spoken` pour que l'affichage reste synchrone avec le suivi vocal.
 *
 * Syntaxe :
 *   **gras**            mot appuye
 *   ==surbrillance==    passage a ne pas manquer
 *   _italique_          nuance, aparte
 *   # Titre de section  repere de structure (non prononce)
 *   [[note de scene]]   consigne de jeu (non prononcee)
 *   (2s)                pause chronometree (non prononcee)
 */

const STYLE_MARKS = [
  { mark: '**', style: 'bold' },
  { mark: '==', style: 'mark' },
  { mark: '_', style: 'italic' },
];

/**
 * @param {string} source
 * @returns {{spoken:string, styles:{start:number,end:number,style:string}[],
 *            inserts:{at:number,kind:string,text:string,seconds?:number}[],
 *            sections:{at:number,title:string}[]}}
 */
export function parseScript(source) {
  const styles = [];
  const inserts = [];
  const sections = [];
  const open = new Map();
  let spoken = '';
  let i = 0;

  const atLineStart = () => spoken.length === 0 || spoken.endsWith('\n');

  while (i < source.length) {
    const rest = source.slice(i);

    // Titre de section : "# Introduction"
    if (atLineStart() && rest.startsWith('#')) {
      const end = source.indexOf('\n', i);
      const line = source.slice(i, end === -1 ? source.length : end);
      const title = line.replace(/^#+\s*/, '').trim();
      if (title) {
        sections.push({ at: spoken.length, title });
        inserts.push({ at: spoken.length, kind: 'section', text: title });
      }
      i = end === -1 ? source.length : end + 1;
      continue;
    }

    // Note de scene : "[[regarder le public]]"
    if (rest.startsWith('[[')) {
      const close = source.indexOf(']]', i + 2);
      if (close !== -1) {
        inserts.push({ at: spoken.length, kind: 'note', text: source.slice(i + 2, close).trim() });
        i = close + 2;
        continue;
      }
    }

    // Pause chronometree : "(2s)" ou "(1.5s)"
    const pause = rest.match(/^\((\d+(?:[.,]\d+)?)\s*s\)/i);
    if (pause) {
      const seconds = Number(pause[1].replace(',', '.'));
      inserts.push({ at: spoken.length, kind: 'pause', text: `${seconds}s`, seconds });
      i += pause[0].length;
      continue;
    }

    // Marques de style, ouvrantes puis fermantes
    const styleMark = STYLE_MARKS.find((candidate) => rest.startsWith(candidate.mark));
    if (styleMark) {
      const { mark, style } = styleMark;
      if (open.has(style)) {
        styles.push({ start: open.get(style), end: spoken.length, style });
        open.delete(style);
      } else {
        open.set(style, spoken.length);
      }
      i += mark.length;
      continue;
    }

    spoken += source[i];
    i += 1;
  }

  // Marques non refermees : on ferme en fin de texte plutot que de les perdre.
  for (const [style, start] of open) styles.push({ start, end: spoken.length, style });

  return { spoken, styles, inserts, sections };
}
