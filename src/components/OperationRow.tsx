"use client";

import ExpandableRow from "@/components/ExpandableRow";
import { STATUT_LABELS, type OperationStatut } from "@/lib/types";
import { titreOperation } from "@/lib/titres";

const STATUT_VAR: Record<string, string> = {
  piste: "--s-piste",
  qualifie: "--s-qualifie",
  concours: "--s-concours",
  a_chiffrer: "--s-chiffrer",
  offre_remise: "--s-offre",
  nego: "--s-nego",
  gagne: "--s-gagne",
  perdu: "--s-perdu",
};

// Ligne d'affaire dans une liste : nom + étape (+ montant). Tap → se déplie.
export default function OperationRow({
  id, nom, statut, montant, role,
}: {
  id: string; nom: string; statut: OperationStatut; montant?: number | null; role?: string | null;
}) {
  // Titre nettoyé : une partie inconnue est omise, sans symbole ni séparateur
  // orphelin (le « ✕ » du stockage ne sort jamais à l'écran).
  const titre = titreOperation(nom);
  const m = montant != null ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(montant) + " €" : null;
  return (
    <ExpandableRow type="operation" id={id} nom={titre}>
      <span className="vrow-nom">{titre}</span>
      <span className="vrow-meta">
        {role ? <span className="vrow-type">{role}</span> : null}
        <span className="phase-tag"><span className="dot" style={{ background: `var(${STATUT_VAR[statut]})` }} />{STATUT_LABELS[statut] ?? statut}</span>
        {m ? <span className="amt tnum">{m}</span> : null}
      </span>
    </ExpandableRow>
  );
}
