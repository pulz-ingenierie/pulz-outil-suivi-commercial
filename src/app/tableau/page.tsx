import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { type Operation } from "@/lib/types";
import PipelineViews from "../pipeline-views";
import { manquesOperation } from "@/lib/completude";

// Rendu à la demande (jamais au build) : les données sont lues à chaque visite.
export const dynamic = "force-dynamic";

export default async function Operations() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <div className="card notice">
          <div className="eyebrow">Configuration</div>
          <h2 style={{ margin: "6px 0 10px" }}>Base de données à connecter</h2>
          <p className="muted">
            L'application est en place, mais elle n'est pas encore reliée à la base
            Supabase. Renseignez les variables <code>NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> dans Vercel, puis rechargez cette page.
          </p>
        </div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [{ data: ops, error: opsErr }, { data: liensEnt }] = await Promise.all([
    supabase.from("operations").select("*").order("created_at", { ascending: false }),
    // Une seule requête pour savoir quelles affaires ont au moins une structure.
    supabase.from("entite_operation").select("operation_id"),
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
  const avecStructure = new Set(((liensEnt ?? []) as any[]).map((l) => l.operation_id));
  const slim = (o: Operation) => ({
    id: o.id,
    nom: o.nom,
    statut: o.statut,
    montant_estime: o.montant_estime,
    // Ce qui manque est calculé ici, une fois : la liste n'a plus qu'un booléen.
    incomplet: manquesOperation({
      id: o.id, ville: o.ville, referent_id: o.referent_id, aStructure: avecStructure.has(o.id),
    }).length > 0,
  });

  return (
    <main className="wrap">
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Suivi commercial</div>
          <h1>Opérations</h1>
        </div>
        <Link className="btn" href="/operations/nouvelle">+ Nouvelle opération</Link>
      </div>

      <PipelineViews operations={operations.map(slim)} />
    </main>
  );
}
