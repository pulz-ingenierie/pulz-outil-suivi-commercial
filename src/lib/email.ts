import "server-only";

// Envoi d'e-mails via Resend. Appel serveur : la clé reste côté serveur.
// Dégradation propre : si la clé n'est pas configurée, on ne fait rien plutôt
// que de planter (l'outil fonctionne sans les e-mails).

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RELANCE_EMAIL_FROM);
}

interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailInput): Promise<{ sent: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RELANCE_EMAIL_FROM;
  if (!apiKey || !from) return { sent: false };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Envoi e-mail échoué (${res.status}) : ${detail.slice(0, 200)}`);
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: data.id };
}
