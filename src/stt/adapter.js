/**
 * Interface commune des moteurs de reconnaissance vocale.
 *
 * Tout le reste de l'application ignore quel moteur tourne. C'est ce qui
 * permet a la meme base de code de viser le bureau (Vosk local, hors ligne),
 * le navigateur (Web Speech) et, plus tard, une plateforme contrainte comme
 * iOS ou le WebView limite en memoire imposerait un moteur distant.
 *
 * Un moteur emet deux types d'evenements :
 *  - `partial` : hypothese revisable sur les derniers mots (remplace le tampon)
 *  - `final`   : segment fige (s'ajoute au tampon)
 *
 * @typedef {object} SpeechEngine
 * @property {string} id
 * @property {string} label
 * @property {() => Promise<void>} start
 * @property {() => Promise<void>} stop
 * @property {(event:'partial'|'final'|'error'|'state', handler:Function) => void} on
 */

export class EventEmitter {
  constructor() { this.handlers = new Map(); }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    for (const handler of this.handlers.get(event) ?? []) {
      try { handler(payload); } catch (error) { console.error(`[${event}]`, error); }
    }
  }
}
