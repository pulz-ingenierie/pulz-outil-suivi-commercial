"use client";

import Link from "next/link";
import Signet from "@/components/Signet";
import CatIcon from "@/components/CatIcon";
import { useExclusiveOpen } from "@/lib/useExclusiveOpen";

// Relance affichée comme un objet déployable (même volet que partout ailleurs) :
// tap → volet avec l'opération et la personne concernées, + « Ouvrir la relance »
// (bascule sur l'écran Relances, la relance déjà ouverte).
export default function RelanceRow({
  id,
  objet,
  echeance,
  enRetard,
  op = null,
  structs = [],
  personne = null,
  persHref = null,
}: {
  id: string;
  objet: string;
  echeance: string;
  enRetard: boolean;
  op?: { id: string; nom: string } | null;
  structs?: { id: string; nom: string }[];
  personne?: string | null;
  persHref?: string | null;
}) {
  const { open, toggle } = useExclusiveOpen(`relance:${id}`);
  return (
    <div className={`lx${open ? " open" : ""}`}>
      <div
        className={`vrow rel-vrow${enRetard ? " late" : ""}`}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      >
        <div className="rel-vrow-main">
          <span className="vrow-nom">{objet}</span>
          <div className="rel-vrow-sub">
            {op && <span className="sig-d op rel-op-chip"><span className="sig-lbl">{op.nom}</span></span>}
            <span className={`vrow-rel${enRetard ? " crit" : ""}`}>{echeance}{enRetard ? " · en retard" : ""}</span>
          </div>
        </div>
        <span className="lx-chev" aria-hidden>›</span>
      </div>
      {open && (
        <div className="lx-body">
          <div className="carte-top">
            <span className="carte-cat rel"><CatIcon name="relance" /> Relance</span>
            <h2 className="carte-nom-view">{objet}</h2>
            <div className={`carte-meta${enRetard ? " crit" : ""}`}>Échéance : {echeance}{enRetard ? " · en retard" : ""}</div>
          </div>
          <div className="carte-body">
            {op && (
              <div className="carte-sect">
                <div className="carte-sect-h"><CatIcon name="operation" /> Opération</div>
                <div className="sig-wrap"><Signet type="operation" id={op.id} cat="op" label={op.nom} /></div>
              </div>
            )}
            {structs.length > 0 && (
              <div className="carte-sect">
                <div className="carte-sect-h"><CatIcon name="structure" /> Structures</div>
                <div className="sig-wrap">{structs.map((s) => <Signet key={s.id} type="entite" id={s.id} cat="struct" label={s.nom} />)}</div>
              </div>
            )}
            {personne && (() => {
              const membre = !!persHref && persHref.startsWith("/membres/");
              const cls = `sig-d pers${membre ? " membre" : ""}`;
              return (
                <div className="carte-sect">
                  <div className="carte-sect-h"><CatIcon name="personne" /> {membre ? "Personne concernée (groupement)" : "Personne à relancer"}</div>
                  <div className="sig-wrap">
                    {persHref
                      ? <Link className={cls} href={persHref}><span className="sig-lbl">{personne}</span></Link>
                      : <span className={cls}><span className="sig-lbl">{personne}</span></span>}
                  </div>
                </div>
              );
            })()}
            <div className="carte-foot">
              <Link className="btn" href={`/relances#r-${id}`}>Ouvrir la relance</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
