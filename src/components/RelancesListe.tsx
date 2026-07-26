"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { updateRelance } from "@/lib/actions";
import ReporterRelance from "@/components/ReporterRelance";
import Signet from "@/components/Signet";

// Une relance sous forme de ligne épurée. Au clic, un volet se déploie depuis le
// bas (même langage que le reste de l'outil) avec les signets associés et les
// actions : Nouveau CR, Fait, Reporter, Abandonner.

export type RelRow = {
  id: string;
  objet: string;
  echeance: string;
  enRetard: boolean;
  op: { id: string; nom: string } | null;
  structs: { id: string; nom: string }[];
  personne: string | null;
  persHref: string | null;
  crHref: string;
  reporterDefault: string;
};

type Groupe = { titre: string; classe: string; items: RelRow[] };

function IconRel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="ic">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M9 2h6" />
    </svg>
  );
}

export default function RelancesListe({ groupes }: { groupes: Groupe[] }) {
  const [sel, setSel] = useState<RelRow | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {groupes.map((g) =>
        g.items.length ? (
          <section className="rel-group" key={g.titre}>
            <h2 className={`rel-h ${g.classe}`}>{g.titre} <span className="tnum">{g.items.length}</span></h2>
            <div className="vlist2">
              {g.items.map((r) => (
                <div
                  key={r.id}
                  className={`vrow${r.enRetard ? " late" : ""}`}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSel(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(r); }
                  }}
                >
                  <span className="vrow-nom">{r.objet}</span>
                  <span className="vrow-meta">
                    <span className={`vrow-rel${r.enRetard ? " crit" : ""}`}>
                      {r.echeance}{r.enRetard ? " · en retard" : ""}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null,
      )}

      {sel && (
        <div className="cardovl" onClick={() => setSel(null)}>
          <div className="carte" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="carte-close" aria-label="Fermer" onClick={() => setSel(null)}>×</button>
            <div className="carte-top">
              <span className="carte-cat rel"><IconRel /> Relance</span>
              <h2 className="carte-nom-view">{sel.objet}</h2>
              <div className={`carte-meta${sel.enRetard ? " crit" : ""}`}>
                Échéance : {sel.echeance}{sel.enRetard ? " · en retard" : ""}
              </div>
            </div>
            <div className="carte-body">
              {sel.op && (
                <div className="carte-sect">
                  <div className="carte-sect-h">Opération</div>
                  <div className="sig-wrap">
                    <Signet type="operation" id={sel.op.id} cat="op" label={sel.op.nom} />
                  </div>
                </div>
              )}
              {sel.structs.length > 0 && (
                <div className="carte-sect">
                  <div className="carte-sect-h">Structures</div>
                  <div className="sig-wrap">
                    {sel.structs.map((s) => <Signet key={s.id} type="entite" id={s.id} cat="struct" label={s.nom} />)}
                  </div>
                </div>
              )}
              {sel.personne && (
                <div className="carte-sect">
                  <div className="carte-sect-h">Personne à relancer</div>
                  <div className="sig-wrap">
                    {sel.persHref
                      ? <Link className="sig-d pers" href={sel.persHref}><span className="sig-lbl">{sel.personne}</span></Link>
                      : <span className="sig-d pers"><span className="sig-lbl">{sel.personne}</span></span>}
                  </div>
                </div>
              )}
              <div className="rel-acts">
                <Link className="btn" href={sel.crHref}>Nouveau compte rendu</Link>
                <div className="rel-acts-row">
                  <form action={updateRelance}>
                    <input type="hidden" name="id" value={sel.id} />
                    <input type="hidden" name="action" value="faite" />
                    <button className="btn ghost mini" type="submit" title="Marquer comme fait">Fait</button>
                  </form>
                  <ReporterRelance id={sel.id} defaultDate={sel.reporterDefault} />
                  <form action={updateRelance}>
                    <input type="hidden" name="id" value={sel.id} />
                    <input type="hidden" name="action" value="abandonner" />
                    <button className="btn ghost mini danger" type="submit">Abandonner</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
