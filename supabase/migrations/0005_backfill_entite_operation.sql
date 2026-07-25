-- Rattrapage : relie structure ⇄ opération pour tous les comptes rendus déjà
-- enregistrés. Jusqu'ici, un compte rendu qui créait à la fois une structure et
-- une opération ne les liait pas entre elles (seulement au compte rendu). Cette
-- requête crée le lien manquant à partir des rattachements existants.
--
-- Sans effet sur les liens déjà présents (on conflict do nothing).
-- À exécuter une fois dans Supabase → SQL Editor.

insert into entite_operation (entite_id, operation_id)
select distinct ce.entite_id, co.operation_id
from cr_entites ce
join cr_operations co on co.cr_id = ce.cr_id
on conflict (entite_id, operation_id) do nothing;
