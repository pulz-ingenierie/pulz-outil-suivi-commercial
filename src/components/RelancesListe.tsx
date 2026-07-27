import NavRow from "@/components/NavRow";

// Liste des relances : chaque ligne ouvre la fiche relance (/relances/[id]).
// Un seul geste, comme partout. Glisser vers la gauche supprime la relance.

export type RelRow = {
  id: string;
  objet: string;
  echeance: string;
  enRetard: boolean;
};

type Groupe = { titre: string; classe: string; items: RelRow[] };

export default function RelancesListe({ groupes }: { groupes: Groupe[] }) {
  return (
    <>
      {groupes.map((g) =>
        g.items.length ? (
          <section className="rel-group" key={g.titre}>
            <h2 className={`rel-h ${g.classe}`}>{g.titre} <span className="tnum">{g.items.length}</span></h2>
            <div className="vlist2">
              {g.items.map((r) => (
                <NavRow href={`/relances/${r.id}`} type="relance" id={r.id} nom={r.objet} key={r.id}>
                  <span className={`vrow-nom${r.enRetard ? " late" : ""}`}>{r.objet}</span>
                  <span className="vrow-meta">
                    <span className={`vrow-rel${r.enRetard ? " crit" : ""}`}>
                      {r.echeance}{r.enRetard ? " · en retard" : ""}
                    </span>
                  </span>
                </NavRow>
              ))}
            </div>
          </section>
        ) : null,
      )}
    </>
  );
}
