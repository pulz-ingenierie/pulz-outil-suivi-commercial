import Link from "next/link";
import type { Manque } from "@/lib/completude";

// Rappel des informations manquantes, en pied du bloc « Repères ».
// Un SEUL endroit par fiche — jamais un marqueur par ligne : les valeurs
// présentes s'affichent proprement, et rien ne remplace une valeur absente.
// Ton volontairement sourd (pierre, pointillés) : une fiche incomplète n'est
// pas une erreur, c'est un travail à finir.
export default function ACompleter({ manques }: { manques: Manque[] }) {
  if (!manques.length) return null;
  return (
    <div className="ac">
      <span className="ac-lab">À compléter</span>
      {manques.map((m) => (
        <Link key={m.cle} className="ac-chip" href={m.href}>{m.label}</Link>
      ))}
    </div>
  );
}
