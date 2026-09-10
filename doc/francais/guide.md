# Guide d'utilisation

## 1. Choisir le type de prise de parole

Avant d'écrire, choisissez entre **Lecture** et **Discours**. Ce n'est pas une
étiquette : les deux modes règlent différemment le moteur de suivi.

| | Lecture | Discours |
|---|---|---|
| Votre usage | vous suivez le texte au mot près | vous parlez à partir du texte |
| Le suivi | précis, peu tolérant aux écarts | tolérant à l'improvisation |
| Il excelle sur | les textes littéraires, répétitifs, à anaphores | les sauts, reprises et apartés |

En pratique : **Lecture** pour une citation, un texte officiel, un poème.
**Discours** dès que vous vous autorisez à broder.

Le choix se change à tout moment, y compris en pleine préparation.

## 2. Écrire et annoter le texte

Écrivez ou collez votre texte dans le panneau de gauche. Six annotations sont
disponibles :

| Vous écrivez | Ce que ça fait |
|---|---|
| `**important**` | le mot s'affiche en gras : appuyez dessus |
| `==à ne pas manquer==` | passage surligné |
| `_nuance_` | italique, pour un aparté |
| `# Titre de section` | repère de structure — **ne se prononce pas** |
| `(2s)` | pause chronométrée — **ne se prononce pas** |
| `[[regarder le public]]` | consigne de jeu — **ne se prononce pas** |

Les trois dernières sont importantes : elles apparaissent à l'écran mais sont
retirées du texte que le moteur cherche à suivre. Vous pouvez donc vous écrire
des consignes sans perturber le suivi.

### Un exemple complet

```
# Ouverture

Mesdames, messieurs, bonsoir. (2s) [[balayer la salle du regard]]

Je voudrais commencer par une **évidence** que nous avons collectivement
oubliée : la technique n'est ==jamais neutre==.
```

## 3. Régler la durée visée

Indiquez la durée que vous visez, en minutes. Dès que vous commencez à lire,
l'indicateur **Avance / retard** compare votre progression réelle au temps
écoulé et affiche l'écart :

- **en vert** : vous êtes dans les temps ;
- **en bleu** : vous êtes en avance — vous pouvez respirer, développer ;
- **en rouge** : vous êtes en retard — il faut accélérer ou couper.

C'est l'indicateur le plus utile de l'outil. Il vous évite de découvrir à la
fin que vous avez pris dix minutes de trop.

## 4. Régler l'affichage

- **Taille du texte** : montez-la franchement si l'écran est loin de vous.
- **Lecture rapide / Machine à écrire** : la première est une police
  proportionnelle, qui se lit plus vite à distance ; la seconde garde la chasse
  fixe de l'interface. Essayez les deux, gardez celle qui vous fatigue le moins.
- **Mode miroir** : inverse le texte horizontalement, pour un prompteur
  physique à vitre semi-réfléchissante.
- **Thème** : le bouton en haut à gauche cycle entre automatique, clair et
  sombre. En salle, le sombre fatigue moins les yeux et éclaire moins votre
  visage.

## 5. Verrouiller le texte

Le bouton **🔓 modifiable** bascule en **🔒 verrouillé** (ou la touche `L`).
Une fois verrouillé, ni le texte ni le titre ne peuvent être modifiés.

À faire systématiquement avant de monter sur scène : il suffit d'une touche
frappée par mégarde pour abîmer un texte qu'on ne relira plus.

C'est une sécurité d'usage, pas une protection informatique : le verrou se
retire d'un clic.

## 6. Lire

Appuyez sur **Démarrer** (ou la barre d'espace). Autorisez le micro si on vous
le demande. Puis lisez normalement.

Ce que vous voyez pendant la lecture :

- le **mot en cours** s'éclaire en ambre ;
- ce qui est **déjà dit** s'efface progressivement ;
- ce qui **reste à dire** demeure le plus lisible — c'est ce que vous lisez ;
- le texte **défile tout seul** pour garder le mot en cours au tiers de l'écran ;
- l'**état du suivi**, en haut à droite : *suivi* (vert), *suivi faible*
  (ambre), *perdu* (rouge clignotant).

### Si le suivi décroche

Les flèches `↑` et `↓` déplacent le curseur d'un mot. Le moteur reprend le
suivi à partir de là. En pratique, il se rattrape seul dans la plupart des cas,
y compris après un paragraphe entièrement sauté.

## Raccourcis clavier

| Touche | Effet |
|---|---|
| `Espace` | démarrer ou arrêter |
| `L` | verrouiller ou déverrouiller le texte |
| `F` | plein écran |
| `↑` `↓` | rattraper la position d'un mot |

## Vos textes

Chaque texte est enregistré automatiquement pendant que vous tapez, avec son
titre, son nombre de mots et sa durée estimée. La liste est classée du plus
récemment modifié au plus ancien, et le champ de filtre retrouve un texte par
son titre.

Le titre se déduit tout seul de la première section, ou des premiers mots si
vous n'en avez pas mis. Vous pouvez toujours le remplacer.

Les textes sont rangés **sur votre appareil**, pas sur un serveur. Ils ne sont
pas synchronisés entre vos machines, et vider les données du navigateur les
efface.
