/**
 * Prompteur : assemblage de l'interface.
 *
 * Cette couche ne contient ni logique d'alignement ni reconnaissance vocale :
 * elle relie un moteur vocal a l'aligneur, et traduit la position obtenue en
 * surbrillance, defilement et indicateurs de temps. Tout ce qui merite d'etre
 * teste vit ailleurs, dans des modules sans navigateur.
 */

import { parseScript } from '../script/parse.js';
import { buildFragments, renderHtml } from '../script/render.js';
import { tokenize } from '../align/tokenize.js';
import { Aligner } from '../align/aligner.js';
import { availableEngines, createEngine } from '../stt/index.js';
import { Library, countWords, estimateSeconds } from '../store/library.js';
import { readTheme, applyTheme, saveTheme } from './theme.js';
import { garderEcranAllume, libererEcran } from './wakelock.js';
import { Recorder, fileName, clock as chrono } from '../audio/recorder.js';

const $ = (selector) => document.querySelector(selector);

const EXAMPLE = `# Ouverture

Mesdames, messieurs, bonsoir. (2s) [[balayer la salle du regard]]

Je voudrais commencer par une **évidence** que nous avons collectivement
oubliée : la technique n'est ==jamais neutre==. Chaque outil que nous
construisons porte en lui une certaine idée de l'homme, et cette idée finit
toujours par se réaliser. (1s)

# Le renversement

En 2025, nous avons franchi un seuil. Les machines ne se contentent plus
d'exécuter nos ordres : elles **anticipent** nos désirs, elles les devancent,
et parfois _elles les fabriquent_.

# Les trois questions

Trois questions me semblent décisives. D'abord, **qui décide** ? Ensuite,
**au nom de quoi** ? Enfin, avec quelles conséquences pour ceux qui n'ont pas
voix au chapitre ? (2s)

Je vous remercie de votre attention.`;

const library = new Library();

const state = {
  entryId: null,
  profile: 'discours',
  tokens: [],
  script: null,
  aligner: null,
  engine: null,
  running: false,
  editing: false,
  startedAt: null,
  targetSeconds: 0,
  wordElements: [],
  recorder: null,
  recordedAt: null,
  recordedTitle: '',
  canRecord: false,
  lastPainted: -2,
  lastRevision: -1,
  saveTimer: null,
};

// --- Bibliotheque -----------------------------------------------------------

const clock = (seconds) => {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

function renderLibrary() {
  const filter = $('#filter').value.trim().toLowerCase();
  const entries = library.recent()
    .filter((entry) => !filter || entry.title.toLowerCase().includes(filter));

  $('#texts').innerHTML = entries.map((entry) => {
    const words = countWords(entry.source);
    const duration = clock(estimateSeconds(entry.source));
    return `<li aria-current="${entry.id === state.entryId}">
      <button class="entry" data-id="${entry.id}" type="button">
        <span class="title">${escapeText(entry.title)}</span>
        <span class="meta">${words} mots · ~${duration} · ${entry.profile}</span>
      </button></li>`;
  }).join('');
  $('#texts-empty').hidden = entries.length > 0;
}

const escapeText = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function open(entry) {
  state.entryId = entry.id;
  state.profile = entry.profile;
  state.targetSeconds = (entry.targetMinutes ?? 0) * 60;
  $('#source').value = entry.source;
  $('#title').value = entry.title;
  $('#target').value = entry.targetMinutes ?? 0;
  for (const input of document.querySelectorAll('input[name="profile"]')) {
    input.checked = input.value === entry.profile;
  }
  updateProfileHint();
  showTarget();
  showTitle();
  prepare(entry.source);
  renderLibrary();
  setEditing(false);
}

/** Le titre du texte courant sert d'etiquette au menu de la bibliotheque. */
function showTitle() {
  $('#text-menu-label').textContent = $('#title').value.trim() || 'sans titre';
}

function showTarget() {
  const minutes = Number($('#target').value);
  $('#target-value').textContent = minutes ? `${minutes} min` : 'libre';
}

/** Enregistrement differe : on ecrit apres la frappe, pas pendant. */
function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    if (!state.entryId) return;
    library.update(state.entryId, {
      source: $('#source').value,
      title: $('#title').value,
      profile: state.profile,
      targetMinutes: Number($('#target').value) || 0,
    });
    renderLibrary();
  }, 400);
}

// --- Preparation du texte ---------------------------------------------------

function prepare(source) {
  state.script = parseScript(source);
  state.tokens = tokenize(state.script.spoken);
  state.aligner = new Aligner(state.tokens, { profile: state.profile });

  $('#prompter').innerHTML = renderHtml(buildFragments(state.script, state.tokens));
  /*
   * Un mot dont le style ne couvre qu'une partie — « anti**constitutionnel** »
   * — se rend en deux morceaux portant le meme index. Ne garder que le dernier
   * laissait la premiere moitie du mot hors du suivi : jamais grisee, jamais
   * soulignee, jamais eclairee. On tient donc tous les morceaux.
   */
  state.wordElements = [];
  for (const element of $('#prompter').querySelectorAll('[data-i]')) {
    const index = Number(element.dataset.i);
    (state.wordElements[index] ??= []).push(element);
  }
  state.lastPainted = -2;
  state.lastRevision = -1;
  paint(-1);
  updateStats();
}

/**
 * Etat du texte a l'ecran : ce qui est lu, ce qui est en cours, et ce qui a
 * ete manque. Un mot depasse sans avoir jamais ete entendu — escamote, ou dit
 * de travers — reste souligne de rouge derriere le lecteur : le prompteur ne
 * s'arrete pas pour autant, il continue et laisse la trace.
 */
function paint(cursor) {
  const revision = state.aligner?.revision ?? 0;
  if (cursor === state.lastPainted && revision === state.lastRevision) return;
  const previous = state.lastPainted;
  const deplace = cursor !== state.lastPainted;
  state.lastPainted = cursor;
  state.lastRevision = revision;

  // On ne repeint que la zone qui change, pas les milliers de mots du texte.
  // Elle s'etend en arriere jusqu'a la fenetre de recul de l'aligneur : c'est
  // toute la portee ou un mot peut encore etre rendu a la lecture.
  const recul = (state.aligner?.opts.backWindow ?? 20) + 2;
  const from = Math.max(0, Math.min(previous, cursor) - recul);
  const to = Math.min(state.wordElements.length - 1, Math.max(previous, cursor) + 2);
  for (let i = from; i <= to; i++) {
    const morceaux = state.wordElements[i];
    if (!morceaux) continue;
    const lu = i < cursor;
    const manque = lu && !!state.aligner?.isMissed(i);
    for (const element of morceaux) {
      element.classList.toggle('said', lu);
      element.classList.toggle('current', i === cursor);
      element.classList.toggle('missed', manque);
    }
  }

  const current = state.wordElements[cursor]?.[0];
  if (deplace && current) {
    const view = $('#prompter-view');
    view.scrollTo({ top: current.offsetTop - view.clientHeight * 0.38, behavior: 'smooth' });
  }
}

/**
 * Rattrapage manuel, borne au texte.
 *
 * Sans borne, une touche maintenue emmenait le curseur avant le premier mot ou
 * au-dela du dernier : la barre de progression passait sous zero ou franchissait
 * les cent pour cent, et il fallait autant d'appuis en sens inverse pour revenir.
 * Les indicateurs suivent le geste, sinon ils resteraient sur la position que la
 * voix avait quittee.
 */
function deplacerCurseur(pas) {
  const aligneur = state.aligner;
  if (!aligneur) return;
  aligneur.cursor = Math.max(-1, Math.min(aligneur.tokens.length - 1, aligneur.cursor + pas));
  paint(aligneur.position);
  updateStats();
}

// --- Indicateurs ------------------------------------------------------------

const STATUS_LABEL = { idle: "à l'arrêt", locked: 'suivi', weak: 'suivi faible', lost: 'perdu' };

function updateStats() {
  const aligner = state.aligner;
  if (!aligner) return;

  const elapsed = state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0;
  const wpm = aligner.wordsPerMinute(30);
  const remaining = aligner.remainingSeconds();

  $('#stat-elapsed').textContent = clock(elapsed);
  $('#stat-progress').textContent = `${Math.round(aligner.progress * 100)} %`;
  $('#stat-wpm').textContent = wpm ? Math.round(wpm) : '—';
  $('#stat-remaining').textContent = remaining === null ? '—' : clock(remaining);
  $('#progress-bar').style.width = `${aligner.progress * 100}%`;

  // Avance / retard : le coeur de l'angoisse de l'orateur.
  const pace = $('#stat-pace');
  if (state.targetSeconds && aligner.progress > 0.02) {
    const delta = elapsed - state.targetSeconds * aligner.progress;
    pace.textContent = `${delta >= 0 ? '+' : '−'}${clock(Math.abs(delta))}`;
    pace.className = `value ${delta > 20 ? 'late' : delta < -20 ? 'early' : 'ontime'}`;
  } else {
    pace.textContent = '—';
    pace.className = 'value';
  }

  const mode = !state.running ? 'idle'
    : aligner.isLost ? 'lost'
    : aligner.confidence > 0.6 ? 'locked' : 'weak';
  $('#status').dataset.mode = mode;
  $('#status-label').textContent = STATUS_LABEL[mode];
}

// --- Moteur vocal -----------------------------------------------------------

async function start() {
  if (state.running) return;
  setEditing(false);
  toggleLibrary(false);
  const engineId = $('#engine').value;
  const options = engineId === 'simulated'
    ? { text: state.script.spoken, wpm: 150, scenario: { errorRate: 0.12, dropRate: 0.08, fillerRate: 0.05 } }
    : { modelUrl: $('#model-url').value.trim() || undefined };

  const engine = createEngine(engineId, options);
  const advance = (text, replace) => {
    if (replace) state.aligner.replace(text); else state.aligner.push(text);
    paint(state.aligner.position);
    updateStats();
  };
  engine.on('final', (text) => advance(text, false));
  // Une hypothese partielle remplace le tampon : le moteur se corrige lui-meme.
  engine.on('partial', (text) => advance(text, true));
  engine.on('error', (error) => { $('#message').textContent = `Moteur : ${error}`; });
  engine.on('state', (mode) => {
    if (mode === 'loading') $('#message').textContent = 'Chargement du modèle vocal…';
    if (mode === 'running') $('#message').textContent = '';
    if (mode === 'stopped') stop();
  });

  try {
    await engine.start();
  } catch (error) {
    $('#message').textContent = error.message;
    return;
  }

  state.engine = engine;
  state.running = true;
  state.startedAt = Date.now();
  await demarrerEnregistrement();
  // Sur telephone comme sur portable, l'ecran ne doit pas s'eteindre en plein
  // discours parce que personne n'a touche le clavier depuis deux minutes.
  garderEcranAllume();
  $('#toggle').textContent = 'Arrêter';
  $('#mode').disabled = true;
  // Le choix d'enregistrer se fait avant de parler : le revenir en route
  // laisserait une prise coupee en deux sans que rien ne le dise.
  $('#record').disabled = true;
  document.body.classList.add('running');
  updateStats();
}

/**
 * L'arret n'est pas instantane : fermer un enregistrement demande d'attendre
 * le dernier bloc, et fermer un moteur vocal prend aussi son temps.
 *
 * Pendant ces quelques centaines de millisecondes, un second clic partait
 * relancer une lecture — et l'arret, en reprenant, fermait le moteur tout neuf
 * qu'il venait de trouver a la place de l'ancien. On garde donc le moteur a
 * fermer de cote, et le bouton se desactive au lieu d'avaler le clic sans rien
 * dire.
 */
async function stop() {
  if (!state.running) return;
  state.running = false;
  const engine = state.engine;
  state.engine = null;
  $('#toggle').disabled = true;
  try {
    await arreterEnregistrement();
    await libererEcran();
    await engine?.stop();
  } finally {
    $('#toggle').disabled = false;
  }
  $('#toggle').textContent = 'Démarrer';
  $('#mode').disabled = false;
  $('#record').disabled = !state.canRecord;
  document.body.classList.remove('running');
  updateStats();
}

// --- Enregistrement ---------------------------------------------------------

/**
 * L'enregistrement prend sa propre prise de son.
 *
 * Celle du suivi appartient au moteur vocal, qui la consomme et ne la rend
 * pas. On garde la suppression de bruit — une salle n'est jamais silencieuse —
 * mais on coupe la correction automatique de gain : elle aplatit les nuances,
 * et ce sont elles qu'on vient reecouter.
 */
const ouvrirMicro = () => navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false,
  },
});

const creerEnregistreur = () => new Recorder({
  openStream: ouvrirMicro,
  Encoder: globalThis.MediaRecorder,
  isSupported: (mime) => globalThis.MediaRecorder?.isTypeSupported?.(mime) ?? false,
});

/** Temoin dans la barre, et etat de la section du panneau de reglages. */
function showRecording() {
  const enregistreur = state.recorder;
  $('#rec').hidden = enregistreur?.state !== 'recording';

  const prise = enregistreur?.recording;
  $('#record-ready').hidden = !prise;
  if (!prise) return;
  const megaoctets = prise.bytes / (1024 * 1024);
  $('#record-info').textContent = `${chrono(prise.seconds)} · ${megaoctets.toFixed(1)} Mo `
    + `· ${prise.extension}. Elle reste sur cet appareil jusqu'à l'export, `
    + `et la prochaine lecture la remplace.`;
}

async function demarrerEnregistrement() {
  if (!$('#record').checked) return;
  state.recorder ??= creerEnregistreur();
  try {
    await state.recorder.start();
  } catch (error) {
    // L'enregistrement est un supplement : le rater ne doit pas empecher de
    // parler. On le dit, et la lecture continue sans lui.
    $('#message').textContent = `Enregistrement impossible : ${error.message}`;
    state.recorder.discard();
  }
  showRecording();
}

async function arreterEnregistrement() {
  if (state.recorder?.state !== 'recording') return;
  try {
    await state.recorder.stop();
    /*
     * On retient l'heure ET le titre au moment de la prise, pas a l'export :
     * entre les deux, l'orateur peut ouvrir un autre texte — la bibliotheque
     * laisse volontairement l'enregistrement en place — et le fichier serait
     * alors parti sous le nom du texte qu'on regarde, pas de celui qu'on a lu.
     */
    state.recordedAt = new Date();
    state.recordedTitle = $('#title').value;
  } catch (error) {
    $('#message').textContent = `Enregistrement interrompu : ${error.message}`;
  }
  showRecording();
}

/**
 * Remise du fichier a l'utilisateur.
 *
 * Un lien de telechargement plutot qu'une ecriture directe : c'est le seul
 * chemin qui vaut a la fois dans le navigateur et dans l'application de
 * bureau, ou il ouvre la fenetre d'enregistrement du systeme. L'application
 * n'a ainsi besoin d'aucun acces au disque.
 */
function exporterEnregistrement() {
  const prise = state.recorder?.recording;
  if (!prise) return;
  const url = URL.createObjectURL(prise.blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = fileName(state.recordedTitle, state.recordedAt ?? new Date(), prise.extension);
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // L'adresse d'objet retient le fichier en memoire tant qu'elle existe ; on
  // laisse au telechargement le temps de demarrer avant de la relacher.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// --- Lecture et edition -----------------------------------------------------

/**
 * Les deux faces d'un meme ecran.
 *
 * En lecture, le texte est du texte mis en page : aucune frappe ne peut
 * l'atteindre. C'est la protection que le verrou d'autrefois demandait a
 * l'utilisateur de mettre lui-meme, et qu'il oubliait.
 *
 * En edition, le champ occupe la meme colonne, dans la meme police et a la
 * meme taille : ce qu'on ecrit est deja mis en page comme ce qu'on lira.
 */
function setEditing(editing) {
  // Pendant qu'on parle, le texte ne bouge pas.
  if (editing && state.running) return;
  /*
   * Seule une sortie d'edition justifie de reconstruire le texte lu — et donc
   * de repartir d'un aligneur neuf, curseur remis a zero. Demander la lecture
   * alors qu'on y est deja ne doit rien reconstruire : sinon, l'orateur qui
   * s'arrete en plein discours et repart se retrouve ramene au premier mot,
   * alors que « Revenir au debut » existe justement pour le demander.
   */
  const sortieDEdition = state.editing && !editing;
  state.editing = editing;

  const view = $('#prompter-view');
  // Retrouver sa place apres la bascule : les deux faces n'ont pas la meme
  // hauteur, mais on revient au meme endroit du texte.
  const debattement = view.scrollHeight - view.clientHeight;
  const position = debattement > 0 ? view.scrollTop / debattement : 0;

  document.body.classList.toggle('editing', editing);
  $('#prompter').hidden = editing;
  $('#source').hidden = !editing;
  $('#syntax').hidden = !editing;
  $('#mode').textContent = editing ? 'lire' : 'éditer';
  $('#mode').setAttribute('aria-pressed', String(editing));

  if (editing) {
    ajusterChamp();
    // Prendre le focus deplacerait le texte pour montrer le caret, juste avant
    // qu'on le remette a sa place : deux sauts au lieu d'aucun.
    $('#source').focus({ preventScroll: true });
  } else if (sortieDEdition) {
    prepare($('#source').value);
  }

  const cible = Math.max(0, view.scrollHeight - view.clientHeight) * position;
  view.scrollTo({ top: Math.round(cible), behavior: 'instant' });
}

/**
 * Le champ grandit avec le texte : c'est la page qui defile, pas un cadre.
 *
 * Mesurer sa hauteur naturelle oblige a le laisser se retracter un instant.
 * Le texte devient alors plus court que la place qu'il occupait, le navigateur
 * ramene le defilement dans les clous — et il n'en ressort pas tout seul quand
 * la hauteur revient. C'etait le sursaut de chaque frappe : le texte remontait,
 * puis le caret qu'on ramene a l'ecran le faisait redescendre. On rend donc sa
 * place au lecteur avant de laisser la main.
 */
function ajusterChamp() {
  const champ = $('#source');
  const view = $('#prompter-view');
  const place = view.scrollTop;
  champ.style.height = 'auto';
  champ.style.height = `${champ.scrollHeight}px`;
  if (view.scrollTop !== place) view.scrollTo({ top: place, behavior: 'instant' });
}

// --- Depliants --------------------------------------------------------------

function toggleLibrary(ouvrir) {
  const menu = $('#library');
  const voulu = ouvrir ?? menu.hidden;
  menu.hidden = !voulu;
  $('#text-menu').setAttribute('aria-expanded', String(voulu));
  if (voulu) $('#filter').focus();
}

function toggleSettings(ouvrir) {
  const panneau = $('#settings');
  const voulu = ouvrir ?? panneau.hidden;
  panneau.hidden = !voulu;
  $('#scrim').hidden = !voulu;
  $('#settings-open').setAttribute('aria-expanded', String(voulu));
}

function updateProfileHint() {
  $('#profile-hint').textContent = state.profile === 'lecture'
    ? 'Suivi au mot près, peu de tolérance aux écarts.'
    : 'Tolérant à l’improvisation, aux sauts et aux reprises.';
}

// --- Mise en place ----------------------------------------------------------

function setupEngines() {
  const select = $('#engine');
  const engines = availableEngines();
  select.innerHTML = engines
    .map((Engine) => `<option value="${Engine.id}">${Engine.label}</option>`).join('');
  select.value = engines.some((Engine) => Engine.id === 'vosk') ? 'vosk' : engines[0]?.id;
  $('#model-row').hidden = select.value !== 'vosk';
}

function bind() {
  const theme = applyTheme(readTheme());
  for (const input of document.querySelectorAll('input[name="theme"]')) {
    input.checked = input.value === theme;
    input.addEventListener('change', (event) => {
      applyTheme(event.target.value);
      saveTheme(event.target.value);
    });
  }

  const entries = library.recent();
  open(entries.length ? entries[0] : library.create({ source: EXAMPLE, profile: 'discours' }));

  // --- Bibliotheque ---------------------------------------------------------

  $('#text-menu').addEventListener('click', () => toggleLibrary());
  $('#texts').addEventListener('click', (event) => {
    const button = event.target.closest('.entry');
    if (!button) return;
    open(library.get(button.dataset.id));
    toggleLibrary(false);
  });
  $('#filter').addEventListener('input', renderLibrary);
  $('#new-text').addEventListener('click', () => {
    open(library.create({ source: '# Nouveau discours\n\n', profile: state.profile }));
    toggleLibrary(false);
    setEditing(true);
  });
  $('#delete-text').addEventListener('click', () => {
    if (!state.entryId || !confirm('Supprimer définitivement ce texte ?')) return;
    library.remove(state.entryId);
    const reste = library.recent();
    open(reste.length ? reste[0] : library.create({ source: EXAMPLE }));
    toggleLibrary(false);
  });

  // Un depliant se referme des qu'on regarde ailleurs.
  document.addEventListener('click', (event) => {
    if (!$('#library').hidden && !event.target.closest('.picker')) toggleLibrary(false);
  });

  // --- Reglages -------------------------------------------------------------

  $('#settings-open').addEventListener('click', () => toggleSettings());
  $('#settings-close').addEventListener('click', () => toggleSettings(false));
  $('#scrim').addEventListener('click', () => toggleSettings(false));

  $('#title').addEventListener('input', () => { showTitle(); scheduleSave(); });
  $('#target').addEventListener('input', (event) => {
    state.targetSeconds = Number(event.target.value) * 60;
    showTarget();
    updateStats();
    scheduleSave();
  });

  for (const input of document.querySelectorAll('input[name="profile"]')) {
    input.addEventListener('change', (event) => {
      state.profile = event.target.value;
      updateProfileHint();
      /*
       * Le texte n'a pas bouge : seuls les reglages de suivi changent. Le
       * reconstruire remettait le curseur au premier mot — un reglage qu'on
       * touche volontiers en plein discours, justement parce que le suivi
       * decroche, et qui faisait alors perdre sa place a l'orateur.
       */
      state.aligner.setProfile(state.profile);
      scheduleSave();
    });
  }

  $('#engine').addEventListener('change', (event) => {
    $('#model-row').hidden = event.target.value !== 'vosk';
  });

  // Un appareil sans enregistreur le dit tout de suite, plutot que de laisser
  // cocher une case qui ne fera rien au moment ou l'on parle.
  state.canRecord = creerEnregistreur().available;
  if (!state.canRecord) {
    $('#record').checked = false;
    $('#record').disabled = true;
    $('#record-hint').textContent = "Cet appareil n'expose pas d'enregistreur audio.";
  }
  $('#record-export').addEventListener('click', exporterEnregistrement);

  $('#font-size').addEventListener('input', (event) => {
    $('#prompter-view').style.fontSize = `${event.target.value}px`;
    $('#font-size-value').textContent = `${event.target.value} px`;
    if (state.editing) ajusterChamp();
  });
  for (const input of document.querySelectorAll('input[name="readfont"]')) {
    input.addEventListener('change', (event) => {
      $('#prompter-view').classList.toggle('mono', event.target.value === 'mono');
      if (state.editing) ajusterChamp();
    });
  }
  $('#mirror').addEventListener('change', (event) => {
    $('#prompter-view').classList.toggle('mirror', event.target.checked);
  });

  // --- Lecture et edition ---------------------------------------------------

  $('#mode').addEventListener('click', () => setEditing(!state.editing));
  // Le texte lui-meme est la porte d'entree : on clique dedans pour le corriger.
  $('#prompter').addEventListener('click', () => { if (!state.running) setEditing(true); });
  $('#source').addEventListener('input', () => {
    // Le texte lu est reconstruit en sortant d'edition, pas a chaque frappe :
    // il n'est meme pas affiche pendant ce temps.
    ajusterChamp();
    scheduleSave();
  });

  $('#toggle').addEventListener('click', () => (state.running ? stop() : start()));
  $('#reset').addEventListener('click', () => {
    state.aligner.reset();
    state.startedAt = Date.now();
    paint(-1);
    updateStats();
  });

  // --- Clavier --------------------------------------------------------------

  document.addEventListener('keydown', (event) => {
    // Echap referme ce qui est ouvert, y compris depuis le champ d'edition.
    if (event.key === 'Escape') {
      if (!$('#settings').hidden) return toggleSettings(false);
      if (!$('#library').hidden) return toggleLibrary(false);
      if (state.editing) setEditing(false);
      return;
    }
    if (['TEXTAREA', 'INPUT', 'SELECT'].includes(event.target.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); if (state.running) stop(); else start(); }
    if (event.key === 'e') setEditing(!state.editing);
    if (event.key === 'f') document.documentElement.requestFullscreen?.();
    // Rattrapage manuel : l'orateur reprend la main si le suivi decroche.
    if (event.key === 'ArrowDown') deplacerCurseur(1);
    if (event.key === 'ArrowUp') deplacerCurseur(-1);
  });

  setupEngines();
  setInterval(() => { if (state.running) updateStats(); }, 1000);
}

bind();
