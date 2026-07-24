import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { STATUT_LABELS, type OperationStatut } from "@/lib/types";

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

export default async function FichePersonne({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: c } = await supabase
    .from("contacts")
    .select("id, nom, prenom, fonction, tel, email, entite_id")
    .eq("id", id)
    .maybeSingle();

  if (!c) notFound();
  const contact = c as {
    id: string; nom: string; prenom: string | null; fonction: string | null;
    tel: string | null; email: string | null; entite_id: string | null;
  };

  // Sa structure + les affaires de cette structure (contexte).
  const [{ data: structure }, { data: liens }] = await Promise.all([
    contact.entite_id
      ? supabase.from("entites").select("id, nom, type").eq("id", contact.entite_id).maybeSingle()
      : Promise.resolve({ data: null }),
    contact.entite_id
      ? supabase.from("entite_operation").select("operations(id, nom, statut, montant_estime)").eq("entite_id", contact.entite_id)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const struct = structure as { id: string; nom: string; type: string } | null;
  const operations = ((liens ?? []) as any[])
    .map((l) => l.operations)
    .filter(Boolean)
    .sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr"));

  const nomComplet = [contact.prenom, contact.nom].filter(Boolean).join(" ") || contact.nom;

  return (
    <main className="wrap">
      <Link className="back" href="/tableau">← Retour au tableau de bord</Link>

      {struct && (
        <div className="page-actions">
          <Link className="btn ghost" href={`/crs/vocal?entite=${struct.id}`}>🎙 Dicter un CR</Link>
        </div>
      )}

      <div className="fiche-head">
        <div>
          <div className="eyebrow">Fiche personne</div>
          <h1>{nomComplet}</h1>
        </div>
      </div>

      <div className="blocks">
        <div className="block">
          <div className="block-h">
            <div className="eyebrow">Repères</div>
            {struct && (
              <Link className="sig-d struct" href={`/entites/${struct.id}`}>
                <span className="sig-lbl">{struct.nom}</span>
              </Link>
            )}
          </div>
          <div className="kv"><span className="k">Fonction</span><span>{contact.fonction || "—"}</span></div>
          {contact.tel && <div className="kv"><span className="k">Téléphone</span><span>{contact.tel}</span></div>}
          {contact.email && <div className="kv"><span className="k">E-mail</span><span>{contact.email}</span></div>}
          {(contact.tel || contact.email) && (
            <div className="contact-acts" style={{ marginTop: 12 }}>
              {contact.tel && <a className="btn ghost mini" href={`tel:${contact.tel}`}>Appeler</a>}
              {contact.email && <a className="btn ghost mini" href={`mailto:${contact.email}`}>E-mail</a>}
            </div>
          )}
        </div>

        {struct && (
          <div className="block">
            <div className="eyebrow">Opérations de sa structure</div>
            {operations.length ? (
              <div className="vlist">
                {operations.map((o: any) => {
                  const montant = euro(o.montant_estime);
                  const st = o.statut as OperationStatut;
                  return (
                    <div className="op" key={o.id}>
                      <Link className="onm" href={`/operations/${o.id}`}>{o.nom}</Link>
                      <div className="ometa">
                        <Link className="sig-d phase" href={`/operations/phase/${st}`} style={{ ["--cat" as string]: `var(${STATUT_VAR[st]})` }}>
                          <span className="sig-lbl">{STATUT_LABELS[st] ?? st}</span>
                        </Link>
                        {montant && <span className="amt">{montant}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">Aucune affaire rattachée à sa structure.</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
