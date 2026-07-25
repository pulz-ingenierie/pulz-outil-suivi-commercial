import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import VoletCard from "@/components/VoletCard";

export const dynamic = "force-dynamic";

const TYPE_ENTITE: Record<string, string> = {
  MOA: "Maître d'ouvrage",
  archi: "Architecte",
  promoteur: "Promoteur",
  bet: "Bureau d'études (BET)",
  confrere: "Confrère",
  autre: "Structure",
};

export default async function Entites() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/tableau">← Retour au tableau de bord</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const { data: entites } = await supabase
    .from("entites")
    .select("id, nom, type, ville, statut_vie")
    .order("nom");

  const list = entites ?? [];

  return (
    <main className="wrap">
      <Link className="back" href="/tableau">← Retour au tableau de bord</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Réseau</div>
          <h1>Entités <span className="count-badge">{list.length}</span></h1>
        </div>
        <Link className="btn" href="/entites/nouvelle">+ Nouvelle entité</Link>
      </div>

      {list.length ? (
        <div className="minigrid">
          {list.map((e: any) => (
            <VoletCard className="minicard" type="entite" id={e.id} key={e.id}>
              <div className="mc-top">
                <span className="mc-nom">{e.nom}</span>
                <span className="sig-d type"><span className="sig-lbl">{TYPE_ENTITE[e.type] ?? e.type}</span></span>
              </div>
              <div className="mc-meta">
                {e.ville && <span>{e.ville}</span>}
                {e.statut_vie === "dormant" && <span className="pill dormant">en sommeil</span>}
              </div>
            </VoletCard>
          ))}
        </div>
      ) : (
        <div className="card">
          <span className="empty">Aucune entité pour l'instant. </span>
          <Link href="/entites/nouvelle">Créer la première.</Link>
        </div>
      )}
    </main>
  );
}
