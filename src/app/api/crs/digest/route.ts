import { NextResponse } from "next/server";
import { envoyerDigestCrs } from "@/lib/cr-digest";

// Récapitulatif de fin de journée des comptes rendus (voir vercel.json).
//
// La planification Vercel s'exprime en UTC : une heure fixe dériverait d'une
// heure entre l'été et l'hiver. La tâche est donc déclenchée CHAQUE HEURE et
// c'est ce code qui décide, à l'heure de Paris, si c'est le moment.
// Protégée par le même secret partagé que les rappels de relances.

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // jamais mis en cache : c'est une action
export const maxDuration = 60;

// Heure de Paris à partir de laquelle part le récapitulatif (0-23). Réglable
// sans redéploiement du code, via les variables d'environnement Vercel.
const HEURE_PAR_DEFAUT = 18;

// Heure et jour de la semaine à Paris, quelle que soit l'heure du serveur.
//
// On lit des parties NUMÉRIQUES (année, mois, jour, heure) et on en déduit le
// jour de la semaine par le calendrier. Surtout pas le libellé « weekday » :
// selon les données de langue embarquées dans le runtime, il vaut « lun. » ou
// « Mon » — un code qui compare ces textes tombe en panne silencieusement et la
// tâche ne part jamais.
function maintenantAParis(): { heure: number; jour: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23", // 00-23 ; « h24 » renverrait 24 h à minuit
  }).formatToParts(new Date());

  const nombre = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const annee = nombre("year");
  const mois = nombre("month");
  const jourDuMois = nombre("day");
  const heure = nombre("hour") % 24;
  // 0 = dimanche … 6 = samedi. Date.UTC évite tout décalage de fuseau ici : on
  // ne cherche que le jour de la semaine d'une date civile déjà calée sur Paris.
  const jour = new Date(Date.UTC(annee, mois - 1, jourDuMois)).getUTCDay();
  const date = `${annee}-${String(mois).padStart(2, "0")}-${String(jourDuMois).padStart(2, "0")}`;
  return { heure, jour, date };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  // « force » permet un envoi de vérification hors créneau.
  const force = new URL(req.url).searchParams.get("force") === "1";
  const heureCible = Number(process.env.DIGEST_CR_HEURE ?? HEURE_PAR_DEFAUT);
  const { heure, jour, date } = maintenantAParis();
  const jourOuvre = jour >= 1 && jour <= 5;
  // Créneau OUVERT à partir de l'heure cible, et non à cette heure précise : si
  // le déclenchement de 18 h est manqué ou retardé, celui de 19 h rattrape. Pas
  // de doublon possible — un compte rendu déjà envoyé porte sa marque et n'est
  // plus repris (voir cr-digest.ts), donc les heures suivantes n'envoient rien.
  const dansLeCreneau = heure >= heureCible && jourOuvre;

  if (!force && !dansLeCreneau) {
    return NextResponse.json({
      envoye: false,
      raison: "hors créneau",
      paris: { date, heure, jourOuvre },
      creneau: `à partir de ${heureCible}h, du lundi au vendredi`,
    });
  }

  try {
    const result = await envoyerDigestCrs();
    return NextResponse.json({
      envoye: result.destinataires > 0,
      paris: { date, heure, jourOuvre },
      force,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message, paris: { date, heure } }, { status: 500 });
  }
}
