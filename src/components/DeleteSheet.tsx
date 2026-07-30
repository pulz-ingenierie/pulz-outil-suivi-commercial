"use client";

import { useCallback, useEffect, useState } from "react";
import { supprimerObjet, detacherSignet } from "@/lib/actions";
import type { Parent } from "@/lib/gestures";

// Volet ROUGE de suppression : se déploie depuis le bas au swipe vers la gauche
// sur une ligne, ou à l'appui long sur un signet (événement `moeia:supprimer`).
// Il prévient (action irréversible) et laisse cocher les objets associés à
// supprimer aussi. Rien n'est coché par défaut à part l'objet lui-même.

type Item = { type: string; id: string; cat: string; label: string };
type Section = { titre: string; items: Item[] };
type Apercu = { cat: string; catLabel: string; nom: string; sections: Section[]; aSupprimer?: Item[] };

const CAT_LABEL: Record<string, string> = { struct: "cette structure", op: "cette opération", pers: "cette personne", rel: "cette relance" };
const TYPE_QUOI: Record<string, string> = { entite: "cette structure", operation: "cette opération", personne: "cette personne", relance: "cette relance" };

export default function DeleteSheet() {
  const [cible, setCible] = useState<{ type: string; id: string; nom?: string } | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [data, setData] = useState<Apercu | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (type: string, id: string, nom?: string, parent?: Parent) => {
    setCible({ type, id, nom });
    setParent(parent ?? null);
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
      if (d?.type && d?.id) open(d.type, d.id, d.nom, d.parent);
    };
    window.addEventListener("moeia:supprimer", h);
    return () => window.removeEventListener("moeia:supprimer", h);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => { setCible(null); setParent(null); setData(null); setLoading(false); };

  if (!cible) return null;

  // Détachement possible seulement pour des paires réellement liées :
  // structure ⇄ opération, structure ⇄ personne, ou personne ⇄ affaire.
  const paire = parent ? new Set([parent.type, cible.type]) : new Set<string>();
  const detachable =
    !!parent &&
    parent.id !== cible.id &&
    ((paire.has("entite") && paire.has("operation")) ||
      (paire.has("entite") && paire.has("personne")) ||
      (paire.has("operation") && paire.has("personne")));

  // Objets associés proposés à la suppression — les relances en cours (jamais
  // cochés d'office). On n'y met PAS les structures/opérations partagées.
  const assoc: Item[] = data?.aSupprimer ?? [];
  const nom = data?.nom ?? cible.nom ?? "cet élément";
  const quoi = data ? (CAT_LABEL[data.cat] ?? "cet élément") : (TYPE_QUOI[cible.type] ?? "cet élément");

  const parentNom = parent?.nom?.trim() || "cette fiche";

  return (
    <div className="cardovl" onClick={close}>
      <div className="carte danger" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="carte-close" aria-label="Fermer" onClick={close}>×</button>
        <div className="carte-top danger-top">
          <span className="del-eyebrow">{detachable ? "Signet" : "Suppression"}</span>
          <h2 className="carte-nom-view">{detachable ? <>Que faire de {nom} ?</> : <>Supprimer {nom} ?</>}</h2>
          {!detachable && <div className="carte-meta">Cette action est définitive : {quoi} sera retiré de l'outil.</div>}
        </div>
        <div className="carte-body">
          {loading && <p className="proc" style={{ margin: 0 }}>Chargement des éléments liés…</p>}

          {/* Option non destructive : retirer le lien avec la fiche courante. */}
          {detachable && parent && (
            <form action={async (fd) => { await detacherSignet(fd); close(); }} className="del-detach">
              <input type="hidden" name="parent_type" value={parent.type} />
              <input type="hidden" name="parent_id" value={parent.id} />
              <input type="hidden" name="type" value={cible.type} />
              <input type="hidden" name="id" value={cible.id} />
              <button type="submit" className="btn ghost del-detach-btn">Détacher de « {parentNom} »</button>
              <span className="del-detach-note">Retire seulement le lien — {nom} reste dans l'outil.</span>
            </form>
          )}

          <form action={async (fd) => { await supprimerObjet(fd); close(); }}>
            <input type="hidden" name="type" value={cible.type} />
            <input type="hidden" name="id" value={cible.id} />

            {!loading && assoc.length > 0 && (
              <div className="del-assoc">
                <div className="del-assoc-h">Relances liées — supprimer aussi ? (décoché = conservée)</div>
                {assoc.map((it) => (
                  <label className="del-check" key={`${it.type}-${it.id}`}>
                    <input type="checkbox" name="aussi" value={`${it.type}:${it.id}`} />
                    <span className={`sig-d ${it.cat}`}><span className="sig-lbl">{it.label}</span></span>
                  </label>
                ))}
              </div>
            )}

            <div className="rel-acts-row" style={{ marginTop: 4 }}>
              <button type="button" className="btn ghost" onClick={close}>Annuler</button>
              <button type="submit" className="btn danger-solid">Supprimer de l'outil</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
