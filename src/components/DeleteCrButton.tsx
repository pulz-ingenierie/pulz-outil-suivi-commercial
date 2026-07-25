"use client";

import { supprimerCr } from "@/lib/actions";

// Bouton de suppression d'un compte rendu, avec confirmation (action définitive).
export default function DeleteCrButton({ id }: { id: string }) {
  return (
    <form
      action={supprimerCr}
      onSubmit={(e) => {
        if (!confirm("Supprimer ce compte rendu ? Cette action est définitive.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="cr_id" value={id} />
      <button type="submit" className="fil-del" aria-label="Supprimer ce compte rendu">Supprimer</button>
    </form>
  );
}
