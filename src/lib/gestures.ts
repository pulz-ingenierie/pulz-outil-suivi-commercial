"use client";

import { useRef } from "react";

// Ouvre le volet rouge de suppression pour un objet. `nom` facultatif : utilisé
// quand l'objet n'a pas d'aperçu à charger (ex. une relance).
export function demanderSuppression(type: string, id: string, nom?: string) {
  window.dispatchEvent(new CustomEvent("moeia:supprimer", { detail: { type, id, nom } }));
}

// Appui long (~550 ms) pour ouvrir la suppression — utilisé sur les signets, qui
// ne peuvent pas révéler de bouton par glissement. Renvoie les gestionnaires à
// étaler sur l'élément + `consomme()` (pour ignorer le clic qui suit le geste).
export function useLongPressSuppr(type: string, id: string, nom?: string) {
  const geste = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const arm = () => {
    geste.current = false;
    clear();
    timer.current = setTimeout(() => { geste.current = true; demanderSuppression(type, id, nom); }, 550);
  };

  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY }; arm(); };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - start.current.x) > 12 || Math.abs(t.clientY - start.current.y) > 12) clear();
  };
  const onTouchEnd = () => { clear(); start.current = null; };
  const onMouseDown = () => arm();
  const onMouseUp = () => clear();
  const onMouseLeave = () => clear();

  const consomme = () => { if (geste.current) { geste.current = false; return true; } return false; };

  return { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseUp, onMouseLeave, consomme };
}
