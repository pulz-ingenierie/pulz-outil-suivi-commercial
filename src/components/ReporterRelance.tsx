"use client";

import { useState } from "react";
import { updateRelance } from "@/lib/actions";

// « Reporter » : bouton simple qui révèle un sélecteur de date au clic, pour ne
// pas afficher une date parasite dans la rangée d'actions.
export default function ReporterRelance({ id, defaultDate }: { id: string; defaultDate: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn ghost mini" onClick={() => setOpen(true)}>Reporter</button>
    );
  }
  return (
    <form action={updateRelance} className="rel-report">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value="reporter" />
      <input type="date" name="date_echeance" defaultValue={defaultDate} aria-label="Reporter au" autoFocus />
      <button className="btn ghost mini" type="submit">OK</button>
    </form>
  );
}
