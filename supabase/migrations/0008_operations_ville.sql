-- Ville (commune) d'une opération : le lieu du projet.
-- Elle devient un signet à part entière sur l'affaire, et sert de repère
-- « information à compléter » (croix ✕) quand elle n'est pas encore connue.
-- Elle entre aussi dans le libellé de l'opération : « Client - Ville - Nature ».

alter table operations add column if not exists ville text;

comment on column operations.ville is 'Commune où se situe le projet. NULL = à compléter (affiché ✕).';
