import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { STATUT_LABELS, type OperationStatut } from "@/lib/types";
import BackButton from "@/components/BackButton";
import Signet from "@/components/Signet";
import { normNom } from "@/lib/personnes";

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

function dateFr(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export default async function FichePersonne({ params }: { params: Promise<{ id: string }> }) {
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

  // Sa structure + les affaires de cette structure (contexte) + les relances.
  const [{ data: structure }, { data: liens }, { data: relances }] = await Promise.all([
    contact.entite_id
      ? supabase.from("entites").select("id, nom, type").eq("id", contact.entite_id).maybeSingle()
      : Promise.resolve({ data: null }),
    contact.entite_id
      ? supabase.from("entite_operation").select("operations(id, nom, statut, montant_estime)").eq("entite_id", contact.entite_id)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("relances").select("*, operations(nom)").eq("statut", "a_faire").order("date_echeance", { ascending: true }),
  ]);

  const struct = structure as { id: string; nom: string; type: string } | null;
  const operations = ((liens ?? []) as any[])
    .map((l) => l.operations)
    .filter(Boolean)
    .sort((a: any, b: any) => a.nom.localeCompare(b.nom, "fr"));

  const nomComplet = [contact.prenom, contact.nom].filter(Boolean).join(" ") || contact.nom;

  // Prochaine relance qui concerne cette personne : d'abord une relance qui la
  // nomme explicitement, sinon la prochaine relance de sa structure / de ses
  // affaires (fonctionne même sans la colonne « personne »). Les relances sont
  // déjà triées par échéance croissante.
  const nomNorm = normNom(nomComplet);
  const opIds = new Set(operations.map((o: any) => o.id));
  const rlist = (relances ?? []) as any[];
  const prochaine =
    rlist.find((r) => r.personne && normNom(r.personne) === nomNorm) ??
    rlist.find(
      (r) => (contact.entite_id && r.entite_id === contact.entite_id) || (r.operation_id && opIds.has(r.operation_id)),
    ) ??
    null;
  const prochaineHref = prochaine
    ? (prochaine.operation_id ? `/operations/${prochaine.operation_id}` : "/relances")
    : null;

  return (
    <main className="wrap">
      <BackButton />

      <div className="page-actions">
        {struct && <Link className="btn ghost" href={`/crs/vocal?entite=${struct.id}`}>🎙 Dicter un CR</Link>}
        <Link className="btn ghost" href={`/personnes/${contact.id}/modifier`}>Modifier</Link>
      </div>

      <div className="fiche-head">
        <div>
          <div className="eyebrow">Fiche personne</div>
          <h1>{nomComplet}</h1>
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
            {struct && <Signet type="entite" id={struct.id} cat="struct" label={struct.nom} />}
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
