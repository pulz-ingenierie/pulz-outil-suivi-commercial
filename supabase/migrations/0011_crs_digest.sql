-- Récapitulatif quotidien des comptes rendus (envoi de fin de journée).
--
-- On marque chaque compte rendu au moment où il part dans un e-mail, plutôt que
-- de se fier à une fenêtre de temps. Deux bénéfices :
--   1. IDEMPOTENCE : si la tâche se déclenche deux fois, personne ne reçoit le
--      même compte rendu deux fois.
--   2. RATTRAPAGE : si un envoi échoue (panne, clé e-mail absente), les comptes
--      rendus concernés partent dans le récapitulatif suivant au lieu d'être
--      perdus.
--
-- À exécuter dans Supabase → SQL Editor (copier-coller, puis « Run »).

alter table crs add column if not exists digest_envoye_at timestamptz;

-- Sélection courante : « les comptes rendus validés jamais envoyés ».
create index if not exists idx_crs_digest_en_attente
  on crs (org_id, statut)
  where digest_envoye_at is null;

comment on column crs.digest_envoye_at is
  'Date d''envoi dans le récapitulatif quotidien. NULL = pas encore envoyé.';
