// Petites icônes de catégorie (structure / opération / personne / relance / ville),
// partagées par tous les volets déployés pour un style homogène.
export default function CatIcon({ name }: { name: "structure" | "operation" | "personne" | "relance" | "ville" }) {
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, className: "ic" } as const;
  if (name === "structure")
    return <svg {...p}><path d="M4 21V4h10v17M14 9h6v12M7 8h1M7 12h1M7 16h1M11 8h1M11 12h1M11 16h1M17 13h1M17 17h1" /></svg>;
  if (name === "operation")
    return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
  if (name === "personne")
    return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>;
  if (name === "ville")
    return <svg {...p}><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  return <svg {...p}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
}
