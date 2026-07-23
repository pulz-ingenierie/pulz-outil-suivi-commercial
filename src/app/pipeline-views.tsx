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

// Version allégée d'une affaire.
type Op = {
  id: string;
  nom: string;
  statut: OperationStatut;
  montant_estime: number | null;
};

type Ent = { id: string; nom: string };

type Prospect = {
  id: string;
  nom: string;
  type: string;
  ville: string | null;
  dernierContact: string | null;
  silencieux: boolean;
  dormant: boolean;
  ops: Op[];
};

type Contact = {
  id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  tel: string | null;
  email: string | null;
  entiteNom: string | null;
};

type Props = {
  operations: Op[];
  opEntites: Record<string, Ent[]>;
  prospects: Prospect[];
  contacts: Contact[];
};

type Vue = "phase" | "operation" | "prospect";

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

function EtapeChip({ statut }: { statut: OperationStatut }) {
  return (
    <span className="chip">
      <span className="dot" style={{ background: `var(${STATUT_VAR[statut]})` }} />
      {STATUT_LABELS[statut]}
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
              <span className="chip ent" key={e.id}>
                {e.nom}
              </span>
            ))}
          {montant && <span className="amt">{montant}</span>}
        </div>
      )}
    </Link>
  );
}

export default function PipelineViews({ operations, opEntites, prospects, contacts }: Props) {
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
        <button className={vue === "prospect" ? "on" : ""} onClick={() => setVue("prospect")}>
          Par prospect
        </button>
      </div>

      {vue === "phase" && <VuePhase operations={operations} />}
      {vue === "operation" && <VueOperation operations={operations} opEntites={opEntites} />}
      {vue === "prospect" && <VueProspect prospects={prospects} contacts={contacts} />}
    </>
  );
}

// --- Vue « Par phase » : une ligne par étape → page dédiée listant ses affaires.
function VuePhase({ operations }: { operations: Op[] }) {
  return (
    <div className="vlist">
      {STATUT_ORDRE.map((statut) => {
        const n = operations.filter((o) => o.statut === statut).length;
        const contenu = (
          <>
            <span className="dot" style={{ background: `var(${STATUT_VAR[statut]})` }} />
            <span className="pnm">{STATUT_LABELS[statut]}</span>
            <span className="cnt tnum">{n}</span>
            {n > 0 && <span className="chev">›</span>}
          </>
        );
        return n > 0 ? (
          <Link className="phase-row" href={`/operations/phase/${statut}`} key={statut}>
            {contenu}
          </Link>
        ) : (
          <div className="phase-row vide" key={statut}>
            {contenu}
          </div>
        );
      })}
    </div>
  );
}

// --- Vue « Par opération » : toutes les affaires, dans l'ordre d'entrée dans
// l'outil (la plus récente en haut — les données arrivent déjà triées ainsi).
function VueOperation({ operations, opEntites }: { operations: Op[]; opEntites: Record<string, Ent[]> }) {
  if (!operations.length) {
    return <div className="card"><span className="empty">Aucune opération pour le moment.</span></div>;
  }
  return (
    <div className="vlist">
      {operations.map((o) => (
        <CarteOp key={o.id} op={o} entites={opEntites[o.id] ?? []} avecEtape avecProspects />
      ))}
    </div>
  );
}

// --- Vue « Par prospect » : deux sous-onglets — Prospects (structures) et
// Contacts (personnes).
function VueProspect({ prospects, contacts }: { prospects: Prospect[]; contacts: Contact[] }) {
  const [sous, setSous] = useState<"prospects" | "contacts">("prospects");
  return (
    <>
      <div className="seg sub" role="tablist" aria-label="Prospects ou contacts">
        <button className={sous === "prospects" ? "on" : ""} onClick={() => setSous("prospects")}>
          Prospects ({prospects.length})
        </button>
        <button className={sous === "contacts" ? "on" : ""} onClick={() => setSous("contacts")}>
          Contacts ({contacts.length})
        </button>
      </div>

      {sous === "prospects" ? <ListeProspects prospects={prospects} /> : <ListeContacts contacts={contacts} />}
    </>
  );
}

function ListeProspects({ prospects }: { prospects: Prospect[] }) {
  if (!prospects.length) {
    return <div className="card"><span className="empty">Aucun prospect enregistré.</span></div>;
  }
  return (
    <div className="vlist">
      {prospects.map((p) => (
        <div className="grp" key={p.id}>
          <h3>
            <span className="dot ent-dot" />
            {p.nom}
            <span className="cnt tnum">{p.ops.length}</span>
          </h3>
          <div className="grp-meta">
            <span className="chip">{p.type}</span>
            {p.ville && <span className="grp-sub last">{p.ville}</span>}
            <span className="last">
              {p.dernierContact ? `Dernier contact : ${dateFr(p.dernierContact)}` : "Jamais rencontré"}
            </span>
            {p.dormant && <span className="pill dormant">en sommeil</span>}
            {p.silencieux && p.ops.length === 0 && <span className="pill silence">à réchauffer</span>}
          </div>
          {p.ops.length ? (
            p.ops.map((o) => <CarteOp key={o.id} op={o} entites={[]} avecEtape />)
          ) : (
            <div className="grp-vide">Aucune affaire en cours — prospect du réseau.</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ListeContacts({ contacts }: { contacts: Contact[] }) {
  if (!contacts.length) {
    return <div className="card"><span className="empty">Aucun contact enregistré pour le moment.</span></div>;
  }
  return (
    <div className="vlist">
      {contacts.map((c) => {
        const nomComplet = [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom;
        return (
          <div className="contact-card" key={c.id}>
            <div className="contact-main">
              <div className="cnm">{nomComplet}</div>
              <div className="cfn">
                {c.fonction && <span>{c.fonction}</span>}
                {c.entiteNom && <span className="chip ent">{c.entiteNom}</span>}
              </div>
            </div>
            <div className="contact-acts">
              {c.tel && <a className="btn ghost mini" href={`tel:${c.tel}`}>Appeler</a>}
              {c.email && <a className="btn ghost mini" href={`mailto:${c.email}`}>E-mail</a>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
