"use client";

import { useRef } from "react";
import { changerPhase } from "@/lib/actions";
import { STATUT_LABELS, STATUT_ORDRE, type OperationStatut } from "@/lib/types";

const STATUT_VAR: Record<string, string> = {
  contact: "--s-contact",
  qualifie: "--s-qualifie",
  ao_attente: "--s-ao",
  offre_remise: "--s-offre",
  nego: "--s-nego",
  gagne: "--s-gagne",
  perdu: "--s-perdu",
};

// Sélecteur d'étape en un geste, façon signet coloré. Le changement est
// enregistré dès qu'on choisit une étape (pas de bouton à valider).
export default function PhaseSelect({ id, statut }: { id: string; statut: OperationStatut }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={changerPhase} className="phase-select" style={{ ["--cat" as string]: `var(${STATUT_VAR[statut]})` }}>
      <input type="hidden" name="id" value={id} />
      <select
        name="statut"
        defaultValue={statut}
        aria-label="Changer l'étape de l'opération"
        onChange={() => formRef.current?.requestSubmit()}
      >
        {STATUT_ORDRE.map((s) => (
          <option key={s} value={s}>{STATUT_LABELS[s]}</option>
        ))}
      </select>
    </form>
  );
}
