// Mise en forme du TITRE d'une affaire, au format « Client - Ville - Nature ».
//
// Le titre est stocké tel quel dans `operations.nom`. Historiquement, une partie
// inconnue y était écrite « ✕ » (ex. « Spirit - ✕ - Construction de 80 lots »)
// pour signaler l'information manquante et pouvoir l'insérer plus tard.
//
// Ce marqueur est une mécanique INTERNE : il ne doit jamais atteindre l'écran.
// Une partie absente est simplement OMISE, sans symbole ni séparateur orphelin.

export const SEP_TITRE = " - ";

// Ce qui, dans un segment, ne porte aucune information : le marqueur historique
// et les placeholders qu'on croise dans des titres saisis à la main.
const SEGMENTS_VIDES = new Set(["✕", "x", "?", "n/a", "na", "-", "–", "—", "…", "..", "..."]);

function estVide(segment: string): boolean {
  return !segment || SEGMENTS_VIDES.has(segment.toLowerCase());
}

// Titre prêt à afficher : « Spirit - ✕ - Construction de 80 lots » devient
// « Spirit - Construction de 80 lots ». Un titre déjà complet est inchangé.
export function titreOperation(nom: string | null | undefined): string {
  const brut = (nom ?? "").trim();
  if (!brut) return "";
  const parts = brut.split(SEP_TITRE).map((p) => p.trim());
  const gardes = parts.filter((p) => !estVide(p));
  // Un titre entièrement fait de marqueurs ne devrait pas exister ; s'il en
  // existe un, mieux vaut le montrer brut qu'afficher une ligne vide.
  return gardes.length ? gardes.join(SEP_TITRE) : brut;
}

// Insère (ou remplace) la VILLE — 2ᵉ partie du titre — quand on l'apprend après
// coup. Fonctionne sur les deux formes possibles :
//   « Spirit - ✕ - Construction »  → « Spirit - Poitiers - Construction »
//   « Spirit - Construction »      → « Spirit - Poitiers - Construction »
// Un titre qui n'a pas cette structure est renvoyé inchangé (on ne devine pas).
export function titreAvecVille(nom: string | null | undefined, ville: string): string {
  const brut = (nom ?? "").trim();
  const v = ville.trim();
  if (!brut || !v) return brut;
  const parts = brut.split(SEP_TITRE).map((p) => p.trim());
  if (parts.length === 3) { parts[1] = v; return parts.join(SEP_TITRE); }
  if (parts.length === 2) { return [parts[0], v, parts[1]].join(SEP_TITRE); }
  return brut;
}
