import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { createEntite } from "@/lib/actions";

export const dynamic = "force-dynamic";

const TYPES = [
  { v: "MOA", l: "Maître d'ouvrage" },
  { v: "archi", l: "Architecte" },
  { v: "promoteur", l: "Promoteur" },
  { v: "confrere", l: "Confrère" },
  { v: "autre", l: "Autre" },
];

export default function NouvelleEntite() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/entites">← Retour aux entités</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <Link className="back" href="/entites">← Retour aux entités</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Nouvelle entité</div>
          <h1>Ajouter une entité au réseau</h1>
        </div>
      </div>

      <form action={createEntite} className="form">
        <label className="field">
          <span className="lab">Nom <em>*</em></span>
          <input name="nom" required placeholder="Ex. Ville de Bordeaux, Cabinet Martin architectes…" />
        </label>

        <div className="row2">
          <label className="field">
            <span className="lab">Type</span>
            <select name="type" defaultValue="MOA">
              {TYPES.map((t) => (
                <option key={t.v} value={t.v}>{t.l}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">Ville (facultatif)</span>
            <input name="ville" placeholder="Ex. Bordeaux" />
          </label>
        </div>

        <label className="field">
          <span className="lab">Notes (facultatif)</span>
          <textarea name="notes" rows={3} placeholder="Interlocuteur, contexte, historique…" />
        </label>

        <div className="form-foot">
          <Link className="btn ghost" href="/entites">Annuler</Link>
          <button className="btn" type="submit">Ajouter l'entité</button>
        </div>
      </form>
    </main>
  );
}
