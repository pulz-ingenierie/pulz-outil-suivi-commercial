-- Une personne peut désormais exister SANS structure de rattachement (ex. un
-- collègue responsable d'une relance, une personne citée sans son organisation).
-- Cela permet à toute personne évoquée de devenir une fiche (carte) cliquable,
-- conformément au principe carte ⇄ signet.
--
-- À exécuter dans Supabase → SQL Editor (copier-coller, puis « Run »).

alter table contacts alter column entite_id drop not null;
