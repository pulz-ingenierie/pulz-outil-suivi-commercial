# Métaprompt — Refonte ergonomique globale « Suivi commercial (moeïa) »

> Document de référence. Toute évolution d'interface DOIT s'y conformer. Objectif :
> un outil **cohérent, full-screen, mobile-first**, qui se comporte comme une
> application native — un seul langage, un seul geste, une seule grille.

---

## 0. Rôle & posture

Tu es le designer-ingénieur produit de cet outil. Tu conçois pour **Sylvain**
(directeur, non-technicien, usage terrain à une main sur iPhone, souvent en
déplacement, à la voix). Chaque écran doit être **évident, rapide, sans friction**.
Priorité absolue : **cohérence** > richesse. Si un motif existe déjà, on le réutilise ;
on n'invente pas un second motif pour le même besoin.

---

## 1. Non-négociables (charte moeïa — ne jamais diluer)

- **Palette** : encre chaude sur pierre. Neutres : ink `#221F1A`, muted `#57534E`,
  faint `#8F8A82`, fond `#FFFFFF` (clair), surface-2 `#F4F3EF`, lignes `#E3E0DA`/`#EEECE7`.
- **Cyan gouverné** : un seul cyan `#04B7F9` = **signal IA / focus uniquement**.
  Cyan-action `#0273C4` pour liens/focus. ≤ ~6 touches de cyan par écran.
  **Bouton métier = encre** ; **bouton IA = cyan + glyphe ✦** (le seul glyphe autorisé).
- **Statuts** : ok `#3E7A4E`, warn `#855900`, err/crit `#B3352B` (+ variantes soft).
- **Phases** : piste (gris), qualifié (gris foncé), concours (bleu), à chiffrer (ambre),
  offre remise / négociation (encre), gagné (vert), perdu (rouge).
- **Typo** : UI = Inter ; titres = Space Grotesk ; chiffres/dates/montants = mono tabulaire.
  **Pas de titres en majuscules.**
- **Rayons ≤ 10 px** (sauf pastilles 999px). **Zéro emoji** (icônes Lucide 14/16, trait 1.75).
- **Vouvoiement**, français professionnel, sobre.

---

## 2. Étoile polaire ergonomique (les 6 principes)

1. **Un seul geste.** Taper une ligne la **déplie sur place** (aperçu + actions).
   Glisser à gauche = supprimer. Appui long sur un signet = supprimer/détacher.
   Jamais deux comportements pour le même objet.
2. **Une seule surface de détail rapide** : le panneau déplié. La **fiche complète**
   est une destination secondaire, atteignable en un tap depuis le panneau.
3. **Une seule grille.** Tout partage le même gabarit de largeur et les mêmes gouttières.
   Onglets, titres, listes, cartes, panneaux : mêmes bords.
4. **Un seul langage conteneur.** Liste = carte contenant des lignes. Une carte, une
   liste et un bloc de fiche ont la même bordure, le même rayon, le même fond.
5. **Plein écran, pensé pour le pouce.** L'app occupe tout l'écran (100dvh), respecte
   les safe-areas iOS, et place la navigation et les actions primaires **en bas**,
   à portée de pouce.
6. **Zéro surprise.** Mêmes libellés, mêmes icônes, mêmes emplacements d'un écran à
   l'autre. Les actions destructrices demandent confirmation (volet rouge).

---

## 3. App-shell full-screen (le squelette)

Toutes les pages authentifiées partagent **la même coquille**, en trois zones fixes :

```
┌───────────────────────────────┐  ← safe-area top
│  Top bar (compacte, 52px)     │   logo moeïa · titre écran · action contextuelle
├───────────────────────────────┤
│                               │
│  Contenu (seule zone qui      │   scroll vertical unique, gouttières constantes
│  défile — 1 seul scroll)      │
│                               │
├───────────────────────────────┤
│  Bottom nav (thumb, 64px)     │   Tableau · Relances · [＋ CR] · Réseau
└───────────────────────────────┘  ← safe-area bottom
```

Règles :
- `height: 100dvh`, `overflow: hidden` sur la coquille ; **seule la zone contenu défile**.
- `env(safe-area-inset-*)` respectés (encoche, barre home).
- **Bottom nav** = navigation primaire (3–4 destinations max), toujours visible, item
  actif marqué. Le bouton central **Nouveau CR** est l'action-phare (encre pleine, pas cyan).
- **Top bar** minimale : identité + titre de l'écran + 1 action contextuelle (ex. « Modifier »).
- Plus de multiples boutons épars dans un `.topbar` qui déborde.

---

## 4. Système d'espacement & grille

- Échelle d'espace (px) : **4 · 8 · 12 · 16 · 24 · 32**. Rien d'autre.
- Gouttière latérale du contenu : **16 px** (mobile), centré, largeur max **760 px** (desktop).
- Entre blocs/sections : **16 px**. Interne carte/bloc : **14–16 px**.
- Lignes de liste : hauteur tap **≥ 48 px**. Boutons : hauteur **≥ 44 px** (cible tactile).

---

## 5. Modèle d'interaction (détaillé)

- **Liste** : conteneur unique (`.vlist2`) — bordure 1px, rayon 10px, fond surface,
  lignes séparées par un filet. Aligné à la gouttière (jamais de débord bord-à-bord).
- **Ligne** : `titre` (gras, tronqué à l'ellipse) + `méta` (droite : signets colorés,
  phase, date, montant) + chevron. Tap → déplie.
- **Panneau déplié** (`.lx-body`, fond légèrement en creux) : sections de signets
  associés + **barre d'actions unique** en bas. Actions ordonnées : primaire (encre) à
  gauche, secondaires (chips gris) au milieu, destructive (rouge discret) à droite.
- **Signet** : pastille colorée par catégorie (structure/opération/personne/phase/relance),
  sans contour, cliquable. Tap → ouvre la fiche de l'objet. Appui long → supprimer/détacher.
- **Volet rouge** : réservé **uniquement** à la confirmation de suppression (avec cases
  pour les objets liés). Aucun autre usage de volet du bas.
- **Contrôles** : un seul mécanisme par besoin — date = calendrier natif (pastille
  cliquable) ; phase = pastille colorée → menu ; personnes = puces + menu déroulant
  (multi). Jamais deux mécanismes pour la même chose.

---

## 6. Inventaire des composants (à normaliser)

| Composant        | Spéc unique                                                            |
|------------------|------------------------------------------------------------------------|
| App-shell        | top bar + contenu scrollable + bottom nav ; safe-areas                 |
| Liste            | `.vlist2` (bordure, rayon 10, filets)                                   |
| Ligne            | titre + méta + chevron ; tap = déplie ; swipe = supprime               |
| Panneau déplié   | signets + barre d'actions ordonnée                                      |
| Fiche            | même en-tête (eyebrow + titre), blocs identiques, 1 barre d'actions    |
| Signet           | pastille catégorielle, sans contour, tap = fiche, appui long = suppr.  |
| Bouton           | métier = encre plein ; IA = cyan + ✦ ; secondaire = chip gris ; danger = rouge discret |
| Champ            | bordure 1px, rayon 10, focus cyan                                       |
| Pastille phase   | couleur d'étape + libellé + menu                                        |
| KPI              | rangée fine, chiffres mono, pas de grosse carte                        |
| Volet rouge      | confirmation de suppression uniquement                                  |
| Onglets (seg)    | pleine largeur du contenu, rayon 10, item actif encre                  |

---

## 7. Cartographie des écrans (tout parle le même langage)

- **Tableau (accueil)** : KPIs fins → onglets Phases/Opérations/Structures/Personnes →
  **liste unique** (dépliage en place). Bottom nav visible.
- **Relances** : groupes (En retard / Aujourd'hui / À venir) → **même liste** ; le
  dépliage montre signets + actions (Nouveau CR / Fait / Reporter / Abandonner).
- **Fiche** (structure / opération / personne) : en-tête cohérent, blocs identiques,
  listes internes = mêmes lignes dépliables, **une** barre d'actions (Modifier / Dicter / …).
- **Saisie d'un CR** (le chantier restant) : **même langage**, plus de cartes en
  surimpression. Un flux vertical : dictée/texte → analyse IA → **blocs dépliables**
  (structures, opérations avec pastille de phase, personnes, suites à donner) éditables
  **en place** → débrief « À préciser » → barre d'action finale (Enregistrer).

---

## 8. Anti-patterns (à bannir)

- ❌ Deux façons d'ouvrir un objet (page **et** dépliage) pour le même contexte.
- ❌ Listes bord-à-bord à côté de contrôles en retrait (largeurs mixtes).
- ❌ Cartes en surimpression pour éditer, alors que le reste se déplie en place.
- ❌ Emojis ; titres en majuscules ; cyan décoratif ; rayons > 10px.
- ❌ Boutons « fantômes » qui ressemblent à des champs.
- ❌ Actions primaires en haut de l'écran, hors de portée du pouce.

---

## 9. Critères de recette (« c'est cohérent quand… »)

1. Sur **tous** les écrans, taper une ligne produit le **même** résultat (dépliage).
2. On peut recouvrir n'importe quel écran d'une grille : **tous les bords s'alignent**.
3. Un même objet (ex. une opération) a **exactement** le même rendu partout.
4. Navigation primaire **toujours** au même endroit (bottom nav), atteignable au pouce.
5. Aucune page ne déborde horizontalement ; un seul scroll vertical par écran.
6. Zéro emoji ; un seul cyan, réservé IA/focus ; tous les rayons ≤ 10px.
7. Toute action destructive passe par le volet rouge.

---

## 10. Méthode d'exécution

- Par **étapes shippables**, publiées sur `main` (prod), vérifiées via le marqueur de
  version en bas d'écran.
- Ordre : **(a)** app-shell full-screen + bottom nav → **(b)** normaliser listes/fiches
  sur la grille → **(c)** refondre la **saisie de CR** au même langage → **(d)** passe
  finale (icônes Lucide, espacements, micro-détails).
- À chaque étape : `npm run build` vert, puis publication, puis contrôle sur iPhone.
- Ne jamais introduire un motif nouveau sans l'ajouter d'abord à ce document.
