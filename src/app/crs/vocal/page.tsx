import Link from "next/link";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import VoiceCr from "./VoiceCr";

export const dynamic = "force-dynamic";

export default async function VocalPage({
  searchParams,
}: {
  searchParams: Promise<{ operation?: string; entite?: string; relance?: string }>;
}) {
  const { operation: opPre, entite: entPre, relance: relPre } = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/tableau">← Tableau de bord</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const supabase = getServerSupabase()!;
  const [{ data: entites }, { data: operations }, { data: contactsBase }, { data: membresRows }, { data: relancesEnCours }] = await Promise.all([
    supabase.from("entites").select("id, nom, type").order("nom"),
    supabase.from("operations").select("id, nom, ville").order("created_at", { ascending: false }),
    supabase.from("contacts").select("nom, prenom, entites(nom)"),
    supabase.from("utilisateurs").select("nom").eq("actif", true),
    supabase.from("relances").select("id, objet, personne, date_echeance, operation_id, entite_id, operations(nom), entites(nom)").eq("statut", "a_faire"),
  ]);
  // Chaque contact connu porte le nom de sa structure (si rattaché) : l'IA s'en
  // sert pour ramener la bonne structure quand la personne est évoquée.
  const contacts = (contactsBase ?? []).map((c: any) => ({
    nom: c.nom, prenom: c.prenom ?? null, entiteNom: c.entites?.nom ?? null,
  }));
  const membres = (membresRows ?? []).map((m: any) => String(m.nom ?? "").trim()).filter(Boolean);
  // Relances en cours (avec le nom de leur affaire/structure) : sert à ne pas
  // reproposer une suite en double ET à proposer de CLÔTURER celles que le
  // nouveau compte rendu traite (« le repas a eu lieu / est fixé »).
  const relancesOuvertes = ((relancesEnCours ?? []) as any[]).map((r) => ({
    id: r.id,
    objet: r.objet ?? "",
    personne: r.personne ?? null,
    echeance: r.date_echeance ?? null,
    operationNom: r.operations?.nom ?? null,
    entiteNom: r.entites?.nom ?? null,
  }));
  const opsAvecRelance = Array.from(
    new Set(relancesOuvertes.map((r) => r.operationNom).filter(Boolean)),
  ) as string[];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="wrap">
      <Link className="back" href={opPre ? `/operations/${opPre}` : "/tableau"}>
        {opPre ? "← Retour" : "← Tableau de bord"}
      </Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Nouveau compte rendu</div>
          <h1>Saisir un compte rendu</h1>
        </div>
      </div>
      <p className="muted" style={{ margin: "-8px 0 18px", maxWidth: 720 }}>
        Après votre rendez-vous : <strong>dictez</strong> (le micro) <strong>ou écrivez</strong> le compte
        rendu, puis laissez l'IA le structurer et proposer les entités, opérations et suites concernées.
        Vous relisez et validez — rien n'est enregistré sans vous.
      </p>

      {relPre && (
        <div className="card notice" style={{ marginBottom: 14 }}>
          Ce compte rendu <strong>clôturera la relance</strong> associée dès son enregistrement.
        </div>
      )}

      <VoiceCr
        entites={entites ?? []}
        operations={operations ?? []}
        contactsBase={contacts}
        membres={membres}
        opsAvecRelance={opsAvecRelance}
        relancesOuvertes={relancesOuvertes}
        today={today}
        prefillEntite={entPre}
        prefillOperation={opPre}
        relanceId={relPre}
      />
    </main>
  );
}
