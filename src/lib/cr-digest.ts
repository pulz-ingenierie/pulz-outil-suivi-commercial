import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { titreOperation } from "@/lib/titres";
import { STATUT_LABELS, type OperationStatut } from "@/lib/types";

// Récapitulatif de fin de journée : tous les comptes rendus VALIDÉS saisis
// depuis le dernier envoi, adressés à TOUS les membres actifs (l'auteur inclus).
// Objectif : un niveau d'information commun dans le groupement.
//
// La sélection se fait sur un marqueur porté par le compte rendu
// (`digest_envoye_at`), pas sur une fenêtre de temps : l'envoi est idempotent
// (pas de doublon si la tâche se déclenche deux fois) et rattrapant (un envoi
// manqué repart le lendemain au lieu d'être perdu). Voir migration 0011.

export interface CrDigestResult {
  configured: boolean; // la clé e-mail est-elle en place ?
  crs: number; // comptes rendus inclus dans l'envoi
  destinataires: number; // membres qui ont reçu le récapitulatif
  raison?: string; // pourquoi rien n'a été envoyé, le cas échéant
}

// -----------------------------------------------------------------------------
// Mise en forme
// -----------------------------------------------------------------------------

function escape(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function dateLongue(d: string): string {
  try {
    return new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return d;
  }
}

function dateCourte(d: string): string {
  try {
    return new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return d;
  }
}

const TYPE_RDV_LABEL: Record<string, string> = {
  dejeuner: "Déjeuner",
  appel: "Appel",
  visite: "Visite",
  salon: "Salon",
  autre: "Échange",
};

// Étiquette colorée (structure, affaire, signalement). Les couleurs sont en dur
// et inline : un e-mail ne peut pas lire les variables CSS de l'application.
function etiquette(texte: string, fond: string, encre: string, petite = false): string {
  const taille = petite ? "11px" : "12px";
  return `<span style="display:inline-block;font-size:${taille};padding:3px 9px;border-radius:5px;background:${fond};color:${encre};font-weight:600;margin:0 4px 4px 0">${escape(texte)}</span>`;
}

const ET_STRUCTURE = (t: string) => etiquette(t, "#EAF2EC", "#2F6540");
const ET_AFFAIRE = (t: string) => etiquette(t, "#F0EEFA", "#4A4478");
const ET_NOUVEAU = (t: string) => etiquette(t, "#F8F0DC", "#855900", true);
const ET_PHASE = (t: string) => etiquette(t, "#EAF2EC", "#2F6540", true);

// -----------------------------------------------------------------------------
// Données d'un compte rendu, prêtes à mettre en page
// -----------------------------------------------------------------------------

interface CrPrepare {
  auteur: string;
  typeRdv: string;
  dateRdv: string;
  structures: string[];
  affaires: string[];
  nouvellesStructures: Set<string>;
  nouvellesAffaires: Set<string>;
  changementsPhase: string[]; // « Nouvelle étape : Gagné »
  resume: string;
  pointsCles: string[];
  suites: { objet: string; responsable: string | null; echeance: string }[];
}

function blocCr(cr: CrPrepare): string {
  const chapeau = [
    ...cr.structures.map((s) => ET_STRUCTURE(s) + (cr.nouvellesStructures.has(s) ? ET_NOUVEAU("nouvelle structure") : "")),
    ...cr.affaires.map((a) => ET_AFFAIRE(a) + (cr.nouvellesAffaires.has(a) ? ET_NOUVEAU("nouvelle affaire") : "")),
    ...cr.changementsPhase.map((p) => ET_PHASE(p)),
  ].join("");

  const points = cr.pointsCles.length
    ? `<ul style="margin:10px 0 0;padding-left:18px;font-size:14px;color:#57534E;line-height:1.5">${
        cr.pointsCles.map((p) => `<li>${escape(p)}</li>`).join("")
      }</ul>`
    : "";

  const suites = cr.suites.length
    ? `<div style="margin:12px 0 0;padding:10px 12px;background:#F4F3EF;border-radius:6px">
         <div style="font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#8F8A82;font-weight:700;margin-bottom:5px">${
           cr.suites.length > 1 ? "Suites à donner" : "Suite à donner"
         }</div>
         ${cr.suites
           .map(
             (s) =>
               `<div style="font-size:13.5px;margin-top:4px">${escape(s.objet)} <span style="color:#8F8A82">— ${
                 s.responsable ? `${escape(s.responsable)} · ` : ""
               }${escape(dateCourte(s.echeance))}</span></div>`,
           )
           .join("")}
       </div>`
    : "";

  return `<tr><td style="padding:20px 28px 0">
    <div style="font-size:12.5px;color:#8F8A82">
      <strong style="color:#221F1A;font-weight:600">${escape(cr.auteur)}</strong> · ${escape(
        TYPE_RDV_LABEL[cr.typeRdv] ?? "Échange",
      )} · ${escape(dateLongue(cr.dateRdv))}
    </div>
    ${chapeau ? `<div style="margin:9px 0 0">${chapeau}</div>` : ""}
    ${cr.resume ? `<p style="margin:11px 0 0;font-size:14.5px;line-height:1.55">${escape(cr.resume)}</p>` : ""}
    ${points}
    ${suites}
  </td></tr>
  <tr><td style="padding:20px 28px 0"><div style="height:1px;background:#EEECE7"></div></td></tr>`;
}

function corps(crs: CrPrepare[], jour: string, lienApp: string | null): string {
  const nbStructures = new Set(crs.flatMap((c) => c.structures)).size;
  const nbNouvellesAffaires = new Set(crs.flatMap((c) => [...c.nouvellesAffaires])).size;
  const nbSuites = crs.reduce((n, c) => n + c.suites.length, 0);

  const compte = [
    `${crs.length} nouveau${crs.length > 1 ? "x" : ""} compte${crs.length > 1 ? "s" : ""} rendu${crs.length > 1 ? "s" : ""}`,
    nbStructures ? `${nbStructures} structure${nbStructures > 1 ? "s" : ""} concernée${nbStructures > 1 ? "s" : ""}` : "",
    nbNouvellesAffaires ? `${nbNouvellesAffaires} affaire${nbNouvellesAffaires > 1 ? "s" : ""} créée${nbNouvellesAffaires > 1 ? "s" : ""}` : "",
    nbSuites ? `${nbSuites} suite${nbSuites > 1 ? "s" : ""} à donner` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const bouton = lienApp
    ? `<a href="${escape(lienApp)}" style="display:inline-block;background:#221F1A;color:#FFFFFF;text-decoration:none;font-size:13.5px;font-weight:600;padding:9px 18px;border-radius:8px">Ouvrir le suivi commercial</a>`
    : "";

  return `<div style="background:#EEECE7;padding:0;margin:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#EEECE7">
  <tr><td align="center" style="padding:0">
  <table width="600" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:600px;width:100%;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#221F1A">

    <tr><td style="padding:22px 28px 0">
      <div style="font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:#8F8A82;font-weight:700">moeïa · Suivi commercial</div>
      <div style="height:2px;width:34px;background:#04B7F9;margin:9px 0 14px;font-size:0;line-height:0">&nbsp;</div>
      <div style="font-size:21px;font-weight:600;line-height:1.25">Comptes rendus du ${escape(jour)}</div>
      <div style="font-size:14px;color:#57534E;margin-top:5px">${escape(compte)}</div>
    </td></tr>
    <tr><td style="padding:18px 28px 0"><div style="height:1px;background:#E3E0DA"></div></td></tr>

    ${crs.map(blocCr).join("")}

    <tr><td style="padding:24px 28px 26px">
      ${bouton}
      <p style="margin:${bouton ? "16px" : "0"} 0 0;font-size:12px;color:#8F8A82;line-height:1.5">
        Envoyé en fin de journée aux membres du groupement, uniquement les jours
        où un compte rendu a été saisi. Message automatique — moeïa.
      </p>
    </td></tr>

  </table>
  </td></tr>
  </table>
  </div>`;
}

// -----------------------------------------------------------------------------
// Envoi
// -----------------------------------------------------------------------------

// Nombre de comptes rendus au-delà duquel on n'envoie pas tout d'un coup : un
// e-mail de 80 comptes rendus n'est lu par personne, et certains clients le
// tronquent. Au-delà, on n'inclut que les plus récents ; le reste reste marqué
// comme non envoyé et partira au prochain récapitulatif.
const MAX_CRS_PAR_ENVOI = 25;

export async function envoyerDigestCrs(): Promise<CrDigestResult> {
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("La base de données n'est pas connectée.");

  // 1. Les comptes rendus validés jamais inclus dans un récapitulatif.
  const { data: crsRaw, error } = await supabase
    .from("crs")
    .select("id, auteur_id, date_rdv, type_rdv, synthese, created_at")
    .eq("statut", "valide")
    .is("digest_envoye_at", null)
    .order("created_at", { ascending: true })
    .limit(MAX_CRS_PAR_ENVOI);
  if (error) {
    // Colonne absente = migration 0011 pas encore appliquée. On le dit
    // clairement plutôt que d'envoyer un récapitulatif faux ou en double.
    throw new Error(
      `Lecture des comptes rendus impossible (${error.message}). Si la colonne « digest_envoye_at » manque, appliquez supabase/migrations/0011_crs_digest.sql.`,
    );
  }

  const crs = (crsRaw ?? []) as any[];
  if (!crs.length) {
    return { configured: isEmailConfigured(), crs: 0, destinataires: 0, raison: "aucun compte rendu nouveau" };
  }

  const crIds = crs.map((c) => c.id);
  const depuis = crs[0].created_at as string; // le plus ancien du lot

  // 2. Tout le contexte, en requêtes parallèles.
  const [
    { data: auteurs },
    { data: liensEnt },
    { data: liensOps },
    { data: relances },
    { data: membres },
  ] = await Promise.all([
    supabase.from("utilisateurs").select("id, nom"),
    supabase.from("cr_entites").select("cr_id, entites(id, nom, created_at)").in("cr_id", crIds),
    supabase.from("cr_operations").select("cr_id, operations(id, nom, created_at)").in("cr_id", crIds),
    supabase
      .from("relances")
      .select("cr_origine_id, objet, date_echeance, assignee_id")
      .in("cr_origine_id", crIds)
      .eq("statut", "a_faire"),
    supabase.from("utilisateurs").select("id, nom, email, actif").eq("actif", true),
  ]);

  const nomParUtilisateur = new Map((auteurs ?? []).map((u: any) => [u.id, u.nom as string]));

  // Structures / affaires de chaque compte rendu. « Nouvelle » = créée depuis le
  // plus ancien compte rendu du lot : c'est bien une nouveauté pour le lecteur.
  const structuresParCr = new Map<string, string[]>();
  const nouvellesStructures = new Set<string>();
  for (const l of (liensEnt ?? []) as any[]) {
    const e = l.entites;
    if (!e?.nom) continue;
    const listeS = structuresParCr.get(l.cr_id) ?? [];
    listeS.push(e.nom);
    structuresParCr.set(l.cr_id, listeS);
    if (e.created_at && e.created_at >= depuis) nouvellesStructures.add(e.nom);
  }

  const affairesParCr = new Map<string, string[]>();
  const nouvellesAffaires = new Set<string>();
  for (const l of (liensOps ?? []) as any[]) {
    const o = l.operations;
    if (!o?.nom) continue;
    const titre = titreOperation(o.nom);
    const listeA = affairesParCr.get(l.cr_id) ?? [];
    listeA.push(titre);
    affairesParCr.set(l.cr_id, listeA);
    if (o.created_at && o.created_at >= depuis) nouvellesAffaires.add(titre);
  }

  const suitesParCr = new Map<string, CrPrepare["suites"]>();
  for (const r of (relances ?? []) as any[]) {
    if (!r.cr_origine_id) continue;
    const list = suitesParCr.get(r.cr_origine_id) ?? [];
    list.push({
      objet: r.objet,
      responsable: r.assignee_id ? nomParUtilisateur.get(r.assignee_id) ?? null : null,
      echeance: r.date_echeance,
    });
    suitesParCr.set(r.cr_origine_id, list);
  }

  // 3. Mise en forme de chaque compte rendu.
  const prepares: CrPrepare[] = crs.map((c) => {
    const s = (c.synthese ?? {}) as any;
    // Le changement d'étape d'une affaire ne se lit que dans la synthèse : rien
    // ne conserve l'historique des phases en base.
    const changements = Array.isArray(s.changements_phase)
      ? (s.changements_phase as any[])
          .map((x) => STATUT_LABELS[x?.phase as OperationStatut])
          .filter(Boolean)
          .map((label) => `Nouvelle étape : ${label}`)
      : [];
    return {
      auteur: (c.auteur_id ? nomParUtilisateur.get(c.auteur_id) : null) ?? "Auteur inconnu",
      typeRdv: c.type_rdv ?? "autre",
      dateRdv: c.date_rdv,
      structures: [...new Set(structuresParCr.get(c.id) ?? [])],
      affaires: [...new Set(affairesParCr.get(c.id) ?? [])],
      nouvellesStructures,
      nouvellesAffaires,
      changementsPhase: [...new Set(changements)],
      resume: typeof s.resume === "string" ? s.resume : "",
      pointsCles: Array.isArray(s.points_cles) ? s.points_cles.filter((p: unknown) => typeof p === "string") : [],
      suites: suitesParCr.get(c.id) ?? [],
    };
  });

  // 4. Destinataires : TOUS les membres actifs, l'auteur compris.
  const destinatairesPossibles = ((membres ?? []) as any[]).filter((u) => u.email);
  if (!destinatairesPossibles.length) {
    return { configured: isEmailConfigured(), crs: crs.length, destinataires: 0, raison: "aucun membre actif avec e-mail" };
  }

  const jour = dateLongue(new Date().toISOString().slice(0, 10));
  const lienApp = process.env.NEXT_PUBLIC_APP_URL || null;
  const html = corps(prepares, jour, lienApp ? `${lienApp.replace(/\/$/, "")}/tableau` : null);
  const sujet = `Comptes rendus du jour — ${crs.length} nouveau${crs.length > 1 ? "x" : ""}`;

  let destinataires = 0;
  for (const u of destinatairesPossibles) {
    const { sent } = await sendEmail({ to: u.email, subject: sujet, html });
    if (sent) destinataires += 1;
  }

  // 5. On ne marque les comptes rendus comme envoyés QUE si quelqu'un les a
  // reçus. Sinon (clé e-mail absente, panne SMTP), ils repartiront au prochain
  // récapitulatif au lieu d'être perdus.
  if (destinataires > 0) {
    await supabase.from("crs").update({ digest_envoye_at: new Date().toISOString() }).in("id", crIds);
  }

  return {
    configured: isEmailConfigured(),
    crs: crs.length,
    destinataires,
    raison: destinataires === 0 ? "envoi e-mail non configuré ou en échec — rien n'a été marqué comme envoyé" : undefined,
  };
}
