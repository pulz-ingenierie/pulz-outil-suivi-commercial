"use client";

import { useState } from "react";
import { modifierRelance } from "@/lib/actions";
import { titreOperation } from "@/lib/titres";

// Correction d'une relance SUR PLACE, dans son volet déplié : libellé, échéance,
// affaire, structure, personnes concernées, responsable.
//
// Le besoin courant n'est pas de clore une relance mais de la RATTRAPER : on a
// oublié de la rattacher à son affaire, ou le libellé dicté est approximatif.
// Jusqu'ici il fallait la supprimer et la recréer.

export type OptionRef = { id: string; nom: string };

export default function ModifierRelance({
  id,
  objet,
  echeance,
  operationId,
  entiteId,
  personne,
  assigneeId,
  operations,
  structures,
  membres,
}: {
  id: string;
  objet: string;
  echeance: string; // AAAA-MM-JJ
  operationId: string | null;
  entiteId: string | null;
  personne: string | null;
  assigneeId: string | null;
  operations: OptionRef[];
  structures: OptionRef[];
  membres: OptionRef[];
}) {
  const [ouvert, setOuvert] = useState(false);

  if (!ouvert) {
    return (
      <button type="button" className="btn ghost mini" onClick={() => setOuvert(true)}>
        Modifier
      </button>
    );
  }

  return (
    <form action={modifierRelance} className="rel-edit">
      <input type="hidden" name="id" value={id} />

      <label className="field">
        <span className="lab">Objet <em>*</em></span>
        <input name="objet" required defaultValue={objet} placeholder="Ex. Rappeler pour la remise de l'offre" />
      </label>

      <div className="row2">
        <label className="field">
          <span className="lab">Échéance <em>*</em></span>
          <input type="date" name="date_echeance" required defaultValue={echeance} />
        </label>
        <label className="field">
          <span className="lab">Qui s'en occupe</span>
          <select name="assignee_id" defaultValue={assigneeId ?? ""}>
            <option value="">— Personne —</option>
            {membres.map((m) => (
              <option key={m.id} value={m.id}>{m.nom}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="lab">Affaire concernée</span>
        <select name="operation_id" defaultValue={operationId ?? ""}>
          <option value="">— Aucune —</option>
          {operations.map((o) => (
            <option key={o.id} value={o.id}>{titreOperation(o.nom)}</option>
          ))}
        </select>
        <small className="hint">C'est ici qu'on rattrape l'oubli le plus fréquent : une relance saisie sans son affaire.</small>
      </label>

      <label className="field">
        <span className="lab">Structure concernée</span>
        <select name="entite_id" defaultValue={entiteId ?? ""}>
          <option value="">— Aucune —</option>
          {structures.map((e) => (
            <option key={e.id} value={e.id}>{e.nom}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="lab">Personnes concernées</span>
        <input name="personne" defaultValue={personne ?? ""} placeholder="Ex. Béatrice Massy" />
        <small className="hint">L'interlocuteur à recontacter — séparez par des virgules. À distinguer de « qui s'en occupe ».</small>
      </label>

      <div className="rel-edit-foot">
        <button type="button" className="btn ghost mini" onClick={() => setOuvert(false)}>Annuler</button>
        <button className="btn mini" type="submit">Enregistrer</button>
      </div>
    </form>
  );
}
