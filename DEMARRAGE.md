# Démarrage — brancher le vrai outil (Vercel + Supabase)

> Fiche pas-à-pas pour créer les comptes et coller les clés. Rédigée pour être
> suivie sans être développeur. Comptez ~30 minutes.
>
> **Règle de sécurité, la seule qui compte :** les clés secrètes se collent
> **uniquement** dans Supabase et dans Vercel. **Jamais** dans le projet (le
> code), **jamais** dans un message. Un garde-fou (`.gitignore`) empêche déjà
> tout fichier de clés de partir dans le projet.

## 1. Supabase — le rangement des données

1. Créer un **nouveau projet** Supabase (ou réutiliser l'organisation des autres
   outils). Noter le mot de passe de la base.
2. Créer les tables : ouvrir **SQL Editor**, coller **tout** le contenu de
   `supabase/migrations/0001_init.sql`, cliquer **Run**.
3. (Optionnel, pour tester) coller ensuite `supabase/seed.sql` et **Run** :
   ça remplit des prospects et affaires d'exemple.
4. Récupérer 3 valeurs : dans le menu de gauche, **Settings** puis **API Keys**
   (et, pour l'URL, **Settings → General** → « Project ID », l'URL est
   `https://<project-id>.supabase.co`) :
   - **Project URL**
   - clé **anon** / **Publishable key** (public)
   - clé **service_role** / **Secret key** (⚠️ secrète)

   Note : à la création des tables, Supabase propose « Run and enable RLS » —
   accepter (voir la sécurité RLS dans `0001_init.sql`).

## 2. Les deux clés d'intelligence

- **Claude (le cerveau)** : créer une clé sur la console Anthropic → une clé
  commençant par `sk-ant-…`.
- **Whisper (l'oreille, voix → texte)** : créer une clé sur la console OpenAI (ou
  l'équivalent qu'on retiendra) → une clé `sk-…`.

*(La clé d'envoi d'emails — Resend — ne sera utile que pour les relances
quotidiennes, plus tard. On la mettra en son temps.)*

## 3. Vercel — mettre l'outil en ligne

1. **Connecter** le dépôt GitHub `pulz-outil-suivi-commercial` à un projet Vercel
   (comme les autres outils).
2. **Root Directory** : laisser vide — l'application est à la racine du dépôt.
3. Dans **Settings → Environment Variables**, coller **toutes** les clés des
   étapes 1 et 2, en reprenant **exactement** les noms listés dans
   `.env.example` (par ex. `NEXT_PUBLIC_SUPABASE_URL`, `ANTHROPIC_API_KEY`…).

## 4. Activer la connexion des utilisateurs (lien magique)

L'outil demande maintenant une **connexion par e-mail** : chaque personne saisit
son adresse et reçoit un **lien** pour entrer, sans mot de passe.

1. **Autoriser l'adresse de retour** dans Supabase : menu **Authentication → URL
   Configuration**.
   - **Site URL** = l'adresse de l'outil en ligne (ex. `https://suivi-commercial.vercel.app`).
   - **Redirect URLs** : ajouter `https://<adresse-de-l-outil>/auth/callback`
     (et, si tu testes en local, `http://localhost:3000/auth/callback`).
2. **Déclarer les personnes autorisées.** Seules les adresses présentes dans la
   table `utilisateurs` peuvent entrer (les autres reçoivent « accès non
   autorisé »). Pour ajouter quelqu'un : **SQL Editor**, puis (en adaptant) :
   ```sql
   insert into utilisateurs (org_id, nom, email, role)
   values ((select id from organisations limit 1), 'Prénom Nom', 'prenom@societe.fr', 'membre');
   ```
   Le rôle est soit `membre`, soit `pilote`.
3. C'est tout : la personne va sur l'outil, saisit son adresse, clique sur le
   lien reçu par e-mail, et elle est connectée.

*(Astuce : au tout début, Supabase envoie les e-mails via son propre expéditeur,
suffisant pour démarrer. Pour un envoi à ton nom de domaine, on branchera un
service d'e-mail dédié plus tard — même étape que les relances.)*

## Ce dont j'ai besoin de toi, ensuite

Rien de secret. Juste **un mot quand c'est prêt** — et, si tu veux que je teste
de mon côté, les deux valeurs **publiques** de Supabase (Project URL + clé
**anon**). Les clés **secrètes** (`service_role`, Claude, Whisper) restent chez
toi, dans Vercel : je n'en ai jamais besoin en clair, le code les lit tout seul
depuis les réglages.

## Récapitulatif des réglages

Voir `.env.example` — la liste exacte des noms à renseigner.
