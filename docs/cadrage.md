# CADRAGE — SUIVI COMMERCIAL (module moeïa)

> **Version 1.0 — 20 juillet 2026** — cadrage réalisé avec Sylvain (BUSCOT
> ENERGIES / PULZ Ingénierie). Document destiné à démarrer le développement dans
> Claude Code sans décision structurante supplémentaire.
>
> **Statut** : décisions closes. Toute question qui surgirait au dev et ne trouve
> pas sa réponse ici doit être tranchée dans l'esprit des trois piliers du §1,
> dans cet ordre. Deuxième module de la plateforme MOEAI, après PULZ-AO.

---

## 1. Vision et piliers

Outil de suivi commercial pour une organisation multi-utilisateurs (pilote :
groupement PULZ, ~10 personnes). Futur module moeïa → **vocabulaire neutre
partout** (prompts, UI, modèle de données) : « organisation », jamais
PULZ/BUSCOT en dur.

Trois piliers, par ordre de priorité :

1. **Recueil sans friction.** Sortie de RDV → ouvrir la PWA → micro → raconter
   1-3 min → valider. Toute saisie obligatoire supplémentaire = échec de
   conception.
2. **Automatisation maximale.** Transcription, synthèse, extraction,
   rattachement, détection des actions et relances : l'IA propose, l'humain
   valide en un geste, ne ressaisit jamais. L'IA n'invente jamais : ce qui n'est
   pas dit est « non évoqué ».
3. **Pilotage aiguisé.** Vue desktop/COPIL par **opération** (pas par RDV, pas
   par €), retards et silences visibles immédiatement, arbitrage et
   planification depuis les fiches.

Principes gravés :

- Les **montants sont accessoires** ; le pilotage se fait par opération. Champ
  montant facultatif, jamais demandé, jamais central. Pas de probabilité, pas de
  pipe pondéré.
- Aucun prospect ne peut sortir des radars : relance par défaut à +1 mois,
  alerte silence à 2 mois.
- Le vocal est le chemin rapide, pas le chemin unique : tout est faisable au
  formulaire.

## 2. Utilisateurs, rôles, périmètre

- ~10 utilisateurs. Tout le monde enregistre, tout le monde voit tout. Pas de
  cloisonnement par société.
- Deux rôles : **membre** (enregistre, consulte, corrige ses propres CR, traite
  ses relances) et **pilote** (tout membre + change les statuts d'opération,
  réattribue, planifie, arbitre). Rôle attribuable, évolutif.
- Prospects et opérations appartiennent à l'organisation. La société du référent
  est une étiquette informative.
- Volumétrie : ~5 RDV/mois/personne, ~50 vocales/mois au total.
- Aucun rituel commercial n'existe aujourd'hui : l'outil fait naître le point
  commercial. Vue COPIL v1 volontairement minimale, affinée à l'usage.

### Authentification

- PWA installable (URL « Ajouter à l'écran d'accueil », icône, plein écran).
- **Lien magique Supabase** une fois par appareil (email → clic → appareil
  reconnu durablement) puis sélection du profil, mémorisée. Menu « changer
  d'utilisateur » disponible.
- Décision de sécurité actée : pas de données commerciales derrière une URL nue.

## 3. Parcours de recueil vocal

### Nominal

1. Micro → enregistrement (1-3 min) → stop.
2. Transcription (Whisper) → analyse Claude → carte de synthèse : entité(s),
   contact(s), opération(s) évoquée(s), type de RDV, sujet, signaux, actions
   détectées, relance proposée.
3. **Questions complémentaires : 3 max**, priorisées (date de relance en
   premier), posées une par une, réponse vocale ou passage d'un tap, « passer
   tout » visible dès la première. Champs non renseignés = « non évoqué ».
4. **Relance par défaut** : si aucune date dictée ni donnée → +1 mois, marquée
   `auto` (badge visible partout).
5. Pièces jointes optionnelles : photo de carte de visite, capture d'email,
   texte collé → extraction coordonnées (nom, fonction, tel, email, entité)
   proposée pour validation.
6. Édition manuelle libre de tous les champs sur la carte.
7. **Rien ne part en base sans « Valider »** du membre.

### Rattachement (entités ET opérations, même logique)

- Correspondance unique en base → rattachement automatique affiché.
- Zéro ou plusieurs correspondances → proposition en un tap (« rattacher à X ? /
  créer nouveau ? »).
- Le référentiel existant sert de dictionnaire : une transcription approximative
  (« sig », « du jardin ») se rattache par similarité à SIGH / Dujardin au lieu
  de créer un doublon.
- **Création d'une nouvelle entité/contact** : vérification orthographique
  explicite (« J'ai compris SIGH — c'est bien ça ? ») avant création. Les noms
  propres sont le principal risque de transcription.

### Actions détectées (liste typée, pas un champ unique)

Une vocale peut produire plusieurs actions de types différents :

- relance d'un contact/entité (datée),
- relance d'une opération (datée),
- action interne (ex. « vérifier les AO en cours concernant X »),
- tâche assignée à un autre membre (« Maxence rappelle le bailleur ») —
  confirmée sur la carte de validation, puis notifiée à l'assigné,
- action sans date (ex. « inviter aux prochains événements ») — rangée sur la
  fiche entité, sans échéance.

### Cas d'erreur

- IA se trompe d'entité/opération → correction sur la carte avant validation
  (tap sur le champ → liste/recherche).
- Erreur découverte après validation → le membre édite son propre CR ; les
  objets créés à tort (entité doublon) sont fusionnables par un pilote.
- Transcription échouée/inaudible → l'audio est conservé, le membre peut
  réécouter, re-dicter ou saisir au formulaire.
- Vocale enchaînée sur une relance (« Fait » + micro) → crée un nouveau CR
  pré-rattaché à l'entité/opération de la relance.

### Saisie conventionnelle (v1)

Formulaires complets de création/édition : CR, entité, contact, opération,
relance, tâche. Mobile et desktop.

## 4. Modèle de données (Supabase)

Relations clés : **une opération peut avoir plusieurs entités (N-N)** —
plusieurs portes d'entrée sur une même affaire. Le **statut est porté par
l'opération**, jamais par le couple entité-opération.

```
organisations   id, nom, logo                          -- neutre, prêt multi-tenant
utilisateurs    id, org_id, nom, email, societe_label, role (membre|pilote), actif
entites         id, org_id, nom, type (MOA|archi|promoteur|confrère|autre),
                ville, notes, statut_vie (actif|dormant), created_by
contacts        id, entite_id, nom, prenom, fonction, tel, email, source (vocal|carte|manuel)
operations      id, org_id, nom, description,
                statut (contact|qualifie|ao_attente|offre_remise|nego|gagne|perdu),
                montant_estime (nullable, jamais requis), referent_id, raison_perte (nullable)
entite_operation  entite_id, operation_id, role_entree (texte libre)
crs             id, org_id, auteur_id, date_rdv, type_rdv (dejeuner|appel|visite|salon|autre),
                audio_url (nullable), transcription, synthese (jsonb),
                statut (brouillon|valide)
cr_entites      cr_id, entite_id
cr_operations   cr_id, operation_id
pieces          id, cr_id, type (photo|capture|texte), url/contenu, extraction (jsonb)
relances        id, org_id, assignee_id, entite_id (nullable), operation_id (nullable),
                cr_origine_id (nullable), objet, date_echeance, auto (bool),
                statut (a_faire|faite|reportee|abandonnee), raison_abandon,
                cr_resultat_id (nullable)   -- le CR créé par la vocale enchaînée
```

Notes :

- `synthese` (jsonb) conserve la structure extraite (sujet, signaux,
  interlocuteurs, actions) — la vérité éditable reste dans les tables.
- Alerte silence = calculée (dernier CR ou relance faite sur l'entité > 60
  jours), pas stockée.
- Tâche assignée = une `relance` avec `assignee_id` ≠ auteur du CR. Pas de table
  séparée.

## 5. Règles d'automatisation et modes d'échec

| Automatisme | Règle | Mode d'échec / correction |
|---|---|---|
| Transcription | Whisper, français | Audio conservé ; réécoute, re-dictée ou formulaire |
| Rattachement entité/opération | Auto si match unique, sinon proposition 1 tap | Éditable sur la carte avant validation ; fusion de doublons par pilote |
| Orthographe noms propres | Dictionnaire = référentiel existant ; confirmation explicite à la création | Édition manuelle avant push |
| Extraction champs | « Non évoqué » si absent — jamais d'invention | Édition manuelle |
| Questions complémentaires | 3 max, priorisées, passables, « passer tout » | Passer tout = acceptable |
| Relance par défaut | +1 mois si non spécifiée, badge `auto` | Reporter/éditer en 2 taps |
| Alerte silence | Entité sans contact depuis 2 mois → vue COPIL | Le pilote décide : relancer ou classer dormant |
| Tâche assignée | Détectée en vocale, confirmée par l'auteur avant push | L'assigné peut reporter/refuser (abandon avec raison) |
| Extraction coordonnées (pièces) | Proposée, jamais poussée sans validation | Édition manuelle |

### Notifications (les seules de l'outil)

- **Email quotidien individuel**, uniquement les jours avec relances (du jour +
  en retard), avec boutons d'action.
- **Invitation .ics** envoyée à la création/report de chaque relance → se pose
  dans l'agenda sans OAuth.
- 1 relance = 1 seule personne notifiée (l'assigné). Le collectif consulte dans
  l'outil.
- Pas de récap hebdo poussé (décision actée) ; le récap est la vue COPIL,
  consultable à la demande.
- WhatsApp Business : hors périmètre, toutes versions.

### Actions vers le prospect (v1)

Sur carte relance, fiche contact et email quotidien : boutons `tel:`,
`wa.me/`, `mailto:` si coordonnées captées.

## 6. Écrans

Références : maquettes `pulz-suivi-commercial-mockup.html` (mobile) et
`pulz-suivi-commercial-desktop.html`. Écarts décidés depuis :

**Mobile (PWA)** — conforme maquette + ajouts :

- Flux questions complémentaires (3 max) après la synthèse.
- Bouton « + Ajouter une pièce » (photo/capture/texte) sur la carte de
  validation.
- Gestes relance : Fait (+ vocale enchaînable), Reporter, Abandonner.
- Boutons tel/WhatsApp/email sur les cartes.
- Sélecteur de profil (première ouverture) + menu changer d'utilisateur.
- Formulaires de saisie conventionnelle.

**Desktop** — écarts vs maquette :

- Kanban par **opération** (colonnes = 7 statuts dont AO attente et Perdu) ; les
  cartes listent les entités portes d'entrée.
- **Supprimer** : KPI « pipe pondéré », colonne valeur triable mise en avant,
  probabilité. Le montant reste visible sur la fiche opération s'il existe, sans
  plus.
- KPI v1 : opérations actives par statut, relances en retard, alertes silence,
  RDV du mois.
- Annuaire réseau : entités sans opération, avec leurs relances et alerte
  silence.
- Fiche opération : statut, référent, entités liées, timeline des CR, relances,
  planification d'un RDV.
- Bouton **Exporter** (Word/PDF) : état du commerce — opérations par statut +
  prochaine action, retards, silences, annuaire. Page de garde sobre. Pattern
  docx client-side de PULZ-AO/ACT.

## 7. Architecture technique et coûts

- **Supabase** : Postgres (schéma §4), Auth lien magique, Storage (audio +
  pièces). Précédent interne : outil CCTP.
- **Vercel** : hébergement PWA + serverless (`/api/claude` proxy — pattern
  PULZ-AO ; `/api/transcribe` ; cron quotidien emails ; génération .ics).
- **Claude API — Sonnet partout** (extraction/synthèse, pas de rédaction
  longue : Opus inutile). Prompts : vocabulaire neutre, principe « jamais
  d'invention », auto-checklist (héritages PULZ-AO/ACT).
- **Whisper API** (ou équivalent) pour la transcription.
- **Resend** (ou équivalent) pour emails + .ics.
- PWA : manifest + service worker. MediaRecorder pour la captation.

**Coûts récurrents estimés** (50 vocales de 2 min/mois, hypothèses explicites,
**à vérifier au dev — tarifs mouvants**) :

- Transcription : ~100 min/mois × ~0,006 $/min ≈ **< 1 €/mois**.
- Claude Sonnet (synthèses, extractions, questions, lecture pièces) : ≈ **2-5
  €/mois**.
- Resend : gratuit à ce volume. Supabase : plan gratuit probablement suffisant
  en v1 ; prévoir ~25 $/mois si dépassement storage audio.
- Total ordre de grandeur : **< 10 €/mois pour 10 utilisateurs**. Négligeable.

## 8. Lotissement

**Critère v1 : utilisable en réel par les 10 en 3 semaines de dev max.**

### V1 — le cœur

PWA installable · auth lien magique + profil mémorisé + changement
d'utilisateur · vocal → transcription → synthèse → 3 questions max →
validation/édition → push · rattachement entités/opérations (auto + proposition
+ confirmation orthographique à la création) · pièces jointes
photo/capture/texte avec extraction coordonnées · saisie conventionnelle
complète · actions typées + tâches assignées · relances (défaut +1 mois badge
auto, Fait/Reporter/Abandonner, vocale enchaînée) · email quotidien individuel +
.ics · boutons tel/WhatsApp/email · desktop : kanban opérations, retards,
alertes silence 2 mois, annuaire réseau, fiches, fusion de doublons (pilote) ·
export Word.

### V2

Transfert d'email entrant (`constat@…`) avec parsing et rattachement · OAuth
agenda Google/Outlook (synchro réelle, remplace/complète le .ics) · affinage vue
COPIL d'après l'usage réel · statistiques d'activité par membre · fiabilisations
issues du terrain.

### V3

Pont module AO (« quels AO en cours concernent cette entité ») · préparation
multi-tenant / marque blanche moeïa · ce que l'usage réclamera.

**Sortie de v1** = les 10 utilisateurs ont chacun poussé au moins une vocale
réelle et reçu au moins un email de relance. **Sortie de v2** = un mois d'usage
sans contournement papier/Excel constaté.

## 9. Checklist « à vérifier avant / pendant le dev »

- [x] **MediaRecorder en PWA sur iOS Safari** : captation fiable, formats (webm
  vs mp4), comportement écran verrouillé, reprise après interruption (appel
  entrant). Tester sur l'iPhone de Sylvain AVANT d'écrire le reste. C'est le
  risque n°1 du projet.
  **→ VALIDÉ le 21/07/2026** (test sur iPhone, Safari) : l'enregistrement
  **continue écran verrouillé**, son **complet** à la réécoute. Aucune parade UX
  « ne pas verrouiller » nécessaire. Risque n°1 levé. (Banc de test :
  `maquettes/suivi-commercial/test-micro.html` et `index.html`.)
- [ ] Qualité Whisper en conditions réelles : resto bruyant, voiture, sigles
  français (SIGH), noms propres du Nord. Test avec de vraies vocales des
  collaborateurs.
- [ ] Tarifs exacts et à jour : Whisper (ou alternative), Sonnet, Supabase
  (storage audio), Resend.
- [ ] Compatibilité .ics : l'invitation s'affiche-t-elle proprement dans Outlook
  ET Google Calendar (les collaborateurs sont probablement sur les deux) ?
- [ ] Lien magique Supabase : friction réelle sur mobile (ouverture du mail sur
  le même appareil), fallback si email pro filtré.
- [ ] Délivrabilité des emails quotidiens (SPF/DKIM sur le domaine expéditeur).
- [ ] Taille/rétention des audios : conserver combien de temps ? (proposition :
  6 mois puis purge, transcription conservée à vie — à valider avec Sylvain au
  dev).
- [ ] RGPD : données de contacts de tiers (prospects) — mentions et droit
  d'accès à prévoir, a minima une page « données » dans l'outil.

---

*Décisions closes. Toute question qui surgirait au dev et ne trouve pas sa
réponse ici doit être tranchée dans l'esprit des trois piliers du §1, dans cet
ordre.*
