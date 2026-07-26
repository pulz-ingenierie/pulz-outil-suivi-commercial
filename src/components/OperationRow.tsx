"use client";

import VoletCard from "@/components/VoletCard";
import SwipeRow from "@/components/SwipeRow";
import { STATUT_LABELS, type OperationStatut } from "@/lib/types";

const STATUT_VAR: Record<string, string> = {
  contact: "--s-contact", qualifie: "--s-qualifie", ao_attente: "--s-ao",
  offre_remise: "--s-offre", nego: "--s-nego", gagne: "--s-gagne", perdu: "--s-perdu",
};

// Ligne d'affaire dans une liste : nom + étape (+ montant). Clic → volet.
export default function OperationRow({
  id, nom, statut, montant, role,
}: {
  id: string; nom: string; statut: OperationStatut; montant?: number | null; role?: string | null;
}) {
  const m = montant != null ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(montant) + " €" : null;
  return (
    <SwipeRow type="operation" id={id} nom={nom}>
      <VoletCard className="vrow" type="operation" id={id}>
        <span className="vrow-nom">{nom}</span>
        <span className="vrow-meta">
          {role ? <span className="vrow-type">{role}</span> : null}
          <span className="phase-tag"><span className="dot" style={{ background: `var(${STATUT_VAR[statut]})` }} />{STATUT_LABELS[statut] ?? statut}</span>
          {m ? <span className="amt tnum">{m}</span> : null}
        </span>
      </VoletCard>
    </SwipeRow>
  );
}
