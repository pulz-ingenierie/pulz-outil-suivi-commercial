import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { titreOperation } from "@/lib/titres";

// Prépare et envoie, à chaque responsable, le récapitulatif de ses relances
// « à faire » dont l'échéance est atteinte (en retard ou pour aujourd'hui).
// Une relance sans responsable ou sans e-mail n'est pas envoyée (visible en
// application seulement) — on la compte comme « ignorée ».

export interface DigestResult {
  configured: boolean; // la clé e-mail est-elle en place ?
  destinataires: number; // nombre de personnes rappelées
  relances: number; // nombre de relances incluses dans des e-mails
  ignorees: number; // relances dues mais sans responsable/e-mail
}

function dateFr(d: string): string {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return d;
  }
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Rel = {
  id: string;
  objet: string;
  date_echeance: string;
  assignee_id: string | null;
  operations: { nom: string } | null;
  entites: { nom: string } | null;
};

function corps(nom: string, rels: Rel[], today: string): string {
  const lignes = rels
    .map((r) => {
      const retard = r.date_echeance < today;
      const cible = (r.operations?.nom ? titreOperation(r.operations.nom) : null) ?? r.entites?.nom ?? "";
      const quand = retard
        ? `<span style="color:#B24A4A;font-weight:600">en retard · ${dateFr(r.date_echeance)}</span>`
        : `pour aujourd'hui`;
      return `<li style="margin:0 0 10px"><strong>${escape(r.objet)}</strong>${
        cible ? ` — <span style="color:#0B5D68">${escape(cible)}</span>` : ""
      }<br><span style="color:#5A6A77;font-size:13px">${quand}</span></li>`;
    })
    .join("");

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#16212B">
    <p style="font-size:15px">Bonjour ${escape(nom)},</p>
    <p style="font-size:15px">Voici vos relances à traiter aujourd'hui :</p>
    <ul style="padding-left:18px;font-size:15px;line-height:1.5">${lignes}</ul>
    <p style="font-size:13px;color:#8496A2;margin-top:22px">Suivi commercial · moeïa — ce message est automatique.</p>
  </div>`;
}

export async function envoyerRappelsRelances(): Promise<DigestResult> {
  const supabase = getServerSupabase();
  if (!supabase) throw new Error("La base de données n'est pas connectée.");

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("relances")
    .select("id, objet, date_echeance, assignee_id, operations(nom), entites(nom)")
    .eq("statut", "a_faire")
    .lte("date_echeance", today);
  if (error) throw new Error(error.message);

  const rels = (data ?? []) as unknown as Rel[];
  const assignees = rels.filter((r) => r.assignee_id);
  const ignorees = rels.length - assignees.length;

  if (!assignees.length) {
    return { configured: isEmailConfigured(), destinataires: 0, relances: 0, ignorees };
  }

  // Regroupement par responsable.
  const parAssignee = new Map<string, Rel[]>();
  for (const r of assignees) {
    const list = parAssignee.get(r.assignee_id!) ?? [];
    list.push(r);
    parAssignee.set(r.assignee_id!, list);
  }

  // E-mails des responsables actifs.
  const ids = [...parAssignee.keys()];
  const { data: users } = await supabase
    .from("utilisateurs")
    .select("id, nom, email, actif")
    .in("id", ids);
  const byId = new Map((users ?? []).map((u: any) => [u.id, u]));

  let destinataires = 0;
  let relancesEnvoyees = 0;
  let sansEmail = 0;

  for (const [assigneeId, list] of parAssignee) {
    const u = byId.get(assigneeId);
    if (!u || !u.actif || !u.email) {
      sansEmail += list.length;
      continue;
    }
    const sujet = `Relances du jour — ${list.length} à traiter`;
    const { sent } = await sendEmail({ to: u.email, subject: sujet, html: corps(u.nom, list, today) });
    if (sent) {
      destinataires += 1;
      relancesEnvoyees += list.length;
    }
  }

  return {
    configured: isEmailConfigured(),
    destinataires,
    relances: relancesEnvoyees,
    ignorees: ignorees + sansEmail,
  };
}
