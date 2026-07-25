"use client";

import Link from "next/link";
import { useState } from "react";
import { STATUT_LABELS, STATUT_ORDRE, type OperationStatut } from "@/lib/types";
import Signet from "@/components/Signet";
import VoletCard from "@/components/VoletCard";

// Couleur associée à chaque étape (variables CSS définies dans globals.css).
const STATUT_VAR: Record<string, string> = {
  contact: "--s-contact",
  qualifie: "--s-qualifie",
  ao_attente: "--s-ao",
  offre_remise: "--s-offre",
  nego: "--s-nego",
  gagne: "--s-gagne",
  perdu: "--s-perdu",
};

// Au-delà de ce nombre d'affaires dans une phase dépliée, on montre les
// premières + un lien vers la page complète (pour rester lisible).
const MAX_APERCU = 6;

type Op = {
  id: string;
  nom: string;
  statut: OperationStatut;
  montant_estime: number | null;
};

type Ent = { id: string; nom: string };

type Personne = {
  id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  tel: string | null;
  email: string | null;
};

type Structure = {
  id: string;
  nom: string;
  type: string;
  ville: string | null;
  dernierContact: string | null;
  silencieux: boolean;
  dormant: boolean;
  ops: Op[];
  contacts: Personne[];
  prochaineRelance: string | null;
};

function dateCourt(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return d;
  }
}

type PersonneListe = {
  id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  entiteId: string | null;
  entiteNom: string | null;
};

type Props = {
  operations: Op[];
  opEntites: Record<string, Ent[]>;
  reseau: Structure[];
  personnes: PersonneListe[];
};

type Vue = "phase" | "operation" | "structure" | "personne";

function euro(n: number | null): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

// L'étape du pipeline est un signet CLIQUABLE (→ toutes les affaires de l'étape).
function EtapeChip({ statut }: { statut: OperationStatut }) {
  return (
    <Link className="sig-d phase" href={`/operations/phase/${statut}`} style={{ ["--cat" as string]: `var(${STATUT_VAR[statut]})` }}>
      <span className="sig-lbl">{STATUT_LABELS[statut]}</span>
    </Link>
  );
}

// Carte d'une affaire (cliquable → sa fiche).
function CarteOp({
  op,
  entites,
  avecEtape,
  avecProspects,
}: {
  op: Op;
  entites: Ent[];
  avecEtape?: boolean;
  avecProspects?: boolean;
}) {
  const montant = euro(op.montant_estime);
  const aMeta = avecEtape || (avecProspects && entites.length > 0) || montant;
  return (
    <div className="op">
      <Link className="onm" href={`/operations/${op.id}`}>{op.nom}</Link>
      {aMeta && (
        <div className="ometa">
          {avecEtape && <EtapeChip statut={op.statut} />}
          {avecProspects &&
            entites.map((e) => <Signet key={e.id} type="entite" id={e.id} cat="struct" label={e.nom} />)}
          {montant && <span className="amt">{montant}</span>}
        </div>
      )}
    </div>
  );
}


export default function PipelineViews({ operations, opEntites, reseau, personnes }: Props) {
  const [vue, setVue] = useState<Vue>("phase");

  return (
    <>
      <div className="seg" role="tablist" aria-label="Manière de classer">
        <button className={vue === "phase" ? "on" : ""} onClick={() => setVue("phase")}>
          Phases
        </button>
        <button className={vue === "operation" ? "on" : ""} onClick={() => setVue("operation")}>
          Opérations
        </button>
        <button className={vue === "structure" ? "on" : ""} onClick={() => setVue("structure")}>
          Structures
        </button>
        <button className={vue === "personne" ? "on" : ""} onClick={() => setVue("personne")}>
          Personnes
        </button>
      </div>

      {vue === "phase" && <VuePhase operations={operations} opEntites={opEntites} />}
      {vue === "operation" && <VueOperation operations={operations} opEntites={opEntites} />}
      {vue === "structure" && <VueStructures reseau={reseau} />}
      {vue === "personne" && <VuePersonnes personnes={personnes} />}
    </>
  );
}

// --- Vue « Par phase » : chaque étape se déplie sur place (accordéon).
function VuePhase({ operations, opEntites }: { operations: Op[]; opEntites: Record<string, Ent[]> }) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const toggle = (s: string) =>
    setOuverts((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  return (
    <div className="vlist">
      {STATUT_ORDRE.map((statut) => {
        const list = operations.filter((o) => o.statut === statut);
        const ouvert = ouverts.has(statut);
        const vide = list.length === 0;
        return (
          <div key={statut}>
            <button
              className={`phase-row${vide ? " vide" : ""}${ouvert ? " open" : ""}`}
              onClick={() => !vide && toggle(statut)}
              aria-expanded={ouvert}
              disabled={vide}
            >
              <span className="dot" style={{ background: `var(${STATUT_VAR[statut]})` }} />
              <span className="pnm">{STATUT_LABELS[statut]}</span>
              <span className="cnt tnum">{list.length}</span>
              {!vide && <span className="chev">›</span>}
            </button>
            {ouvert && (
              <div className="phase-body">
                {list.slice(0, MAX_APERCU).map((o) => (
                  <CarteOp key={o.id} op={o} entites={opEntites[o.id] ?? []} avecProspects />
                ))}
                {list.length > MAX_APERCU && (
                  <Link className="voir-tout" href={`/operations/phase/${statut}`}>
                    Voir les {list.length} affaires ›
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Vue « Par opération » : toutes les affaires (la plus récente en haut),
// avec une recherche par nom pour rester lisible quand il y en a beaucoup.
function VueOperation({ operations, opEntites }: { operations: Op[]; opEntites: Record<string, Ent[]> }) {
  const [q, setQ] = useState("");
  const terme = q.trim().toLowerCase();
  const list = terme ? operations.filter((o) => o.nom.toLowerCase().includes(terme)) : operations;

  return (
    <>
      <input
        className="search"
        type="search"
        placeholder="Rechercher une affaire…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Rechercher une affaire"
      />
      {list.length ? (
        <div className="vlist">
          {list.map((o) => (
            <CarteOp key={o.id} op={o} entites={opEntites[o.id] ?? []} avecEtape avecProspects />
          ))}
        </div>
      ) : (
        <div className="card">
          <span className="empty">
            {operations.length ? "Aucune affaire ne correspond à votre recherche." : "Aucune opération pour le moment."}
          </span>
        </div>
      )}
    </>
  );
}

// --- Vue « Structures » : cartes ÉPURÉES, cliquables → carte complète.
function VueStructures({ reseau }: { reseau: Structure[] }) {
  const [q, setQ] = useState("");
  const terme = q.trim().toLowerCase();
  const list = terme ? reseau.filter((s) => s.nom.toLowerCase().includes(terme)) : reseau;
  if (!reseau.length) {
    return <div className="card"><span className="empty">Aucune structure enregistrée pour le moment.</span></div>;
  }
  return (
    <>
      <input
        className="search"
        type="search"
        placeholder="Rechercher une structure…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Rechercher une structure"
      />
      {list.length ? (
        <div className="minigrid">
          {list.map((s) => (
            <VoletCard className="minicard" type="entite" id={s.id} key={s.id}>
              <div className="mc-top">
                <span className="mc-nom">{s.nom}</span>
                <span className="sig-d type"><span className="sig-lbl">{s.type}</span></span>
              </div>
              {/* Signets groupés par type, ordre : relance (haut), opérations, personnes. */}
              {(s.prochaineRelance || s.ops.length > 0 || s.contacts.length > 0) && (
                <div className="sig-rows">
                  {s.prochaineRelance && (
                    <div className="sig-row">
                      <span className="sig-d rel"><span className="sig-lbl">Relance · {dateCourt(s.prochaineRelance)}</span></span>
                    </div>
                  )}
                  {s.ops.length > 0 && (
                    <div className="sig-row">
                      {s.ops.slice(0, 4).map((o) => (
                        <Signet key={o.id} type="operation" id={o.id} cat="op" label={o.nom} />
                      ))}
                      {s.ops.length > 4 && <span className="mc-more">+{s.ops.length - 4}</span>}
                    </div>
                  )}
                  {s.contacts.length > 0 && (
                    <div className="sig-row">
                      {s.contacts.slice(0, 4).map((c) => {
                        const n = [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom;
                        return <Signet key={c.id} type="personne" id={c.id} cat="pers" label={n} />;
                      })}
                      {s.contacts.length > 4 && <span className="mc-more">+{s.contacts.length - 4}</span>}
                    </div>
                  )}
                </div>
              )}
              {(s.ville || s.dormant || (s.silencieux && s.ops.length === 0)) && (
                <div className="mc-meta">
                  {s.ville && <span>{s.ville}</span>}
                  {s.dormant && <span className="pill dormant">en sommeil</span>}
                  {s.silencieux && s.ops.length === 0 && <span className="pill silence">à réchauffer</span>}
                </div>
              )}
            </VoletCard>
          ))}
        </div>
      ) : (
        <div className="card"><span className="empty">Aucune structure ne correspond à votre recherche.</span></div>
      )}
    </>
  );
}

// --- Vue « Personnes » : cartes ÉPURÉES, cliquables → carte complète.
function VuePersonnes({ personnes }: { personnes: PersonneListe[] }) {
  const [q, setQ] = useState("");
  const terme = q.trim().toLowerCase();
  const list = terme
    ? personnes.filter((p) =>
        `${p.prenom ?? ""} ${p.nom} ${p.entiteNom ?? ""}`.toLowerCase().includes(terme),
      )
    : personnes;
  if (!personnes.length) {
    return <div className="card"><span className="empty">Aucune personne enregistrée pour le moment.</span></div>;
  }
  return (
    <>
      <input
        className="search"
        type="search"
        placeholder="Rechercher une personne…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Rechercher une personne"
      />
      {list.length ? (
        <div className="minigrid">
          {list.map((p) => {
            const nomComplet = [p.prenom, p.nom].filter(Boolean).join(" ") || p.nom;
            return (
              <VoletCard className="minicard" type="personne" id={p.id} key={p.id}>
                <div className="mc-top">
                  <span className="mc-nom">{nomComplet}</span>
                  {p.entiteId && p.entiteNom && <Signet type="entite" id={p.entiteId} cat="struct" label={p.entiteNom} />}
                </div>
                {p.fonction && <div className="mc-meta"><span>{p.fonction}</span></div>}
              </VoletCard>
            );
          })}
        </div>
      ) : (
        <div className="card"><span className="empty">Aucune personne ne correspond à votre recherche.</span></div>
      )}
    </>
  );
}
