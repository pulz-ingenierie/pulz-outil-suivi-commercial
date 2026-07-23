import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { syntheseSystemPrompt, SYNTHESE_USER_PREFIX } from "@/lib/prompts";

// Synthèse IA d'un compte rendu vocal (texte → structure). Appel serveur : la
// clé Anthropic reste côté serveur. La sortie de l'IA est VALIDÉE contre un
// schéma strict avant d'être renvoyée (règle CLAUDE.md : valider les sorties IA).

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const TYPES_RDV = ["dejeuner", "appel", "visite", "salon", "autre"];

interface Body {
  transcription?: string;
  entites?: string[];
  operations?: string[];
  today?: string;
}

export interface Synthese {
  type_rdv: string;
  date_rdv: string | null;
  resume: string;
  points_cles: string[];
  entites: string[];
  operations: string[];
  relances: { objet: string; dans_jours: number }[];
}

// Date au format AAAA-MM-JJ ? (contrôle simple, anti-invention.)
function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

// Garde uniquement les libellés qui existent réellement dans l'outil (anti-hallucination).
function keepKnown(suggested: string[], known: string[]): string[] {
  const set = new Set(known);
  return suggested.filter((s) => set.has(s));
}

function validate(raw: unknown, knownEntites: string[], knownOps: string[], today: string): Synthese {
  const o = (raw ?? {}) as Record<string, unknown>;
  const type_rdv = typeof o.type_rdv === "string" && TYPES_RDV.includes(o.type_rdv) ? o.type_rdv : "autre";
  // On n'accepte la date que si elle est bien formée et pas dans le futur.
  const date_rdv = isIsoDate(o.date_rdv) && (o.date_rdv as string) <= today ? (o.date_rdv as string) : null;
  const relances = Array.isArray(o.relances)
    ? o.relances
        .map((r) => (r ?? {}) as Record<string, unknown>)
        .map((r) => ({
          objet: typeof r.objet === "string" ? r.objet.trim() : "",
          dans_jours: Number.isFinite(r.dans_jours as number) ? Math.max(1, Math.round(r.dans_jours as number)) : 14,
        }))
        .filter((r) => r.objet.length > 0)
    : [];
  return {
    type_rdv,
    date_rdv,
    resume: typeof o.resume === "string" ? o.resume.trim() : "",
    points_cles: asStringArray(o.points_cles),
    entites: keepKnown(asStringArray(o.entites), knownEntites),
    operations: keepKnown(asStringArray(o.operations), knownOps),
    relances,
  };
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
  const today = isIsoDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const client = new Anthropic({ apiKey });

  try {
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

    // L'IA doit répondre en JSON pur ; on extrait l'objet par sécurité.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: "Réponse IA illisible." }, { status: 502 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      return NextResponse.json({ error: "Réponse IA non conforme (JSON invalide)." }, { status: 502 });
    }

    return NextResponse.json({ synthese: validate(parsed, knownEntites, knownOps, today) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: `Synthèse échouée : ${message}` }, { status: 502 });
  }
}
