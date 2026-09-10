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
const VOSK_CDN = 'https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const SAMPLE_RATE = 16000;

let voskLibrary = null;

async function loadVosk() {
  if (voskLibrary) return voskLibrary;
  if (globalThis.Vosk) return (voskLibrary = globalThis.Vosk);
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = VOSK_CDN;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Chargement de vosk-browser impossible.'));
    document.head.appendChild(script);
  });
  if (!globalThis.Vosk) throw new Error('vosk-browser charge mais absent de window.');
  return (voskLibrary = globalThis.Vosk);
}

export class VoskEngine extends EventEmitter {
  static id = 'vosk';
  static label = 'Vosk local (hors ligne)';

  static isAvailable() {
    return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined';
  }

  /** @param {{modelUrl?: string}} options chemin du modele .tar.gz ou .zip */
  constructor({ modelUrl = 'models/vosk-model-small-fr-0.22.tar.gz' } = {}) {
    super();
    this.id = VoskEngine.id;
    this.label = VoskEngine.label;
    this.modelUrl = modelUrl;
    this.model = null;
    this.recognizer = null;
    this.audio = null;
    this.stream = null;
  }

  async start() {
    this.emit('state', 'loading');
    const Vosk = await loadVosk();

    if (!this.model) {
      this.model = await Vosk.createModel(this.modelUrl);
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
