// Ce qui manque à une fiche pour être exploitable — définition UNIQUE, partagée
// par les fiches (ligne « À compléter »), les listes (anneau + filtre).
//
// Principe : on ne compte que ce qui sert à travailler. Sont volontairement
// IGNORÉS : le montant d'une affaire (« facultatif, jamais central », cadrage
// §1), sa description, sa raison de perte ; les notes d'une structure et son
// état « en sommeil » (une information, pas un trou).

export type Manque = {
  cle: string;   // ancre dans le formulaire de modification
  label: string; // libellé affiché sur l'étiquette
  href: string;  // où aller pour compléter
};

function vide(v: unknown): boolean {
  return typeof v !== "string" || !v.trim();
}

// --- Opération ---------------------------------------------------------------
export function manquesOperation(o: {
  id: string;
  ville?: string | null;
  referent_id?: string | null;
  aStructure?: boolean;
}): Manque[] {
  const edit = `/operations/${o.id}/modifier`;
  const out: Manque[] = [];
  if (vide(o.ville)) out.push({ cle: "ville", label: "ville", href: `${edit}#f-ville` });
  if (!o.referent_id) out.push({ cle: "referent", label: "référent", href: `${edit}#f-referent` });
  if (o.aStructure === false) out.push({ cle: "structure", label: "structure", href: `${edit}#f-structure` });
  return out;
}

// --- Structure ---------------------------------------------------------------
export function manquesEntite(e: {
  id: string;
  ville?: string | null;
  type?: string | null;
  aPersonne?: boolean;
}): Manque[] {
  const edit = `/entites/${e.id}/modifier`;
  const out: Manque[] = [];
  if (vide(e.ville)) out.push({ cle: "ville", label: "ville", href: `${edit}#f-ville` });
  // « autre » est la valeur par défaut : le type n'a jamais été précisé.
  if (!e.type || e.type === "autre") out.push({ cle: "type", label: "type", href: `${edit}#f-type` });
  // Une structure sans personne, c'est une porte sans poignée : on ne sait à qui
  // parler. Le lien mène à la création d'une personne déjà rattachée.
  if (e.aPersonne === false) {
    out.push({ cle: "personne", label: "personne à joindre", href: `/personnes/nouvelle?entite=${e.id}` });
  }
  return out;
}

// --- Personne ----------------------------------------------------------------
export function manquesContact(c: {
  id: string;
  fonction?: string | null;
  tel?: string | null;
  email?: string | null;
  entite_id?: string | null;
}): Manque[] {
  const edit = `/personnes/${c.id}/modifier`;
  const out: Manque[] = [];
  if (vide(c.fonction)) out.push({ cle: "fonction", label: "fonction", href: `${edit}#f-fonction` });
  if (vide(c.tel)) out.push({ cle: "tel", label: "téléphone", href: `${edit}#f-tel` });
  if (vide(c.email)) out.push({ cle: "email", label: "e-mail", href: `${edit}#f-email` });
  if (!c.entite_id) out.push({ cle: "structure", label: "structure", href: `${edit}#f-structure` });
  return out;
}
