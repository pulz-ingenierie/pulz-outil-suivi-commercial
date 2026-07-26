"use server";

// Actions serveur — toutes les écritures passent par ici (jamais côté navigateur).
// Chaque entrée est validée contre une liste blanche avant d'atteindre la base.
// v1 mono-organisation : tant que l'authentification n'est pas branchée, on
// rattache les données à l'unique organisation existante. À remplacer par
// l'organisation de l'utilisateur connecté quand l'auth sera en place.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getIdentite } from "@/lib/auth";
import { STATUT_ORDRE, type OperationStatut } from "@/lib/types";

const ENTITE_TYPES = ["MOA", "archi", "promoteur", "bet", "confrere", "autre"] as const;
const STATUT_VIE = ["actif", "dormant"] as const;
const TYPES_RDV = ["dejeuner", "appel", "visite", "salon", "autre"] as const;
const CR_STATUTS = ["brouillon", "valide"] as const;

// Décale une date (AAAA-MM-JJ) de N jours, en restant sur le calendrier civil.
function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function requireSupabase() {
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("La base de données n'est pas encore connectée.");
  return supabase;
}

async function currentOrgId(supabase: ReturnType<typeof getServerSupabase>) {
  const { data } = await supabase!
    .from("organisations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.id) throw new Error("Aucune organisation n'existe encore dans la base.");
  return data.id as string;
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v.length ? v : null;
}

// Montant saisi librement (« 12 000 », « 12000,50 ») → nombre ou null.
function montant(fd: FormData, key: string): number | null {
  const raw = str(fd, key).replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("Le montant doit être un nombre positif.");
  return n;
}

function pickStatut(fd: FormData): OperationStatut {
  const v = str(fd, "statut");
  if (!(STATUT_ORDRE as string[]).includes(v)) throw new Error("Statut d'opération invalide.");
  return v as OperationStatut;
}

// -----------------------------------------------------------------------------
// Opérations
// -----------------------------------------------------------------------------
export async function createOperation(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);

  const nom = str(fd, "nom");
  if (!nom) throw new Error("Le nom de l'opération est obligatoire.");
  const statut = pickStatut(fd);

  const { data: op, error } = await supabase
    .from("operations")
    .insert({
      org_id,
      nom,
      statut,
      montant_estime: montant(fd, "montant_estime"),
      referent_id: strOrNull(fd, "referent_id"),
      description: strOrNull(fd, "description"),
      raison_perte: statut === "perdu" ? strOrNull(fd, "raison_perte") : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const entiteId = strOrNull(fd, "entite_id");
  if (entiteId) {
    await supabase.from("entite_operation").insert({ entite_id: entiteId, operation_id: op.id });
  }

  revalidatePath("/tableau");
  redirect(`/operations/${op.id}`);
}

// Changement rapide d'étape depuis la fiche opération (sans passer par le
// formulaire complet). Ne touche qu'au statut.
export async function changerPhase(fd: FormData) {
  const supabase = requireSupabase();
  const id = str(fd, "id");
  if (!id) throw new Error("Opération introuvable.");
  const statut = pickStatut(fd);

  const { error } = await supabase.from("operations").update({ statut }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tableau");
  revalidatePath(`/operations/${id}`);
  redirect(`/operations/${id}`);
}

export async function updateOperation(fd: FormData) {
  const supabase = requireSupabase();
  const id = str(fd, "id");
  if (!id) throw new Error("Opération introuvable.");

  const nom = str(fd, "nom");
  if (!nom) throw new Error("Le nom de l'opération est obligatoire.");
  const statut = pickStatut(fd);

  const { error } = await supabase
    .from("operations")
    .update({
      nom,
      statut,
      montant_estime: montant(fd, "montant_estime"),
      referent_id: strOrNull(fd, "referent_id"),
      description: strOrNull(fd, "description"),
      raison_perte: statut === "perdu" ? strOrNull(fd, "raison_perte") : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tableau");
  revalidatePath(`/operations/${id}`);
  redirect(`/operations/${id}`);
}

// -----------------------------------------------------------------------------
// Entités
// -----------------------------------------------------------------------------
export async function createEntite(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);

  const nom = str(fd, "nom");
  if (!nom) throw new Error("Le nom de l'entité est obligatoire.");

  const type = str(fd, "type");
  if (!(ENTITE_TYPES as readonly string[]).includes(type)) throw new Error("Type d'entité invalide.");

  const statut_vie = str(fd, "statut_vie") || "actif";
  if (!(STATUT_VIE as readonly string[]).includes(statut_vie)) throw new Error("Statut de vie invalide.");

  const { error } = await supabase.from("entites").insert({
    org_id,
    nom,
    type,
    ville: strOrNull(fd, "ville"),
    notes: strOrNull(fd, "notes"),
    statut_vie,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/tableau");
  revalidatePath("/entites");
  redirect("/entites");
}

// Renomme / corrige une structure. Comme tout est référencé par identifiant,
// la correction se répercute partout où la structure est citée.
export async function updateEntite(fd: FormData) {
  const supabase = requireSupabase();
  const id = str(fd, "id");
  if (!id) throw new Error("Structure introuvable.");
  const nom = str(fd, "nom");
  if (!nom) throw new Error("Le nom de la structure est obligatoire.");
  const type = str(fd, "type");
  if (!(ENTITE_TYPES as readonly string[]).includes(type)) throw new Error("Type de structure invalide.");

  const { error } = await supabase
    .from("entites")
    .update({ nom, type, ville: strOrNull(fd, "ville") })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tableau");
  revalidatePath("/entites");
  revalidatePath(`/entites/${id}`);
  redirect(`/entites/${id}`);
}

// Renomme / corrige une personne (contact). Même principe : référencée par
// identifiant, la correction se répercute partout.
export async function updateContact(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);
  const id = str(fd, "id");
  if (!id) throw new Error("Personne introuvable.");
  const nom = str(fd, "nom");
  if (!nom) throw new Error("Le nom est obligatoire.");

  const update: Record<string, unknown> = {
    nom,
    prenom: strOrNull(fd, "prenom"),
    fonction: strOrNull(fd, "fonction"),
  };
  // Structure : on ne la change que si un nom de structure connu est fourni
  // (on ne détache pas ici, pour éviter tout souci avant la migration 0004).
  const entiteNom = str(fd, "entite");
  if (entiteNom) {
    const { data } = await supabase
      .from("entites")
      .select("id")
      .eq("org_id", org_id)
      .ilike("nom", entiteNom)
      .maybeSingle();
    if (data?.id) update.entite_id = data.id;
  }

  const { error } = await supabase.from("contacts").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tableau");
  revalidatePath("/entites");
  revalidatePath(`/personnes/${id}`);
  redirect(`/personnes/${id}`);
}

// -----------------------------------------------------------------------------
// Comptes rendus — helpers de matérialisation (partagés saisie / brouillons)
// -----------------------------------------------------------------------------
function jsonArray(fd: FormData, key: string): any[] {
  const raw = str(fd, key);
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Y a-t-il au moins un rattachement — existant OU à créer ?
function aUnRattachement(fd: FormData): boolean {
  const e = fd.getAll("entite_ids").map(String).filter(Boolean);
  const o = fd.getAll("operation_ids").map(String).filter(Boolean);
  return (
    e.length > 0 ||
    o.length > 0 ||
    jsonArray(fd, "nouvelles_entites_json").length > 0 ||
    jsonArray(fd, "nouvelles_operations_json").length > 0
  );
}

// Matérialise les effets d'un compte rendu : crée les nouvelles structures /
// opérations proposées, rattache le CR, crée les contacts (structure résolue par
// nom) et les relances. Renvoie les identifiants finaux de rattachement.
async function materialiserCr(
  supabase: ReturnType<typeof getServerSupabase>,
  org_id: string,
  crId: string,
  fd: FormData,
  authorNom: string | null = null,
): Promise<{ entiteIds: string[]; operationIds: string[] }> {
  const sb = supabase!;
  const entiteIds = fd.getAll("entite_ids").map(String).filter(Boolean);
  const operationIds = fd.getAll("operation_ids").map(String).filter(Boolean);

  // Auteur du compte rendu (l'expéditeur pour un e-mail) : il devient le référent
  // par défaut de chaque opération du CR — chaque affaire doit avoir un référent.
  const { data: crRow } = await sb.from("crs").select("auteur_id").eq("id", crId).maybeSingle();
  const auteurId = (crRow as any)?.auteur_id ?? null;

  // Nouvelles structures.
  for (const e of jsonArray(fd, "nouvelles_entites_json")) {
    const nom = typeof e?.nom === "string" ? e.nom.trim() : "";
    if (!nom) continue;
    const type =
      typeof e?.type === "string" && (ENTITE_TYPES as readonly string[]).includes(e.type) ? e.type : "autre";
    const { data } = await sb.from("entites").insert({ org_id, nom, type }).select("id").single();
    if (data?.id) entiteIds.push(data.id);
  }
  // Nouvelles opérations (statut de départ : contact ; référent = auteur du CR).
  for (const o of jsonArray(fd, "nouvelles_operations_json")) {
    const nom = typeof o?.nom === "string" ? o.nom.trim() : "";
    if (!nom) continue;
    const { data } = await sb
      .from("operations")
      .insert({ org_id, nom, statut: "contact", referent_id: auteurId })
      .select("id")
      .single();
    if (data?.id) operationIds.push(data.id);
  }
  // Chaque opération du CR sans référent hérite de l'auteur (référent obligatoire).
  if (auteurId && operationIds.length) {
    await sb.from("operations").update({ referent_id: auteurId }).in("id", operationIds).is("referent_id", null);
  }

  if (entiteIds.length) {
    await sb.from("cr_entites").insert(entiteIds.map((entite_id) => ({ cr_id: crId, entite_id })));
  }
  if (operationIds.length) {
    await sb.from("cr_operations").insert(operationIds.map((operation_id) => ({ cr_id: crId, operation_id })));
  }

  // Lien structure ⇄ opération. On rattache chaque opération à SA/SES structure(s)
  // d'après les liens proposés par l'IA (fiables au nom : « telle affaire est
  // portée par telle structure »), au lieu de tout croiser. Une opération sans
  // lien explicite retombe sur l'ancien comportement (rattachée à toutes les
  // structures du CR) pour ne rien perdre. C'est ce lien qui fait apparaître les
  // opérations sur la fiche structure, et les structures sur la fiche opération.
  if (entiteIds.length && operationIds.length) {
    const entiteSet = new Set(entiteIds);
    const opSet = new Set(operationIds);
    const paires = new Set<string>(); // "entite_id|operation_id"
    const liens = jsonArray(fd, "liens_json");
    if (liens.length) {
      const [{ data: allEnt }, { data: allOps }] = await Promise.all([
        sb.from("entites").select("id, nom").eq("org_id", org_id),
        sb.from("operations").select("id, nom").eq("org_id", org_id),
      ]);
      const entByNom = new Map((allEnt ?? []).map((e: any) => [String(e.nom).trim().toLowerCase(), e.id]));
      const opByNom = new Map((allOps ?? []).map((o: any) => [String(o.nom).trim().toLowerCase(), o.id]));
      const opCouverte = new Set<string>();
      for (const l of liens) {
        const opId = opByNom.get(String(l?.operation ?? "").trim().toLowerCase());
        const enId = entByNom.get(String(l?.entite ?? "").trim().toLowerCase());
        // On ne relie que des objets réellement présents dans CE compte rendu.
        if (opId && enId && opSet.has(opId) && entiteSet.has(enId)) {
          paires.add(`${enId}|${opId}`);
          opCouverte.add(opId);
        }
      }
      // Repli pour les opérations sans lien explicite : toutes les structures du CR.
      for (const operation_id of opSet) {
        if (opCouverte.has(operation_id)) continue;
        for (const entite_id of entiteSet) paires.add(`${entite_id}|${operation_id}`);
      }
    } else {
      for (const entite_id of entiteSet) for (const operation_id of opSet) paires.add(`${entite_id}|${operation_id}`);
    }
    const rows = [...paires].map((k) => {
      const [entite_id, operation_id] = k.split("|");
      return { entite_id, operation_id };
    });
    if (rows.length) await sb.from("entite_operation").upsert(rows, { onConflict: "entite_id,operation_id", ignoreDuplicates: true });
  }

  // Contacts : TOUTE personne évoquée devient une fiche (carte). La structure
  // est résolue par NOM si elle est connue ; sinon la personne est créée sans
  // structure (entite_id null) — voir migration 0004.
  const persons = jsonArray(fd, "contacts_json");
  if (persons.length) {
    const { data: allEnt } = await sb.from("entites").select("id, nom").eq("org_id", org_id);
    const idByNom = new Map((allEnt ?? []).map((e: any) => [String(e.nom).toLowerCase(), e.id]));
    const nets = persons
      .map((p) => ({
        nom: typeof p?.nom === "string" ? p.nom.trim() : "",
        prenom: typeof p?.prenom === "string" && p.prenom.trim() ? p.prenom.trim() : null,
        fonction: typeof p?.fonction === "string" && p.fonction.trim() ? p.fonction.trim() : null,
        entite_id:
          typeof p?.entite === "string" && p.entite.trim()
            ? idByNom.get(p.entite.trim().toLowerCase()) ?? null
            : null,
      }))
      .filter((p) => p.nom) as {
      nom: string; prenom: string | null; fonction: string | null; entite_id: string | null;
    }[];
    // Ne PAS dupliquer un membre de l'équipe (Administration) en contact : il est
    // reconnu par son nom mais reste géré côté utilisateurs.
    const { data: membresRows } = await sb.from("utilisateurs").select("nom");
    const membreSet = new Set(
      (membresRows ?? [])
        .map((m: any) => String(m.nom ?? "").trim().toLowerCase().replace(/\s+/g, " "))
        .filter(Boolean),
    );
    const netsHorsMembres = nets.filter(
      (p) => !membreSet.has([p.prenom, p.nom].filter(Boolean).join(" ").trim().toLowerCase().replace(/\s+/g, " ")),
    );
    if (netsHorsMembres.length) {
      const key = (eid: string | null, nom: string, prenom: string | null) =>
        `${eid ?? "∅"}|${nom.toLowerCase()}|${(prenom ?? "").toLowerCase()}`;
      const seen = new Set<string>();
      // Doublons éventuels : contacts existants (avec structure concernée + sans structure).
      const entIds = [...new Set(netsHorsMembres.map((p) => p.entite_id).filter(Boolean))] as string[];
      if (entIds.length) {
        const { data: ex1 } = await sb.from("contacts").select("nom, prenom, entite_id").in("entite_id", entIds);
        for (const c of (ex1 ?? []) as any[]) seen.add(key(c.entite_id, c.nom ?? "", c.prenom ?? null));
      }
      const { data: ex2 } = await sb.from("contacts").select("nom, prenom").is("entite_id", null);
      for (const c of (ex2 ?? []) as any[]) seen.add(key(null, c.nom ?? "", c.prenom ?? null));

      const toInsert = netsHorsMembres.filter((p) => {
        const k = key(p.entite_id, p.nom, p.prenom);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const avecStruct = toInsert.filter((p) => p.entite_id);
      const sansStruct = toInsert.filter((p) => !p.entite_id);
      if (avecStruct.length) {
        await sb.from("contacts").insert(
          avecStruct.map((p) => ({ entite_id: p.entite_id, nom: p.nom, prenom: p.prenom, fonction: p.fonction, source: "vocal" })),
        );
      }
      // Personnes sans structure : possible seulement une fois la migration 0004
      // appliquée (entite_id nullable). Défensif : un échec n'interrompt pas la
      // sauvegarde du compte rendu.
      if (sansStruct.length) {
        await sb.from("contacts").insert(
          sansStruct.map((p) => ({ entite_id: null, nom: p.nom, prenom: p.prenom, fonction: p.fonction, source: "vocal" })),
        );
      }
    }
  }

  // Suites suggérées par l'IA → relances (auto).
  let synth: any = null;
  const synthRaw = str(fd, "synthese_json");
  if (synthRaw) { try { synth = JSON.parse(synthRaw); } catch { synth = null; } }
  if (synth && Array.isArray(synth.relances)) {
    const suites = synth.relances
      .map((r: any) => ({
        objet: typeof r?.objet === "string" ? r.objet.trim() : "",
        dans_jours: Number.isFinite(r?.dans_jours) ? Math.max(1, Math.round(r.dans_jours)) : 14,
        personne: typeof r?.personne === "string" && r.personne.trim() ? r.personne.trim() : null,
      }))
      .filter((r: any) => r.objet.length > 0);
    if (suites.length) {
      const base = suites.map((r: any) => ({
        org_id,
        operation_id: operationIds[0] ?? null,
        entite_id: operationIds.length ? null : (entiteIds[0] ?? null),
        cr_origine_id: crId,
        objet: r.objet,
        date_echeance: dateInDays(r.dans_jours),
        auto: true,
      }));
      // Personne du rappel : celle extraite par l'IA si explicite, sinon
      // l'auteur (il n'apparaît que si l'action n'est attribuée à personne).
      // La colonne « personne » peut ne pas encore exister (migration 0003) :
      // on tente avec, et on retombe proprement sans elle en cas d'échec.
      const { error: relErr } = await sb
        .from("relances")
        .insert(base.map((row: any, i: number) => ({ ...row, personne: suites[i].personne || authorNom || null })));
      if (relErr) await sb.from("relances").insert(base);
    }
  }

  return { entiteIds, operationIds };
}

// -----------------------------------------------------------------------------
// Comptes rendus (saisie manuelle ; la voie vocale viendra ensuite)
// -----------------------------------------------------------------------------
export async function createCr(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);

  const type_rdv = str(fd, "type_rdv") || "autre";
  if (!(TYPES_RDV as readonly string[]).includes(type_rdv)) throw new Error("Type de RDV invalide.");

  const statut = str(fd, "statut") || "brouillon";
  if (!(CR_STATUTS as readonly string[]).includes(statut)) throw new Error("Statut de compte rendu invalide.");

  const date_rdv = str(fd, "date_rdv") || new Date().toISOString().slice(0, 10);
  const transcription = strOrNull(fd, "transcription");
  if (!transcription) throw new Error("Le compte rendu ne peut pas être vide.");

  if (!aUnRattachement(fd)) {
    throw new Error("Rattachez le compte rendu à au moins une entité ou une opération (existante ou à créer).");
  }

  // Anti-doublon : si un compte rendu au texte identique vient d'être créé
  // (< 60 s), on ne le recrée pas (double-clic / double soumission).
  const seuilDoublon = new Date(Date.now() - 60000).toISOString();
  const { data: dejaCree } = await supabase
    .from("crs")
    .select("id")
    .eq("org_id", org_id)
    .eq("transcription", transcription)
    .gte("created_at", seuilDoublon)
    .limit(1)
    .maybeSingle();
  if (dejaCree?.id) {
    revalidatePath("/tableau");
    redirect("/tableau");
  }

  // Structure produite par l'IA (facultative) : on la conserve telle quelle.
  let synthese: unknown = null;
  const synthRaw = str(fd, "synthese_json");
  if (synthRaw) {
    try { synthese = JSON.parse(synthRaw); } catch { synthese = null; }
  }

  // Auteur = utilisateur connecté (si identifié).
  const { profil } = await getIdentite();

  const { data: cr, error } = await supabase
    .from("crs")
    .insert({ org_id, date_rdv, type_rdv, transcription, statut, synthese, auteur_id: profil?.id ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { operationIds } = await materialiserCr(supabase, org_id, cr.id, fd, profil?.nom ?? null);

  // Compte rendu généré depuis une relance : on la clôt (faite) et on la relie
  // au compte rendu qui la « résout ».
  const relanceId = strOrNull(fd, "relance_id");
  if (relanceId) {
    await supabase
      .from("relances")
      .update({ statut: "faite", cr_resultat_id: cr.id })
      .eq("id", relanceId)
      .eq("org_id", org_id);
  }

  revalidatePath("/tableau");
  revalidatePath("/relances");
  revalidatePath("/entites");
  for (const opId of operationIds) revalidatePath(`/operations/${opId}`);
  redirect(operationIds[0] ? `/operations/${operationIds[0]}` : "/tableau");
}

// -----------------------------------------------------------------------------
// Brouillons (issus des e-mails) — validation / suppression
// -----------------------------------------------------------------------------
// Valide un brouillon de compte rendu : le passe en « validé », crée les
// rattachements, les contacts et les relances (comme une saisie normale).
export async function finaliserBrouillon(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);

  const crId = str(fd, "cr_id");
  if (!crId) throw new Error("Brouillon introuvable.");

  const { data: existing, error: exErr } = await supabase
    .from("crs")
    .select("id, statut, org_id, synthese")
    .eq("id", crId)
    .single();
  if (exErr || !existing) throw new Error("Brouillon introuvable.");
  if (existing.org_id !== org_id) throw new Error("Accès refusé.");

  const type_rdv = str(fd, "type_rdv") || "autre";
  if (!(TYPES_RDV as readonly string[]).includes(type_rdv)) throw new Error("Type de RDV invalide.");
  const date_rdv = str(fd, "date_rdv") || new Date().toISOString().slice(0, 10);
  const transcription = strOrNull(fd, "transcription");

  if (!aUnRattachement(fd)) {
    throw new Error("Rattachez le compte rendu à au moins une entité ou une opération (existante ou à créer).");
  }

  let synthese: unknown = existing.synthese ?? null;
  const synthRaw = str(fd, "synthese_json");
  if (synthRaw) {
    try { synthese = JSON.parse(synthRaw); } catch { /* garde l'existant */ }
  }

  const update: Record<string, unknown> = { statut: "valide", type_rdv, date_rdv, synthese };
  if (transcription) update.transcription = transcription;
  const { error: upErr } = await supabase.from("crs").update(update).eq("id", crId);
  if (upErr) throw new Error(upErr.message);

  const { operationIds } = await materialiserCr(supabase, org_id, crId, fd);

  revalidatePath("/tableau");
  revalidatePath("/relances");
  revalidatePath("/entites");
  revalidatePath("/brouillons");
  for (const opId of operationIds) revalidatePath(`/operations/${opId}`);
  redirect("/brouillons");
}

// Supprime un brouillon (mail sans intérêt / doublon).
export async function supprimerBrouillon(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);
  const crId = str(fd, "cr_id");
  if (!crId) throw new Error("Brouillon introuvable.");

  const { data: ex } = await supabase.from("crs").select("id, statut, org_id").eq("id", crId).single();
  if (!ex || ex.org_id !== org_id) throw new Error("Accès refusé.");
  if (ex.statut !== "brouillon") throw new Error("Seul un brouillon peut être supprimé ici.");

  await supabase.from("crs").delete().eq("id", crId);
  revalidatePath("/brouillons");
  redirect("/brouillons");
}

// Supprime un compte rendu (validé ou brouillon). Les rattachements (cr_entites,
// cr_operations, pièces) sont supprimés en cascade ; les relances qui en
// découlent voient leur référence mise à null (schéma 0001).
export async function supprimerCr(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);
  const id = str(fd, "cr_id");
  if (!id) throw new Error("Compte rendu introuvable.");

  const { data: ex } = await supabase.from("crs").select("id, org_id").eq("id", id).maybeSingle();
  if (!ex || ex.org_id !== org_id) throw new Error("Accès refusé.");

  const { error } = await supabase.from("crs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}

// Supprime un objet (structure, opération ou personne) après vérification de
// l'organisation. Les rattachements partent en cascade selon le schéma :
//  - entite  → contacts, liens entité-opération, liens CR-entité (cascade) ;
//              les opérations partagées et les CR NE sont PAS supprimés.
//  - operation → liens entité-opération, liens CR-opération (cascade).
//  - personne  → la seule ligne contact.
async function supprimerUn(
  supabase: ReturnType<typeof getServerSupabase>,
  org_id: string,
  type: string,
  id: string,
) {
  if (!id) return;
  if (type === "entite") {
    const { data } = await supabase!.from("entites").select("id, org_id").eq("id", id).maybeSingle();
    if (!data || data.org_id !== org_id) return;
    await supabase!.from("entites").delete().eq("id", id);
  } else if (type === "operation") {
    const { data } = await supabase!.from("operations").select("id, org_id").eq("id", id).maybeSingle();
    if (!data || data.org_id !== org_id) return;
    await supabase!.from("operations").delete().eq("id", id);
  } else if (type === "personne") {
    // Les contacts n'ont pas de colonne org_id : on vérifie via leur structure
    // quand elle existe (un contact sans structure reste supprimable).
    const { data } = await supabase!.from("contacts").select("id, entite_id, entites(org_id)").eq("id", id).maybeSingle();
    if (!data) return;
    const orgContact = (data as any).entites?.org_id;
    if (orgContact && orgContact !== org_id) return;
    await supabase!.from("contacts").delete().eq("id", id);
  } else if (type === "relance") {
    const { data } = await supabase!.from("relances").select("id, org_id").eq("id", id).maybeSingle();
    if (!data || data.org_id !== org_id) return;
    await supabase!.from("relances").delete().eq("id", id);
  }
}

// Supprime l'objet visé + les objets associés explicitement cochés dans le volet
// rouge de confirmation. Rien n'est supprimé qui ne soit coché : la case
// principale est l'objet lui-même, les autres sont facultatives (décochées par
// défaut). Utilisé par le geste de suppression (swipe / appui long).
export async function supprimerObjet(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);
  const type = str(fd, "type");
  const id = str(fd, "id");
  if (!type || !id) throw new Error("Objet à supprimer introuvable.");

  // Objets associés à supprimer aussi : liste "type:id" cochée dans le volet.
  const aussi = fd.getAll("aussi").map((v) => String(v)).filter(Boolean);
  for (const paire of aussi) {
    const [t, i] = paire.split(":");
    if (t && i && !(t === type && i === id)) await supprimerUn(supabase, org_id, t, i);
  }

  await supprimerUn(supabase, org_id, type, id);
  revalidatePath("/", "layout");
}

// Détache un objet d'une fiche SANS le supprimer : retire le lien entre le
// parent (la fiche) et l'enfant (le signet). L'objet reste dans l'outil.
//  - structure ⇄ opération : on retire le lien entite_operation.
//  - structure ⇄ personne  : on détache le contact de sa structure (entite_id → null).
export async function detacherSignet(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);
  const sb = supabase;
  const pType = str(fd, "parent_type");
  const pId = str(fd, "parent_id");
  const cType = str(fd, "type");
  const cId = str(fd, "id");
  if (!pType || !pId || !cType || !cId) throw new Error("Détachement impossible : contexte manquant.");

  const paire = new Set([pType, cType]);
  const idOf = (t: string) => (t === pType ? pId : cId);

  if (paire.has("entite") && paire.has("operation")) {
    const entite_id = idOf("entite");
    const operation_id = idOf("operation");
    // Vérifie que les deux appartiennent bien à l'organisation.
    const [{ data: e }, { data: o }] = await Promise.all([
      sb.from("entites").select("id").eq("id", entite_id).eq("org_id", org_id).maybeSingle(),
      sb.from("operations").select("id").eq("id", operation_id).eq("org_id", org_id).maybeSingle(),
    ]);
    if (e && o) {
      await sb.from("entite_operation").delete().eq("entite_id", entite_id).eq("operation_id", operation_id);
    }
  } else if (paire.has("entite") && paire.has("personne")) {
    const entite_id = idOf("entite");
    const contact_id = idOf("personne");
    const { data: e } = await sb.from("entites").select("id").eq("id", entite_id).eq("org_id", org_id).maybeSingle();
    if (e) {
      await sb.from("contacts").update({ entite_id: null }).eq("id", contact_id).eq("entite_id", entite_id);
    }
  }
  // Autres paires (opération ⇄ personne, etc.) : pas de lien direct à retirer.

  revalidatePath("/", "layout");
}

// -----------------------------------------------------------------------------
// Relances — les suites à donner (créées à la main ou par l'IA)
// -----------------------------------------------------------------------------
export async function createRelance(fd: FormData) {
  const supabase = requireSupabase();
  const org_id = await currentOrgId(supabase);

  const objet = str(fd, "objet");
  if (!objet) throw new Error("L'objet de la relance est obligatoire.");

  const date_echeance = str(fd, "date_echeance") || dateInDays(7);

  const { error } = await supabase.from("relances").insert({
    org_id,
    objet,
    date_echeance,
    operation_id: strOrNull(fd, "operation_id"),
    entite_id: strOrNull(fd, "entite_id"),
    assignee_id: strOrNull(fd, "assignee_id"),
    auto: false,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/tableau");
  revalidatePath("/relances");
  redirect("/relances");
}

// Fait avancer une relance : faite / reportée (nouvelle date) / abandonnée.
export async function updateRelance(fd: FormData) {
  const supabase = requireSupabase();
  const id = str(fd, "id");
  if (!id) throw new Error("Relance introuvable.");
  const action = str(fd, "action");

  const patch: Record<string, unknown> = {};
  if (action === "faite") {
    patch.statut = "faite";
  } else if (action === "reporter") {
    const nouvelle = str(fd, "date_echeance");
    if (!nouvelle) throw new Error("Choisissez une nouvelle date.");
    patch.date_echeance = nouvelle;
    patch.statut = "a_faire";
  } else if (action === "abandonner") {
    patch.statut = "abandonnee";
    patch.raison_abandon = strOrNull(fd, "raison_abandon");
  } else {
    throw new Error("Action de relance inconnue.");
  }

  const { error } = await supabase.from("relances").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tableau");
  revalidatePath("/relances");
  redirect("/relances");
}
