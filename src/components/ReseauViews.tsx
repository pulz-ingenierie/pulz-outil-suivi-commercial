"use client";

import Link from "next/link";
import { useState } from "react";
import ExpandableRow from "@/components/ExpandableRow";

// Écran « Réseau » : deux onglets secondaires (Structures / Personnes), chacun
// avec son bouton d'ajout (noir) et ses lignes qui se déploient en volet.

type Op = { id: string; nom: string; statut: string; montant_estime: number | null };

type Structure = {
  id: string;
  nom: string;
  type: string;
  ville: string | null;
  silencieux: boolean;
  dormant: boolean;
  ops: Op[];
  prochaineRelance: string | null;
  incomplet?: boolean;
};

type PersonneListe = {
  id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  entiteId: string | null;
  entiteNom: string | null;
  incomplet?: boolean;
};

function dateCourt(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return d;
  }
}

type Vue = "structure" | "personne";

// Filtre « à compléter » : présent seulement s'il y a quelque chose à compléter.
// Deux pastilles, comme les autres barres d'outils de l'outil.
function FiltreCompleter({ n, actif, onToggle }: { n: number; actif: boolean; onToggle: (v: boolean) => void }) {
  if (!n) return null;
  return (
    <div className="filtres">
      <button type="button" className={`fchip${actif ? " on" : ""}`} aria-pressed={actif} onClick={() => onToggle(!actif)}>
        À compléter <span className="tnum">{n}</span>
      </button>
      <button type="button" className={`fchip${actif ? "" : " on"}`} aria-pressed={!actif} onClick={() => onToggle(false)}>
        Toutes
      </button>
    </div>
  );
}

export default function ReseauViews({ reseau, personnes }: { reseau: Structure[]; personnes: PersonneListe[] }) {
  const [vue, setVue] = useState<Vue>("structure");

  return (
    <>
      <div className="fiche-head">
        <div>
          <div className="eyebrow">Réseau</div>
          <h1>Réseau</h1>
        </div>
        {vue === "structure" ? (
          <Link className="btn" href="/entites/nouvelle">+ Nouvelle structure</Link>
        ) : (
          <Link className="btn" href="/personnes/nouvelle">+ Nouvelle personne</Link>
        )}
      </div>

      <div className="subtabs" role="tablist" aria-label="Réseau">
        <button role="tab" aria-selected={vue === "structure"} className={`subtab${vue === "structure" ? " on" : ""}`} onClick={() => setVue("structure")}>
          Structures <span className="subtab-n tnum">{reseau.length}</span>
        </button>
        <button role="tab" aria-selected={vue === "personne"} className={`subtab${vue === "personne" ? " on" : ""}`} onClick={() => setVue("personne")}>
          Personnes <span className="subtab-n tnum">{personnes.length}</span>
        </button>
      </div>

      <div className="tab-body">
        {vue === "structure" ? <VueStructures reseau={reseau} /> : <VuePersonnes personnes={personnes} />}
      </div>
    </>
  );
}

function VueStructures({ reseau }: { reseau: Structure[] }) {
  const [q, setQ] = useState("");
  const [aCompleter, setACompleter] = useState(false);
  const terme = q.trim().toLowerCase();
  let list = terme ? reseau.filter((s) => s.nom.toLowerCase().includes(terme)) : reseau;
  if (aCompleter) list = list.filter((s) => s.incomplet);
  if (!reseau.length) {
    return <div className="card"><span className="empty">Aucune structure enregistrée pour le moment.</span></div>;
  }
  return (
    <>
      <input className="search" type="search" placeholder="Rechercher une structure…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une structure" />
      <FiltreCompleter n={reseau.filter((s) => s.incomplet).length} actif={aCompleter} onToggle={setACompleter} />
      {list.length ? (
        <div className="vlist2">
          {list.map((s) => (
            <ExpandableRow type="entite" id={s.id} nom={s.nom} key={s.id}>
              <span className="vrow-nom">{s.nom}</span>
              <span className="vrow-meta">
                {s.prochaineRelance && <span className="vrow-rel">Relance {dateCourt(s.prochaineRelance)}</span>}
                {s.dormant && <span className="pill dormant">sommeil</span>}
                {s.silencieux && s.ops.length === 0 && <span className="pill silence">à réchauffer</span>}
                <span className="vrow-type">{s.type}</span>
                {s.incomplet && <span className="ac-dot" title="Fiche à compléter" aria-label="Fiche à compléter" />}
              </span>
            </ExpandableRow>
          ))}
        </div>
      ) : (
        <div className="card"><span className="empty">{aCompleter ? "Aucune structure à compléter — tout est renseigné." : "Aucune structure ne correspond à votre recherche."}</span></div>
      )}
    </>
  );
}

function VuePersonnes({ personnes }: { personnes: PersonneListe[] }) {
  const [q, setQ] = useState("");
  const [aCompleter, setACompleter] = useState(false);
  const terme = q.trim().toLowerCase();
  let list = terme
    ? personnes.filter((p) => `${p.prenom ?? ""} ${p.nom} ${p.entiteNom ?? ""}`.toLowerCase().includes(terme))
    : personnes;
  if (aCompleter) list = list.filter((p) => p.incomplet);
  if (!personnes.length) {
    return <div className="card"><span className="empty">Aucune personne enregistrée pour le moment.</span></div>;
  }
  return (
    <>
      <input className="search" type="search" placeholder="Rechercher une personne…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une personne" />
      <FiltreCompleter n={personnes.filter((p) => p.incomplet).length} actif={aCompleter} onToggle={setACompleter} />
      {list.length ? (
        <div className="vlist2">
          {list.map((p) => {
            const nomComplet = [p.prenom, p.nom].filter(Boolean).join(" ") || p.nom;
            return (
              <ExpandableRow type="personne" id={p.id} nom={nomComplet} key={p.id}>
                <span className="vrow-nom">{nomComplet}</span>
                {/* La FONCTION ne s'affiche pas ici : sur un écran étroit, un
                    titre long (« directeur du développement immobilier ») pousse
                    le nom hors de la ligne — or c'est le nom qu'on cherche dans
                    une liste. Elle reste sur le volet déplié et sur la fiche. */}
                <span className="vrow-meta">
                  {p.entiteNom && <span className="vrow-type">{p.entiteNom}</span>}
                  {p.incomplet && <span className="ac-dot" title="Fiche à compléter" aria-label="Fiche à compléter" />}
                </span>
              </ExpandableRow>
            );
          })}
        </div>
      ) : (
        <div className="card"><span className="empty">{aCompleter ? "Aucune personne à compléter — tout est renseigné." : "Aucune personne ne correspond à votre recherche."}</span></div>
      )}
    </>
  );
}
