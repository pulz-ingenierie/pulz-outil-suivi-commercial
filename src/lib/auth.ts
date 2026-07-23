import "server-only";
import { createSupabaseServer } from "@/lib/supabase/ssr-server";
import { getServerSupabase } from "@/lib/supabase/server";

// Profil métier de l'utilisateur connecté (ligne `utilisateurs` correspondant à
// son e-mail). Distingue l'AUTHENTIFICATION (le lien magique prouve l'e-mail) de
// l'AUTORISATION (l'e-mail doit exister dans l'organisation, sinon accès refusé).
export interface Profil {
  id: string;
  nom: string;
  role: "membre" | "pilote";
  org_id: string;
  email: string;
}

export interface Identite {
  email: string | null; // e-mail authentifié (session), même si non autorisé
  profil: Profil | null; // profil métier si l'e-mail est reconnu
}

export async function getIdentite(): Promise<Identite> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { email: null, profil: null };

  const admin = getServerSupabase();
  if (!admin) return { email: user.email, profil: null };

  const { data } = await admin
    .from("utilisateurs")
    .select("id, nom, role, org_id, email")
    .eq("email", user.email)
    .eq("actif", true)
    .maybeSingle();

  return { email: user.email, profil: (data as Profil | null) ?? null };
}
