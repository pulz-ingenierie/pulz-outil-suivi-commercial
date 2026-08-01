import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { type OperationStatut } from "@/lib/types";
import FilCr from "@/components/FilCr";
import BackButton from "@/components/BackButton";
import Signet from "@/components/Signet";
import OperationRow from "@/components/OperationRow";
import RelanceRow from "@/components/RelanceRow";
import { indexerLiens, personnesDeRelance } from "@/lib/personnes";

export const dynamic = "force-dynamic";

// Libellé lisible du type de structure (l'enum inclut « bet »).
const TYPE_ENTITE: Record<string, string> = {
  MOA: "Maître d'ouvrage",
  archi: "Architecte",
  promoteur: "Promoteur",
  bet: "Bureau d'études (BET)",
  confrere: "Confrère",
  autre: "Structure",
};

function dateFr(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export default async function FicheStructure({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: ent } = await supabase
    .from("entites")
    .select("id, nom, type, ville, statut_vie")
    .eq("id", id)
    .maybeSingle();

  if (!ent) notFound();
  const entite = ent as { id: string; nom: string; type: string; ville: string | null; statut_vie: string | null };

  // Données liées : toutes ses opérations, ses personnes, ses comptes rendus.
  const [{ data: liens }, { data: contacts }, { data: crLiens }, { data: tousContacts }, { data: membres }] = await Promise.all([
    supabase.from("entite_operation").select("role_entree, operations(id, nom, statut, montant_estime)").eq("entite_id", id),
    supabase.from("contacts").select("id, nom, prenom, fonction, tel, email").eq("entite_id", id),
    supabase.from("cr_entites").select("crs(id, date_rdv, type_rdv, transcription, synthese, auteur:utilisateurs(nom))").eq("entite_id", id),
    supabase.from("contacts").select("id, nom, prenom"),
    supabase.from("utilisateurs").select("id, nom"),
  ]);
  const liensPersonnes = indexerLiens((tousContacts ?? []) as any, (membres ?? []) as any);

  const operations = (liens ?? [])
    .map((l: any) => ({ role: l.role_entree, ...(l.operations ?? {}) }))
    .filter((o: any) => o.id)
    .sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr"));
  // Personnes de la structure = ses contacts directs (entite_id) + les contacts
  // de ses opérations (lien contact_operation) — un « contact du promoteur »
  // rattaché à une affaire doit aussi apparaître ici.
  const persMap = new Map<string, any>();
  for (const c of (contacts ?? []) as any[]) persMap.set(c.id, c);
  const opIdsPers = operations.map((o: any) => o.id).filter(Boolean);
  if (opIdsPers.length) {
    const { data: co } = await supabase.from("contact_operation").select("contact_id").in("operation_id", opIdsPers);
    const cids = [...new Set((co ?? []).map((x: any) => x.contact_id).filter(Boolean))].filter((cid) => !persMap.has(cid as string));
    if (cids.length) {
      const { data: cts } = await supabase.from("contacts").select("id, nom, prenom, fonction, tel, email").in("id", cids as string[]);
      for (const c of (cts ?? []) as any[]) persMap.set(c.id, c);
    }
  }
  const personnes = [...persMap.values()].sort((a: any, b: any) => String(a.nom).localeCompare(String(b.nom), "fr"));
  const crs = (crLiens ?? [])
    .map((c: any) => c.crs)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.date_rdv < b.date_rdv ? 1 : -1));
  const dernierContact = crs.length ? crs[0].date_rdv : null;

  // Relances propres à la structure : directes OU via l'une de ses opérations.
  const today = new Date().toISOString().slice(0, 10);
  const opIds = operations.map((o: any) => o.id).filter(Boolean);
  const orParts = [`entite_id.eq.${id}`];
  if (opIds.length) orParts.push(`operation_id.in.(${opIds.join(",")})`);
  const { data: relRows } = await supabase
    .from("relances")
    .select("id, objet, date_echeance, personne, operation_id, operations(nom)")
    .eq("statut", "a_faire")
    .or(orParts.join(","))
    .order("date_echeance", { ascending: true });
  const vusRel = new Set<string>();
  const relances = (relRows ?? []).filter((r: any) => { if (vusRel.has(r.id)) return false; vusRel.add(r.id); return true; });

  const typeLbl = TYPE_ENTITE[entite.type] ?? entite.type;

  return (
    <main className="wrap">
      <BackButton />

      <div className="page-actions">
        <Link className="btn ghost" href={`/crs/vocal?entite=${entite.id}`}>Dicter un CR</Link>
        <Link className="btn ghost" href={`/entites/${entite.id}/modifier`}>Modifier</Link>
      </div>

      <div className="fiche-head">
        <div>
          <div className="eyebrow">Fiche structure</div>
          <h1>{entite.nom}</h1>
        </div>
      </div>

      <div className="blocks">
        <div className="block">
          <div className="block-h">
            <div className="eyebrow">Repères</div>
            <span className="sig-d type"><span className="sig-lbl">{typeLbl}</span></span>
          </div>
          <div className="kv"><span className="k">Ville</span><span>{entite.ville || "—"}</span></div>
          <div className="kv"><span className="k">Dernier contact</span><span>{dateFr(dernierContact)}</span></div>
          {entite.statut_vie === "dormant" && (
            <div className="kv"><span className="k">État</span><span><span className="pill dormant">en sommeil</span></span></div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Prochaines relances</div>
          {relances.length ? (
            <div className="vlist2">
              {relances.map((r: any) => (
                <RelanceRow
                  key={r.id}
                  id={r.id}
                  objet={r.objet}
                  echeance={dateFr(r.date_echeance)}
                  enRetard={r.date_echeance < today}
                  op={r.operation_id && r.operations?.nom ? { id: r.operation_id, nom: r.operations.nom } : null}
                  personnes={personnesDeRelance(r.personne, liensPersonnes)}
                />
              ))}
            </div>
          ) : (
            <div className="empty">Aucune relance planifiée pour cette structure.</div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Opérations — toutes les affaires de cette structure</div>
          {operations.length ? (
            <div className="vlist2">
              {operations.map((o: any) => (
                <OperationRow key={o.id} id={o.id} nom={o.nom} statut={o.statut as OperationStatut} montant={o.montant_estime} role={o.role} />
              ))}
            </div>
          ) : (
            <div className="empty">Aucune opération rattachée — piste du réseau.</div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Personnes à joindre</div>
          {personnes.length ? (
            <div className="sig-wrap">
              {personnes.map((c: any) => {
                const nomComplet = [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom;
                return <Signet key={c.id} type="personne" id={c.id} cat="pers" label={nomComplet} parent={{ type: "entite", id: entite.id, nom: entite.nom }} />;
              })}
            </div>
          ) : (
            <div className="empty">Aucune personne enregistrée pour cette structure.</div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Fil des comptes rendus</div>
          <FilCr crs={crs} liens={liensPersonnes} />
        </div>
      </div>
    </main>
  );
}
