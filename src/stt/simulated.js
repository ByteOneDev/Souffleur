import { EventEmitter } from './adapter.js';
import { simulateReading } from './mock.js';
import { tokenize } from '../align/tokenize.js';

/**
 * Moteur simule, pour l'interface.
 *
 * Il rejoue le texte charge avec des erreurs realistes, au rythme choisi.
 * C'est ce qui permet de juger le comportement du prompteur sans micro, et de
 * reproduire a volonte un cas genant (saut de paragraphe, hesitations).
 */
export class SimulatedEngine extends EventEmitter {
  static id = 'simulated';
  static label = 'Simulation (sans micro)';
  static isAvailable() { return true; }

  constructor({ text = '', wpm = 150, scenario = {} } = {}) {
    super();
    this.id = SimulatedEngine.id;
    this.label = SimulatedEngine.label;
    this.text = text;
    this.wpm = wpm;
    this.scenario = scenario;
    this.timer = null;
  }

  async start() {
    const words = tokenize(this.text).map((token) => token.norm);
    const heard = simulateReading(words, { seed: Date.now() & 0xffff, ...this.scenario });
    let index = 0;
    this.emit('state', 'running');
    this.timer = setInterval(() => {
      if (index >= heard.length) return this.stop();
      this.emit('final', heard[index++].spoken);
    }, 60000 / this.wpm);
  }

  async stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.emit('state', 'stopped');
  }
}
