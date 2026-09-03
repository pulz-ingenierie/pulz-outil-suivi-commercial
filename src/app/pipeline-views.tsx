"use client";

import Link from "next/link";
import { useState } from "react";
import { STATUT_LABELS, STATUT_ORDRE, type OperationStatut } from "@/lib/types";
import OperationRow from "@/components/OperationRow";

// Couleur associée à chaque étape (variables CSS définies dans globals.css).
const STATUT_VAR: Record<string, string> = {
  piste: "--s-piste",
  qualifie: "--s-qualifie",
  concours: "--s-concours",
  a_chiffrer: "--s-chiffrer",
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
  incomplet?: boolean;
};

type Props = { operations: Op[] };

type Vue = "phase" | "operation";

export default function PipelineViews({ operations }: Props) {
  const [vue, setVue] = useState<Vue>("phase");

  return (
    <>
      <div className="subtabs" role="tablist" aria-label="Manière de classer les opérations">
        <button role="tab" aria-selected={vue === "phase"} className={`subtab${vue === "phase" ? " on" : ""}`} onClick={() => setVue("phase")}>
          Par phase
        </button>
        <button role="tab" aria-selected={vue === "operation"} className={`subtab${vue === "operation" ? " on" : ""}`} onClick={() => setVue("operation")}>
          Par opération
        </button>
      </div>

      <div className="tab-body">
        {vue === "phase" && <VuePhase operations={operations} />}
        {vue === "operation" && <VueOperation operations={operations} />}
      </div>
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
    <div className="vlist2 phases">
      {STATUT_ORDRE.map((statut) => {
        const list = operations.filter((o) => o.statut === statut);
        const ouvert = ouverts.has(statut);
        const vide = list.length === 0;
        return (
          <div className="phase-item" key={statut}>
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
                  {list.slice(0, MAX_APERCU).map((o) => <OperationRow key={o.id} id={o.id} nom={o.nom} statut={o.statut} montant={o.montant_estime} incomplet={o.incomplet} />)}
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
  // Filtre « à compléter » : le point d'entrée pour vider le stock de trous.
  // Il ne s'affiche que s'il y a quelque chose à compléter.
  const [seulesIncompletes, setSeulesIncompletes] = useState(false);
  const nbIncompletes = operations.filter((o) => o.incomplet).length;
  const terme = q.trim().toLowerCase();
  let list = terme ? operations.filter((o) => o.nom.toLowerCase().includes(terme)) : operations;
  if (seulesIncompletes) list = list.filter((o) => o.incomplet);

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
      {nbIncompletes > 0 && (
        <div className="filtres">
          <button type="button" className={`fchip${seulesIncompletes ? " on" : ""}`}
            aria-pressed={seulesIncompletes} onClick={() => setSeulesIncompletes((v) => !v)}>
            À compléter <span className="tnum">{nbIncompletes}</span>
          </button>
          <button type="button" className={`fchip${seulesIncompletes ? "" : " on"}`}
            aria-pressed={!seulesIncompletes} onClick={() => setSeulesIncompletes(false)}>
            Toutes
          </button>
        </div>
      )}
      {list.length ? (
        <div className="vlist2">
          {list.map((o) => <OperationRow key={o.id} id={o.id} nom={o.nom} statut={o.statut} montant={o.montant_estime} incomplet={o.incomplet} />)}
        </div>
      ) : (
        <div className="card">
          <span className="empty">
            {!operations.length
              ? "Aucune opération pour le moment."
              : seulesIncompletes
                ? "Aucune affaire à compléter — tout est renseigné."
                : "Aucune affaire ne correspond à votre recherche."}
          </span>
        </div>
      )}
    </>
  );
}
