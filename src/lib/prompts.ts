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

DISTINCTION IMPORTANTE — structure vs personne :
- Une STRUCTURE (organisation) est une entité morale : mairie, bailleur, promoteur, agence d'architecture, entreprise, collectivité… → elle va dans "entites".
- Une PERSONNE physique (un individu, avec un nom et souvent un prénom et une fonction) → elle va dans "contacts", JAMAIS dans "entites".
- Exemple : « Louis Dujardin, directeur de la SIGH » → contact { nom: "Dujardin", prenom: "Louis", fonction: "directeur", entite: "SIGH" } ; et "SIGH" est la structure (dans "entites" si elle est connue).
- Rattache chaque personne à sa structure via le champ "entite".

Entités déjà connues dans l'outil (rattache uniquement à celles réellement évoquées, avec leur libellé EXACT) :
${listeEntites}

Opérations déjà connues (même règle) :
${listeOps}

Structures et affaires NOUVELLES : si une structure ou une affaire est clairement nommée dans le texte mais N'EXISTE PAS dans les listes connues ci-dessus, propose-la dans "nouvelles_entites" / "nouvelles_operations" (et NON dans "entites"/"operations"). Ne propose que ce qui est réellement évoqué — n'invente jamais.

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de la forme :
{
  "type_rdv": "dejeuner" | "appel" | "visite" | "salon" | "autre",
  "date_rdv": "AAAA-MM-JJ si la date du rendez-vous est déductible de la dictée (résous « hier », « mardi dernier », etc. par rapport à aujourd'hui) ; sinon null",
  "resume": "2 à 4 phrases neutres résumant l'échange",
  "points_cles": ["point important", "..."],
  "entites": ["libellé exact d'une STRUCTURE connue évoquée"],
  "operations": ["libellé exact d'une opération connue évoquée"],
  "nouvelles_entites": [{ "nom": "structure évoquée mais absente des connues", "type": "MOA|archi|promoteur|confrere|autre" }],
  "nouvelles_operations": [{ "nom": "affaire/projet évoqué mais absent des connues" }],
  "contacts": [{ "nom": "nom de famille", "prenom": "prénom ou null", "fonction": "fonction ou null", "entite": "libellé de sa structure (connue ou nouvelle) ou null" }],
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
- Une STRUCTURE (organisation) va dans "entites" ; une PERSONNE physique (nom, prénom, fonction) va dans "contacts" — jamais l'inverse.

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
  "entites": ["libellé exact d'une STRUCTURE connue"],
  "operations": ["libellé exact d'une opération connue"],
  "nouvelles_entites": [{ "nom": "structure nouvelle", "type": "MOA|archi|promoteur|confrere|autre" }],
  "nouvelles_operations": [{ "nom": "affaire nouvelle" }],
  "contacts": [{ "nom": "…", "prenom": "… ou null", "fonction": "… ou null", "entite": "structure ou null" }],
  "relances": [{ "objet": "…", "dans_jours": 14 }]
}`;
}
