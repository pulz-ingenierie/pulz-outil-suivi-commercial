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

// Version allégée d'une opération (ce dont les vues ont besoin).
type Op = {
  id: string;
  nom: string;
  statut: OperationStatut;
  montant_estime: number | null;
};

type Ent = { id: string; nom: string };

type Props = {
  operations: Op[];
  // Pour chaque opération : les prospects (entités) qui y sont rattachés.
  opEntites: Record<string, Ent[]>;
};

type Vue = "phase" | "operation" | "prospect";

function euro(n: number | null): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " €";
}

// Puce colorée + libellé de l'étape (utilisée dans les vues « par opération » et
// « par prospect » où l'étape n'est pas déjà le titre du groupe).
function EtapeChip({ statut }: { statut: OperationStatut }) {
  return (
    <span className="chip">
      <span className="dot" style={{ background: `var(${STATUT_VAR[statut]})` }} />
      {STATUT_LABELS[statut]}
    </span>
  );
}

// Une carte d'opération cliquable. `avecEtape` affiche la puce d'étape ;
// `avecProspects` affiche les prospects rattachés.
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

export default function PipelineViews({ operations, opEntites }: Props) {
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

      {vue === "phase" && <VuePhase operations={operations} opEntites={opEntites} />}
      {vue === "operation" && <VueOperation operations={operations} opEntites={opEntites} />}
      {vue === "prospect" && <VueProspect operations={operations} opEntites={opEntites} />}
    </>
  );
}

// --- Vue « Par phase » : un bandeau par étape, la liste des affaires dedans.
function VuePhase({ operations, opEntites }: Props) {
  return (
    <div className="vlist">
      {STATUT_ORDRE.map((statut) => {
        const list = operations.filter((o) => o.statut === statut);
        return (
          <div className="grp" key={statut}>
            <h3>
              <span className="dot" style={{ background: `var(${STATUT_VAR[statut]})` }} />
              {STATUT_LABELS[statut]}
              <span className="cnt tnum">{list.length}</span>
            </h3>
            {list.length ? (
              list.map((o) => (
                <CarteOp key={o.id} op={o} entites={opEntites[o.id] ?? []} avecProspects />
              ))
            ) : (
              <div className="grp-vide">Aucune affaire à cette étape</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Vue « Par opération » : toutes les affaires, classées par ordre alphabétique.
function VueOperation({ operations, opEntites }: Props) {
  const list = [...operations].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  if (!list.length) {
    return <div className="card"><span className="empty">Aucune opération pour le moment.</span></div>;
  }
  return (
    <div className="vlist">
      {list.map((o) => (
        <CarteOp key={o.id} op={o} entites={opEntites[o.id] ?? []} avecEtape avecProspects />
      ))}
    </div>
  );
}

// --- Vue « Par prospect » : regroupées par prospect (entité) rattaché.
function VueProspect({ operations, opEntites }: Props) {
  // On construit, pour chaque prospect, la liste des affaires où il apparaît.
  const parProspect = new Map<string, { nom: string; ops: Op[] }>();
  const sansProspect: Op[] = [];

  for (const o of operations) {
    const ents = opEntites[o.id] ?? [];
    if (ents.length === 0) {
      sansProspect.push(o);
      continue;
    }
    for (const e of ents) {
      const g = parProspect.get(e.id) ?? { nom: e.nom, ops: [] };
      g.ops.push(o);
      parProspect.set(e.id, g);
    }
  }

  const groupes = [...parProspect.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  if (!groupes.length && !sansProspect.length) {
    return <div className="card"><span className="empty">Aucune opération pour le moment.</span></div>;
  }

  return (
    <div className="vlist">
      {groupes.map((g) => (
        <div className="grp" key={g.nom}>
          <h3>
            <span className="dot ent-dot" />
            {g.nom}
            <span className="cnt tnum">{g.ops.length}</span>
          </h3>
          {g.ops.map((o) => (
            <CarteOp key={o.id} op={o} entites={[]} avecEtape />
          ))}
        </div>
      ))}
      {sansProspect.length > 0 && (
        <div className="grp" key="__sans__">
          <h3>
            <span className="dot ent-dot" style={{ opacity: 0.4 }} />
            Sans prospect rattaché
            <span className="cnt tnum">{sansProspect.length}</span>
          </h3>
          {sansProspect.map((o) => (
            <CarteOp key={o.id} op={o} entites={[]} avecEtape />
          ))}
        </div>
      )}
    </div>
  );
}
