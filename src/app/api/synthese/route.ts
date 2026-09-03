import { NextResponse } from "next/server";
import { isIsoDate } from "@/lib/synthese";
import { erreurSynthese } from "@/lib/ia-erreurs";
import { analyseCompteRendu, type PieceJointeIA } from "@/lib/ia-synthese";
import { getServerSupabase } from "@/lib/supabase/server";

// Synthèse IA d'un compte rendu (texte → structure). Appel serveur : la clé
// Anthropic reste côté serveur. La sortie de l'IA est VALIDÉE contre un schéma
// strict avant d'être renvoyée (règle CLAUDE.md : valider les sorties IA).

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  transcription?: string;
  entites?: string[];
  operations?: string[];
  contacts?: string[];
  membres?: string[];
  today?: string;
  draftId?: string; // brouillon : permet d'inclure ses pièces jointes (photo) conservées
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "IA non configurée (ANTHROPIC_API_KEY manquante)." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const transcription = (body.transcription ?? "").trim();

  // Brouillon issu d'un e-mail : on récupère ses pièces jointes conservées (photo
  // normalisée en JPEG), pour que l'IA LISE la pièce et pas seulement le texte.
  let pieces: PieceJointeIA[] = [];
  if (body.draftId) {
    try {
      const sb = getServerSupabase();
      if (sb) {
        const { data } = await sb.from("crs").select("pieces_ia").eq("id", body.draftId).maybeSingle();
        const p = (data as any)?.pieces_ia;
        // Deux formes acceptées : tableau (ancien) ou { pieces, journal } (nouveau).
        if (Array.isArray(p)) pieces = p as PieceJointeIA[];
        else if (Array.isArray(p?.pieces)) pieces = p.pieces as PieceJointeIA[];
      }
    } catch {
      /* colonne absente ou lecture impossible : on analyse le texte seul */
    }
  }

  if (!transcription && pieces.length === 0) {
    return NextResponse.json({ error: "Aucun texte à synthétiser." }, { status: 400 });
  }

  const knownEntites = asStringArray(body.entites);
  const knownOps = asStringArray(body.operations);
  const knownMembres = asStringArray(body.membres);
  const knownPersonnes = Array.from(new Set([...asStringArray(body.contacts), ...knownMembres]));
  const today = isIsoDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  try {
    const synthese = await analyseCompteRendu(
      transcription,
      knownEntites,
      knownOps,
      today,
      pieces,
      knownPersonnes,
      knownMembres,
    );
    if (synthese == null) {
      return NextResponse.json({ error: "Réponse IA illisible." }, { status: 502 });
    }
    return NextResponse.json({ synthese });
  } catch (err) {
    return NextResponse.json({ error: erreurSynthese(err) }, { status: 502 });
  }
}
