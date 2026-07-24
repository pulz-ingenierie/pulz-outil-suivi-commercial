import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getIdentite } from "@/lib/auth";
import { releverEmailsMaintenant } from "@/lib/admin-actions";
import type { Synthese } from "@/lib/synthese";
import VoiceCr from "../crs/vocal/VoiceCr";

export const dynamic = "force-dynamic";

export default async function Brouillons({
  searchParams,
}: {
  searchParams: Promise<{
    releve?: string; lus?: string; br?: string; ign?: string; err?: string; cfg?: string; erreur?: string;
  }>;
}) {
  const sp = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <main className="wrap">
        <Link className="back" href="/crs/vocal">← Dictée</Link>
        <div className="card notice"><h2>Base de données à connecter</h2></div>
      </main>
    );
  }

  const { profil } = await getIdentite();
  if (!profil) redirect("/crs/vocal");

  const supabase = getServerSupabase()!;
  const [{ data: drafts }, { data: entites }, { data: operations }, { data: contactsBase }] = await Promise.all([
    supabase
      .from("crs")
      .select("id, transcription, synthese, created_at")
      .eq("statut", "brouillon")
      .eq("auteur_id", profil.id)
      .order("created_at", { ascending: true }),
    supabase.from("entites").select("id, nom, type").order("nom"),
    supabase.from("operations").select("id, nom").order("created_at", { ascending: false }),
    supabase.from("contacts").select("nom, prenom"),
  ]);

  const list = (drafts ?? []) as { id: string; transcription: string | null; synthese: any }[];
  const today = new Date().toISOString().slice(0, 10);
  const estPilote = profil.role === "pilote";

  const banniere = sp.releve !== undefined && (
    <div className={`card notice${sp.erreur ? " err" : ""}`} style={{ marginBottom: 14 }}>
      {sp.erreur
        ? `Relevé impossible : ${sp.erreur}`
        : sp.cfg === "0"
          ? "Réception non configurée (GMAIL_USER / GMAIL_APP_PASSWORD manquants dans Vercel)."
          : `Relevé effectué : ${sp.br ?? 0} brouillon(s) créé(s) sur ${sp.lus ?? 0} mail(s) lu(s)${
              Number(sp.ign) > 0 ? `, ${sp.ign} ignoré(s) (expéditeur non membre)` : ""
            }${Number(sp.err) > 0 ? `, ${sp.err} erreur(s)` : ""}.`}
    </div>
  );

  const boutonRelever = estPilote && (
    <form action={releverEmailsMaintenant}>
      <button className="btn ghost" type="submit">📥 Relever les e-mails</button>
    </form>
  );

  if (!list.length) {
    return (
      <main className="wrap">
        <Link className="back" href="/crs/vocal">← Dictée</Link>
        <div className="fiche-head">
          <div>
            <div className="eyebrow">Boîte de réception</div>
            <h1>Brouillons à traiter</h1>
          </div>
          {boutonRelever}
        </div>
        {banniere}
        <div className="card"><span className="empty">Aucun brouillon à traiter. Tout est consolidé 🎉</span></div>
      </main>
    );
  }

  const current = list[0];
  return (
    <main className="wrap">
      <Link className="back" href="/crs/vocal">← Dictée</Link>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Brouillon 1 sur {list.length}</div>
          <h1>À traiter</h1>
        </div>
        {boutonRelever}
      </div>
      {banniere}
      <p className="muted" style={{ margin: "-8px 0 18px", maxWidth: 720 }}>
        Ce brouillon a été préparé à partir d'un e-mail reçu. Relisez, ajustez les rattachements
        si besoin (ou corrigez au chat), puis <strong>Valider et consolider</strong> — ou
        <strong> Passer</strong> pour le traiter plus tard.
      </p>

      <VoiceCr
        entites={entites ?? []}
        operations={operations ?? []}
        contactsBase={contactsBase ?? []}
        today={today}
        moiNom={profil.nom ?? null}
        draftId={current.id}
        initialTranscription={current.transcription ?? ""}
        initialSynthese={(current.synthese as Synthese) ?? null}
      />
    </main>
  );
}
