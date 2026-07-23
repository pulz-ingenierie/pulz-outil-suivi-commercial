"use client";

import { createBrowserClient } from "@supabase/ssr";

// Client Supabase côté navigateur — utilise la clé publique (anon).
// Sert uniquement à demander l'envoi du lien de connexion (magic link).
// Aucune clé secrète ici.
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, anon);
}
