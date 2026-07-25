-- Ajoute la personne concernée par une relance (rappel), stockée comme libellé.
-- Le rappel devient ainsi associable à un signet « personne », au lieu de mêler
-- le nom de la personne dans l'objet (« Maxence doit… »).
--
-- À exécuter dans Supabase → SQL Editor (copier-coller, puis « Run »).

alter table relances add column if not exists personne text;
