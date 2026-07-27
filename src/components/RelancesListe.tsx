"use client";

import Link from "next/link";
import { useState } from "react";
import { updateRelance } from "@/lib/actions";
import ReporterRelance from "@/components/ReporterRelance";
import Signet from "@/components/Signet";
import SwipeRow from "@/components/SwipeRow";

// Une relance = une ligne qui se DÉPLIE sur place (comme le reste de l'outil) :
// signets associés + actions (Nouveau CR, Fait, Reporter, Abandonner). Glisser
// vers la gauche supprime la relance.

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

export default function RelancesListe({ groupes }: { groupes: Groupe[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const toggle = (id: string) => setOuvert((cur) => (cur === id ? null : id));

  return (
    <>
      {groupes.map((g) =>
        g.items.length ? (
          <section className="rel-group" key={g.titre}>
            <h2 className={`rel-h ${g.classe}`}>{g.titre} <span className="tnum">{g.items.length}</span></h2>
            <div className="vlist2">
              {g.items.map((r) => {
                const open = ouvert === r.id;
                return (
                  <div className={`lx${open ? " open" : ""}`} key={r.id}>
                    <SwipeRow type="relance" id={r.id} nom={r.objet}>
                      <div
                        className={`vrow${r.enRetard ? " late" : ""}`}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: "pointer" }}
                        aria-expanded={open}
                        onClick={() => toggle(r.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(r.id); } }}
                      >
                        <span className="vrow-nom">{r.objet}</span>
                        <span className="vrow-meta">
                          <span className={`vrow-rel${r.enRetard ? " crit" : ""}`}>
                            {r.echeance}{r.enRetard ? " · en retard" : ""}
                          </span>
                          <span className="lx-chev" aria-hidden>›</span>
                        </span>
                      </div>
                    </SwipeRow>
                    {open && (
                      <div className="lx-body">
                        {r.op && (
                          <div className="lx-sect">
                            <div className="lx-sect-h">Opération</div>
                            <div className="sig-wrap">
                              <Signet type="operation" id={r.op.id} cat="op" label={r.op.nom} />
                            </div>
                          </div>
                        )}
                        {r.structs.length > 0 && (
                          <div className="lx-sect">
                            <div className="lx-sect-h">Structures</div>
                            <div className="sig-wrap">
                              {r.structs.map((s) => <Signet key={s.id} type="entite" id={s.id} cat="struct" label={s.nom} />)}
                            </div>
                          </div>
                        )}
                        {r.personne && (
                          <div className="lx-sect">
                            <div className="lx-sect-h">Personne à relancer</div>
                            <div className="sig-wrap">
                              {r.persHref
                                ? <Link className="sig-d pers" href={r.persHref}><span className="sig-lbl">{r.personne}</span></Link>
                                : <span className="sig-d pers"><span className="sig-lbl">{r.personne}</span></span>}
                            </div>
                          </div>
                        )}
                        <div className="rel-acts">
                          <Link className="btn" href={r.crHref}>Nouveau compte rendu</Link>
                          <div className="rel-acts-row">
                            <form action={updateRelance}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="action" value="faite" />
                              <button className="btn ghost mini" type="submit" title="Marquer comme fait">Fait</button>
                            </form>
                            <ReporterRelance id={r.id} defaultDate={r.reporterDefault} />
                            <form action={updateRelance}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="action" value="abandonner" />
                              <button className="btn ghost mini danger" type="submit">Abandonner</button>
                            </form>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
    </>
  );
}
