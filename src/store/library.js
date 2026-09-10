/**
 * Bibliotheque des discours.
 *
 * Un orateur ne prepare pas un texte, il en prepare plusieurs, et il y revient.
 * La bibliotheque est donc le point d'entree de l'application, pas un annexe.
 *
 * Le stockage est injecte plutot que suppose : l'implementation reelle est
 * localStorage dans le navigateur, mais la logique se teste sans navigateur et
 * pourra passer a un fichier ou une base sans etre reecrite.
 */

const KEY = 'prompteur.bibliotheque.v1';

/** Stockage en memoire, utilise par les tests et comme repli. */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

/** Le stockage du navigateur peut etre refuse (navigation privee, reglages). */
export function defaultStorage() {
  try {
    const probe = '__prompteur__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return memoryStorage();
  }
}

const now = () => new Date().toISOString();

// Un titre ne doit pas se terminer sur un mot suspendu : couper apres « et a »
// donne un intitule qui a l'air casse, meme s'il est techniquement correct.
const MOTS_SUSPENDUS = new Set(['et', 'a', 'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une',
  'en', 'au', 'aux', 'ou', 'que', 'qui', 'pour', 'par', 'sur', 'dans', 'avec', 'sans', 'mes', 'son']);

/**
 * Titre deduit du texte : la premiere section, sinon la premiere phrase.
 * Personne n'a envie de nommer un fichier avant d'avoir ecrit une ligne.
 */
export function inferTitle(source) {
  const heading = source.match(/^\s*#+\s*(.+)$/m);
  if (heading) return heading[1].trim().slice(0, 80);

  const words = source.replace(/[#*=_[\]()]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 7);
  while (words.length > 1) {
    const last = words[words.length - 1].toLowerCase().replace(/[^\p{L}]/gu, '');
    if (!MOTS_SUSPENDUS.has(last.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) break;
    words.pop();
  }
  const title = words.join(' ').replace(/[,;:]$/, '');
  return title ? title.slice(0, 80) : 'Sans titre';
}

/** Nombre de mots, pour estimer la duree avant meme d'avoir repete. */
export function countWords(source) {
  return (source.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

/** Duree de lecture estimee, en secondes, au debit indique. */
export function estimateSeconds(source, wordsPerMinute = 140) {
  return (countWords(source) / wordsPerMinute) * 60;
}

export class Library {
  constructor(storage = defaultStorage()) {
    this.storage = storage;
  }

  /** @returns {{id:string,title:string,source:string,profile:string,targetMinutes:number,createdAt:string,updatedAt:string}[]} */
  all() {
    try {
      const raw = this.storage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Un stockage corrompu ne doit pas empecher d'ouvrir l'application.
      return [];
    }
  }

  save(list) {
    this.storage.setItem(KEY, JSON.stringify(list));
    return list;
  }

  get(id) {
    return this.all().find((entry) => entry.id === id) ?? null;
  }

  create({ source = '', title, profile = 'discours', targetMinutes = 0 } = {}) {
    const entry = {
      id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title: title?.trim() || inferTitle(source),
      source,
      profile,
      targetMinutes,
      createdAt: now(),
      updatedAt: now(),
    };
    this.save([entry, ...this.all()]);
    return entry;
  }

  update(id, changes) {
    let updated = null;
    const list = this.all().map((entry) => {
      if (entry.id !== id) return entry;
      updated = { ...entry, ...changes, id: entry.id, updatedAt: now() };
      // Un titre laisse vide se rededuit du texte plutot que de disparaitre.
      if (!updated.title?.trim()) updated.title = inferTitle(updated.source);
      return updated;
    });
    if (updated) this.save(list);
    return updated;
  }

  remove(id) {
    const list = this.all();
    const kept = list.filter((entry) => entry.id !== id);
    if (kept.length !== list.length) this.save(kept);
    return kept.length !== list.length;
  }

  duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    return this.create({
      source: source.source,
      title: `${source.title} (copie)`,
      profile: source.profile,
      targetMinutes: source.targetMinutes,
    });
  }

  /** Les discours les plus recemment touches en premier : c'est ce qu'on cherche. */
  recent() {
    return this.all().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
}
