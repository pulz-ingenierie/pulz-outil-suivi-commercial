import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { syntheseSystemPrompt, SYNTHESE_USER_PREFIX } from "@/lib/prompts";
import { extractJsonObject, validateSynthese, type Synthese } from "@/lib/synthese";

// Analyse d'un texte (dictée transcrite OU corps d'un e-mail) → synthèse
// structurée et validée. Centralisé côté serveur pour être réutilisé par
// /api/synthese et par le relevé des e-mails.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export async function analyseCompteRendu(
  transcription: string,
  knownEntites: string[],
  knownOps: string[],
  today: string,
): Promise<Synthese | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !transcription.trim()) return null;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: syntheseSystemPrompt(knownEntites, knownOps, today),
    messages: [{ role: "user", content: SYNTHESE_USER_PREFIX + transcription }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const parsed = extractJsonObject(text);
  if (parsed == null) return null;
  return validateSynthese(parsed, knownEntites, knownOps, today);
}
