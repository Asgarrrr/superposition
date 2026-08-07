# La version finale — la passe de finition

Statut : validé en brainstorming le 2026-08-07.

## Le problème

Le dépôt n'est pas en dette au sens habituel. L'état mesuré avant d'écrire cette
spec :

```
bun run lint    → exit 0 (10 warnings react/only-export-components, inhérents
                          aux modules de route TanStack)
tsc --noEmit    → exit 0
bun run test    → exit 0 — 33 fichiers, 320 tests
bun run build   → exit 0 — 665 Ko de JS client brut, sortie Nitro complète
git status      → propre
```

Passer en 1.0 ne consiste donc pas à réparer, mais à fermer quatre écarts qui
tirent chacun dans une direction différente :

1. **Aucune frontière de route à la racine.** Ni `notFoundComponent` ni
   `errorComponent` sur `__root.tsx` ; seul `daily.$tier` en porte un. Une URL
   inconnue, ou une erreur de loader, tombe sur l'écran par défaut du routeur —
   hors direction artistique, non localisé, sans issue vers le jeu. C'est le seul
   trou objectif de la revue.
2. **L'écart `ever_clean`**, consigné dans « Next steps » d'AGENTS.md depuis la
   synchro de progression : le serveur garde UNE ligne par niveau, pas un
   historique. Un joueur dont le run sans retouche n'était pas son meilleur score
   n'a aucun fait « déjà résolu proprement » à récupérer sur un nouvel appareil.
   Son sceau est perdu avec son localStorage.
3. **~30 symboles exportés sans consommateur externe** (`FAMILIES`, `SHADE_HEX`,
   `randomLevel`, les `*Relations` du schéma, une douzaine de types internes).
   Du bruit dans la surface publique des modules, pas de la dette de
   comportement.
4. **Pas de sitemap, `robots.txt` minimal** (`Disallow:` seul, `/api/` ouvert au
   crawl, aucune directive `Sitemap:`), et AGENTS.md qui décrit encore l'écart
   `ever_clean` comme ouvert.

## Le découpage retenu

**Un lot par axe, une branche par lot**, mergés dans l'ordre du risque :
frontières → `ever_clean` → hygiène → release.

Le lot `ever_clean` touche le schéma Postgres. Le mélanger à une suppression
d'exports dans un même diff donnerait un merge qu'on ne sait plus bisecter ni
révoquer proprement. Quatre branches courtes, chacune révisable et
`git revert`-able seule, contre un cycle de vérification par lot : c'est le bon
échange ici, et c'est ce que demandent déjà les règles git du dépôt (une branche
par changement, ~150 lignes de diff visées).

---

## Lot 1 — Les frontières de route

Branche `fix/route-boundaries`.

### La forme

**Un seul composant pour les deux cas.** `src/ui/screens/FallbackScreen.tsx`,
paramétré par titre, corps et action, monté deux fois depuis `__root.tsx` :
`notFoundComponent` et `errorComponent`.

Deux écrans séparés dériveraient : c'est la même page — « tu es sorti de
l'atelier, voici la porte » — avec deux textes. Le dépôt tranche déjà ce genre de
question par un propriétaire unique (cf. le tableau « Don't recreate »
d'AGENTS.md) ; un écran de repli ne fait pas exception.

### Le contenu

Direction artistique table lumineuse, comme le reste. Textes ajoutés à
`project.inlang/messages/fr.json` et `en.json` — rien en dur dans le composant.

- **404** : le titre, une ligne, un retour vers `/levels`.
- **Erreur** : le titre, une ligne, un « réessayer » qui appelle
  `router.invalidate()`, et le même retour vers `/levels`.

L'`errorComponent` **n'affiche jamais la stack ni le message de l'erreur**. Une
erreur de loader porte des détails serveur (requête, chemin, parfois un fragment
de SQL) ; les rendre au visiteur est une fuite d'information pour un gain nul —
il ne peut rien en faire. L'erreur reste dans les logs serveur.

### Le rendu côté serveur

La racine est en `ssr: true` (pour que le profil public puisse rendre
server-side). Le `FallbackScreen` ne touche donc aucune API navigateur :
pas d'`AudioContext`, pas de `localStorage`, pas de `window` au premier rendu.
C'est une contrainte du composant, pas une option.

### Vérification

`FallbackScreen.test.tsx`, projet `dom` : rend les deux modes, vérifie que le
texte vient bien des messages et que l'action de retour est câblée. Plus un
passage manuel sur `/nimportequoi`.

---

## Lot 2 — L'écart `ever_clean`

Branche `feat/ever-clean`.

### Le schéma

Une colonne sur `level_score` :

```ts
everClean: boolean("ever_clean").notNull().default(false),
```

Migration générée par `drizzle-kit generate`, **plus un backfill écrit à la main
dans le même fichier SQL** :

```sql
UPDATE level_score SET ever_clean = true WHERE undos = 0;
```

Sans ce backfill, tout joueur dont la meilleure ligne actuelle est propre
perdrait son sceau à la première resynchro — la migration créerait l'écart
qu'elle est censée fermer.

### Le point délicat : l'écriture ne peut pas passer par `upsertBestScore`

`upsertBestScore` garde son `onConflictDoUpdate` par `beatenBy(...)`. Un run sans
retouche qui **ne bat pas** la ligne stockée n'écrirait donc rien — et c'est
exactement le cas que ce lot existe pour fermer. Y greffer le `ever_clean`
donnerait une colonne qui ne se remplit que dans les cas déjà couverts.

Donc **deux instructions** dans `submitLevelScore` :

1. l'upsert existant, inchangé ;
2. puis, si `result.corrections === 0`, un
   `UPDATE level_score SET ever_clean = true WHERE level_id = ? AND user_id = ?`.

Idempotent, et la ligne existe forcément après l'étape 1. Un aller-retour DB de
plus sur le seul chemin d'une soumission propre.

**Ce code vit dans `src/server/campaign.ts`, pas dans `leaderboard.ts`.**
`leaderboard.ts` est le module partagé entre les deux tableaux ; la colonne
n'existe que sur `level_score`. L'y mettre imposerait un troisième garde
`everCleanColumn(table)` à côté de `elapsedColumn` pour une règle qui n'a qu'un
seul appelant.

### La lecture

`getMyLevelScores` renvoie `everClean` en plus de `moves` et `undos`.
`ServerScore` (dans `src/ui/progressSync.ts`) le porte. `asWin` lit
`clean: s.everClean` au lieu de `s.undos === 0`.

### Ce qui ne bouge pas, volontairement

- **Le sceau des tableaux.** `LeaderRow.clean` et `MyResult.clean` restent
  dérivés de la ligne affichée (`undos === 0`). Un tableau qui classerait une
  ligne sur ses coups tout en la scellant d'après un autre run mentirait sur ce
  qu'il montre. `ever_clean` est un fait de **progression** (le registre local),
  pas un fait de **classement**.
- **`planUploads`.** Sa règle de départage — sur égalité de coups, seul un tracé
  local propre vaut un envoi — porte sur la ligne stockée, qui garde sa
  sémantique. Aucune raison de la toucher.

### Vérification

- `progressSync.test.ts` étendu sur `asWin`.
- **Limite assumée** : le dépôt n'a pas de harnais de test contre Postgres. La
  partie SQL — la migration, le backfill, la collance de l'`UPDATE` — sera
  vérifiée à la main contre le Postgres de `docker-compose.yml`, pas par un test
  automatisé. Le scénario manuel : résoudre proprement sans battre son record,
  vider le localStorage, se reconnecter, constater que le sceau revient.

### Documentation

La note « Residual gap » de « Next steps » dans AGENTS.md disparaît ; une ligne
entre au tableau « Don't recreate » : le fait « déjà résolu proprement » a un
propriétaire unique, la colonne `level_score.ever_clean` écrite par
`submitLevelScore`.

---

## Lot 3 — L'hygiène

Branche `chore/dead-exports`.

Les ~30 symboles exportés sans consommateur hors de leur propre fichier, triés en
trois :

- **contrat de framework** (`startInstance`, `getRouter`, les `*Relations` de
  Drizzle) — on ne touche pas ;
- **type interne** — on retire le `export` ;
- **réellement mort** — on supprime.

Zéro changement de comportement. Vérifié par `tsc --noEmit`, les 320 tests et le
build : un symbole retiré à tort casse la compilation, ce qui rend ce lot sûr par
construction.

**Hors périmètre, signalé** : `src/ui/screens/PlayScreen.tsx` fait 422 lignes, le
plus gros fichier du dépôt, et porte visiblement plusieurs responsabilités. Le
découper est un refactor à part entière — pas de l'hygiène, et pas quelque chose
qu'on glisse dans une passe de finition. La note reste, la décision est
ultérieure.

---

## Lot 4 — La release

Branche `chore/release-1.0`.

### `sitemap.xml` et `robots.txt` deviennent des routes serveur

La directive `Sitemap:` exige une **URL absolue** : les deux fichiers ont donc
besoin de l'origine, que seul le serveur connaît (`BETTER_AUTH_URL`). Les garder
statiques dans `public/` obligerait à coder l'origine de production en dur dans
le dépôt. Deux routes, montées à côté des routes API existantes ;
`public/robots.txt` est supprimé (une route et un fichier statique de même nom se
disputeraient la même URL).

Le sitemap liste **les routes statiques seulement** : `/`, `/levels`,
`/level/1` à `/level/22`, `/align`. Les profils sont des données utilisateur —
publiables une par une, mais pas énumérables dans un fichier que l'on sert à tout
le monde. `robots.txt` ferme `/api/`.

### Documentation et livraison

README et AGENTS.md remis en phase avec le dépôt. Puis merge des quatre branches
dans `main` dans l'ordre ci-dessus, et tag `v1.0.0`. Le déploiement Railway reste
un geste de l'auteur.

---

## Vérification, par lot

Après chaque lot, les quatre commandes et leurs codes de sortie collés au
rapport :

```
bun run lint
tsc --noEmit
bun run test
bun run build
```

Le lot 2 ajoute `bun run db:migrate` contre le Postgres local et le scénario
manuel décrit plus haut.
