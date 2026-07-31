"use client";

import Link from "next/link";
import Signet from "@/components/Signet";
import CatIcon from "@/components/CatIcon";
import { useExclusiveOpen } from "@/lib/useExclusiveOpen";
import type { PersonneSignet } from "@/lib/personnes";

// Relance affichée comme un objet déployable (même volet que partout ailleurs) :
// tap → volet avec l'opération et la/les personne(s) concernées, + « Ouvrir la
// relance » (bascule sur l'écran Relances, la relance déjà ouverte).
export default function RelanceRow({
  id,
  objet,
  echeance,
  enRetard,
  op = null,
  structs = [],
  personnes = [],
}: {
  id: string;
  objet: string;
  echeance: string;
  enRetard: boolean;
  op?: { id: string; nom: string } | null;
  structs?: { id: string; nom: string }[];
  personnes?: PersonneSignet[];
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
            {personnes.length > 0 && (() => {
              const concernees = personnes.filter((p) => !p.membre);
              const responsables = personnes.filter((p) => p.membre);
              const bloc = (titre: string, list: PersonneSignet[]) =>
                list.length ? (
                  <div className="carte-sect">
                    <div className="carte-sect-h"><CatIcon name="personne" /> {titre}</div>
                    <div className="sig-wrap">
                      {list.map((p) => {
                        const cls = `sig-d pers${p.membre ? " membre" : ""}`;
                        return p.href
                          ? <Link key={p.nom} className={cls} href={p.href}><span className="sig-lbl">{p.nom}</span></Link>
                          : <span key={p.nom} className={cls}><span className="sig-lbl">{p.nom}</span></span>;
                      })}
                    </div>
                  </div>
                ) : null;
              return (
                <>
                  {bloc(concernees.length > 1 ? "Personnes concernées" : "Personne concernée", concernees)}
                  {bloc(responsables.length > 1 ? "Responsables (groupement)" : "Responsable (groupement)", responsables)}
                </>
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
