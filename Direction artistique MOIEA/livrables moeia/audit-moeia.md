# Audit design — outils existants (AO, ACT, CCTP)

Audit automatisé réalisé sur les sources HTML (17/07/2026). Méthode : extraction exhaustive des couleurs, classes Tailwind, typographies, espacements, rayons, ombres et composants + captures d'écran des trois outils rendus hors-ligne (Tailwind compilé localement, React vendorisé).

## 1. Stack et architecture de style

| | AO (PULZ-AO) | ACT | CCTP |
|---|---|---|---|
| Framework | React 18 + Tailwind CDN | React 18 + Tailwind CDN | React 18 + Tailwind CDN + Babel standalone |
| Stratégie de thème | `emerald` remappé → bleus PULZ | `sky` remappé → cyans moeïa + objet `moeia` | objet `window.THEME` white-label, `brand` = vert emerald par défaut |
| Marque affichée | PULZ Ingénierie (ancien logo) | **moeïa** (logo déjà intégré) | PULZ (monogramme "PU" généré) |
| Backend | local | local | Supabase (login) |

Trois philosophies de theming différentes pour trois outils. ACT est le plus avancé vers moeïa (logo + tokens `moeia.ink/cyan/blue`), CCTP le plus en retard (vert par défaut, jamais thémé).

## 2. Couleurs

### Accents — l'incohérence principale
- **AO** : bleu PULZ `#0087E1` → `#0050A7` (boutons primaires bleu foncé `#0050A7`)
- **ACT** : cyan moeïa `#02C1F3` / `#0E96FA`, boutons en **dégradé** cyan
- **CCTP** : vert emerald `#059669` (jamais mis à jour)

### Neutres — deux familles concurrentes
- `stone` (gris chaud) : dominant dans AO (1257 usages) et ACT (549)
- `slate` (gris froid) : dominant dans CCTP (212), présent en résidu dans AO/ACT
- Noir d'encre : `#000105` (ACT, hérité du logo), `#1C1917` (AO), `#1F2937` (çà et là)

### Couleurs sémantiques et codage
- AO : amber (192), rose (134), red (62), violet (42) — alertes péremption en red/rose, IA en amber/violet
- ACT : **17 familles de teintes** utilisées — purple/fuchsia pour l'IA, et une roue complète (red, green, blue, purple, magenta, teal, lime, orange…) pour colorer les colonnes entreprises des comparatifs. Effet "carnaval" sur l'écran Analyse DPGF.
- CCTP : amber/red/green minimal
- Couleurs codées en dur hors système : ~65 hex distincts dans AO dont les couleurs d'export Word (`#C00000`, `#595959`, Calibri) — légitimes pour les exports, à isoler du système UI.
- Résidus legacy : verts `#166855`/`#1F6B5E` dans ACT, favicon vert/ambre BUSCOT.

### Logo (source vectorisée, reconstruit)
- Encre quasi-noire bleutée (`#000105` → normalisé `currentColor`)
- **Accent cyan déjà présent dans le logo : `#04B7F9`** (barre centrale du picto, point du i, "L'IA")
- Baseline "MAÎTRISE D'ŒUVRE AUGMENTÉE PAR L'IA" dégradée par la vectorisation (Î et apostrophes perdus) → à recomposer en texte réel.

## 3. Typographie

- AO : system-ui / Helvetica Neue — aucune fonte dédiée
- ACT : **Inter** (400/500/600) via Google Fonts
- CCTP : défaut Tailwind (system)
- Exports : Calibri/Arial (Word) — hors UI, à conserver côté documents
- Échelle réelle : `text-xs` massivement dominant (AO 270, ACT 92), puis `text-sm`. UI très dense, corps de texte effectif 12px.
- Graisses : bold/semibold surreprésentés (AO : 336 bold + 247 semibold vs 29 medium) → hiérarchie écrasée, tout crie.

## 4. Espacements, rayons, ombres

- Espacement : échelle resserrée cohérente de fait — 1/1.5/2/3/4 dominants (padding 8px moyen). Densité homogène entre outils.
- Rayons : AO/ACT = `rounded` (4px) par défaut + `rounded-full` badges ; CCTP = `rounded-lg` (8px) par défaut. **Deux langages de forme.**
- Ombres : quasi absentes (qq shadow-sm) — design "flat + bordures 1px", à conserver.
- Dark mode : aucun (0 `dark:` sur les trois).

## 5. Composants recensés

- **Onglets** : omniprésents (ACT 194 occurrences, AO 106) — composant structurant n°1
- **Badges de statut** : AO 34, ACT 27, CCTP 81 — styles divergents (pill `rounded-full` vs `rounded`, tons pastel vs saturés)
- **Tableaux denses** : DPGF/comparatifs avec colonnes colorées par entreprise, en-têtes sticky (AO 12, ACT 19 `sticky`)
- **Stat cards** : bordure gauche colorée 4px (AO bleu/ambre, ACT ambre) — pattern commun de fait
- **Modales** : AO 18, ACT 9 ; **zones d'upload** : AO 17, ACT 7, CCTP 3
- **Indicateurs IA** : animate-spin/pulse + violet/fuchsia (ACT), amber (AO) — pas de langage IA unifié
- CCTP seul utilise de vrais `<button>` avec composants `Bouton/Badge` factorisés ; AO/ACT stylent des divs/spans inline.

## 6. Synthèse des incohérences

1. **3 accents concurrents** : bleu PULZ / cyan moeïa / vert emerald
2. **2 neutres concurrents** : stone (chaud) vs slate (froid)
3. **2 rayons par défaut** : 4px vs 8px
4. **3 identités affichées** : PULZ Ingénierie / moeïa / PULZ
5. Typo non unifiée (Inter seulement dans ACT)
6. Codage couleur des comparatifs non systémique (17 teintes ad hoc)
7. Signal "IA" incohérent (violet vs amber vs rien)
8. Hiérarchie de graisses écrasée (tout en bold/semibold)
9. Couleurs d'export Word mêlées aux couleurs UI dans AO
10. Aucun token partagé entre outils malgré trois embryons de systèmes (`emerald` remap, `moeia`, `window.THEME`)

## 7. Acquis à conserver

- Densité maîtrisée et régulière (échelle 4/6/8/12px)
- Flat design à bordures fines, ombres rares
- Pattern stat-card à liseré gauche
- Structure à onglets généralisée
- CCTP : composants factorisés + white-label `THEME` = bonne cible d'architecture pour les tokens moeïa
- ACT : embryon de tokens `moeia` + Inter + logo déjà en place
