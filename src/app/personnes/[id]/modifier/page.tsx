import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { updateContact } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ModifierPersonne({ params }: { params: Promise<{ id: string }> }) {
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
  const [{ data: c }, { data: entites }] = await Promise.all([
    supabase.from("contacts").select("id, nom, prenom, fonction, tel, email, entite_id").eq("id", id).maybeSingle(),
    supabase.from("entites").select("id, nom").order("nom"),
  ]);
  if (!c) notFound();
  const contact = c as {
    id: string; nom: string; prenom: string | null; fonction: string | null;
    tel: string | null; email: string | null; entite_id: string | null;
  };
  const nomComplet = [contact.prenom, contact.nom].filter(Boolean).join(" ") || contact.nom;

  return (
    <main className="wrap">
      <Link className="back" href={`/personnes/${id}`}>← Retour à la fiche</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Modifier la personne</div>
          <h1>{nomComplet}</h1>
        </div>
      </div>

      <form action={updateContact} className="form">
        <input type="hidden" name="id" value={contact.id} />

        <div className="row2">
          <label className="field">
            <span className="lab">Prénom</span>
            <input name="prenom" defaultValue={contact.prenom ?? ""} />
          </label>
          <label className="field">
            <span className="lab">Nom <em>*</em></span>
            <input name="nom" required defaultValue={contact.nom} />
          </label>
        </div>

        <label className="field">
          <span className="lab">Fonction (facultatif)</span>
          <input name="fonction" defaultValue={contact.fonction ?? ""} placeholder="Ex. directeur, responsable aménagement…" />
        </label>

        <label className="field">
          <span className="lab">Structure (facultatif)</span>
          <select name="entite_id" defaultValue={contact.entite_id ?? ""}>
            <option value="">— Aucune —</option>
            {(entites ?? []).map((e: any) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
        </label>

        <div className="row2">
          <label className="field">
            <span className="lab">Téléphone (facultatif)</span>
            <input name="tel" type="tel" inputMode="tel" defaultValue={contact.tel ?? ""} placeholder="Ex. 06 12 34 56 78" />
          </label>
          <label className="field">
            <span className="lab">E-mail (facultatif)</span>
            <input name="email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} defaultValue={contact.email ?? ""} placeholder="Ex. b.massy@…" />
          </label>
        </div>

        <p className="hint">
          Les coordonnées se remplissent aussi toutes seules quand un compte rendu
          les mentionne (numéro dicté, carte de visite, signature d'e-mail). Ce que
          vous saisissez ici fait foi : une dictée ne l'écrasera jamais.
        </p>
        <p className="hint">La correction s'appliquera partout où cette personne est citée.</p>

        <div className="form-foot">
          <Link className="btn ghost" href={`/personnes/${id}`}>Annuler</Link>
          <button className="btn" type="submit">Enregistrer</button>
        </div>
      </form>
    </main>
  );
}
