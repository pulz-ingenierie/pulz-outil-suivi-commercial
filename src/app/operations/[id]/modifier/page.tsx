import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { STATUT_LABELS, STATUT_ORDRE, type Operation } from "@/lib/types";
import { updateOperation } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ModifierOperation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/">← Retour au tableau de bord</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [{ data: op }, { data: utilisateurs }] = await Promise.all([
    supabase.from("operations").select("*").eq("id", id).maybeSingle(),
    supabase.from("utilisateurs").select("id, nom").eq("actif", true).order("nom"),
  ]);
  if (!op) notFound();
  const operation = op as Operation;

  return (
    <main className="wrap">
      <Link className="back" href={`/operations/${id}`}>← Retour à la fiche</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Modifier l'opération</div>
          <h1>{operation.nom}</h1>
        </div>
      </div>

      <form action={updateOperation} className="form">
        <input type="hidden" name="id" value={operation.id} />

        <label className="field">
          <span className="lab">Nom de l'opération <em>*</em></span>
          <input name="nom" required defaultValue={operation.nom} />
        </label>

        <div className="row2">
          <label className="field">
            <span className="lab">Étape</span>
            <select name="statut" defaultValue={operation.statut}>
              {STATUT_ORDRE.map((s) => (
                <option key={s} value={s}>{STATUT_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">Montant estimé (facultatif)</span>
            <input name="montant_estime" inputMode="decimal" defaultValue={operation.montant_estime ?? ""} />
          </label>
        </div>

        <label className="field">
          <span className="lab">Référent</span>
          <select name="referent_id" defaultValue={operation.referent_id ?? ""}>
            <option value="">— Aucun —</option>
            {(utilisateurs ?? []).map((u: any) => (
              <option key={u.id} value={u.id}>{u.nom}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="lab">Description (facultatif)</span>
          <textarea name="description" rows={3} defaultValue={operation.description ?? ""} />
        </label>

        <label className="field">
          <span className="lab">Raison de la perte <small>(utilisée seulement si l'étape est « Perdu »)</small></span>
          <input name="raison_perte" defaultValue={operation.raison_perte ?? ""} placeholder="Ex. budget, délai, concurrent retenu…" />
        </label>

        <div className="form-foot">
          <Link className="btn ghost" href={`/operations/${id}`}>Annuler</Link>
          <button className="btn" type="submit">Enregistrer</button>
        </div>
      </form>
    </main>
  );
}
