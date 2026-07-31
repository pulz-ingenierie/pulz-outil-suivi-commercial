import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { type OperationStatut } from "@/lib/types";
import BackButton from "@/components/BackButton";
import Signet from "@/components/Signet";
import OperationRow from "@/components/OperationRow";
import RelanceRow from "@/components/RelanceRow";
import AssocierAffaire from "@/components/AssocierAffaire";
import { normNom } from "@/lib/personnes";

export const dynamic = "force-dynamic";

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

  // Affaires dont la personne est le CONTACT (lien direct contact_operation) +
  // toutes les affaires de l'organisation (pour en associer d'autres).
  const [{ data: coLiens }, { data: toutesOps }] = await Promise.all([
    supabase.from("contact_operation").select("operation_id").eq("contact_id", id),
    supabase.from("operations").select("id, nom, statut").order("nom"),
  ]);
  const idsAssociees = new Set(((coLiens ?? []) as any[]).map((l) => l.operation_id).filter(Boolean));
  const toutes = ((toutesOps ?? []) as any[]).map((o) => ({ id: o.id, nom: o.nom, statut: o.statut }));
  const affairesAssociees = toutes.filter((o) => idsAssociees.has(o.id));
  const affairesDisponibles = toutes.filter((o) => !idsAssociees.has(o.id));

  const nomComplet = [contact.prenom, contact.nom].filter(Boolean).join(" ") || contact.nom;

  // Relances qui concernent cette personne : celles qui la nomment, + celles de
  // sa structure / de ses affaires. Les relances sont triées par échéance.
  const today = new Date().toISOString().slice(0, 10);
  const nomNorm = normNom(nomComplet);
  // Affaires de la personne = celles de sa structure + celles dont elle est le
  // contact direct (contact_operation) : ses relances portent sur les deux.
  const opIds = new Set<string>([...operations.map((o: any) => o.id), ...idsAssociees]);
  const rlist = (relances ?? []) as any[];
  const mesRelances = rlist.filter(
    (r) =>
      (r.personne && normNom(r.personne) === nomNorm) ||
      (contact.entite_id && r.entite_id === contact.entite_id) ||
      (r.operation_id && opIds.has(r.operation_id)),
  );

  return (
    <main className="wrap">
      <BackButton />

      <div className="page-actions">
        {struct && <Link className="btn ghost" href={`/crs/vocal?entite=${struct.id}`}>Dicter un CR</Link>}
        <Link className="btn ghost" href={`/personnes/${contact.id}/modifier`}>Modifier</Link>
      </div>

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
            {struct && <Signet type="entite" id={struct.id} cat="struct" label={struct.nom} parent={{ type: "personne", id: contact.id, nom: nomComplet }} />}
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

        <AssocierAffaire
          contactId={contact.id}
          contactNom={nomComplet}
          associees={affairesAssociees}
          disponibles={affairesDisponibles}
        />

        <div className="block">
          <div className="eyebrow">Prochaines relances</div>
          {mesRelances.length ? (
            <div className="vlist2">
              {mesRelances.map((r: any) => (
                <RelanceRow
                  key={r.id}
                  id={r.id}
                  objet={r.objet}
                  echeance={dateFr(r.date_echeance)}
                  enRetard={r.date_echeance < today}
                  op={r.operation_id && r.operations?.nom ? { id: r.operation_id, nom: r.operations.nom } : null}
                  personne={r.personne ?? null}
                />
              ))}
            </div>
          ) : (
            <div className="empty">Aucune relance planifiée pour cette personne.</div>
          )}
        </div>

        {struct && (
          <div className="block">
            <div className="eyebrow">Opérations de sa structure</div>
            {operations.length ? (
              <div className="vlist2">
                {operations.map((o: any) => (
                  <OperationRow key={o.id} id={o.id} nom={o.nom} statut={o.statut as OperationStatut} montant={o.montant_estime} />
                ))}
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
