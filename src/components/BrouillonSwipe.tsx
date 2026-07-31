"use client";

import { useRouter } from "next/navigation";

// En-tête de navigation entre brouillons : compteur + flèches ‹ ›. Le glissement
// animé (façon Tinder) est géré par BrouillonCarte qui enveloppe le contenu.
export default function BrouillonSwipe({ index, total }: { index: number; total: number }) {
  const router = useRouter();
  const go = (i: number) => { if (i >= 0 && i < total && i !== index) router.push(`/brouillons?d=${i}`); };

  if (total <= 1) return <div className="eyebrow">Brouillon 1 sur 1</div>;
  return (
    <div className="brouillon-nav">
      <button type="button" className="brn-arrow" disabled={index <= 0} onClick={() => go(index - 1)} aria-label="Brouillon précédent">‹</button>
      <span className="eyebrow" style={{ margin: 0 }}>Brouillon {index + 1} sur {total}</span>
      <button type="button" className="brn-arrow" disabled={index >= total - 1} onClick={() => go(index + 1)} aria-label="Brouillon suivant">›</button>
    </div>
  );
}
