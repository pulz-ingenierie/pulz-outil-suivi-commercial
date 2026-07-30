import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { STATUT_LABELS } from "@/lib/types";

// Aperçu d'un objet (structure / opération / personne) pour le volet global qui
// se déploie au clic sur un signet, partout dans l'outil. Renvoie le nom, une
// méta courte, le lien vers la fiche complète et les signets associés groupés.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_ENTITE: Record<string, string> = {
  MOA: "MOA", archi: "Architecte", promoteur: "Promoteur", bet: "BET", confrere: "Confrère", autre: "Structure",
};

function dateFr(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

// Met en forme les relances « à faire » pour l'affichage déplié (objet, échéance,
// personne, retard). L'aperçu déplié montre tout ce qui touche à l'objet SAUF le
// fil des comptes rendus (réservé à la fiche complète).
const AUJ = () => new Date().toISOString().slice(0, 10);
const normP = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
function formatRelances(rows: any[] | null, membreSet: Set<string> = new Set()): any[] {
  const today = AUJ();
  const vues = new Set<string>();
  return (rows ?? [])
    .filter((r) => { if (vues.has(r.id)) return false; vues.add(r.id); return true; })
    .sort((a, b) => (a.date_echeance ?? "") < (b.date_echeance ?? "") ? -1 : 1)
    .map((r) => ({
      id: r.id,
      objet: r.objet,
      echeance: dateFr(r.date_echeance),
      enRetard: !!r.date_echeance && r.date_echeance < today,
      personne: r.personne ?? null,
      // Membre du groupement (interne) plutôt qu'un contact externe.
      personneMembre: !!r.personne && membreSet.has(normP(r.personne)),
      operation: r.operation_id && r.operations?.nom ? { id: r.operation_id, nom: r.operations.nom } : null,
    }));
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "non configuré" }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "paramètres manquants" }, { status: 400 });
  const sb = getServerSupabase()!;

  // Noms des membres du groupement (interne) : pour distinguer une « personne
  // concernée » interne d'un contact externe « à relancer ».
  const { data: membresRows } = await sb.from("utilisateurs").select("nom");
  const membreSet = new Set((membresRows ?? []).map((m: any) => normP(m.nom)).filter(Boolean));

  try {
    if (type === "entite") {
      const { data: e } = await sb.from("entites").select("id, nom, type, ville").eq("id", id).maybeSingle();
      if (!e) return NextResponse.json({ error: "introuvable" }, { status: 404 });
      const [{ data: liens }, { data: contacts }] = await Promise.all([
        sb.from("entite_operation").select("operations(id, nom)").eq("entite_id", id),
        sb.from("contacts").select("id, nom, prenom").eq("entite_id", id),
      ]);
      const ops = (liens ?? []).map((l: any) => l.operations).filter(Boolean);
      const opIds = ops.map((o: any) => o.id).filter(Boolean);
      // Personnes de la structure = ses contacts directs (entite_id) + les contacts
      // de ses opérations (lien contact_operation). Un « contact du promoteur »
      // rattaché à une affaire doit aussi figurer sur la fiche de sa structure.
      const persMap = new Map<string, any>();
      for (const c of (contacts ?? []) as any[]) persMap.set(c.id, c);
      if (opIds.length) {
        try {
          const { data: co } = await sb.from("contact_operation").select("contact_id").in("operation_id", opIds);
          const cids = [...new Set((co ?? []).map((x: any) => x.contact_id).filter(Boolean))].filter((cid) => !persMap.has(cid as string));
          if (cids.length) {
            const { data: cts } = await sb.from("contacts").select("id, nom, prenom").in("id", cids as string[]);
            for (const c of (cts ?? []) as any[]) persMap.set(c.id, c);
          }
        } catch { /* migration 0010 non appliquée */ }
      }
      const personnesStruct = [...persMap.values()].sort((a: any, b: any) => String(a.nom).localeCompare(String(b.nom), "fr"));
      const sections = [
        { titre: "Opérations", icon: "operation", items: ops.map((o: any) => ({ type: "operation", id: o.id, cat: "op", label: o.nom })) },
        { titre: "Personnes à joindre", icon: "personne", items: personnesStruct.map((c: any) => ({ type: "personne", id: c.id, cat: "pers", label: [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom })) },
      ].filter((s) => s.items.length);
      // Relances en cours rattachées à la structure OU à l'une de ses opérations :
      // affichées dépliées, et proposées à la suppression en cascade.
      const orParts = [`entite_id.eq.${id}`];
      if (opIds.length) orParts.push(`operation_id.in.(${opIds.join(",")})`);
      const { data: rel } = await sb
        .from("relances")
        .select("id, objet, date_echeance, personne, entite_id, operation_id, operations(nom)")
        .eq("statut", "a_faire")
        .or(orParts.join(","));
      const relances = formatRelances(rel, membreSet);
      // Suppression en cascade : uniquement les relances rattachées DIRECTEMENT à
      // la structure (pas celles de ses opérations, qui vivent avec l'opération).
      const aSupprimer = (rel ?? [])
        .filter((r: any) => r.entite_id === id)
        .map((r: any) => ({ type: "relance", id: r.id, cat: "rel", label: r.objet }));
      return NextResponse.json({
        cat: "struct", catLabel: "Structure", nom: (e as any).nom,
        meta: [TYPE_ENTITE[(e as any).type] ?? (e as any).type, (e as any).ville].filter(Boolean).join(" · "),
        href: `/entites/${id}`, sections, relances, aSupprimer,
      });
    }

    if (type === "operation") {
      // select("*") plutôt que de nommer "ville" : reste robuste si la migration
      // de la colonne ville n'a pas encore été jouée (lecture sans échec).
      const { data: o } = await sb.from("operations").select("*").eq("id", id).maybeSingle();
      if (!o) return NextResponse.json({ error: "introuvable" }, { status: 404 });
      const [{ data: liens }, { data: persLiens }] = await Promise.all([
        sb.from("entite_operation").select("entites(id, nom)").eq("operation_id", id),
        sb.from("contact_operation").select("contact_id").eq("operation_id", id),
      ]);
      const structs = (liens ?? []).map((l: any) => l.entites).filter(Boolean);
      const cids = (persLiens ?? []).map((l: any) => l.contact_id).filter(Boolean);
      let perss: any[] = [];
      if (cids.length) {
        const { data: cts } = await sb.from("contacts").select("id, nom, prenom").in("id", cids);
        perss = cts ?? [];
      }
      const sections = [
        { titre: "Structures", icon: "structure", items: structs.map((s: any) => ({ type: "entite", id: s.id, cat: "struct", label: s.nom })) },
        { titre: "Personnes à joindre", icon: "personne", items: perss.map((c: any) => ({ type: "personne", id: c.id, cat: "pers", label: [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom })) },
      ].filter((s) => s.items.length);
      // Relances en cours rattachées à l'opération : affichées et proposées à la
      // suppression.
      const { data: rel } = await sb.from("relances").select("id, objet, date_echeance, personne, operation_id, operations(nom)").eq("operation_id", id).eq("statut", "a_faire");
      const relances = formatRelances(rel, membreSet);
      const aSupprimer = (rel ?? []).map((r: any) => ({ type: "relance", id: r.id, cat: "rel", label: r.objet }));
      return NextResponse.json({
        cat: "op", catLabel: "Opération", nom: (o as any).nom,
        meta: STATUT_LABELS[(o as any).statut as keyof typeof STATUT_LABELS] ?? (o as any).statut,
        ville: (o as any).ville ?? null,
        href: `/operations/${id}`, sections, relances, aSupprimer,
      });
    }

    if (type === "personne") {
      const { data: c } = await sb.from("contacts").select("id, nom, prenom, fonction, entite_id").eq("id", id).maybeSingle();
      if (!c) return NextResponse.json({ error: "introuvable" }, { status: 404 });
      const cc = c as any;
      let structSection: any = null;
      let opsSection: any = null;
      if (cc.entite_id) {
        const [{ data: st }, { data: liens }] = await Promise.all([
          sb.from("entites").select("id, nom").eq("id", cc.entite_id).maybeSingle(),
          sb.from("entite_operation").select("operations(id, nom)").eq("entite_id", cc.entite_id),
        ]);
        if (st) structSection = { titre: "Structure", icon: "structure", items: [{ type: "entite", id: (st as any).id, cat: "struct", label: (st as any).nom }] };
        const ops = (liens ?? []).map((l: any) => l.operations).filter(Boolean);
        if (ops.length) opsSection = { titre: "Opérations", icon: "operation", items: ops.map((o: any) => ({ type: "operation", id: o.id, cat: "op", label: o.nom })) };
      }
      const sections = [structSection, opsSection].filter(Boolean);
      // Relances en cours qui nomment cette personne (champ « personne » libre).
      const nomComplet = [cc.prenom, cc.nom].filter(Boolean).join(" ") || cc.nom;
      const { data: rel } = await sb
        .from("relances")
        .select("id, objet, date_echeance, personne, operation_id, operations(nom)")
        .eq("statut", "a_faire")
        .ilike("personne", `%${cc.nom}%`);
      const relances = formatRelances(rel, membreSet);
      return NextResponse.json({
        cat: "pers", catLabel: "Personne", nom: nomComplet,
        meta: cc.fonction ?? "", href: `/personnes/${id}`, sections, relances,
      });
    }

    return NextResponse.json({ error: "type inconnu" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erreur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
