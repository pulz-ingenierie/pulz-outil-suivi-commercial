-- Pièces jointes normalisées pour l'IA (images/PDF d'un e-mail), conservées avec
-- le brouillon. Sans ça, la photo n'existait qu'au moment de la réception : si
-- l'analyse échouait, re-analyser depuis l'éditeur ne « voyait » plus que le
-- texte. On stocke les pièces (JPEG/PDF en base64) pour pouvoir ré-analyser.
-- Nettoyées à la consolidation du brouillon.

alter table crs add column if not exists pieces_ia jsonb;

comment on column crs.pieces_ia is 'Pièces jointes normalisées (images/PDF base64) pour (ré)analyse IA du brouillon.';
