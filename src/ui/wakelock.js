/**
 * Maintien de l'ecran allume pendant la lecture.
 *
 * Un prompteur dont l'ecran s'eteint au milieu d'un discours ne sert a rien.
 * L'API de verrou d'ecran est disponible sur Android et sur les navigateurs
 * recents ; ailleurs, l'absence est sans consequence et ne doit pas produire
 * d'erreur visible.
 */
let verrou = null;

export async function garderEcranAllume() {
  if (verrou || !navigator.wakeLock) return false;
  try {
    verrou = await navigator.wakeLock.request('screen');
    // Le systeme relache le verrou quand l'application passe en arriere-plan :
    // on le reprend au retour, sinon l'ecran s'eteint apres un appel recu.
    document.addEventListener('visibilitychange', reprendre);
    return true;
  } catch {
    // Refus (batterie faible, reglage systeme) : la lecture continue sans.
    return false;
  }
}

async function reprendre() {
  if (document.visibilityState === 'visible' && verrou !== null) {
    try { verrou = await navigator.wakeLock.request('screen'); } catch { verrou = null; }
  }
}

export async function libererEcran() {
  document.removeEventListener('visibilitychange', reprendre);
  try { await verrou?.release(); } catch { /* deja relache */ }
  verrou = null;
}

export const ecranVerrouille = () => verrou !== null;
