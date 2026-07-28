"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { updateRelance } from "@/lib/actions";
import ReporterRelance from "@/components/ReporterRelance";
import Signet from "@/components/Signet";
import SwipeRow from "@/components/SwipeRow";
import CatIcon from "@/components/CatIcon";
import PhaseAffaire from "@/components/PhaseAffaire";
import { type OperationStatut } from "@/lib/types";

// Une relance = une ligne qui se DÉPLIE sur place (comme le reste de l'outil) :
// signets associés + actions (Nouveau CR, Fait, Reporter, Abandonner). Glisser
// vers la gauche supprime la relance.

export type RelRow = {
  id: string;
  objet: string;
  echeance: string;
  enRetard: boolean;
  op: { id: string; nom: string; statut: string } | null;
  structs: { id: string; nom: string }[];
  personne: string | null;
  persHref: string | null;
  crHref: string;
  reporterDefault: string;
};

type Groupe = { titre: string; classe: string; items: RelRow[] };

export default function RelancesListe({ groupes }: { groupes: Groupe[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [vue, setVue] = useState<string>("__toutes__");
  const toggle = (id: string) => setOuvert((cur) => (cur === id ? null : id));

  // Arrivée depuis un lien « #r-<id> » (ex. clic sur une relance dans un volet) :
  // on ouvre directement la relance visée et on la fait défiler à l'écran.
  useEffect(() => {
    const m = (typeof window !== "undefined" ? window.location.hash : "").match(/^#r-(.+)$/);
    if (!m) return;
    const relId = m[1];
    setOuvert(relId);
    const t = setTimeout(() => {
      document.getElementById(`r-${relId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const total = groupes.reduce((n, g) => n + g.items.length, 0);
  // Onglets secondaires : « Toutes » + un onglet par groupe. Le contenu se filtre
  // sur l'onglet actif (épinglé sous la barre du haut).
  const onglets = [{ cle: "__toutes__", titre: "Toutes", n: total }, ...groupes.map((g) => ({ cle: g.titre, titre: g.titre, n: g.items.length }))];
  const groupesVisibles = vue === "__toutes__" ? groupes : groupes.filter((g) => g.titre === vue);

  if (total === 0) return null;

  return (
    <>
      <div className="subtabs" role="tablist" aria-label="Filtrer les relances">
        {onglets.map((o) => (
          <button
            key={o.cle}
            role="tab"
            aria-selected={vue === o.cle}
            className={`subtab${vue === o.cle ? " on" : ""}`}
            onClick={() => setVue(o.cle)}
          >
            {o.titre} <span className="subtab-n tnum">{o.n}</span>
          </button>
        ))}
      </div>
      <div className="tab-body">
      {groupesVisibles.map((g) =>
        g.items.length ? (
          <section className="rel-group" key={g.titre}>
            <h2 className={`rel-h ${g.classe}`}>{g.titre} <span className="tnum">{g.items.length}</span></h2>
            <div className="vlist2">
              {g.items.map((r) => {
                const open = ouvert === r.id;
                return (
                  <div className={`lx${open ? " open" : ""}`} key={r.id} id={`r-${r.id}`} style={{ scrollMarginTop: "calc(var(--topbar-h, 60px) + 52px)" }}>
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
                        <div className="carte-top">
                          <span className="carte-cat rel"><CatIcon name="relance" /> Relance</span>
                          <h2 className="carte-nom-view">{r.objet}</h2>
                          <div className={`carte-meta${r.enRetard ? " crit" : ""}`}>Échéance : {r.echeance}{r.enRetard ? " · en retard" : ""}</div>
                        </div>
                        <div className="carte-body">
                          {r.op && (
                            <div className="carte-sect">
                              <div className="carte-sect-h"><CatIcon name="operation" /> Opération</div>
                              <div className="sig-wrap">
                                <Signet type="operation" id={r.op.id} cat="op" label={r.op.nom} />
                              </div>
                              <div className="rel-phase">
                                <span className="rel-phase-lab">Faire avancer l'affaire&nbsp;:</span>
                                <PhaseAffaire operationId={r.op.id} statut={r.op.statut as OperationStatut} />
                              </div>
                            </div>
                          )}
                          {r.structs.length > 0 && (
                            <div className="carte-sect">
                              <div className="carte-sect-h"><CatIcon name="structure" /> Structures</div>
                              <div className="sig-wrap">
                                {r.structs.map((s) => <Signet key={s.id} type="entite" id={s.id} cat="struct" label={s.nom} />)}
                              </div>
                            </div>
                          )}
                          {r.personne && (() => {
                            const membre = !!r.persHref && r.persHref.startsWith("/membres/");
                            const cls = `sig-d pers${membre ? " membre" : ""}`;
                            return (
                              <div className="carte-sect">
                                <div className="carte-sect-h"><CatIcon name="personne" /> {membre ? "Personne concernée (groupement)" : "Personne à relancer"}</div>
                                <div className="sig-wrap">
                                  {r.persHref
                                    ? <Link className={cls} href={r.persHref}><span className="sig-lbl">{r.personne}</span></Link>
                                    : <span className={cls}><span className="sig-lbl">{r.personne}</span></span>}
                                </div>
                              </div>
                            );
                          })()}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
      </div>
    </>
  );
}
