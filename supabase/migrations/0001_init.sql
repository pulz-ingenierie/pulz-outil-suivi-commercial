-- =============================================================================
-- Module Suivi commercial (moeïa) — Schéma initial
-- Source : docs/cadrage-suivi-commercial.md §4 (validé CTO, D5 du 21/07/2026).
-- Base : PostgreSQL (Supabase).
--
-- Isolation multi-tenant : par `org_id` + contrôle applicatif (décision D5,
-- répond au point OUVERT 2). `org_id` est présent sur toutes les tables racines
-- pour préparer le multi-organisation. En complément, RLS (Row Level Security)
-- est activé en filet de sécurité (deny par défaut, voir fin de fichier) :
-- l'accès applicatif passe par la clé serveur (service_role), qui outrepasse RLS ;
-- aucune donnée n'est accessible via la clé publique tant qu'aucune policy
-- n'est écrite. Cohérent avec le principe « pas de données derrière une URL nue ».
--
-- Vocabulaire neutre partout (« organisation », jamais PULZ en dur).
-- Couleurs/valeurs : aucune valeur d'affichage en dur ici (données seulement).
-- =============================================================================

create extension if not exists "pgcrypto";  -- pour gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Types énumérés (listes fermées du cadrage §4)
-- -----------------------------------------------------------------------------
create type utilisateur_role as enum ('membre', 'pilote');
create type entite_type      as enum ('MOA', 'archi', 'promoteur', 'confrere', 'autre');
create type entite_statut_vie as enum ('actif', 'dormant');
create type contact_source   as enum ('vocal', 'carte', 'manuel');
create type operation_statut as enum ('contact', 'qualifie', 'ao_attente', 'offre_remise', 'nego', 'gagne', 'perdu');
create type cr_type_rdv      as enum ('dejeuner', 'appel', 'visite', 'salon', 'autre');
create type cr_statut        as enum ('brouillon', 'valide');
create type piece_type       as enum ('photo', 'capture', 'texte');
create type relance_statut   as enum ('a_faire', 'faite', 'reportee', 'abandonnee');

-- -----------------------------------------------------------------------------
-- Fonction utilitaire : mise à jour automatique de updated_at
-- -----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- organisations — un tenant. En v1, une seule (le groupement).
-- -----------------------------------------------------------------------------
create table organisations (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null,
  logo       text,                         -- référence stockage objet, jamais le binaire
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- utilisateurs — membres de l'organisation. Deux rôles (membre|pilote).
-- societe_label = simple étiquette informative (pas de cloisonnement, D5).
-- -----------------------------------------------------------------------------
create table utilisateurs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  nom           text not null,
  email         text not null,
  societe_label text,
  role          utilisateur_role not null default 'membre',
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (org_id, email)
);

-- -----------------------------------------------------------------------------
-- entites — prospects / partenaires (MOA, archi, promoteur, confrère…).
-- -----------------------------------------------------------------------------
create table entites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  nom         text not null,
  type        entite_type not null default 'autre',
  ville       text,
  notes       text,
  statut_vie  entite_statut_vie not null default 'actif',
  created_by  uuid references utilisateurs(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- contacts — personnes rattachées à une entité.
-- -----------------------------------------------------------------------------
create table contacts (
  id         uuid primary key default gen_random_uuid(),
  entite_id  uuid not null references entites(id) on delete cascade,
  nom        text not null,
  prenom     text,
  fonction   text,
  tel        text,
  email      text,
  source     contact_source not null default 'manuel',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- operations — les affaires. Le STATUT est porté ici (jamais par le lien
-- entité-opération). montant_estime facultatif, jamais requis (cadrage §1).
-- -----------------------------------------------------------------------------
create table operations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  nom            text not null,
  description    text,
  statut         operation_statut not null default 'contact',
  montant_estime numeric(14,2),            -- nullable, accessoire
  referent_id    uuid references utilisateurs(id) on delete set null,
  raison_perte   text,                     -- renseigné seulement si statut = perdu
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- entite_operation — N-N : une opération a plusieurs entités (portes d'entrée).
-- role_entree : texte libre (« bailleur », « archi mandataire »…).
-- -----------------------------------------------------------------------------
create table entite_operation (
  entite_id    uuid not null references entites(id) on delete cascade,
  operation_id uuid not null references operations(id) on delete cascade,
  role_entree  text,
  created_at   timestamptz not null default now(),
  primary key (entite_id, operation_id)
);

-- -----------------------------------------------------------------------------
-- crs — comptes rendus de RDV. audio_url nullable (audio en stockage objet).
-- synthese jsonb = structure extraite par l'IA ; la vérité éditable reste dans
-- les tables. Rien n'est visible tant que statut != 'valide' (cadrage §3).
-- -----------------------------------------------------------------------------
create table crs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  auteur_id     uuid references utilisateurs(id) on delete set null,
  date_rdv      date not null default current_date,
  type_rdv      cr_type_rdv not null default 'autre',
  audio_url     text,
  transcription text,
  synthese      jsonb,
  statut        cr_statut not null default 'brouillon',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table cr_entites (
  cr_id     uuid not null references crs(id) on delete cascade,
  entite_id uuid not null references entites(id) on delete cascade,
  primary key (cr_id, entite_id)
);

create table cr_operations (
  cr_id        uuid not null references crs(id) on delete cascade,
  operation_id uuid not null references operations(id) on delete cascade,
  primary key (cr_id, operation_id)
);

-- -----------------------------------------------------------------------------
-- pieces — pièces jointes d'un CR (photo carte de visite, capture, texte).
-- contenu : texte collé le cas échéant ; url : référence stockage objet.
-- extraction jsonb : coordonnées proposées par l'IA, avant validation.
-- -----------------------------------------------------------------------------
create table pieces (
  id         uuid primary key default gen_random_uuid(),
  cr_id      uuid not null references crs(id) on delete cascade,
  type       piece_type not null,
  url        text,
  contenu    text,
  extraction jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- relances — relances ET tâches assignées (une tâche = une relance dont
-- assignee_id != auteur du CR). entite_id / operation_id nullables (une relance
-- porte sur l'un, l'autre, ou une action interne). auto = relance par défaut
-- (+1 mois). cr_resultat_id = le CR créé par la vocale enchaînée (« Fait »).
-- -----------------------------------------------------------------------------
create table relances (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  assignee_id   uuid references utilisateurs(id) on delete set null,
  entite_id     uuid references entites(id) on delete set null,
  operation_id  uuid references operations(id) on delete set null,
  cr_origine_id uuid references crs(id) on delete set null,
  objet         text not null,
  date_echeance date not null,
  auto          boolean not null default false,
  statut        relance_statut not null default 'a_faire',
  raison_abandon text,
  cr_resultat_id uuid references crs(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Index (filtrage courant : par organisation, échéances, statuts, rattachements)
-- -----------------------------------------------------------------------------
create index idx_utilisateurs_org      on utilisateurs(org_id);
create index idx_entites_org           on entites(org_id);
create index idx_contacts_entite       on contacts(entite_id);
create index idx_operations_org        on operations(org_id);
create index idx_operations_statut     on operations(statut);
create index idx_operations_referent   on operations(referent_id);
create index idx_entite_operation_op   on entite_operation(operation_id);
create index idx_crs_org               on crs(org_id);
create index idx_crs_auteur            on crs(auteur_id);
create index idx_crs_date              on crs(date_rdv);
create index idx_pieces_cr             on pieces(cr_id);
create index idx_relances_org          on relances(org_id);
create index idx_relances_assignee     on relances(assignee_id);
create index idx_relances_echeance     on relances(date_echeance);
create index idx_relances_statut       on relances(statut);
create index idx_relances_entite       on relances(entite_id);
create index idx_relances_operation    on relances(operation_id);

-- -----------------------------------------------------------------------------
-- Déclencheurs updated_at
-- -----------------------------------------------------------------------------
create trigger trg_entites_updated    before update on entites    for each row execute function set_updated_at();
create trigger trg_operations_updated before update on operations for each row execute function set_updated_at();
create trigger trg_crs_updated        before update on crs        for each row execute function set_updated_at();
create trigger trg_relances_updated   before update on relances   for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- Notes de conception (encodées en commentaires pour les mainteneurs)
-- -----------------------------------------------------------------------------
comment on table  operations           is 'Affaire. Le statut est porté par l''opération, jamais par le lien entité-opération.';
comment on column operations.montant_estime is 'Facultatif, jamais requis, jamais central (pilotage par opération, pas par euro).';
comment on table  entite_operation     is 'N-N : plusieurs entités (portes d''entrée) sur une même opération.';
comment on column crs.synthese         is 'Structure IA extraite (sujet, signaux, interlocuteurs, actions). La vérité éditable reste dans les tables.';
comment on table  relances             is 'Relances et tâches assignées (tâche = relance dont assignee_id != auteur du CR). Alerte silence = calculée, non stockée.';

-- -----------------------------------------------------------------------------
-- Row Level Security — filet de sécurité (deny par défaut)
-- Activé sur toutes les tables. Aucune policy en v1 : l'accès applicatif passe
-- par la clé serveur (service_role), qui outrepasse RLS. La clé publique (anon)
-- ne peut donc rien lire ni écrire. Des policies seront ajoutées le jour où un
-- accès direct depuis le navigateur (clé anon) deviendra nécessaire.
-- -----------------------------------------------------------------------------
alter table organisations    enable row level security;
alter table utilisateurs     enable row level security;
alter table entites          enable row level security;
alter table contacts         enable row level security;
alter table operations       enable row level security;
alter table entite_operation enable row level security;
alter table crs              enable row level security;
alter table cr_entites       enable row level security;
alter table cr_operations    enable row level security;
alter table pieces           enable row level security;
alter table relances         enable row level security;
