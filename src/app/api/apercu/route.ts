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

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "non configuré" }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "paramètres manquants" }, { status: 400 });
  const sb = getServerSupabase()!;

  try {
    if (type === "entite") {
      const { data: e } = await sb.from("entites").select("id, nom, type, ville").eq("id", id).maybeSingle();
      if (!e) return NextResponse.json({ error: "introuvable" }, { status: 404 });
      const [{ data: liens }, { data: contacts }] = await Promise.all([
        sb.from("entite_operation").select("operations(id, nom)").eq("entite_id", id),
        sb.from("contacts").select("id, nom, prenom").eq("entite_id", id),
      ]);
      const ops = (liens ?? []).map((l: any) => l.operations).filter(Boolean);
      const sections = [
        { titre: "Opérations", icon: "operation", items: ops.map((o: any) => ({ type: "operation", id: o.id, cat: "op", label: o.nom })) },
        { titre: "Personnes à joindre", icon: "personne", items: (contacts ?? []).map((c: any) => ({ type: "personne", id: c.id, cat: "pers", label: [c.prenom, c.nom].filter(Boolean).join(" ") || c.nom })) },
      ].filter((s) => s.items.length);
      // Relances en cours rattachées à la structure : proposées à la suppression.
      const { data: rel } = await sb.from("relances").select("id, objet").eq("entite_id", id).eq("statut", "a_faire");
      const aSupprimer = (rel ?? []).map((r: any) => ({ type: "relance", id: r.id, cat: "rel", label: r.objet }));
      return NextResponse.json({
        cat: "struct", catLabel: "Structure", nom: (e as any).nom,
        meta: [TYPE_ENTITE[(e as any).type] ?? (e as any).type, (e as any).ville].filter(Boolean).join(" · "),
        href: `/entites/${id}`, sections, aSupprimer,
      });
    }

    if (type === "operation") {
      const { data: o } = await sb.from("operations").select("id, nom, statut, montant_estime").eq("id", id).maybeSingle();
      if (!o) return NextResponse.json({ error: "introuvable" }, { status: 404 });
      const { data: liens } = await sb.from("entite_operation").select("entites(id, nom)").eq("operation_id", id);
      const structs = (liens ?? []).map((l: any) => l.entites).filter(Boolean);
      const sections = [
        { titre: "Structures", icon: "structure", items: structs.map((s: any) => ({ type: "entite", id: s.id, cat: "struct", label: s.nom })) },
      ].filter((s) => s.items.length);
      // Relances en cours rattachées à l'opération : proposées à la suppression.
      const { data: rel } = await sb.from("relances").select("id, objet").eq("operation_id", id).eq("statut", "a_faire");
      const aSupprimer = (rel ?? []).map((r: any) => ({ type: "relance", id: r.id, cat: "rel", label: r.objet }));
      return NextResponse.json({
        cat: "op", catLabel: "Opération", nom: (o as any).nom,
        meta: STATUT_LABELS[(o as any).statut as keyof typeof STATUT_LABELS] ?? (o as any).statut,
        href: `/operations/${id}`, sections, aSupprimer,
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
      return NextResponse.json({
        cat: "pers", catLabel: "Personne", nom: [cc.prenom, cc.nom].filter(Boolean).join(" ") || cc.nom,
        meta: cc.fonction ?? "", href: `/personnes/${id}`, sections,
      });
    }

    return NextResponse.json({ error: "type inconnu" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erreur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
