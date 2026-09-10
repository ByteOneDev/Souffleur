# Politique de confidentialité — Souffleur

*Dernière mise à jour : 10 septembre 2026*

## En une phrase

Souffleur ne collecte aucune donnée personnelle, n'a aucun compte, aucun
serveur, et votre voix ne quitte pas votre appareil.

## Ce que l'application fait de votre voix

Souffleur écoute le micro pendant que vous lisez, uniquement lorsque vous
appuyez sur **Démarrer**, et uniquement pour repérer votre position dans le
texte que vous lui avez donné.

Par défaut, la reconnaissance vocale s'exécute **entièrement sur votre
appareil**, au moyen du moteur Vosk et d'un modèle téléchargé une fois. Aucun
enregistrement n'est conservé : l'audio est analysé au fil de l'eau puis
disparaît. Rien n'est transmis, à personne.

**Une exception, que vous choisissez explicitement.** L'application propose un
moteur de secours nommé « Navigateur (Web Speech) ». Si — et seulement si —
vous le sélectionnez, la reconnaissance est assurée par le navigateur, ce qui
implique l'envoi de l'audio aux serveurs de son éditeur, selon les conditions
de celui-ci et non les nôtres. Le moteur local reste le choix par défaut.

## Ce que l'application fait de vos textes

Vos discours sont enregistrés dans le stockage local de l'application, sur
votre appareil. Ils ne sont pas synchronisés, pas sauvegardés en ligne, et ne
nous sont jamais envoyés. Désinstaller l'application ou effacer ses données les
supprime définitivement.

## Ce que l'application ne fait pas

- Aucun compte, aucune inscription, aucune identification.
- Aucune mesure d'audience, aucun traqueur, aucune publicité.
- Aucun partage avec des tiers, puisqu'il n'y a rien à partager.
- Aucune collecte de données de localisation, de contacts ou d'identifiants.

## Connexions réseau

L'application n'accède au réseau que dans deux cas :

1. **Le téléchargement du modèle vocal**, une seule fois, depuis
   `alphacephei.com`. Aucune donnée personnelle n'accompagne cette requête.
2. **Les fonctions d'assistance rédactionnelle**, si vous en ajoutez une en
   fournissant votre propre clé d'interface de programmation. Le texte que vous
   soumettez est alors envoyé au fournisseur que vous avez choisi, selon ses
   conditions. Votre clé est rangée sur votre appareil et ne nous parvient
   jamais.

En dehors de ces deux cas, l'application fonctionne hors ligne.

## Autorisations demandées

| Autorisation | Pourquoi |
|---|---|
| Micro | suivre votre voix dans le texte, pendant la lecture uniquement |
| Internet | télécharger le modèle vocal une fois |

L'autorisation micro est facultative : sans elle, l'application reste utilisable
en défilement manuel.

## Enfants

L'application ne s'adresse pas particulièrement aux enfants et ne collecte
aucune donnée, quel que soit l'âge de la personne qui l'utilise.

## Modifications

Toute modification de cette politique sera publiée sur cette page, avec sa date.

## Contact

Pour toute question relative à cette politique, ouvrez un ticket sur le dépôt
public du projet.
