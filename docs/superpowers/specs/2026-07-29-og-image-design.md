# Carte Open Graph du site — design

**Date** : 2026-07-29 · **Statut** : implémenté

## Le problème

Le site n'avait aucune balise Open Graph en dehors de `profile.$username.tsx`.
Partager `/`, `/levels`, `/level/$plate`, `/daily/$tier` ou `/align` produisait un
lien nu : pas de titre, pas de description, pas de vignette. `__root.tsx` ne
portait que le viewport, le `theme-color` et le titre.

## Portée

Une seule carte par défaut pour tout le site. Les cartes par plateau ou par
partie du jour restent hors périmètre : elles poseraient une question de spoiler
(montrer le plateau du jour dans l'aperçu, c'est en dévoiler une partie) et
demanderaient une route rendue à la demande. Le choix retenu ici ne les bloque
pas — une route satori pourra être ajoutée plus tard, l'image statique restant le
repli.

## Technique : PNG statique, pas de route

L'image ne dépend d'aucune donnée qui varie par requête. Elle est donc générée à
la main par `scripts/gen-og.ts` et servie comme fichier statique, sur le modèle
de `gen-icons.ts` et `gen-hero.ts` qui existaient déjà.

**Pourquoi pas satori**, alors que `src/server/og/card.tsx` l'utilise pour les
profils : le `screen` entre les deux encres _est_ la signature du jeu — le blanc
au cœur du wordmark, et là où les deux films se recouvrent, est produit par le
mélange, pas par un aplat. Or satori ne le rend pas.

Les deux moitiés ont été mesurées sur la même figure, un disque cyan et un
disque magenta se recouvrant sur le fond d'atelier, chacun en
`mix-blend-mode: screen` :

- **resvg** rend le mélange : l'intersection vire au blanc.
- **satori** le jette silencieusement. Sa sortie SVG ne contient pas la
  propriété du tout — les deux disques sont de simples `<path>` avec un `fill`,
  et le magenta, peint en dernier, recouvre le cyan. Rien n'avertit : le style
  est accepté puis ignoré.

C'est la raison décisive du choix, et pas une préférence. Le second grief
souvent fait à satori — qu'il n'implémente qu'un sous-ensemble de flexbox — n'a
pas été mesuré ici et n'a pas pesé dans la décision.

## Composition

Format 1200 × 630. De l'arrière vers l'avant :

1. **Le lavis de la pièce** — dégradé radial `box-glow` → `#1a1611` → `room`.
2. **La trame de la table**, d'un bord à l'autre. Un plateau 5 × 5 est carré et
   ne peut pas remplir un cadre en 1,91:1 sans qu'on zoome au point de ne plus
   reconnaître un jeu. Les grilles d'encre courent donc jusqu'aux coins, au même
   pas que les cases et **en phase** avec elles, la magenta portant le décalage
   du monde. Un masque radial les fait tomber dans l'ombre aux angles.
3. **La matière du jeu** — murs hachurés, buts pointillés, pions — centrée, au
   même réglage que `InkLayer.tsx` (hachures à quatre traits, `fill-opacity`
   0,14, buts en `5 5`, hors-registre de 4 px au repos).
4. **Le wordmark**, centré, traité comme `Wordmark.tsx` : deux couches d'encre
   en `screen`, **sans couche papier**. Le blanc naît du recouvrement, les
   franges cyan et magenta de son absence.
5. **La phrase**, en Instrument Serif italique papier à 82 %.
6. **Les quatre croix de repère** aux angles, géométrie de `RegMark.tsx`
   agrandie ×1,5.

## Le choix du plateau : `abysse`

Le mot fait 620 px de large sur des cases de 129 px : il traverse les cinq
colonnes d'une même rangée. Le critère décisif est donc que **cette rangée soit
vide**, et que la matière se répartisse dans les colonnes extérieures pour que la
plaque tienne jusqu'aux bords.

Les 22 plateaux ont été passés au crible sur trois mesures — éléments dans la
rangée du texte, éléments dans les colonnes extérieures, total. `eclipse` sortait
premier mais porte la mécanique `lumiere`, dont les carrés blancs pointillés
entraient en conflit avec la typographie. `abysse` est le meilleur des plateaux
sans `lumiere` : 11 éléments, 5 en colonnes extérieures, **0 sous le texte**.

Ce n'est pas un dessin : c'est l'état initial réel du plateau, lu depuis
`LEVELS` et `initialState`. Aucun bloc décoratif n'a été ajouté — la doctrine du
projet veut que rien ne soit décoratif.

## Deux images plutôt qu'une

Le site est bilingue et l'image est statique : une phrase française serait fausse
pour un visiteur anglophone. `scripts/gen-og.ts` émet donc `og-fr.png` et
`og-en.png`, et `head()` choisit selon la locale résolue.

La phrase imprimée vient de la clé `og_tagline` du catalogue inlang, lue
directement depuis le JSON source par le script. L'image et la balise
`og:description` (clé voisine `og_description`) ne peuvent donc pas diverger sur
la formulation.

- `og_tagline` — « Alignez deux mondes d'un seul geste. » / « Align two worlds
  with a single move. »
- `og_description` — la phrase longue de la balise.

Note : les clés `title_tagline` et `title_cta` du catalogue sont orphelines, non
référencées dans `src/`. Elles n'ont pas été touchées.

## Câblage

`head()` dans `__root.tsx`, conformément à la doc TanStack Start : `og:*` en
`property`, `twitter:*` en `name`. L'URL absolue suit le motif déjà en place dans
`profile.$username.tsx` — `window.location.origin` côté client,
`process.env.BETTER_AUTH_URL` côté serveur.

`buildTagsFromMatches` (routeur) parcourt les routes de la plus profonde à la
plus superficielle et garde la première occurrence de chaque `name`/`property` :
la route la plus profonde gagne et les doublons du parent sont supprimés. La
carte du profil public continue donc de primer. Conséquence corrigée au passage :
`profile.$username.tsx` redéfinissait `og:image` sans redéfinir `og:image:alt`,
qui aurait hérité du texte de la racine et mal décrit la carte de profil.

## Vérification

`bun run build`, `bun run lint`, `bun run test` et `bun run verify` sortent en 0.
Le serveur construit a été interrogé sur les deux langues : `og:image` pointe
vers `og-fr.png` ou `og-en.png` selon l'en-tête `Accept-Language`, avec
`og:locale` et `og:image:alt` accordés, et les deux PNG sont servis en 200
(1200 × 630, ~168 ko chacun).

## Régénérer

```sh
bun scripts/gen-og.ts
```

Les valeurs visuelles sont dupliquées depuis `InkLayer.tsx`, `RegMark.tsx` et
`Wordmark.tsx` — délibérément, comme `gen-hero.ts` redessine le plateau pour
l'animation du README. Si la direction artistique bouge, ces trois fichiers et ce
script doivent bouger ensemble.
