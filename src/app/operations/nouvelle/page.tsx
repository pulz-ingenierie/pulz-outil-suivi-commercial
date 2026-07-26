import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { STATUT_LABELS, STATUT_ORDRE } from "@/lib/types";
import { createOperation } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function NouvelleOperation() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/tableau">← Retour au tableau de bord</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [{ data: utilisateurs }, { data: entites }] = await Promise.all([
    supabase.from("utilisateurs").select("id, nom").eq("actif", true).order("nom"),
    supabase.from("entites").select("id, nom").order("nom"),
  ]);

  return (
    <main className="wrap">
      <Link className="back" href="/tableau">← Retour au tableau de bord</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Nouvelle opération</div>
          <h1>Créer une opération</h1>
        </div>
      </div>

      <form action={createOperation} className="form">
        <label className="field">
          <span className="lab">Nom de l'opération <em>*</em></span>
          <input name="nom" required placeholder="Ex. Réhabilitation groupe scolaire Jean Jaurès" />
        </label>

        <div className="row2">
          <label className="field">
            <span className="lab">Étape</span>
            <select name="statut" defaultValue="piste">
              {STATUT_ORDRE.map((s) => (
                <option key={s} value={s}>{STATUT_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">Montant estimé (facultatif)</span>
            <input name="montant_estime" inputMode="decimal" placeholder="Ex. 45 000" />
          </label>
        </div>

        <div className="row2">
          <label className="field">
            <span className="lab">Référent</span>
            <select name="referent_id" defaultValue="">
              <option value="">— Aucun —</option>
              {(utilisateurs ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>{u.nom}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">Porte d'entrée (entité)</span>
            <select name="entite_id" defaultValue="">
              <option value="">— Aucune —</option>
              {(entites ?? []).map((e: any) => (
                <option key={e.id} value={e.id}>{e.nom}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="lab">Description (facultatif)</span>
          <textarea name="description" rows={3} placeholder="Contexte, besoin, échéances connues…" />
        </label>

        <div className="form-foot">
          <Link className="btn ghost" href="/tableau">Annuler</Link>
          <button className="btn" type="submit">Créer l'opération</button>
        </div>
      </form>
    </main>
  );
}
