import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Envoi d'e-mails. Deux fournisseurs possibles, dans l'ordre de priorité :
//   1) Gmail (SMTP) — via une boîte dédiée + « mot de passe d'application »
//      (GMAIL_USER + GMAIL_APP_PASSWORD). Contourne le besoin d'un domaine.
//   2) Resend (repli) — si un jour on veut envoyer depuis un domaine dédié.
// Dégradation propre : si rien n'est configuré, on ne fait rien plutôt que de
// planter (l'outil fonctionne sans les e-mails).

export function isEmailConfigured(): boolean {
  return Boolean(
    (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) ||
      (process.env.RESEND_API_KEY && process.env.RELANCE_EMAIL_FROM),
  );
}

interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

// Transporteur Gmail réutilisé entre les envois (connexion SMTP).
let gmailTx: Transporter | null = null;
function gmailTransport(): Transporter | null {
  const user = process.env.GMAIL_USER;
  // Le mot de passe d'application est parfois copié avec des espaces : on nettoie.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  if (!gmailTx) {
    gmailTx = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // SSL
      auth: { user, pass },
    });
  }
  return gmailTx;
}

export async function sendEmail({ to, subject, html }: EmailInput): Promise<{ sent: boolean; id?: string }> {
  // 1) Gmail (SMTP) en priorité. Gmail impose que l'expéditeur soit la boîte
  // elle-même : on force le « from » sur GMAIL_USER.
  const tx = gmailTransport();
  if (tx) {
    const user = process.env.GMAIL_USER!;
    const info = await tx.sendMail({
      from: `Suivi commercial · moeïa <${user}>`,
      to,
      subject,
      html,
    });
    return { sent: true, id: info.messageId };
  }

  // 2) Repli Resend (si configuré).
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RELANCE_EMAIL_FROM;
  if (apiKey && from) {
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

  return { sent: false };
}
