import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Client Supabase côté serveur lié à la session de l'utilisateur (cookies).
// Sert à savoir QUI est connecté (auth). L'accès aux données métier continue de
// passer par le client `service_role` (getServerSupabase) selon la décision D5 ;
// ce client-ci ne sert qu'à l'identité.
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        // En composant serveur, l'écriture de cookies peut être interdite :
        // le rafraîchissement de session est assuré par le middleware.
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* ignore : géré par le middleware */
        }
      },
    },
  });
}
