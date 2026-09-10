import { EventEmitter } from './adapter.js';

/**
 * Moteur du navigateur (Web Speech API).
 *
 * Attention : ne fonctionne PAS dans Electron. Chromium embarque n'a pas les
 * cles du service de reconnaissance de Google. Utilisable en version web/PWA
 * et sur Android via le WebView systeme.
 */
export class WebSpeechEngine extends EventEmitter {
  static id = 'webspeech';
  static label = 'Navigateur (Web Speech)';

  static isAvailable() {
    return typeof window !== 'undefined'
      && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
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
