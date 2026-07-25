# moeïa — Direction artistique

**Version 1.0 — 17/07/2026 · Direction validée : fusion A×B, variante « Cyan unique »**
Document de référence pour le développement. Toute valeur de style utilisée dans le code doit provenir des tokens de la section 2. Aucune couleur, taille ou espacement en dur.

---

## 0. Fondation : le logo

Le logo reconstruit (fichiers livrés) définit deux constantes de marque :

- **L'encre** : le noir bleuté du fichier source (`#000105`) est abandonné au profit d'une encre chaude `#221F1A`, cohérente avec les neutres pierre. Les SVG utilisent `currentColor` : le logo prend l'encre sur fond clair, le blanc sur fond sombre, sans dupliquer les fichiers.
- **Le cyan** : `#04B7F9`, présent dans le logo d'origine (barre du picto, point du i, « L'IA »). C'est **la** couleur d'accent moeïa. Décision actée : accent unique.

Fichiers : `moeia-logo-full.svg` (lockup + baseline), `moeia-logo.svg` (picto + wordmark — usage par défaut en interface), `moeia-picto.svg` (icône seule : favicon, avatar, espaces < 120 px de large).

Règles d'usage : zone de protection = hauteur du picto sur les 4 côtés ; taille minimale wordmark 88 px de large, picto seul en dessous ; jamais sur fond coloré autre que les neutres du système ; jamais d'étirement, d'ombre ou de recoloration hors encre/blanc. La baseline « MAÎTRISE D'ŒUVRE AUGMENTÉE PAR L'IA » du SVG source est dégradée (vectorisation) : ne pas l'utiliser en interface ; à recomposer en texte réel pour les supports print/marketing une fois la fonte du wordmark identifiée.

---

## 1. Positionnement esthétique

### Les trois axes explorés

**A — Précision éditoriale.** L'interface comme document d'ingénierie : encre sur papier, filets fins, chiffres en mono, un seul signal cyan. Différenciation maximale (le quasi-monochrome est un territoire libre du SaaS), tenue parfaite en densité, mais température froide.

**B — Atelier minéral.** Neutres pierre chauds (héritage direct des gris `stone` déjà dominants dans AO et ACT), accent terracotta métier + cyan IA, titres Space Grotesk. Chaleureux et incarné, mais deux accents à gouverner dans la durée, et un terracotta structurellement proche des couleurs d'alerte.

**C — Blueprint contrôle.** Sombre luminescent, héritier des headers sombres d'AO et des dégradés d'ACT. Fort en démo commerciale, mais inadapté en usage principal : fatigue sur des journées de DPGF, rupture écran sombre / exports imprimés clairs. Conservé comme **thème sombre optionnel futur** — la structure de tokens le permet sans refonte.

### Direction retenue : « Cyan unique » (structure de A, température de B)

L'interface d'un cabinet d'ingénierie, pas d'une startup : encre chaude sur papier pierre, hiérarchie portée par la typographie et non par la couleur, chiffres en mono à alignement tabulaire, et un unique signal — le cyan du logo — dont la rareté fait la valeur. Sur un écran type, le cyan apparaît environ 5 fois : badge IA, bouton IA, liseré de la stat clé, onglet actif, surlignage de la ligne remarquable. Tout le reste est encre, pierre et statuts sourds.

Ce que ce positionnement dit aux acheteurs BET/architectes : l'outil ressemble aux pièces qu'il produit (CCTP, DPGF, rapports d'analyse) — rigueur, lisibilité, zéro décorum. Ce qui le différencie des SaaS génériques : pas de bleu-gris interchangeable, pas de dégradés, pas d'arc-en-ciel de statuts ; une signature quasi monochrome ponctuée d'un cyan strictement gouverné.

---

## 2. Design tokens

### 2.1 Variables CSS — à copier telles quelles

```css
:root {
  /* ===== Neutres — encre & pierre ===== */
  --moeia-ink-900: #221F1A;   /* texte principal, boutons primaires, en-têtes de table (border-bottom) */
  --moeia-ink-700: #57534E;   /* texte secondaire (7,6:1 sur blanc) */
  --moeia-ink-600: #6E6961;   /* texte tertiaire, le plus clair autorisé pour du texte courant (5,4:1) */
  --moeia-ink-500: #8F8A82;   /* labels uppercase ≥10,5px semibold, placeholders, icônes inactives — jamais texte courant (3,4:1) */
  --moeia-bg:      #F6F5F2;   /* fond de page */
  --moeia-card:    #FBFAF8;   /* fonds de carte secondaires, en-têtes de panneau, zebra éventuel */
  --moeia-paper:   #FFFFFF;   /* surfaces de contenu : panneaux, tables, modales, inputs */
  --moeia-line:    #E5E2DC;   /* bordures par défaut (1px partout) */
  --moeia-line-2:  #EEECE7;   /* séparateurs de rangées, fonds de hover neutres */

  /* ===== Accent — cyan moeïa (unique) ===== */
  --moeia-cyan:        #04B7F9; /* SIGNAL : liserés, barres de progression, onglet actif (bordure), focus ring, picto logo. JAMAIS pour du texte ni un fond sous texte blanc (2,3:1) */
  --moeia-cyan-action: #0273C4; /* FONCTIONNEL : boutons IA, liens, texte d'accent (4,9:1 sur blanc, AA) */
  --moeia-cyan-hover:  #01599A; /* hover/active du fonctionnel (7,2:1) */
  --moeia-cyan-soft:   #E9F6FD; /* fonds : ligne surlignée, panneau IA, badge IA */
  --moeia-cyan-border: #C4E9FA; /* bordure des surfaces cyan-soft */

  /* ===== Statuts — sourds, réservés à l'état des objets métier ===== */
  --moeia-ok:        #3E7A4E;  --moeia-ok-soft:   #EAF2EC;   /* recevable, validé, visa accordé */
  --moeia-warn:      #855900;  --moeia-warn-soft: #F8F0DC;   /* réserve, à renouveler, en attente */
  --moeia-err:       #B3352B;  --moeia-err-soft:  #F9EAE8;   /* non recevable, périmé, refusé, erreur */
  /* Info = registre cyan-soft. Pas de 4e famille. */

  /* ===== Typographie ===== */
  --moeia-font-ui:      'Inter', system-ui, sans-serif;
  --moeia-font-display: 'Space Grotesk', var(--moeia-font-ui);   /* titres de page, valeurs de stats */
  --moeia-font-mono:    'JetBrains Mono', ui-monospace, monospace; /* chiffres, montants, réfs, codes */

  --moeia-text-xs:   11px;    /* labels uppercase, notes de bas de tableau */
  --moeia-text-sm:   12.5px;  /* CORPS PAR DÉFAUT des écrans denses (tables, formulaires) */
  --moeia-text-base: 14px;    /* corps confortable (modales, pages de config, vides) */
  --moeia-text-md:   16px;    /* sous-titres */
  --moeia-text-lg:   19px;    /* titre de page (h3 produit) */
  --moeia-text-xl:   24px;    /* valeurs de stats, titres de section */
  --moeia-text-2xl:  30px;    /* réservé marketing/onboarding */

  --moeia-leading-tight: 1.3;  /* titres, cellules */
  --moeia-leading:       1.55; /* texte courant */

  /* Graisses : 400 courant · 500 nav/onglets · 600 emphase, boutons, th · 700 titres et valeurs clés UNIQUEMENT */

  /* ===== Espacements (base 4px) ===== */
  --moeia-sp-0_5: 2px;  --moeia-sp-1: 4px;   --moeia-sp-1_5: 6px;  --moeia-sp-2: 8px;
  --moeia-sp-3: 12px;   --moeia-sp-4: 16px;  --moeia-sp-5: 20px;   --moeia-sp-6: 24px;
  --moeia-sp-8: 32px;   --moeia-sp-12: 48px;

  /* ===== Rayons ===== */
  --moeia-r-sm:   4px;   /* badges, chips, inputs compacts */
  --moeia-r-md:   6px;   /* boutons, inputs, cellules interactives */
  --moeia-r-lg:   8px;   /* panneaux, cartes, tables */
  --moeia-r-xl:   10px;  /* modales, frame applicative */
  --moeia-r-full: 999px; /* pastilles, barres de progression */

  /* ===== Ombres — rares : le système est plat à bordures ===== */
  --moeia-shadow-sm:    0 1px 2px rgba(34,31,26,.06);                    /* éléments sticky décollés */
  --moeia-shadow-modal: 0 12px 36px rgba(34,31,26,.14);
  --moeia-shadow-pop:   0 4px 16px rgba(34,31,26,.10);                   /* dropdowns, popovers */

  /* ===== Focus ===== */
  --moeia-focus: 0 0 0 2px var(--moeia-paper), 0 0 0 4px var(--moeia-cyan);

  /* ===== Couleurs de série — GRAPHIQUES UNIQUEMENT (jamais UI) ===== */
  --moeia-serie-1: #0273C4;  --moeia-serie-2: #3E7A4E;  --moeia-serie-3: #855900;
  --moeia-serie-4: #6B5CA5;  --moeia-serie-5: #A34E68;  --moeia-serie-6: #57534E;
}
```

### 2.2 Preset Tailwind équivalent

Les trois outils remappent déjà leur palette dans `tailwind.config` — c'est le levier de migration. Preset unique à partager :

```js
// moeia.tailwind.preset.js — source de vérité unique, chargée par les 3 outils
module.exports = {
  theme: {
    extend: {
      colors: {
        ink:  { 900:'#221F1A', 700:'#57534E', 600:'#6E6961', 500:'#8F8A82' },
        base: { bg:'#F6F5F2', card:'#FBFAF8', paper:'#FFFFFF', line:'#E5E2DC', line2:'#EEECE7' },
        cyan: { DEFAULT:'#04B7F9', action:'#0273C4', hover:'#01599A', soft:'#E9F6FD', border:'#C4E9FA' },
        ok:   { DEFAULT:'#3E7A4E', soft:'#EAF2EC' },
        warn: { DEFAULT:'#855900', soft:'#F8F0DC' },
        err:  { DEFAULT:'#B3352B', soft:'#F9EAE8' },
      },
      fontFamily: {
        sans:    ['Inter','system-ui','sans-serif'],
        display: ['Space Grotesk','Inter','sans-serif'],
        mono:    ['JetBrains Mono','ui-monospace','monospace'],
      },
      borderRadius: { sm:'4px', DEFAULT:'6px', lg:'8px', xl:'10px' },
    },
  },
};
```

Fontes à charger : `Inter:wght@400;500;600;700`, `Space+Grotesk:wght@600;700`, `JetBrains+Mono:wght@400;500;600` (Google Fonts, avec `font-display:swap` ; fallback system-ui acceptable hors-ligne).

### 2.3 États interactifs — règle générale

| État | Traitement |
|---|---|
| hover | fond : un cran plus sombre (`line-2` sur neutre, `cyan-hover` sur action) ; jamais de changement de taille |
| active/pressed | idem hover + `transform: translateY(0.5px)` toléré, sans ombre |
| focus visible | `--moeia-focus` (double anneau blanc + cyan) — systématique au clavier, jamais supprimé |
| disabled | opacité .45, curseur default ; jamais de gris dédié |
| selected | fond `cyan-soft` + texte `ink-900` (jamais texte cyan sur fond cyan-soft dense) |
| loading | contenu remplacé par le libellé d'attente, largeur du bouton figée |

---

## 3. Composants

### 3.1 Boutons

Hauteurs : 32px (défaut dense), 36px (confortable), 28px (inline table). Padding horizontal 14px. Radius `--moeia-r-md`. Fonte UI 12,5px semibold (600). Icône 14px, gap 7px.

| Variante | Style | Usage |
|---|---|---|
| `primary` | fond `ink-900`, texte blanc ; hover `#000` | l'action principale de l'écran — une seule par vue |
| `ia` | fond `cyan-action`, texte blanc, préfixe glyphe ✦ ; hover `cyan-hover` | toute action qui déclenche un traitement IA — c'est le SEUL bouton coloré |
| `ghost` | fond `paper`, bordure `line`, texte `ink-900` ; hover fond `line-2` | actions secondaires (Exporter, Annuler) |
| `danger` | fond `paper`, bordure `err`, texte `err` ; hover fond `err-soft` | destructif — plein `err` uniquement dans la modale de confirmation |
| `link` | texte `cyan-action` souligné au hover | tertiaire, inline |

Interdits : dégradés (supprime ceux d'ACT), plus d'un `primary` par vue, bouton `ia` pour une action non-IA.

### 3.2 Tableaux de données (DPGF, comparatifs, référentiels)

Le composant central du produit. Conteneur : panneau `paper`, bordure `line`, radius `--moeia-r-lg`, en-tête de panneau optionnel (fond `card`, label 11,5px uppercase `ink-500`).

- En-tête `th` : 10,5px uppercase semibold `ink-500`, letter-spacing .08em, fond `paper` (ou `card` sous en-tête de panneau), **border-bottom 1px `ink-900`** — le trait d'encre est la signature éditoriale. Sticky (`position:sticky; top:0`) dès que la table scrolle.
- Rangées : hauteur 33px (dense, défaut) / 40px (confortable). Séparateur `line-2`. Hover fond `card`. Pas de zebra par défaut (le zebra se réserve aux tables > 20 rangées sans regroupement).
- Cellules numériques : `font-mono` 11,5px, `font-variant-numeric: tabular-nums`, alignées à droite. Texte : 12,5px aligné à gauche. Première colonne semibold si elle identifie l'objet.
- Ligne remarquable (moins-disante, sélection) : fond `cyan-soft` sur toute la rangée, valeur clé en 600. Une seule par table.
- Colonnes entreprises des comparatifs : **fin du codage par 17 teintes**. Identification par monogramme neutre (chip 2 lettres, fond `line-2`, texte `ink-700`) + nom. La couleur ne code plus l'identité, elle code l'état (badges) et le remarquable (cyan).
- Cellules éditables (référentiel AO) : bordure `line` au repos, focus `--moeia-focus` ; ne pas encadrer toutes les cellules en permanence.
- Groupes/lots : rangée de section fond `card`, label uppercase 11px `ink-500`.

### 3.3 Cartes & stat cards

Carte : fond `paper` (ou `card` si posée sur `paper`), bordure `line`, radius `--moeia-r-lg`, padding 12–16px, pas d'ombre.
Stat card : label 10,5px uppercase `ink-500` ; valeur `font-display` 22px 700 tabular ; détail 11px `ink-500`. La stat mise en avant porte un **liseré supérieur 2px `cyan`** (remplace les liserés gauche multicolores actuels). Une seule par rangée de stats.

### 3.4 Onglets

Barre : border-bottom 1px `line`. Onglet : 12,5px 500 `ink-700`, padding 9px 14px. Actif : texte `ink-900` 600, **border-bottom 2px `cyan`**. Hover inactif : texte `ink-900`. Navigation d'outils (AO/CCTP/Budget/ACT/Visas) dans l'appbar : même logique en pilule discrète (actif fond `line-2` texte `ink-900` — pas de cyan : le cyan de l'appbar appartient au badge IA).

### 3.5 Modales

Overlay `rgba(34,31,26,.45)`. Panneau `paper`, radius `--moeia-r-xl`, `--moeia-shadow-modal`, largeurs 480 (confirmation) / 640 (formulaire) / 960px (visionneuse). Header : titre 16px 600 + fermeture ghost. Footer aligné droite : ghost puis primary (ou danger plein pour destructif, avec rappel de l'objet concerné dans le corps). Fermeture par Échap et clic overlay, sauf traitement IA en cours (alors : bouton « Interrompre »).

### 3.6 Badges de statut

12px de haut utile : 10,5px 600, padding 2,5px 8px, radius `--moeia-r-sm` (pilule réservée aux compteurs). Toujours fond soft + texte foncé de la même famille — jamais fond saturé + texte blanc.

| Ton | Style | Exemples métier |
|---|---|---|
| ok | `ok-soft` / `ok` | Recevable · Visa accordé · Validé · Déposé |
| warn | `warn-soft` / `warn` | Réserve chiffrage · À renouveler · En attente MOA |
| err | `err-soft` / `err` | Non recevable · Périmé · Refusé |
| neutral | `line-2` / `ink-700` | Référence · Brouillon · Archivé · HT/TTC |
| ia | fond `paper`, bordure 1px `cyan`, texte `cyan-action`, glyphe ✦ | Généré par IA · Analyse IA |

Le badge `ia` marque un **contenu produit par l'IA**, pas un état métier : les deux peuvent coexister sur une même rangée.

### 3.7 Zones d'upload

Bordure 1,5px dashed `#D6CFC4`, fond `card`, radius `--moeia-r-lg`, padding 22px, centré. Titre 13px 600 `ink-900`, formats acceptés en 12,5px `ink-700`, lien « parcourir » en `cyan-action`. Drag-over : bordure `cyan`, fond `cyan-soft`. Par fichier reçu : rangée avec icône type, nom, poids `font-mono`, progression fine `cyan`, puis badge ok ou err avec cause.

### 3.8 Indicateurs de progression IA

Registre visuel unique pour toute l'IA (remplace le violet/fuchsia d'ACT et l'amber d'AO) :

- **Panneau IA** (traitement en cours) : fond `cyan-soft`, bordure `cyan-border`, badge ✦ IA, libellé de l'étape en cours 12,5px (« Analyse des écarts — ligne 34/53 »), barre 5px radius full piste `#D3EEFB` remplissage `cyan`, pourcentage `font-mono`. Toujours dire **ce que** l'IA fait, pas « chargement ».
- **Inline** (cellule, rangée) : spinner 14px `cyan-action` + libellé court.
- **Contenu généré** : badge ✦ + mention « à valider » tant qu'un humain n'a pas confirmé ; après validation, le badge ✦ reste (traçabilité), la mention tombe.
- Indéterminé : barre en va-et-vient, jamais de pourcentage inventé.

---

## 4. Règles d'application

### 4.1 Hiérarchie visuelle

L'ordre des moyens pour hiérarchiser, du premier au dernier recours : 1) taille et graisse typographiques, 2) encre vs `ink-700`/`ink-500`, 3) position et espacement, 4) filet ou fond `card`, 5) couleur. Si un écran a besoin de couleur pour être lisible, la hiérarchie typographique est ratée — recommencer par elle.

Discipline des graisses (corrige l'existant, où bold/semibold représentent 90 % des poids) : 400 par défaut, 600 pour l'emphase et les identifiants d'objets, 700 réservé aux titres de page et valeurs de stats. Un écran majoritairement en 600+ est un écran à reprendre.

### 4.2 Densité d'information

Les écrans moeïa sont denses par nature (DPGF de 200 lignes, comparatifs à 8 entreprises) — la densité est un objectif, pas un problème. Corps 12,5px, rangées 33px, chiffres mono tabulaires assumés. Ce qui rend la densité lisible : alignements stricts (tous les montants à droite, même largeur de colonne par type), en-têtes sticky, séparation par filets plutôt que par cartes imbriquées, regroupements par rangées de section. Ne jamais compenser la densité en réduisant sous 11px ni en ajoutant de la couleur.

### 4.3 Do / Don't

**Do**

- Une action primaire par écran ; le cyan fonctionnel réservé à l'IA et aux liens.
- Compter les occurrences de cyan sur un écran : au-delà de ~6, en retirer.
- `currentColor` pour le logo ; encre sur clair, blanc sur sombre.
- Fond soft + texte foncé pour tout badge ; monogrammes neutres pour identifier les entreprises.
- Bordures 1px `line` partout où l'existant mettait des ombres.
- Focus ring cyan systématique au clavier.
- Montants, écarts, notes, références : toujours `font-mono` tabulaire.

**Don't**

- Pas de dégradés (boutons ACT, header ACT : à supprimer).
- Pas de header d'application sombre (AO : à éclaircir — voir migration).
- Pas de texte en `#04B7F9` ni de blanc sur `#04B7F9` (2,3:1) : le signal n'est pas une couleur de texte.
- Pas de couleur d'identité par entreprise/société dans les tables (les 17 teintes d'ACT disparaissent).
- Pas de violet/fuchsia/amber pour l'IA : l'IA est cyan, partout.
- Pas de `rounded-full` sur les badges de statut, pas de radius > 10px hors modales.
- Pas d'emoji dans l'interface ; les icônes sont un set unique (Lucide, 14/16px, stroke 1,75).
- Pas de rouge/vert pour autre chose qu'un état métier (un écart négatif de prix n'est pas une « erreur » : il reste encre).
- Les couleurs d'export Word/Excel (`#C00000`, Calibri…) vivent dans un module d'export isolé, jamais dans l'UI.

### 4.4 Patterns d'écran — carte, liste, tableau (doctrine appliquée à AO et ACT)

La forme d'une collection n'est pas un choix libre par écran ; elle découle de la nature des objets :

- **Tableau dense** — forme par défaut dès que les objets se comparent ligne à ligne : dossiers AO, lots ACT, pièces du référentiel, offres. Colonnes numériques en mono alignées à droite, badge de statut en première colonne, actions révélées au survol en fin de rangée, rangée cliquable pour ouvrir l'objet.
- **Carte** — réservée à deux usages : les stats (stat cards) et les conteneurs de navigation de premier niveau (les opérations d'ACT, qui regroupent des lots). Une carte ne présente jamais un objet comparable à ses voisins.
- **Anatomie de tableau de bord unifiée** (dans cet ordre) : pagehead — titre uppercase + sous-titre à gauche, actions à droite dont l'unique bouton primaire encre ; alertes éventuelles ; rangée de 4 stat cards ; barre d'outils de liste — recherche à gauche (flex-1), chips de filtres à droite (actif : fond encre ; inactif : papier bordé), l'option « Tous » en dernier ; puis la collection. L'action de création vit dans le pagehead, jamais dans une tuile au milieu des stats.
- **Chips de filtre canoniques** : `px-3 py-1.5 text-[11px] uppercase tracking-widest font-semibold rounded-md border` — actif `bg encre / texte blanc / bordure encre`, inactif `papier / texte ink-700 / bordure line`.
- **Champ de recherche canonique** : icône loupe à gauche, `border line`, `rounded-md`, focus `border cyan` ; placeholder « Rechercher par X, Y, Z… » listant les champs réellement indexés.

### 4.5 Thème sombre (différé)

Non prioritaire. Le jour venu : inverser les neutres (fond `#12100D`, papier `#1C1917`, encre → `#E9E7E3`), le cyan reste identique, les softs passent en alpha (`rgba(4,183,249,.10)`). Aucun composant ne doit référencer une couleur brute pour que cette bascule reste un simple swap de variables — c'est le test de propreté des tokens.

---

## 5. Ton et micro-copy

### 5.1 Voix

moeïa parle comme un ingénieur expérimenté : précis, calme, direct. Vouvoiement partout (le tutoiement actuel d'ACT — « Charge ici ton CCTP » — disparaît). Pas d'exclamation, pas d'enthousiasme artificiel (« Super ! », « Oups »), pas de jargon SaaS (« workspace », « dashboard » → « tableau de bord »). Le vocabulaire est celui du métier, utilisé sans le réexpliquer : AO, DPGF, CCTP, DCE, MOA/MOE/BET, lot, tour d'offre, moins-disante, recevable, visa, réserve, OS.

### 5.2 Messages d'état — gabarits

| Situation | Gabarit | Exemple |
|---|---|---|
| Vide | constat + première action | « Aucun projet ACT. Créez un projet ou chargez un exemple. » |
| Succès | fait accompli, sobre | « DPGF importé — 53 lignes, 6 entreprises. » |
| Erreur | cause + action de sortie, sans s'excuser | « Import impossible : l'onglet ‹ DPGF › est introuvable dans le fichier. Vérifiez le classeur ou importez l'autre format. » |
| Destructif | objet nommé + irréversibilité | « Supprimer le tour d'offre 2 de 2025-FFT-CVC ? Les analyses associées seront perdues. » |
| IA en cours | verbe précis + progression | « Analyse des écarts > 50 % — ligne 34/53. » |
| IA terminé | résultat + statut de validation | « 12 commentaires générés — à valider avant intégration au rapport. » |
| IA échec | cause + repli manuel | « Analyse interrompue : le CCTP ne contient pas de lot CVC identifiable. Vous pouvez annoter manuellement. » |

Règles IA : l'IA propose, l'utilisateur dispose — jamais « l'IA a validé » ; toujours tracer (badge ✦) ; jamais présenter une estimation IA comme une donnée saisie.

### 5.3 Libellés

Boutons à l'infinitif (« Exporter », « Générer les commentaires », « Créer un projet »), jamais « Cliquez ici ». Titres de page sans article (« Analyse comparative des offres »). Dates au format `01/05/2026`, montants `91 182,06 € HT` (espace insécable avant €, mention HT/TTC systématique), écarts signés `−21,4 %`.

---

## 6. Plan de migration

Le levier : les trois outils passent déjà par un remapping de palette dans `tailwind.config`. Une grande partie de la migration est donc un **échange de valeurs de config, pas une réécriture de classes**.

### Phase 0 — Socle (préalable, sans impact visuel)

1. Créer `moeia.tailwind.preset.js` + `moeia-tokens.css` (section 2) dans un emplacement partagé.
2. Charger les 3 fontes dans les trois outils.
3. Générer les favicons depuis `moeia-picto.svg` (remplace le favicon vert/ambre « B » d'ACT et le monogramme « PU » de CCTP).

**Les deux leviers obligatoires par outil** (validés sur ACT et AO — sans eux la migration reste un recoloriage) :

- **Surcharge de l'échelle neutre** : redéfinir la famille de gris utilisée par l'outil (`stone` ou `slate`) directement dans son `tailwind.config` avec les valeurs pierre (50:`#F6F5F2`, 100:`#EEECE7`, 200:`#E5E2DC`, 300:`#D8D3CB`, 400/500:`#8F8A82`, 600:`#6E6961`, 700:`#57534E`, 800:`#3A362F`, 900:`#221F1A`, 950:`#16130F`). Toute la base bascule d'un coup, sans toucher une classe. Idem pour les familles sémantiques (`amber`→warn, `red`/`rose`→err, `green`/`emerald`→ok) et les familles détournées pour l'IA (`purple`/`violet`/`blue`→registre cyan).
- **Couche CSS moeïa** (`<style id="moeia-layer">` en fin de `<head>`) qui impose les signatures indépendamment des classes : `::selection` cyan pâle, `:focus-visible` cyan, `h1-h3` en Space Grotesk, `.tabular-nums` en JetBrains Mono, `table thead th` en capitales `ink-500` avec border-bottom 1px encre, radius par défaut des boutons non stylés, `accent-color` des inputs.

### Phase 1 — CCTP (le plus petit, l'architecture la plus saine : pilote)

Se restyle sans refonte : `window.THEME.palette` reçoit les valeurs moeïa ; les composants factorisés (`Bouton`, `Badge`, `Logo`) absorbent 80 % du restyle en trois modifications ; `logoUrl` pointe vers `moeia-picto.svg` ; neutres `slate-*` → `ink/base` (remplacement mécanique).
Casse : rien de structurel. Le monogramme généré disparaît au profit du vrai logo ; identité affichée « PULZ » → « moeïa ».

### Phase 2 — ACT (déjà le plus proche : logo, Inter, embryon de tokens)

Se restyle sans refonte : l'échelle `sky` remappée reçoit les valeurs cyan moeïa (les classes `sky-*` existantes tombent juste) ; `stone` reste ; l'objet `moeia` interne s'aligne sur les tokens (`ink` `#000105` → `#221F1A`).
Casse (retouches ciblées) : les **boutons en dégradé** (à aplatir en `primary`/`ia`) ; le **header à filet dégradé** ; le **codage 17 teintes des colonnes entreprises** → monogrammes neutres + badges (toucher le composant de rendu du comparatif, pas la logique) ; le registre IA violet/fuchsia → cyan ; les verts legacy codés en dur (`#166855`, `#1F6B5E`) ; le tutoiement des micro-copies.

### Phase 3 — AO (le plus gros, les écarts les plus visibles)

Se restyle sans refonte : la palette `emerald` remappée (bleus PULZ) reçoit les valeurs cyan moeïa — mécanique ; `stone` est déjà la base neutre ; l'échelle d'espacement est déjà conforme.
Casse (chantiers réels) : le **header sombre** passe en papier (changement d'identité visuelle fort de l'écran — à faire d'un bloc, pas progressivement) ; le branding « PULZ Ingénierie » → moeïa (logo, titres, mentions) ; l'IA amber → cyan ; **isoler les couleurs d'export Word** (`#C00000`, `#595959`, Calibri) dans un module export pour qu'elles sortent du scope UI ; alertes de péremption : conserver la sémantique err/warn, migrer les fonds saturés vers les softs ; graisses : passe de dégraissage (bold → 400/600 selon la règle 4.1).

### Phase 4 — Convergence

Extraire les composants de la section 3 en bibliothèque partagée (en commençant par Bouton, Badge, Table, StatCard — CCTP fournit le modèle) ; supprimer les trois `tailwind.config` locaux au profit du preset ; audit final automatisé : zéro hex hors tokens dans les sources (le script d'audit de ce projet est réutilisable tel quel).

Ordre justifié : CCTP d'abord (petit, sain, valide le socle), ACT ensuite (proche, valide les cas denses), AO en dernier (gros, bénéficie des composants éprouvés). À chaque phase, l'outil migré est entièrement sur tokens — pas d'état intermédiaire mi-PULZ mi-moeïa au sein d'un même outil.

---

## Annexe — Checklist de conformité d'un écran

1. Toutes les couleurs proviennent des tokens (zéro hex en dur).
2. Une seule action primaire ; cyan ≤ ~6 occurrences ; aucun texte en `#04B7F9`.
3. Corps 12,5px minimum 11px ; montants en mono tabulaire alignés à droite.
4. Graisses : 700 uniquement titres/stats ; l'écran n'est pas majoritairement en semibold.
5. Badges en soft + foncé ; IA exclusivement en registre cyan ✦.
6. Focus clavier visible partout ; contrastes AA (valeurs vérifiées en section 2).
7. Bordures 1px plutôt qu'ombres ; radius ≤ 10px hors modales.
8. Micro-copy : vouvoiement, vocabulaire métier, gabarits de la section 5.
