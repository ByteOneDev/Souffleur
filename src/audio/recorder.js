/**
 * Enregistrement de la voix pendant la lecture.
 *
 * Le prompteur ecoute deja, mais ce flux-la est consomme par le moteur vocal :
 * il sert a reconnaitre, pas a garder. Et il n'est pas partageable — Vosk
 * ouvre le sien, Web Speech ne rend jamais le sien, la simulation n'en a pas.
 * L'enregistrement prend donc sa propre prise de son : un seul chemin de code,
 * quel que soit le moteur choisi.
 *
 * Rien ici ne suppose un navigateur. La prise de son, l'encodeur et l'horloge
 * sont injectes, ce qui rend la mecanique verifiable sans micro et sans ecran
 * — comme le reste de ce qui merite d'etre teste dans ce projet.
 */

/**
 * Formats tentes dans l'ordre, du plus souhaitable au plus tolerable.
 *
 * Opus dans WebM est le choix de Chromium : leger, bon a la voix, lisible
 * partout. Opus dans Ogg est la meme chose pour Firefox, MP4 le seul chemin de
 * Safari. Le dernier n'est pas un doublon : un navigateur peut accepter
 * « audio/webm » sans accepter qu'on lui nomme le codec.
 */
export const FORMATS = [
  { mime: 'audio/webm;codecs=opus', extension: 'webm' },
  { mime: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mime: 'audio/mp4', extension: 'm4a' },
  { mime: 'audio/webm', extension: 'webm' },
];

/** Premier format que l'environnement sait encoder, ou null s'il n'y en a pas. */
export function pickFormat(isSupported) {
  if (typeof isSupported !== 'function') return null;
  return FORMATS.find((format) => {
    try { return isSupported(format.mime); } catch { return false; }
  }) ?? null;
}

/**
 * Nom du fichier exporte : le titre du texte, puis la date.
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

export class Recorder {
  /**
   * @param {object} deps
   * @param {() => Promise<MediaStream>} deps.openStream ouvre la prise de son
   * @param {Function} deps.Encoder constructeur facon MediaRecorder
   * @param {(mime:string) => boolean} deps.isSupported test de format
   * @param {() => number} [deps.now] horloge, en millisecondes
   * @param {Function} [deps.Container] constructeur facon Blob
   */
  constructor({ openStream, Encoder, isSupported, now = Date.now, Container = globalThis.Blob } = {}) {
    this.openStream = openStream;
    this.Encoder = Encoder;
    this.isSupported = isSupported;
    this.now = now;
    this.Container = Container;

    /** 'idle' avant tout, 'recording' pendant, 'ready' quand il y a de quoi exporter. */
    this.state = 'idle';
    this.recording = null;
    this.chunks = [];
    this.stream = null;
    this.encoder = null;
    this.startedAt = 0;
    this.format = null;
  }

  /** Vrai si l'environnement sait enregistrer quoi que ce soit. */
  get available() {
    return Boolean(this.Encoder) && pickFormat(this.isSupported) !== null;
  }

  /** Secondes ecoulees depuis le debut de la prise, pour l'affichage. */
  get seconds() {
    if (this.state === 'recording') return (this.now() - this.startedAt) / 1000;
    return this.recording?.seconds ?? 0;
  }

  /**
   * Ouvre le micro et commence. Une prise precedente non exportee est perdue :
   * une repetition remplace la precedente, comme une bande qu'on reutilise.
   */
  async start() {
    if (this.state === 'recording') return;

    const format = pickFormat(this.isSupported);
    if (!format) throw new Error("Cet appareil ne sait enregistrer aucun format audio connu.");
    if (!this.Encoder) throw new Error("Cet appareil n'expose pas d'enregistreur audio.");

    this.format = format;
    this.chunks = [];
    this.recording = null;
    this.stream = await this.openStream();

    const encoder = new this.Encoder(this.stream, { mimeType: format.mime });
    encoder.ondataavailable = (event) => {
      if (event?.data?.size) this.chunks.push(event.data);
    };
    this.encoder = encoder;
    this.startedAt = this.now();
    // Un bloc par seconde plutot qu'un seul a la fin : si la page disparait en
    // route — onglet tue, application fermee — ce qui est deja decoupe existe.
    encoder.start(1000);
    this.state = 'recording';
  }

  /**
   * Arrete, ferme le micro, et rend la prise.
   * @returns {Promise<{blob: Blob, mime: string, extension: string, seconds: number, bytes: number}|null>}
   */
  async stop() {
    if (this.state !== 'recording') return this.recording;

    const encoder = this.encoder;
    const seconds = (this.now() - this.startedAt) / 1000;
    // Le dernier bloc arrive apres l'arret, jamais pendant : sans cette
    // attente, l'export perdrait la derniere seconde de chaque prise.
    await new Promise((resolve) => {
      encoder.onstop = resolve;
      try { encoder.stop(); } catch { resolve(); }
    });

    this.closeStream();
    const blob = new this.Container(this.chunks, { type: this.format.mime });
    this.recording = {
      blob,
      mime: this.format.mime,
      extension: this.format.extension,
      seconds,
      bytes: blob.size ?? 0,
    };
    this.encoder = null;
    this.state = 'ready';
    return this.recording;
  }

  /** Coupe la prise de son sans rien conserver — un arret qui n'a rien donne. */
  closeStream() {
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.stream = null;
  }

  /** Oublie la prise courante. Le micro, lui, est deja ferme. */
  discard() {
    this.recording = null;
    this.chunks = [];
    this.state = 'idle';
  }
}
