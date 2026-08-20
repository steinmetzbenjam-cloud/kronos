# Import de « Chronologie Biblique.xlsx »

Fichier source : `~/Desktop/Chronologie Biblique.xlsx` (feuille unique,
une ligne par année de 4026 av. n. è. à 2050).

**289 entrées importées** — 82 périodes et 207 dates ponctuelles —
réparties dans les colonnes O et P (chronologie biblique),
W (domination mondiale) et AA (dominations secondaires).

## Catégories attribuées

| Catégorie | Entrées | Ce qui s'y trouve |
|---|---:|---|
| **Bible** | 149 | Personnages, règnes des rois d'Israël et de Juda, rédaction des livres bibliques, événements de la Bible |
| **Empires & dynasties** | 77 | Dynasties égyptiennes et perses, souverains babyloniens, macédoniens, Ptolémées |
| **Guerres** | 25 | Sièges, conquêtes, révoltes, attentats |
| **Politique** | 22 | Histoire de Jérusalem du XIX siècle à nos jours |
| **Religions** | 12 | Califats, papes, constructions religieuses non bibliques |
| **Sciences** | 4 | Réformes des calendriers julien, grégorien, hébraïque |

Deux catégories ont été créées : **Bible** et **Empires & dynasties**.
Tu peux les renommer ou les recolorer dans Menu ☰ → Gérer les catégories.

## Comment les périodes ont été reconnues

- `ADAM Naissance (4026-3096 av. n. è.) (930 ans)` → une barre couvrant
  la vie entière. La ligne `ADAM Mort` correspondante n'a pas été
  dupliquée en événement séparé (19 cas).
- `ROBOAM Règne (17 ans) (997-980 av. n. è.)` → une barre de règne.
- `IIIe Dynastie (2700-2625)` → une barre de dynastie.
- Les mentions `v.`, `vers`, `env.` et `?` ont coché automatiquement
  **≈ environ** sur la borne concernée (29 entrées).
- Quand le texte d'une cellule contenait des années explicites, ce sont
  elles qui font foi, pas la ligne où la cellule est posée — plusieurs
  cellules du fichier sont décalées d'une à deux lignes.

## Mis de côté

### Calendrier du Déluge (32 cellules, colonnes AP/AQ/AS)
La succession des mois hébreux (NISAN, IYAR, SIVÂN…) et des jours
(`J17`, `J1`, `J27`) du récit du Déluge est étalée sur des lignes
successives du tableau. Ces lignes correspondent à des **mois**, pas à
des années : les reprendre telles quelles aurait placé « L'arche se posa
sur les montagnes d'Ararat » en 2364 av. n. è. au lieu de 2369.

### Table des mois de l'an 33 (9 cellules)
`01 Janvier 33 : 12 Tevet`, `01 Février : 14 Shvat`… : une table de
correspondance entre calendriers grégorien et hébreu pour l'année 33.
Ce sont des jours, pas des événements datables sur une frise de 6000 ans.

### Doublons de décès (19 cellules)
`ADAM Mort`, `NOÉ Mort`, `ABRAHAM Mort`… : déjà représentés par la fin de
la barre de durée de vie.

## Un point à vérifier dans ton fichier

Nadab — règne : le fichier indique 2 ans mais l'intervalle -976→-935 en fait 41

Les deux valeurs se contredisent dans le fichier source. La période a été
importée telle qu'écrite (l'intervalle), sans correction de ma part.
Si c'est une coquille, corrige-la directement dans Kronos.

## Refaire l'import

Le convertisseur n'est pas conservé dans le projet : les données sont
désormais dans `src/seed.js`. Pour repartir du fichier Excel, il faudrait
le relancer — dis-le-moi si le tableau évolue.
