-- Phases v2 — ÉTAPE 1 : ajouter les nouvelles valeurs d'étape.
-- À exécuter EN PREMIER, avant le déploiement du code. Non destructif : les
-- anciennes valeurs (contact, ao_attente) restent valides, donc rien ne casse.
--
-- Nouveau pipeline : piste · qualifie · concours · a_chiffrer · offre_remise ·
-- nego · gagne · perdu.

alter type operation_statut add value if not exists 'piste';
alter type operation_statut add value if not exists 'concours';
alter type operation_statut add value if not exists 'a_chiffrer';
