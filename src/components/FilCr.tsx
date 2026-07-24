// Fil des comptes rendus — affiche le CONTENU STRUCTURÉ par l'IA (résumé +
// points clés + signets qui font sens), jamais la dictée/e-mail brut. Partagé
// par la fiche opération et la carte structure pour un rendu identique partout.

const TYPE_RDV_LABELS: Record<string, string> = {
  dejeuner: "Déjeuner",
  appel: "Appel",
  visite: "Visite",
  salon: "Salon",
  autre: "RDV",
};

function dateFr(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export type CrItem = {
  id: string;
  date_rdv: string | null;
  type_rdv: string;
  transcription: string | null;
  synthese: any;
};

export default function FilCr({ crs }: { crs: CrItem[] }) {
  if (!crs.length) {
    return <div className="empty">Aucun compte rendu pour l'instant.</div>;
  }

  return (
    <div className="fil">
      {crs.map((c) => {
        const s = (c.synthese ?? null) as any;
        const resume = typeof s?.resume === "string" ? s.resume.trim() : "";
        const points: string[] = Array.isArray(s?.points_cles)
          ? s.points_cles.filter((p: any) => typeof p === "string" && p.trim())
          : [];
        const contacts: any[] = Array.isArray(s?.contacts) ? s.contacts : [];
        const structure = !resume && !points.length; // pas de synthèse : on retombe sur le texte
        const typeLbl = TYPE_RDV_LABELS[c.type_rdv] ?? "RDV";

        return (
          <article className="fil-item" key={c.id}>
            <div className="fil-h">
              <span className="fil-date">{dateFr(c.date_rdv)}</span>
              <span className="sig-d type"><span className="sig-lbl">{typeLbl}</span></span>
            </div>

            {resume && <p className="fil-resume">{resume}</p>}
            {points.length > 0 && (
              <ul className="fil-points">{points.map((p, i) => <li key={i}>{p}</li>)}</ul>
            )}

            {contacts.length > 0 && (
              <div className="sig-wrap fil-sigs">
                {contacts.map((ct, i) => {
                  const nom = [ct?.prenom, ct?.nom].filter(Boolean).join(" ").trim();
                  if (!nom) return null;
                  return (
                    <span className="sig-d pers" key={i}><span className="sig-lbl">{nom}</span></span>
                  );
                })}
              </div>
            )}

            {structure && (
              <p className="fil-brut">
                {(c.transcription ?? "—").slice(0, 240)}
                {(c.transcription ?? "").length > 240 ? "…" : ""}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
