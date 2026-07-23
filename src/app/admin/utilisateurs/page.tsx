import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getIdentite } from "@/lib/auth";
import { createUtilisateur, setUtilisateurActif, setUtilisateurRole } from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

type U = {
  id: string;
  nom: string;
  email: string;
  role: "membre" | "pilote";
  actif: boolean;
  societe_label: string | null;
};

export default async function AdminUtilisateurs() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/">← Retour au tableau de bord</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const { profil } = await getIdentite();

  // Réservé aux pilotes.
  if (!profil || profil.role !== "pilote") {
    return (
      <main className="wrap">
        <Link className="back" href="/">← Retour au tableau de bord</Link>
        <div className="card notice">
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Réservé aux pilotes</h2>
          <p className="muted" style={{ margin: 0 }}>
            La gestion des utilisateurs est accessible uniquement aux comptes « pilote ».
          </p>
        </div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const { data } = await supabase
    .from("utilisateurs")
    .select("id, nom, email, role, actif, societe_label")
    .order("actif", { ascending: false })
    .order("nom");
  const users = (data ?? []) as U[];

  return (
    <main className="wrap">
      <Link className="back" href="/">← Retour au tableau de bord</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Administration</div>
          <h1>Utilisateurs <span className="count-badge">{users.length}</span></h1>
        </div>
      </div>
      <p className="muted" style={{ margin: "-8px 0 18px", maxWidth: 720 }}>
        Les personnes listées ici peuvent se connecter (par lien e-mail). Un compte
        « désactivé » ne peut plus entrer. Un « pilote » a accès à cette page.
      </p>

      <div className="utable">
        <div className="utrow uthead">
          <span>Nom</span><span>E-mail</span><span>Société</span><span>Rôle</span><span>Accès</span>
        </div>
        {users.map((u) => (
          <div className={`utrow${u.actif ? "" : " off"}`} key={u.id}>
            <span className="u-nom">{u.nom}{u.id === profil.id ? " (vous)" : ""}</span>
            <span className="u-mail">{u.email}</span>
            <span className="u-soc">{u.societe_label ?? "—"}</span>
            <span className="u-role">
              {u.id === profil.id ? (
                <span className="rolechip pilote">pilote</span>
              ) : (
                <form action={setUtilisateurRole} className="inline">
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role}>
                    <option value="membre">membre</option>
                    <option value="pilote">pilote</option>
                  </select>
                  <button className="btn ghost mini" type="submit">OK</button>
                </form>
              )}
            </span>
            <span className="u-actif">
              {u.id === profil.id ? (
                <span className="pill auto">actif</span>
              ) : (
                <form action={setUtilisateurActif} className="inline">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="actif" value={(!u.actif).toString()} />
                  <button className={`btn ghost mini${u.actif ? " danger" : ""}`} type="submit">
                    {u.actif ? "Désactiver" : "Réactiver"}
                  </button>
                </form>
              )}
            </span>
          </div>
        ))}
      </div>

      <section className="rel-group">
        <h2 className="rel-h muted-h">Ajouter un utilisateur</h2>
        <form action={createUtilisateur} className="form card">
          <div className="row2">
            <label className="field">
              <span className="lab">Nom <em>*</em></span>
              <input name="nom" required placeholder="Prénom Nom" />
            </label>
            <label className="field">
              <span className="lab">E-mail <em>*</em></span>
              <input type="email" name="email" required placeholder="prenom@societe.fr" />
            </label>
          </div>
          <div className="row2">
            <label className="field">
              <span className="lab">Société (facultatif)</span>
              <input name="societe_label" placeholder="Ex. BUSCOT, ARTEIX…" />
            </label>
            <label className="field">
              <span className="lab">Rôle</span>
              <select name="role" defaultValue="membre">
                <option value="membre">membre</option>
                <option value="pilote">pilote (accès administration)</option>
              </select>
            </label>
          </div>
          <div className="form-foot">
            <button className="btn" type="submit">Ajouter l'utilisateur</button>
          </div>
        </form>
      </section>
    </main>
  );
}
