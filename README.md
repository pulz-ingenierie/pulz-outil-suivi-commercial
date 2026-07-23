# app/ — Le SaaS

Code de l'application. Premier chantier en cours : **module Suivi commercial
(moeïa)**, V1, d'après `docs/suivi-commercial/cadrage.md` (validé — décision D5).

## Où en est-on

| Brique | État |
|---|---|
| Base de données (rangement des informations) | ✅ posée et testée (`supabase/`) |
| Ossature de l'app + écrans | à venir |
| Enregistrement vocal → synthèse IA | à venir |
| Emails de relance + invitations agenda | à venir |

## `supabase/` — la base de données

- `migrations/0001_init.sql` — la structure : prospects (entités), contacts,
  opérations, comptes rendus, relances, pièces jointes. Fidèle au §4 du cadrage.
- `seed.sql` — un jeu de données **fictif** (vocabulaire neutre) pour tester
  l'outil sans rien saisir : un groupement, 4 utilisateurs, 4 entités, 5
  opérations (dont une gagnée et une perdue), un compte rendu, 4 relances (dont
  une automatique, une tâche assignée, une en retard).

Ces deux fichiers respectent la discipline **D4** (migrations versionnées + jeu
de test), ce qui rend tout nouvel environnement utilisable immédiatement.

### Principes de conception encodés ici

- **Le statut est porté par l'opération**, jamais par le lien entité-opération.
- Une opération peut avoir **plusieurs entités** (portes d'entrée) — relation N-N.
- Le **montant est facultatif** et jamais central (pilotage par opération).
- L'**alerte silence** et les **retards** sont **calculés à la demande**, jamais
  stockés (vérifié : requêtes de pilotage fonctionnelles).
- Isolation par `org_id` + **contrôle applicatif** (décision D5) : l'accès aux
  données passe par le serveur, jamais par une clé côté navigateur. Aucun secret
  n'est stocké dans le code.

### Vérifié

Schéma + jeu de test appliqués sur PostgreSQL : installation sans erreur,
rechargement rejouable (idempotent), et requêtes de pilotage (relances en
retard, opération multi-entités, alerte silence) correctes.

### Appliquer en local (pour un développeur)

```bash
# via le CLI Supabase (recommandé) : db reset applique migrations puis seed
supabase db reset

# ou à la main sur une base PostgreSQL :
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```
