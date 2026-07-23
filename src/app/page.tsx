import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  STATUT_LABELS,
  STATUT_ORDRE,
  type Operation,
  type Relance,
} from "@/lib/types";

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
  ] = await Promise.all([
    supabase.from("operations").select("*").order("created_at", { ascending: false }),
    supabase.from("relances").select("*").eq("statut", "a_faire"),
    supabase.from("entites").select("id, nom, type, ville, statut_vie"),
    supabase.from("entite_operation").select("entite_id"),
    supabase.from("cr_entites").select("entite_id, crs(date_rdv)"),
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

  // --- Annuaire réseau : entités du réseau, dernier contact, alertes de silence.
  // Entités déjà engagées dans une opération (on ne les remet pas dans l'annuaire).
  const avecOp = new Set<string>((liens ?? []).map((l: any) => l.entite_id));

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

  type Ent = { id: string; nom: string; type: string; ville: string | null; statut_vie: string | null };
  const toutesEntites = (entites ?? []) as Ent[];
  // L'annuaire liste les entités « au chaud » (dans le réseau) qui ne sont pas
  // déjà portées par une opération : celles qu'il ne faut pas laisser refroidir.
  const annuaire = toutesEntites
    .filter((e) => !avecOp.has(e.id))
    .sort((a, b) => {
      const da = dernierContact.get(a.id) ?? "";
      const db = dernierContact.get(b.id) ?? "";
      return da < db ? -1 : da > db ? 1 : a.nom.localeCompare(b.nom);
    });
  const silence = annuaire.filter((e) => estSilencieux(e.id)).length;

  return (
    <main className="wrap">
      <div className="page-actions">
        <Link className="btn" href="/crs/vocal">🎙 Dicter un compte rendu</Link>
        <Link className="btn ghost" href="/operations/nouvelle">+ Nouvelle opération</Link>
        <Link className="btn ghost" href="/crs/nouveau">Compte rendu écrit</Link>
        <Link className="btn ghost" href="/relances">Relances</Link>
        <Link className="btn ghost" href="/entites">Réseau</Link>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="n tnum">{actives}</div><div className="l">Opérations actives</div></div>
        <Link className="kpi crit link" href="/relances"><div className="n tnum">{enRetard}</div><div className="l">Relances en retard</div></Link>
        <Link className="kpi warn link" href="/relances"><div className="n tnum">{rels.length}</div><div className="l">Relances à faire</div></Link>
        <Link className="kpi link" href="/entites"><div className="n tnum">{silence}</div><div className="l">Contacts à réchauffer (+2 mois)</div></Link>
      </div>

      <div className="section-t">
        <h2>Pipeline par opération</h2>
        <span>le pilotage se fait par affaire — jamais par euro</span>
      </div>

      <div className="board">
        {STATUT_ORDRE.map((statut) => {
          const list = operations.filter((o) => o.statut === statut);
          const v = STATUT_VAR[statut];
          return (
            <div className={`col${list.length === 0 ? " col--empty" : ""}`} key={statut}>
              <h3>
                <span className="dot" style={{ background: `var(${v})` }} />
                {STATUT_LABELS[statut]}
                <span className="cnt tnum">{list.length}</span>
              </h3>
              {list.map((o) => (
                <Link className="op" href={`/operations/${o.id}`} key={o.id}>
                  <div className="onm">{o.nom}</div>
                  {euro(o.montant_estime) && <div className="amt">{euro(o.montant_estime)}</div>}
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <div className="section-t" style={{ marginTop: 34 }}>
        <h2>Annuaire réseau</h2>
        <span>les entités du réseau sans opération en cours — à garder au chaud</span>
      </div>

      {annuaire.length ? (
        <div className="netgrid">
          {annuaire.map((e) => {
            const dc = dernierContact.get(e.id) ?? null;
            const froid = estSilencieux(e.id);
            const dormant = e.statut_vie === "dormant";
            return (
              <div className="netcard" key={e.id}>
                <div className="nhead">
                  <span className="nnm">{e.nom}</span>
                  <span className="typechip">{TYPE_ENTITE[e.type] ?? e.type}</span>
                </div>
                {e.ville && <div className="loc">{e.ville}</div>}
                <div className="nfoot">
                  <span className="last">
                    {dc ? `Dernier contact : ${dateFr(dc)}` : "Jamais rencontrée"}
                  </span>
                  {dormant && <span className="pill dormant">en sommeil</span>}
                  {froid && <span className="pill silence">à réchauffer</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card"><span className="empty">Tout le réseau est engagé dans une opération. Rien à réchauffer.</span></div>
      )}
    </main>
  );
}

function dateFr(d: string): string {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}
