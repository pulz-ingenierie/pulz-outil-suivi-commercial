"use client";

import { useEffect, useRef, useState } from "react";
import { demanderSuppression } from "@/lib/gestures";

// Ligne « glisser vers la gauche pour supprimer » (réflexe iOS) : la ligne
// coulisse et révèle un bouton rouge « Supprimer ».
//
// Important iOS : React pose ses écouteurs tactiles en mode « passif », ce qui
// empêche de retenir le geste horizontal (Safari le capte pour le défilement).
// On attache donc des écouteurs natifs NON passifs sur la piste, avec
// preventDefault dès que le mouvement est horizontal.
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
  const trackRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState(false);
  // État mutable lu dans les écouteurs natifs (pas de re-render nécessaire).
  const st = useRef({ x: 0, y: 0, horiz: false, moved: false, open: false, dx: 0 });

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      st.current.x = t.clientX;
      st.current.y = t.clientY;
      st.current.horiz = false;
      st.current.moved = false;
      setDrag(true);
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const ddx = t.clientX - st.current.x;
      const ddy = t.clientY - st.current.y;
      if (!st.current.horiz && Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) st.current.horiz = true;
      if (st.current.horiz) {
        e.preventDefault(); // possible car écouteur non passif : retient le geste
        st.current.moved = true;
        const base = st.current.open ? -REVEAL : 0;
        const nx = Math.min(0, Math.max(-REVEAL - 24, base + ddx));
        st.current.dx = nx;
        setDx(nx);
      }
    };
    const onEnd = () => {
      setDrag(false);
      if (st.current.moved) {
        const shouldOpen = st.current.dx < -REVEAL / 2;
        st.current.open = shouldOpen;
        setOpen(shouldOpen);
        setDx(shouldOpen ? -REVEAL : 0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  // Après un glissement (ou si ouvert), on avale le clic pour ne pas ouvrir
  // l'aperçu — et on referme.
  const onClickCapture = (e: React.MouseEvent) => {
    if (st.current.moved) { e.preventDefault(); e.stopPropagation(); st.current.moved = false; return; }
    if (st.current.open) { e.preventDefault(); e.stopPropagation(); st.current.open = false; setOpen(false); setDx(0); }
  };

  const supprimer = () => { st.current.open = false; setOpen(false); setDx(0); demanderSuppression(type, id, nom); };

  return (
    <div className="swrow">
      <button type="button" className="swrow-del" tabIndex={open ? 0 : -1} aria-hidden={!open} onClick={supprimer}>
        Supprimer
      </button>
      <div
        ref={trackRef}
        className="swrow-track"
        style={{ transform: `translateX(${dx}px)`, transition: drag ? "none" : "transform .18s ease" }}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
