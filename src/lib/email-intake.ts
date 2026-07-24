import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getServerSupabase } from "@/lib/supabase/server";
import { analyseCompteRendu } from "@/lib/ia-synthese";

// Relevé de la boîte mail dédiée (Gmail, IMAP). Pour chaque nouveau message :
//  - on identifie l'expéditeur ; s'il n'est pas un MEMBRE connu → on ignore ;
//  - sinon l'IA analyse le contenu et on crée un BROUILLON de compte rendu
//    (statut 'brouillon'), que le membre consolidera dans l'outil.
// Les rattachements proposés restent dans la synthèse ; ils ne sont créés
// réellement qu'à la validation du brouillon (rien n'entre en base sans revue).

export interface IntakeResult {
  configured: boolean;
  lus: number; // messages nouveaux examinés
  brouillons: number; // brouillons créés
  ignores: number; // expéditeur non membre
  erreurs: number;
}

const MAX_PAR_RELEVE = 20; // garde-fou : on ne traite pas plus de N mails d'un coup

export async function releverEmails(): Promise<IntakeResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) {
    return { configured: false, lus: 0, brouillons: 0, ignores: 0, erreurs: 0 };
  }

  const supabase = getServerSupabase();
  if (!supabase) throw new Error("La base de données n'est pas connectée.");

  const [{ data: users }, { data: entites }, { data: operations }] = await Promise.all([
    supabase.from("utilisateurs").select("id, nom, email, org_id, actif").eq("actif", true),
    supabase.from("entites").select("id, nom"),
    supabase.from("operations").select("id, nom"),
  ]);

  const memberByEmail = new Map(
    (users ?? []).map((u: any) => [String(u.email ?? "").toLowerCase(), u]),
  );
  const knownEntites = (entites ?? []).map((e: any) => e.nom as string);
  const knownOps = (operations ?? []).map((o: any) => o.nom as string);
  const today = new Date().toISOString().slice(0, 10);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  let lus = 0;
  let brouillons = 0;
  let ignores = 0;
  let erreurs = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = (await client.search({ seen: false }, { uid: true })) || [];
      const aTraiter = uids.slice(0, MAX_PAR_RELEVE);

      for (const uid of aTraiter) {
        lus++;
        try {
          const msg = await client.fetchOne(uid, { source: true }, { uid: true });
          if (!msg || !msg.source) {
            erreurs++;
            continue;
          }
          const parsed = await simpleParser(msg.source as Buffer);
          const fromEmail = String(parsed.from?.value?.[0]?.address ?? "").toLowerCase();
          const member = memberByEmail.get(fromEmail);

          // Toujours marquer lu pour ne pas retraiter à l'infini.
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });

          if (!member) {
            ignores++;
            continue;
          }

          const sujet = parsed.subject ?? "";
          const htmlTexte = typeof parsed.html === "string" ? parsed.html.replace(/<[^>]+>/g, " ") : "";
          const corps = (parsed.text ?? htmlTexte ?? "").trim();
          const texte = `Objet : ${sujet}\n\n${corps}`.slice(0, 8000);

          let synth = null;
          try {
            synth = await analyseCompteRendu(texte, knownEntites, knownOps, today);
          } catch {
            synth = null; // l'analyse a échoué : on crée quand même le brouillon brut
          }

          const { error } = await supabase.from("crs").insert({
            org_id: member.org_id,
            date_rdv: synth?.date_rdv || today,
            type_rdv: synth?.type_rdv || "autre",
            transcription: texte,
            statut: "brouillon",
            synthese: synth ?? null,
            auteur_id: member.id,
          });
          if (error) {
            erreurs++;
            continue;
          }
          brouillons++;
        } catch {
          erreurs++;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return { configured: true, lus, brouillons, ignores, erreurs };
}
