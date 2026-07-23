-- =============================================================================
-- Remise à zéro des DONNÉES MÉTIER du Suivi commercial.
--
-- À exécuter dans Supabase → SQL Editor (copier-coller, puis « Run »).
--
-- Efface : opérations, entités, contacts, comptes rendus, pièces, relances et
-- tous leurs liens. Repart d'une base vide pour de vraies saisies.
--
-- CONSERVE : l'organisation et les utilisateurs (donc la connexion par lien
-- magique continue de fonctionner — personne n'a besoin de se réinscrire).
--
-- ⚠️ Action irréversible : les données effacées ne sont pas récupérables.
-- =============================================================================

truncate table
  relances,
  pieces,
  cr_operations,
  cr_entites,
  crs,
  entite_operation,
  operations,
  contacts,
  entites
restart identity cascade;
