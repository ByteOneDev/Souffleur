/**
 * Rangement de la cle d'interface de programmation.
 *
 * Le principe est celui du « apportez votre propre cle » : chaque utilisateur
 * fournit la sienne, elle reste sur son appareil, et rien n'est jamais livre
 * dans le code de l'application. C'est ce qui permet de partager l'outil sans
 * partager de secret, et sans heberger le moindre serveur.
 *
 * La cle n'est jamais journalisee ni affichee en entier.
 */
const CLE = 'souffleur.cle-anthropic';

/** Les cles Anthropic commencent par sk-ant- ; verification de forme, pas de validite. */
export function formeValide(cle) {
  return typeof cle === 'string' && /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(cle.trim());
}

/** Version affichable : de quoi reconnaitre sa cle sans jamais la reveler. */
export function masquer(cle) {
  if (!cle) return '';
  const propre = cle.trim();
  return `${propre.slice(0, 11)}…${propre.slice(-4)}`;
}

export function lireCle(stockage = globalThis.localStorage) {
  try {
    return stockage?.getItem(CLE) ?? null;
  } catch {
    return null;
  }
}

export function ecrireCle(cle, stockage = globalThis.localStorage) {
  try {
    stockage?.setItem(CLE, cle.trim());
    return true;
  } catch {
    return false;
  }
}

export function effacerCle(stockage = globalThis.localStorage) {
  try {
    stockage?.removeItem(CLE);
  } catch { /* stockage refuse : sans effet */ }
}
