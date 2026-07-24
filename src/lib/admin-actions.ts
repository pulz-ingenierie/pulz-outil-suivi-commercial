"use server";

// Actions d'administration des utilisateurs — RÉSERVÉES au rôle « pilote ».
// Chaque action revérifie le rôle côté serveur (jamais confiance au navigateur).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getIdentite } from "@/lib/auth";
import { envoyerRappelsRelances } from "@/lib/relances-digest";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { releverEmails } from "@/lib/email-intake";

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

// Envoi d'un e-mail de test au pilote lui-même, pour vérifier que la connexion
// d'envoi (Gmail) fonctionne — indépendamment des relances. Réservé pilotes.
export async function envoyerEmailTest() {
  const { supabase, profil } = await requirePilote();
  const { data: u } = await supabase
    .from("utilisateurs")
    .select("email, nom")
    .eq("id", profil.id)
    .single();

  let status: string;
  if (!isEmailConfigured()) {
    status = "noconf";
  } else if (!u?.email) {
    status = "noemail";
  } else {
    try {
      const { sent } = await sendEmail({
        to: u.email,
        subject: "Test — Suivi commercial (moeïa)",
        html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#16212B">
          <p style="font-size:15px">Bonjour ${u.nom ?? ""},</p>
          <p style="font-size:15px">Cet e-mail confirme que l'<strong>envoi depuis l'outil fonctionne</strong> ✅.</p>
          <p style="font-size:13px;color:#8496A2;margin-top:20px">Suivi commercial · moeïa — message de test.</p>
        </div>`,
      });
      status = sent ? "ok" : "noconf";
    } catch (e) {
      status = "err:" + (e instanceof Error ? e.message : "inconnue");
    }
  }

  revalidatePath("/relances");
  redirect(`/relances?mailtest=${encodeURIComponent(status)}`);
}

// Relevé manuel de la boîte mail (pour tester à la demande). Réservé pilotes.
export async function releverEmailsMaintenant() {
  await requirePilote();
  let q: string;
  try {
    const r = await releverEmails();
    q = new URLSearchParams({
      releve: "1",
      lus: String(r.lus),
      br: String(r.brouillons),
      ign: String(r.ignores),
      err: String(r.erreurs),
      cfg: r.configured ? "1" : "0",
    }).toString();
  } catch (e) {
    q = new URLSearchParams({
      releve: "1",
      erreur: e instanceof Error ? e.message : "inconnue",
    }).toString();
  }
  revalidatePath("/brouillons");
  redirect(`/brouillons?${q}`);
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
