# Distribuer l'application

Deux publics, deux chemins : un fichier `.dmg` pour les Mac, et le canal de
test interne du Play Store pour Android.

---

# macOS — le fichier .dmg

## Construire

```bash
npm install
npm run model      # pour que le modèle vocal soit embarqué
npm run dist:mac
```

Le fichier apparaît dans `release/`, nommé `Souffleur-<version>.dmg`.

`npm run model` avant la construction n'est pas obligatoire mais fortement
conseillé : le modèle vocal est alors **inclus dans l'application**. Vos amis
téléchargent un seul fichier et la reconnaissance fonctionne immédiatement,
hors ligne, sans aucune installation. Sans lui, ils n'auront que le mode
simulation.

Le paquet pèse environ 250 Mo : c'est le prix d'un navigateur embarqué, d'un
binaire universel (Intel et Apple Silicon) et du modèle vocal.

## Le problème de Gatekeeper, et sa solution

L'application n'est **pas signée par un certificat Apple**. Un certificat de
développeur Apple coûte 99 $ par an — le même que celui écarté pour iOS.

Conséquence : au premier lancement, macOS refusera d'ouvrir l'application, avec
un message parlant d'éditeur non identifié ou de fichier endommagé. Ce n'est pas
un défaut de l'application, c'est le comportement normal de macOS face à un
logiciel non signé.

**Pour vos amis, la marche à suivre :**

1. Ouvrir le `.dmg`, glisser Souffleur dans **Applications**.
2. Double-cliquer sur l'application. macOS refuse. C'est attendu.
3. Aller dans **Réglages Système → Confidentialité et sécurité**, descendre
   jusqu'au message concernant Souffleur, et cliquer sur **Ouvrir quand même**.
4. Confirmer. Le refus ne se reproduira plus.

Si macOS parle d'un fichier « endommagé », c'est l'attribut de quarantaine posé
sur les fichiers téléchargés. Une commande le retire :

```bash
xattr -dr com.apple.quarantine /Applications/Souffleur.app
```

**Prévenez-les à l'avance.** Un message d'erreur inattendu au premier lancement
suffit à faire abandonner quelqu'un qui rendait service en essayant votre outil.

---

## L'APK sans rien installer

Compiler une application Android demande le SDK de Google et plusieurs
gigaoctets d'outillage. Vous pouvez vous en dispenser : **GitHub construit
l'APK à chaque envoi**.

Onglet **Actions** du dépôt → dernière exécution de « APK Android » → section
**Artifacts** en bas de page → télécharger l'archive, qui contient l'APK.

Il est signé avec la clé de débogage d'Android : installable directement sur un
téléphone, mais pas publiable sur le Play Store. Le modèle vocal y est embarqué
par défaut, donc l'application fonctionne hors ligne dès l'installation.

Sur le téléphone, ouvrez le fichier : Android proposera d'autoriser
l'installation depuis cette source. C'est normal pour une application qui ne
vient pas du Play Store.

---

# Android — le test interne du Play Store

C'est le chemin le plus confortable pour vos proches : ils installent depuis le
Play Store comme n'importe quelle application, et reçoivent les mises à jour
automatiquement. L'application reste **invisible du public** : seules les
personnes que vous invitez peuvent la voir.

## 1. Le compte développeur

[play.google.com/console](https://play.google.com/console) — **25 $, une seule
fois**, à vie. Une vérification d'identité est demandée ; comptez quelques jours
avant que le compte soit pleinement actif. Commencez par là, c'est ce qui prend
le plus de temps.

## 2. La clé de signature

Une seule fois, et **à conserver précieusement** : la perdre signifie ne plus
jamais pouvoir publier de mise à jour de cette application.

```bash
keytool -genkey -v -keystore souffleur-upload.jks \
  -alias souffleur -keyalg RSA -keysize 2048 -validity 10000
```

Puis, à la racine du projet :

```bash
cp keystore.properties.example keystore.properties
```

Renseignez-y les mots de passe choisis. Ce fichier et la clé sont exclus du
dépôt : une clé de publication ne se versionne jamais.

Sauvegardez la clé ailleurs que sur votre disque — un gestionnaire de mots de
passe, un disque chiffré. Ce n'est pas un conseil de précaution, c'est la seule
copie qui existe.

## 3. Construire le paquet

```bash
npm run build
npx cap sync android
node scripts/android-manifest.js
cd android && ./gradlew bundleRelease
```

Le fichier se trouve dans
`android/app/build/outputs/bundle/release/app-release.aab`.

Le Play Store veut un `.aab` (Android App Bundle) et non un `.apk` : il fabrique
lui-même l'apk adapté à chaque téléphone.

## 4. Créer l'application dans la console

**Créer une application**, puis renseigner le nom, la langue, et indiquer qu'il
s'agit d'une application gratuite.

## 5. Les déclarations obligatoires

C'est l'étape que personne n'anticipe, et elle est exigée **même pour un test
interne**. Dans **Contenu de l'application** :

- **Politique de confidentialité** — une adresse web publique est
  **obligatoire**, parce que l'application demande le micro. Le texte est déjà
  écrit : [confidentialite.md](confidentialite.md). Publiez-le, par exemple avec
  GitHub Pages (*Settings → Pages*), et donnez son adresse.
- **Sécurité des données** — déclarez qu'aucune donnée n'est collectée ni
  partagée. C'est exact : l'audio est traité sur l'appareil et les textes ne
  quittent pas le téléphone.
- **Classification du contenu** — un questionnaire, quelques minutes.
- **Public cible** — adultes, application de productivité.
- **Publicité** — aucune.

## 6. Le canal de test interne

**Tests → Tests internes → Créer une version**, téléverser le `.aab`.

Puis **Testeurs** : créez une liste et ajoutez les adresses e-mail de vos
proches, jusqu'à 100 personnes. Elles doivent utiliser l'adresse liée à leur
compte Google du téléphone.

Enfin, copiez le **lien de participation** et envoyez-le-leur.

## 7. Ce que vos proches font

1. Ouvrir le lien reçu et accepter de devenir testeur.
2. Suivre le lien « télécharger sur Google Play » qui apparaît alors.
3. Installer normalement.

Aucune manipulation obscure, aucune source inconnue à autoriser, et les mises à
jour arrivent toutes seules.

## Points à savoir

- Le test interne **n'attend pas de validation** : une version est disponible en
  quelques minutes. C'est ce qui le distingue des tests fermés ou ouverts.
- Chaque nouvelle version doit avoir un **numéro de version supérieur**
  (`versionCode` dans `android/app/build.gradle`).
- La première mise en ligne du compte peut demander une vérification
  supplémentaire. Prenez-la en compte dans votre calendrier.

---

# Comparaison des chemins

| | .dmg (macOS) | APK direct | Test interne Play |
|---|---|---|---|
| Coût | gratuit | gratuit | 25 $ une fois |
| Pour vos proches | avertissement à contourner | source inconnue à autoriser | installation normale |
| Mises à jour | à renvoyer à la main | à renvoyer à la main | automatiques |
| Délai de mise en ligne | immédiat | immédiat | quelques minutes |
| Déclarations | aucune | aucune | politique de confidentialité et formulaires |
