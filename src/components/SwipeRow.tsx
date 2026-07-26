"use client";

import { useRef, useState } from "react";
import { demanderSuppression } from "@/lib/gestures";

// Ligne avec « glisser vers la gauche pour supprimer » (réflexe iOS) : la ligne
// se déplace et révèle un bouton rouge « Supprimer ». Tap sur le bouton → volet
// rouge de confirmation. Un tap simple laisse passer le clic (ouverture du volet
// d'aperçu de la ligne).
const REVEAL = 88;

export default function SwipeRow({
  type,
  id,
  nom,
  children,
}: {
  type: string;
  id: string;
  nom?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const horiz = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    moved.current = false;
    horiz.current = false;
    setDrag(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const ddx = t.clientX - start.current.x;
    const ddy = t.clientY - start.current.y;
    if (!horiz.current && Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy)) horiz.current = true;
    if (horiz.current) {
      moved.current = true;
      const base = open ? -REVEAL : 0;
      const nx = Math.min(0, Math.max(-REVEAL - 24, base + ddx));
      setDx(nx);
    }
  };
  const onTouchEnd = () => {
    setDrag(false);
    start.current = null;
    if (moved.current) {
      const shouldOpen = dx < -REVEAL / 2;
      setOpen(shouldOpen);
      setDx(shouldOpen ? -REVEAL : 0);
    }
  };

  // Si un glissement vient d'avoir lieu, ou si la ligne est ouverte, on avale le
  // clic (et on referme) au lieu d'ouvrir l'aperçu.
  const onClickCapture = (e: React.MouseEvent) => {
    if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; return; }
    if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); setDx(0); }
  };

  const supprimer = () => { setOpen(false); setDx(0); demanderSuppression(type, id, nom); };

  return (
    <div className="swrow">
      <button
        type="button"
        className="swrow-del"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        onClick={supprimer}
      >
        Supprimer
      </button>
      <div
        className="swrow-track"
        style={{ transform: `translateX(${dx}px)`, transition: drag ? "none" : "transform .18s ease" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
