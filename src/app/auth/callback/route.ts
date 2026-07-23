import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/ssr-server";

export const runtime = "nodejs";

// Retour du lien magique : Supabase renvoie ici avec un `code` à échanger contre
// une session (déposée dans les cookies), puis on entre dans l'application.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?erreur=lien", url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
