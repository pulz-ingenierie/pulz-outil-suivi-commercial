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

const ENTITE_TYPES = ["MOA", "archi", "promoteur", "confrere", "autre"] as const;
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

  revalidatePath("/");
  redirect(`/operations/${op.id}`);
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

  revalidatePath("/");
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

  revalidatePath("/");
  revalidatePath("/entites");
  redirect("/entites");
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

  const entiteIds = fd.getAll("entite_ids").map((v) => String(v)).filter(Boolean);
  const operationIds = fd.getAll("operation_ids").map((v) => String(v)).filter(Boolean);
  if (!entiteIds.length && !operationIds.length) {
    throw new Error("Rattachez le compte rendu à au moins une entité ou une opération.");
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

  if (entiteIds.length) {
    await supabase.from("cr_entites").insert(entiteIds.map((entite_id) => ({ cr_id: cr.id, entite_id })));
  }
  if (operationIds.length) {
    await supabase.from("cr_operations").insert(operationIds.map((operation_id) => ({ cr_id: cr.id, operation_id })));
  }

  // Personnes détectées par l'IA → contacts (créés s'ils n'existent pas déjà,
  // rattachés à leur structure). On ne garde que celles dont la structure a été
  // résolue à une entité connue (entite_id).
  const contactsRaw = str(fd, "contacts_json");
  if (contactsRaw) {
    let persons: any[] = [];
    try { const p = JSON.parse(contactsRaw); if (Array.isArray(p)) persons = p; } catch { persons = []; }
    const nets = persons
      .map((p) => ({
        nom: typeof p?.nom === "string" ? p.nom.trim() : "",
        prenom: typeof p?.prenom === "string" && p.prenom.trim() ? p.prenom.trim() : null,
        fonction: typeof p?.fonction === "string" && p.fonction.trim() ? p.fonction.trim() : null,
        entite_id: typeof p?.entite_id === "string" && p.entite_id ? p.entite_id : null,
      }))
      .filter((p) => p.nom && p.entite_id);
    if (nets.length) {
      const entIds = [...new Set(nets.map((p) => p.entite_id as string))];
      const { data: existing } = await supabase
        .from("contacts")
        .select("nom, prenom, entite_id")
        .in("entite_id", entIds);
      const key = (eid: string, nom: string, prenom: string | null) =>
        `${eid}|${nom.toLowerCase()}|${(prenom ?? "").toLowerCase()}`;
      const seen = new Set((existing ?? []).map((c: any) => key(c.entite_id, c.nom ?? "", c.prenom ?? null)));
      const toInsert = nets.filter((p) => {
        const k = key(p.entite_id as string, p.nom, p.prenom);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (toInsert.length) {
        await supabase.from("contacts").insert(
          toInsert.map((p) => ({
            entite_id: p.entite_id,
            nom: p.nom,
            prenom: p.prenom,
            fonction: p.fonction,
            source: "vocal",
          })),
        );
      }
    }
  }

  // Suites suggérées par l'IA → relances (auto) rattachées au compte rendu et à
  // la 1re opération/entité concernée. L'utilisateur pourra les gérer ensuite.
  if (synthese && typeof synthese === "object" && Array.isArray((synthese as any).relances)) {
    const suites = (synthese as any).relances
      .map((r: any) => ({
        objet: typeof r?.objet === "string" ? r.objet.trim() : "",
        dans_jours: Number.isFinite(r?.dans_jours) ? Math.max(1, Math.round(r.dans_jours)) : 14,
      }))
      .filter((r: any) => r.objet.length > 0);
    if (suites.length) {
      await supabase.from("relances").insert(
        suites.map((r: any) => ({
          org_id,
          operation_id: operationIds[0] ?? null,
          entite_id: operationIds.length ? null : (entiteIds[0] ?? null),
          cr_origine_id: cr.id,
          objet: r.objet,
          date_echeance: dateInDays(r.dans_jours),
          auto: true,
        })),
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/relances");
  revalidatePath("/entites");
  for (const opId of operationIds) revalidatePath(`/operations/${opId}`);
  redirect(operationIds[0] ? `/operations/${operationIds[0]}` : "/");
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

  revalidatePath("/");
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

  revalidatePath("/");
  revalidatePath("/relances");
  redirect("/relances");
}
