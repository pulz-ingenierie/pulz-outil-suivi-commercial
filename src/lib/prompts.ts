// Capital métier — prompts IA du module Suivi commercial.
// Centralisés ici pour être relus, versionnés et faire l'objet de PR (comme le
// capital prompts hérité de PULZ-AO). Ne pas diluer sans validation.

// Synthèse d'un compte rendu de rendez-vous commercial (maîtrise d'œuvre).
// Objectif : transformer une dictée brute en un compte rendu structuré et des
// suites à donner, SANS rien inventer. Le pilotage se fait par affaire, jamais
// par euro : ne pas extrapoler de montant.
export function syntheseSystemPrompt(entites: string[], operations: string[], today: string): string {
  const listeEntites = entites.length ? entites.map((n) => `- ${n}`).join("\n") : "(aucune connue)";
  const listeOps = operations.length ? operations.map((n) => `- ${n}`).join("\n") : "(aucune connue)";
  return `Tu assistes un professionnel de la maîtrise d'œuvre qui dicte, après un rendez-vous, un compte rendu commercial oral. Ta mission : le structurer fidèlement.

Nous sommes le ${today} (format AAAA-MM-JJ). Sers-t'en pour résoudre les dates relatives.

Règles absolues :
- N'invente RIEN. N'ajoute aucun fait, chiffre, date ou nom non prononcé.
- Reste factuel et concis. Français professionnel.
- N'infère jamais de montant d'honoraires ou de budget si ce n'est pas dit.
- Si une information demandée est absente, laisse le champ vide, la liste vide ou null.

Entités déjà connues dans l'outil (rattache uniquement à celles réellement évoquées, avec leur libellé EXACT) :
${listeEntites}

Opérations déjà connues (même règle) :
${listeOps}

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de la forme :
{
  "type_rdv": "dejeuner" | "appel" | "visite" | "salon" | "autre",
  "date_rdv": "AAAA-MM-JJ si la date du rendez-vous est déductible de la dictée (résous « hier », « mardi dernier », etc. par rapport à aujourd'hui) ; sinon null",
  "resume": "2 à 4 phrases neutres résumant l'échange",
  "points_cles": ["point important", "..."],
  "entites": ["libellé exact d'une entité connue évoquée"],
  "operations": ["libellé exact d'une opération connue évoquée"],
  "relances": [{ "objet": "action de suivi à faire", "dans_jours": 14 }]
}`;
}

export const SYNTHESE_USER_PREFIX =
  "Voici la dictée à structurer. Réponds seulement par le JSON demandé.\n\n";

// Correction en langage naturel d'un compte rendu déjà structuré. L'utilisateur
// parle (ou écrit) une consigne du type « la date c'est mardi dernier »,
// « enlève le rattachement X », « c'est Dujardin, pas du jardin ». L'IA applique
// la consigne et renvoie la fiche COMPLÈTE corrigée, au même format.
export function affineSystemPrompt(entites: string[], operations: string[], today: string): string {
  const listeEntites = entites.length ? entites.map((n) => `- ${n}`).join("\n") : "(aucune connue)";
  const listeOps = operations.length ? operations.map((n) => `- ${n}`).join("\n") : "(aucune connue)";
  return `Tu aides un professionnel de la maîtrise d'œuvre à corriger un compte rendu commercial déjà structuré. Il te donne la fiche actuelle (JSON), le texte d'origine, et une consigne de correction en langage naturel.

Ta mission : appliquer UNIQUEMENT la correction demandée, et renvoyer la fiche COMPLÈTE mise à jour.

Règles absolues :
- Ne change QUE ce que la consigne demande. Conserve tout le reste à l'identique.
- N'invente RIEN. N'ajoute aucun fait, chiffre, date ou nom non fourni.
- N'infère jamais de montant.
- Nous sommes le ${today} (AAAA-MM-JJ) : résous les dates relatives (« hier », « mardi dernier »).
- Pour les rattachements, n'utilise que les libellés EXACTS existants ci-dessous ; si la consigne demande de retirer un rattachement, enlève-le de la liste.

Entités connues :
${listeEntites}

Opérations connues :
${listeOps}

Réponds UNIQUEMENT par l'objet JSON complet et corrigé, sans texte autour, de la forme :
{
  "type_rdv": "dejeuner" | "appel" | "visite" | "salon" | "autre",
  "date_rdv": "AAAA-MM-JJ ou null",
  "resume": "…",
  "points_cles": ["…"],
  "entites": ["libellé exact d'une entité connue"],
  "operations": ["libellé exact d'une opération connue"],
  "relances": [{ "objet": "…", "dans_jours": 14 }]
}`;
}
