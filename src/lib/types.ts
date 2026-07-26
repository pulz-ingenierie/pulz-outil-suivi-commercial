// Types du domaine — miroir du schéma (docs/cadrage-suivi-commercial.md §4).
// Vocabulaire neutre.

export type OperationStatut =
  | "piste"
  | "qualifie"
  | "concours"
  | "a_chiffrer"
  | "offre_remise"
  | "nego"
  | "gagne"
  | "perdu";

export type EntiteType = "MOA" | "archi" | "promoteur" | "confrere" | "autre";
export type RelanceStatut = "a_faire" | "faite" | "reportee" | "abandonnee";

export interface Operation {
  id: string;
  org_id: string;
  nom: string;
  description: string | null;
  statut: OperationStatut;
  montant_estime: number | null;
  referent_id: string | null;
  raison_perte: string | null;
  created_at: string;
}

export interface Entite {
  id: string;
  org_id: string;
  nom: string;
  type: EntiteType;
  ville: string | null;
  statut_vie: "actif" | "dormant";
}

export interface Relance {
  id: string;
  org_id: string;
  assignee_id: string | null;
  entite_id: string | null;
  operation_id: string | null;
  objet: string;
  date_echeance: string;
  auto: boolean;
  statut: RelanceStatut;
}

// Libellés d'affichage des 8 étapes (voir docs/suivi-commercial-statuts.md).
export const STATUT_LABELS: Record<OperationStatut, string> = {
  piste: "Piste",
  qualifie: "Qualifié",
  concours: "Concours",
  a_chiffrer: "À chiffrer",
  offre_remise: "Offre remise",
  nego: "Négociation",
  gagne: "Gagné",
  perdu: "Perdu",
};

export const STATUT_ORDRE: OperationStatut[] = [
  "piste",
  "qualifie",
  "concours",
  "a_chiffrer",
  "offre_remise",
  "nego",
  "gagne",
  "perdu",
];
