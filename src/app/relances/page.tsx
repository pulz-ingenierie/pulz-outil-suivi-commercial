import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { createRelance, updateRelance } from "@/lib/actions";
import { envoyerRappelsMaintenant, envoyerEmailTest } from "@/lib/admin-actions";
import { getIdentite } from "@/lib/auth";
import { indexerLiens, lienPersonne } from "@/lib/personnes";

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

function RelanceCard({
  r,
  today,
  personnesIdx,
  opStructures,
}: {
  r: Rel;
  today: string;
  personnesIdx: Record<string, string>;
  opStructures: Record<string, { id: string; nom: string }[]>;
}) {
  const enRetard = r.date_echeance < today;
  const persHref = r.personne ? lienPersonne(personnesIdx, r.personne) : null;
  // Toutes les associations d'un rappel : l'opération, sa/ses structure(s), la
  // personne — chacune un signet cliquable vers sa carte.
  const op = r.operation_id && r.operations?.nom
    ? { nom: r.operations.nom, href: `/operations/${r.operation_id}` }
    : null;
  const structs = r.operation_id
    ? (opStructures[r.operation_id] ?? [])
    : (r.entite_id && r.entites?.nom ? [{ id: r.entite_id, nom: r.entites.nom }] : []);
  // « Traiter » une relance = raconter le recontact dans un nouveau compte rendu,
  // pré-rattaché à l'opération/entité de la relance (qui sera close à l'enregistrement).
  const crHref = r.operation_id
    ? `/crs/vocal?operation=${r.operation_id}&relance=${r.id}`
    : r.entite_id
      ? `/crs/vocal?entite=${r.entite_id}&relance=${r.id}`
      : `/crs/vocal?relance=${r.id}`;
  return (
    <div className={`relcard${enRetard ? " late" : ""}`}>
      <div className="rel-main">
        <div className="rel-obj">{r.objet}</div>
        <div className={`rel-echeance${enRetard ? " crit" : ""}`}>
          Échéance : {dateFr(r.date_echeance)}{enRetard ? " · en retard" : ""}
        </div>
        <div className="rel-meta sig-rows">
          {(op || structs.length > 0 || r.auto) && (
            <div className="sig-row">
              {op && <Link className="sig-d op" href={op.href}><span className="sig-lbl">{op.nom}</span></Link>}
              {structs.map((s) => (
                <Link className="sig-d struct" href={`/entites/${s.id}`} key={s.id}><span className="sig-lbl">{s.nom}</span></Link>
              ))}
              {r.auto && <span className="sig-d ia"><span className="sig-lbl">IA</span></span>}
            </div>
          )}
          {r.personne && (
            <div className="sig-row">
              {persHref
                ? <Link className="sig-d pers" href={persHref}><span className="sig-lbl">{r.personne}</span></Link>
                : <span className="sig-d pers"><span className="sig-lbl">{r.personne}</span></span>}
            </div>
          )}
        </div>
      </div>
      <div className="rel-acts">
        <Link className="btn mini" href={crHref}>🎙 Nouveau compte rendu</Link>
        <form action={updateRelance}>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="action" value="faite" />
          <button className="btn ghost mini" type="submit" title="Marquer comme fait">Fait</button>
        </form>
        <form action={updateRelance} className="rel-report">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="action" value="reporter" />
          <input type="date" name="date_echeance" defaultValue={plusJours(7)} aria-label="Reporter au" />
          <button className="btn ghost mini" type="submit">Reporter</button>
        </form>
        <form action={updateRelance}>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="action" value="abandonner" />
          <button className="btn ghost mini danger" type="submit">Abandonner</button>
        </form>
      </div>
    </div>
  );
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
  const aujourdhui = list.filter((r) => r.date_echeance === today);
  const aVenir = list.filter((r) => r.date_echeance > today);

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
              <button className="btn ghost" type="submit">✉️ E-mail de test</button>
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

      {enRetard.length > 0 && (
        <section className="rel-group">
          <h2 className="rel-h crit">En retard <span className="tnum">{enRetard.length}</span></h2>
          {enRetard.map((r) => <RelanceCard key={r.id} r={r} today={today} personnesIdx={personnesIdx} opStructures={opStructures} />)}
        </section>
      )}
      {aujourdhui.length > 0 && (
        <section className="rel-group">
          <h2 className="rel-h">Pour aujourd'hui <span className="tnum">{aujourdhui.length}</span></h2>
          {aujourdhui.map((r) => <RelanceCard key={r.id} r={r} today={today} personnesIdx={personnesIdx} opStructures={opStructures} />)}
        </section>
      )}
      {aVenir.length > 0 && (
        <section className="rel-group">
          <h2 className="rel-h muted-h">À venir <span className="tnum">{aVenir.length}</span></h2>
          {aVenir.map((r) => <RelanceCard key={r.id} r={r} today={today} personnesIdx={personnesIdx} opStructures={opStructures} />)}
        </section>
      )}

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
