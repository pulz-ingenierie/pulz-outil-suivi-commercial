import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { type OperationStatut } from "@/lib/types";
import { normNom } from "@/lib/personnes";
import BackButton from "@/components/BackButton";
import OperationRow from "@/components/OperationRow";

export const dynamic = "force-dynamic";

function dateFr(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export default async function FicheMembre({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: u } = await supabase
    .from("utilisateurs")
    .select("id, nom, email, role, societe_label")
    .eq("id", id)
    .maybeSingle();

  if (!u) notFound();
  const membre = u as { id: string; nom: string; email: string | null; role: string; societe_label: string | null };

  // Ses affaires (référent) + les relances qui le concernent (assignée OU personne).
  const [{ data: ops }, { data: relances }] = await Promise.all([
    supabase.from("operations").select("id, nom, statut, montant_estime").eq("referent_id", id),
    supabase.from("relances").select("*, operations(nom), entites(nom)").eq("statut", "a_faire"),
  ]);

  const operations = (ops ?? []).sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr"));
  const nomNorm = normNom(membre.nom);
  const rels = (relances ?? [])
    .filter((r: any) => r.assignee_id === id || (r.personne && normNom(r.personne) === nomNorm))
    .sort((a: any, b: any) => (a.date_echeance < b.date_echeance ? -1 : 1));
  const prochaine = rels[0] ?? null;
  const prochaineHref = prochaine
    ? (prochaine.operation_id ? `/operations/${prochaine.operation_id}` : "/relances")
    : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="wrap">
      <BackButton />

      <div className="fiche-head">
        <div>
          <div className="eyebrow">Fiche membre · équipe</div>
          <h1>{membre.nom}</h1>
        </div>
      </div>

      {prochaine && (
        <div className="sig-wrap" style={{ marginBottom: 16 }}>
          <Link className="sig-d rel" href={prochaineHref!}>
            <span className="sig-lbl">Prochaine relance · {dateFr(prochaine.date_echeance)}</span>
          </Link>
        </div>
      )}

      <div className="blocks">
        <div className="block">
          <div className="block-h">
            <div className="eyebrow">Repères</div>
            <span className="sig-d type"><span className="sig-lbl">{membre.role === "pilote" ? "Pilote" : "Membre"}</span></span>
          </div>
          {membre.societe_label && <div className="kv"><span className="k">Société</span><span>{membre.societe_label}</span></div>}
          {membre.email && <div className="kv"><span className="k">E-mail</span><span>{membre.email}</span></div>}
          {membre.email && (
            <div className="contact-acts" style={{ marginTop: 12 }}>
              <a className="btn ghost mini" href={`mailto:${membre.email}`}>E-mail</a>
            </div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Affaires dont il est référent</div>
          {operations.length ? (
            <div className="vlist2">
              {operations.map((o: any) => (
                <OperationRow key={o.id} id={o.id} nom={o.nom} statut={o.statut as OperationStatut} montant={o.montant_estime} />
              ))}
            </div>
          ) : (
            <div className="empty">Aucune affaire dont il est référent.</div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Relances qui le concernent</div>
          {rels.length ? (
            <div className="fil">
              {rels.map((r: any) => {
                const late = r.date_echeance < today;
                const cibleNom = r.operations?.nom ?? r.entites?.nom ?? null;
                return (
                  <div className="rel-line" key={r.id}>
                    <span className="rel-line-obj">{r.objet}</span>
                    <div className="sig-wrap">
                      {cibleNom && <span className="sig-d op"><span className="sig-lbl">{cibleNom}</span></span>}
                      <span className={`sig-d date${late ? " late" : ""}`}><span className="sig-lbl">{dateFr(r.date_echeance)}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">Aucune relance en cours pour lui.</div>
          )}
        </div>
      </div>
    </main>
  );
}
