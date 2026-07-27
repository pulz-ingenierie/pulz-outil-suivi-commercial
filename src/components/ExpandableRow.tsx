"use client";

import { useState } from "react";
import Link from "next/link";
import SwipeRow from "@/components/SwipeRow";
import Signet from "@/components/Signet";
import { demanderSuppression } from "@/lib/gestures";

// Ligne de liste qui se DÉPLIE sur place au tap (au lieu d'un volet qui remonte
// du bas). Elle charge à la demande l'aperçu de l'objet (/api/apercu) et affiche
// ses signets associés (cliquables → fiche) + les actions. Glisser vers la
// gauche supprime (SwipeRow).

type Item = { type: "entite" | "operation" | "personne"; id: string; cat: string; label: string };
type Section = { titre: string; items: Item[] };
type Apercu = { cat: string; catLabel: string; nom: string; meta?: string; href: string; sections: Section[] };

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
              {data.meta ? <div className="lx-meta">{data.meta}</div> : null}
              {data.sections.map((s, i) => (
                <div className="lx-sect" key={i}>
                  <div className="lx-sect-h">{s.titre}</div>
                  <div className="sig-wrap">
                    {s.items.map((it) => <Signet key={`${it.type}-${it.id}`} type={it.type} id={it.id} cat={it.cat} label={it.label} parent={{ type, id, nom: data?.nom ?? nom }} />)}
                  </div>
                </div>
              ))}
              {data.sections.length === 0 && <p className="hint" style={{ margin: 0 }}>Aucun élément associé pour l'instant.</p>}
              <div className="lx-acts">
                <Link className="btn mini" href={data.href}>Ouvrir la fiche</Link>
                <button type="button" className="btn ghost mini danger" onClick={() => demanderSuppression(type, id, data?.nom ?? nom)}>Supprimer</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
