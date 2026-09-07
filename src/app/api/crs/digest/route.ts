import { NextResponse } from "next/server";
import { envoyerDigestCrs } from "@/lib/cr-digest";

// Récapitulatif de fin de journée des comptes rendus (voir vercel.json).
//
// La planification Vercel s'exprime en UTC : une heure fixe dériverait d'une
// heure entre l'été et l'hiver. La tâche est donc déclenchée CHAQUE HEURE et
// c'est ce code qui décide, à l'heure de Paris, si c'est le moment.
// Protégée par le même secret partagé que les rappels de relances.

export const runtime = "nodejs";
export const maxDuration = 60;

// Heure de Paris à laquelle part le récapitulatif (0-23). Réglable sans
// redéploiement du code, via les variables d'environnement Vercel.
const HEURE_PAR_DEFAUT = 18;

// Heure et jour de la semaine à Paris, quelle que soit l'heure du serveur.
function maintenantAParis(): { heure: number; jour: number } {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const heure = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const jours = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const libelle = (parts.find((p) => p.type === "weekday")?.value ?? "").toLowerCase();
  return { heure, jour: Math.max(0, jours.indexOf(libelle)) };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  // « force » permet un envoi manuel de vérification, hors créneau.
  const force = new URL(req.url).searchParams.get("force") === "1";
  const heureCible = Number(process.env.DIGEST_CR_HEURE ?? HEURE_PAR_DEFAUT);
  const { heure, jour } = maintenantAParis();
  const jourOuvre = jour >= 1 && jour <= 5;

  if (!force && (heure !== heureCible || !jourOuvre)) {
    return NextResponse.json({
      envoye: false,
      raison: `hors créneau (Paris ${heure}h, cible ${heureCible}h du lundi au vendredi)`,
    });
  }

  try {
    const result = await envoyerDigestCrs();
    return NextResponse.json({ envoye: result.destinataires > 0, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
