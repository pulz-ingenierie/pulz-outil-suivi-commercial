"use client";

// Carte/ligne cliquable qui ouvre le volet global de son objet. Les signets
// internes (composant Signet) ouvrent leur propre volet (ils arrêtent la
// propagation). La suppression par glissement est gérée par SwipeRow autour.
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
  const ouvrir = () => window.dispatchEvent(new CustomEvent("moeia:apercu", { detail: { type, id } }));
  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onClick={ouvrir}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); }
      }}
    >
      {children}
    </div>
  );
}
