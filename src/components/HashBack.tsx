"use client";

import { useEffect, useState } from "react";
import BackButton from "@/components/BackButton";

// Bouton « Précédent » affiché UNIQUEMENT quand on est arrivé sur cet écran par
// navigation (clic sur une relance → #r-…), pas quand on ouvre l'onglet Relances
// via la barre du bas. Permet de revenir là où on était.
export default function HashBack() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(/^#r-/.test(window.location.hash) && window.history.length > 1);
  }, []);
  if (!show) return null;
  return <BackButton fallback="/relances" />;
}
