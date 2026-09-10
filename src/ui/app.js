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
import { readTheme, applyTheme, saveTheme, nextTheme } from './theme.js';
import { garderEcranAllume, libererEcran } from './wakelock.js';

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
  locked: false,
  startedAt: null,
  targetSeconds: 0,
  wordElements: [],
  lastPainted: -2,
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
  prepare(entry.source);
  renderLibrary();
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
  state.wordElements = [];
  for (const element of $('#prompter').querySelectorAll('[data-i]')) {
    state.wordElements[Number(element.dataset.i)] = element;
  }
  state.lastPainted = -2;
  paint(-1);
  updateStats();
}

function paint(cursor) {
  if (cursor === state.lastPainted) return;
  const previous = state.lastPainted;
  state.lastPainted = cursor;

  // On ne repeint que la zone qui change, pas les milliers de mots du texte.
  const from = Math.max(0, Math.min(previous, cursor) - 2);
  const to = Math.min(state.wordElements.length - 1, Math.max(previous, cursor) + 2);
  for (let i = from; i <= to; i++) {
    const element = state.wordElements[i];
    if (!element) continue;
    element.classList.toggle('said', i < cursor);
    element.classList.toggle('current', i === cursor);
  }

  const current = state.wordElements[cursor];
  if (current) {
    const view = $('#prompter-view');
    view.scrollTo({ top: current.offsetTop - view.clientHeight * 0.38, behavior: 'smooth' });
  }
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
  // Sur telephone comme sur portable, l'ecran ne doit pas s'eteindre en plein
  // discours parce que personne n'a touche le clavier depuis deux minutes.
  garderEcranAllume();
  $('#toggle').textContent = 'Arrêter';
  document.body.classList.add('running');
  updateStats();
}

async function stop() {
  if (!state.running) return;
  state.running = false;
  await libererEcran();
  await state.engine?.stop();
  state.engine = null;
  $('#toggle').textContent = 'Démarrer';
  document.body.classList.remove('running');
  updateStats();
}

/**
 * Verrouiller le texte : une fois en situation, une frappe accidentelle ne doit
 * pas pouvoir modifier le discours. C'est une securite d'usage, pas de securite
 * informatique.
 */
function setLocked(locked) {
  state.locked = locked;
  $('#source').readOnly = locked;
  $('#title').readOnly = locked;
  document.body.classList.toggle('locked', locked);
  $('#lock').textContent = locked ? '🔒 verrouillé' : '🔓 modifiable';
  $('#lock').setAttribute('aria-pressed', String(locked));
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
  let theme = applyTheme(readTheme());
  $('#theme').textContent = theme;
  $('#theme').addEventListener('click', () => {
    theme = applyTheme(nextTheme(theme));
    saveTheme(theme);
    $('#theme').textContent = theme;
  });

  const entries = library.recent();
  open(entries.length ? entries[0] : library.create({ source: EXAMPLE, profile: 'discours' }));

  $('#texts').addEventListener('click', (event) => {
    const button = event.target.closest('.entry');
    if (button) open(library.get(button.dataset.id));
  });
  $('#filter').addEventListener('input', renderLibrary);
  $('#new-text').addEventListener('click', () => {
    open(library.create({ source: '# Nouveau discours\n\n', profile: state.profile }));
    $('#source').focus();
  });
  $('#delete-text').addEventListener('click', () => {
    if (!state.entryId || !confirm('Supprimer définitivement ce texte ?')) return;
    library.remove(state.entryId);
    const rest = library.recent();
    open(rest.length ? rest[0] : library.create({ source: EXAMPLE }));
  });

  $('#source').addEventListener('input', (event) => {
    if (state.locked) return;
    prepare(event.target.value);
    scheduleSave();
  });
  $('#title').addEventListener('input', scheduleSave);
  $('#lock').addEventListener('click', () => setLocked(!state.locked));

  for (const input of document.querySelectorAll('input[name="profile"]')) {
    input.addEventListener('change', (event) => {
      state.profile = event.target.value;
      updateProfileHint();
      prepare($('#source').value);
      scheduleSave();
    });
  }
  for (const input of document.querySelectorAll('input[name="readfont"]')) {
    input.addEventListener('change', (event) => {
      $('#prompter').classList.toggle('mono', event.target.value === 'mono');
    });
  }

  $('#engine').addEventListener('change', (event) => {
    $('#model-row').hidden = event.target.value !== 'vosk';
  });
  $('#target').addEventListener('input', (event) => {
    state.targetSeconds = Number(event.target.value) * 60;
    updateStats();
    scheduleSave();
  });

  $('#toggle').addEventListener('click', () => (state.running ? stop() : start()));
  $('#reset').addEventListener('click', () => {
    state.aligner.reset();
    state.startedAt = Date.now();
    paint(-1);
    updateStats();
  });
  $('#font-size').addEventListener('input', (event) => {
    $('#prompter').style.fontSize = `${event.target.value}px`;
  });
  $('#mirror').addEventListener('change', (event) => {
    $('#prompter-view').classList.toggle('mirror', event.target.checked);
  });

  document.addEventListener('keydown', (event) => {
    if (['TEXTAREA', 'INPUT', 'SELECT'].includes(event.target.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); if (state.running) stop(); else start(); }
    if (event.key === 'l') setLocked(!state.locked);
    if (event.key === 'f') document.documentElement.requestFullscreen?.();
    // Rattrapage manuel : l'orateur reprend la main si le suivi decroche.
    if (event.key === 'ArrowDown') { state.aligner.cursor += 1; paint(state.aligner.position); }
    if (event.key === 'ArrowUp') { state.aligner.cursor -= 1; paint(state.aligner.position); }
  });

  setupEngines();
  setLocked(false);
  setInterval(() => { if (state.running) updateStats(); }, 1000);
}

bind();
