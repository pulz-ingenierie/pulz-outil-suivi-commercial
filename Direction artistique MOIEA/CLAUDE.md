# moeïa — instructions permanentes (à lire avant toute modification)

Ce dossier contient les outils moeïa (AO, ACT, CCTP) et leur direction artistique.
**Avant toute modification d'un outil, lire `livrables moeia/moeia-direction-artistique.md`.**
C'est la source de vérité : tokens, composants, règles do/don't, ton, patterns d'écran.

## Fichiers

- `AO-moeia.html`, `ACT-moeia.html` — versions migrées DA (les versions de travail). `AO.html`, `ACT.html`, `CCTP.html` — originaux pré-DA, ne plus les faire évoluer.
- `livrables moeia/moeia-direction-artistique.md` — document de référence complet.
- `livrables moeia/shell/moeia-shell-cadrage.md` — cadrage de la plateforme unifiée (page principale + Configuration commune Supabase) et plan de branchement S1→S5 ; `moeia-shell-maquette.html` — maquette validable de l'accueil et du volet Configuration. Toute évolution vers la plateforme unique suit ce cadrage.
- `livrables moeia/socle/` — preset Tailwind, tokens CSS, favicon, script de conformité.
- `livrables moeia/moeia-logo*.svg` — logos reconstruits (currentColor + #04B7F9).

## Règles non négociables pour toute modification

1. **Zéro valeur en dur.** Toute couleur, taille, espacement vient des tokens : classes Tailwind
   existantes (les échelles `stone`, `sky`, `amber`, `red`, etc. sont déjà remappées vers les
   valeurs moeïa dans le `tailwind.config` de chaque fichier) ou variables `--moeia-*`.
   Ne jamais ajouter un hex nouveau ni retoucher les valeurs du config sans mettre à jour
   le document DA et les autres outils.
2. **Le cyan est gouverné.** `#04B7F9` = signal (jamais du texte, jamais de fond sous texte
   blanc) ; boutons cyan = actions IA exclusivement ; boutons métier = encre (`bg-stone-900`).
   Un écran porte ~5-6 occurrences de cyan maximum.
3. **Ne pas toucher** : la couche `<style id="moeia-layer">` (signatures typographiques,
   focus, densité) sauf décision DA documentée ; le gabarit d'export Word (Calibri, #C00000…)
   qui est un module isolé hors scope UI.
4. **Nouveaux écrans** : suivre §4.4 du doc DA — tableau dense pour les objets comparables,
   cartes pour stats et conteneurs, pagehead avec unique bouton primaire encre, barre
   recherche-gauche/filtres-droite avec les chips canoniques.
5. **Micro-copy** : vouvoiement, vocabulaire métier, gabarits §5 du doc DA. Les prompts IA
   internes (chaînes `Tu es un expert…` envoyées au modèle) ne sont PAS de la micro-copy :
   ne pas les modifier pour des raisons de style.
6. **Après toute modification** : exécuter `livrables moeia/socle/verifier-conformite.py`
   sur le fichier modifié et corriger toute erreur avant de livrer. Puis dérouler la
   checklist de l'annexe du doc DA sur l'écran touché.

## Synchronisation entre outils

Les tokens sont pour l'instant dupliqués dans le `tailwind.config` de chaque fichier HTML
(contrainte du mono-fichier). Tout changement de token doit donc être répliqué dans chaque
outil ET dans `socle/moeia.tailwind.preset.js` ET dans le doc DA. Si les outils migrent un
jour vers un vrai repo avec build, remplacer les configs locaux par l'import du preset —
c'est la phase 4 du plan de migration.
