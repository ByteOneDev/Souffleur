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
import { app, BrowserWindow, nativeTheme, shell, systemPreferences } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'index.html');

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 520,
    title: 'Prompteur',
    // Le fond de la fenetre suit le theme : sinon la fenetre s'ouvre sur un
    // aplat de la mauvaise couleur avant que la page ne s'affiche.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121316' : '#f3efe6',
    // Le titre se fond dans l'interface plutot que d'ajouter une barre grise.
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: true,
    },
  });

  window.loadFile(PAGE);

  // Un lien externe s'ouvre dans le navigateur, jamais dans l'application.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
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
  await ensureMicrophone();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
