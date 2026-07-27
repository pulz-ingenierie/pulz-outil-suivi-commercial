import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { createContact } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NouvellePersonne() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/entites">← Retour au réseau</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const { data: entites } = await supabase.from("entites").select("id, nom").order("nom");

  return (
    <main className="wrap">
      <Link className="back" href="/entites">← Retour au réseau</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Réseau</div>
          <h1>Nouvelle personne</h1>
        </div>
      </div>

      <form action={createContact} className="form">
        <div className="row2">
          <label className="field">
            <span className="lab">Prénom</span>
            <input name="prenom" placeholder="Ex. Béatrice" />
          </label>
          <label className="field">
            <span className="lab">Nom <em>*</em></span>
            <input name="nom" required placeholder="Ex. Massy" />
          </label>
        </div>

        <label className="field">
          <span className="lab">Fonction (facultatif)</span>
          <input name="fonction" placeholder="Ex. directrice de programmes" />
        </label>

        <label className="field">
          <span className="lab">Structure (facultatif)</span>
          <select name="entite_id" defaultValue="">
            <option value="">— Aucune —</option>
            {(entites ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
        </label>

        <div className="row2">
          <label className="field">
            <span className="lab">Téléphone (facultatif)</span>
            <input name="tel" inputMode="tel" placeholder="Ex. 06 12 34 56 78" />
          </label>
          <label className="field">
            <span className="lab">E-mail (facultatif)</span>
            <input name="email" inputMode="email" placeholder="Ex. b.massy@…" />
          </label>
        </div>

        <div className="form-foot">
          <Link className="btn ghost" href="/entites">Annuler</Link>
          <button className="btn" type="submit">Créer la personne</button>
        </div>
      </form>
    </main>
  );
}
