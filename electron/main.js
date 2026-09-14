/**
 * Enveloppe Electron (macOS, Windows, Linux).
 *
 * L'application est du web pur : elle n'a besoin ni de Node, ni du systeme de
 * fichiers, ni d'aucun pont vers le processus principal. La fenetre est donc
 * configuree au plus strict — c'est la posture par defaut recommandee, et la
 * source la plus frequente de failles dans les applications Electron quand on
 * s'en ecarte « juste pour essayer ».
 *
 *   - isolation du contexte activee : la page ne partage rien avec Node ;
 *   - integration Node desactivee : `require` n'existe pas dans la page ;
 *   - aucun preload, donc aucune passerelle exposee ;
 *   - navigation et fenetres externes refusees : un lien ne peut pas emmener
 *     l'application ailleurs, il s'ouvre dans le navigateur du systeme.
 */
import { app, BrowserWindow, nativeTheme, net, protocol, shell, systemPreferences } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, normalize, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * L'application est servie par un schema a elle, et non en « file:// ».
 *
 * Ce n'est pas une preference d'ecriture : en « file:// », le fil principal de
 * la page peut lire les fichiers voisins, mais pas les Web Workers. Or le
 * moteur vocal charge le modele depuis un worker. L'appel echouait donc sur un
 * « Failed to fetch » que rien ne remontait a l'utilisateur : le chargement
 * restait suspendu jusqu'a expiration du delai, et l'application annoncait un
 * modele « illisible » alors qu'il etait present et intact.
 *
 * Un schema declare « standard » et « secure » donne a la page une origine
 * ordinaire. Les workers en heritent, le WebAssembly se charge, et le micro
 * obtient le contexte securise qu'il exige.
 */
const SCHEMA = 'souffleur';
const PAGE = `${SCHEMA}://app/index.html`;

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEMA,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

/** Sert un fichier du dossier de l'application, et rien d'autre. */
function servirFichier(request) {
  const { pathname } = new URL(request.url);
  const cible = normalize(join(ROOT, decodeURIComponent(pathname)));
  // Une adresse remontant hors du dossier livre n'a aucune raison d'exister :
  // elle est refusee plutot qu'interpretee.
  if (cible !== ROOT && !cible.startsWith(ROOT + sep)) {
    return new Response('Hors du dossier de l\'application', { status: 403 });
  }
  return net.fetch(pathToFileURL(cible).toString());
}

/**
 * Les trois pastilles de macOS, et la place que la page leur reserve.
 *
 * La barre de titre est masquee — elle serait une bande grise au-dessus d'un
 * ecran qui appartient au texte — mais les pastilles restent, posees par-dessus
 * le contenu au coin superieur gauche. Sans reserve, elles se superposent au
 * ruban et au premier indicateur.
 *
 * Les deux valeurs sortent des memes nombres au lieu d'etre ajustees a l'oeil
 * chacune de son cote : on dit ou poser les pastilles, et la reserve s'en
 * deduit. Elles ne peuvent donc plus diverger.
 */
const PASTILLE = 12;          // diametre d'une pastille
const ECART = 8;              // intervalle entre deux pastilles
const MARGE = 18;             // depuis le bord gauche de la fenetre
const LARGEUR_PASTILLES = 3 * PASTILLE + 2 * ECART;
// Hauteur de la barre du haut, mesuree dans la page. Elle ne sert qu'a centrer
// les pastilles : quelques pixels d'ecart ne se voient pas.
const HAUTEUR_BARRE = 63;
const POSITION_PASTILLES = { x: MARGE, y: Math.round((HAUTEUR_BARRE - PASTILLE) / 2) };

/*
 * La reserve est injectee ici plutot qu'ecrite dans la feuille de style :
 * servie dans un navigateur, la meme page n'a pas de pastilles et n'aurait
 * qu'un trou inexplique a gauche. La poignee de deplacement, elle, vit dans
 * app.css — elle est sans effet hors d'une fenetre de bureau.
 */
const RESERVE_PASTILLES = `.bar { padding-left: ${MARGE + LARGEUR_PASTILLES + MARGE}px; }`;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 520,
    title: 'Souffleur',
    // Le fond de la fenetre suit le theme : sinon la fenetre s'ouvre sur un
    // aplat de la mauvaise couleur avant que la page ne s'affiche.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121316' : '#f3efe6',
    // Le titre se fond dans l'interface plutot que d'ajouter une barre grise.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'darwin' ? { trafficLightPosition: POSITION_PASTILLES } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: true,
    },
  });

  window.loadURL(PAGE);

  // A chaque chargement, y compris apres un rechargement de la page.
  if (process.platform === 'darwin') {
    window.webContents.on('did-finish-load', () => {
      window.webContents.insertCSS(RESERVE_PASTILLES);
    });
  }

  // Un lien externe s'ouvre dans le navigateur, jamais dans l'application.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEMA}://`)) event.preventDefault();
  });

  const suivreTheme = () => {
    window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#121316' : '#f3efe6');
  };
  nativeTheme.on('updated', suivreTheme);
  window.on('closed', () => nativeTheme.off('updated', suivreTheme));

  return window;
}

/**
 * Le micro est le coeur de l'outil : mieux vaut demander l'autorisation au
 * lancement, au calme, qu'au moment ou l'orateur appuie sur « Démarrer ».
 */
async function ensureMicrophone() {
  if (process.platform !== 'darwin') return;
  try {
    if (systemPreferences.getMediaAccessStatus('microphone') !== 'granted') {
      await systemPreferences.askForMediaAccess('microphone');
    }
  } catch {
    // Refus ou version sans cette API : l'application demandera au demarrage.
  }
}

app.whenReady().then(async () => {
  protocol.handle(SCHEMA, servirFichier);
  await ensureMicrophone();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
