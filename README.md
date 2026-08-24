# Kronos

Frise chronologique verticale et zoomable de l'histoire de l'humanité,
de **4000 av. J.-C. à aujourd'hui**. Tu y ajoutes tes propres dates,
périodes et informations.

Fonctionne sur **Mac, iPad et iPhone** avec le même code.

---

## Ouvrir l'application

**Sur le Mac, tout de suite :**

```bash
open /Users/steinmetz/Documents/PROGRAMMATION/KRONOS/index.html
```

**Avec un serveur local** (nécessaire pour le mode hors ligne et l'accès depuis l'iPad) :

```bash
cd /Users/steinmetz/Documents/PROGRAMMATION/KRONOS && python3 -m http.server 8765
```

Puis dans le navigateur : <http://localhost:8765>

Depuis l'iPad ou l'iPhone sur le même Wi-Fi : <http://192.168.1.39:8765>
(le Mac doit rester allumé et le serveur en cours d'exécution)

**Pour l'avoir en permanence sur l'iPad et l'iPhone**, sans dépendre du Mac :
héberger le dossier sur GitHub Pages ou Netlify (gratuit). L'adresse en
`https://` obtenue permet alors « Ajouter à l'écran d'accueil » depuis Safari :
Kronos s'ouvre en plein écran, sans barre de navigateur, et fonctionne hors ligne.

---

## Se servir de la frise

| Geste | Effet |
|---|---|
| Glisser de haut en bas | Défiler dans le temps (avec inertie) |
| Pincer à deux doigts | Zoomer / dézoomer |
| ⌘ + molette (Mac) | Zoomer / dézoomer |
| Molette seule | Défiler |
| Clic / tap sur un événement | Ouvrir sa fiche |
| Double-clic sur la frise | Créer un événement à cette date précise |
| Bouton ⤢ | Revenir à la vue d'ensemble |
| Flèches, Page ↑↓ | Défiler |
| `+` / `-` | Zoomer |
| `Début` | Vue d'ensemble |
| `n` | Nouvel événement |
| `Échap` | Fermer |

Les **périodes** (avec une année de fin) s'affichent en barres verticales
à gauche ; les **dates ponctuelles** sont des points sur l'axe, avec leur
libellé à droite.

**Aucun libellé n'en recouvre un autre.** Quand plusieurs événements se
bousculent, Kronos ouvre autant de colonnes que la largeur le permet et place
chaque libellé dans celle qui le rapproche le plus de sa date, un trait de
rappel le reliant à son point. Le nombre de colonnes est calculé par essais
successifs : le minimum qui permet de tout afficher.

À une échelle de travail — quelques siècles — tout tient. En vue d'ensemble
sur 6 400 ans, la place manque physiquement : il faudrait 6 000 px de hauteur
pour 450 disponibles. Les libellés surnuméraires sont alors omis, mais **le
point de chaque événement reste sur l'axe** et son libellé réapparaît dès
qu'on zoome.

Les années **avant J.-C. se saisissent en négatif** : `-753` pour 753 av. J.-C.

Sous chaque année, deux champs facultatifs — **mois** et **jour** — permettent
de dater précisément. La frise change alors d'échelle toute seule quand on
zoome : des siècles aux mois, puis aux jours.

---

## La frise se retrouve où tu l'as laissée

Kronos mémorise **le zoom, la position et les catégories masquées**. Tu fermes
l'application au milieu de la semaine du 14 nisan, à l'échelle du jour : elle
rouvre exactement là, avec les mêmes filtres.

C'est propre à chaque appareil — ton iPad garde sa vue, ton Mac la sienne — et
séparé de tes données : rien de tout cela ne part dans le fichier d'export.

Deux façons de revenir en arrière : le bouton **⤢** de la barre du haut ramène
la vue d'ensemble, et **Menu ☰ → Tout réafficher** rétablit en plus toutes les
catégories masquées.

---

## Plusieurs événements le même jour

Quand plusieurs événements partagent exactement la même date, deux flèches
**↑ ↓** apparaissent sous la date de leur fiche, à droite, pour les déplacer
les uns par rapport aux autres. L'ordre choisi est enregistré et gouverne
l'affichage sur la frise.

C'est fait pour les journées denses : le 14 nisan 33 compte à lui seul
treize événements, du repas pascal à la mise au tombeau, et leur
enchaînement est ce qu'on veut lire.

Les flèches n'apparaissent pas quand l'événement est seul à sa date, et se
grisent au premier et au dernier rang.

**La pastille de catégorie de la fiche est cliquable** : un appui masque cette
catégorie sur toute la frise, un autre la rétablit. La pastille s'éteint pour
montrer l'état, et le choix est mémorisé d'une session à l'autre.

---

## Dates incertaines

Sous chaque année du formulaire, une case **« ≈ environ »** — une pour le
début, une pour la fin, cochables indépendamment. Beaucoup de dates
anciennes ne sont connues qu'approximativement, et la frise le montre :

- **date ponctuelle incertaine** : le point sur l'axe devient **creux**,
  son trait de rappel passe **en pointillés**, et l'année est précédée de **≈** ;
- **période dont une borne est incertaine** : la barre **s'estompe
  progressivement** de ce côté au lieu de s'arrêter net — la fin floue
  traduit mieux l'incertitude qu'un trait, et laisse la barre lisible
  même très dézoomé, là où des pointillés se refermeraient en trait plein.

Quarante-neuf des événements fournis sont déjà marqués ainsi (naissance du
Bouddha, fondation de Rome, Néolithique, règnes datés « vers »…).

---

## Catégories

Chaque événement porte une catégorie, qui détermine sa couleur sur la frise.
Neuf catégories sont fournies au départ, mais elles t'appartiennent :

- **Menu ☰ → Gérer les catégories…** (ou le bouton **Gérer…** dans le
  formulaire d'un événement) ouvre l'éditeur ;
- clique la pastille de couleur pour la **changer**, le nom pour le
  **renommer** — c'est enregistré aussitôt et la frise se met à jour ;
- **+ Nouvelle catégorie** en ajoute autant que tu veux ;
- **✕** supprime : les événements concernés basculent automatiquement dans
  une autre catégorie, aucun n'est perdu. Le nombre affiché à droite de
  chaque ligne indique combien d'événements l'utilisent.

Dans le menu, toucher une pastille de catégorie la **masque sur la frise**
sans rien supprimer — pratique pour n'afficher que les guerres, ou tout
sauf elles.

---

## Références bibliques cliquables

Dans la fiche d'un événement, toute référence biblique (`Mt 27:31-56`,
`2 Chroniques 34:8`, `1Co 11:23-25`…) devient un lien doré.

- Sur **iPad et iPhone**, le lien tente d'ouvrir **JW Library** à ce verset ;
  si l'application n'est pas installée, il bascule sur jw.org au bout d'une seconde.
- Sur **Mac et PC**, il ouvre directement la **Bible d'étude sur jw.org**
  (Traduction du monde nouveau, édition d'étude, en français).

Les 66 livres sont reconnus, en abrégé comme en toutes lettres, y compris
les intervalles à cheval sur deux chapitres (`Mt 5:1–7:29`).

---

## Cartes des lieux bibliques

Quand la fiche d'un événement précise un lieu (`Lieu : Capharnaüm`,
`(lieu : Jérusalem)`), ce lieu devient un lien cyan qui ouvre la carte
correspondante de la brochure **« Voyez le bon pays »** — dans JW Library
sur iPad et iPhone, sur jw.org ailleurs.

**La carte choisie dépend de la date de l'événement.** Jérusalem figure sur
18 cartes de la brochure : un événement de 1026 av. n. è. ouvre « Israël aux
jours de David et de Salomon », un de 607 av. n. è. « Des empires attaquent
la Terre promise », un de l'an 33 « Jésus "dans le pays des Juifs" ». Le
survol du lien indique la carte retenue, sa page et la case de repérage.

Le répertoire compte **586 lieux**, repris de l'« Index pour les cartes »
de la brochure.

---

## Images et liens dans une fiche

**Images.** La fiche d'un événement a une section *Images*. Deux façons d'en
ajouter :

- **Ajouter une image…** ouvre le sélecteur de fichiers (plusieurs à la fois) ;
- **Coller (⌘V)** pendant que la fiche est ouverte : une capture d'écran ou une
  image copiée depuis une page web s'attache directement.

Les vignettes s'affichent dans la fiche ; un clic ouvre l'image en plein écran,
avec le même zoom que les cartes. La croix supprime, et supprimer un événement
supprime les siennes.

**Toute image ajoutée est convertie en JPEG** et réduite à 1 800 px de côté au
maximum. C'est ce qui pèse le moins : une capture d'écran collée arrive en PNG,
souvent cinq à dix fois plus lourde à qualité équivalente. Les zones
transparentes sont posées sur fond blanc — sans quoi le JPEG les rendrait
noires. Les **cartes**, elles, restent en PNG quand c'est raisonnable : les
traits fins et les noms de lieux y perdraient trop à être compressés.

**Descriptions longues.** La description est bornée dans la fiche : au-delà,
elle défile sur place, un dégradé signale qu'il reste du texte, et un bouton
**Tout lire** l'ouvre en plein écran — texte agrandi, largeur de lecture
confortable, liens et références toujours actifs. Le bouton n'apparaît que si
le texte déborde réellement.

**Taille des notes.** La description accepte **50 000 caractères** par
événement — une vingtaine de pages —, le titre 200. Le champ s'ouvre plus haut
et s'étire à la souris. Un compteur n'apparaît qu'au-delà de 40 000 caractères.

Le menu ☰ indique le poids de tes textes et la part occupée de l'espace du
navigateur (environ 5 Mo pour les textes et les dates ; les images et les
cartes, elles, sont ailleurs et ne comptent pas là-dedans). Si un
enregistrement venait à échouer faute de place, Kronos te le dit au lieu de
perdre ta saisie en silence.

**Liens.** Toute adresse écrite dans la description devient cliquable. Deux
écritures possibles :

```
https://www.jw.org/finder?...            → affichée raccourcie, cliquable
[le tableau A7](https://wol.jw.org/...)  → affiche « le tableau A7 »
```

Les liens s'ouvrent dans un nouvel onglet et cohabitent avec les références
bibliques (en doré) et les lieux (en cyan), qui restent reconnus.

---

## Mes cartes

**Menu ☰ → Mes cartes…** charge tes propres images de cartes : tu donnes un
nom, tu choisis un fichier, c'est tout. **Un clic sur la vignette d'une carte
déjà enregistrée l'ouvre en plein écran**, avec le zoom. De là, les flèches
**‹ ›** — ou les touches ← → — font défiler toutes les cartes enregistrées,
un compteur indiquant où l'on en est ; en refermant, tu retrouves le
gestionnaire. L'image est réduite à 2 200 px de côté
au maximum pour rester légère, sans écraser les traits fins d'une carte.

Ensuite, dans la fiche d'un événement, la section **Carte** permet de
rattacher une de ces cartes et d'y **poser un point rouge**. « Ajouter une
carte » ouvre une **grille de vignettes** — on choisit à l'œil, pas dans une
liste de noms — puis on touche l'image à l'endroit voulu et on enregistre.
Depuis l'éditeur, le nom de la carte en haut à gauche rouvre cette grille pour
en changer ; la carte en cours y est encadrée en doré.

Sur chaque vignette de la grille, la **loupe ⤢** ouvre la carte en plein écran
et permet de faire défiler toutes les cartes avec les flèches **‹ ›** ou les
touches ← →. Un bouton **Choisir cette carte** retient celle qu'on regarde et
enchaîne sur le placement du point. Le point est mémorisé avec
l'événement, en coordonnées relatives — il reste juste quel que soit
l'écran, du téléphone au grand moniteur.

**Chaque événement ne montre que son propre point.** Dix événements peuvent
partager la même carte : en ouvrant l'un d'eux, tu ne vois que le sien.

**Clique sur la carte de la fiche pour l'afficher en plein écran** — avec son
point, en lecture seule. On y zoome à la molette, au pincement ou au
double-clic, on se déplace en glissant, et le bouton **Ajuster** ramène la
carte entière à l'écran. Le point ne peut s'y déplacer : ça reste réservé au
bouton **Déplacer le point** de la fiche.

Le sélecteur en haut de l'éditeur permet de changer de carte, et le bouton
**Retirer** détache la carte de l'événement sans supprimer l'image.

Supprimer une carte depuis le gestionnaire prévient combien d'événements
l'utilisent et détache leur point.

> **Où sont stockées les images ?** Dans la base IndexedDB du navigateur, pas
> dans le stockage classique qui plafonne à quelques mégaoctets.

---

## Tes données

Elles sont enregistrées **dans le navigateur de chaque appareil**,
séparément. Le menu ☰ permet de les exporter dans un fichier `.json`
(à déposer dans ton Dropbox par exemple) et de les réimporter sur un
autre appareil, en remplacement ou en complément de ce qui s'y trouve.

**L'export contient tout** : les événements, les catégories, **tes cartes
avec leurs images**, les points placés dessus **et les images attachées aux
événements**. Un import restaure donc la
frise complète sur un autre appareil, cartes comprises — rien à recharger à
la main. Le message de confirmation indique le poids du fichier et le nombre
de cartes incluses.

Seul le bouton **Copier (sans cartes)** fait exception : le presse-papiers
reçoit les événements et les catégories, mais pas les images — plusieurs
mégaoctets de données encodées n'y sont pas manipulables.

Le bouton **Réinitialiser** restaure la frise d'origine (532 événements
de départ) et efface tes ajouts.

---

## Organisation des fichiers

```
KRONOS/
├── index.html              structure de la page
├── manifest.webmanifest    installation sur l'écran d'accueil
├── sw.js                   fonctionnement hors ligne
├── icons/                  icônes de l'application
└── src/
    ├── style.css           apparence (Mac, iPad, iPhone)
    ├── seed.js             les 532 événements de départ — à enrichir librement
    ├── refs.js             références bibliques → liens JW Library / jw.org
    ├── places.js           lieux → cartes de « Voyez le bon pays »
    ├── maps.js             tes cartes personnelles (images en IndexedDB)
    ├── photos.js           images attachées aux événements
    ├── store.js            enregistrement, import, export
    ├── timeline.js         moteur de la frise : dessin, zoom, défilement
    └── ui.js               boutons, panneau, formulaire, recherche
```

Pour ajouter des événements par lot sans passer par le formulaire,
éditer `src/seed.js` puis utiliser **Réinitialiser** dans le menu.

---

## Support d'étude biblique

Trois couches se superposent à la frise pour situer un passage.

**Les époques.** Le découpage de *Perspicacité* (article « Chronologie ») en
huit périodes contiguës — de la création d'Adam au déluge, jusqu'à la période
apostolique — s'affiche en **bandes de fond**, avec le nom qui court
verticalement dans la marge de gauche. Elles ne prennent aucune voie et se
masquent d'un geste comme n'importe quelle catégorie.

**Les livres bibliques.** 27 livres apparaissent en barres violettes couvrant
**la période qu'ils racontent**, et non celle où ils ont été écrits : la Genèse
court de 4026 à 1657 av. n. è., Josué de 1473 à 1450, les Actes de 33 à 61.
En ouvrant la frise vers 1000 av. n. è., on voit immédiatement qu'on est dans
1 et 2 Samuel. La fiche donne le rédacteur, le lieu et l'année d'achèvement.

**La recherche par passage.** Taper une référence dans la barre de recherche
— `2 Rois 25`, `Daniel 9`, `Mt 24:14` — ne garde que les événements qui citent
ce passage, et la frise estompe le reste. Les 66 livres sont reconnus, en
abrégé comme en toutes lettres, et les trois écritures `2R 25`, `2 R 25`,
`2 Rois 25` donnent le même résultat.

---

## Chronologie biblique

368 événements de départ, dont 289 importés de ton fichier
`Chronologie Biblique.xlsx` : durées de vie des patriarches, règnes des
rois d'Israël et de Juda, dynasties égyptiennes et perses, rédaction des
livres bibliques, histoire de Jérusalem jusqu'à 2018.

Le détail de l'import — ce qui a été reconnu, ce qui a été mis de côté et
pourquoi — est dans [IMPORT-CHRONOLOGIE-BIBLIQUE.md](IMPORT-CHRONOLOGIE-BIBLIQUE.md).

S'y ajoutent **129 entrées sur la vie de Jésus** (catégorie *Jésus*), tirées du
tableau A7 de la *Traduction du monde nouveau* : de l'annonce à Zacharie en
3 av. n. è. à l'ascension le 25 iyar 33, avec le lieu et les renvois aux quatre
Évangiles. Voir [IMPORT-VIE-DE-JESUS.md](IMPORT-VIE-DE-JESUS.md).

---

## Choix technique

HTML / CSS / JavaScript, sans aucune dépendance ni outil à installer.
La frise est dessinée dans un `<canvas>` : seuls les éléments visibles
sont tracés, ce qui reste fluide même avec des milliers d'entrées et sur
un appareil ancien.

Si un jour tu veux une véritable application native Apple, ce même code
peut être emballé tel quel avec Tauri ou Capacitor, sans réécriture.
