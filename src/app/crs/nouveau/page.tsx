import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { createCr } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TYPES_RDV = [
  { v: "dejeuner", l: "Déjeuner" },
  { v: "appel", l: "Appel" },
  { v: "visite", l: "Visite" },
  { v: "salon", l: "Salon" },
  { v: "autre", l: "Autre" },
];

export default async function NouveauCr({
  searchParams,
}: {
  searchParams: Promise<{ operation?: string; entite?: string }>;
}) {
  const { operation: opPre, entite: entPre } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/">← Retour au tableau de bord</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [{ data: entites }, { data: operations }] = await Promise.all([
    supabase.from("entites").select("id, nom").order("nom"),
    supabase.from("operations").select("id, nom").order("created_at", { ascending: false }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="wrap">
      <Link className="back" href={opPre ? `/operations/${opPre}` : "/"}>← Retour</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Nouveau compte rendu</div>
          <h1>Saisir un compte rendu</h1>
        </div>
      </div>
      <p className="muted" style={{ margin: "-8px 0 18px", maxWidth: 720 }}>
        Saisie manuelle. La dictée vocale (parler après un rendez-vous, l'IA rédige à votre place)
        sera ajoutée ensuite — cet écran restera le moyen de corriger ou compléter à la main.
      </p>

      <form action={createCr} className="form">
        <div className="row2">
          <label className="field">
            <span className="lab">Date du rendez-vous</span>
            <input type="date" name="date_rdv" defaultValue={today} max={today} />
          </label>
          <label className="field">
            <span className="lab">Type de rendez-vous</span>
            <select name="type_rdv" defaultValue="autre">
              {TYPES_RDV.map((t) => (
                <option key={t.v} value={t.v}>{t.l}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="lab">Compte rendu <em>*</em></span>
          <textarea name="transcription" rows={6} required placeholder="Ce qui s'est dit, les points à retenir, les suites à donner…" />
        </label>

        <div className="row2">
          <fieldset className="field pickset">
            <legend className="lab">Entités concernées</legend>
            {(entites ?? []).length ? (
              <div className="picklist">
                {(entites ?? []).map((e: any) => (
                  <label className="check" key={e.id}>
                    <input type="checkbox" name="entite_ids" value={e.id} defaultChecked={e.id === entPre} />
                    <span>{e.nom}</span>
                  </label>
                ))}
              </div>
            ) : <div className="empty">Aucune entité. <Link href="/entites/nouvelle">En créer une.</Link></div>}
          </fieldset>

          <fieldset className="field pickset">
            <legend className="lab">Opérations concernées</legend>
            {(operations ?? []).length ? (
              <div className="picklist">
                {(operations ?? []).map((o: any) => (
                  <label className="check" key={o.id}>
                    <input type="checkbox" name="operation_ids" value={o.id} defaultChecked={o.id === opPre} />
                    <span>{o.nom}</span>
                  </label>
                ))}
              </div>
            ) : <div className="empty">Aucune opération.</div>}
          </fieldset>
        </div>

        <label className="field">
          <span className="lab">État</span>
          <select name="statut" defaultValue="valide">
            <option value="valide">Validé (visible dans les fiches)</option>
            <option value="brouillon">Brouillon (masqué pour l'instant)</option>
          </select>
        </label>

        <div className="form-foot">
          <Link className="btn ghost" href={opPre ? `/operations/${opPre}` : "/"}>Annuler</Link>
          <button className="btn" type="submit">Enregistrer le compte rendu</button>
        </div>
      </form>
    </main>
  );
}
