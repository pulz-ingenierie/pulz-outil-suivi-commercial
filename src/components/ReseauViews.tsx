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
};

type PersonneListe = {
  id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  entiteId: string | null;
  entiteNom: string | null;
};

function dateCourt(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return d;
  }
}

type Vue = "structure" | "personne";

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
  const terme = q.trim().toLowerCase();
  const list = terme ? reseau.filter((s) => s.nom.toLowerCase().includes(terme)) : reseau;
  if (!reseau.length) {
    return <div className="card"><span className="empty">Aucune structure enregistrée pour le moment.</span></div>;
  }
  return (
    <>
      <input className="search" type="search" placeholder="Rechercher une structure…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une structure" />
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
              </span>
            </ExpandableRow>
          ))}
        </div>
      ) : (
        <div className="card"><span className="empty">Aucune structure ne correspond à votre recherche.</span></div>
      )}
    </>
  );
}

function VuePersonnes({ personnes }: { personnes: PersonneListe[] }) {
  const [q, setQ] = useState("");
  const terme = q.trim().toLowerCase();
  const list = terme
    ? personnes.filter((p) => `${p.prenom ?? ""} ${p.nom} ${p.entiteNom ?? ""}`.toLowerCase().includes(terme))
    : personnes;
  if (!personnes.length) {
    return <div className="card"><span className="empty">Aucune personne enregistrée pour le moment.</span></div>;
  }
  return (
    <>
      <input className="search" type="search" placeholder="Rechercher une personne…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une personne" />
      {list.length ? (
        <div className="vlist2">
          {list.map((p) => {
            const nomComplet = [p.prenom, p.nom].filter(Boolean).join(" ") || p.nom;
            return (
              <ExpandableRow type="personne" id={p.id} nom={nomComplet} key={p.id}>
                <span className="vrow-nom">{nomComplet}</span>
                <span className="vrow-meta">
                  {p.fonction && <span>{p.fonction}</span>}
                  {p.entiteNom && <span className="vrow-type">{p.entiteNom}</span>}
                </span>
              </ExpandableRow>
            );
          })}
        </div>
      ) : (
        <div className="card"><span className="empty">Aucune personne ne correspond à votre recherche.</span></div>
      )}
    </>
  );
}
