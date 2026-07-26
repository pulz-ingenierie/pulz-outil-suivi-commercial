"use client";

import { useSuppression } from "@/lib/gestures";

// Carte/ligne cliquable qui ouvre le volet global de son objet. Les signets
// internes (composant Signet) ouvrent leur propre volet (ils arrêtent la
// propagation). Un swipe vers la gauche ou un appui long ouvre le volet ROUGE
// de suppression.
export default function VoletCard({
  type,
  id,
  className,
  children,
}: {
  type: "entite" | "operation" | "personne";
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const g = useSuppression(type, id);
  const ouvrir = () => window.dispatchEvent(new CustomEvent("moeia:apercu", { detail: { type, id } }));
  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onClick={() => { if (!g.consomme()) ouvrir(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ouvrir();
        }
      }}
      onTouchStart={g.onTouchStart}
      onTouchMove={g.onTouchMove}
      onTouchEnd={g.onTouchEnd}
      onMouseDown={g.onMouseDown}
      onMouseUp={g.onMouseUp}
      onMouseLeave={g.onMouseLeave}
    >
      {children}
    </div>
  );
}
