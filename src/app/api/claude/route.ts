import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// Proxy serveur vers Claude — la clé API reste côté serveur, jamais exposée au
// navigateur (règle CLAUDE.md). Pattern hérité de PULZ-AO (/api/claude).
// Point d'entrée unique pour tous les appels IA du module ; les prompts métier
// (synthèse de compte rendu, extraction) seront branchés dessus ensuite.

export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

interface ClaudeRequest {
  system?: string;
  messages: Anthropic.MessageParam[];
  max_tokens?: number;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "IA non configurée (ANTHROPIC_API_KEY manquante)." },
      { status: 503 },
    );
  }

  let body: ClaudeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "Le champ `messages` est requis." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: Math.min(Math.max(body.max_tokens ?? 4096, 256), 16000),
      system: body.system,
      messages: body.messages,
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({
      text,
      model: response.model,
      stop_reason: response.stop_reason,
      usage: response.usage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: `Appel IA échoué : ${message}` }, { status: 502 });
  }
}
