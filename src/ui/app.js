/**
 * Prompteur : assemblage de l'interface.
 *
 * Cette couche ne contient aucune logique d'alignement ni de reconnaissance :
 * elle branche un moteur vocal sur l'aligneur, et traduit la position rendue
 * en surbrillance, defilement et indicateurs de temps. C'est deliberement la
 * partie la plus jetable du spike ; le moteur, lui, est teste.
 */

import { parseScript } from '../script/parse.js';
import { buildFragments, renderHtml } from '../script/render.js';
import { tokenize } from '../align/tokenize.js';
import { Aligner } from '../align/aligner.js';
import { availableEngines, createEngine } from '../stt/index.js';

const $ = (selector) => document.querySelector(selector);

const state = {
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
};

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

// --- Preparation du texte --------------------------------------------------

function prepare(source) {
  state.script = parseScript(source);
  state.tokens = tokenize(state.script.spoken);
  state.aligner = new Aligner(state.tokens, { profile: state.profile });

  const fragments = buildFragments(state.script, state.tokens);
  $('#prompter').innerHTML = renderHtml(fragments);
  state.wordElements = [];
  for (const element of $('#prompter').querySelectorAll('[data-i]')) {
    state.wordElements[Number(element.dataset.i)] = element;
  }
  state.lastPainted = -2;
  paint(-1);
  updateStats();
}

// --- Rendu de la position --------------------------------------------------

function paint(cursor) {
  if (cursor === state.lastPainted) return;
  const previous = state.lastPainted;
  state.lastPainted = cursor;

  // On ne repeint que la zone qui change, pas les milliers de mots du texte.
  const from = Math.min(previous, cursor) - 2;
  const to = Math.max(previous, cursor) + 2;
  for (let i = Math.max(0, from); i <= Math.min(state.wordElements.length - 1, to); i++) {
    const element = state.wordElements[i];
    if (!element) continue;
    element.classList.toggle('said', i < cursor);
    element.classList.toggle('current', i === cursor);
  }

  const current = state.wordElements[cursor];
  if (current) {
    const container = $('#prompter-view');
    const target = current.offsetTop - container.clientHeight * 0.38;
    container.scrollTo({ top: target, behavior: 'smooth' });
  }
}

// --- Indicateurs -----------------------------------------------------------

const clock = (seconds) => {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

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
    const expected = state.targetSeconds * aligner.progress;
    const delta = elapsed - expected;
    pace.textContent = `${delta >= 0 ? '+' : '−'}${clock(Math.abs(delta))}`;
    pace.className = `value ${delta > 20 ? 'late' : delta < -20 ? 'early' : 'ontime'}`;
  } else {
    pace.textContent = '—';
    pace.className = 'value';
  }

  const status = $('#status');
  if (!state.running) status.dataset.mode = 'idle';
  else if (aligner.isLost) status.dataset.mode = 'lost';
  else if (aligner.confidence > 0.6) status.dataset.mode = 'locked';
  else status.dataset.mode = 'weak';
  $('#confidence').style.setProperty('--level', `${Math.round(aligner.confidence * 100)}%`);
}

// --- Moteur vocal ----------------------------------------------------------

async function start() {
  if (state.running) return;
  const engineId = $('#engine').value;
  const options = engineId === 'simulated'
    ? { text: state.script.spoken, wpm: 150, scenario: { errorRate: 0.12, dropRate: 0.08, fillerRate: 0.05 } }
    : { modelUrl: $('#model-url').value.trim() || undefined };

  const engine = createEngine(engineId, options);
  engine.on('final', (text) => {
    state.aligner.push(text);
    paint(state.aligner.position);
    updateStats();
  });
  // Une hypothese partielle remplace le tampon : le moteur se corrige lui-meme.
  engine.on('partial', (text) => {
    state.aligner.replace(text);
    paint(state.aligner.position);
    updateStats();
  });
  engine.on('error', (error) => { $('#message').textContent = `Moteur : ${error}`; });
  engine.on('state', (mode) => {
    if (mode === 'loading') $('#message').textContent = 'Chargement du modèle vocal…';
    if (mode === 'running') $('#message').textContent = '';
    if (mode === 'stopped') stop();
  });

  try {
    await engine.start();
  } catch (error) {
    $('#message').textContent = `Démarrage impossible : ${error.message}`;
    return;
  }

  state.engine = engine;
  state.running = true;
  state.startedAt = Date.now();
  $('#toggle').textContent = 'Arrêter';
  document.body.classList.add('running');
  updateStats();
}

async function stop() {
  if (!state.running) return;
  state.running = false;
  await state.engine?.stop();
  state.engine = null;
  $('#toggle').textContent = 'Démarrer';
  document.body.classList.remove('running');
  updateStats();
}

// --- Verrouillage ----------------------------------------------------------

/**
 * Verrouiller le texte : une fois en situation, une frappe accidentelle ne
 * doit pas pouvoir modifier le discours. C'est une securite d'usage, pas de
 * securite informatique.
 */
function setLocked(locked) {
  state.locked = locked;
  $('#source').readOnly = locked;
  document.body.classList.toggle('locked', locked);
  $('#lock').textContent = locked ? '🔒 Texte verrouillé' : '🔓 Texte modifiable';
  $('#lock').setAttribute('aria-pressed', String(locked));
}

// --- Mise en place ---------------------------------------------------------

function setupEngines() {
  const select = $('#engine');
  select.innerHTML = '';
  for (const Engine of availableEngines()) {
    const option = document.createElement('option');
    option.value = Engine.id;
    option.textContent = Engine.label;
    select.appendChild(option);
  }
  const preferred = availableEngines().find((Engine) => Engine.id === 'vosk') ? 'vosk' : select.value;
  select.value = preferred;
  select.dispatchEvent(new Event('change'));
}

function bind() {
  $('#source').value = EXAMPLE;
  prepare(EXAMPLE);

  $('#source').addEventListener('input', (event) => {
    if (state.locked) return;
    prepare(event.target.value);
  });

  $('#lock').addEventListener('click', () => setLocked(!state.locked));

  for (const input of document.querySelectorAll('input[name="profile"]')) {
    input.addEventListener('change', (event) => {
      state.profile = event.target.value;
      prepare($('#source').value);
      $('#profile-hint').textContent = state.profile === 'lecture'
        ? 'Suivi au mot près, peu de tolérance aux écarts.'
        : 'Tolérant à l’improvisation, aux sauts et aux reprises.';
    });
  }

  $('#engine').addEventListener('change', (event) => {
    $('#model-row').hidden = event.target.value !== 'vosk';
  });

  $('#target').addEventListener('input', (event) => {
    state.targetSeconds = Number(event.target.value) * 60;
    updateStats();
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
    if (event.target.tagName === 'TEXTAREA' || event.target.tagName === 'INPUT') return;
    if (event.code === 'Space') { event.preventDefault(); state.running ? stop() : start(); }
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
