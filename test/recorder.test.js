import test from 'node:test';
import assert from 'node:assert/strict';
import { Recorder, FORMATS, pickFormat, fileName, clock } from '../src/audio/recorder.js';

/** Enregistreur de fausse monnaie : il imite MediaRecorder, sans micro. */
class FauxEncodeur {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.blocs = 0;
    FauxEncodeur.dernier = this;
  }

  start(tranche) { this.tranche = tranche; this.demarre = true; }

  /** Un bloc de `octets`, comme le navigateur en rend toutes les secondes. */
  rendreBloc(octets) {
    this.blocs++;
    this.ondataavailable({ data: new Blob(['x'.repeat(octets)]) });
  }

  stop() {
    this.arrete = true;
    // Le vrai MediaRecorder rend son dernier bloc apres l'arret, pas pendant.
    queueMicrotask(() => { this.rendreBloc(7); this.onstop?.(); });
  }
}

/** Piste de micro qu'on pourra interroger : a-t-elle ete coupee ? */
function fauxFlux() {
  const piste = { arretee: false, stop() { this.arretee = true; } };
  return { piste, getTracks: () => [piste] };
}

function fabriquer({ supporte = () => true, flux = fauxFlux() } = {}) {
  let horloge = 1000;
  const recorder = new Recorder({
    openStream: async () => flux,
    Encoder: FauxEncodeur,
    isSupported: supporte,
    now: () => horloge,
  });
  return { recorder, flux, avancer: (ms) => { horloge += ms; } };
}

// --- Choix du format --------------------------------------------------------

test('le format retenu est le premier que l appareil accepte', () => {
  assert.equal(pickFormat(() => true).mime, FORMATS[0].mime);
  assert.equal(pickFormat((mime) => mime === 'audio/mp4').extension, 'm4a');
  assert.equal(pickFormat(() => false), null);
});

test('une sonde qui leve ne fait pas echouer le choix', () => {
  const capricieuse = (mime) => {
    if (mime.includes('codecs')) throw new Error('nom de codec refuse');
    return mime === 'audio/mp4';
  };
  assert.equal(pickFormat(capricieuse).mime, 'audio/mp4');
});

test('sans sonde, aucun format n est promis', () => {
  assert.equal(pickFormat(undefined), null);
});

// --- Nom du fichier ---------------------------------------------------------

test('le nom du fichier porte le titre et la date', () => {
  const nom = fileName('Répétition générale', new Date(2026, 8, 24, 9, 5), 'webm');
  assert.equal(nom, 'repetition-generale-2026-09-24-09h05.webm');
});

test('un titre vide ou impronongable retombe sur un nom utilisable', () => {
  const date = new Date(2026, 0, 2, 14, 30);
  assert.equal(fileName('', date, 'ogg'), 'souffleur-2026-01-02-14h30.ogg');
  assert.equal(fileName('«»  ///  ', date, 'ogg'), 'souffleur-2026-01-02-14h30.ogg');
  assert.equal(fileName(null, date, 'ogg'), 'souffleur-2026-01-02-14h30.ogg');
});

test('un titre tres long est coupe, jamais le reste du nom', () => {
  const nom = fileName('mot '.repeat(60), new Date(2026, 8, 24, 9, 5), 'webm');
  assert.ok(nom.endsWith('-2026-09-24-09h05.webm'), nom);
  assert.ok(nom.length < 90, `nom de ${nom.length} caracteres`);
});

test('la duree se lit en minutes et secondes', () => {
  assert.equal(clock(0), '00:00');
  assert.equal(clock(61.4), '01:01');
  assert.equal(clock(-5), '00:00');
});

// --- Cycle de l enregistrement ----------------------------------------------

test('une prise complete rend un fichier, sa duree et sa taille', async () => {
  const { recorder, flux, avancer } = fabriquer();
  assert.equal(recorder.state, 'idle');

  await recorder.start();
  assert.equal(recorder.state, 'recording');
  assert.equal(FauxEncodeur.dernier.stream, flux, 'l encodeur recoit la prise de son');
  assert.equal(FauxEncodeur.dernier.options.mimeType, FORMATS[0].mime);
  assert.equal(FauxEncodeur.dernier.tranche, 1000, 'un bloc par seconde');

  FauxEncodeur.dernier.rendreBloc(100);
  avancer(12_000);
  FauxEncodeur.dernier.rendreBloc(100);

  const prise = await recorder.stop();
  assert.equal(recorder.state, 'ready');
  assert.equal(prise.seconds, 12);
  assert.equal(prise.extension, 'webm');
  assert.equal(prise.bytes, 207, 'les deux blocs plus celui rendu a l arret');
  assert.equal(prise.blob.type, FORMATS[0].mime);
});

test('le dernier bloc, rendu apres l arret, n est pas perdu', async () => {
  const { recorder } = fabriquer();
  await recorder.start();
  FauxEncodeur.dernier.rendreBloc(50);
  const prise = await recorder.stop();
  // 50 pendant + 7 apres l arret : sans l attente, la fin manquerait.
  assert.equal(prise.bytes, 57);
});

test('le micro est referme des l arret', async () => {
  const { recorder, flux } = fabriquer();
  await recorder.start();
  assert.equal(flux.piste.arretee, false);
  await recorder.stop();
  assert.equal(flux.piste.arretee, true, 'la piste doit etre coupee');
  assert.equal(recorder.stream, null);
});

test('un appareil sans encodeur le dit, au lieu d enregistrer le silence', async () => {
  const { recorder } = fabriquer({ supporte: () => false });
  assert.equal(recorder.available, false);
  await assert.rejects(() => recorder.start(), /aucun format audio connu/);
  assert.equal(recorder.state, 'idle');
});

test('demander deux fois le depart ne relance rien', async () => {
  const { recorder } = fabriquer();
  await recorder.start();
  const premier = FauxEncodeur.dernier;
  await recorder.start();
  assert.equal(FauxEncodeur.dernier, premier, 'le meme encodeur continue');
});

test('arreter sans avoir demarre ne fabrique pas de fichier vide', async () => {
  const { recorder } = fabriquer();
  assert.equal(await recorder.stop(), null);
  assert.equal(recorder.state, 'idle');
});

test('une nouvelle prise remplace la precedente', async () => {
  const { recorder } = fabriquer();
  await recorder.start();
  FauxEncodeur.dernier.rendreBloc(500);
  const premiere = await recorder.stop();

  await recorder.start();
  assert.equal(recorder.state, 'recording');
  assert.equal(recorder.recording, null, 'la prise precedente est laissee de cote');
  FauxEncodeur.dernier.rendreBloc(10);
  const seconde = await recorder.stop();
  assert.ok(seconde.bytes < premiere.bytes, 'la seconde prise est bien la sienne');
});

test('la duree affichee suit la prise, puis se fige', async () => {
  const { recorder, avancer } = fabriquer();
  assert.equal(recorder.seconds, 0);
  await recorder.start();
  avancer(5_000);
  assert.equal(recorder.seconds, 5, 'pendant : elle avance');
  await recorder.stop();
  avancer(30_000);
  assert.equal(recorder.seconds, 5, 'apres : elle ne bouge plus');
});

test('jeter la prise remet l enregistreur a neuf', async () => {
  const { recorder } = fabriquer();
  await recorder.start();
  FauxEncodeur.dernier.rendreBloc(10);
  await recorder.stop();
  recorder.discard();
  assert.equal(recorder.state, 'idle');
  assert.equal(recorder.recording, null);
  assert.equal(recorder.seconds, 0);
});

// --- Le micro ne doit jamais rester ouvert pour rien -------------------------

test('un encodeur qui refuse a la construction referme le micro', async () => {
  const flux = fauxFlux();
  const recorder = new Recorder({
    openStream: async () => flux,
    Encoder: class { constructor() { throw new Error('format refuse'); } },
    isSupported: () => true,
  });

  await assert.rejects(() => recorder.start(), /format refuse/);
  assert.equal(flux.piste.arretee, true, 'la piste doit etre coupee');
  assert.equal(recorder.stream, null);
  assert.equal(recorder.state, 'idle');
});

test('un encodeur qui refuse de demarrer referme le micro', async () => {
  const flux = fauxFlux();
  const recorder = new Recorder({
    openStream: async () => flux,
    Encoder: class { start() { throw new Error('demarrage refuse'); } },
    isSupported: () => true,
  });

  await assert.rejects(() => recorder.start(), /demarrage refuse/);
  assert.equal(flux.piste.arretee, true, 'la piste doit etre coupee');
  assert.equal(recorder.state, 'idle');
  assert.equal(recorder.encoder, null);
});

test('jeter la prise referme le micro, meme reste ouvert', async () => {
  const flux = fauxFlux();
  const recorder = new Recorder({
    openStream: async () => flux,
    Encoder: FauxEncodeur,
    isSupported: () => true,
  });

  await recorder.start();
  // On jette sans passer par stop() : c'est ce que fait l'interface quand le
  // demarrage a mal tourne.
  recorder.discard();
  assert.equal(flux.piste.arretee, true, 'discard doit couper la prise de son');
  assert.equal(recorder.state, 'idle');
});
