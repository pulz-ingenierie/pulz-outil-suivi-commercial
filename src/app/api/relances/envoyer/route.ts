import { NextResponse } from "next/server";
import { envoyerRappelsRelances } from "@/lib/relances-digest";

// Déclenchée automatiquement chaque matin (planification Vercel, voir vercel.json).
// Protégée par un secret partagé : sans le bon en-tête, l'appel est refusé, afin
// que personne ne puisse déclencher des envois depuis l'extérieur.

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
    const result = await envoyerRappelsRelances();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
