import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { STATUT_LABELS, STATUT_ORDRE, type Operation } from "@/lib/types";
import { updateOperation } from "@/lib/actions";
import { titreOperation } from "@/lib/titres";

export const dynamic = "force-dynamic";

export default async function ModifierOperation({ params }: { params: Promise<{ id: string }> }) {
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
  const [{ data: op }, { data: utilisateurs }, { data: entites }, { data: dejaLiees }] = await Promise.all([
    supabase.from("operations").select("*").eq("id", id).maybeSingle(),
    supabase.from("utilisateurs").select("id, nom").eq("actif", true).order("nom"),
    supabase.from("entites").select("id, nom").order("nom"),
    supabase.from("entite_operation").select("entite_id").eq("operation_id", id),
  ]);
  if (!op) notFound();
  const operation = op as Operation;
  // Structures déjà rattachées : on ne propose que celles qui ne le sont pas.
  const liees = new Set(((dejaLiees ?? []) as any[]).map((l) => l.entite_id));
  const aRattacher = ((entites ?? []) as any[]).filter((e) => !liees.has(e.id));

  return (
    <main className="wrap">
      <Link className="back" href={`/operations/${id}`}>← Retour à la fiche</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Modifier l'opération</div>
          <h1>{titreOperation(operation.nom)}</h1>
        </div>
      </div>

      <form action={updateOperation} className="form">
        <input type="hidden" name="id" value={operation.id} />

        <label className="field">
          <span className="lab">Nom de l'opération <em>*</em></span>
          {/* Le champ propose le titre NETTOYÉ : on ne fait pas retaper un
              « ✕ » à l'utilisateur. Renseigner la ville ci-dessous réinsère la
              commune au bon endroit (voir updateOperation). */}
          <input name="nom" required defaultValue={titreOperation(operation.nom)} />
          <small className="hint">Format : « Client - Ville - Nature » (ex. « Spirit - Poitiers - Construction de 80 logements »).</small>
        </label>

        <label className="field">
          <span className="lab">Ville (commune du projet)</span>
          <input id="f-ville" name="ville" defaultValue={operation.ville ?? ""} placeholder="Ex. Poitiers, Roncq…" />
        </label>

        {/* Rattacher une structure (« porte d'entrée »). Jusqu'ici ce lien ne
            pouvait naître qu'à la création de l'affaire ou par une dictée : une
            opération saisie à la main restait sans structure, sans recours. */}
        <label className="field">
          <span className="lab">Rattacher une structure</span>
          <select id="f-structure" name="ajouter_entite_id" defaultValue="">
            <option value="">— Aucune à ajouter —</option>
            {aRattacher.map((e: any) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
          <small className="hint">
            {liees.size
              ? `${liees.size} structure${liees.size > 1 ? "s" : ""} déjà rattachée${liees.size > 1 ? "s" : ""} — en ajouter une n'en retire aucune.`
              : "Aucune structure rattachée pour l'instant."}
          </small>
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
          <select id="f-referent" name="referent_id" defaultValue={operation.referent_id ?? ""}>
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
