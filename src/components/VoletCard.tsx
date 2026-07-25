"use client";

// Carte cliquable qui ouvre le volet global de son objet. Les signets internes
// (composant Signet) ouvrent leur propre volet (ils arrêtent la propagation).
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
  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onClick={() => window.dispatchEvent(new CustomEvent("moeia:apercu", { detail: { type, id } }))}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("moeia:apercu", { detail: { type, id } }));
        }
      }}
    >
      {children}
    </div>
  );
}
