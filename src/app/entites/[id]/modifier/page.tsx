import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { updateEntite } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TYPES = [
  { v: "MOA", l: "MOA (maître d'ouvrage)" },
  { v: "archi", l: "Architecte" },
  { v: "promoteur", l: "Promoteur" },
  { v: "bet", l: "BET (bureau d'études)" },
  { v: "confrere", l: "Confrère" },
  { v: "autre", l: "Autre" },
];

export default async function ModifierStructure({ params }: { params: Promise<{ id: string }> }) {
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
  const { data: e } = await supabase.from("entites").select("id, nom, type, ville").eq("id", id).maybeSingle();
  if (!e) notFound();
  const entite = e as { id: string; nom: string; type: string; ville: string | null };

  return (
    <main className="wrap">
      <Link className="back" href={`/entites/${id}`}>← Retour à la fiche</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Modifier la structure</div>
          <h1>{entite.nom}</h1>
        </div>
      </div>

      <form action={updateEntite} className="form">
        <input type="hidden" name="id" value={entite.id} />

        <label className="field">
          <span className="lab">Nom de la structure <em>*</em></span>
          <input name="nom" required defaultValue={entite.nom} />
        </label>

        <div className="row2">
          <label className="field">
            <span className="lab">Type</span>
            <select name="type" defaultValue={entite.type}>
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="lab">Ville (facultatif)</span>
            <input name="ville" defaultValue={entite.ville ?? ""} />
          </label>
        </div>

        <p className="hint">La correction s'appliquera partout où cette structure est citée.</p>

        <div className="form-foot">
          <Link className="btn ghost" href={`/entites/${id}`}>Annuler</Link>
          <button className="btn" type="submit">Enregistrer</button>
        </div>
      </form>
    </main>
  );
}
