-- contact_operation — N-N : une personne (contact) peut être LE contact d'une
-- ou plusieurs opérations précises (« Rémi Thierry est le contact des affaires
-- de Roncq et d'Armentières »). Distinct du rattachement structure↔opération :
-- ici on associe une PERSONNE à une AFFAIRE, pour la voir en signet sur la fiche
-- opération et l'utiliser dans les relances.

create table if not exists contact_operation (
  contact_id   uuid not null references contacts(id) on delete cascade,
  operation_id uuid not null references operations(id) on delete cascade,
  primary key (contact_id, operation_id)
);

create index if not exists idx_contact_operation_op on contact_operation(operation_id);

alter table contact_operation enable row level security;
