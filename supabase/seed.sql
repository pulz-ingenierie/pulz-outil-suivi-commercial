-- =============================================================================
-- Jeu de données de test — Suivi commercial (moeïa)
-- Discipline D4 : tout nouvel environnement est utilisable immédiatement.
-- Données FICTIVES, vocabulaire neutre. Identifiants fixes pour la cohérence.
-- Idempotent : on repart d'une base propre (TRUNCATE) avant d'insérer.
-- =============================================================================

truncate
  relances, pieces, cr_operations, cr_entites, crs,
  entite_operation, operations, contacts, entites, utilisateurs, organisations
  restart identity cascade;

-- Organisation (le groupement, en v1 unique) --------------------------------
insert into organisations (id, nom) values
  ('00000000-0000-0000-0000-000000000001', 'Groupement (démo)');

-- Utilisateurs --------------------------------------------------------------
insert into utilisateurs (id, org_id, nom, email, societe_label, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Sylvain',  'sylvain@exemple.fr',  'Société A', 'pilote'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Yohan',    'yohan@exemple.fr',    'Société A', 'pilote'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Maxence',  'maxence@exemple.fr',  'Société B', 'membre'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Claire',   'claire@exemple.fr',   'Société C', 'membre');

-- Entités (prospects / partenaires) -----------------------------------------
insert into entites (id, org_id, nom, type, ville, statut_vie, created_by, notes) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'SIGH',              'MOA',        'Lille',      'actif',   '10000000-0000-0000-0000-000000000001', 'Bailleur social. Rencontré au salon.'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Dujardin',          'promoteur',  'Roubaix',    'actif',   '10000000-0000-0000-0000-000000000001', null),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Cabinet Léa Archi', 'archi',      'Lille',      'actif',   '10000000-0000-0000-0000-000000000003', 'Architecte mandataire potentiel.'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Ville de Tourcoing','MOA',        'Tourcoing',  'dormant', '10000000-0000-0000-0000-000000000002', 'Pas de contact depuis longtemps.');

-- Contacts ------------------------------------------------------------------
insert into contacts (id, entite_id, nom, prenom, fonction, tel, email, source) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Martin',  'Paul',   'Directeur du patrimoine', '0600000001', 'paul.martin@sigh.exemple.fr',   'carte'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Dujardin','Sophie', 'Directrice de programmes', '0600000002', 'sophie@dujardin.exemple.fr',    'vocal'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Bernard', 'Léa',    'Architecte',               '0600000003', 'lea@lea-archi.exemple.fr',      'manuel');

-- Opérations (statut porté ici) ---------------------------------------------
insert into operations (id, org_id, nom, description, statut, montant_estime, referent_id, raison_perte) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Réhabilitation groupe scolaire', 'Rénovation énergétique, site occupé.', 'qualifie',     null,      '10000000-0000-0000-0000-000000000001', null),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Résidence Les Tilleuls',         '45 logements, AO en préparation.',    'ao_attente',   1200000.00,'10000000-0000-0000-0000-000000000001', null),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Extension mairie',               'Premier contact au salon.',           'contact',      null,      '10000000-0000-0000-0000-000000000003', null),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Réaménagement centre technique', 'Signé.',                              'gagne',        320000.00, '10000000-0000-0000-0000-000000000002', null),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Parking silo',                   'Non retenu.',                         'perdu',        null,      '10000000-0000-0000-0000-000000000001', 'Budget MOA insuffisant, projet reporté.');

-- Liens N-N entité ↔ opération (Résidence a 2 portes d'entrée) ---------------
insert into entite_operation (entite_id, operation_id, role_entree) values
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Maître d''ouvrage'),
  ('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Promoteur'),
  ('20000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'Architecte mandataire pressenti'),
  ('20000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', 'Maître d''ouvrage');

-- Un CR validé, avec synthèse IA (structure conservée en jsonb) --------------
insert into crs (id, org_id, auteur_id, date_rdv, type_rdv, transcription, synthese, statut) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', '2026-07-15', 'dejeuner',
   'Déjeuner avec Paul Martin du SIGH. Il confirme le lancement de la réhabilitation du groupe scolaire à la rentrée. Site occupé, contrainte forte. Il faut relancer début septembre.',
   '{"sujet":"Réhabilitation groupe scolaire","signaux":["site occupé","lancement rentrée"],"interlocuteurs":["Paul Martin"],"actions":[{"type":"relance_operation","echeance":"2026-09-01"}]}'::jsonb,
   'valide');

insert into cr_entites (cr_id, entite_id) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
insert into cr_operations (cr_id, operation_id) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001');

-- Relances : une "auto" (+1 mois), une tâche assignée, une en retard ---------
insert into relances (id, org_id, assignee_id, entite_id, operation_id, cr_origine_id, objet, date_echeance, auto, statut) values
  -- issue du CR, datée par l'IA
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Relancer SIGH pour le lancement du groupe scolaire', '2026-09-01', false, 'a_faire'),
  -- relance par défaut auto (+1 mois), badge auto
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', null, 'Reprendre contact avec Dujardin', '2026-08-21', true, 'a_faire'),
  -- tâche assignée à un autre membre (Maxence)
  ('60000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', null, null, 'Maxence rappelle le cabinet d''architecte', '2026-07-25', false, 'a_faire'),
  -- relance EN RETARD (échéance passée)
  ('60000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000003', null, 'Relancer la ville de Tourcoing', '2026-07-10', false, 'a_faire');
