# Point d'état — module Suivi commercial (moeïa)

> Mis à jour le 23/07/2026. Document de reprise : il doit permettre de
> **redéployer le projet ailleurs sans assistance**. Écrit en français simple ;
> les termes techniques indispensables sont définis à leur première apparition.

- **Dépôt :** `pulz-ingenierie/pulz-outil-suivi-commercial` (dépôt dédié à cet outil).
- **Emplacement de l'application :** **à la racine du dépôt** (code source dans
  `src/`, base de données dans `supabase/`, documentation dans `docs/`).
- **Réglage de déploiement clé :** sur Vercel, **Root Directory = laisser vide (racine)**.
- **Origine :** développé initialement dans le monorepo `yohanaspra/MOEAI`
  (dossier `maquettes/suivi-commercial/app/`), puis transféré ici à la racine.

---

## 1. Ce qui est fait

- **Base de données** (11 tables) : organisations, utilisateurs, entités,
  contacts, opérations, liens entité-opération, comptes rendus, pièces,
  relances. Script de création `supabase/migrations/0001_init.sql` +
  jeu de test `supabase/seed.sql`.
- **Connexion des utilisateurs** par lien magique (e-mail, sans mot de passe).
  Distingue l'authentification (prouver l'e-mail) de l'autorisation (l'e-mail
  doit exister dans la table `utilisateurs`). Barre supérieure avec nom + bouton
  de déconnexion. Toutes les pages sont protégées.
- **Tableau de bord** : indicateurs (opérations actives, relances en retard / à
  faire, contacts à réchauffer) + pipeline des affaires en 7 étapes.
- **Fiche opération** : repères, entités « portes d'entrée », fil des comptes
  rendus, prochaines relances. Modification possible (étape, montant, référent…).
- **Réseau** : annuaire des entités, alertes « à réchauffer » (silence > 2 mois).
- **Comptes rendus** : saisie manuelle **et** dictée vocale
  (micro → transcription → synthèse IA structurée → relecture et validation).
- **Relances** : page regroupée (en retard / aujourd'hui / à venir), actions
  « faite / reporter / abandonner », création manuelle, et création automatique
  à partir des suites proposées par l'IA.
- **E-mails de relance** : mécanique complète en place — récapitulatif quotidien
  envoyé à chaque responsable (tâche automatique programmée chaque matin en
  semaine), plus un bouton d'envoi manuel pour les pilotes. **Ne s'active qu'une
  fois la clé Resend renseignée** ; sans elle, rien n'est envoyé (aucune erreur).

## 2. Ce qui reste

- **Écran d'administration des utilisateurs** (ajouter / désactiver un membre
  sans passer par le code) — *en cours*.
- **Activer l'envoi des e-mails de relance** : la mécanique est faite, il ne
  manque que la clé Resend (+ `RELANCE_EMAIL_FROM` et `CRON_SECRET`) pour l'allumer.
- **Stockage de l'audio** des dictées (aujourd'hui la voix sert à la
  transcription puis n'est pas conservée).
- **Bascule** vers le dépôt `pulz-ingenierie`.
- **Points d'architecture encore ouverts** (voir `docs/decisions.md`) : mode
  d'isolation multi-organisations à durcir le jour où il y aura plusieurs
  clients.

---

## 3. Variables d'environnement (réglages)

> **Ce sont des réglages, pas du code.** Ils se saisissent dans **Vercel**
> (Settings → Environment Variables) pour la mise en ligne, et dans un fichier
> `.env.local` (jamais versionné) pour un essai en local. La liste des **noms**
> vit aussi dans `.env.example`. **Aucune valeur réelle** ne doit être écrite
> dans le projet ni dans un message.
>
> Convention : un nom qui commence par `NEXT_PUBLIC_` est **public** (lisible par
> le navigateur) ; tous les autres sont **secrets** (serveur uniquement).

### Supabase — rangement des données, comptes, fichiers

| Nom | Public/Secret | Requis | Rôle |
|-----|---------------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | public | **oui** | Adresse du projet Supabase (`https://<id>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | **oui** | Clé « anon » / « publishable ». Sert à la **connexion** (envoi du lien magique) côté navigateur. |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | **oui** | Clé « service_role » / « secret ». Accès serveur aux données. **Ne jamais exposer.** |

### Anthropic (Claude) — synthèse et extraction IA

| Nom | Public/Secret | Requis | Rôle |
|-----|---------------|--------|------|
| `ANTHROPIC_API_KEY` | secret | **oui** (pour la synthèse IA) | Clé d'accès à Claude. Sans elle, la dictée reste transcrite mais non synthétisée. |
| `ANTHROPIC_MODEL` | (réglage) | non | Modèle utilisé. Défaut : `claude-sonnet-5`. À laisser tel quel sauf raison précise. |

### Whisper (OpenAI) — transcription voix → texte

| Nom | Public/Secret | Requis | Rôle |
|-----|---------------|--------|------|
| `OPENAI_API_KEY` | secret | pour la dictée vocale | Transcrit l'audio du micro en texte. Sans elle, on saisit le compte rendu à la main (tout le reste fonctionne). |
| `OPENAI_WHISPER_MODEL` | (réglage) | non | Modèle de transcription. Défaut : `whisper-1`. |

### Resend — envoi des e-mails de relance *(brique à venir)*

| Nom | Public/Secret | Requis | Rôle |
|-----|---------------|--------|------|
| `RESEND_API_KEY` | secret | pour l'envoi d'e-mails | Service qui expédie les e-mails de relance. Inutile tant que cette brique n'est pas activée. |
| `RELANCE_EMAIL_FROM` | (réglage) | avec Resend | Adresse expéditrice des relances (ex. `commercial@votre-domaine.fr`). |
| `CRON_SECRET` | secret | avec Resend | Protège la tâche d'envoi automatique (une longue valeur aléatoire). Vercel l'ajoute lui-même à l'appel programmé du matin. |

### Divers

| Nom | Public/Secret | Requis | Rôle |
|-----|---------------|--------|------|
| `NEXT_PUBLIC_APP_URL` | public | non | Adresse publique de l'outil. Renseignée automatiquement par Vercel ; utile pour construire des liens. |

**Minimum pour un déploiement qui tourne :** les 3 clés Supabase + `ANTHROPIC_API_KEY`.
Ajouter `OPENAI_API_KEY` pour la dictée vocale, puis Resend quand on activera les
e-mails de relance.

---

## 4. Étapes pour redéployer ailleurs (résumé)

1. **Supabase** : créer un projet, exécuter `supabase/migrations/0001_init.sql`
   (option « Run and enable RLS »), éventuellement `supabase/seed.sql`.
   Puis, pour la connexion : **Authentication → URL Configuration**, renseigner
   *Site URL* et ajouter `<adresse-de-l-outil>/auth/callback` aux *Redirect URLs*.
2. **Déclarer les utilisateurs autorisés** dans la table `utilisateurs` (nom +
   e-mail + rôle `membre`/`pilote`).
3. **Vercel** : connecter le dépôt, **Root Directory = laisser vide (racine)**, coller les
   variables ci-dessus (au minimum le bloc « minimum » ci-dessus).
4. Voir `/DEMARRAGE.md` pour le pas-à-pas détaillé.
