"use client";

// Signet cliquable : ouvre le volet global (aperçu de l'objet) qui se déploie
// depuis le bas. Utilisé partout dans l'outil pour une interaction cohérente.
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
  return (
    <button
      type="button"
      className={`sig-d ${cat}`}
      onClick={() => window.dispatchEvent(new CustomEvent("moeia:apercu", { detail: { type, id } }))}
    >
      <span className="sig-lbl">{label}</span>
      {sub ? <span className="sig-sub">{sub}</span> : null}
    </button>
  );
}
