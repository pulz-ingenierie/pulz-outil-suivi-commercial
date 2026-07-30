"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Navigation entre brouillons : flèches ‹ › + glissement horizontal (swipe vers
// la gauche = brouillon suivant, vers la droite = précédent). Le geste est
// ignoré quand il commence dans un champ de saisie (pour ne pas gêner l'édition).
export default function BrouillonSwipe({ index, total }: { index: number; total: number }) {
  const router = useRouter();
  const go = (i: number) => { if (i >= 0 && i < total && i !== index) router.push(`/brouillons?d=${i}`); };

  useEffect(() => {
    if (total <= 1) return;
    let x0 = 0, y0 = 0, tracking = false;
    const start = (e: TouchEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest("input, textarea, select")) { tracking = false; return; }
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY; tracking = true;
    };
    const end = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0, dy = t.clientY - y0;
      // Geste franc et horizontal uniquement (évite les faux positifs au scroll).
      if (Math.abs(dx) > 80 && Math.abs(dx) > 2.2 * Math.abs(dy)) {
        if (dx < 0) go(index + 1);
        else go(index - 1);
      }
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchend", end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total]);

  if (total <= 1) return <div className="eyebrow">Brouillon 1 sur 1</div>;
  return (
    <div className="brouillon-nav">
      <button type="button" className="brn-arrow" disabled={index <= 0} onClick={() => go(index - 1)} aria-label="Brouillon précédent">‹</button>
      <span className="eyebrow" style={{ margin: 0 }}>Brouillon {index + 1} sur {total}</span>
      <button type="button" className="brn-arrow" disabled={index >= total - 1} onClick={() => go(index + 1)} aria-label="Brouillon suivant">›</button>
    </div>
  );
}
