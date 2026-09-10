# Installation

## Essayer sans rien installer d'autre

```bash
npm install          # récupère les dépendances
npm run dev          # puis ouvrir http://localhost:5173
```

Choisissez le moteur **Simulation (sans micro)** : il rejoue votre texte avec
les erreurs d'une lecture réelle. C'est le moyen le plus rapide de voir si
l'outil vous convient.

## Le moteur vocal

Pour un vrai suivi de votre voix, il faut un moteur de reconnaissance.

### Vosk — recommandé

Il tourne **entièrement sur votre appareil** : gratuit, sans clé, sans compte,
et sans réseau une fois le modèle téléchargé. C'est le seul qui fonctionne dans
l'application de bureau.

```bash
mkdir -p models && cd models
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip
```

Le modèle français fait une cinquantaine de mégaoctets. Il ne se télécharge
qu'une fois.

### Web Speech — dépannage

Le moteur du navigateur, disponible dans Chrome sans rien installer. Pratique
pour essayer tout de suite, mais il envoie l'audio aux serveurs de Google et
**ne fonctionne pas dans l'application de bureau** : le navigateur embarqué par
Electron n'a pas les clés du service. L'application le masque dans ce contexte
plutôt que de vous laisser le choisir pour rien.

## Application de bureau — macOS, Windows, Linux

```bash
npm run app
```

L'application s'ouvre dans sa propre fenêtre, sans navigateur. Sur macOS, elle
demande l'autorisation du micro au lancement plutôt qu'au moment où vous
appuyez sur **Démarrer**.

## Android

```bash
npm install
npm run android      # assemble l'application et ouvre Android Studio
```

Dans Android Studio : branchez le téléphone en USB (débogage USB activé),
choisissez l'appareil en haut de la fenêtre, appuyez sur **Run**. Comptez un
quart d'heure la première fois — Android Studio télécharge le SDK et Gradle.

### Pourquoi Android Studio est nécessaire

Electron, c'est un navigateur plus Node.js empaquetés pour un ordinateur : il
n'existe pas de version Android. Android a besoin d'une autre enveloppe, et
c'est **Capacitor** qui s'en charge — il installe exactement la même
application web dans une application Android.

```
        le cœur, écrit une seule fois
        (index.html, src/, vendor/)
                    │
        ┌───────────┴───────────┐
    Electron                Capacitor
   macOS · Windows           Android
```

Rien n'est écrit deux fois. Compiler une application Android demande le SDK de
Google, et Android Studio est l'outil officiel qui l'apporte.

### Ce qui est déjà réglé dans le projet Android

Trois points, dont deux cassent l'application si on les oublie :

- **La permission micro.** Le gabarit de Capacitor ne déclare que l'accès
  internet. Sans `RECORD_AUDIO`, la WebView refuse le micro sans message
  exploitable — on croit à un bug du moteur vocal alors qu'il manque une ligne
  dans le manifeste.
- **L'écran qui reste allumé.** Un prompteur dont l'écran s'éteint en plein
  discours ne sert à rien. L'application prend un verrou d'écran pendant la
  lecture et le rend à l'arrêt, en le reprenant au retour d'arrière-plan — le
  système ne le fait pas seul.
- **Le micro déclaré non obligatoire à l'installation.** Sans micro,
  l'application reste utilisable en défilement manuel : aucune raison d'exclure
  un appareil.

### Vérifier que le moteur vocal tient sur votre téléphone

Le modèle français occupe de la mémoire dans la WebView. Sur un appareil un peu
juste, Android peut fermer l'application au moment du chargement. C'est binaire :
ça passe ou ça ne passe pas.

Pour le savoir, lancez `npm run dev` sur l'ordinateur, puis ouvrez depuis le
téléphone, sur le même réseau :

```
http://<adresse-locale-de-l-ordinateur>:5173/tools/android-check.html
```

Le banc mesure l'appareil, le moteur WebAssembly, le micro, le chargement du
modèle, puis vous fait lire une phrase à voix haute et rend un verdict. Il
détecte aussi le cas où l'onglet est fermé par manque de mémoire : il pose un
repère avant l'étape risquée et le relit au démarrage suivant — une page qui ne
revient pas est une réponse, pas une panne.

Si le verdict est négatif, l'application peut basculer vers un moteur de
reconnaissance distant : le choix du moteur passe par une interface unique,
prévue pour ça depuis le début.

## Donner l'application à des proches

**Par fichier APK.** Dans Android Studio : *Build → Build Bundle(s)/APK(s) →
Build APK(s)*. Vous obtenez un fichier à envoyer par message ou par lien. Vos
proches devront autoriser l'installation depuis une source inconnue — Android
le propose au moment d'ouvrir le fichier. Gratuit, immédiat, aucun compte.

**Par le Play Store.** Compte développeur Google à **25 $, une seule fois** (à
ne pas confondre avec les 99 $ **par an** d'Apple pour iOS, raison pour
laquelle iOS a été écarté). Installation en un clic et mises à jour
automatiques, mais une validation à passer. À réserver au moment où l'outil
sort du cercle proche.

## iOS

Écarté pour l'instant : Apple demande un compte développeur à 99 $ par an et
une validation par l'App Store. L'architecture ne l'interdit pas — Capacitor
gère iOS avec le même cœur — c'est une décision de coût, pas une limite
technique.

## Sécurité

L'application étant destinée à être partagée, voici ce qui est verrouillé :

- **Aucun secret dans le dépôt.** Les clés d'API éventuelles sont saisies par
  chaque utilisateur et rangées sur son appareil.
- **Aucun appel réseau caché.** Le moteur vocal et la police sont servis depuis
  l'application ; il a été vérifié qu'ils ne contactent aucun serveur.
- **Fenêtre de bureau au plus strict.** Isolation du contexte activée,
  intégration Node désactivée, bac à sable actif, aucune passerelle exposée à
  la page, navigation externe refusée — un lien s'ouvre dans le navigateur du
  système, jamais dans l'application.
- **Le texte affiché est échappé.** Un discours collé depuis n'importe quelle
  source ne peut pas exécuter de code dans l'application.
