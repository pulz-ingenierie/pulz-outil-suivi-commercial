"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/ssr-server";

// Déconnexion : ferme la session (efface les cookies) puis renvoie à l'écran
// de connexion.
export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
