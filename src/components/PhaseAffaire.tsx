"use client";

import { useRef } from "react";
import { majPhaseOperation } from "@/lib/actions";
import { STATUT_LABELS, STATUT_ORDRE, type OperationStatut } from "@/lib/types";

const STATUT_VAR: Record<string, string> = {
  piste: "--s-piste", qualifie: "--s-qualifie", concours: "--s-concours", a_chiffrer: "--s-chiffrer",
  offre_remise: "--s-offre", nego: "--s-nego", gagne: "--s-gagne", perdu: "--s-perdu",
};

// Fait avancer l'affaire liée à une relance, en un geste, sans quitter l'écran.
export default function PhaseAffaire({ operationId, statut }: { operationId: string; statut: OperationStatut }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={majPhaseOperation} className="phase-select" style={{ ["--cat" as string]: `var(${STATUT_VAR[statut]})` }}>
      <input type="hidden" name="id" value={operationId} />
      <select name="statut" defaultValue={statut} aria-label="Faire avancer l'affaire" onChange={() => formRef.current?.requestSubmit()}>
        {STATUT_ORDRE.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
      </select>
    </form>
  );
}
