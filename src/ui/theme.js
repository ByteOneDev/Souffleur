/**
 * Choix du theme : automatique, clair ou sombre.
 *
 * « Automatique » suit la preference du systeme et continue de la suivre si
 * elle change en cours de session. Un choix explicite l'emporte et se retient.
 */
const KEY = 'souffleur.theme';
export const THEMES = ['auto', 'clair', 'sombre'];

const attribute = { clair: 'light', sombre: 'dark' };

export function readTheme(storage = globalThis.localStorage) {
  try {
    const stored = storage?.getItem(KEY);
    return THEMES.includes(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme, root = document.documentElement) {
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', attribute[theme]);
  return theme;
}

export function saveTheme(theme, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, theme); } catch { /* stockage refuse : sans effet */ }
}

/** Theme suivant dans le cycle, pour un bouton unique. */
export function nextTheme(theme) {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}
