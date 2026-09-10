# Prompteur intelligent — spike d'alignement vocal

Téléprompteur qui suit la voix de l'orateur dans son propre texte : le mot en
cours s'éclaire, le texte défile seul, et le chronométrage dit en continu si
l'on est en avance ou en retard.

Ce dépôt contient pour l'instant **le spike**, pas l'application. Son unique
but : établir si le suivi vocal est assez fiable pour qu'on construise dessus.

## Ce que le spike établit

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
npm run dev     # http://localhost:5173
npm test        # 26 tests
npm run bench   # tableau de qualité de l'alignement
node test/stress.js   # recherche du point de rupture
```

Le moteur **Simulation** rejoue le texte avec des erreurs réalistes : il permet
de juger le prompteur sans micro, et de reproduire à volonté un cas gênant.
Pour un essai au micro sans installer de modèle, choisir **Navigateur (Web
Speech)** dans Chrome. Pour **Vosk**, déposer le modèle français dans
`models/` :

```bash
mkdir -p models && cd models
curl -LO https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip
```

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

## Organisation

```
src/align/    normalisation FR, phonétique, similarité, moteur d'alignement
src/script/   analyse des annotations et rendu du prompteur
src/stt/      adaptateurs de moteurs vocaux + simulateur de lecture
src/ui/       assemblage de l'interface (couche volontairement jetable)
test/         tests, banc de mesure et test de rupture
```

Aucune dépendance d'exécution, aucune étape de compilation : du JavaScript
standard, exécutable directement par le navigateur et par Node.

## Décisions d'architecture

**Le cœur est du web pur.** Aucune API Electron ne remonte dans la logique
métier. C'est ce qui permettra d'empaqueter le même code pour le bureau
(Electron) et pour Android (Capacitor) sans le réécrire.

**Electron ne cible que le bureau.** Ni Android ni iOS : c'est Chromium plus
Node.js. Le mobile passera par Capacitor sur le même cœur.

**Cibles retenues : macOS et Android.** iOS est repoussé — il impose un compte
Apple Developer à 99 $/an. La couche d'abstraction du moteur vocal existe déjà,
donc l'ajouter plus tard ne demandera pas de réécriture.

**Le moteur vocal est interchangeable.** Vosk local par défaut : gratuit, hors
ligne, sans clé API, et il fonctionne dans Electron là où la Web Speech API
échoue — Chromium embarqué n'a pas les clés du service Google. C'est le genre de
détail qui coûte trois jours si on le découvre en route. La contrainte connue :
le modèle français de ~50 Mo restera à valider dans le WebView d'Android, et
c'est précisément pour ça que l'adaptateur existe.

**L'IA se branchera en BYOK.** L'utilisateur fournit sa propre clé Claude,
stockée localement : pas de backend à héberger, pas de coût de fonctionnement,
pas de clé partagée dans un binaire distribué.

## Suite

Le pari technique est levé ; l'application reste à construire :
éditeur riche et persistance des discours, découpage par sections avec durée
cible, fonctions IA (réécriture pour l'oral, ajustement à une durée, fiches de
secours), analyse de répétition, empaquetage Electron puis Capacitor, et
télécommande depuis le téléphone.
