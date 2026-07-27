import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { updateRelance } from "@/lib/actions";
import { indexerLiens, lienPersonne } from "@/lib/personnes";
import BackButton from "@/components/BackButton";
import Signet from "@/components/Signet";
import ReporterRelance from "@/components/ReporterRelance";

export const dynamic = "force-dynamic";

function dateFr(d: string): string {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}
function plusJours(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Fiche d'une relance : échéance, objet, signets associés et actions. Surface de
// détail unique (taper une ligne de relance ouvre cette page).
export default async function FicheRelance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured()) notFound();
  const supabase = getServerSupabase()!;

  const { data: r } = await supabase
    .from("relances")
    .select("*, operations(id, nom), entites(id, nom)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const rel = r as any;

  const [{ data: utilisateurs }, { data: contacts }] = await Promise.all([
    supabase.from("utilisateurs").select("id, nom").eq("actif", true),
    supabase.from("contacts").select("id, nom, prenom"),
  ]);
  const personnesIdx = indexerLiens((contacts ?? []) as any, (utilisateurs ?? []) as any);

  // Structures liées : via les structures de l'opération, sinon la structure directe.
  let structs: { id: string; nom: string }[] = [];
  if (rel.operation_id) {
    const { data: liens } = await supabase
      .from("entite_operation")
      .select("entites(id, nom)")
      .eq("operation_id", rel.operation_id);
    structs = (liens ?? []).map((l: any) => l.entites).filter(Boolean);
  } else if (rel.entite_id && rel.entites?.nom) {
    structs = [{ id: rel.entite_id, nom: rel.entites.nom }];
  }
  const vus = new Set<string>();
  structs = structs.filter((s) => {
    const k = (s.nom ?? "").trim().toLowerCase();
    if (!k || vus.has(k)) return false;
    vus.add(k);
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const enRetard = rel.date_echeance < today;
  const personnes = String(rel.personne ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
  const crHref = rel.operation_id
    ? `/crs/vocal?operation=${rel.operation_id}&relance=${rel.id}`
    : rel.entite_id
      ? `/crs/vocal?entite=${rel.entite_id}&relance=${rel.id}`
      : `/crs/vocal?relance=${rel.id}`;

  return (
    <main className="wrap">
      <BackButton fallback="/relances" />
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Relance</div>
          <h1>{rel.objet}</h1>
        </div>
      </div>

      <div className="blocks">
        <div className="block">
          <div className={`kv${enRetard ? " crit" : ""}`}>
            <span className="k">Échéance</span>
            <span>{dateFr(rel.date_echeance)}{enRetard ? " · en retard" : ""}</span>
          </div>
        </div>

        {rel.operations?.nom && (
          <div className="block">
            <div className="eyebrow">Opération</div>
            <div className="sig-wrap"><Signet type="operation" id={rel.operation_id} cat="op" label={rel.operations.nom} /></div>
          </div>
        )}

        {structs.length > 0 && (
          <div className="block">
            <div className="eyebrow">Structures</div>
            <div className="sig-wrap">{structs.map((s) => <Signet key={s.id} type="entite" id={s.id} cat="struct" label={s.nom} />)}</div>
          </div>
        )}

        {personnes.length > 0 && (
          <div className="block">
            <div className="eyebrow">{personnes.length > 1 ? "Personnes à relancer" : "Personne à relancer"}</div>
            <div className="sig-wrap">
              {personnes.map((nom: string) => {
                const href = lienPersonne(personnesIdx, nom);
                return href
                  ? <Link key={nom} className="sig-d pers" href={href}><span className="sig-lbl">{nom}</span></Link>
                  : <span key={nom} className="sig-d pers"><span className="sig-lbl">{nom}</span></span>;
              })}
            </div>
          </div>
        )}

        <div className="block">
          <div className="eyebrow">Actions</div>
          <div className="rel-acts">
            <Link className="btn" href={crHref}>Nouveau compte rendu</Link>
            <div className="rel-acts-row">
              <form action={updateRelance}>
                <input type="hidden" name="id" value={rel.id} />
                <input type="hidden" name="action" value="faite" />
                <button className="btn ghost mini" type="submit">Fait</button>
              </form>
              <ReporterRelance id={rel.id} defaultDate={plusJours(7)} />
              <form action={updateRelance}>
                <input type="hidden" name="id" value={rel.id} />
                <input type="hidden" name="action" value="abandonner" />
                <button className="btn ghost mini danger" type="submit">Abandonner</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
