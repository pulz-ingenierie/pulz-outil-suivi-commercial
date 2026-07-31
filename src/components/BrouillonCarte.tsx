"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Carte de brouillon « façon Tinder » : elle suit le doigt lors d'un glissement
// horizontal, puis s'éjecte hors de l'écran (translate + rotation) avant de
// charger le brouillon suivant/précédent. Le geste est ignoré s'il démarre dans
// un champ de saisie (édition du texte) ou s'il est surtout vertical (scroll).
export default function BrouillonCarte({
  index,
  total,
  children,
}: {
  index: number;
  total: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const axe = useRef<null | "h" | "v">(null);
  const locked = useRef(false); // pendant l'éjection : on ignore les gestes
  const [tx, setTx] = useState(0);
  const [anim, setAnim] = useState(false);

  const largeur = () => (typeof window !== "undefined" ? window.innerWidth : 420);

  const ejecter = (dir: 1 | -1) => {
    const cible = index + dir;
    if (cible < 0 || cible >= total) { setAnim(true); setTx(0); return; } // pas de voisin → revient
    locked.current = true;
    setAnim(true);
    setTx(dir * (largeur() + 160));
    setTimeout(() => router.push(`/brouillons?d=${cible}`), 230);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (locked.current) return;
    const el = e.target as HTMLElement | null;
    if (el && el.closest("input, textarea, select")) { dragging.current = false; return; }
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = true;
    axe.current = null;
    setAnim(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || locked.current) return;
    const t = e.touches[0];
    const ddx = t.clientX - startX.current;
    const ddy = t.clientY - startY.current;
    if (axe.current === null) {
      if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
      axe.current = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
    }
    if (axe.current === "v") return; // scroll vertical → on laisse la page défiler
    setTx(ddx);
  };

  const onTouchEnd = () => {
    if (!dragging.current || locked.current) return;
    dragging.current = false;
    if (axe.current !== "h") { setAnim(true); setTx(0); return; }
    const seuil = 90;
    if (tx <= -seuil) ejecter(1);       // glissement gauche → suivant
    else if (tx >= seuil) ejecter(-1);  // glissement droite → précédent
    else { setAnim(true); setTx(0); }   // pas assez loin → revient
  };

  const rot = Math.max(-12, Math.min(12, tx / 22));
  const opac = 1 - Math.min(0.35, Math.abs(tx) / (largeur() * 2.4));

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: `translateX(${tx}px) rotate(${rot}deg)`,
        transition: anim ? "transform .23s ease-out, opacity .23s ease-out" : "none",
        opacity: opac,
        touchAction: "pan-y",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
