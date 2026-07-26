"use client";

import { useSuppression } from "@/lib/gestures";

// Signet cliquable : ouvre le volet global (aperçu de l'objet) qui se déploie
// depuis le bas. Un appui long (ou un swipe vers la gauche) ouvre le volet ROUGE
// de suppression. Utilisé partout dans l'outil pour une interaction cohérente.
export default function Signet({
  type,
  id,
  cat,
  label,
  sub,
}: {
  type: "entite" | "operation" | "personne";
  id: string;
  cat: string;
  label: string;
  sub?: string;
}) {
  const g = useSuppression(type, id);
  return (
    <button
      type="button"
      className={`sig-d ${cat}`}
      onClick={(e) => {
        e.stopPropagation();
        if (g.consomme()) return;
        window.dispatchEvent(new CustomEvent("moeia:apercu", { detail: { type, id } }));
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
