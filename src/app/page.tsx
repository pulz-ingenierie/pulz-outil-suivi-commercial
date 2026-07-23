import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { type Operation, type Relance } from "@/lib/types";
import PipelineViews from "./pipeline-views";

// Une entité est « silencieuse » si son dernier contact remonte à plus de 2 mois
// (ou si on ne l'a jamais rencontrée). C'est le signal « on risque de l'oublier ».
const JOURS_SILENCE = 60;

const TYPE_ENTITE: Record<string, string> = {
  MOA: "Maître d'ouvrage",
  archi: "Architecte",
  promoteur: "Promoteur",
  confrere: "Confrère",
  autre: "Entité",
};

// Rendu à la demande (jamais au build) : les données sont lues à chaque visite,
// via le serveur. Évite toute connexion à Supabase pendant la compilation.
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // Pas encore configuré : on guide au lieu de planter.
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <div className="card notice">
          <div className="eyebrow">Configuration</div>
          <h2 style={{ margin: "6px 0 10px" }}>Base de données à connecter</h2>
          <p className="muted">
            L'application est en place, mais elle n'est pas encore reliée à la base
            Supabase. Renseignez les variables <code>NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> dans Vercel (voir{" "}
            <code>app/DEMARRAGE.md</code>), puis rechargez cette page.
          </p>
        </div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [
    { data: ops, error: opsErr },
    { data: relances },
    { data: entites },
    { data: liens },
    { data: crEnt },
    { data: contactsRaw },
  ] = await Promise.all([
    supabase.from("operations").select("*").order("created_at", { ascending: false }),
    supabase.from("relances").select("*").eq("statut", "a_faire"),
    supabase.from("entites").select("id, nom, type, ville, statut_vie"),
    supabase.from("entite_operation").select("entite_id, operation_id, entites(nom)"),
    supabase.from("cr_entites").select("entite_id, crs(date_rdv)"),
    supabase.from("contacts").select("id, nom, prenom, fonction, tel, email, entites(nom)"),
  ]);

  if (opsErr) {
    return (
      <main className="wrap">
        <div className="card notice">
          <div className="eyebrow">Connexion</div>
          <h2 style={{ margin: "6px 0 10px" }}>Lecture impossible</h2>
          <p className="muted">La base a répondu : {opsErr.message}</p>
        </div>
      </main>
    );
  }

  const operations = (ops ?? []) as Operation[];
  const rels = (relances ?? []) as Relance[];
  const today = new Date().toISOString().slice(0, 10);

  const actives = operations.filter((o) => o.statut !== "gagne" && o.statut !== "perdu").length;
  const enRetard = rels.filter((r) => r.date_echeance < today).length;

  // Pour chaque opération : les prospects (entités) qui y sont rattachés.
  // Sert aux vues « Par prospect » et à l'affichage des portes d'entrée.
  const opEntites: Record<string, { id: string; nom: string }[]> = {};
  for (const l of (liens ?? []) as any[]) {
    if (!l.operation_id || !l.entite_id) continue;
    (opEntites[l.operation_id] ??= []).push({ id: l.entite_id, nom: l.entites?.nom ?? "—" });
  }

  // Dernier RDV connu pour chaque entité (via les comptes rendus rattachés).
  const dernierContact = new Map<string, string>();
  for (const c of (crEnt ?? []) as any[]) {
    const d = c.crs?.date_rdv;
    if (!c.entite_id || !d) continue;
    const prev = dernierContact.get(c.entite_id);
    if (!prev || d > prev) dernierContact.set(c.entite_id, d);
  }

  const seuilSilence = new Date(Date.now() - JOURS_SILENCE * 86400000).toISOString().slice(0, 10);
  const estSilencieux = (id: string) => {
    const d = dernierContact.get(id);
    return !d || d < seuilSilence;
  };

  // Version allégée d'une affaire (juste ce dont les vues ont besoin).
  const slim = (o: Operation) => ({
    id: o.id,
    nom: o.nom,
    statut: o.statut,
    montant_estime: o.montant_estime,
  });
  const opById = new Map(operations.map((o) => [o.id, o]));

  // Pour chaque prospect (entité) : la liste de ses affaires.
  const entiteOps: Record<string, ReturnType<typeof slim>[]> = {};
  for (const l of (liens ?? []) as any[]) {
    if (!l.entite_id || !l.operation_id) continue;
    const op = opById.get(l.operation_id);
    if (op) (entiteOps[l.entite_id] ??= []).push(slim(op));
  }

  type Ent = { id: string; nom: string; type: string; ville: string | null; statut_vie: string | null };
  const toutesEntites = (entites ?? []) as Ent[];

  // Vue « Par prospect » : TOUS les prospects (avec ou sans affaire), avec leur
  // état (à réchauffer si silence > 2 mois, en sommeil), classés par nom.
  const prospects = toutesEntites
    .map((e) => ({
      id: e.id,
      nom: e.nom,
      type: TYPE_ENTITE[e.type] ?? e.type,
      ville: e.ville,
      dernierContact: dernierContact.get(e.id) ?? null,
      silencieux: estSilencieux(e.id),
      dormant: e.statut_vie === "dormant",
      ops: entiteOps[e.id] ?? [],
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  // Répertoire des contacts (les personnes), classés par nom.
  const contacts = ((contactsRaw ?? []) as any[])
    .map((c) => ({
      id: c.id as string,
      nom: c.nom as string,
      prenom: (c.prenom ?? null) as string | null,
      fonction: (c.fonction ?? null) as string | null,
      tel: (c.tel ?? null) as string | null,
      email: (c.email ?? null) as string | null,
      entiteNom: (c.entites?.nom ?? null) as string | null,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  // Indicateur « à réchauffer » : prospects silencieux sans affaire en cours.
  const silence = prospects.filter((p) => p.silencieux && p.ops.length === 0).length;

  return (
    <main className="wrap">
      <div className="page-actions">
        <Link className="btn" href="/crs/vocal">🎙 Dicter un compte rendu</Link>
        <Link className="btn ghost" href="/crs/nouveau">Compte rendu écrit</Link>
        <Link className="btn ghost" href="/operations/nouvelle">+ Nouvelle opération</Link>
        <Link className="btn ghost" href="/relances">Relances</Link>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="n tnum">{actives}</div><div className="l">Opérations actives</div></div>
        <Link className="kpi crit link" href="/relances"><div className="n tnum">{enRetard}</div><div className="l">Relances en retard</div></Link>
        <Link className="kpi warn link" href="/relances"><div className="n tnum">{rels.length}</div><div className="l">Relances à faire</div></Link>
        <div className="kpi"><div className="n tnum">{silence}</div><div className="l">Contacts à réchauffer (+2 mois)</div></div>
      </div>

      <div className="section-t">
        <h2>Pipeline des affaires</h2>
        <span>le pilotage se fait par affaire — jamais par euro</span>
      </div>

      <PipelineViews
        operations={operations.map(slim)}
        opEntites={opEntites}
        prospects={prospects}
        contacts={contacts}
      />
    </main>
  );
}
