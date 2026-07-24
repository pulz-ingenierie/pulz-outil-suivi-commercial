import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { STATUT_LABELS, type Operation, type OperationStatut } from "@/lib/types";
import FilCr from "@/components/FilCr";

export const dynamic = "force-dynamic";

const STATUT_VAR: Record<OperationStatut, string> = {
  contact: "--s-contact",
  qualifie: "--s-qualifie",
  ao_attente: "--s-ao",
  offre_remise: "--s-offre",
  nego: "--s-nego",
  gagne: "--s-gagne",
  perdu: "--s-perdu",
};

function euro(n: number | null): string {
  if (n == null) return "— (non renseigné)";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function dateFr(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export default async function FicheOperation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/tableau">← Retour au tableau de bord</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;

  const { data: op } = await supabase
    .from("operations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!op) notFound();
  const operation = op as Operation;

  // Données liées (requêtes simples, robustes)
  const [{ data: referent }, { data: liens }, { data: relances }, { data: crLiens }] = await Promise.all([
    operation.referent_id
      ? supabase.from("utilisateurs").select("nom").eq("id", operation.referent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("entite_operation").select("role_entree, entites(id, nom, type, ville)").eq("operation_id", id),
    supabase.from("relances").select("id, objet, date_echeance, auto, statut").eq("operation_id", id),
    supabase.from("cr_operations").select("crs(id, date_rdv, type_rdv, transcription, synthese)").eq("operation_id", id),
  ]);

  const st = operation.statut;
  const today = new Date().toISOString().slice(0, 10);
  const entites = (liens ?? []).map((l: any) => ({ role: l.role_entree, ...(l.entites ?? {}) })).filter((e: any) => e.nom);
  const crs = (crLiens ?? []).map((c: any) => c.crs).filter(Boolean)
    .sort((a: any, b: any) => (a.date_rdv < b.date_rdv ? 1 : -1));
  const rels = (relances ?? []).filter((r: any) => r.statut === "a_faire");

  return (
    <main className="wrap">
      <Link className="back" href="/tableau">← Retour au tableau de bord</Link>

      <div className="fiche-head">
        <div>
          <div className="eyebrow">Fiche opération</div>
          <h1>{operation.nom}</h1>
        </div>
        <div className="head-actions">
          <Link className="sig-d phase" href={`/operations/phase/${st}`} style={{ ["--cat" as string]: `var(${STATUT_VAR[st]})` }}>
            <span className="sig-lbl">{STATUT_LABELS[st]}</span>
          </Link>
          <div className="btns">
            <Link className="btn ghost" href={`/crs/vocal?operation=${operation.id}`}>🎙 Dicter un CR</Link>
            <Link className="btn" href={`/operations/${operation.id}/modifier`}>Modifier</Link>
          </div>
        </div>
      </div>

      <div className="blocks">
        <div className="block">
          <div className="eyebrow">Repères</div>
          <div className="kv"><span className="k">Référent</span><span>{referent?.nom ?? "—"}</span></div>
          <div className="kv"><span className="k">Montant estimé</span><span>{euro(operation.montant_estime)}</span></div>
          {operation.description && (
            <div className="kv"><span className="k">Description</span><span style={{ maxWidth: "60%", textAlign: "right" }}>{operation.description}</span></div>
          )}
          {st === "perdu" && operation.raison_perte && (
            <div className="kv"><span className="k">Raison de la perte</span><span style={{ maxWidth: "60%", textAlign: "right" }}>{operation.raison_perte}</span></div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Structures — portes d'entrée</div>
          {entites.length ? (
            <div className="sig-wrap">{entites.map((e: any) => (
              <Link className="sig-d struct" href={`/entites/${e.id}`} key={e.id}>
                <span className="sig-lbl">{e.nom}</span>
                {(e.role || e.type) && <span className="sig-sub">{e.role || e.type}{e.ville ? ` · ${e.ville}` : ""}</span>}
              </Link>
            ))}</div>
          ) : <div className="empty">Aucune structure rattachée.</div>}
        </div>

        <div className="block">
          <div className="eyebrow">Fil des comptes rendus</div>
          <FilCr crs={crs} />
        </div>

        <div className="block">
          <div className="eyebrow">Prochaines relances</div>
          {rels.length ? rels.map((r: any) => (
            <div className="kv" key={r.id}>
              <span className="k">{r.objet}</span>
              <span>{r.date_echeance < today
                ? <span className="pill retard">retard · {dateFr(r.date_echeance)}</span>
                : (r.auto ? <span className="pill auto">auto · {dateFr(r.date_echeance)}</span> : dateFr(r.date_echeance))}</span>
            </div>
          )) : <div className="empty">Aucune relance planifiée.</div>}
        </div>
      </div>
    </main>
  );
}
