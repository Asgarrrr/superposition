# Superposition — le grand saut : concept, idées, évolution

Statut : vision — le document qui cadre les deux prochaines années du jeu.
Rien ici n'est spécifié au niveau implémentation ; chaque chantier retenu
donnera lieu à son propre spec dans ce dossier.

## La thèse

Superposition possède trois actifs rares, et le « step up » ne consiste pas à
ajouter du contenu mais à les exploiter à fond :

1. **Un verbe unique.** Une entrée, deux mondes. Toute la difficulté vient de
   la divergence entre les couches. C'est une idée de game design pure, pas un
   habillage — et elle n'est pas épuisée : on n'a exploré que la divergence
   *spatiale* (murs, décalage). Restent la divergence *directionnelle*,
   *temporelle*, et le passage à **trois** couches.
2. **Un moteur certifiable.** Fini, discret, déterministe, hashable. Le
   solveur, le générateur et l'anti-triche consomment la même API que le jeu.
   Très peu de jeux peuvent *prouver* leurs niveaux — c'est notre licence pour
   ouvrir le jeu au contenu joueur sans jamais casser la promesse « aucun
   niveau impossible ».
3. **Une fiction habitée.** L'atelier de sérigraphie n'est pas un skin : les
   repères de calage *visualisent* le décalage, la fusion *est* le blanc du
   mélange screen, le tampon ambre *est* le bon à tirer. Chaque nouvelle
   mécanique doit continuer d'exister dans cette fiction — c'est le filtre.

Quatre piliers, ordonnés du moins cher au plus ambitieux : **approfondir le
système** (nouvelles mécaniques), **ouvrir l'atelier** (éditeur + plaques
partagées), **rendre le jeu vivant** (duels, éditions limitées), et le grand
saut conceptuel : **la trichromie** (le troisième film).

## Les règles d'or (non négociables)

- L'état reste fini, discret, déterministe, hashable. Aucune mécanique temps
  réel, aucun aléa en cours de partie, aucune information cachée.
- Chaque effet à l'écran est une conséquence lisible de l'état — rien de
  décoratif.
- Une mécanique = un fichier dans `src/engine/mechanics/` + une preuve de
  nécessité par le solveur (`isRequired`) + une signature sensorielle
  (son + haptique + visuel) + une chorégraphie de tutoriel guidé (le système
  du spec `2026-07-18` accueille les nouvelles mécaniques tel quel).
- Le temps n'est jamais un critère de classement (la règle unique de
  `ranking.ts` — coups, puis corrections — vaut pour tout ce qui suit).
- Au plus un `resolveMove` par niveau (le registre le garantit déjà).

---

## Pilier 1 — Approfondir : la banque de mécaniques

Cinq candidates, classées par coût croissant. Chacune ouvre un chapitre.

### `verso` — le film à l'envers (coût S, impact majeur)

Le film magenta est posé **émulsion contre le verre** : il reçoit l'entrée en
miroir (gauche ↔ droite). Une flèche, deux directions. C'est la divergence
*directionnelle* — la plus violente cognitivement pour le coût moteur le plus
faible.

- Règle : les entrées `move` appliquées à la couche B sont réfléchies sur
  l'axe vertical. Une fois **fusionné**, le pion blanc vit « sur le verre »,
  plus sur le film : il suit la direction brute. (Lisible, et évite le
  paradoxe d'un pion unique tiré dans deux directions.)
- Delta moteur : un nouveau hook `mapDir?: (dir, layer) => dir` appliqué avant
  `resolve` pour la couche B. État inchangé, hash inchangé, solveur inchangé.
  Ce n'est **pas** un mover — pas de conflit avec `glace`.
- Signature : le nom du niveau et les repères côté magenta se lisent
  **inversés** (typo miroir) ; au premier geste, le tutoriel montre les deux
  flèches divergentes.
- Chapitre VII : **« Verso »**.

### `repere` — la goupille de calage (coût S)

Une cellule spéciale : quand une encre s'y **arrête**, le décalage des mondes
se recale d'un cran vers zéro. Le complément naturel de `decalage` — jusqu'ici
on ne peut décaler que volontairement ; la goupille rend le calage *spatial*,
donc combinable avec le labyrinthe.

- Delta moteur : un hook `afterMove?: (state, level) => state` (nouveau, mais
  minuscule). État inchangé.
- Signature : le clac sec d'une goupille qui tombe dans son trou ; les croix
  de calage sautent d'un cran vers l'alignement.

### `trame` — le moiré (coût M)

Des cellules tramées (demi-teinte) qui bloquent **un pas sur deux** : opaques
aux pas impairs, transparentes aux pas pairs. La divergence *temporelle* : le
même chemin est ouvert ou fermé selon la parité du trajet qui y mène.

- Delta moteur : l'état gagne un bit de parité (`t: 0 | 1`) — breaking change
  du `hashState`, migration triviale. Tout reste fini et hashable.
- Signature : les cellules tramées « respirent » au rythme des pas (la trame
  se resserre quand elles sont opaques) ; moiré visuel assumé.
- C'est la première mécanique qui rend le **nombre de coups** signifiant en
  chemin, pas seulement au score — le solveur va trouver des niveaux où il
  faut *perdre* un pas exprès. Or délibérément contre-intuitif : parfait pour
  les paliers durs du daily.

### `buvard` — la surimpression (coût M/L)

Quelques cellules absorbantes marquées sur le papier : une encre qui s'y
arrête y laisse sa couleur, définitivement. Une cellule qui a bu **les deux**
encres sature et devient un mur pour tout le monde.

- Et le prolongement qui change le jeu : une **nouvelle condition de
  victoire** — certains niveaux ne demandent plus d'atteindre un but mais
  d'**imprimer un motif** (les cellules cibles doivent porter la bonne encre).
  Le puzzle passe de « aller quelque part » à « fabriquer quelque chose », ce
  qui est exactement la fiction du jeu.
- Delta moteur : l'état gagne un vecteur de teintes sur les k cellules
  marquées (4^k états, k ≤ 5 par design) — borné, hashable. `isWin` devient
  un point d'extension des mécaniques (aujourd'hui il est global) : c'est le
  vrai coût.
- Chapitre de fin d'acte I : **« Surimpression »** — on sait enfin imprimer.

### `rotation` — le quart de tour (coût L, spectaculaire)

Le geste-monde alternatif tourne le film B de 90° autour du centre. L'état
gagne `rot ∈ {0..3}` ; les directions vers B sont tournées ; les croix de
calage pivotent à l'écran. À prototyper **après** `verso`, qui aura déjà posé
la remap de direction et prouvé que les joueurs la lisent.

### Ce qu'on refuse (et pourquoi)

- **Encre qui sèche** (cellules qui se murent après N coups globaux) : l'état
  devrait porter le compteur de coups → espace d'états non borné par le
  plateau, BFS du générateur à genoux. Contraire à l'esprit.
- **Téléporteurs, interrupteurs, boîtes à pousser** : du vocabulaire Sokoban
  générique qui n'existe pas dans la fiction de l'atelier. Le filtre fiction
  n'est pas décoratif : c'est lui qui garde le jeu *un*.

---

## Pilier 2 — Le grand saut : la Trichromie (l'Acte II)

Le concept-titre. La commande passe en trichromie : un **troisième film,
jaune**, arrive sur la table. CMJ — la sérigraphie réclamait ce jeu depuis le
début.

- **Règles.** Trois encres, une entrée. Les fusions se font **par paires** —
  C+M, C+J, M+J, chacune avec sa couleur secondaire à l'écran (blend screen
  natif) — et la fusion totale des trois donne le **blanc**. La scission d'une
  paire suit la règle actuelle (l'encre choisie part dans la direction,
  l'autre à l'opposé). La scission du blanc : l'encre choisie part dans la
  direction, la **paire complémentaire** part à l'opposé — un seul geste,
  toujours lisible.
- **État.** Les partitions de {C, M, J} positionnées : 5 formes d'état
  (3 libres · 3 × une-paire-plus-un · le blanc), chacune avec ses positions et
  les offsets par film. Toujours fini, discret, hashable.
- **Le point décisif : le solveur ne bouge pas.** Il ne connaît que
  `successors` / `isWin` / `hashState`. La refonte de `GameState` est un gros
  chantier moteur + UI, mais la certification, la génération et l'anti-triche
  survivent **tels quels**. C'est ça, l'intérêt d'avoir payé le contrat moteur
  dès le début.
- **Risque principal : la charge cognitive.** Mitigation : l'Acte II re-déroule
  la pédagogie de zéro — chapitres courts, une paire à la fois (d'abord C+J
  seuls sur la table, puis les trois), tutoriels guidés systématiques.
- **L'identité suit.** Le wordmark imprimé deux fois mal calé passe à trois
  passages ; les repères de calage se dédoublent en trois croix ; l'OG card,
  le GIF de replay, l'écran-titre — tout le système visuel s'étend sans
  changer de nature.

L'Acte II est le dernier chantier de la roadmap, volontairement : il bénéficie
de la banque de mécaniques éprouvée (verso, trame et buvard se transposent en
trichromie) et de l'audience construite par les piliers 3 et 4.

---

## Pilier 3 — Ouvrir l'atelier : l'éditeur et les plaques partagées

Un niveau, c'est ~200 octets de données pures. Ça tient dans une URL.

- **La plaque partagée.** Un niveau encodé en base64url → route
  `/plaque/$code`. Zéro coût serveur, partage instantané, jouable par
  n'importe qui sans compte. Le lien *est* le niveau.
- **L'éditeur est la table lumineuse.** On pose les murs au doigt, film par
  film (le toggle cyan/magenta existe déjà visuellement), on choisit les mods.
  Le solveur — BFS en pur TypeScript — tourne dans un **Web Worker** pendant
  l'édition : il certifie la solvabilité, calcule le par, et vérifie la
  **nécessité des mécaniques** (`isRequired` existe déjà côté solveur). On ne
  peut partager qu'une plaque certifiée : le contenu joueur hérite de la
  promesse « aucun niveau impossible ». Aucun autre puzzle web ne peut offrir
  ça à ce prix.
- **Le rituel de partage.** Certifier une plaque la « tamponne » : le bon à
  tirer ambre s'imprime, le lien se copie. Le par du solveur part dans l'URL —
  le défi implicite est « fais mieux que l'auteur ».
- **V2 (serveur, optionnelle).** Une table `plate` : galerie, votes, compteur
  de « tirages » (solves). Réutilise auth + leaderboard existants. À ne
  construire que si la V1 URL prend.

C'est le passage de « un jeu » à « une plateforme », pour un coût initial
étonnamment bas parce que le moteur est déjà de la donnée pure.

---

## Pilier 4 — Le jeu vivant : duels et éditions limitées

- **Le duel fantôme.** Je résous une plaque (du jour, générée, ou à moi), et
  j'envoie un lien de défi. L'adversaire joue le même plateau avec mon replay
  en **fantôme** sur le plateau — l'infra existe presque entière :
  `replayTrace` encode déjà les traces, et le rendu fantôme (`Board` ghost)
  est né avec les tutoriels. Classement à la règle unique : coups, puis
  corrections. Asynchrone, viral, zéro temps réel.
- **L'édition limitée.** Le week-end a déjà son épreuve d'artiste 6×6 ; on en
  fait une **série numérotée**. Chaque semaine, une plaque générée sous
  contrainte inhabituelle (mods rares, par élevé, taille 6) : « Édition
  nº 37 », son OG card collector, et les joueurs qui la résolvent sont listés
  comme **tireurs** de l'édition. La rareté est honnête : passé le dimanche,
  l'édition est consultable mais plus « tirable ».
- **Le mur de l'atelier.** Le profil devient l'atelier du joueur : les
  éditions tirées épinglées au mur, les plaques publiées, la grille de
  contribution (existante), les tampons. Le profil cesse d'être un tableau de
  stats pour devenir un *lieu* — cohérent avec « le fond sombre est un lieu,
  pas un thème ».

---

## La structure qui tient tout : les trois tampons

La règle de classement existe (`ranking.ts`), l'optimum du solveur existe, la
détection des corrections existe. Il ne manque que la **surface**. Par niveau,
trois tampons :

| Tampon | Condition | Existe déjà côté données |
| --- | --- | --- |
| **Tiré** | résolu | oui (best scores) |
| **Bon à tirer** | résolu au par du solveur | oui (optimal en base) |
| **Sans retouche** | résolu sans undo ni reset | oui (corrections comptées) |

Le sélecteur affiche les tampons par niveau ; un chapitre dont tous les
niveaux sont « tirés » **s'imprime** — son affiche se révèle sur le mur de
l'atelier. Coût S, et c'est la boucle de motivation qui manque aujourd'hui
entre « j'ai fini les 16 niveaux » et « j'ai maîtrisé le jeu ».

## Roadmap proposée

| Phase | Contenu | Taille | Ce qu'elle prouve |
| --- | --- | --- | --- |
| **1 — La relance** | Trois tampons + affiches de chapitre ; `verso` + `repere` + chapitre VII (niveaux générés certifiés) | S/M | le jeu a de la profondeur au-delà des 16 niveaux |
| **2 — L'atelier ouvert** | Éditeur + plaques URL + certification en worker | M/L | le contenu devient infini sans casser la promesse |
| **3 — Le jeu vivant** | Duel fantôme + éditions limitées numérotées + mur de l'atelier | M | le jeu a une raison d'y revenir chaque semaine |
| **4 — Trichromie** | L'Acte II : le film jaune, refonte `GameState`, campagne II | XL | le concept-titre, sur une base et une audience prêtes |

`trame` et `buvard` s'insèrent entre les phases selon l'appétit — `buvard`
(motif à imprimer) est le candidat naturel pour teaser l'Acte II.

Chaque phase livre de la valeur seule et aucune ne bloque la suivante. La
seule dépendance dure : la trichromie en dernier, après que la remap de
direction (`verso`) et les nouvelles conditions de victoire (`buvard`) ont été
éprouvées en bichromie.

## Anti-buts

- Pas de temps réel, pas d'aléa en jeu, pas d'information cachée — le contrat
  moteur *est* l'identité du jeu.
- Pas de classement au chrono, jamais.
- Pas de mécanique hors fiction : si ça n'existe pas dans un atelier de
  sérigraphie la veille du tirage, ça n'existe pas dans le jeu.
- Pas de contenu non certifié : tout ce qui est jouable — campagne, daily,
  plaque partagée, édition limitée — est passé par le solveur.
