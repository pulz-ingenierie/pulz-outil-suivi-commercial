"use client";

import { useRef, useState } from "react";
import Signet from "@/components/Signet";
import { titreOperation } from "@/lib/titres";
import { associerContactOperation } from "@/lib/actions";
import { useLongPress } from "@/lib/gestures";

type Op = { id: string; nom: string; statut?: string };

// Une affaire proposée à l'association : touchez-la (ou appui long) pour lier la
// personne à cette affaire (contact du promoteur).
function OptionAffaire({ contactId, op }: { contactId: string; op: Op }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const g = useLongPress(submit);
  return (
    <form ref={formRef} action={associerContactOperation} className="assoc-opt-wrap">
      <input type="hidden" name="contact_id" value={contactId} />
      <input type="hidden" name="operation_id" value={op.id} />
      <button
        type="button"
        className="assoc-opt"
        onClick={() => { if (g.consomme()) return; submit(); }}
        onTouchStart={g.onTouchStart}
        onTouchMove={g.onTouchMove}
        onTouchEnd={g.onTouchEnd}
        onMouseDown={g.onMouseDown}
        onMouseUp={g.onMouseUp}
        onMouseLeave={g.onMouseLeave}
      >
        <span className="assoc-opt-nom">{titreOperation(op.nom)}</span>
        <span className="assoc-opt-plus">Associer</span>
      </button>
    </form>
  );
}

// Section « Affaires suivies » d'une fiche personne : les affaires dont elle est
// le contact (lien direct), + un sélecteur pour en associer d'autres. Détacher
// se fait par appui long sur le signet (volet rouge), comme partout ailleurs.
export default function AssocierAffaire({
  contactId,
  contactNom,
  associees,
  disponibles,
}: {
  contactId: string;
  contactNom: string;
  associees: Op[];
  disponibles: Op[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const liste = query ? disponibles.filter((o) => o.nom.toLowerCase().includes(query)) : disponibles;

  return (
    <div className="block">
      <div className="block-h">
        <div className="eyebrow">Affaires suivies — contact de l'affaire</div>
        <button type="button" className="btn ghost mini" onClick={() => setOpen((o) => !o)}>
          {open ? "Fermer" : "＋ Associer une affaire"}
        </button>
      </div>

      {associees.length ? (
        <div className="sig-wrap">
          {associees.map((o) => (
            <Signet
              key={o.id}
              type="operation"
              id={o.id}
              cat="op"
              label={titreOperation(o.nom)}
              parent={{ type: "personne", id: contactId, nom: contactNom }}
            />
          ))}
        </div>
      ) : (
        <div className="empty">Aucune affaire associée pour l'instant.</div>
      )}

      {open && (
        <div className="assoc-picker">
          <div className="assoc-hint">
            Touchez une affaire (ou appui long) pour l'associer. Pour retirer un lien, appui long sur son signet ci-dessus.
          </div>
          <input
            className="assoc-search"
            placeholder="Rechercher une affaire…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="assoc-list">
            {liste.length ? (
              liste.map((o) => <OptionAffaire key={o.id} contactId={contactId} op={o} />)
            ) : (
              <div className="empty">Aucune affaire disponible.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
