"use server";

// Actions d'administration des utilisateurs — RÉSERVÉES au rôle « pilote ».
// Chaque action revérifie le rôle côté serveur (jamais confiance au navigateur).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getIdentite } from "@/lib/auth";
import { envoyerRappelsRelances } from "@/lib/relances-digest";

const ROLES = ["membre", "pilote"] as const;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

// Vérifie que l'appelant est bien un pilote et renvoie le contexte utile.
async function requirePilote() {
  const { profil } = await getIdentite();
  if (!profil || profil.role !== "pilote") {
    throw new Error("Action réservée aux pilotes.");
  }
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("La base de données n'est pas connectée.");
  return { supabase, profil };
}

export async function createUtilisateur(fd: FormData) {
  const { supabase, profil } = await requirePilote();

  const nom = str(fd, "nom");
  if (!nom) throw new Error("Le nom est obligatoire.");

  const email = str(fd, "email").toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Adresse e-mail invalide.");

  const role = ROLES.includes(str(fd, "role") as any) ? str(fd, "role") : "membre";
  const societe_label = str(fd, "societe_label") || null;

  const { error } = await supabase.from("utilisateurs").insert({
    org_id: profil.org_id,
    nom,
    email,
    role,
    societe_label,
    actif: true,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Cette adresse e-mail est déjà enregistrée.");
    throw new Error(error.message);
  }

  revalidatePath("/admin/utilisateurs");
  redirect("/admin/utilisateurs");
}

export async function setUtilisateurActif(fd: FormData) {
  const { supabase, profil } = await requirePilote();
  const id = str(fd, "id");
  const actif = str(fd, "actif") === "true";
  if (!id) throw new Error("Utilisateur introuvable.");
  // Garde-fou : on ne peut pas se désactiver soi-même (risque de verrouillage).
  if (id === profil.id && !actif) throw new Error("Vous ne pouvez pas désactiver votre propre compte.");

  const { error } = await supabase.from("utilisateurs").update({ actif }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/utilisateurs");
  redirect("/admin/utilisateurs");
}

export async function setUtilisateurRole(fd: FormData) {
  const { supabase, profil } = await requirePilote();
  const id = str(fd, "id");
  const role = str(fd, "role");
  if (!id || !ROLES.includes(role as any)) throw new Error("Rôle invalide.");
  // Garde-fou : on ne peut pas se retirer à soi-même le rôle pilote.
  if (id === profil.id && role !== "pilote") throw new Error("Vous ne pouvez pas retirer votre propre rôle pilote.");

  const { error } = await supabase.from("utilisateurs").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/utilisateurs");
  redirect("/admin/utilisateurs");
}

// Envoi manuel des rappels (pour tester / relancer à la demande). Réservé pilotes.
export async function envoyerRappelsMaintenant() {
  await requirePilote();
  const r = await envoyerRappelsRelances();
  revalidatePath("/relances");
  const q = new URLSearchParams({
    dest: String(r.destinataires),
    rel: String(r.relances),
    ign: String(r.ignorees),
    cfg: r.configured ? "1" : "0",
  }).toString();
  redirect(`/relances?${q}`);
}
