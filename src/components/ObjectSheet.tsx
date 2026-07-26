"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Signet from "@/components/Signet";
import { demanderSuppression } from "@/lib/gestures";

// Volet global qui se déploie depuis le bas au clic sur un signet, partout dans
// l'outil. Charge l'aperçu de l'objet (/api/apercu), affiche ses signets
// associés (eux-mêmes cliquables : le langage signet → volet est récursif).

type Item = { type: "entite" | "operation" | "personne"; id: string; cat: string; label: string };
type Section = { titre: string; icon: string; items: Item[] };
type Apercu = { cat: string; catLabel: string; nom: string; meta?: string; href: string; sections: Section[] };

function Icon({ name }: { name: string }) {
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, className: "ic" } as const;
  if (name === "structure")
    return <svg {...p}><path d="M4 21V4h10v17M14 9h6v12M7 8h1M7 12h1M7 16h1M11 8h1M11 12h1M11 16h1M17 13h1M17 17h1" /></svg>;
  if (name === "operation")
    return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
  return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>;
}

const CAT_ICON: Record<string, string> = { struct: "structure", op: "operation", pers: "personne" };

export default function ObjectSheet() {
  const [data, setData] = useState<Apercu | null>(null);
  const [loading, setLoading] = useState(false);
  const [cible, setCible] = useState<{ type: string; id: string } | null>(null);

  const open = useCallback(async (type: string, id: string) => {
    setLoading(true);
    setData(null);
    setCible({ type, id });
    try {
      const res = await fetch(`/api/apercu?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`);
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.type && d?.id) open(d.type, d.id);
    };
    window.addEventListener("moeia:apercu", h);
    return () => window.removeEventListener("moeia:apercu", h);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setData(null); setLoading(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => { setData(null); setLoading(false); setCible(null); };

  const supprimer = () => {
    if (!cible) return;
    const nom = data?.nom;
    close();
    demanderSuppression(cible.type, cible.id, nom);
  };

  if (!data && !loading) return null;

  return (
    <div className="cardovl" onClick={close}>
      <div className="carte" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="carte-close" aria-label="Fermer" onClick={close}>×</button>
        {!data ? (
          <div className="carte-body"><p className="proc">Chargement…</p></div>
        ) : (
          <>
            <div className="carte-top">
              <span className={`carte-cat ${data.cat}`}><Icon name={CAT_ICON[data.cat] ?? "structure"} /> {data.catLabel}</span>
              <h2 className="carte-nom-view">{data.nom}</h2>
              {data.meta ? <div className="carte-meta">{data.meta}</div> : null}
            </div>
            <div className="carte-body">
              {data.sections.map((s, i) => (
                <div className="carte-sect" key={i}>
                  <div className="carte-sect-h"><Icon name={s.icon} /> {s.titre}</div>
                  <div className="sig-wrap">
                    {s.items.map((it) => <Signet key={`${it.type}-${it.id}`} type={it.type} id={it.id} cat={it.cat} label={it.label} />)}
                  </div>
                </div>
              ))}
              {data.sections.length === 0 && (
                <p className="hint" style={{ margin: 0 }}>Aucun élément associé pour l'instant.</p>
              )}
              <div className="carte-foot">
                <Link className="btn" href={data.href} onClick={close}>Ouvrir la fiche complète</Link>
                <button type="button" className="btn ghost danger" onClick={supprimer}>Supprimer</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
