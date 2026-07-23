import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  STATUT_LABELS,
  STATUT_ORDRE,
  type Operation,
  type OperationStatut,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUT_VAR: Record<string, string> = {
  contact: "--s-contact",
  qualifie: "--s-qualifie",
  ao_attente: "--s-ao",
  offre_remise: "--s-offre",
  nego: "--s-nego",
  gagne: "--s-gagne",
  perdu: "--s-perdu",
};

function euro(n: number | null): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

// Page dédiée à une étape : liste toutes les affaires qui s'y trouvent.
export default async function PhasePage({ params }: { params: Promise<{ statut: string }> }) {
  const { statut } = await params;

  // Sécurité : l'étape doit faire partie des 7 étapes connues.
  if (!STATUT_ORDRE.includes(statut as OperationStatut)) notFound();
  const st = statut as OperationStatut;

  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <div className="card notice">
          <div className="eyebrow">Configuration</div>
          <p className="muted">Base de données non connectée.</p>
        </div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [{ data: ops, error }, { data: liens }] = await Promise.all([
    supabase
      .from("operations")
      .select("*")
      .eq("statut", st)
      .order("created_at", { ascending: false }),
    supabase.from("entite_operation").select("operation_id, entites(nom)"),
  ]);

  if (error) {
    return (
      <main className="wrap">
        <div className="card notice">
          <div className="eyebrow">Connexion</div>
          <p className="muted">La base a répondu : {error.message}</p>
        </div>
      </main>
    );
  }

  const operations = (ops ?? []) as Operation[];

  // Prospects rattachés à chaque affaire (les portes d'entrée).
  const opEntites: Record<string, string[]> = {};
  for (const l of (liens ?? []) as any[]) {
    if (!l.operation_id) continue;
    (opEntites[l.operation_id] ??= []).push(l.entites?.nom ?? "—");
  }

  return (
    <main className="wrap">
      <div className="page-head">
        <Link className="backlink" href="/tableau">‹ Retour au tableau de bord</Link>
        <div className="section-t">
          <h2>
            <span
              className="dot"
              style={{
                display: "inline-block",
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: `var(${STATUT_VAR[st]})`,
                marginRight: 9,
              }}
            />
            {STATUT_LABELS[st]}
          </h2>
          <span>
            {operations.length} affaire{operations.length > 1 ? "s" : ""} à cette étape
          </span>
        </div>
      </div>

      {operations.length ? (
        <div className="vlist">
          {operations.map((o) => {
            const montant = euro(o.montant_estime);
            const ents = opEntites[o.id] ?? [];
            return (
              <Link className="op" href={`/operations/${o.id}`} key={o.id}>
                <div className="onm">{o.nom}</div>
                {(ents.length > 0 || montant) && (
                  <div className="ometa">
                    {ents.map((nom, i) => (
                      <span className="chip ent" key={i}>
                        {nom}
                      </span>
                    ))}
                    {montant && <span className="amt">{montant}</span>}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card"><span className="empty">Aucune affaire à cette étape.</span></div>
      )}
    </main>
  );
}
