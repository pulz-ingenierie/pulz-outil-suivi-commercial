"use client";

import { useRouter } from "next/navigation";
import { useLongPressSuppr, type Parent } from "@/lib/gestures";

// Signet cliquable : ouvre la FICHE complète de l'objet (navigation), pour rester
// cohérent avec le principe « tout se déplie / s'ouvre en liste ». Un appui long
// ouvre le volet rouge de suppression.
const HREF: Record<string, (id: string) => string> = {
  entite: (id) => `/entites/${id}`,
  operation: (id) => `/operations/${id}`,
  personne: (id) => `/personnes/${id}`,
};

export default function Signet({
  type,
  id,
  cat,
  label,
  sub,
  parent,
}: {
  type: "entite" | "operation" | "personne";
  id: string;
  cat: string;
  label: string;
  sub?: string;
  parent?: Parent;
}) {
  const router = useRouter();
  const g = useLongPressSuppr(type, id, label, parent);
  return (
    <button
      type="button"
      className={`sig-d ${cat}`}
      onClick={(e) => {
        e.stopPropagation();
        if (g.consomme()) return;
        const h = HREF[type]?.(id);
        if (h) router.push(h);
      }}
      onTouchStart={g.onTouchStart}
      onTouchMove={g.onTouchMove}
      onTouchEnd={g.onTouchEnd}
      onMouseDown={g.onMouseDown}
      onMouseUp={g.onMouseUp}
      onMouseLeave={g.onMouseLeave}
    >
      <span className="sig-lbl">{label}</span>
      {sub ? <span className="sig-sub">{sub}</span> : null}
    </button>
  );
}
