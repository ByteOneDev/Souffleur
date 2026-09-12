# Documentation — Souffleur

Un téléprompteur qui suit votre voix dans votre propre texte : le mot en cours
s'éclaire, le texte défile seul, et le chronomètre dit en continu si vous êtes
en avance ou en retard.

## Sommaire

1. **[Guide d'utilisation](guide.md)** — écrire un texte, l'annoter, le lire en
   situation. Commencez ici.
2. **[Installation](installation.md)** — ordinateur, Android, et comment donner
   l'application à des proches.
3. **[Distribuer l'application](publier.md)** — fabriquer le `.dmg` pour Mac,
   publier sur le Play Store en test interne pour vos proches.
4. **[Comment ça marche](fonctionnement.md)** — le suivi vocal expliqué, les
   mesures, les moteurs de reconnaissance et leurs limites.
5. **[Politique de confidentialité](confidentialite.md)** — ce que
   l'application fait, et surtout ne fait pas, de vos données.

## En trente secondes

```bash
npm install
npm run dev      # puis ouvrir http://localhost:5173
```

Choisissez le moteur **Simulation** pour voir le prompteur fonctionner sans
micro : il rejoue votre texte avec les erreurs d'une lecture réelle.

## Ce que l'outil fait

- **Suit votre voix** dans le texte et éclaire le mot en cours.
- **Fait défiler** le texte à votre rythme, pas à un rythme imposé.
- **Vous rattrape** si vous sautez un paragraphe, répétez une phrase ou
  improvisez un aparté.
- **Chronomètre** : temps écoulé, temps restant estimé, avance ou retard sur la
  durée visée.
- **Annote** le texte : mots appuyés, passages à ne pas manquer, pauses
  chronométrées, consignes de jeu qui ne se prononcent pas.
- **Verrouille** le texte pour qu'une frappe accidentelle ne le modifie pas.
- **Garde l'écran allumé** pendant toute la lecture.

## Ce que l'outil ne fait pas

- Il ne lit pas à votre place : il n'y a pas de synthèse vocale.
- Il ne corrige pas votre texte tout seul.
- Il ne vous écoute pas à votre insu : la reconnaissance ne tourne que quand
  vous appuyez sur **Démarrer**, et le moteur par défaut ne quitte jamais
  l'appareil.
