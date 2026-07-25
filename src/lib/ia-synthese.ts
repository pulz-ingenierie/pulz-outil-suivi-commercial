import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { syntheseSystemPrompt, SYNTHESE_USER_PREFIX } from "@/lib/prompts";
import { extractJsonObject, validateSynthese, type Synthese } from "@/lib/synthese";

// Analyse d'un texte (dictée transcrite OU corps d'un e-mail) → synthèse
// structurée et validée. Centralisé côté serveur pour être réutilisé par
// /api/synthese et par le relevé des e-mails.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

// Pièce jointe transmise à l'IA (PDF ou image), en base64.
export interface PieceJointeIA {
  kind: "pdf" | "image";
  mediaType: string; // application/pdf, image/jpeg, image/png, image/webp, image/gif
  base64: string;
}

export async function analyseCompteRendu(
  transcription: string,
  knownEntites: string[],
  knownOps: string[],
  today: string,
  attachments: PieceJointeIA[] = [],
  knownPersonnes: string[] = [],
): Promise<Synthese | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!transcription.trim() && attachments.length === 0) return null;

  // Message = texte + pièces jointes (Claude lit nativement PDF et images).
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: SYNTHESE_USER_PREFIX + (transcription || "(voir la ou les pièces jointes)") },
  ];
  for (const a of attachments) {
    if (a.kind === "pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } });
    } else {
      content.push({
        type: "image",
        source: { type: "base64", media_type: a.mediaType as any, data: a.base64 },
      });
    }
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: syntheseSystemPrompt(knownEntites, knownOps, knownPersonnes, today),
    messages: [{ role: "user", content }],
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
