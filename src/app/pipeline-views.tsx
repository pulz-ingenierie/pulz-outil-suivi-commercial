"use client";

import Link from "next/link";
import { useState } from "react";
import { STATUT_LABELS, STATUT_ORDRE, type OperationStatut } from "@/lib/types";

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
};

type Props = {
  operations: Op[];
  opEntites: Record<string, Ent[]>;
  reseau: Structure[];
};

type Vue = "phase" | "operation" | "reseau";

function euro(n: number | null): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

function dateFr(d: string): string {
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

// L'étape du pipeline est un signet (même langage visuel que partout ailleurs).
function EtapeChip({ statut }: { statut: OperationStatut }) {
  return (
    <span className="sig-d phase" style={{ ["--cat" as string]: `var(${STATUT_VAR[statut]})` }}>
      <span className="sig-lbl">{STATUT_LABELS[statut]}</span>
    </span>
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
    <Link className="op" href={`/operations/${op.id}`}>
      <div className="onm">{op.nom}</div>
      {aMeta && (
        <div className="ometa">
          {avecEtape && <EtapeChip statut={op.statut} />}
          {avecProspects &&
            entites.map((e) => (
              <span className="sig-d struct" key={e.id}>
                <span className="sig-lbl">{e.nom}</span>
              </span>
            ))}
          {montant && <span className="amt">{montant}</span>}
        </div>
      )}
    </Link>
  );
}

// Boutons pour joindre une personne.
function ContactActions({ tel, email }: { tel: string | null; email: string | null }) {
  if (!tel && !email) return null;
  return (
    <div className="contact-acts">
      {tel && <a className="btn ghost mini" href={`tel:${tel}`}>Appeler</a>}
      {email && <a className="btn ghost mini" href={`mailto:${email}`}>E-mail</a>}
    </div>
  );
}

export default function PipelineViews({ operations, opEntites, reseau }: Props) {
  const [vue, setVue] = useState<Vue>("phase");

  return (
    <>
      <div className="seg" role="tablist" aria-label="Manière de classer les affaires">
        <button className={vue === "phase" ? "on" : ""} onClick={() => setVue("phase")}>
          Par phase
        </button>
        <button className={vue === "operation" ? "on" : ""} onClick={() => setVue("operation")}>
          Par opération
        </button>
        <button className={vue === "reseau" ? "on" : ""} onClick={() => setVue("reseau")}>
          Réseau
        </button>
      </div>

      {vue === "phase" && <VuePhase operations={operations} opEntites={opEntites} />}
      {vue === "operation" && <VueOperation operations={operations} opEntites={opEntites} />}
      {vue === "reseau" && <VueReseau reseau={reseau} />}
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

// --- Vue « Réseau » : les structures, avec leurs affaires et leurs personnes.
function VueReseau({ reseau }: { reseau: Structure[] }) {
  if (!reseau.length) {
    return <div className="card"><span className="empty">Aucune structure enregistrée pour le moment.</span></div>;
  }
  return (
    <div className="vlist">
      {reseau.map((s) => (
        <div className="grp" key={s.id}>
          <h3>
            <span className="dot ent-dot" />
            <Link className="grp-nom" href={`/entites/${s.id}`}>{s.nom}</Link>
            <span className="cnt tnum">{s.ops.length}</span>
          </h3>
          <div className="grp-meta">
            <span className="sig-d type"><span className="sig-lbl">{s.type}</span></span>
            {s.ville && <span className="last">{s.ville}</span>}
            <span className="last">
              {s.dernierContact ? `Dernier contact : ${dateFr(s.dernierContact)}` : "Jamais rencontré"}
            </span>
            {s.dormant && <span className="pill dormant">en sommeil</span>}
            {s.silencieux && s.ops.length === 0 && <span className="pill silence">à réchauffer</span>}
          </div>

          {s.ops.map((o) => (
            <CarteOp key={o.id} op={o} entites={[]} avecEtape />
          ))}

          {s.contacts.length > 0 && (
            <div className="persons">
              {s.contacts.map((c) => {
                const nomComplet = [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom;
                return (
                  <div className="person" key={c.id}>
                    <div className="pmain">
                      <span className="pnm">{nomComplet}</span>
                      {c.fonction && <span className="pfn">{c.fonction}</span>}
                    </div>
                    <ContactActions tel={c.tel} email={c.email} />
                  </div>
                );
              })}
            </div>
          )}

          {s.ops.length === 0 && s.contacts.length === 0 && (
            <div className="grp-vide">Aucune affaire ni personne enregistrée — piste du réseau.</div>
          )}
        </div>
      ))}
    </div>
  );
}
