"use client";

import Link from "next/link";
import { useState } from "react";
import { STATUT_LABELS, STATUT_ORDRE, type OperationStatut } from "@/lib/types";
import VoletCard from "@/components/VoletCard";
import OperationRow from "@/components/OperationRow";

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



export default function PipelineViews({ operations, reseau, personnes }: Props) {
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

      {vue === "phase" && <VuePhase operations={operations} />}
      {vue === "operation" && <VueOperation operations={operations} />}
      {vue === "structure" && <VueStructures reseau={reseau} />}
      {vue === "personne" && <VuePersonnes personnes={personnes} />}
    </>
  );
}

// --- Vue « Par phase » : chaque étape se déplie sur place (accordéon).
function VuePhase({ operations }: { operations: Op[] }) {
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
                <div className="vlist2">
                  {list.slice(0, MAX_APERCU).map((o) => <OperationRow key={o.id} id={o.id} nom={o.nom} statut={o.statut} montant={o.montant_estime} />)}
                </div>
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
function VueOperation({ operations }: { operations: Op[] }) {
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
        <div className="vlist2">
          {list.map((o) => <OperationRow key={o.id} id={o.id} nom={o.nom} statut={o.statut} montant={o.montant_estime} />)}
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
        <div className="vlist2">
          {list.map((s) => (
            <VoletCard className="vrow" type="entite" id={s.id} key={s.id}>
              <span className="vrow-nom">{s.nom}</span>
              <span className="vrow-meta">
                {s.prochaineRelance && <span className="vrow-rel">Relance {dateCourt(s.prochaineRelance)}</span>}
                {s.dormant && <span className="pill dormant">sommeil</span>}
                {s.silencieux && s.ops.length === 0 && <span className="pill silence">à réchauffer</span>}
                <span className="vrow-type">{s.type}</span>
              </span>
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
        <div className="vlist2">
          {list.map((p) => {
            const nomComplet = [p.prenom, p.nom].filter(Boolean).join(" ") || p.nom;
            return (
              <VoletCard className="vrow" type="personne" id={p.id} key={p.id}>
                <span className="vrow-nom">{nomComplet}</span>
                <span className="vrow-meta">
                  {p.fonction && <span>{p.fonction}</span>}
                  {p.entiteNom && <span className="vrow-type">{p.entiteNom}</span>}
                </span>
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
