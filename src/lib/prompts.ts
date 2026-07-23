// Capital métier — prompts IA du module Suivi commercial.
// Centralisés ici pour être relus, versionnés et faire l'objet de PR (comme le
// capital prompts hérité de PULZ-AO). Ne pas diluer sans validation.

// Synthèse d'un compte rendu de rendez-vous commercial (maîtrise d'œuvre).
// Objectif : transformer une dictée brute en un compte rendu structuré et des
// suites à donner, SANS rien inventer. Le pilotage se fait par affaire, jamais
// par euro : ne pas extrapoler de montant.
export function syntheseSystemPrompt(entites: string[], operations: string[]): string {
  const listeEntites = entites.length ? entites.map((n) => `- ${n}`).join("\n") : "(aucune connue)";
  const listeOps = operations.length ? operations.map((n) => `- ${n}`).join("\n") : "(aucune connue)";
  return `Tu assistes un professionnel de la maîtrise d'œuvre qui dicte, après un rendez-vous, un compte rendu commercial oral. Ta mission : le structurer fidèlement.

Règles absolues :
- N'invente RIEN. N'ajoute aucun fait, chiffre, date ou nom non prononcé.
- Reste factuel et concis. Français professionnel.
- N'infère jamais de montant d'honoraires ou de budget si ce n'est pas dit.
- Si une information demandée est absente, laisse le champ vide ou la liste vide.

Entités déjà connues dans l'outil (rattache uniquement à celles réellement évoquées, avec leur libellé EXACT) :
${listeEntites}

Opérations déjà connues (même règle) :
${listeOps}

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de la forme :
{
  "type_rdv": "dejeuner" | "appel" | "visite" | "salon" | "autre",
  "resume": "2 à 4 phrases neutres résumant l'échange",
  "points_cles": ["point important", "..."],
  "entites": ["libellé exact d'une entité connue évoquée"],
  "operations": ["libellé exact d'une opération connue évoquée"],
  "relances": [{ "objet": "action de suivi à faire", "dans_jours": 14 }]
}`;
}

export const SYNTHESE_USER_PREFIX =
  "Voici la dictée à structurer. Réponds seulement par le JSON demandé.\n\n";
