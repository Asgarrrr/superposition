# Les pages de profil — la série de timbres

Statut : validé en brainstorming le 2026-07-31.

## Le problème

`/profile/me` et `/profile/$username` rendent aujourd'hui le même `ProfileScreen` :
le nom en double encre, trois chiffres de présence (série en cours, plus longue
série, total), et la grille de contributions du daily. Quatre manques :

1. **La campagne est absente.** Les 22 plaques, les records et les « bon à
   tirer » vivent dans `level_score` et n'apparaissent nulle part. Pour une page
   qu'on partage, c'est la moitié du jeu qui manque.
2. **Le privé et le public sont identiques.** `/profile/me` ne montre rien de
   plus, ne propose rien à faire, et ne dit pas quel est l'objectif suivant.
3. **Les trois chiffres mesurent tous la même chose** — la présence. Rien ne dit
   la qualité du jeu.
4. **Aucune distinction n'est lisible d'un coup d'œil** par quelqu'un qui ne
   connaît pas le joueur.

La page est une **carte de visite à partager** : ce qui prime est qu'un inconnu
la comprenne en trois secondes, et qu'elle tienne sur la carte Open Graph.

## La forme retenue

Une **série philatélique de quatre timbres**, un par famille de mérite, posée en
haut de la feuille sous le nom. Un timbre est en papier crème sur la table
sombre, dentelé, burelé, avec sa valeur faciale en cartouche, son libellé, et une
**oblitération datée du jour où la distinction a été décrochée**.

Trois propriétés qui justifient ce choix contre une collection ouverte de badges :

- **La taille est bornée par construction.** Toujours quatre timbres, quel que
  soit le nombre de paliers ajoutés plus tard. La page ne se remet jamais en page.
- **Le palier se lit comme une valeur faciale.** Une série philatélique imprime
  le même dessin dans une encre différente par valeur. Les quatre paliers d'une
  famille sont donc les quatre timbres d'une même série : le dessin ne bouge pas,
  seuls l'encre et le chiffre changent.
- **La case vide d'album** est la forme native du non-décroché : le cadre
  pointillé où le timbre manquant serait collé, avec la condition écrite dedans.
  Elle est montrée **aussi sur la page publique** — elle donne l'échelle de la
  série sans rien exposer d'humiliant.

Chaque gravure est **l'image de l'acte accompli dans le jeu**, jamais une
allégorie : aucune ne demande de légende.

## Les quatre familles

| Famille    | Mesure                                                                        | Gravure                                                                                           | Paliers            |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| Régularité | la **plus longue** série de jours                                             | un calendrier dont les cases sont remplies sans trou, le jour courant en double encre             | 7 · 30 · 100 · 365 |
| Maîtrise   | le nombre de **bons à tirer** (résolutions au coup optimal, daily + campagne) | le plateau 5×5, le chemin le plus court tracé en pointillé, les deux pions superposés à l'arrivée | 1 · 10 · 40 · 120  |
| Rareté     | le nombre d'**épreuves d'artiste** (le palier 3, week-end seulement)          | le grand plateau 6×6 peuplé de cases pleines et de glaces                                         | 1 · 5 · 20 · 52    |
| Édition    | les **plaques au record** dans `level_score`                                  | les 22 plaques rangées et centrées par chapitre, les non tirées en réserve                        | 1 · 6 · 14 · 22    |

**La régularité se mesure sur la plus longue série, pas sur la série en cours.**
Un timbre qui se décolle parce qu'on a sauté un mardi n'est pas une preuve. La
série en cours reste affichée, mais comme chiffre.

### Couleurs

**La couleur distingue la famille, pas le palier** — les quatre timbres portent
quatre gravures différentes, donc c'est la famille qui a besoin d'être
distinguée d'un coup d'œil. Le palier, lui, se lit sur le chiffre de la valeur
faciale, qui est la seule chose qui change entre deux paliers d'une même
famille.

Régularité `#a81a5c` (magenta profond), maîtrise `#17737d` (cyan profond),
rareté `#6b4fa8`, édition `#9a6d11` (or). Le violet de la rareté n'existe nulle
part ailleurs dans le jeu : la seule famille qui parle d'exception est la seule
à porter une couleur d'exception.

Le dernier palier épaissit le filet intérieur du cadre — le seul écart visuel
entre paliers, et il reste discret.

### Les deux encres

Peintes **explicitement** : un disque cyan `#2bb8c4`, un disque magenta
`#e82d86`, et la lentille de recouvrement en `#272067` — la teinte que donnent
deux encres superposées. Pas de `mix-blend-mode` : le mode de fusion réagit à la
couleur du fond (le cyan virait au vert sur le timbre or) et n'est pas rendu de
façon fiable par satori pour la carte OG.

## Architecture

### `src/lib/distinctions.ts` — la règle, pure

Seul propriétaire des familles, des seuils et de la résolution d'un palier.
Ne connaît ni React ni la base.

```
DistinctionInput { days, bat, artist, plates }   // listes de dates UTC
Distinction { family, count, tier, threshold, earnedOn, next }
distinctions(input, today) → Distinction[]       // toujours 4, dans l'ordre
```

- `tier` va de 0 (case vide d'album) à 4.
- `earnedOn` est la date à laquelle le palier courant a été franchi — la date de
  l'oblitération. Pour les familles qui comptent, c'est la date du n-ième
  événement qualifiant ; pour la régularité, la date à laquelle une série a
  atteint la longueur du seuil pour la première fois.
- `next` est le prochain seuil, ou `null` au dernier palier. C'est ce qui
  s'écrit dans la case vide.

Testé dans le projet `pure` de Vitest. **Aucune règle de palier ne doit vivre
ailleurs.**

### `src/server/profileData.ts` — l'accès aux données

`DailyHistory` s'étend de ce qu'il faut pour alimenter `distinctions()` et la
section campagne :

- `bat` — les dates des bons à tirer. Côté daily, une jointure
  `daily_score × daily_puzzle` sur `(date, tier)` filtrée par
  `moves <= optimal`. Côté campagne, les lignes `level_score` filtrées en JS par
  `PAR[levelId]`, `PAR` vivant dans le code et non en base.
- `artist` — les dates des lignes `daily_score` de `tier = 3`.
- `plates` — une ligne par plaque tirée (`levelId`, `moves`, `undos`, date),
  qui sert à la fois au timbre Édition et à la section campagne.
- `cleanCount` — les résolutions sans retouche (`undos = 0`), daily et campagne,
  pour le quatrième chiffre.

Les volumes sont bornés (22 plaques, une ligne par jour et par palier), donc les
lignes sont ramenées et agrégées en JS plutôt qu'en SQL — c'est le même coût et
ça garde la règle dans `distinctions.ts`.

### `src/ui/components/Stamp.tsx` — le timbre

Reçoit une `Distinction` et rend un SVG. Frontière nette : le composant ne
décide d'aucun seuil, il ne fait que dessiner. Les quatre gravures sont quatre
fonctions internes choisies par `family`. Le timbre non décroché rend la case
vide d'album, avec `next` écrit dedans.

C'est **le seul endroit** où vit le dessin du timbre : la carte OG le
réutilisera plutôt que d'en peindre une seconde version.

### `src/ui/screens/ProfileScreen.tsx`

Ordre de la feuille, de haut en bas : colophon (nom, membre depuis) → la série
de quatre timbres → le bandeau de quatre chiffres → « Le quotidien » et la
grille → « L'édition » et les 22 plaques.

Le quatrième chiffre passe de trois mesures de présence à deux de présence et
deux de qualité : série en cours, jours, bons à tirer, sans retouche.

Le composant reste présentationnel. Les routes gardent la session et le fetch.

### `src/server/og/card.tsx`

La rangée de quatre timbres entre sur la carte, sous le nom. Aucun
`mix-blend-mode` n'est employé, donc rien à traduire.

## Ce qui est hors périmètre

- **La remontée du ledger local vers le serveur.** Le timbre Édition se lit dans
  `level_score`, écrit seulement quand on est connecté. Qui a bouclé la campagne
  avant de créer un compte verra son profil public sous-estimer sa progression.
  `progressSync.ts` descend déjà les records du serveur vers le client ; l'inverse
  est un chantier à part, à décider séparément.
- **Le dessin définitif des gravures.** Les quatre motifs sont validés dans leur
  principe et dans leur composition. Un passage de finition dans un outil de
  design pourra les remplacer sans toucher au reste, puisque `Stamp.tsx` est la
  seule frontière.

## Vérification

- `src/lib/distinctions.test.ts` — projet `pure`. Couvre : le palier 0 et sa
  case vide, chaque franchissement de seuil, la date d'oblitération du n-ième
  événement, la date à laquelle une série atteint sa longueur, le dernier palier
  dont `next` est nul.
- `bun run test`, `bun run lint`, `bun run build` (qui inclut `tsc --noEmit`).
