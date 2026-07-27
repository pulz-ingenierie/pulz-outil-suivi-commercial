"use client";

import { useState } from "react";
import Link from "next/link";
import SwipeRow from "@/components/SwipeRow";
import Signet from "@/components/Signet";
import CatIcon from "@/components/CatIcon";
import { demanderSuppression } from "@/lib/gestures";

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
type Relance = { id: string; objet: string; echeance: string; enRetard: boolean; personne: string | null };
type Apercu = { cat: string; catLabel: string; nom: string; meta?: string; ville?: string | null; href: string; sections: Section[]; relances?: Relance[] };

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
  const [open, setOpen] = useState(false);
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
                    <div className="fil">
                      {data.relances.map((r) => (
                        <div className="rel-line" key={r.id}>
                          <span className="rel-line-obj">{r.objet}</span>
                          <div className="sig-wrap">
                            {r.personne && <span className="sig-d pers"><span className="sig-lbl">{r.personne}</span></span>}
                            <span className={`sig-d date${r.enRetard ? " late" : ""}`}><span className="sig-lbl">{r.echeance}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.sections.length === 0 && !(data.relances && data.relances.length) && <p className="hint" style={{ margin: 0 }}>Aucun élément associé pour l'instant.</p>}
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
