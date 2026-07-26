"use client";

import { useCallback, useEffect, useState } from "react";
import { supprimerObjet } from "@/lib/actions";

// Volet ROUGE de suppression : se déploie depuis le bas au swipe vers la gauche
// sur une ligne, ou à l'appui long sur un signet (événement `moeia:supprimer`).
// Il prévient (action irréversible) et laisse cocher les objets associés à
// supprimer aussi. Rien n'est coché par défaut à part l'objet lui-même.

type Item = { type: "entite" | "operation" | "personne"; id: string; cat: string; label: string };
type Section = { titre: string; items: Item[] };
type Apercu = { cat: string; catLabel: string; nom: string; sections: Section[] };

const CAT_LABEL: Record<string, string> = { struct: "cette structure", op: "cette opération", pers: "cette personne", rel: "cette relance" };
const TYPE_QUOI: Record<string, string> = { entite: "cette structure", operation: "cette opération", personne: "cette personne", relance: "cette relance" };

export default function DeleteSheet() {
  const [cible, setCible] = useState<{ type: string; id: string; nom?: string } | null>(null);
  const [data, setData] = useState<Apercu | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (type: string, id: string, nom?: string) => {
    setCible({ type, id, nom });
    setData(null);
    // Une relance n'a pas d'aperçu ni d'objets associés : confirmation directe.
    if (type === "relance") { setLoading(false); return; }
    setLoading(true);
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
      if (d?.type && d?.id) open(d.type, d.id, d.nom);
    };
    window.addEventListener("moeia:supprimer", h);
    return () => window.removeEventListener("moeia:supprimer", h);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => { setCible(null); setData(null); setLoading(false); };

  if (!cible) return null;

  // Tous les objets associés proposés à la suppression (jamais cochés d'office).
  const assoc: Item[] = data
    ? data.sections.flatMap((s) => s.items).filter((it) => !(it.type === cible.type && it.id === cible.id))
    : [];
  const nom = data?.nom ?? cible.nom ?? "cet élément";
  const quoi = data ? (CAT_LABEL[data.cat] ?? "cet élément") : (TYPE_QUOI[cible.type] ?? "cet élément");

  return (
    <div className="cardovl" onClick={close}>
      <div className="carte danger" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="carte-close" aria-label="Fermer" onClick={close}>×</button>
        <div className="carte-top danger-top">
          <span className="del-eyebrow">Suppression</span>
          <h2 className="carte-nom-view">Supprimer {nom} ?</h2>
          <div className="carte-meta">Cette action est définitive : {quoi} sera retiré de l'outil.</div>
        </div>
        <form action={async (fd) => { await supprimerObjet(fd); close(); }} className="carte-body">
          <input type="hidden" name="type" value={cible.type} />
          <input type="hidden" name="id" value={cible.id} />

          {loading && <p className="proc" style={{ margin: 0 }}>Chargement des éléments liés…</p>}

          {!loading && assoc.length > 0 && (
            <div className="del-assoc">
              <div className="del-assoc-h">Supprimer aussi ? (décoché = conservé)</div>
              {assoc.map((it) => (
                <label className="del-check" key={`${it.type}-${it.id}`}>
                  <input type="checkbox" name="aussi" value={`${it.type}:${it.id}`} />
                  <span className={`sig-d ${it.cat}`}><span className="sig-lbl">{it.label}</span></span>
                </label>
              ))}
            </div>
          )}

          {!loading && assoc.length === 0 && (
            <p className="hint" style={{ margin: 0 }}>Aucun élément associé ne sera supprimé.</p>
          )}

          <div className="rel-acts-row" style={{ marginTop: 4 }}>
            <button type="button" className="btn ghost" onClick={close}>Annuler</button>
            <button type="submit" className="btn danger-solid">Supprimer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
