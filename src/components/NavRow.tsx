"use client";

import Link from "next/link";
import SwipeRow from "@/components/SwipeRow";

// Ligne de liste UNIQUE de l'outil : taper → ouvre la fiche (page dédiée).
// Glisser vers la gauche → supprimer. Un seul geste, partout, prévisible.
export default function NavRow({
  href,
  type,
  id,
  nom,
  children,
}: {
  href: string;
  type: string;
  id: string;
  nom?: string;
  children: React.ReactNode;
}) {
  return (
    <SwipeRow type={type} id={id} nom={nom}>
      <Link className="vrow" href={href}>
        {children}
        <span className="lx-chev" aria-hidden>›</span>
      </Link>
    </SwipeRow>
  );
}
