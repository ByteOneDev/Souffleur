# Comment ça marche

## L'idée qui rend tout possible

Suivre une voix dans un texte semble demander une reconnaissance vocale
excellente. C'est faux, et c'est ce qui rend cet outil réalisable.

Un logiciel de dictée doit répondre à : « qu'a dit la personne ? » — question
ouverte, dont la réponse peut être n'importe quel mot de la langue.

Un prompteur, lui, **connaît déjà le texte**. Sa question est : « où en est
l'orateur ? » — et la réponse est nécessairement l'une des quelques dizaines de
positions autour de l'endroit où il se trouvait il y a une seconde.

Conséquence directe : **un moteur vocal médiocre suffit.** On ne compare pas la
transcription à toute la langue française, mais à une fenêtre de trente mots
connus d'avance.

## La méthode

À chaque instant, l'outil garde en mémoire les dix derniers mots entendus. Il
les compare à la portion de texte autour de la position courante, en cherchant
le meilleur appariement possible — un algorithme d'alignement local emprunté à
la comparaison de séquences biologiques.

Deux raffinements font la différence :

**La comparaison est phonétique autant qu'écrite.** Un moteur vocal ne se
trompe pas au hasard : il confond des mots qui *sonnent* pareil. « ces », « ses »
et « c'est » produisent le même code phonétique et sont donc reconnus comme
équivalents, là où une comparaison lettre à lettre échouerait.

**Les erreurs de lecture sont attendues, pas punies.** Sauter un mot du texte
coûte peu ; entendre un mot absent du texte coûte peu aussi. Ce sont exactement
les deux erreurs d'une lecture réelle — on avale des syllabes, on hésite, on
dit « euh », on improvise — et l'algorithme les absorbe au lieu de décrocher.

## Ce que ça donne, en chiffres

Mesures sur un discours de 147 mots, dix tirages par scénario. La *dérive* est
l'écart, en mots, entre la position affichée et la position réelle du lecteur.

| Situation | Dérive médiane | À 3 mots près | Va au bout |
|---|---|---|---|
| Lecture parfaite | 0 | 100 % | 100 % |
| 25 % de mots mal reconnus | 0 | 100 % | 100 % |
| 40 % de mots mal reconnus | 0 | 100 % | 100 % |
| 35 % de mots perdus par le micro | 0 | 99,8 % | 90 % |
| Hésitations, mots parasites | 0 | 100 % | 100 % |
| **Salle calme, micro proche** | 0 | 99,9 % | 100 % |
| Conditions dégradées cumulées | 0 | 99,4 % | 100 % |
| Aparté improvisé de 12 mots | 0 | 100 % | 100 % |
| Saut d'un paragraphe entier | 0 | 93,0 % | 100 % |

Reproductible : `npm run bench`.

## Le point faible, et sa correction

Le premier jet tenait 99 % sur un texte ordinaire mais tombait à **85,9 % sur
un texte à anaphores** — « Je vous le dis… » répété trois fois. Et il y tombait
*aussi avec une transcription parfaite* : ce n'était donc pas du bruit, mais
une ambiguïté du texte lui-même. Le moteur se fixait sur la mauvaise
occurrence.

Or l'anaphore est précisément une figure de discours.

Le réglage a démenti l'intuition de départ : pénaliser les sauts lointains ne
sert quasiment à rien. Le vrai levier est la **fenêtre de recul** — de combien
de mots le moteur s'autorise à revenir en arrière —, qui est le mécanisme de
rattrapage. Élargie de 12 à 20 mots, elle fait passer ce cas de **85,9 % à
98,8 %**.

Reproductible : `node test/stress.js`.

## D'où viennent les deux modes

Le même réglage a révélé un arbitrage, et c'est lui qui fonde **Lecture** et
**Discours** :

- un tampon de mots **long** apporte du contexte et lève l'ambiguïté des textes
  répétitifs, mais réagit plus lentement quand l'orateur saute ailleurs ;
- un tampon **court** fait exactement l'inverse.

Impossible d'avoir les deux à la fois. D'où deux profils : **Lecture** privilégie
la précision, **Discours** la réactivité.

## Les moteurs de reconnaissance

L'application ne dépend d'aucun moteur en particulier : ils sont interchangeables
derrière une interface unique.

| Moteur | Où tourne-t-il | Coût | Hors ligne | Bureau |
|---|---|---|---|---|
| **Vosk** | sur votre appareil | gratuit | oui | oui |
| **Web Speech** | serveurs de Google | gratuit | non | **non** |
| **Simulation** | nulle part — il rejoue le texte | gratuit | oui | oui |

À propos de Vosk, vérifié par la mesure : le moteur pèse 3 Mo, démarre sur
16 Mo de mémoire et peut croître jusqu'à 2 Go ; il se compile en 9 millisecondes
et s'instancie en 1 ; il n'utilise pas de mémoire partagée et **ne contacte
aucun serveur** à l'exécution.

Le coût de calcul du suivi est de 130 microsecondes par mot sur un texte de
2 000 mots — environ trois mille fois moins que le temps réel. Le suivi n'est
pas un problème de performance.

## Organisation du code

```
src/align/    normalisation du français, phonétique, similarité, alignement
src/script/   analyse des annotations et rendu du prompteur
src/stt/      adaptateurs de moteurs vocaux et simulateur de lecture
src/store/    bibliothèque des discours
src/ui/       charte graphique, thèmes, polices, assemblage
electron/     enveloppe pour l'ordinateur
android/      projet Android engendré par Capacitor
test/         tests, banc de mesure, test de rupture
tools/        banc de vérification de Vosk sur téléphone
```

Le cœur est du JavaScript standard, sans dépendance d'exécution ni étape de
compilation : le navigateur et Node l'exécutent tel quel. C'est ce qui permet
aux deux enveloppes d'afficher le même code sans le réécrire.

## Contribuer

```bash
npm test              # 39 tests
npm run bench         # qualité de l'alignement, scénario par scénario
node test/stress.js   # recherche du point de rupture
```

Une règle : le moteur d'alignement ne se modifie pas sans passer le banc de
mesure. Un test qui passe ne prouve rien si le seuil est complaisant — c'est
`bench` et `stress` qui disent de combien.
