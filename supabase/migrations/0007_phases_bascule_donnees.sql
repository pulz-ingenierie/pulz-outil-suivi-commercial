-- Phases v2 — ÉTAPE 2 : basculer les opérations existantes vers les nouvelles
-- étapes. À exécuter APRÈS l'étape 1 (0006) — dans une exécution séparée, car
-- Postgres n'autorise pas l'usage d'une valeur d'enum ajoutée dans la même
-- transaction que son ajout.
--
--   contact    → piste
--   ao_attente → qualifie
--
-- Les anciennes valeurs (contact, ao_attente) restent dans le type mais ne sont
-- plus utilisées ni proposées par l'outil.

update operations set statut = 'piste' where statut = 'contact';
update operations set statut = 'qualifie' where statut = 'ao_attente';

-- Nouvelle valeur par défaut pour toute nouvelle opération.
alter table operations alter column statut set default 'piste';
