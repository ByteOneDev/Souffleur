/**
 * Nommer et dater ce qu'on emporte.
 *
 * Trois choses sortent de l'application — un enregistrement, un script en
 * Markdown, une page imprimable — et toutes les trois doivent atterrir dans le
 * dossier de telechargement sous un nom qui dise de quel texte il s'agit et
 * quand il a ete pris. Le calcul est le meme ; il vit donc a un seul endroit,
 * plutot que dans le module audio ou il s'etait trouve par hasard.
 */

/**
 * Nom d'un fichier exporte : le titre du texte, puis la date.
 *
 * Un orateur repete le meme discours plusieurs fois ; sans l'horodatage, la
 * deuxieme prise ecraserait la premiere dans le dossier de telechargement, ou
 * s'empilerait en « (1) », « (2) », ce qui ne dit rien de l'ordre.
 */
export function fileName(title, date = new Date(), extension = 'webm') {
  const base = String(title ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // « Répétition » -> « Repetition »
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  const deuxChiffres = (n) => String(n).padStart(2, '0');
  const horodatage = `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`
    + `-${deuxChiffres(date.getHours())}h${deuxChiffres(date.getMinutes())}`;
  return `${base || 'souffleur'}-${horodatage}.${extension}`;
}

/** Duree lisible : on parle en minutes et en secondes, pas en millisecondes. */
export function clock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
