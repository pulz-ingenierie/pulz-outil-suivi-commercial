-- Ajoute le type de structure « bet » (bureau d'études techniques) aux types
-- d'entité existants (MOA, architecte, promoteur, confrère, autre).
--
-- À exécuter dans Supabase → SQL Editor (copier-coller, puis « Run »).

alter type entite_type add value if not exists 'bet';
