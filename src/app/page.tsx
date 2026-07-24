import { redirect } from "next/navigation";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { getIdentite } from "@/lib/auth";

export const dynamic = "force-dynamic";

// « Voix d'abord » + brouillons : à l'ouverture, si le membre a des brouillons
// à traiter (issus des e-mails), on l'y emmène ; sinon, on ouvre la dictée. Le
// tableau de bord (pilotage) vit sur /tableau, accessible via le logo en haut.
export default async function Home() {
  let hasDrafts = false;
  if (isSupabaseConfigured()) {
    try {
      const { profil } = await getIdentite();
      const supabase = getServerSupabase();
      if (profil && supabase) {
        const { count } = await supabase
          .from("crs")
          .select("id", { count: "exact", head: true })
          .eq("statut", "brouillon")
          .eq("auteur_id", profil.id);
        hasDrafts = (count ?? 0) > 0;
      }
    } catch {
      hasDrafts = false;
    }
  }
  redirect(hasDrafts ? "/brouillons" : "/crs/vocal");
}
