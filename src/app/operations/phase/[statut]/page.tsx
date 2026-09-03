import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  STATUT_LABELS,
  STATUT_ORDRE,
  type Operation,
  type OperationStatut,
} from "@/lib/types";
import OperationRow from "@/components/OperationRow";
import { manquesOperation } from "@/lib/completude";

export const dynamic = "force-dynamic";

const STATUT_VAR: Record<string, string> = {
  piste: "--s-piste",
  qualifie: "--s-qualifie",
  concours: "--s-concours",
  a_chiffrer: "--s-chiffrer",
  offre_remise: "--s-offre",
  nego: "--s-nego",
  gagne: "--s-gagne",
  perdu: "--s-perdu",
};

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
  const [{ data: ops, error }, { data: liensEnt }] = await Promise.all([
    supabase.from("operations").select("*").eq("statut", st).order("created_at", { ascending: false }),
    supabase.from("entite_operation").select("operation_id"),
  ]);
  const avecStructure = new Set(((liensEnt ?? []) as any[]).map((l) => l.operation_id));

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
        <div className="vlist2">
          {operations.map((o) => (
            <OperationRow key={o.id} id={o.id} nom={o.nom} statut={o.statut} montant={o.montant_estime}
              incomplet={manquesOperation({ id: o.id, ville: o.ville, referent_id: o.referent_id, aStructure: avecStructure.has(o.id) }).length > 0} />
          ))}
        </div>
      ) : (
        <div className="card"><span className="empty">Aucune affaire à cette étape.</span></div>
      )}
    </main>
  );
}
