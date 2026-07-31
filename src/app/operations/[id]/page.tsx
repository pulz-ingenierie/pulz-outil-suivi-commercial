import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { type Operation, type OperationStatut } from "@/lib/types";
import FilCr from "@/components/FilCr";
import PhaseSelect from "./PhaseSelect";
import BackButton from "@/components/BackButton";
import Signet from "@/components/Signet";
import RelanceRow from "@/components/RelanceRow";
import { indexerLiens, personnesDeRelance } from "@/lib/personnes";

export const dynamic = "force-dynamic";

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
        <BackButton />
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
  const [{ data: referent }, { data: liensEnt }, { data: relances }, { data: crLiens }, { data: contacts }, { data: membres }, { data: persLiens }] = await Promise.all([
    operation.referent_id
      ? supabase.from("utilisateurs").select("nom").eq("id", operation.referent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("entite_operation").select("role_entree, entites(id, nom, type, ville)").eq("operation_id", id),
    supabase.from("relances").select("*").eq("operation_id", id),
    supabase.from("cr_operations").select("crs(id, date_rdv, type_rdv, transcription, synthese, auteur:utilisateurs(nom))").eq("operation_id", id),
    supabase.from("contacts").select("id, nom, prenom"),
    supabase.from("utilisateurs").select("id, nom"),
    // Personnes (contacts) directement associées à cette affaire — on lit les
    // identifiants puis les fiches séparément (plus robuste qu'une jointure).
    supabase.from("contact_operation").select("contact_id").eq("operation_id", id),
  ]);

  const st = operation.statut;
  const today = new Date().toISOString().slice(0, 10);
  const liensPersonnes = indexerLiens((contacts ?? []) as any, (membres ?? []) as any);
  const entites = (liensEnt ?? []).map((l: any) => ({ role: l.role_entree, ...(l.entites ?? {}) })).filter((e: any) => e.nom);
  const crs = (crLiens ?? []).map((c: any) => c.crs).filter(Boolean)
    .sort((a: any, b: any) => (a.date_rdv < b.date_rdv ? 1 : -1));
  const rels = (relances ?? []).filter((r: any) => r.statut === "a_faire");
  const contactIds = (persLiens ?? []).map((l: any) => l.contact_id).filter(Boolean);
  let personnesLiees: any[] = [];
  if (contactIds.length) {
    const { data: cts } = await supabase.from("contacts").select("id, nom, prenom, fonction").in("id", contactIds);
    personnesLiees = (cts ?? []).sort((a: any, b: any) => String(a.nom).localeCompare(String(b.nom), "fr"));
  }

  return (
    <main className="wrap">
      <BackButton />

      <div className="page-actions">
        <Link className="btn ghost" href={`/crs/vocal?operation=${operation.id}`}>Dicter un CR</Link>
        <Link className="btn" href={`/operations/${operation.id}/modifier`}>Modifier</Link>
      </div>

      <div className="fiche-head">
        <div>
          <div className="eyebrow">Fiche opération</div>
          <h1>{operation.nom}</h1>
        </div>
      </div>

      <div className="blocks">
        <div className="block">
          <div className="block-h">
            <div>
              <div className="eyebrow">Repères</div>
              <Link className="phase-voir" href={`/operations/phase/${st}`}>Voir toutes les affaires de cette étape ›</Link>
            </div>
            <PhaseSelect id={operation.id} statut={st} />
          </div>
          <div className="kv"><span className="k">Référent</span><span>{referent?.nom ?? "—"}</span></div>
          <div className="kv"><span className="k">Ville</span>
            <span className={`sig-d ville${operation.ville ? "" : " vide"}`}><span className="sig-lbl">{operation.ville || "✕ à compléter"}</span></span>
          </div>
          {operation.montant_estime != null && (
            <div className="kv"><span className="k">Montant estimé</span><span>{euro(operation.montant_estime)}</span></div>
          )}
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
              <Signet key={e.id} type="entite" id={e.id} cat="struct" label={e.nom}
                sub={(e.role || e.type) ? `${e.role || e.type}${e.ville ? ` · ${e.ville}` : ""}` : undefined}
                parent={{ type: "operation", id: operation.id, nom: operation.nom }} />
            ))}</div>
          ) : <div className="empty">Aucune structure rattachée.</div>}
        </div>

        {personnesLiees.length > 0 && (
          <div className="block">
            <div className="eyebrow">Personnes à joindre — contacts de l'affaire</div>
            <div className="sig-wrap">
              {personnesLiees.map((c: any) => {
                const nomComplet = [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom;
                return <Signet key={c.id} type="personne" id={c.id} cat="pers" label={nomComplet}
                  sub={c.fonction || undefined}
                  parent={{ type: "operation", id: operation.id, nom: operation.nom }} />;
              })}
            </div>
          </div>
        )}

        <div className="block">
          <div className="eyebrow">Fil des comptes rendus</div>
          <FilCr crs={crs} liens={liensPersonnes} />
        </div>

        <div className="block">
          <div className="eyebrow">Prochaines relances</div>
          {rels.length ? (
            <div className="vlist2">
              {rels.map((r: any) => (
                <RelanceRow
                  key={r.id}
                  id={r.id}
                  objet={r.objet}
                  echeance={dateFr(r.date_echeance)}
                  enRetard={r.date_echeance < today}
                  structs={entites.map((e: any) => ({ id: e.id, nom: e.nom }))}
                  personnes={personnesDeRelance(r.personne, liensPersonnes)}
                />
              ))}
            </div>
          ) : <div className="empty">Aucune relance planifiée.</div>}
        </div>
      </div>
    </main>
  );
}
