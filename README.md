# 🏓 Carnet Ping

Application mobile (PWA) pour suivre mes matchs de tennis de table et les faire analyser par une IA.

- **Saisie** : date, contexte, classement (le mien et celui de l'adversaire au moment du match), profil adversaire, score détaillé par set, tags de ce qui a marché / pas marché, ressenti (1-5), commentaires.
- **Stats** : forme récente, résultats par contexte, par écart de points, par profil d'adversaire, belles, ressenti moyen en victoire / défaite, problèmes récurrents.
- **IA** : bouton « Copier pour l'IA » qui génère une consigne d'analyse et toutes les données, à coller dans Claude.
- **Sauvegarde** : export JSON (restaurable) et CSV (Excel).

Les données restent **uniquement sur le téléphone** (localStorage) : rien n'est envoyé sur GitHub. Pense à exporter régulièrement.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure des écrans |
| `style.css` | Mise en forme (clair / sombre) |
| `app.js` | Toute la logique |
| `sw.js` | Fonctionnement hors ligne |
| `manifest.webmanifest` + `icons/` | Installation sur l'écran d'accueil |

## Mettre à jour l'appli

1. Modifier les fichiers.
2. Dans `sw.js`, incrémenter `CACHE` (ex. `carnet-ping-v2`).
3. `git add . && git commit -m "..." && git push` : GitHub Pages republie en 1 à 2 minutes.
4. Sur le téléphone, fermer et rouvrir l'appli (2 fois si besoin).
