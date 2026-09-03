// Structure d'une synthèse de compte rendu + validation stricte (règle CLAUDE.md :
// valider les SORTIES de l'IA). Partagé par /api/synthese (analyse initiale) et
// /api/affiner (correction en langage naturel), pour une seule source de vérité.

export const TYPES_RDV = ["dejeuner", "appel", "visite", "salon", "autre"] as const;

// Phases d'une opération (miroir de OperationStatut). L'IA propose la phase de
// chaque nouvelle affaire ; l'utilisateur peut l'ajuster avant de consolider.
export const STATUTS_OP = ["piste", "qualifie", "concours", "a_chiffrer", "offre_remise", "nego", "gagne", "perdu"] as const;

// Une personne physique évoquée (à distinguer d'une structure/organisation).
export interface ContactExtrait {
  nom: string;
  prenom: string | null;
  fonction: string | null;
  entite: string | null; // structure de rattachement (libellé)
  operations: string[]; // affaires dont cette personne est LE CONTACT (par nom)
  tel: string | null; // téléphone dicté/lu sur une pièce jointe, sinon null
  email: string | null; // e-mail dicté/lu sur une pièce jointe, sinon null
}

export interface NouvelleEntite {
  nom: string;
  type: string; // MOA | archi | promoteur | confrere | autre
}

export interface Synthese {
  type_rdv: string;
  date_rdv: string | null;
  resume: string;
  points_cles: string[];
  entites: string[];
  operations: string[];
  nouvelles_entites: NouvelleEntite[];
  nouvelles_operations: { nom: string; entite: string | null; ville: string | null; phase: string }[];
  liens: { operation: string; entite: string }[]; // rattachement affaire ↔ structure (par nom)
  // Référent (membre interne EN CHARGE) d'une opération, par nom.
  referents: { operation: string; referent: string }[];
  // Progression d'une affaire EXISTANTE : nouveau statut proposé, par nom.
  changements_phase: { operation: string; phase: string }[];
  // Ville (commune) d'une affaire EXISTANTE dont la ville manque, par nom.
  changements_ville: { operation: string; ville: string }[];
  contacts: ContactExtrait[];
  // Chaque relance précise l'affaire / la structure qu'elle concerne (par nom),
  // pour être rattachée à la bonne opération (et non à la première du CR).
  relances: { objet: string; dans_jours: number; personne: string | null; operation: string | null; entite: string | null }[];
}

const ENTITE_TYPES = ["MOA", "archi", "promoteur", "bet", "confrere", "autre"];

// -----------------------------------------------------------------------------
// Coordonnées d'une personne (téléphone, e-mail) extraites d'une dictée ou d'une
// pièce jointe. Règle anti-invention : on n'accepte QUE ce qui a bien la FORME
// d'une coordonnée. Une valeur douteuse est jetée — un champ vide vaut mieux
// qu'un numéro ou une adresse faux, qu'on croirait vrais.
// -----------------------------------------------------------------------------
const RE_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // La dictée écrit parfois « arobase » / « point » : Whisper les rend déjà en
  // symboles la plupart du temps. On se contente de nettoyer les évidences.
  const s = v.trim().toLowerCase().replace(/^mailto:/, "").replace(/\s+/g, "");
  return s.length <= 254 && RE_EMAIL.test(s) ? s : null;
}

// Téléphone : on ne garde que les chiffres (plus un « + » international de tête).
// 8 à 15 chiffres = plage de la norme E.164 ; en deçà/au-delà, ce n'est pas un
// numéro (un montant, une surface, un nombre de lots dicté par erreur…).
// Mise en forme française par paires pour un 0X à 10 chiffres.
export function normTel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const brut = v.trim();
  if (!brut) return null;
  const international = brut.startsWith("+") || brut.startsWith("00");
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.length < 8 || chiffres.length > 15) return null;
  if (chiffres.length === 10 && chiffres.startsWith("0") && !brut.startsWith("+")) {
    return chiffres.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return international ? `+${chiffres.replace(/^00/, "")}` : chiffres;
}

// Date au format AAAA-MM-JJ ? (contrôle simple, anti-invention.)
export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
}

// Garde uniquement les libellés qui existent réellement (anti-hallucination).
function keepKnown(suggested: string[], known: string[]): string[] {
  const set = new Set(known);
  return suggested.filter((s) => set.has(s));
}

// Extrait le premier objet JSON d'un texte (l'IA doit répondre en JSON pur ;
// on isole l'objet par sécurité).
export function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function validateSynthese(
  raw: unknown,
  knownEntites: string[],
  knownOps: string[],
  today: string,
): Synthese {
  const o = (raw ?? {}) as Record<string, unknown>;
  const type_rdv =
    typeof o.type_rdv === "string" && (TYPES_RDV as readonly string[]).includes(o.type_rdv)
      ? o.type_rdv
      : "autre";
  // On n'accepte la date que si elle est bien formée et pas dans le futur.
  const date_rdv = isIsoDate(o.date_rdv) && (o.date_rdv as string) <= today ? (o.date_rdv as string) : null;
  const relances = Array.isArray(o.relances)
    ? o.relances
        .map((r) => (r ?? {}) as Record<string, unknown>)
        .map((r) => ({
          objet: typeof r.objet === "string" ? r.objet.trim() : "",
          dans_jours: Number.isFinite(r.dans_jours as number) ? Math.max(1, Math.round(r.dans_jours as number)) : 14,
          personne: typeof r.personne === "string" && r.personne.trim() ? r.personne.trim() : null,
          operation: typeof r.operation === "string" && r.operation.trim() ? r.operation.trim() : null,
          entite: typeof r.entite === "string" && r.entite.trim() ? r.entite.trim() : null,
        }))
        .filter((r) => r.objet.length > 0)
    : [];
  const contacts = Array.isArray(o.contacts)
    ? o.contacts
        .map((c) => (c ?? {}) as Record<string, unknown>)
        .map((c) => ({
          nom: typeof c.nom === "string" ? c.nom.trim() : "",
          prenom: typeof c.prenom === "string" && c.prenom.trim() ? c.prenom.trim() : null,
          fonction: typeof c.fonction === "string" && c.fonction.trim() ? c.fonction.trim() : null,
          entite: typeof c.entite === "string" && c.entite.trim() ? c.entite.trim() : null,
          operations: asStringArray(c.operations),
          tel: normTel(c.tel),
          email: normEmail(c.email),
        }))
        .filter((c) => c.nom.length > 0)
    : [];

  // Propositions de création : on écarte celles qui existent déjà (par nom) et
  // les doublons internes.
  const knownEntLower = new Set(knownEntites.map((s) => s.toLowerCase()));
  const knownOpLower = new Set(knownOps.map((s) => s.toLowerCase()));
  const vusEnt = new Set<string>();
  const nouvelles_entites = (Array.isArray(o.nouvelles_entites) ? o.nouvelles_entites : [])
    .map((e) => (e ?? {}) as Record<string, unknown>)
    .map((e) => ({
      nom: typeof e.nom === "string" ? e.nom.trim() : "",
      type: typeof e.type === "string" && ENTITE_TYPES.includes(e.type) ? e.type : "autre",
    }))
    .filter((e) => {
      const k = e.nom.toLowerCase();
      if (!e.nom || knownEntLower.has(k) || vusEnt.has(k)) return false;
      vusEnt.add(k);
      return true;
    });
  const vusOp = new Set<string>();
  const nouvelles_operations = (Array.isArray(o.nouvelles_operations) ? o.nouvelles_operations : [])
    .map((op) => (op ?? {}) as Record<string, unknown>)
    .map((op) => ({
      nom: typeof op.nom === "string" ? op.nom.trim() : "",
      entite: typeof op.entite === "string" && op.entite.trim() ? op.entite.trim() : null,
      ville: typeof op.ville === "string" && op.ville.trim() && op.ville.trim() !== "✕" ? op.ville.trim() : null,
      phase: typeof op.phase === "string" && (STATUTS_OP as readonly string[]).includes(op.phase) ? op.phase : "piste",
    }))
    .filter((op) => {
      const k = op.nom.toLowerCase();
      if (!op.nom || knownOpLower.has(k) || vusOp.has(k)) return false;
      vusOp.add(k);
      return true;
    });

  // Liens affaire ↔ structure (par nom). On garde les paires bien formées ;
  // la résolution nom → identifiant (et le repli) se fait à la consolidation.
  const liens = Array.isArray(o.liens)
    ? o.liens
        .map((l) => (l ?? {}) as Record<string, unknown>)
        .map((l) => ({
          operation: typeof l.operation === "string" ? l.operation.trim() : "",
          entite: typeof l.entite === "string" ? l.entite.trim() : "",
        }))
        .filter((l) => l.operation && l.entite)
    : [];

  const referents = Array.isArray(o.referents)
    ? o.referents
        .map((r) => (r ?? {}) as Record<string, unknown>)
        .map((r) => ({
          operation: typeof r.operation === "string" ? r.operation.trim() : "",
          referent: typeof r.referent === "string" ? r.referent.trim() : "",
        }))
        .filter((r) => r.operation && r.referent)
    : [];

  const changements_phase = Array.isArray(o.changements_phase)
    ? o.changements_phase
        .map((c) => (c ?? {}) as Record<string, unknown>)
        .map((c) => ({
          operation: typeof c.operation === "string" ? c.operation.trim() : "",
          phase: typeof c.phase === "string" && (STATUTS_OP as readonly string[]).includes(c.phase) ? c.phase : "",
        }))
        .filter((c) => c.operation && c.phase)
    : [];

  const changements_ville = Array.isArray(o.changements_ville)
    ? o.changements_ville
        .map((c) => (c ?? {}) as Record<string, unknown>)
        .map((c) => ({
          operation: typeof c.operation === "string" ? c.operation.trim() : "",
          ville: typeof c.ville === "string" && c.ville.trim() !== "✕" ? c.ville.trim() : "",
        }))
        .filter((c) => c.operation && c.ville)
    : [];

  return {
    type_rdv,
    date_rdv,
    resume: typeof o.resume === "string" ? o.resume.trim() : "",
    points_cles: asStringArray(o.points_cles),
    entites: keepKnown(asStringArray(o.entites), knownEntites),
    operations: keepKnown(asStringArray(o.operations), knownOps),
    nouvelles_entites,
    nouvelles_operations,
    liens,
    referents,
    changements_phase,
    changements_ville,
    contacts,
    relances,
  };
}
