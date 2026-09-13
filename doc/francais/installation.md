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
npm run model
```

Le modèle français fait une cinquantaine de mégaoctets et ne se télécharge
qu'une fois. La commande le range au bon endroit quel que soit le dossier
depuis lequel vous la lancez, et ne retélécharge rien s'il est déjà là.

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

### Fabriquer un .dmg — macOS

Pour donner l'application à quelqu'un qui n'a ni Node ni le dépôt :

```bash
npm run model        # facultatif : embarque le modèle vocal dans le .dmg
npm run dmg
```

Le fichier apparaît dans `dist/` : `Souffleur-0.1.0-arm64.dmg`. Il pèse
environ 165 Mo, dont 40 Mo pour le modèle vocal s'il est présent — l'application
fonctionne alors hors ligne dès la première ouverture, sans téléchargement.

La construction vise les Mac Apple Silicon. Pour un Mac Intel, remplacez
`arm64` par `x64` dans le champ `build.mac.target` de `package.json`, ou
mettez `["arm64", "x64"]` pour livrer les deux dans le même fichier.

### Windows et Linux

```bash
npm run windows      # dist/Souffleur Setup 0.1.0.exe — installateur classique
npm run linux        # dist/Souffleur-0.1.0.AppImage — x64 et arm64
```

Les deux se fabriquent **depuis le Mac**, sans machine Windows ni Linux.

L'AppImage ne s'installe pas : c'est un fichier unique, à rendre exécutable
(`chmod +x`) puis à lancer. Il fonctionne sur toutes les distributions récentes,
ce qui évite d'entretenir un paquet par famille.

Le `.deb` a été écarté : son outillage (`fpm`) refuse de se télécharger derrière
certains réseaux d'entreprise. Il reste constructible depuis une machine Linux,
ou par Docker, en rajoutant `"deb"` aux cibles `build.linux` de `package.json`.

L'installateur Windows n'est pas signé non plus : SmartScreen affichera un
avertissement au premier lancement, que l'on passe par **Informations
complémentaires → Exécuter quand même**. Une signature Windows se loue à l'année,
comme celle d'Apple.

### Ce que l'empaquetage règle, et qui casse si on l'oublie

- **La phrase du micro.** macOS exige une explication écrite
  (`NSMicrophoneUsageDescription`) avant de laisser une application demander
  le micro. Sans elle, le système ne pose pas la question : il ferme
  l'application.
- **Les habilitations.** Le « hardened runtime » interdit par défaut la
  compilation à la volée et la mémoire exécutable non signée, dont le moteur
  JavaScript et le moteur vocal WebAssembly ont besoin. Elles sont déclarées
  dans `build/entitlements.mac.plist`.
- **Les fichiers laissés lisibles.** L'archive `asar` d'Electron est
  désactivée : le modèle vocal et le binaire WebAssembly sont chargés par la
  page en `fetch`, exactement comme en développement.
- **`node_modules` exclu.** L'application est du web pur et ne lit aucun
  fichier de npm à l'exécution ; seul `vendor/` est livré.

### À la première ouverture, macOS refusera

L'application n'est pas signée par un compte développeur Apple : elle porte une
signature « ad hoc », suffisante pour qu'elle tourne, insuffisante pour que
macOS l'ouvre d'un double-clic après un téléchargement. Le message parle
d'application « endommagée » ou « d'un développeur non identifié » — il est
trompeur : le fichier va très bien.

Deux façons de passer :

- **Clic droit → Ouvrir**, puis *Ouvrir* dans la fenêtre qui s'affiche. Une
  seule fois, par personne, par machine.
- Ou, si le message persiste, dans le Terminal :

```bash
xattr -dr com.apple.quarantine /Applications/Souffleur.app
```

Faire disparaître cet avertissement pour de bon demande un compte développeur
Apple à 99 $ par an, plus une signature et une notarisation à chaque version.
C'est la même dépense qui a fait écarter iOS.

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

Cela se vérifie **sans Android Studio et sans rien compiler**, en cinq minutes.

**1. Sur l'ordinateur**, depuis le dossier du projet, récupérez le modèle :

```bash
npm run model
```

**2. Lancez le serveur en HTTPS** — et c'est important :

```bash
npm run dev:https
```

Il affiche l'adresse à ouvrir depuis le téléphone. Le HTTPS n'est pas un
raffinement : un navigateur ne donne accès au micro que dans un « contexte
sécurisé ». `localhost` en est un, `http://192.168.x.x` non. En clair, sur du
HTTP le téléphone afficherait la page mais refuserait le micro, et le test
serait impossible.

**3. Sur le téléphone**, connecté au même réseau, ouvrez l'adresse affichée :

```
https://<adresse-locale-de-l-ordinateur>:5173/tools/android-check.html
```

Le certificat est auto-signé : Chrome affichera un avertissement. Touchez
**Paramètres avancés → Continuer vers le site**. À faire une seule fois.

> **Si le téléphone affiche « site inaccessible »**, le problème n'est
> probablement ni le réseau ni le certificat, mais le pare-feu de macOS. Il
> mémorise un refus par application, et un « non » donné un jour à la fenêtre
> « node accepte-t-il les connexions entrantes ? » rend tout serveur Node
> injoignable depuis le réseau, sans autre message que celui-là.
>
> Le diagnostic tient en deux commandes, depuis le Mac :
>
> ```bash
> curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:5173/
> curl -sk -o /dev/null -w "%{http_code}\n" https://<votre-adresse-locale>:5173/
> ```
>
> Si la première répond `200` et la seconde échoue, c'est le pare-feu : le
> serveur va bien, seule l'interface réseau est filtrée. `node` apparaît alors
> dans `/usr/libexec/ApplicationFirewall/socketfilterfw --listapps` avec la
> mention *Block incoming connections*.
>
> **Sans toucher au pare-feu**, le câble USB contourne la question :
>
> ```bash
> brew install --cask android-platform-tools
> adb reverse tcp:5173 tcp:5173
> ```
>
> Le téléphone voit alors le serveur sur son propre `localhost`, à ouvrir en
> `http://localhost:5173/tools/android-check.html`. Ni réseau, ni pare-feu, ni
> avertissement de certificat — `localhost` est un contexte sécurisé de plein
> droit, donc le micro fonctionne même en HTTP.

**4. Déroulez les cinq étapes** dans l'ordre, en autorisant le micro quand il
le demande. La dernière vous fait lire une phrase à voix haute — lisez-la au
rythme d'un discours, pas plus vite.

Le banc mesure l'appareil, le moteur WebAssembly, le micro, le chargement du
modèle, puis rend un verdict et un rapport que vous pouvez copier. Il détecte
aussi le cas où l'onglet est fermé par manque de mémoire : il pose un repère
avant l'étape risquée et le relit au démarrage suivant — une page qui ne revient
pas est une réponse, pas une panne.

**Ce que le verdict signifie** :

- **vert** — Vosk tient sur cet appareil. Le moteur local reste le choix par
  défaut sur Android, et l'application fonctionne sans réseau.
- **orange** — ça fonctionne mais le suivi décroche. À rejouer au calme, micro
  près de la bouche, avant de conclure.
- **rouge** — l'appareil ne suit pas. Il faudra un moteur de reconnaissance
  distant sur Android.

Si le verdict est négatif, l'application peut basculer vers un moteur de
reconnaissance distant : le choix du moteur passe par une interface unique,
prévue pour ça depuis le début.

## Donner l'application à des proches

**Par fichier APK.** Dans Android Studio : *Build → Build Bundle(s)/APK(s) →
Build APK(s)*. Vous obtenez un fichier à envoyer par message ou par lien. Vos
proches devront autoriser l'installation depuis une source inconnue — Android
le propose au moment d'ouvrir le fichier. Gratuit, immédiat, aucun compte.

**Par le Play Store, en test interne.** Compte développeur Google à **25 $, une
seule fois** (à ne pas confondre avec les 99 $ **par an** d'Apple pour iOS,
raison pour laquelle iOS a été écarté). Installation en un clic, mises à jour
automatiques, et — c'est le point important — **aucune publication au public** :
la piste « test interne » diffuse l'application à une liste d'adresses que vous
choisissez, cent au maximum. Voir la section suivante.

## Publier en privé sur le Play Store — test interne

C'est la voie prévue pour une diffusion réservée à une équipe. L'application
n'apparaît nulle part dans le magasin : seules les personnes que vous inscrivez
peuvent l'installer, par un lien.

### 1. Le compte développeur — comptez quelques jours

Créez-le sur [play.google.com/console](https://play.google.com/console) : 25 $
une fois pour toutes. Google vérifie votre identité (pièce d'identité, adresse ;
numéro D-U-N-S si vous vous inscrivez au nom d'une société). **C'est cette
vérification qui prend le plus de temps** — de quelques heures à quelques jours.
Rien d'autre ne peut avancer tant qu'elle n'est pas passée, alors lancez-la en
premier.

Une nuance utile : les comptes personnels récents doivent réunir douze testeurs
pendant quatorze jours **avant de publier au public**. Le test interne échappe à
cette règle. C'est une raison de plus de rester sur cette piste tant que l'outil
ne sort pas de l'équipe.

### 2. La clé de signature — à ne jamais perdre

Dans Android Studio : *Build → Generate Signed App Bundle / APK → Android App
Bundle → Create new…*. Vous choisissez un fichier `.jks` et deux mots de passe.

**Sauvegardez ce fichier et ces mots de passe ailleurs que sur votre machine.**
Une application Android est identifiée par sa clé : perdue, plus aucune mise à
jour n'est possible et il faut republier sous un autre nom. Acceptez au passage
la **signature d'applications Play**, qui met une copie de la clé à l'abri chez
Google.

Le fichier produit est un `.aab` — c'est ce que le Play Store attend, là où
l'APK reste réservé à l'envoi direct de la main à la main.

### 3. Créer l'application dans la console

*Créer une application*, en renseignant le nom, la langue, « Application » et
« Gratuite ». Le nom de paquet est déjà fixé par le projet — `fr.souffleur.app`
— et **il est définitif** : on ne le change plus après le premier envoi.

### 4. Les déclarations obligatoires

La console ne laisse rien publier tant que la section *Contenu de l'application*
n'est pas remplie. Pour Souffleur :

- **Politique de confidentialité** — une adresse web est exigée dès qu'une
  application demande le micro. Une page publique suffit ; elle doit dire ce que
  dit déjà le projet : l'audio est analysé sur l'appareil et n'est envoyé nulle
  part.
- **Sécurité des données** — déclarez qu'aucune donnée n'est collectée ni
  partagée. C'est exact avec le moteur Vosk, qui travaille hors ligne. Cela
  cesserait de l'être avec un moteur de reconnaissance distant : ce formulaire
  serait alors à corriger.
- **Classification du contenu**, **public visé**, **publicités** (aucune),
  **accès à l'application** (rien n'est réservé).

### 5. Envoyer et inviter

*Tests → Test interne → Créer une release*, déposez le `.aab`, puis dans
l'onglet *Testeurs* créez une liste avec les adresses Gmail de vos développeurs.
Publiez la release.

La console affiche alors un **lien d'inscription**. Chacun l'ouvre, accepte
d'être testeur, et l'application s'installe depuis le Play Store comme n'importe
quelle autre. Comptez quelques minutes de traitement — pas les jours d'examen
d'une publication publique.

Pour la version suivante, augmentez `versionCode` dans
`android/app/build.gradle` (Google refuse deux envois portant le même numéro),
reconstruisez, redéposez : la mise à jour part toute seule sur les téléphones.

### Plus rapide encore : le partage interne

Si vous ne cherchez qu'à faire essayer une version de travail, la console offre
*Partage interne d'applications* : vous déposez un `.aab` ou un `.apk`, vous
obtenez un lien, personne n'a besoin d'être inscrit sur une liste et il n'y a
aucun examen. Le lien expire, il n'apporte pas de mise à jour automatique, et le
testeur doit avoir activé le partage interne dans son application Play Store.
C'est l'équivalent de l'APK envoyé par message, avec l'installation en un clic
en plus.

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
- **Les dépendances sont auditées.** `npm audit` ne signale rien. Une alerte
  antérieure sur `uuid` a été analysée plutôt que corrigée à l'aveugle : elle
  concerne les fonctions `v3`, `v5` et `v6` lorsqu'un tampon leur est passé, or
  le fichier réellement livré n'en contient aucune et n'appelle que `v4`, sans
  tampon. Elle n'était pas exploitable ; la version a tout de même été relevée
  et les outils de compilation séparés des dépendances d'exécution.
