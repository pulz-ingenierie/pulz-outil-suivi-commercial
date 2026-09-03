// Traduction des erreurs des fournisseurs d'IA en phrases qui disent QUOI FAIRE.
//
// L'outil s'appuie sur DEUX comptes distincts, facturés séparément :
//   - OpenAI (Whisper)  → la transcription de la dictée ;
//   - Anthropic (Claude) → la synthèse du compte rendu.
// Un « échec (429) » brut oblige à aller fouiller une console pour savoir
// laquelle est en cause, et les deux motifs courants — crédit épuisé, clé
// refusée — n'appellent pas du tout la même action. On les nomme donc.

function corpsEnBas(code: string, message: string, brut: string): string {
  return `${code} ${message} ${brut}`.toLowerCase();
}

function lireErreurJson(corps: string): { code: string; message: string } {
  try {
    const j = JSON.parse(corps) as { error?: { code?: string; message?: string; type?: string } };
    return {
      code: String(j?.error?.code ?? j?.error?.type ?? ""),
      message: String(j?.error?.message ?? ""),
    };
  } catch {
    return { code: "", message: "" }; // corps non JSON : seul le code HTTP renseigne
  }
}

// Un message évoque-t-il une facturation à sec ? (Formulations des deux API.)
function estUnProblemeDeCredit(texte: string): boolean {
  return (
    texte.includes("insufficient_quota") ||
    texte.includes("billing") ||
    texte.includes("credit balance") ||
    texte.includes("credit_balance") ||
    texte.includes("quota") ||
    texte.includes("payment")
  );
}

// --- Transcription (OpenAI / Whisper) ---------------------------------------
export function erreurTranscription(status: number, corps: string): string {
  const { code, message } = lireErreurJson(corps);
  const bas = corpsEnBas(code, message, corps);

  if (status === 401) {
    return "Transcription refusée : la clé OpenAI est invalide ou a été révoquée. Vérifiez OPENAI_API_KEY dans Vercel.";
  }
  if (status === 403) {
    return "Transcription refusée : cette clé OpenAI n'a pas accès à Whisper (projet ou pays non autorisé).";
  }
  if (estUnProblemeDeCredit(bas)) {
    return "Transcription indisponible : le compte OpenAI n'a plus de crédit. Rechargez-le et réessayez — il n'y a rien d'autre à changer.";
  }
  if (status === 429) {
    return "Transcription saturée (trop d'appels d'un coup). Attendez quelques secondes et réessayez.";
  }
  if (status >= 500) {
    return "Transcription indisponible : panne côté OpenAI. Réessayez dans quelques minutes, ou saisissez le compte rendu à la main.";
  }
  if (status === 400) {
    return "Enregistrement refusé par Whisper (format audio inattendu). Réenregistrez, ou saisissez le compte rendu à la main.";
  }
  return `Transcription échouée (${status})${message ? ` : ${message}` : "."}`;
}

// --- Synthèse (Anthropic / Claude) ------------------------------------------
// Le SDK lève une erreur dont le message contient le statut et le corps ; on y
// cherche les mêmes signaux.
export function erreurSynthese(err: unknown): string {
  const brut = err instanceof Error ? err.message : String(err ?? "");
  const bas = brut.toLowerCase();
  const status = (err as { status?: number } | null)?.status ?? 0;

  if (status === 401 || bas.includes("authentication_error") || bas.includes("invalid x-api-key")) {
    return "Synthèse refusée : la clé Anthropic est invalide ou a été révoquée. Vérifiez ANTHROPIC_API_KEY dans Vercel.";
  }
  if (status === 403 || bas.includes("permission_error")) {
    return "Synthèse refusée : cette clé Anthropic n'a pas accès au modèle demandé.";
  }
  if (estUnProblemeDeCredit(bas)) {
    return "Synthèse indisponible : le compte Anthropic n'a plus de crédit. Rechargez-le et réessayez — il n'y a rien d'autre à changer.";
  }
  if (status === 429 || bas.includes("rate_limit")) {
    return "Synthèse saturée (trop d'appels d'un coup). Attendez quelques secondes et réessayez.";
  }
  if (status >= 500 || bas.includes("overloaded")) {
    return "Synthèse indisponible : panne ou surcharge côté Anthropic. Réessayez dans quelques minutes ; votre dictée est conservée.";
  }
  return `Synthèse échouée : ${brut}`;
}
