"use client";

import { useState } from "react";
import Link from "next/link";
import SwipeRow from "@/components/SwipeRow";
import Signet from "@/components/Signet";
import CatIcon from "@/components/CatIcon";
import { demanderSuppression } from "@/lib/gestures";
import { useExclusiveOpen } from "@/lib/useExclusiveOpen";

// Style de volet homogène (comme la relance du compte rendu) : bandeau de
// catégorie, titre, sections à en-têtes icônés, pied d'actions.
const CATS = {
  entite: { cls: "struct", icon: "structure" },
  operation: { cls: "op", icon: "operation" },
  personne: { cls: "pers", icon: "personne" },
} as const;

// Ligne de liste qui se DÉPLIE sur place au tap (au lieu d'un volet qui remonte
// du bas). Elle charge à la demande l'aperçu de l'objet (/api/apercu) et affiche
// ses signets associés (cliquables → fiche) + les actions. Glisser vers la
// gauche supprime (SwipeRow).

type Item = { type: "entite" | "operation" | "personne"; id: string; cat: string; label: string };
type SectionIcon = "structure" | "operation" | "personne" | "relance" | "ville";
type Section = { titre: string; icon?: SectionIcon; items: Item[] };
type Relance = { id: string; objet: string; echeance: string; enRetard: boolean; personnes?: { nom: string; membre: boolean }[]; operation?: { id: string; nom: string } | null };
type Apercu = { cat: string; catLabel: string; nom: string; meta?: string; ville?: string | null; tel?: string | null; email?: string | null; href: string; sections: Section[]; relances?: Relance[] };

export default function ExpandableRow({
  type,
  id,
  nom,
  children,
}: {
  type: "entite" | "operation" | "personne";
  id: string;
  nom?: string;
  children: React.ReactNode;
}) {
  const { open, setOpen } = useExclusiveOpen(`${type}:${id}`);
  const [data, setData] = useState<Apercu | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !data) {
      setLoading(true);
      try {
        const r = await fetch(`/api/apercu?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`);
        if (r.ok) setData(await r.json());
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
  };

  return (
    <div className={`lx${open ? " open" : ""}`}>
      <SwipeRow type={type} id={id} nom={nom}>
        <div
          className="vrow"
          role="button"
          tabIndex={0}
          style={{ cursor: "pointer" }}
          aria-expanded={open}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
        >
          {children}
          <span className="lx-chev" aria-hidden>›</span>
        </div>
      </SwipeRow>
      {open && (
        <div className="lx-body">
          {loading && <p className="proc" style={{ margin: 0 }}>Chargement…</p>}
          {data && (
            <>
              <div className="carte-top">
                <span className={`carte-cat ${CATS[type].cls}`}><CatIcon name={CATS[type].icon} /> {data.catLabel}</span>
                <h2 className="carte-nom-view">{data.nom || nom}</h2>
                {data.meta ? <div className="carte-meta">{data.meta}</div> : null}
              </div>
              <div className="carte-body">
                {data.cat === "op" && (
                  <div className="carte-sect">
                    <div className="carte-sect-h"><CatIcon name="ville" /> Ville</div>
                    <div className="sig-wrap">
                      <span className={`sig-d ville${data.ville ? "" : " vide"}`}><span className="sig-lbl">{data.ville || "✕ à compléter"}</span></span>
                    </div>
                  </div>
                )}
                {data.cat === "pers" && (
                  <div className="carte-sect">
                    <div className="carte-sect-h"><CatIcon name="personne" /> Coordonnées</div>
                    {data.tel || data.email ? (
                      <div className="carte-coord">
                        {data.tel && <a className="btn ghost mini" href={`tel:${data.tel}`} onClick={(e) => e.stopPropagation()}>{data.tel}</a>}
                        {data.email && <a className="btn ghost mini" href={`mailto:${data.email}`} onClick={(e) => e.stopPropagation()}>{data.email}</a>}
                      </div>
                    ) : (
                      <div className="sig-wrap">
                        <span className="sig-d ville vide"><span className="sig-lbl">✕ à compléter</span></span>
                      </div>
                    )}
                  </div>
                )}
                {data.sections.map((s, i) => (
                  <div className="carte-sect" key={i}>
                    <div className="carte-sect-h"><CatIcon name={s.icon ?? "structure"} /> {s.titre}</div>
                    <div className="sig-wrap">
                      {s.items.map((it) => <Signet key={`${it.type}-${it.id}`} type={it.type} id={it.id} cat={it.cat} label={it.label} parent={{ type, id, nom: data?.nom ?? nom }} />)}
                    </div>
                  </div>
                ))}
                {data.relances && data.relances.length > 0 && (
                  <div className="carte-sect">
                    <div className="carte-sect-h"><CatIcon name="relance" /> Prochaines relances</div>
                    {/* Affichage compact : une ligne par relance (objet tronqué +
                        échéance). Le détail complet (opération, personne…) s'ouvre
                        en tapant, sur l'écran Relances — pas de volet imbriqué. */}
                    <div className="rel-mini-list">
                      {data.relances.map((r) => (
                        <Link className="rel-mini" href={`/relances#r-${r.id}`} key={r.id}>
                          <span className="rel-mini-obj">{r.objet}</span>
                          <span className={`rel-mini-date${r.enRetard ? " crit" : ""}`}>{r.echeance}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {data.cat !== "pers" && data.sections.length === 0 && !(data.relances && data.relances.length) && <p className="hint" style={{ margin: 0 }}>Aucun élément associé pour l'instant.</p>}
                <div className="carte-foot">
                  <button type="button" className="btn ghost mini danger" onClick={() => demanderSuppression(type, id, data?.nom ?? nom)}>Supprimer</button>
                  <Link className="btn" href={data.href}>Ouvrir la fiche</Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
