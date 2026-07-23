import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { affineSystemPrompt } from "@/lib/prompts";
import { extractJsonObject, isIsoDate, validateSynthese, type Synthese } from "@/lib/synthese";

// Correction d'une synthèse en langage naturel (« la date c'est mardi »,
// « enlève SIGH »…). Appel serveur : clé Anthropic côté serveur, sortie IA
// validée contre le même schéma strict que l'analyse initiale.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

interface Body {
  transcription?: string;
  synthese?: Synthese;
  instruction?: string;
  entites?: string[];
  operations?: string[];
  today?: string;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "IA non configurée (ANTHROPIC_API_KEY manquante)." }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const instruction = (body.instruction ?? "").trim();
  if (!instruction) {
    return NextResponse.json({ error: "Aucune correction demandée." }, { status: 400 });
  }
  if (!body.synthese || typeof body.synthese !== "object") {
    return NextResponse.json({ error: "Fiche à corriger manquante." }, { status: 400 });
  }

  const knownEntites = asStringArray(body.entites);
  const knownOps = asStringArray(body.operations);
  const today = isIsoDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const transcription = (body.transcription ?? "").trim();
  const client = new Anthropic({ apiKey });

  const userContent =
    `Texte d'origine du compte rendu :\n${transcription || "(non fourni)"}\n\n` +
    `Fiche structurée actuelle (JSON) :\n${JSON.stringify(body.synthese)}\n\n` +
    `Correction demandée :\n${instruction}\n\n` +
    `Renvoie la fiche complète corrigée, au format JSON demandé.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: affineSystemPrompt(knownEntites, knownOps, today),
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parsed = extractJsonObject(text);
    if (parsed == null) {
      return NextResponse.json({ error: "Réponse IA illisible." }, { status: 502 });
    }

    return NextResponse.json({ synthese: validateSynthese(parsed, knownEntites, knownOps, today) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: `Correction échouée : ${message}` }, { status: 502 });
  }
}
