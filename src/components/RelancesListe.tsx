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

// Une relance « concerne » un membre du groupement si son nom figure parmi les
// personnes de la relance (le champ personne peut en lister plusieurs).
function personnesDe(r: RelRow): string[] {
  return (r.personne ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
function concerne(r: RelRow, membre: string): boolean {
  const m = membre.trim().toLowerCase();
  return personnesDe(r).some((n) => n.toLowerCase() === m);
}
function concerneStructure(r: RelRow, structureId: string): boolean {
  return (r.structs ?? []).some((s) => s.id === structureId);
}

export default function RelancesListe({ groupes, membres = [] }: { groupes: Groupe[]; membres?: string[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [vue, setVue] = useState<string>("__toutes__");
  const [membre, setMembre] = useState<string | null>(null);
  const [structure, setStructure] = useState<string | null>(null);
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

  const totalBrut = groupes.reduce((n, g) => n + g.items.length, 0);
  if (totalBrut === 0) return null;

  // Membres du groupement réellement présents dans les relances (options du
  // filtre « par personne du groupement »).
  const membresPresents = membres.filter((m) => groupes.some((g) => g.items.some((r) => concerne(r, m))));
  // Structures présentes dans les relances (options du filtre « par structure »),
  // dédoublonnées par identifiant et triées par nom.
  const structuresMap = new Map<string, string>();
  for (const g of groupes) for (const r of g.items) for (const s of r.structs ?? []) if (s.id) structuresMap.set(s.id, s.nom);
  const structuresPresentes = [...structuresMap.entries()]
    .map(([id, nom]) => ({ id, nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  // Filtres (personne ET structure) : on restreint chaque groupe aux relances qui
  // concernent la personne choisie et/ou la structure choisie.
  const groupesFiltres = (membre || structure)
    ? groupes.map((g) => ({
        ...g,
        items: g.items.filter((r) => (!membre || concerne(r, membre)) && (!structure || concerneStructure(r, structure))),
      }))
    : groupes;

  const total = groupesFiltres.reduce((n, g) => n + g.items.length, 0);
  // Onglets secondaires : « Toutes » + un onglet par groupe. Le contenu se filtre
  // sur l'onglet actif (épinglé sous la barre du haut).
  const onglets = [{ cle: "__toutes__", titre: "Toutes", n: total }, ...groupesFiltres.map((g) => ({ cle: g.titre, titre: g.titre, n: g.items.length }))];
  const groupesVisibles = vue === "__toutes__" ? groupesFiltres : groupesFiltres.filter((g) => g.titre === vue);

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
      {(membresPresents.length > 0 || structuresPresentes.length > 0) && (
        <div className="rel-filtres">
          {membresPresents.length > 0 && (
            <label className="rel-filtre">
              <span className="rel-filtre-lab">Personne du groupement</span>
              <select
                className="rel-filtre-select"
                value={membre ?? ""}
                onChange={(e) => setMembre(e.target.value || null)}
              >
                <option value="">Toutes les personnes</option>
                {membresPresents.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          {structuresPresentes.length > 0 && (
            <label className="rel-filtre">
              <span className="rel-filtre-lab">Structure</span>
              <select
                className="rel-filtre-select"
                value={structure ?? ""}
                onChange={(e) => setStructure(e.target.value || null)}
              >
                <option value="">Toutes les structures</option>
                {structuresPresentes.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      <div className="tab-body">
      {total === 0 && (
        <div className="card"><span className="empty">Aucune relance pour ce filtre.</span></div>
      )}
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
