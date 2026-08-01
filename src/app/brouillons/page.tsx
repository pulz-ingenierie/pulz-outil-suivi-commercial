import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getIdentite } from "@/lib/auth";
import { releverEmailsMaintenant } from "@/lib/admin-actions";
import type { Synthese } from "@/lib/synthese";
import VoiceCr from "../crs/vocal/VoiceCr";
import BrouillonSwipe from "@/components/BrouillonSwipe";
import BrouillonCarte from "@/components/BrouillonCarte";

export const dynamic = "force-dynamic";

export default async function Brouillons({
  searchParams,
}: {
  searchParams: Promise<{
    releve?: string; lus?: string; br?: string; ign?: string; err?: string; cfg?: string; erreur?: string; d?: string;
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
  const [{ data: drafts }, { data: entites }, { data: operations }, { data: contactsBase }, { data: membresRows }] = await Promise.all([
    supabase
      .from("crs")
      .select("*")
      .eq("statut", "brouillon")
      .eq("auteur_id", profil.id)
      .order("created_at", { ascending: true }),
    supabase.from("entites").select("id, nom, type").order("nom"),
    supabase.from("operations").select("id, nom").order("created_at", { ascending: false }),
    supabase.from("contacts").select("nom, prenom, entites(nom)"),
    supabase.from("utilisateurs").select("nom").eq("actif", true),
  ]);
  const membres = (membresRows ?? []).map((m: any) => String(m.nom ?? "").trim()).filter(Boolean);
  const contacts = (contactsBase ?? []).map((c: any) => ({
    nom: c.nom, prenom: c.prenom ?? null, entiteNom: c.entites?.nom ?? null,
  }));
  const { data: relancesEnCours } = await supabase
    .from("relances")
    .select("id, objet, personne, date_echeance, operation_id, entite_id, operations(nom), entites(nom)")
    .eq("statut", "a_faire");
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

  const list = (drafts ?? []) as { id: string; transcription: string | null; synthese: any; pieces_ia?: any }[];
  const today = new Date().toISOString().slice(0, 10);
  const estPilote = profil.role === "pilote";

  // Brouillon affiché : index passé en URL (?d=), borné à la liste.
  const idx = Math.min(Math.max(0, Number(sp.d) || 0), Math.max(0, list.length - 1));

  // Diagnostic pièces jointes du brouillon courant : combien de pièces lisibles
  // ont été conservées, et ce que l'e-mail portait réellement (journal).
  const piecesInfo = (() => {
    const raw = list[idx]?.pieces_ia;
    if (!raw) return null;
    const pieces = Array.isArray(raw) ? raw : Array.isArray(raw?.pieces) ? raw.pieces : [];
    const journal: string[] = Array.isArray(raw?.journal) ? raw.journal : [];
    if (!pieces.length && !journal.length) return null;
    return { count: pieces.length, journal };
  })();

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
            <div className="eyebrow">Brouillons</div>
            <h1>Brouillons à traiter</h1>
          </div>
          {boutonRelever}
        </div>
        {banniere}
        <div className="card"><span className="empty">Aucun brouillon à traiter. Tout est consolidé 🎉</span></div>
      </main>
    );
  }

  const current = list[idx];
  return (
    <main className="wrap">
      <Link className="back" href="/crs/vocal">← Dictée</Link>
      <div className="fiche-head">
        <div>
          <BrouillonSwipe index={idx} total={list.length} />
          <h1>À traiter</h1>
        </div>
        {boutonRelever}
      </div>
      {banniere}
      <p className="muted" style={{ margin: "-8px 0 18px", maxWidth: 720 }}>
        Ce brouillon (dictée mise de côté ou e-mail reçu) est en attente. Relisez, ajustez les
        rattachements si besoin (ou corrigez au chat), puis <strong>Valider et consolider</strong>.
        {list.length > 1 && <> Glissez vers la gauche pour passer au brouillon suivant.</>}
      </p>

      <BrouillonCarte key={current.id} index={idx} total={list.length}>
        <VoiceCr
          entites={entites ?? []}
          operations={operations ?? []}
          contactsBase={contacts}
          membres={membres}
          opsAvecRelance={opsAvecRelance}
          relancesOuvertes={relancesOuvertes}
          today={today}
          draftId={current.id}
          initialTranscription={current.transcription ?? ""}
          initialSynthese={(current.synthese as Synthese) ?? null}
          piecesInfo={piecesInfo}
        />
      </BrouillonCarte>
    </main>
  );
}
