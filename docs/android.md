# Android, expliqué simplement

## Pourquoi ce n'est pas juste « cocher Android »

Electron, c'est un navigateur (Chromium) plus Node.js, empaquetés ensemble pour
un ordinateur. Il n'existe pas de version Android : ce n'est pas une option
désactivée, c'est un logiciel conçu pour le bureau.

Android a besoin d'une autre enveloppe. C'est le rôle de **Capacitor** : il
prend exactement la même application web et l'installe dans une application
Android, qui affiche la page dans une WebView — le navigateur intégré du
système.

D'où la structure du projet :

```
        le cœur, écrit une seule fois
        (index.html, src/, vendor/)
                    │
        ┌───────────┴───────────┐
    Electron                Capacitor
   macOS · Windows           Android
```

Rien n'est écrit deux fois. Les deux enveloppes affichent le même dossier.

## Ce qui est déjà fait

Le projet Android est **généré et configuré** dans `android/`. Trois choses y
ont été réglées, dont deux qui cassent l'application si on les oublie :

- **La permission micro.** Le gabarit de Capacitor ne déclare que l'accès
  internet. Sans `RECORD_AUDIO`, la WebView refuse le micro sans message
  exploitable — on croit à un bug du moteur vocal alors que c'est une ligne
  manquante dans le manifeste.
- **L'écran qui reste allumé.** Un prompteur dont l'écran s'éteint au milieu
  d'un discours ne sert à rien. L'application prend un verrou d'écran pendant
  la lecture et le rend à l'arrêt — y compris après un appel reçu, ce que le
  système ne fait pas tout seul.
- **Le micro déclaré non obligatoire à l'installation.** Sans micro,
  l'application reste utilisable en défilement manuel : aucune raison d'exclure
  un appareil.

## Ce que vous faites, sur votre Mac

Android Studio est bien l'outil qu'il faut — c'est l'environnement officiel de
Google, et il contient le compilateur, l'émulateur et le gestionnaire de SDK.
Il ne peut simplement pas tourner dans l'environnement d'intégration où ce code
a été écrit : le processeur n'y expose aucune virtualisation, et les serveurs
de Google y sont bloqués par la politique réseau.

Sur votre machine, en revanche :

```bash
npm install          # récupère les dépendances et remplit vendor/
npm run build        # assemble l'application dans www/
npx cap sync android # recopie www/ dans le projet Android
npx cap open android # ouvre Android Studio
```

Puis, dans Android Studio : brancher le téléphone en USB (débogage USB activé),
choisir l'appareil en haut, et appuyer sur **Run**. L'application s'installe et
se lance. Comptez un quart d'heure la première fois — Android Studio télécharge
le SDK et Gradle.

## Donner l'application à des amis

Deux chemins, et le premier suffit largement pour un cercle restreint.

**Le fichier APK, envoyé directement.** Dans Android Studio :
*Build → Build Bundle(s)/APK(s) → Build APK(s)*. Vous obtenez un fichier à
envoyer par message ou par lien. Vos amis devront autoriser l'installation
depuis une source inconnue — Android le propose au moment d'ouvrir le fichier.
Gratuit, immédiat, aucun compte à créer.

**Le Play Store.** Compte développeur Google à **25 $, payés une seule fois**
(à ne pas confondre avec les 99 $ **par an** d'Apple pour iOS, qui est la
raison pour laquelle iOS a été écarté). Installation en un clic pour vos amis
et mises à jour automatiques, mais une validation à passer et des obligations
de conformité. À réserver au moment où l'outil sortira du cercle proche.

## La question du moteur vocal

Le suivi vocal a besoin d'un moteur de reconnaissance. Le choix par défaut est
**Vosk**, qui tourne entièrement sur l'appareil : gratuit, sans clé, sans
réseau après le premier téléchargement.

**Ce qui est établi, par la mesure** : le moteur pèse 3 Mo, démarre sur 16 Mo
de mémoire et peut croître jusqu'à 2 Go ; il se compile en 9 ms ; il n'appelle
aucun service extérieur.

**Ce qui reste inconnu** : la mémoire consommée par le modèle français (~50 Mo)
une fois chargé dans la WebView d'un téléphone réel. Sur un appareil un peu
juste, Android peut fermer l'application à ce moment-là. C'est binaire : ça
passe ou ça ne passe pas.

**Pour trancher**, ouvrez `tools/android-check.html` sur le téléphone (voir le
README). Cinq minutes, un verdict.

**Et si ça ne passe pas**, ce n'est pas grave : l'application choisit son moteur
vocal derrière une interface unique, prévue pour ça depuis le premier jour.
Basculer Android vers un moteur de reconnaissance distant ne demande pas de
réécrire l'application — seulement d'ajouter un adaptateur.

## Sécurité

Ce qui est verrouillé, puisque l'application sera partagée :

- **Aucun secret dans le dépôt.** Les clés d'API éventuelles seront saisies par
  chaque utilisateur et rangées sur son appareil, jamais livrées dans le code.
- **Aucun appel réseau caché.** Le moteur vocal et la police sont servis depuis
  l'application ; ils ont été vérifiés comme ne contactant aucun serveur.
- **Fenêtre de bureau au plus strict.** Isolation du contexte activée,
  intégration Node désactivée, bac à sable actif, aucune passerelle exposée à
  la page, et navigation externe refusée : un lien s'ouvre dans le navigateur
  du système, jamais dans l'application.
- **Le texte affiché est échappé.** Un discours collé depuis une source
  quelconque ne peut pas exécuter de code dans l'application.
