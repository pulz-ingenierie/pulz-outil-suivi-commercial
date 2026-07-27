import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { createRelance } from "@/lib/actions";
import { envoyerRappelsMaintenant, envoyerEmailTest } from "@/lib/admin-actions";
import { getIdentite } from "@/lib/auth";
import { indexerLiens, lienPersonne } from "@/lib/personnes";
import RelancesListe, { type RelRow } from "@/components/RelancesListe";

export const dynamic = "force-dynamic";

function dateFr(d: string): string {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function plusJours(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Rel = {
  id: string;
  objet: string;
  date_echeance: string;
  auto: boolean;
  personne: string | null;
  operation_id: string | null;
  entite_id: string | null;
  operations: { nom: string } | null;
  entites: { nom: string } | null;
};

// Transforme une relance en ligne sérialisable pour la liste cliente.
function versRow(
  r: Rel,
  today: string,
  personnesIdx: Record<string, string>,
  opStructures: Record<string, { id: string; nom: string }[]>,
): RelRow {
  const persHref = r.personne ? lienPersonne(personnesIdx, r.personne) : null;
  const op = r.operation_id && r.operations?.nom
    ? { id: r.operation_id, nom: r.operations.nom }
    : null;
  const structsBrut = r.operation_id
    ? (opStructures[r.operation_id] ?? [])
    : (r.entite_id && r.entites?.nom ? [{ id: r.entite_id, nom: r.entites.nom }] : []);
  // Dédoublonnage par nom (évite un même libellé affiché deux fois).
  const vusStruct = new Set<string>();
  const structs = structsBrut.filter((s) => {
    const k = (s.nom ?? "").trim().toLowerCase();
    if (!k || vusStruct.has(k)) return false;
    vusStruct.add(k);
    return true;
  });
  // « Traiter » une relance = raconter le recontact dans un nouveau compte rendu,
  // pré-rattaché à l'opération/entité de la relance (close à l'enregistrement).
  const crHref = r.operation_id
    ? `/crs/vocal?operation=${r.operation_id}&relance=${r.id}`
    : r.entite_id
      ? `/crs/vocal?entite=${r.entite_id}&relance=${r.id}`
      : `/crs/vocal?relance=${r.id}`;
  return {
    id: r.id,
    objet: r.objet,
    echeance: dateFr(r.date_echeance),
    enRetard: r.date_echeance < today,
    op,
    structs,
    personne: r.personne,
    persHref,
    crHref,
    reporterDefault: plusJours(7),
  };
}

export default async function Relances({
  searchParams,
}: {
  searchParams: Promise<{ dest?: string; rel?: string; ign?: string; cfg?: string; mailtest?: string }>;
}) {
  const sp = await searchParams;
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/tableau">← Retour au tableau de bord</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [{ data: relances }, { data: operations }, { data: entites }, { data: utilisateurs }, { data: contacts }] = await Promise.all([
    supabase
      .from("relances")
      .select("*, operations(nom), entites(nom)")
      .eq("statut", "a_faire")
      .order("date_echeance", { ascending: true }),
    supabase.from("operations").select("id, nom").order("created_at", { ascending: false }),
    supabase.from("entites").select("id, nom").order("nom"),
    supabase.from("utilisateurs").select("id, nom").eq("actif", true).order("nom"),
    supabase.from("contacts").select("id, nom, prenom"),
  ]);
  const personnesIdx = indexerLiens((contacts ?? []) as any, (utilisateurs ?? []) as any);

  const today = new Date().toISOString().slice(0, 10);
  const list = (relances ?? []) as unknown as Rel[];

  // Pour chaque rappel lié à une opération : la/les structure(s) de cette
  // opération, pour les afficher aussi en signets sur le rappel.
  const opIds = [...new Set(list.map((r) => r.operation_id).filter(Boolean))] as string[];
  const opStructures: Record<string, { id: string; nom: string }[]> = {};
  if (opIds.length) {
    const { data: opLiens } = await supabase
      .from("entite_operation")
      .select("operation_id, entites(id, nom)")
      .in("operation_id", opIds);
    for (const l of (opLiens ?? []) as any[]) {
      if (l.operation_id && l.entites?.id) {
        (opStructures[l.operation_id] ??= []).push({ id: l.entites.id, nom: l.entites.nom });
      }
    }
  }

  const enRetard = list.filter((r) => r.date_echeance < today);
  // Les relances du jour tombent dans « À venir » (échéance >= aujourd'hui).
  const aVenir = list.filter((r) => r.date_echeance >= today);

  const { profil } = await getIdentite();
  const estPilote = profil?.role === "pilote";

  // Bannière de résultat après un envoi manuel (?dest=&rel=&ign=&cfg=).
  const aEnvoye = sp.dest !== undefined;
  const envoiConfigure = sp.cfg === "1";

  return (
    <main className="wrap">
      <Link className="back" href="/tableau">← Retour au tableau de bord</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Suites à donner</div>
          <h1>Relances <span className="count-badge">{list.length}</span></h1>
        </div>
        {estPilote && (
          <div className="rel-acts">
            <form action={envoyerEmailTest}>
              <button className="btn ghost" type="submit">E-mail de test</button>
            </form>
            <form action={envoyerRappelsMaintenant}>
              <button className="btn ghost" type="submit">Envoyer les rappels maintenant</button>
            </form>
          </div>
        )}
      </div>

      {sp.mailtest !== undefined && (
        <div className={`card notice${sp.mailtest === "ok" ? "" : " err"}`} style={{ marginBottom: 14 }}>
          {sp.mailtest === "ok"
            ? "E-mail de test envoyé ✅ — vérifiez votre boîte de réception (et les spams au cas où). La connexion Gmail fonctionne."
            : sp.mailtest === "noconf"
              ? "Envoi non configuré : vérifiez GMAIL_USER et GMAIL_APP_PASSWORD dans Vercel, puis redéployez."
              : sp.mailtest === "noemail"
                ? "Aucune adresse e-mail enregistrée pour votre compte."
                : `Échec de l'envoi : ${decodeURIComponent(sp.mailtest.replace(/^err:/, ""))}`}
        </div>
      )}

      {aEnvoye && (
        <div className={`card notice${envoiConfigure ? "" : " err"}`} style={{ marginBottom: 14 }}>
          {envoiConfigure
            ? `Rappels envoyés : ${sp.dest} destinataire(s), ${sp.rel} relance(s).${
                Number(sp.ign) > 0 ? ` ${sp.ign} relance(s) sans responsable/e-mail non envoyée(s).` : ""
              }`
            : "L'envoi d'e-mails n'est pas encore configuré (clé Resend manquante). Les rappels s'afficheront ici en attendant."}
        </div>
      )}

      {list.length === 0 && (
        <div className="card"><span className="empty">Aucune relance en attente. Tout est à jour.</span></div>
      )}

      <RelancesListe
        groupes={[
          { titre: "En retard", classe: "crit", items: enRetard.map((r) => versRow(r, today, personnesIdx, opStructures)) },
          { titre: "À venir", classe: "muted-h", items: aVenir.map((r) => versRow(r, today, personnesIdx, opStructures)) },
        ]}
      />

      {/* Créer une relance à la main */}
      <section className="rel-group">
        <h2 className="rel-h muted-h">Ajouter une relance</h2>
        <form action={createRelance} className="form card">
          <label className="field">
            <span className="lab">Objet <em>*</em></span>
            <input name="objet" required placeholder="Ex. Rappeler pour la remise de l'offre" />
          </label>
          <div className="row2">
            <label className="field">
              <span className="lab">Échéance</span>
              <input type="date" name="date_echeance" defaultValue={plusJours(7)} />
            </label>
            <label className="field">
              <span className="lab">Assignée à</span>
              <select name="assignee_id" defaultValue="">
                <option value="">— Personne —</option>
                {(utilisateurs ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.nom}</option>)}
              </select>
            </label>
          </div>
          <div className="row2">
            <label className="field">
              <span className="lab">Opération liée</span>
              <select name="operation_id" defaultValue="">
                <option value="">— Aucune —</option>
                {(operations ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.nom}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="lab">Entité liée</span>
              <select name="entite_id" defaultValue="">
                <option value="">— Aucune —</option>
                {(entites ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </select>
            </label>
          </div>
          <div className="form-foot">
            <button className="btn" type="submit">Créer la relance</button>
          </div>
        </form>
      </section>
    </main>
  );
}
