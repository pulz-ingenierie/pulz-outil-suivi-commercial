import { NextResponse } from "next/server";
import { erreurTranscription } from "@/lib/ia-erreurs";

// Transcription audio → texte (Whisper). L'appel part du serveur : la clé
// OpenAI reste côté serveur, jamais exposée au navigateur (règle CLAUDE.md).
// Le navigateur envoie l'enregistrement du micro ; on renvoie le texte brut,
// que l'utilisateur peut ensuite corriger avant synthèse.

export const runtime = "nodejs";
export const maxDuration = 60;

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const WHISPER_MODEL = process.env.OPENAI_WHISPER_MODEL || "whisper-1";
const MAX_BYTES = 25 * 1024 * 1024; // limite Whisper : 25 Mo

// Extension de fichier attendue par Whisper selon le type MIME du navigateur.
function extFor(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "mp4";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription non configurée (OPENAI_API_KEY manquante). Saisissez le compte rendu à la main." },
      { status: 503 },
    );
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envoi audio invalide." }, { status: 400 });
  }

  const audio = incoming.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "Aucun enregistrement reçu." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Enregistrement trop long (max 25 Mo). Découpez-le ou saisissez à la main." },
      { status: 413 },
    );
  }

  const ext = extFor(audio.type || "audio/webm");
  const forward = new FormData();
  forward.append("file", audio, `enregistrement.${ext}`);
  forward.append("model", WHISPER_MODEL);
  forward.append("language", "fr");
  forward.append("response_format", "json");

  try {
    const res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: forward,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: erreurTranscription(res.status, detail), detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: `Transcription indisponible : ${message}` }, { status: 502 });
  }
}
