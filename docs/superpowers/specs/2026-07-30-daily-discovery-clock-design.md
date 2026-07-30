# Chronomètre de découverte sur le défi du jour — design

**Date** : 2026-07-30 · **Statut** : implémenté

## Le problème

Le classement du daily trie par `(coups, retouches, date de soumission)`
— `rankingOrder` dans `src/server/ranking.ts`. Or chaque puzzle a un optimum
certifié par le solveur, et le jeu récompense explicitement le fait de
l'atteindre (le tampon _Bon à tirer_). Tout joueur sérieux converge donc vers le
même résultat : à l'optimum, zéro retouche.

À ce moment-là le classement est saturé et le seul départage restant est **qui a
soumis en premier**. Ce n'est pas une mesure de talent, c'est une mesure de
fuseau horaire et de disponibilité : à performance strictement identique, celui
qui joue à 7h bat celui qui joue à midi.

Il faut un départage qui distingue encore deux joueurs parfaits, et qui mesure
quelque chose que le joueur contrôle réellement.

## Ce qu'on mesure

Le **temps de découverte** d'un tier du jour, pour un joueur : la durée entre le
moment où le serveur lui remet la grille et le moment où il lui soumet une trace
gagnante.

Les deux bornes sont des horodatages serveur. Le client n'envoie jamais de
durée — il n'a rien à dire sur le sujet, donc rien à falsifier. La seule
influence qui lui reste est de soumettre plus tard, ce qui ne peut qu'**allonger**
son temps.

### Pourquoi la découverte et pas le meilleur temps

Les tentatives sont illimitées : `src/ui/submissionPolicy.ts` garde par compte le
meilleur résultat et repost un re-solve amélioré. Chronométrer le meilleur essai
ferait donc converger tout le monde vers « exécuter une solution déjà mémorisée
le plus vite possible » — un concours de vitesse de doigts où le clavier de
bureau bat systématiquement le swipe mobile. Ce serait _moins_ juste que l'ordre
d'arrivée actuel, qui au moins n'avantage aucun périphérique.

Le temps de découverte mesure au contraire ce que le jeu demande : lire le
plateau et trouver la ligne.

### Portée : le daily seulement

La campagne garde son classement inchangé. Deux raisons. Le daily a déjà un
point de contact serveur à l'ouverture, alors que `src/routes/level.$plate.tsx`
lit `LEVELS[idx]` depuis une constante embarquée dans le bundle — aucun
aller-retour. Et surtout, le daily est le seul endroit où comparer des temps a un
sens : tout le monde découvre la même grille le même jour, là où deux joueurs de
campagne peuvent découvrir un niveau à des mois d'écart.

## L'ancre

### La table

Nouvelle table `daily_view` : clé primaire `(date, tier, userId)`, une colonne
`servedAt`. Écrite en `onConflictDoNothing`, donc **la première écriture gagne et
l'ancre est immuable** — recharger la page ne redonne pas une horloge fraîche.

### La fonction serveur

`getDailyPuzzle` devient `openDaily({ tier })` : elle pose l'ancre **et renvoie la
grille dans le même appel**. Elle reste appelée depuis le loader de
`/daily/$tier`, à son emplacement actuel.

**Pourquoi la grille et l'ancre dans le même appel** — c'est le point le plus
important du design. Si la grille restait accessible par un appel séparé, on
pourrait la récupérer, l'étudier tranquillement, puis démarrer une horloge sur un
puzzle déjà résolu. En fusionnant les deux, **obtenir la grille devient
indissociable de démarrer son chrono**.

**Pourquoi le loader convient** — une version antérieure de cette spec plaçait
l'ancre dans le composant, au motif que `defaultPreload: 'intent'`
(`src/router.tsx:8`) ferait courir le chrono au survol du lien. C'était faux, et
la vérification l'a montré : le préchargement « intent » ne s'applique qu'aux
composants `<Link>`, or le seul `<Link>` du dépôt pointe vers
`/profile/$username` (`src/ui/components/LeaderboardRows.tsx:68`). L'entrée dans
le daily passe par des boutons qui appellent `navigate({ to: "/daily/$tier" })`
(`src/routes/levels.tsx:52-54`). Aucun survol ne déclenche le loader.

Garder l'ancre dans le loader préserve trois choses qu'un déplacement vers le
composant aurait coûtées : `key={level.id}` qui exige un `level` dès le premier
rendu, l'`errorComponent` de la route, et la redirection du tier 3 hors week-end
— tous des mécanismes de loader. Et l'écran de jeu reste prêt sans aller-retour
supplémentaire.

Le loader se réexécute à chaque navigation (`defaultPreloadStaleTime: 0`), mais
c'est sans effet : l'ancre est en `onConflictDoNothing`, donc un aller-retour
`/levels` → `/daily/1` → `/levels` → `/daily/1` ne la déplace pas.

**Garde-fou** : ajouter un jour un `<Link to="/daily/$tier">` réintroduirait le
démarrage au survol. La route porte donc `preload: false` explicitement, pour que
l'invariant soit appliqué plutôt que mémorisé.

## Deux fuites de grille à colmater

Fusionner la grille et l'ancre ne sert à rien s'il reste un autre chemin vers la
grille. La vérification en a trouvé deux, toutes deux réelles.

### `getWeekendDaily` distribue le tier 3 depuis le sélecteur

`src/routes/levels.tsx:29-37` appelle `getWeekendDaily()` au montage de `/levels`
pour un simple test `p !== null` — savoir s'il faut afficher la plaque week-end.
Or la fonction renvoie l'objet `DailyPuzzle` complet, `level` inclus
(`src/server/daily.ts:67-73`). La grille du tier 3 est donc remise à tout
visiteur du sélecteur, bien avant qu'il n'entre dans le puzzle.

Correction : `getWeekendAvailable()` ne renvoie qu'un booléen. La grille du tier 3
ne s'obtient plus que par le chemin ancré.

### Le repli est reproductible hors ligne

Les jours où le cron n'a écrit aucune ligne, la grille vient de `fallbackPuzzle`
(`src/server/dailyPuzzle.ts:56-75`) : purement déterministe à partir de
`(date, tier)`, de `difficultyBands()` et de la banque `LEVELS`. Or `LEVELS` et le
solveur sont tous deux embarqués dans le bundle client — `useGame` s'en sert
pour les indices. Un joueur peut donc calculer la grille de repli sans jamais
appeler le serveur, et présenter ensuite un temps de découverte quasi nul.

Correction : **un jour non certifié par le cron n'est pas chronométré.** L'ancre
enregistre la provenance de la grille et le temps reste `NULL`. Tous les joueurs
de ce jour sont alors à égalité sur ce critère et le départage retombe sur la
date de soumission — le comportement actuel.

La provenance se lit sur une colonne `generated` de `daily_puzzle`, que **seul le
générateur cron** met à vrai, et non sur la simple existence de la ligne. La
distinction est indispensable : une soumission insère elle aussi une ligne, pour
que la clé étrangère du score tienne, ce qui épingle la grille de repli comme
puzzle officiel du jour. Se fier à l'existence laisserait donc le premier joueur
à soumettre promouvoir une journée non certifiée en journée chronométrée, sans
que la grille change — le garde-fou serait contourné sans même le vouloir.

## Prérequis : dégénéraliser `leaderboard.ts`

`boardRows`, `standing` et `upsertBestScore` (`src/server/leaderboard.ts`) prennent
aujourd'hui une **union** `ScoreTable = dailyScore | levelScore`. Ajouter
`elapsed_ms` au seul `daily_score` casse alors le typage à trois endroits :
`table.elapsedMs` sur l'union, le `set:` de `onConflictDoUpdate`, et
`row.elapsedMs` sur `ScoreInsert`.

Le piège à éviter est plus sournois que les erreurs elles-mêmes : passer
`elapsedMs` dans l'objet littéral de l'appelant **typecheck** (la règle
d'excess-property sur une union l'autorise dès qu'un membre porte la propriété),
alors que le `set:` de l'upsert ne peut pas la mentionner. Un meilleur score
écraserait `moves`, `undos` et `trace` **sans jamais mettre à jour**
`elapsed_ms` — un bug silencieux, et exactement celui qui fausserait le
classement.

Ces trois fonctions passent donc d'une union à un vrai générique
`<T extends ScoreTable>` **avant** l'ajout de la colonne. C'est un préalable, pas
un refactor opportuniste : sans lui la colonne ne peut pas être écrite
correctement.

## Mise en service : mesuré d'abord, classant ensuite

Le critère part **désactivé** (`TIME_RANKS` dans `src/server/ranking.ts`). Le
temps est mesuré, stocké et affiché dès le premier jour, mais il ne trie rien :
le départage reste l'ordre de soumission.

La raison est que la saturation décrite en tête de ce document est une
*prédiction*. Tourner en mesuré-non-classant la transforme en observation, sans
rien risquer : au bout de quelques semaines les données diront si des joueurs se
retrouvent réellement à égalité parfaite, et donc si ce critère sert à quelque
chose.

L'autre raison est le prix. Classer au temps est exactement ce qui donne une
valeur à la triche : rejouer une solution mémorisée fait gagner quelques rangs
aujourd'hui, mais donnerait la première place une fois le temps décisif. Autant
ne payer ce prix qu'une fois les égalités constatées.

Basculer est une seule édition. La colonne se remplit déjà, donc les journées
passées deviennent classables du même coup, et `src/server/criteria.test.ts`
échoue à la bascule — de sorte qu'activer un critère de classement reste un geste
délibéré, avec un diff visible.

## La règle de classement

`src/server/ranking.ts` reste le propriétaire unique de la règle. L'ordre passe
de `(coups, retouches, date)` à `(coups, retouches, temps, date)`.

Les trois fonctions — `beatenBy`, `rankingOrder`, `strictlyAhead` — prennent une
colonne temps **optionnelle** : absente, elles se comportent exactement comme
aujourd'hui. C'est ce qui permet à la campagne de garder son classement inchangé
sans traîner une colonne morte dans `level_score`.

Nouvelle colonne `elapsed_ms` sur `daily_score` uniquement. En millisecondes : à
cette précision deux joueurs ne sont pratiquement jamais à égalité, donc le
départage tranche vraiment — c'est le point de départ de toute la démarche.
Affiché en `m:ss`.

L'upsert « meilleur résultat » s'étend naturellement : un re-solve qui égale les
coups et les retouches mais bat le temps remplace la ligne. Comme le temps part
d'une ancre immuable, un second essai a mécaniquement un temps plus long — donc
en pratique **la première résolution reste la mesure**, ce qui est exactement
l'intention.

## Pas de plafond

Une version antérieure de cette spec plafonnait à 30 minutes, pour que le joueur
qui ouvre la grille et s'absente soit à égalité avec les autres absents plutôt
que classé selon la durée de son déjeuner.

**Le plafond a été retiré**, et l'objection qui l'a fait tomber est simple :
l'ordre entre absents n'a aucune importance — ils sont derniers dans tous les
cas. Le plafond ne réglait donc qu'un problème cosmétique, pendant qu'il faisait
courir un risque réel : posé sous le temps de résolution honnête, il écrase les
**vrais** solveurs. Et il le fait au pire endroit, l'épreuve du week-end, un 6×6
à 26 coups minimum que le générateur décrit lui-même comme « tout un rang de
ramification en plus ». Là, tout le monde aurait touché le plafond et le
classement serait retombé sur l'ordre d'arrivée — exactement le problème de
départ.

La borne qui compte existe déjà : `isSubmittableDay` (`src/server/daily.ts`)
n'accepte que le jour courant ou la veille en UTC, donc une mesure ne peut pas
survivre au puzzle. Environ 48 heures au pire, sans rien ajouter.

## Le joueur non connecté

`src/ui/submissionPolicy.ts` prévoit explicitement qu'« une résolution faite hors
connexion est revendiquée par le premier compte qui se connecte ». Ce flux est
délibéré. Or un joueur non connecté n'a pas d'identité, donc pas d'ancre.

**Décision : on n'enregistre aucun temps.** On ne chronomètre que ce qu'on peut
ancrer. Le joueur garde son classement aux coups et aux retouches, il perd
seulement le départage au temps.

Les deux autres sorties ont été écartées. Refuser la soumission supprimerait un
flux conçu exprès. Ancrer les visiteurs anonymes sur un identifiant en cookie
serait remis à zéro d'un simple effacement, ce qui ruine la garantie serveur qui
fait tout l'intérêt du design.

### Ne jamais ancrer à la connexion

Une revue a proposé de reposer l'ancre quand une session apparaît, pour que le
joueur qui se connecte après coup soit chronométré. **Il ne faut pas.** Ancrer à
la connexion donnerait une horloge démarrant *après* que le joueur a vu la
grille : il suffirait alors de l'étudier tout à loisir hors connexion, de se
connecter, et de soumettre dans la seconde pour afficher un temps dérisoire.
L'ancre ne doit être posée qu'au moment où le serveur remet la grille, jamais
plus tard — c'est toute la garantie du design.

Le prix assumé est celui décrit ci-dessus : ce joueur n'est pas départagé au
temps. Le rail lui montre « se connecter pour être classé » avant qu'il ne joue,
et aucune horloge ne s'affiche, donc rien ne lui promet une mesure.

## `NULL` veut dire « non mesuré »

La colonne `elapsed_ms` est **nullable**, et `NULL` porte littéralement le sens
« le serveur n'a rien pu mesurer ici » : pas d'ancre, journée non certifiée,
intervalle négatif, ou ligne antérieure à la migration.

Le tri est explicitement `asc nulls last`, donc un résultat non mesuré se place
derrière tous les résultats mesurés et à égalité avec les autres non mesurés,
retombant sur la date de soumission — le comportement exact du classement avant
ce critère.

SQL ne compare pas les `NULL` pour nous, et c'est le piège de cette approche :
`elapsed_ms = NULL` n'est jamais vrai, donc un comptage naïf laisserait le rang
d'un joueur diverger de la position réelle de sa ligne. Les trois constructeurs
de `ranking.ts` explicitent donc ce que `NULL` signifie à chaque clause, et les
tests épinglent le SQL rendu.

## La migration

La colonne est nullable et sans défaut : les lignes existantes restent à `NULL`,
c'est-à-dire non mesurées, ce qu'elles sont réellement.

Propriété recherchée : toutes les journées d'avant la mise en service se
retrouvent uniformément à égalité sur le temps, donc leur classement retombe sur
la date de soumission. **L'historique est strictement préservé** — aucun joueur
n'est rétroactivement déclassé par une colonne qui n'existait pas quand il a
joué.

Procédure, vérifiée sur une copie hors dépôt : éditer `src/db/schema.ts`, lancer
`bun run db:generate` (Drizzle Kit produit le `.sql` et son snapshot), committer
le SQL, le snapshot et le journal ; le `preDeployCommand` de Railway applique.
Aucun runner ne tourne au démarrage de l'app.

Attention au fait que `bun run auth:generate` réécrit intégralement
`src/db/schema.ts` — l'avertissement en tête du fichier liste les tables à
réappliquer à la main. `daily_view` doit rejoindre cette liste.

Aucun lecteur existant de `daily_score` ne casse : tous passent par une
projection explicite `.select({...})`, il n'existe aucun `.select()` nu sur cette
table. Une colonne `NOT NULL DEFAULT` leur est invisible.

## Le chrono à l'écran

`openDaily` renvoie `servedAt` et l'heure serveur courante ; le client en déduit
son décalage d'horloge et affiche un compteur qui tourne dans le rail, à côté du
compteur de coups.

Cet affichage est **purement cosmétique**. Le serveur recalcule tout à la
soumission depuis sa propre ancre, donc un client qui truquerait son horloge ne
truquerait que son propre affichage.

## Ce que le design ne prétend pas résoudre

Un joueur qui obtient la grille sur un second compte, la résout tranquillement,
puis ouvre le daily sur son compte principal pour exécuter une solution déjà
connue obtiendra un temps court et honnêtement mesuré. Aucune parade bon marché
n'existe : c'est la même faille que sur n'importe quel classement au temps, et
elle est de la même famille que « mémoriser la solution optimale puis la
rejouer », que le classement aux coups accepte déjà aujourd'hui.

Le design garantit une chose précise et vérifiable : **le temps enregistré est
une borne supérieure honnête du temps écoulé depuis que ce compte a vu la
grille**, mesurée par le serveur seul.

## Vérification

- `src/server/ranking.test.ts` couvre déjà la règle sans Postgres. On y ajoute
  les cas du quatrième critère, dont la non-régression quand la colonne temps est
  absente (le chemin campagne).
- Un test sur le calcul du temps : intervalle normal, solve long non écrêté,
  ancre manquante, journée non certifiée, intervalle négatif, et un zéro qui
  doit rester une mesure plutôt que se confondre avec l'absence de mesure.
- `src/server/replay.test.ts` reste inchangé — le temps ne passe pas par le
  rejeu, il n'est dérivé d'aucune trace.
