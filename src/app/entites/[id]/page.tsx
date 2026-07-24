import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { STATUT_LABELS, type OperationStatut } from "@/lib/types";
import FilCr from "@/components/FilCr";

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

// Libellé lisible du type de structure (l'enum inclut « bet »).
const TYPE_ENTITE: Record<string, string> = {
  MOA: "Maître d'ouvrage",
  archi: "Architecte",
  promoteur: "Promoteur",
  bet: "Bureau d'études (BET)",
  confrere: "Confrère",
  autre: "Structure",
};

function euro(n: number | null): string | null {
  if (n == null) return null;
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

export default async function FicheStructure({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: ent } = await supabase
    .from("entites")
    .select("id, nom, type, ville, statut_vie")
    .eq("id", id)
    .maybeSingle();

  if (!ent) notFound();
  const entite = ent as { id: string; nom: string; type: string; ville: string | null; statut_vie: string | null };

  // Données liées : toutes ses opérations, ses personnes, ses comptes rendus.
  const [{ data: liens }, { data: contacts }, { data: crLiens }] = await Promise.all([
    supabase.from("entite_operation").select("role_entree, operations(id, nom, statut, montant_estime)").eq("entite_id", id),
    supabase.from("contacts").select("id, nom, prenom, fonction, tel, email").eq("entite_id", id),
    supabase.from("cr_entites").select("crs(id, date_rdv, type_rdv, transcription, synthese)").eq("entite_id", id),
  ]);

  const operations = (liens ?? [])
    .map((l: any) => ({ role: l.role_entree, ...(l.operations ?? {}) }))
    .filter((o: any) => o.id)
    .sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr"));
  const personnes = (contacts ?? []).sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr"));
  const crs = (crLiens ?? [])
    .map((c: any) => c.crs)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.date_rdv < b.date_rdv ? 1 : -1));
  const dernierContact = crs.length ? crs[0].date_rdv : null;

  const typeLbl = TYPE_ENTITE[entite.type] ?? entite.type;

  return (
    <main className="wrap">
      <Link className="back" href="/tableau">← Retour au tableau de bord</Link>

      <div className="fiche-head">
        <div>
          <div className="eyebrow">Fiche structure</div>
          <h1>{entite.nom}</h1>
        </div>
        <div className="head-actions">
          <span className="sig-d type"><span className="sig-lbl">{typeLbl}</span></span>
          <div className="btns">
            <Link className="btn ghost" href={`/crs/vocal?entite=${entite.id}`}>🎙 Dicter un CR</Link>
          </div>
        </div>
      </div>

      <div className="blocks">
        <div className="block">
          <div className="eyebrow">Repères</div>
          <div className="kv"><span className="k">Type</span><span>{typeLbl}</span></div>
          <div className="kv"><span className="k">Ville</span><span>{entite.ville || "—"}</span></div>
          <div className="kv"><span className="k">Dernier contact</span><span>{dateFr(dernierContact)}</span></div>
          {entite.statut_vie === "dormant" && (
            <div className="kv"><span className="k">État</span><span><span className="pill dormant">en sommeil</span></span></div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Opérations — toutes les affaires de cette structure</div>
          {operations.length ? (
            <div className="vlist">
              {operations.map((o: any) => {
                const montant = euro(o.montant_estime);
                const st = o.statut as OperationStatut;
                return (
                  <Link className="op" href={`/operations/${o.id}`} key={o.id}>
                    <div className="onm">{o.nom}</div>
                    <div className="ometa">
                      <span className="sig-d phase" style={{ ["--cat" as string]: `var(${STATUT_VAR[st]})` }}>
                        <span className="sig-lbl">{STATUT_LABELS[st] ?? st}</span>
                      </span>
                      {o.role && <span className="sig-d struct"><span className="sig-lbl">{o.role}</span></span>}
                      {montant && <span className="amt">{montant}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty">Aucune opération rattachée — piste du réseau.</div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Personnes à joindre</div>
          {personnes.length ? (
            <div className="persons">
              {personnes.map((c: any) => {
                const nomComplet = [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom;
                return (
                  <div className="person" key={c.id}>
                    <div className="pmain">
                      <span className="pnm">{nomComplet}</span>
                      {c.fonction && <span className="pfn">{c.fonction}</span>}
                    </div>
                    {(c.tel || c.email) && (
                      <div className="contact-acts">
                        {c.tel && <a className="btn ghost mini" href={`tel:${c.tel}`}>Appeler</a>}
                        {c.email && <a className="btn ghost mini" href={`mailto:${c.email}`}>E-mail</a>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">Aucune personne enregistrée pour cette structure.</div>
          )}
        </div>

        <div className="block">
          <div className="eyebrow">Fil des comptes rendus</div>
          <FilCr crs={crs} />
        </div>
      </div>
    </main>
  );
}
