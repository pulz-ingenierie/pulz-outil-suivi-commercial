import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { syntheseSystemPrompt, SYNTHESE_USER_PREFIX } from "@/lib/prompts";
import { extractJsonObject, isIsoDate, validateSynthese } from "@/lib/synthese";

// Synthèse IA d'un compte rendu (texte → structure). Appel serveur : la clé
// Anthropic reste côté serveur. La sortie de l'IA est VALIDÉE contre un schéma
// strict avant d'être renvoyée (règle CLAUDE.md : valider les sorties IA).

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

interface Body {
  transcription?: string;
  entites?: string[];
  operations?: string[];
  contacts?: string[];
  membres?: string[];
  today?: string;
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
  if (!transcription) {
    return NextResponse.json({ error: "Aucun texte à synthétiser." }, { status: 400 });
  }

  const knownEntites = asStringArray(body.entites);
  const knownOps = asStringArray(body.operations);
  const knownMembres = asStringArray(body.membres);
  const knownPersonnes = Array.from(new Set([...asStringArray(body.contacts), ...knownMembres]));
  const today = isIsoDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: syntheseSystemPrompt(knownEntites, knownOps, knownPersonnes, today, knownMembres),
      messages: [{ role: "user", content: SYNTHESE_USER_PREFIX + transcription }],
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
    return NextResponse.json({ error: `Synthèse échouée : ${message}` }, { status: 502 });
  }
}
