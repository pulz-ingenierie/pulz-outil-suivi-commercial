import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client Supabase côté serveur uniquement.
// Utilise la clé `service_role` (SECRET) : l'accès aux données passe par le
// serveur, jamais par le navigateur (décision D5 + RLS deny par défaut).
// La clé secrète n'est jamais exposée au client.
//
// Renvoie `null` si la configuration n'est pas encore en place, pour que
// l'application affiche un état « à configurer » plutôt que de planter.

let cached: SupabaseClient | null | undefined;

export function getServerSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    cached = null;
    return null;
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
