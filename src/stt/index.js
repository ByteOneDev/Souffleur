import { VoskEngine } from './vosk.js';
import { WebSpeechEngine } from './webspeech.js';
import { SimulatedEngine } from './simulated.js';

export { VoskEngine, WebSpeechEngine, SimulatedEngine };

export const ENGINES = [VoskEngine, WebSpeechEngine, SimulatedEngine];

/** Moteurs utilisables dans l'environnement courant. */
export function availableEngines() {
  return ENGINES.filter((Engine) => Engine.isAvailable());
}

export function createEngine(id, options = {}) {
  const Engine = ENGINES.find((candidate) => candidate.id === id);
  if (!Engine) throw new Error(`Moteur inconnu : ${id}`);
  return new Engine(options);
}
