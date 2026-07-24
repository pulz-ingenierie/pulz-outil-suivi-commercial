import { NextResponse } from "next/server";
import { releverEmails } from "@/lib/email-intake";

// Relevé de la boîte mail dédiée. Déclenché périodiquement (planification Vercel,
// voir vercel.json) et protégé par un secret partagé, afin que personne ne puisse
// le lancer depuis l'extérieur.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  try {
    const result = await releverEmails();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
