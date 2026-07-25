# Cadrage — Shell moeïa & Configuration commune

**Version 1.0 — 18/07/2026 · Statut : à valider par Sylvain**
Objet : regrouper les outils (AO, CCTP, Budget, ACT, Visas) sous une page principale unique, avec un volet Configuration servant de source unique pour les informations des sociétés — consommée par tous les modules.

---

## 1. Constat (extrait du code réel des trois outils)

La même information est aujourd'hui saisie et stockée trois fois, avec des divergences déjà visibles :

| Donnée | AO | ACT | CCTP |
|---|---|---|---|
| Identité BUSCOT | `SOCIETES_GROUPE_DEFAUT[buscot]` : SIRET 921 557 716 000 39, adresse **99 rue de l'Union, Wambrechies**, RCS Douai, contact, slogan, couleurs, police | `IDENTITE_BUSCOT` : mêmes SIRET/tel/email mais **deux adresses** (siège Nomain + bureaux Wambrechies), forme SAS, signataire | `THEME.marque = 'PULZ'` (obsolète) |
| Sociétés du groupement | ✔ structure complète (ARTEIX, THERAC, GRADIENT, PULZ) avec métiers, pièces marché, équipes/CV | ✘ (recopie l'émetteur par projet : `emetteur_nom/couleur/logo/signature`) | ✘ |
| Pièces administratives + dates de validité | ✔ référentiel avec alertes péremption | ✘ | ✘ |
| Intervenants externes (architectes, BET partenaires) | ✔ (mandataires/intervenants) | ✘ | ✘ |
| Marque, logo, thème | logos par société | logo moeïa embarqué | `window.THEME` white-label |
| Stockage | IndexedDB/localStorage local | localStorage local | **Supabase** (auth + table `projets`) |

L'écran Configuration d'ACT porte déjà la mention « Identité société (mutualisée avec l'outil AO) » — l'intention existe, la mutualisation technique n'existe pas.

**Contrainte structurante** : des fichiers HTML autonomes ouverts en local ne peuvent pas partager leur stockage navigateur de façon fiable (cloisonnement par origine). Une configuration réellement commune impose soit une même origine d'hébergement, soit un backend.

## 2. Architecture cible recommandée

```
moeia.app (hébergement type Vercel — CCTP y est déjà)
├── /            → Shell : page principale (modules, alertes, activité)
├── /config      → Configuration commune (sociétés, identité, pièces, intervenants)
├── /ao  /act  /cctp  /budget  /visas   → modules (les outils actuels, quasi intacts)
└── Supabase     → auth + données de configuration + projets par module
```

- **Backend : Supabase** (déjà en production pour CCTP : auth email + table projets). La configuration commune y vit ; chaque module la lit via un client JS partagé.
- **Client partagé `moeia-config.js`** — le contrat d'interface. Expose `getIdentite()`, `getSocietes()`, `getPieces()`, `getIntervenants()`, `getPreferences(module)` avec cache local (localStorage) et **fallback hors-ligne** : si Supabase est injoignable, le module travaille sur le dernier cache et l'indique (badge « hors-ligne » dans l'appbar). Les modules ne parlent jamais à Supabase directement pour la config — uniquement via ce client, ce qui permet de changer de backend sans retoucher les outils.
- **Le shell** est une page légère conforme DA (mêmes tokens, même appbar que les modules — le sélecteur AO/CCTP/Budget/ACT/Visas des mockups validés devient la navigation réelle).
- **Les modules restent des applications autonomes** : on ne fusionne pas les codes. Le shell les ouvre ; l'appbar commune donne le retour au hub. La fusion en SPA unique n'apporterait rien et ferait porter un risque énorme aux 2 Mo de code existant.

## 3. Modèle de données de la Configuration commune

Consolidation des structures réellement présentes dans le code (la structure AO, la plus riche, sert de référence) :

```
organisation            — 1 enregistrement
  denomination, forme_juridique, siret, siren, rcs
  adresse_siege, adresse_bureaux
  telephone, email, site_web, slogan
  signataire_nom, signataire_qualite
  logo_url, couleur_hex (#221F1A), couleur_secondaire_hex (#0273C4)

societes                — le groupement (BUSCOT, ARTEIX, THERAC, GRADIENT, …)
  id, code, nom, metiers_par_defaut, siret, siren, rcs, adresse
  contact_nom, contact_email, contact_tel, site_web, slogan
  couleur_hex (identité société — donnée, pas token UI), logo_url
  protegee (bool), ordre

pieces_referentiel      — le référentiel AO, étendu à toutes les sociétés
  id, societe_id, nom, categorie (Administratif/Fiscal-Social/Assurance/Conformité/Financier)
  date_document, validite_mois | validite_jusqua, tags[]
  → statut (ok / à renouveler / périmé) calculé, jamais stocké

intervenants_externes   — architectes, BET partenaires, mandataires
  id, nom, specialite, type (archi | bet | autre), contact_*, couleur_hex, notes

equipes                 — CV / personnes par société (structure PULZ_INIT d'AO)
  id, societe_id, nom, poste, diplome, experience

preferences             — par module et global
  module (shell|ao|act|cctp|…), cle, valeur (JSON)
```

Les **projets** (AO, projets ACT, CCTP) restent la propriété de chaque module — le cadrage ne mutualise que la configuration.

## 4. Page principale — contenu (cf. maquette livrée)

Conforme à la doctrine DA §4.4 : les modules sont des conteneurs de navigation → **cartes** ; les alertes et l'activité sont des objets comparables → **tableaux denses**.

1. Appbar commune : logo moeïa, navigation modules, badge IA, état de synchro, Configuration.
2. Alerte transverse : pièces du référentiel périmées/à renouveler (donnée aujourd'hui enfermée dans AO, demain visible partout).
3. Cartes modules : statut (actif / bientôt), 2 indicateurs clés, dernière activité, accès direct.
4. Activité récente inter-modules (table dense) : dernières actions tous outils confondus.

## 5. Plan de branchement incrémental

| Phase | Contenu | Ce qui casse |
|---|---|---|
| **S1** | Repo + hébergement + shell statique + Configuration en lecture/écriture (Supabase). Import initial des données AO (sociétés, pièces, intervenants) par export JSON. | Rien : les outils actuels continuent de tourner tels quels. |
| **S2** | AO branché : ses écrans Référentiel/Configuration lisent-écrivent via `moeia-config.js`. AO est le plus gros consommateur → il valide le contrat. | AO doit être servi depuis l'origine commune (fin du double-clic sur le fichier local). Migration des données locales existantes (assistant d'import à prévoir). |
| **S3** | ACT branché : `IDENTITE_BUSCOT` et `emetteur_*` remplacés par `getIdentite()`/`getSocietes()`. | Les projets ACT locaux restent en localStorage (inchangé) ; seule la config bascule. |
| **S4** | CCTP branché : `THEME` alimenté par l'organisation (marque moeïa, logo, couleurs). | Minime — déjà sur Supabase. |
| **S5** | Modules Budget et Visas : naissent directement dans le shell, sur le contrat. | — |

Chaque phase = une conversation dédiée, cadrée par `CLAUDE.md` + ce document + contrôle `verifier-conformite.py`.

## 6. Décisions à trancher avant S1

1. **Hébergement** : Vercel (aligné CCTP) — à confirmer, avec nom de domaine éventuel.
2. **Comptes** : un compte unique BUSCOT ou un compte par collaborateur (Supabase gère les deux ; par collaborateur recommandé dès qu'un tiers utilise les outils).
3. **Hors-ligne** : le fallback cache lecture seule suffit-il, ou faut-il l'édition hors-ligne (beaucoup plus lourd — déconseillé en S1) ?
4. **Droits** : qui peut modifier la Configuration (tous / admin seul) ?
5. **Données sociétés sensibles** (SIRET, contacts) hébergées chez Supabase : OK RGPD côté BUSCOT ? (données professionnelles, a priori oui — à confirmer.)

## 7. Ce que ce cadrage ne couvre pas

La fusion des codes des outils (non souhaitée), la refonte des projets par module, la facturation/multi-tenant white-label évoquée dans les commentaires de CCTP (pertinente plus tard, le modèle `organisation` y est prêt), et le module Budget/Visas eux-mêmes.
