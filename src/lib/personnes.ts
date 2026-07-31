// Résolution d'un nom de personne (texte libre : « Romain Mission », « Mission »)
// vers l'identifiant d'un contact, pour rendre CLIQUABLES les signets personne
// (relances, participants d'un compte rendu…) vers leur carte /personnes/[id].

export type PersonneRef = { id: string; nom: string; prenom: string | null };

export function normNom(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Index nom → id : nom complet (« prénom nom ») + nom de famille s'il n'est pas
// ambigu (un seul contact le porte).
export function indexerPersonnes(contacts: PersonneRef[]): Record<string, string> {
  const full: Record<string, string> = {};
  const nomCount: Record<string, number> = {};
  const nomId: Record<string, string> = {};
  for (const c of contacts) {
    const f = normNom([c.prenom, c.nom].filter(Boolean).join(" "));
    if (f) full[f] = c.id;
    const n = normNom(c.nom);
    if (n) {
      nomCount[n] = (nomCount[n] ?? 0) + 1;
      nomId[n] = c.id;
    }
  }
  const idx: Record<string, string> = { ...full };
  for (const n in nomCount) {
    if (nomCount[n] === 1 && !(n in idx)) idx[n] = nomId[n];
  }
  return idx;
}

export function resoudrePersonne(idx: Record<string, string>, name: string | null | undefined): string | null {
  const k = normNom(name);
  return k && idx[k] ? idx[k] : null;
}

// Index nom → LIEN de carte : un contact ouvre /personnes/[id], un membre de
// l'équipe ouvre /membres/[id]. Les contacts sont prioritaires.
export function indexerLiens(
  contacts: PersonneRef[],
  membres: { id: string; nom: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const idxC = indexerPersonnes(contacts);
  for (const k in idxC) out[k] = `/personnes/${idxC[k]}`;
  for (const m of membres) {
    const n = normNom(m.nom);
    if (n && !(n in out)) out[n] = `/membres/${m.id}`;
  }
  return out;
}

// Renvoie le lien (href) de la carte d'une personne, ou null si inconnue.
export function lienPersonne(idx: Record<string, string>, name: string | null | undefined): string | null {
  const k = normNom(name);
  return k && idx[k] ? idx[k] : null;
}

export type PersonneSignet = { nom: string; href: string | null; membre: boolean };

// Découpe le champ « personne » d'une relance (texte libre, éventuellement
// plusieurs noms séparés par des virgules) en signets résolus : chacun avec son
// lien de carte et l'indication membre du groupement (interne) vs contact
// externe (concerné par la relance).
export function personnesDeRelance(
  personne: string | null | undefined,
  idx: Record<string, string>,
): PersonneSignet[] {
  const vus = new Set<string>();
  return (personne ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => { const k = s.toLowerCase(); if (!s || vus.has(k)) return false; vus.add(k); return true; })
    .map((nom) => {
      const href = lienPersonne(idx, nom);
      return { nom, href, membre: !!href && href.startsWith("/membres/") };
    });
}
