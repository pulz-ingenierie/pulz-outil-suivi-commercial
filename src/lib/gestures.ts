"use client";

import { useRef } from "react";

// Déclenche le volet rouge de suppression pour un objet donné.
export function demanderSuppression(type: string, id: string) {
  window.dispatchEvent(new CustomEvent("moeia:supprimer", { detail: { type, id } }));
}

// Gestes de suppression pour une LIGNE : swipe vers la gauche (tactile) ou
// appui long (~550 ms). Renvoie les gestionnaires à étaler sur l'élément, plus
// `consomme()` qui indique si un geste vient d'avoir lieu (pour ne pas
// déclencher le clic normal juste après).
export function useSuppression(type: string, id: string) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const gesteRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    gesteRef.current = false;
    clearTimer();
    timer.current = setTimeout(() => {
      gesteRef.current = true;
      demanderSuppression(type, id);
    }, 550);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    // Un mouvement notable annule l'appui long.
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimer();
    // Swipe franc vers la gauche → suppression.
    if (dx < -60 && Math.abs(dy) < 40 && !gesteRef.current) {
      gesteRef.current = true;
      clearTimer();
      demanderSuppression(type, id);
    }
  };

  const onTouchEnd = () => { clearTimer(); start.current = null; };

  // Appui long à la souris (bureau) : maintien du bouton ~550 ms.
  const onMouseDown = () => {
    gesteRef.current = false;
    clearTimer();
    timer.current = setTimeout(() => {
      gesteRef.current = true;
      demanderSuppression(type, id);
    }, 550);
  };
  const onMouseUp = () => clearTimer();
  const onMouseLeave = () => clearTimer();

  // À appeler dans le onClick de l'élément : si un geste vient d'avoir lieu,
  // renvoie true (le clic normal doit être ignoré) et réarme.
  const consomme = () => {
    if (gesteRef.current) { gesteRef.current = false; return true; }
    return false;
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseUp, onMouseLeave, consomme };
}
