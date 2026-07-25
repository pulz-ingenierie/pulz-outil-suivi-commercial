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
