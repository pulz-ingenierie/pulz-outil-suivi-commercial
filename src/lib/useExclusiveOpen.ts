"use client";

import { useCallback, useEffect, useState } from "react";

// Ouverture EXCLUSIVE (accordéon) partagée entre tous les volets dépliables de
// la page : quand une ligne s'ouvre, elle émet un événement ; les autres lignes
// ouvertes l'écoutent et se referment. Évite d'avoir plusieurs volets déployés
// en même temps, sans remonter l'état dans chaque liste parente.
const EVT = "lx-exclusive-open";

export function useExclusiveOpen(key: string) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // À l'ouverture : on signale la nôtre (ferme les autres déjà ouvertes)…
    window.dispatchEvent(new CustomEvent(EVT, { detail: key }));
    // …puis on écoute : si une AUTRE ligne s'ouvre, on se referme.
    const onAutre = (e: Event) => {
      if ((e as CustomEvent).detail !== key) setOpen(false);
    };
    window.addEventListener(EVT, onAutre);
    return () => window.removeEventListener(EVT, onAutre);
  }, [open, key]);

  const toggle = useCallback(() => setOpen((c) => !c), []);

  return { open, setOpen, toggle };
}
