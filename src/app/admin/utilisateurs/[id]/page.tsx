import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getIdentite } from "@/lib/auth";
import { updateUtilisateur, deleteUtilisateur, setUtilisateurActif } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

type U = {
  id: string;
  nom: string;
  email: string;
  role: "membre" | "pilote";
  actif: boolean;
  societe_label: string | null;
};

export default async function ModifierUtilisateur({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/admin/utilisateurs">← Retour</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const { profil } = await getIdentite();
  if (!profil || profil.role !== "pilote") {
    return (
      <main className="wrap">
        <Link className="back" href="/admin/utilisateurs">← Retour</Link>
        <div className="card notice">
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Réservé aux pilotes</h2>
        </div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const { data } = await supabase
    .from("utilisateurs")
    .select("id, nom, email, role, actif, societe_label")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const u = data as U;
  const moi = u.id === profil.id;

  return (
    <main className="wrap">
      <Link className="back" href="/admin/utilisateurs">← Retour aux utilisateurs</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Administration</div>
          <h1>Modifier {u.nom}{moi ? " (vous)" : ""}</h1>
        </div>
      </div>

      <form action={updateUtilisateur} className="form card">
        <input type="hidden" name="id" value={u.id} />
        <div className="row2">
          <label className="field">
            <span className="lab">Nom <em>*</em></span>
            <input name="nom" required defaultValue={u.nom} placeholder="Prénom Nom" />
          </label>
          <label className="field">
            <span className="lab">E-mail <em>*</em></span>
            <input type="email" name="email" required defaultValue={u.email} placeholder="prenom@societe.fr" />
          </label>
        </div>
        <div className="row2">
          <label className="field">
            <span className="lab">Société (facultatif)</span>
            <input name="societe_label" defaultValue={u.societe_label ?? ""} placeholder="Ex. BUSCOT, ARTEIX…" />
          </label>
          <label className="field">
            <span className="lab">Rôle</span>
            {moi ? (
              <>
                <input type="hidden" name="role" value="pilote" />
                <input value="pilote (votre compte)" disabled />
              </>
            ) : (
              <select name="role" defaultValue={u.role}>
                <option value="membre">membre</option>
                <option value="pilote">pilote (accès administration)</option>
              </select>
            )}
          </label>
        </div>
        <div className="form-foot">
          <button className="btn" type="submit">Enregistrer</button>
        </div>
      </form>

      {!moi && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Accès et suppression</div>
          <div className="page-actions" style={{ margin: 0 }}>
            <form action={setUtilisateurActif}>
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="actif" value={(!u.actif).toString()} />
              <button className={`btn ghost${u.actif ? " danger" : ""}`} type="submit">
                {u.actif ? "Désactiver l'accès" : "Réactiver l'accès"}
              </button>
            </form>
            <form action={deleteUtilisateur}>
              <input type="hidden" name="id" value={u.id} />
              <button className="btn ghost danger" type="submit">Supprimer définitivement</button>
            </form>
          </div>
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 13 }}>
            La suppression retire le compte et le détache de ses comptes rendus,
            relances et opérations (ceux-ci restent, sans responsable). Pour
            conserver l'historique lié à cette personne, préférez la désactivation.
          </p>
        </div>
      )}
    </main>
  );
}
