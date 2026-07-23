import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import VoiceCr from "./VoiceCr";

export const dynamic = "force-dynamic";

export default async function VocalPage({
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
          <div className="eyebrow">Compte rendu vocal</div>
          <h1>Dicter un compte rendu</h1>
        </div>
      </div>
      <p className="muted" style={{ margin: "-8px 0 18px", maxWidth: 720 }}>
        Parlez après votre rendez-vous : l'outil transcrit, puis l'IA vous propose un compte rendu
        structuré et les suites à donner. Vous relisez et validez — rien n'est enregistré sans vous.
      </p>

      <VoiceCr
        entites={entites ?? []}
        operations={operations ?? []}
        today={today}
        prefillEntite={entPre}
        prefillOperation={opPre}
      />
    </main>
  );
}
