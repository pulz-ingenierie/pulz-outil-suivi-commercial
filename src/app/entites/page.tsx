import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { type Operation } from "@/lib/types";
import ReseauViews from "@/components/ReseauViews";

export const dynamic = "force-dynamic";

// Une structure est « silencieuse » si son dernier contact remonte à plus de 2
// mois (ou si on ne l'a jamais rencontrée) : signal « on risque de l'oublier ».
const JOURS_SILENCE = 60;

const TYPE_ENTITE: Record<string, string> = {
  MOA: "Maître d'ouvrage",
  archi: "Architecte",
  promoteur: "Promoteur",
  bet: "Bureau d'études (BET)",
  confrere: "Confrère",
  autre: "Structure",
};

export default async function Reseau() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [
    { data: entites },
    { data: relances },
    { data: liens },
    { data: crEnt },
    { data: contactsRaw },
    { data: ops },
  ] = await Promise.all([
    supabase.from("entites").select("id, nom, type, ville, statut_vie, created_at"),
    supabase.from("relances").select("*").eq("statut", "a_faire"),
    supabase.from("entite_operation").select("entite_id, operation_id"),
    supabase.from("cr_entites").select("entite_id, crs(date_rdv)"),
    supabase.from("contacts").select("id, nom, prenom, fonction, entite_id"),
    supabase.from("operations").select("*"),
  ]);

  const operations = (ops ?? []) as Operation[];
  const rels = (relances ?? []) as any[];
  const today = new Date().toISOString().slice(0, 10);

  // Opération ↔ structures.
  const entitesParOp: Record<string, string[]> = {};
  for (const l of (liens ?? []) as any[]) {
    if (!l.operation_id || !l.entite_id) continue;
    (entitesParOp[l.operation_id] ??= []).push(l.entite_id);
  }

  // Prochaine relance par structure (directe ou via ses opérations).
  const prochaineRelanceParEntite: Record<string, string> = {};
  const maj = (eid?: string | null, d?: string | null) => {
    if (!eid || !d) return;
    if (!prochaineRelanceParEntite[eid] || d < prochaineRelanceParEntite[eid]) prochaineRelanceParEntite[eid] = d;
  };
  for (const r of rels) {
    maj(r.entite_id, r.date_echeance);
    if (r.operation_id) for (const eid of entitesParOp[r.operation_id] ?? []) maj(eid, r.date_echeance);
  }

  // Dernier RDV connu par structure (via les comptes rendus rattachés).
  const dernierContact = new Map<string, string>();
  for (const c of (crEnt ?? []) as any[]) {
    const d = c.crs?.date_rdv;
    if (!c.entite_id || !d) continue;
    const prev = dernierContact.get(c.entite_id);
    if (!prev || d > prev) dernierContact.set(c.entite_id, d);
  }

  const seuilSilence = new Date(Date.now() - JOURS_SILENCE * 86400000).toISOString().slice(0, 10);
  const estSilencieux = (id: string, createdAt?: string | null) => {
    const ref = dernierContact.get(id) ?? (createdAt ? createdAt.slice(0, 10) : null);
    return !ref || ref < seuilSilence;
  };

  // Opérations (allégées) par structure.
  const slim = (o: Operation) => ({ id: o.id, nom: o.nom, statut: o.statut, montant_estime: o.montant_estime });
  const opById = new Map(operations.map((o) => [o.id, o]));
  const entiteOps: Record<string, ReturnType<typeof slim>[]> = {};
  for (const l of (liens ?? []) as any[]) {
    if (!l.entite_id || !l.operation_id) continue;
    const op = opById.get(l.operation_id);
    if (op) (entiteOps[l.entite_id] ??= []).push(slim(op));
  }

  type Ent = { id: string; nom: string; type: string; ville: string | null; statut_vie: string | null; created_at: string | null };
  const toutesEntites = (entites ?? []) as Ent[];

  const reseau = toutesEntites
    .map((e) => ({
      id: e.id,
      nom: e.nom,
      type: TYPE_ENTITE[e.type] ?? e.type,
      ville: e.ville,
      silencieux: estSilencieux(e.id, e.created_at),
      dormant: e.statut_vie === "dormant",
      ops: entiteOps[e.id] ?? [],
      prochaineRelance: prochaineRelanceParEntite[e.id] ?? null,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const nomStructById = new Map(toutesEntites.map((e) => [e.id, e.nom]));
  const personnes = (contactsRaw ?? [])
    .map((c: any) => ({
      id: c.id,
      nom: c.nom,
      prenom: c.prenom ?? null,
      fonction: c.fonction ?? null,
      entiteId: c.entite_id ?? null,
      entiteNom: c.entite_id ? nomStructById.get(c.entite_id) ?? null : null,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return (
    <main className="wrap">
      <ReseauViews reseau={reseau} personnes={personnes} />
    </main>
  );
}
