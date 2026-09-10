import { EventEmitter } from './adapter.js';

/**
 * Moteur Vosk, execute localement en WebAssembly.
 *
 * C'est le moteur de reference du projet : gratuit, hors ligne, sans cle API,
 * et il fonctionne dans Electron la ou Web Speech echoue. Le modele francais
 * (~50 Mo) est telecharge une fois puis mis en cache.
 *
 * Precision brute moyenne — sans importance ici : on n'attend pas une dictee
 * exacte, seulement assez de mots reconnus pour se reperer dans un texte connu.
 */
// La bibliotheque est servie depuis le projet, jamais depuis un CDN : son
// binaire WebAssembly (3 Mo) y est embarque en data-URI et n'effectue aucun
// appel reseau a l'execution. C'est ce qui rend le fonctionnement hors ligne
// reel, et non seulement annonce.
const VOSK_SCRIPT = 'vendor/vosk/vosk.js';
const SAMPLE_RATE = 16000;
// Un modele introuvable laisse createModel en attente indefiniment, sans
// erreur : sans cette borne, l'application gele au demarrage sans un mot.
const MODEL_TIMEOUT_MS = 90000;

let voskLibrary = null;

async function loadVosk(scriptUrl) {
  if (voskLibrary) return voskLibrary;
  if (globalThis.Vosk) return (voskLibrary = globalThis.Vosk);
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Bibliotheque Vosk introuvable (${scriptUrl}).`));
    document.head.appendChild(script);
  });
  if (!globalThis.Vosk) throw new Error('vosk-browser charge mais absent de window.');
  return (voskLibrary = globalThis.Vosk);
}

/** Borne une promesse qui pourrait ne jamais se resoudre. */
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export class VoskEngine extends EventEmitter {
  static id = 'vosk';
  static label = 'Vosk local (hors ligne)';

  static isAvailable() {
    return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined';
  }

  /** @param {{modelUrl?: string, scriptUrl?: string}} options */
  constructor({ modelUrl = 'models/vosk-model-small-fr-0.22.tar.gz', scriptUrl = VOSK_SCRIPT } = {}) {
    super();
    this.id = VoskEngine.id;
    this.label = VoskEngine.label;
    this.modelUrl = modelUrl;
    this.scriptUrl = scriptUrl;
    this.model = null;
    this.recognizer = null;
    this.audio = null;
    this.stream = null;
  }

  async start() {
    this.emit('state', 'loading');
    const Vosk = await loadVosk(this.scriptUrl);

    if (!this.model) {
      // Verifier l'adresse d'abord : createModel ne rejette pas sur une URL
      // invalide, il reste en attente et signale l'echec dans son worker.
      const head = await fetch(this.modelUrl, { method: 'HEAD' }).catch(() => null);
      if (!head?.ok) {
        throw new Error(`Modele vocal introuvable (${this.modelUrl}). Voir README, section « Essayer ».`);
      }
      this.model = await withTimeout(
        Vosk.createModel(this.modelUrl),
        MODEL_TIMEOUT_MS,
        `Modele vocal illisible (${this.modelUrl}).`,
      );
    }
    const recognizer = new this.model.KaldiRecognizer(SAMPLE_RATE);
    recognizer.setWords(true);
    recognizer.on('result', (message) => {
      const text = message?.result?.text;
      if (text) this.emit('final', text);
    });
    recognizer.on('partialresult', (message) => {
      const text = message?.result?.partial;
      if (text) this.emit('partial', text);
    });
    this.recognizer = recognizer;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const audio = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audio.createMediaStreamSource(this.stream);
    // ScriptProcessor est deprecie mais reste le chemin le plus court vers des
    // blocs PCM synchrones ; a remplacer par un AudioWorklet en production.
    const processor = audio.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      try { this.recognizer?.acceptWaveform(event.inputBuffer); }
      catch (error) { this.emit('error', String(error)); }
    };
    source.connect(processor);
    processor.connect(audio.destination);

    this.audio = { context: audio, source, processor };
    this.emit('state', 'running');
  }

  async stop() {
    this.audio?.processor.disconnect();
    this.audio?.source.disconnect();
    await this.audio?.context.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.recognizer?.remove?.();
    this.audio = null;
    this.stream = null;
    this.recognizer = null;
    this.emit('state', 'stopped');
  }
}
