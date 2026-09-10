import { EventEmitter } from './adapter.js';

/** Chromium embarque par Electron expose l'API mais n'a pas les cles Google. */
const dansElectron = () => typeof navigator !== 'undefined' && / Electron\//.test(navigator.userAgent);

/**
 * Moteur du navigateur (Web Speech API).
 *
 * Il ne fonctionne PAS dans Electron : l'objet `SpeechRecognition` y existe
 * bien, mais le service de reconnaissance de Google n'y repond pas, faute de
 * cles. Le piege est qu'il echoue en silence — on parle, rien ne se passe, et
 * rien n'explique pourquoi. Le moteur se declare donc indisponible plutot que
 * de se laisser choisir.
 *
 * Utilisable en version web et sur Android, via le navigateur du systeme.
 */
export class WebSpeechEngine extends EventEmitter {
  static id = 'webspeech';
  static label = 'Navigateur (Web Speech)';

  static isAvailable() {
    if (dansElectron()) return false;
    return typeof window !== 'undefined'
      && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /** Explication affichable quand le moteur est ecarte. */
  static get unavailableReason() {
    if (dansElectron()) return "indisponible dans l'application de bureau (service Google inaccessible)";
    return "ce navigateur n'expose pas la reconnaissance vocale";
  }

  constructor({ lang = 'fr-FR' } = {}) {
    super();
    this.id = WebSpeechEngine.id;
    this.label = WebSpeechEngine.label;
    this.lang = lang;
    this.recognition = null;
    this.running = false;
  }

  async start() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) throw new Error("Ce navigateur n'expose pas la reconnaissance vocale.");

    const recognition = new Recognition();
    recognition.lang = this.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        this.emit(result.isFinal ? 'final' : 'partial', text);
      }
    };
    recognition.onerror = (event) => this.emit('error', event.error);
    // Le navigateur coupe la session apres quelques secondes de silence :
    // on relance tant que l'utilisateur n'a pas arrete lui-meme.
    recognition.onend = () => { if (this.running) recognition.start(); };

    this.recognition = recognition;
    this.running = true;
    recognition.start();
    this.emit('state', 'running');
  }

  async stop() {
    this.running = false;
    this.recognition?.stop();
    this.recognition = null;
    this.emit('state', 'stopped');
  }
}
