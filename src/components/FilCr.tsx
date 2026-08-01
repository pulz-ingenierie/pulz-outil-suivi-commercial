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

import Link from "next/link";
import { lienPersonne } from "@/lib/personnes";
import DeleteCrButton from "@/components/DeleteCrButton";

export type CrItem = {
  id: string;
  date_rdv: string | null;
  type_rdv: string;
  transcription: string | null;
  synthese: any;
  auteur?: { nom: string } | null;
};

export default function FilCr({
  crs,
  liens = {},
}: {
  crs: CrItem[];
  liens?: Record<string, string>;
}) {
  if (!crs.length) {
    return <div className="empty">Aucun compte rendu pour l'instant.</div>;
  }

  return (
    <div className="fil-tl">
      {crs.map((c) => {
        const s = (c.synthese ?? null) as any;
        const resume = typeof s?.resume === "string" ? s.resume.trim() : "";
        const points: string[] = Array.isArray(s?.points_cles)
          ? s.points_cles.filter((p: any) => typeof p === "string" && p.trim())
          : [];
        const contacts: any[] = Array.isArray(s?.contacts) ? s.contacts : [];
        const structure = !resume && !points.length; // pas de synthèse : on retombe sur le texte
        const typeLbl = TYPE_RDV_LABELS[c.type_rdv] ?? "RDV";
        // Aperçu (résumé tronqué, ou début du texte brut) affiché ligne repliée.
        const apercu = (resume || (c.transcription ?? "").trim()).replace(/\s+/g, " ").slice(0, 70);

        // Participants : uniquement les personnes réellement évoquées (jamais
        // l'auteur automatiquement), dédupliquées par nom.
        const participants: { nom: string; moi: boolean }[] = [];
        const vus = new Set<string>();
        for (const ct of contacts) {
          const nom = [ct?.prenom, ct?.nom].filter(Boolean).join(" ").trim();
          const k = nom.toLowerCase().replace(/\s+/g, " ");
          if (nom && !vus.has(k)) {
            vus.add(k);
            participants.push({ nom, moi: false });
          }
        }

        return (
          <details className="fil-tl-item" key={c.id}>
            <summary className="fil-tl-sum">
              <span className="fil-tl-dot" aria-hidden />
              <span className="fil-date">{dateFr(c.date_rdv)}</span>
              <span className="sig-d type"><span className="sig-lbl">{typeLbl}</span></span>
              {apercu && <span className="fil-tl-apercu">{apercu}{apercu.length >= 70 ? "…" : ""}</span>}
              <span className="fil-tl-chev" aria-hidden>›</span>
            </summary>

            <div className="fil-tl-body">
              {resume && <p className="fil-resume">{resume}</p>}
              {points.length > 0 && (
                <ul className="fil-points">{points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              )}

              {participants.length > 0 && (
                <div className="sig-wrap fil-sigs">
                  {participants.map((p, i) => {
                    const href = p.moi ? null : lienPersonne(liens, p.nom);
                    if (href) {
                      return (
                        <Link className="sig-d pers" href={href} key={i}>
                          <span className="sig-lbl">{p.nom}</span>
                        </Link>
                      );
                    }
                    return (
                      <span className={`sig-d pers${p.moi ? " moi" : ""}`} key={i}>
                        <span className="sig-lbl">{p.nom}</span>
                        {p.moi && <span className="sig-sub">moi</span>}
                      </span>
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

              <div className="fil-tl-foot"><DeleteCrButton id={c.id} /></div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
