/**
 * Panneau d'assistance rédactionnelle.
 *
 * Deux principes tiennent cette couche :
 *
 * - Le texte de l'orateur n'est jamais remplacé sans son accord. Une réécriture
 *   s'affiche d'abord, et c'est lui qui décide de l'appliquer. Écraser un
 *   discours préparé sur la foi d'une suggestion serait impardonnable.
 * - La clé n'est ni affichée ni journalisée. Le champ est un champ de mot de
 *   passe, et une fois enregistrée seule sa forme masquée réapparaît.
 */

import { TACHES } from '../ai/tasks.js';
import { executer } from '../ai/client.js';
import { lireCle, ecrireCle, effacerCle, formeValide, masquer } from '../ai/key.js';

const $ = (s) => document.querySelector(s);

export function installerAssistant({ lireTexte, ecrireTexte, dureeVisee }) {
  const etat = { enCours: null, resultat: null, tache: null };

  function majEtatCle() {
    const cle = lireCle();
    $('#cle-etat').textContent = cle ? `clé enregistrée · ${masquer(cle)}` : 'aucune clé enregistrée';
    $('#cle-champ').hidden = Boolean(cle);
    $('#cle-enregistrer').hidden = Boolean(cle);
    $('#cle-effacer').hidden = !cle;
    for (const bouton of document.querySelectorAll('.tache')) bouton.disabled = !cle;
  }

  $('#cle-enregistrer').addEventListener('click', () => {
    const saisie = $('#cle-champ').value.trim();
    if (!formeValide(saisie)) {
      $('#ia-message').textContent = 'Cette clé ne ressemble pas à une clé Anthropic (sk-ant-…).';
      return;
    }
    ecrireCle(saisie);
    $('#cle-champ').value = '';
    $('#ia-message').textContent = '';
    majEtatCle();
  });

  $('#cle-effacer').addEventListener('click', () => {
    effacerCle();
    majEtatCle();
  });

  function afficherResultat(texte, tache) {
    etat.resultat = texte;
    etat.tache = tache;
    $('#ia-resultat').textContent = texte;
    $('#ia-sortie').hidden = false;
    // Seule une réécriture peut remplacer le discours ; une fiche ou une liste
    // de questions est un document à part.
    $('#ia-appliquer').hidden = !TACHES[tache]?.remplaceLeTexte;
  }

  async function lancer(nom) {
    if (etat.enCours) { etat.enCours.abort(); return; }
    const texte = lireTexte();
    if (!texte.trim()) { $('#ia-message').textContent = 'Le texte est vide.'; return; }

    const controleur = new AbortController();
    etat.enCours = controleur;
    document.body.classList.add('ia-active');
    $('#ia-message').textContent = `${TACHES[nom].titre}…`;
    $('#ia-resultat').textContent = '';
    $('#ia-sortie').hidden = false;
    $('#ia-appliquer').hidden = true;

    let accumule = '';
    try {
      const { texte: resultat } = await executer({
        cle: lireCle(),
        tache: nom,
        texte,
        contexte: { minutes: dureeVisee() || 5 },
        signal: controleur.signal,
        surTexte: (fragment) => {
          accumule += fragment;
          $('#ia-resultat').textContent = accumule;
          $('#ia-resultat').scrollTop = $('#ia-resultat').scrollHeight;
        },
      });
      afficherResultat(resultat, nom);
      $('#ia-message').textContent = '';
    } catch (erreur) {
      if (erreur?.name === 'AbortError') $('#ia-message').textContent = 'Interrompu.';
      else $('#ia-message').textContent = erreur.message;
    } finally {
      etat.enCours = null;
      document.body.classList.remove('ia-active');
    }
  }

  for (const bouton of document.querySelectorAll('.tache')) {
    bouton.addEventListener('click', () => lancer(bouton.dataset.tache));
  }

  $('#ia-appliquer').addEventListener('click', () => {
    if (!etat.resultat) return;
    ecrireTexte(etat.resultat);
    $('#ia-sortie').hidden = true;
    $('#ia-message').textContent = 'Texte remplacé.';
  });

  $('#ia-fermer').addEventListener('click', () => {
    $('#ia-sortie').hidden = true;
    $('#ia-message').textContent = '';
  });

  majEtatCle();
}
