# Souffleur

📖 **[Documentation en français](doc/francais/)** · **[Documentation in English](doc/anglais/)**

Au théâtre, le souffleur suit le texte pendant que les comédiens jouent, et
donne la réplique à celui qui perd le fil. C'est exactement ce que fait ce
logiciel : il suit votre voix dans votre propre texte, éclaire le mot en cours,
fait défiler tout seul, et vous dit en continu si vous êtes en avance ou en
retard.

```bash
npm install
npm run dev      # http://localhost:5173
npm run app      # application de bureau
```

📖 Pour l'utilisation, l'installation et le fonctionnement détaillés, voir la
**[documentation](doc/)**, disponible en français et en anglais. Ce qui suit
résume les décisions techniques et leurs mesures.

## Le pari technique, et sa vérification

Le suivi n'est pas un problème de dictée. Le texte est connu d'avance, donc la
question n'est pas « qu'a dit l'orateur ? » mais « où en est-il ? ». On compare
les derniers mots entendus à une fenêtre glissante du texte, par alignement
local (Smith-Waterman) sur une similarité qui combine forme écrite et forme
phonétique. Conséquence directe : **un moteur vocal médiocre suffit.**

Mesures sur un discours de 147 mots, 10 tirages par scénario
(`npm run bench`) — la dérive est l'écart, en mots, entre la position affichée
et la position réelle du lecteur :

| Scénario | Dérive médiane | p90 | ≤ 3 mots | Va au bout |
|---|---|---|---|---|
| Lecture parfaite | 0 | 0 | 100,0 % | 100 % |
| 25 % de mots mal reconnus | 0 | 0 | 100,0 % | 100 % |
| 40 % de mots mal reconnus | 0 | 0 | 100,0 % | 100 % |
| 35 % de mots perdus par le micro | 0 | 0 | 99,8 % | 90 % |
| Hésitations, mots parasites | 0 | 1 | 100,0 % | 100 % |
| **Salle calme, micro proche** | 0 | 0 | 99,9 % | 100 % |
| Conditions dégradées cumulées | 0 | 1 | 99,4 % | 100 % |
| Aparté improvisé de 12 mots | 0 | 0 | 100,0 % | 100 % |
| Saut d'un paragraphe entier | 0 | 0 | 93,0 % | 100 % |

Coût de calcul : ~130 µs par mot sur un texte de 2 000 mots, soit trois mille
fois moins que le temps réel. Le suivi n'est pas un problème de performance.

### Le point faible, et sa correction

Le premier jet tenait 99 % sur un texte ordinaire mais tombait à **85,9 % sur
un texte à anaphores** (« Je vous le dis… » répété trois fois) — et il y tombait
*aussi avec une entrée parfaite*. Ce n'était donc pas du bruit mais une
ambiguïté structurelle : l'aligneur se fixait sur la mauvaise occurrence.

Le balayage de paramètres (`scripts` du spike) a démenti l'intuition de départ :
pénaliser les sauts lointains ne sert quasiment à rien. Les deux leviers réels
sont la taille du tampon de mots entendus et surtout la **fenêtre de recul**,
qui est le vrai mécanisme de rattrapage. Élargie de 12 à 20 mots, elle fait
passer le texte à anaphores de **85,9 % à 98,8 %**.

### Pourquoi deux modes

Le balayage a aussi révélé un arbitrage, et c'est lui qui fonde les deux
profils — ce ne sont pas des étiquettes :

- un tampon **long** apporte du contexte et désambiguïse les textes répétitifs,
  mais réagit plus lentement quand l'orateur saute ailleurs ;
- un tampon **court** fait l'inverse.

D'où : **Lecture** (tampon 12, précision maximale sur un texte suivi au mot
près) et **Discours** (tampon 8, réactivité aux sauts, à l'improvisation et aux
reprises, avec une pénalité réduite sur les mots hors texte).

## Essayer

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # 39 tests
npm run bench   # tableau de qualité de l'alignement
node test/stress.js   # recherche du point de rupture
```

Le moteur **Simulation** rejoue le texte avec des erreurs réalistes : il permet
de juger le prompteur sans micro, et de reproduire à volonté un cas gênant.
Pour un essai au micro sans installer de modèle, choisir **Navigateur (Web
Speech)** dans Chrome. Pour **Vosk**, déposer le modèle français dans
`models/` :

```bash
npm run model
```

Pour vérifier Vosk sur un téléphone Android : `npm run dev:https` sur
l'ordinateur, puis ouvrir depuis le téléphone l'adresse affichée. Le HTTPS est
nécessaire : un navigateur ne donne accès au micro que dans un contexte
sécurisé, ce que `http://192.168.x.x` n'est pas. Voir la
[documentation d'installation](doc/francais/installation.md).

## Écrire un script

```
# Titre de section        repère de structure, non prononcé
**gras**                  mot appuyé
==surbrillance==          passage à ne pas manquer
_italique_                nuance, aparté
(2s)                      pause chronométrée, non prononcée
[[regarder le public]]    consigne de jeu, non prononcée
```

Le texte se verrouille d'un clic (ou par `L`) : une fois en situation, une
frappe accidentelle ne peut plus modifier le discours.

## Charte graphique — « encre et ruban »

L'objet de référence est la machine à écrire : bichromie noir et rouge héritée
du ruban, papier, filets plutôt qu'ombres, étiquettes en capitales espacées.
**JetBrains Mono** porte cette identité dans toute l'interface et dans la liste
des textes ; elle est installée depuis npm et servie par l'application, jamais
par un service de polices distant — l'affichage doit tenir hors ligne comme
l'écoute.

Les deux modes sont définis intégralement dans `src/ui/tokens.css`, jamais l'un
dérivé de l'autre à la hâte : mode clair « papier », mode sombre « encre ». Le
sombre reste le cas principal — on lit un discours dans une salle éteinte — et
le bouton de thème cycle entre automatique, clair et sombre. Aucune couleur
n'est écrite en dur ailleurs que dans le fichier de jetons.

**La surface de lecture fait exception à la chasse fixe.** À 34 px et à
distance, une police proportionnelle se lit mesurablement plus vite qu'un
monospace, et lire vite est le métier d'un prompteur. Le texte s'affiche donc
par défaut dans une police de lecture, avec la machine à écrire disponible en
un clic pour qui préfère l'identité complète.

## Bibliothèque

Un orateur ne prépare pas un texte mais plusieurs, et il y revient : la
bibliothèque est le point d'entrée, pas un annexe. Les textes sont enregistrés
au fil de la frappe, titrés automatiquement d'après leur première section (ou
leurs premiers mots, sans finir sur un mot suspendu), et affichés avec leur
nombre de mots et leur durée estimée. Le stockage est injecté plutôt que
supposé : `localStorage` dans le navigateur, mémoire ailleurs, et un stockage
corrompu ou refusé n'empêche jamais d'ouvrir l'application.

## Organisation

```
src/align/    normalisation FR, phonétique, similarité, moteur d'alignement
src/script/   analyse des annotations et rendu du prompteur
src/stt/      adaptateurs de moteurs vocaux + simulateur de lecture
src/store/    bibliothèque des discours (stockage injecté)
src/ui/       charte, thèmes, polices, assemblage de l'interface
test/         tests, banc de mesure et test de rupture
tools/        banc de vérification de Vosk sur un appareil Android
doc/          documentation, en français et en anglais
```

Aucune dépendance d'exécution, aucune étape de compilation : du JavaScript
standard, exécutable directement par le navigateur et par Node.

## Plateformes

| Cible | Enveloppe | État |
|---|---|---|
| macOS, Windows, Linux | Electron | fenêtre verrouillée, vérifiée au lancement |
| Android | Capacitor | projet généré, micro et écran réglés — reste à compiler |
| iOS | Capacitor | écarté pour l'instant (99 $/an de compte Apple) |

```bash
npm run app        # lance l'application de bureau
npm run android    # assemble et ouvre le projet dans Android Studio
```

Voir **[doc/francais/installation.md](doc/francais/installation.md)** pour
l'explication complète : ce que fait chaque outil, comment compiler sur votre
machine, comment donner l'application à des proches, et ce que la question Vosk
implique concrètement.

## Décisions d'architecture

**Le cœur est du web pur.** Aucune API Electron ne remonte dans la logique
métier. C'est ce qui permettra d'empaqueter le même code pour le bureau
(Electron) et pour Android (Capacitor) sans le réécrire.

**Electron ne cible que le bureau.** Ni Android ni iOS : c'est Chromium plus
Node.js. Le mobile passera par Capacitor sur le même cœur.

**Cibles retenues : macOS et Android.** iOS est repoussé — il impose un compte
Apple Developer à 99 $/an. La couche d'abstraction du moteur vocal existe déjà,
donc l'ajouter plus tard ne demandera pas de réécriture.

**Vosk sur Android n'est pas encore vérifié.** C'est le seul risque ouvert du
projet. Il n'a pas pu être levé en environnement d'intégration : le modèle et
le CDN y sont bloqués par la politique réseau, et il n'existe ni SDK Android ni
virtualisation pour émuler un appareil. Seul un téléphone réel peut répondre,
d'où `tools/android-check.html` : à ouvrir sur le téléphone, il mesure le
moteur WebAssembly, le micro, le chargement du modèle et une lecture réelle,
puis rend un verdict. Il détecte aussi l'onglet tué par manque de mémoire, en
posant un marqueur avant l'étape risquée et en le relisant au démarrage suivant.

Ce qui **est** vérifié, par la mesure : le binaire WebAssembly fait 3 Mo,
s'ouvre sur 16 Mo de mémoire et peut croître jusqu'à 2 Go ; il compile en 9 ms
et s'instancie en 1 ms ; il n'utilise pas `SharedArrayBuffer` et n'appelle
aucune ressource externe à l'exécution. Ce qui reste inconnu est l'empreinte
mémoire du modèle français une fois chargé sur un appareil réel.

**Le moteur vocal est interchangeable.** Vosk local par défaut : gratuit, hors
ligne, sans clé API, et il fonctionne dans Electron là où la Web Speech API
échoue — Chromium embarqué n'a pas les clés du service Google. C'est le genre de
détail qui coûte trois jours si on le découvre en route. La contrainte connue :
le modèle français de ~50 Mo restera à valider dans le WebView d'Android, et
c'est précisément pour ça que l'adaptateur existe.

**L'IA se branchera en BYOK.** L'utilisateur fournit sa propre clé Claude,
stockée localement : pas de backend à héberger, pas de coût de fonctionnement,
pas de clé partagée dans un binaire distribué.

## État et suite

Fait : le moteur d'alignement et ses mesures, le prompteur avec annotations,
chronométrage et verrouillage, la bibliothèque de discours, la charte graphique
en deux thèmes, l'application de bureau et le projet Android.

Ouvert : **Vosk n'est pas encore vérifié sur un téléphone réel** — c'est le seul
risque restant, et `tools/android-check.html` le tranche en cinq minutes (voir
la [documentation d'installation](doc/francais/installation.md)).

À venir : découpage par sections avec durée cible, fonctions IA (réécriture pour
l'oral, ajustement à une durée, fiches de secours), analyse de répétition,
import de documents, et télécommande depuis le téléphone.
