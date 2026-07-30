"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createCr, finaliserBrouillon, supprimerBrouillon, enregistrerBrouillonDictee } from "@/lib/actions";
import type { Synthese } from "@/lib/synthese";
import { STATUT_LABELS, STATUT_ORDRE } from "@/lib/types";
import SubmitButton from "@/components/SubmitButton";

// Couleur d'étape (variables CSS de globals.css), pour le signet de phase.
const STATUT_VAR_CR: Record<string, string> = {
  piste: "--s-piste", qualifie: "--s-qualifie", concours: "--s-concours", a_chiffrer: "--s-chiffrer",
  offre_remise: "--s-offre", nego: "--s-nego", gagne: "--s-gagne", perdu: "--s-perdu",
};

type Opt = { id: string; nom: string };
type Ent = { id: string; nom: string; type?: string };
type ContactBase = { nom: string; prenom: string | null; entiteNom?: string | null };

// Rattachement unifié : une structure OU une opération (bascule possible).
// `type` = type de structure (MOA/archi/promoteur/confrere/autre), pour une
// nouvelle structure à créer.
type Rattach = { kind: "structure" | "operation"; name: string; type?: string; entite?: string; statut?: string; ville?: string | null };

const TYPE_STRUCTURE = [
  { v: "MOA", l: "MOA" },
  { v: "archi", l: "Architecte" },
  { v: "promoteur", l: "Promoteur" },
  { v: "bet", l: "BET" },
  { v: "confrere", l: "Confrère" },
  { v: "autre", l: "Autre" },
];
const LABEL_TYPE: Record<string, string> = Object.fromEntries(TYPE_STRUCTURE.map((t) => [t.v, t.l]));

// Icônes monochromes épurées (trait fin, couleur = celle de la catégorie).
function Icon({ name }: { name: "structure" | "operation" | "personne" | "relance" }) {
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, className: "ic" } as const;
  if (name === "structure")
    return <svg {...p}><path d="M4 21V4h10v17M14 9h6v12M7 8h1M7 12h1M7 16h1M11 8h1M11 12h1M11 16h1M17 13h1M17 17h1" /></svg>;
  if (name === "operation")
    return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
  if (name === "personne")
    return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>;
  return <svg {...p}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
}
type PersonneEdit = { prenom: string; nom: string; fonction: string; entite: string; operations?: string[] };
type RelanceEdit = { objet: string; date: string; personne: string; operation?: string; entite?: string };

const TYPES_RDV = [
  { v: "dejeuner", l: "Déjeuner" },
  { v: "appel", l: "Appel" },
  { v: "visite", l: "Visite" },
  { v: "salon", l: "Salon" },
  { v: "autre", l: "Autre" },
];

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  if (typeof MediaRecorder === "undefined") return "";
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  try {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function diffDays(fromIso: string, toIso: string): number {
  try {
    const a = new Date(fromIso + "T00:00:00").getTime();
    const b = new Date(toIso + "T00:00:00").getTime();
    return Math.max(1, Math.round((b - a) / 86400000));
  } catch {
    return 14;
  }
}

function dateCourt(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

function dedupRattach(list: Rattach[]): Rattach[] {
  const seen = new Set<string>();
  const out: Rattach[] = [];
  for (const r of list) {
    const k = `${r.kind}|${r.name.trim().toLowerCase()}`;
    if (!r.name.trim() || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export default function VoiceCr({
  entites,
  operations,
  today,
  contactsBase = [],
  membres = [],
  opsAvecRelance = [],
  prefillEntite,
  prefillOperation,
  relanceId,
  draftId,
  initialTranscription,
  initialSynthese,
  piecesInfo = null,
}: {
  entites: Ent[];
  operations: Opt[];
  today: string;
  contactsBase?: ContactBase[];
  membres?: string[];
  opsAvecRelance?: string[];
  prefillEntite?: string;
  prefillOperation?: string;
  relanceId?: string;
  draftId?: string;
  initialTranscription?: string;
  initialSynthese?: Synthese | null;
  piecesInfo?: { count: number; journal: string[] } | null;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const [busy, setBusy] = useState<null | "transcribe" | "synth">(null);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState(initialTranscription ?? "");
  const [synthese, setSynthese] = useState<Synthese | null>(null);

  const [typeRdv, setTypeRdv] = useState("autre");
  const [dateRdv, setDateRdv] = useState(today);

  // Blocs éditables.
  const initRattach: Rattach[] = [];
  if (prefillOperation) {
    const o = operations.find((x) => x.id === prefillOperation);
    if (o) initRattach.push({ kind: "operation", name: o.nom });
  }
  if (prefillEntite) {
    const e = entites.find((x) => x.id === prefillEntite);
    if (e) initRattach.push({ kind: "structure", name: e.nom });
  }
  const [rattachements, setRattachements] = useState<Rattach[]>(initRattach);
  const [personnes, setPersonnes] = useState<PersonneEdit[]>([]);
  const [relances, setRelances] = useState<RelanceEdit[]>([]);
  // Affaires (ou cas général) pour lesquelles l'utilisateur a répondu « pas
  // nécessaire » à la proposition de relance — pour ne plus l'ennuyer.
  const [relancesIgnorees, setRelancesIgnorees] = useState<Set<string>>(new Set());
  const ignorerRelance = (cle: string) => setRelancesIgnorees((s) => new Set(s).add(cle));
  // Carte ouverte au clic sur un signet (overlay). S'ouvre en AFFICHAGE ;
  // on passe en édition via le bouton « Modifier ».
  const [openCard, setOpenCard] = useState<{ cat: "rat" | "pers" | "rel" | "reperes"; i: number } | null>(null);
  const [cardMode, setCardMode] = useState<"view" | "edit">("view");
  const fermerCarte = () => setOpenCard(null);
  const ouvrirCarte = (cat: "rat" | "pers" | "rel" | "reperes", i: number, mode: "view" | "edit" = "view") => {
    setCardMode(mode);
    setOpenCard({ cat, i });
  };
  // Taper un élément le déplie EN PLACE ; re-taper le referme (dépliage cohérent
  // avec le reste de l'outil, plus de volet en surimpression).
  const basculerCarte = (cat: "rat" | "pers" | "rel" | "reperes", i: number) => {
    if (openCard && openCard.cat === cat && openCard.i === i) fermerCarte();
    else ouvrirCarte(cat, i);
  };
  // Éditeur en place d'un bloc (rendu sous les puces du bloc concerné).
  const editeurEnPlace = () =>
    openCard ? (
      <div className="cr-edit">
        <button type="button" className="cr-edit-close" onClick={fermerCarte}>Replier ▲</button>
        {carteContenu()}
      </div>
    ) : null;

  // Chat de correction.
  const [instr, setInstr] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [instrRec, setInstrRec] = useState<"idle" | "recording">("idle");

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const instrRecRef = useRef<MediaRecorder | null>(null);
  const instrChunksRef = useRef<BlobPart[]>([]);
  const pipelineRef = useRef<(b: Blob) => void>(() => {});

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopTimer();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, [audioUrl]);

  // Mode brouillon : applique une fois la synthèse déjà calculée.
  useEffect(() => {
    if (draftId && initialSynthese) applySynthese(initialSynthese, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        stream.getTracks().forEach((t) => t.stop());
        pipelineRef.current(blob);
      };
      recRef.current = rec;
      rec.start();
      setSeconds(0);
      setPhase("recording");
      stopTimer();
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Micro inaccessible. Vérifiez l'autorisation du navigateur, ou écrivez le compte rendu à la main ci-dessous.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    stopTimer();
    recRef.current?.stop();
    setPhase("recorded");
  }, []);

  const resetAudio = useCallback(() => {
    stopTimer();
    setPhase("idle");
    setSeconds(0);
    setAudioBlob(null);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  async function doTranscribe(blob: Blob): Promise<string | null> {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "enregistrement");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transcription impossible.");
        return null;
      }
      return (data.text ?? "").trim();
    } catch {
      setError("Transcription indisponible. Écrivez le compte rendu à la main.");
      return null;
    }
  }

  // Applique une synthèse aux blocs. `authoritative` (correction) remplace ;
  // sinon (analyse initiale) on fusionne les rattachements avec l'existant.
  function applySynthese(s: Synthese, authoritative: boolean) {
    setSynthese(s);
    setTypeRdv(s.type_rdv || "autre");
    if (s.date_rdv) setDateRdv(s.date_rdv);
    // Changement de phase proposé pour une opération EXISTANTE (« a été chiffrée »
    // → nouveau statut) : on l'accroche à l'opération connue correspondante.
    const chgPhase = new Map<string, string>();
    for (const c of ((s as any).changements_phase ?? []) as { operation: string; phase: string }[]) {
      if (c?.operation && c?.phase) chgPhase.set(c.operation.trim().toLowerCase(), c.phase);
    }
    // Ville proposée pour une opération EXISTANTE dont la commune manquait (« ✕ ») :
    // on l'accroche au rattachement de l'affaire connue (elle complètera le titre).
    const chgVille = new Map<string, string>();
    for (const c of ((s as any).changements_ville ?? []) as { operation: string; ville: string }[]) {
      if (c?.operation && c?.ville) chgVille.set(c.operation.trim().toLowerCase(), c.ville);
    }
    const rats: Rattach[] = [
      ...(s.entites ?? []).map((n) => ({ kind: "structure" as const, name: n })),
      ...(s.operations ?? []).map((n) => ({ kind: "operation" as const, name: n, statut: chgPhase.get(n.trim().toLowerCase()), ville: chgVille.get(n.trim().toLowerCase()) ?? null })),
      ...(s.nouvelles_entites ?? []).map((e) => ({ kind: "structure" as const, name: e.nom, type: e.type })),
      ...(s.nouvelles_operations ?? []).map((o) => ({ kind: "operation" as const, name: o.nom, entite: (o as any).entite ?? undefined, statut: (o as any).phase ?? undefined, ville: (o as any).ville ?? null })),
    ];
    setRattachements((prev) => dedupRattach(authoritative ? rats : [...prev, ...rats]));
    // Filet de sécurité : ne jamais proposer un membre de l'équipe (Administration)
    // comme contact à créer — il est reconnu, mais géré côté utilisateurs.
    const membreSet = new Set(membres.map((m) => m.trim().toLowerCase()));
    const estMembre = (prenom: string, nom: string) => {
      const full = [prenom, nom].filter(Boolean).join(" ").trim().toLowerCase();
      if (full && membreSet.has(full)) return true;
      const p = prenom.trim().toLowerCase();
      const n = nom.trim().toLowerCase();
      return membres.some((m) => { const mn = m.toLowerCase(); return p && n && mn.includes(p) && mn.includes(n); });
    };
    // Vrai si un nom complet (ex. « Florian Colomar ») correspond à un membre du
    // groupement. Sert à ne garder QUE des membres comme responsable de relance.
    const estMembreNom = (nom: string) => {
      const s = nom.trim().toLowerCase();
      if (!s) return false;
      if (membreSet.has(s)) return true;
      const mots = s.split(/\s+/).filter(Boolean);
      return mots.length > 0 && membres.some((m) => { const mn = m.toLowerCase(); return mots.every((w) => mn.includes(w)); });
    };
    setPersonnes(
      (s.contacts ?? [])
        .filter((c) => !estMembre(c.prenom ?? "", c.nom))
        .map((c) => ({
          prenom: c.prenom ?? "",
          nom: c.nom,
          fonction: c.fonction ?? "",
          entite: c.entite ?? "",
          operations: Array.isArray((c as any).operations) ? (c as any).operations : [],
        })),
    );
    // On ignore une suite proposée par l'IA si l'affaire concernée a DÉJÀ une
    // relance en cours (mise à jour d'une fiche → pas de doublon).
    const dejaRelance = new Set(opsAvecRelance.map((n) => n.trim().toLowerCase()));
    setRelances(
      (s.relances ?? [])
        .filter((r) => !((r as any).operation && dejaRelance.has(String((r as any).operation).trim().toLowerCase())))
        .map((r) => ({
          objet: r.objet,
          date: addDays(today, r.dans_jours),
          // Responsable = membre du groupement uniquement : on écarte tout
          // prospect que l'IA aurait mis là (il est la cible, pas le responsable).
          personne: (r.personne ?? "").split(",").map((x) => x.trim()).filter((x) => x && estMembreNom(x)).join(", "),
          operation: (r as any).operation ?? undefined,
          entite: (r as any).entite ?? undefined,
        })),
    );
  }

  async function doSynth(text: string): Promise<void> {
    try {
      const res = await fetch("/api/synthese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription: text,
          entites: entites.map((e) => e.nom),
          operations: operations.map((o) => o.nom),
          contacts: contactsConnus,
          membres,
          today,
          draftId, // brouillon : inclut la photo conservée dans l'analyse
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Synthèse impossible.");
        return;
      }
      applySynthese(data.synthese as Synthese, false);
    } catch {
      setError("Synthèse indisponible.");
    }
  }

  async function applyCorrection(instruction: string): Promise<void> {
    if (!instruction.trim() || !synthese || correcting) return;
    setCorrecting(true);
    setError(null);
    try {
      const res = await fetch("/api/affiner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription,
          synthese,
          instruction,
          entites: entites.map((e) => e.nom),
          operations: operations.map((o) => o.nom),
          contacts: contactsConnus,
          today,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Correction impossible.");
      } else {
        applySynthese(data.synthese as Synthese, true);
        setInstr("");
      }
    } catch {
      setError("Correction indisponible.");
    } finally {
      setCorrecting(false);
    }
  }

  async function startInstrRec() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      instrChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) instrChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(instrChunksRef.current, { type: rec.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setCorrecting(true);
        const text = await doTranscribe(blob);
        if (text && text.trim()) await applyCorrection(text);
        else setCorrecting(false);
      };
      instrRecRef.current = rec;
      rec.start();
      setInstrRec("recording");
    } catch {
      setError("Micro inaccessible pour la correction. Écrivez la consigne à la place.");
    }
  }

  function stopInstrRec() {
    instrRecRef.current?.stop();
    setInstrRec("idle");
  }

  async function runPipeline(blob: Blob) {
    setError(null);
    setBusy("transcribe");
    const text = await doTranscribe(blob);
    if (text == null || !text.trim()) {
      setBusy(null);
      return;
    }
    setTranscription(text);
    setBusy("synth");
    await doSynth(text);
    setBusy(null);
  }
  pipelineRef.current = runPipeline;

  async function synthesizeManuel() {
    if (!transcription.trim() || busy) return;
    setError(null);
    setBusy("synth");
    await doSynth(transcription);
    setBusy(null);
  }

  // --- Dérivés pour l'envoi + les badges « en base / à créer ».
  const entNameSet = new Set(entites.map((e) => e.nom.toLowerCase()));
  const opNameSet = new Set(operations.map((o) => o.nom.toLowerCase()));
  const entIdByNom = new Map(entites.map((e) => [e.nom.toLowerCase(), e.id]));
  const entTypeByNom = new Map(entites.map((e) => [e.nom.toLowerCase(), e.type ?? "autre"]));
  const opIdByNom = new Map(operations.map((o) => [o.nom.toLowerCase(), o.id]));
  const contactSet = new Set(
    contactsBase.map((c) => `${(c.nom ?? "").toLowerCase()}|${(c.prenom ?? "").toLowerCase()}`),
  );
  // Personnes déjà connues (« Prénom Nom ») transmises à l'IA pour qu'elle
  // reconnaisse quelqu'un cité par son seul prénom et reprenne son identité
  // exacte. On mélange les contacts rencontrés ET l'équipe (Administration).
  // On accole à chaque contact connu le nom de SA structure (« Prénom Nom —
  // Structure ») : l'IA peut ainsi ramener la bonne structure quand la personne
  // est évoquée, même si le nom de la structure n'est pas prononcé.
  const contactsConnus = Array.from(
    new Set(
      [
        ...contactsBase.map((c) => {
          const nom = [c.prenom, c.nom].filter(Boolean).join(" ").trim();
          return c.entiteNom && c.entiteNom.trim() ? `${nom} — ${c.entiteNom.trim()}` : nom;
        }),
        ...membres,
      ].filter(Boolean),
    ),
  );

  const ratEnBase = (r: Rattach) =>
    r.kind === "structure" ? entNameSet.has(r.name.trim().toLowerCase()) : opNameSet.has(r.name.trim().toLowerCase());
  const persEnBase = (p: PersonneEdit) => contactSet.has(`${p.nom.trim().toLowerCase()}|${p.prenom.trim().toLowerCase()}`);

  const ratsNets = rattachements.filter((r) => r.name.trim());
  const entiteIds = ratsNets
    .filter((r) => r.kind === "structure" && entIdByNom.has(r.name.trim().toLowerCase()))
    .map((r) => entIdByNom.get(r.name.trim().toLowerCase())!);
  const operationIds = ratsNets
    .filter((r) => r.kind === "operation" && opIdByNom.has(r.name.trim().toLowerCase()))
    .map((r) => opIdByNom.get(r.name.trim().toLowerCase())!);
  const nouvellesEntites = ratsNets
    .filter((r) => r.kind === "structure" && !entNameSet.has(r.name.trim().toLowerCase()))
    .map((r) => ({ nom: r.name.trim(), type: r.type ?? "autre" }));
  const nouvellesOperations = ratsNets
    .filter((r) => r.kind === "operation" && !opNameSet.has(r.name.trim().toLowerCase()))
    .map((r) => ({ nom: r.name.trim(), entite: r.entite?.trim() || null, statut: r.statut || null, ville: r.ville?.trim() || null }));
  // Changements de phase d'affaires EXISTANTES (statut proposé sur une opération
  // déjà en base) : appliqués à la consolidation.
  const changementsPhase = ratsNets
    .filter((r) => r.kind === "operation" && r.statut && opNameSet.has(r.name.trim().toLowerCase()))
    .map((r) => ({ operation: r.name.trim(), phase: r.statut as string }));
  // Villes renseignées après coup pour des affaires EXISTANTES (libellé « ✕ ») :
  // appliquées à la consolidation (mise à jour de la ville + du titre).
  const changementsVille = ratsNets
    .filter((r) => r.kind === "operation" && r.ville && r.ville.trim() && opNameSet.has(r.name.trim().toLowerCase()))
    .map((r) => ({ operation: r.name.trim(), ville: r.ville!.trim() }));
  // Rapproche une référence d'affaire (parfois abrégée par l'IA) du LIBELLÉ EXACT
  // d'une opération (rattachement du CR ou opération connue) : le lien contact ↔
  // opération se fera ainsi sur un nom exact, fiable.
  const normL = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const matchOp = (a: string, ref: string) => {
    const t = normL(a), n = normL(ref);
    return !!t && !!n && (t === n || t.includes(n) || n.includes(t));
  };
  const opExact = (ref: string): string => {
    const rat = rattachements.find((r) => r.kind === "operation" && r.name.trim() && matchOp(r.name, ref));
    if (rat) return rat.name.trim();
    const known = operations.find((o) => matchOp(o.nom, ref));
    return known ? known.nom : (ref ?? "").trim();
  };
  const contactsPayload = personnes
    .filter((p) => p.nom.trim())
    .map((p) => ({
      nom: p.nom.trim(),
      prenom: p.prenom.trim() || null,
      fonction: p.fonction.trim() || null,
      entite: p.entite.trim() || null,
      operations: Array.from(new Set((p.operations ?? []).map(opExact).filter(Boolean))),
    }));
  const relancesPayload = relances
    .filter((r) => r.objet.trim())
    .map((r) => ({ objet: r.objet.trim(), dans_jours: diffDays(today, r.date), personne: r.personne.trim() || null, operation: r.operation?.trim() || null, entite: r.entite?.trim() || null }));
  // Liens affaire ↔ structure : ceux portés directement par chaque opération
  // (entite du rattachement, le plus fiable) + ceux proposés par l'IA. On ne
  // filtre PAS par nom ici : materialiserCr revalide chaque lien contre les
  // objets réellement présents dans le CR (rien perdu pour un nom un peu différent).
  const liensDesOps = ratsNets
    .filter((r) => r.kind === "operation" && r.name.trim() && r.entite?.trim())
    .map((r) => ({ operation: r.name.trim(), entite: r.entite!.trim() }));
  const liensIA = (((synthese as any)?.liens ?? []) as { operation: string; entite: string }[])
    .filter((l) => l?.operation?.trim() && l?.entite?.trim())
    .map((l) => ({ operation: l.operation.trim(), entite: l.entite.trim() }));
  const liensPayload = [...liensDesOps, ...liensIA];
  const syntheseOut = { ...(synthese ?? {}), relances: relancesPayload };

  // Instantané complet de l'état ÉDITÉ (rattachements, personnes, relances,
  // villes, phases…) : stocké tel quel dans un brouillon pour tout restaurer à la
  // réouverture — sans quoi seules les données brutes de l'IA seraient conservées
  // et les corrections faites au débrief seraient perdues.
  const brouillonSnapshot = {
    ...(synthese ?? {}),
    type_rdv: typeRdv,
    date_rdv: dateRdv,
    entites: ratsNets.filter((r) => r.kind === "structure" && entNameSet.has(r.name.trim().toLowerCase())).map((r) => r.name.trim()),
    operations: ratsNets.filter((r) => r.kind === "operation" && opNameSet.has(r.name.trim().toLowerCase())).map((r) => r.name.trim()),
    nouvelles_entites: nouvellesEntites,
    nouvelles_operations: nouvellesOperations.map((o) => ({ nom: o.nom, entite: o.entite, ville: o.ville, phase: o.statut ?? "piste" })),
    liens: liensPayload,
    referents: (synthese as any)?.referents ?? [],
    changements_phase: changementsPhase,
    changements_ville: changementsVille,
    contacts: contactsPayload,
    relances: relancesPayload,
  };

  const canSave = transcription.trim().length > 0 && ratsNets.length > 0;

  // Débrief de fin de dictée : ce qui manque pour que chaque signet soit complet.
  // Nouvelles structures sans type précis, personnes sans fonction, opérations
  // sans structure de rattachement.
  const structAPreciser = rattachements
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.kind === "structure" && r.name.trim() && !ratEnBase(r) && (!r.type || r.type === "autre"));
  // Personnes sans fonction — SAUF celles déjà en base (leur fonction est déjà
  // renseignée dans l'outil : ne pas la redemander).
  const persAPreciser = personnes
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.nom.trim() && !p.fonction.trim() && !persEnBase(p));
  const opsSansStruct =
    rattachements.some((r) => r.kind === "operation" && r.name.trim()) &&
    !rattachements.some((r) => r.kind === "structure" && r.name.trim());
  // Une relance doit toujours être assortie d'une (ou plusieurs) personne(s).
  const relSansPersonne = relances.map((r, i) => ({ r, i })).filter(({ r }) => r.objet.trim() && !r.personne.trim());
  // Toutes les relances nommées : on affiche le choix des personnes (multiple)
  // dans le débrief tant qu'il est ouvert, pour pouvoir en attribuer plusieurs.
  const relancesAvecObjet = relances.map((r, i) => ({ r, i })).filter(({ r }) => r.objet.trim());
  // Exhaustivité des suites à donner : CHAQUE affaire du compte rendu doit avoir
  // une relance. On liste les opérations sans relance qui la concerne (par le
  // champ operation ou par mention dans l'objet), non déjà « ignorées ».
  // Le responsable d'une relance (« qui doit s'occuper de… ») est TOUJOURS un
  // membre du groupement (jamais un prospect externe). On ne préremplit donc
  // aucun prospect par défaut : l'utilisateur choisit le membre au débrief.
  const persDefaut = "";
  const opsNets = Array.from(
    new Map(
      rattachements.filter((r) => r.kind === "operation" && r.name.trim()).map((r) => [r.name.trim().toLowerCase(), r.name.trim()]),
    ).values(),
  );
  const relanceCouvre = (opName: string) => {
    const on = opName.toLowerCase();
    return relances.some((rel) => (rel.operation && rel.operation.trim().toLowerCase() === on) || rel.objet.toLowerCase().includes(on));
  };
  const dejaRelanceSet = new Set(opsAvecRelance.map((n) => n.trim().toLowerCase()));
  const opsSansRelance = opsNets.filter(
    (nom) => !relanceCouvre(nom) && !relancesIgnorees.has(nom.toLowerCase()) && !dejaRelanceSet.has(nom.trim().toLowerCase()),
  );
  const ajouterRelancePourOp = (opName: string, jours: number) => {
    // Libellé court et propre pour l'objet : on prend le « Client » (1ʳᵉ partie du
    // titre « Client - Ville - Nature ») plutôt que le titre complet — évite d'y
    // figer une croix « ✕ » quand la ville n'est pas encore connue. L'affaire
    // reste rattachée par son nom exact (champ operation).
    const client = opName.split(" - ")[0].trim() || opName;
    setRelances((rr) => [...rr, { objet: `Relancer ${client}`, date: addDays(today, jours), personne: persDefaut, operation: opName }]);
  };
  // Cas sans aucune opération : proposition générique (une seule fois).
  const sujetGenerique =
    rattachements.find((r) => r.kind === "structure" && r.name.trim())?.name.trim() || persDefaut || "";
  const pasDeRelanceGenerique =
    opsNets.length === 0 && relances.every((r) => !r.objet.trim()) && !relancesIgnorees.has("__generique__");
  const ajouterRelanceGenerique = (jours: number) => {
    const objet = sujetGenerique ? `Recontacter ${sujetGenerique}` : "Recontacter";
    const ent = rattachements.find((r) => r.kind === "structure" && r.name.trim())?.name.trim();
    setRelances((rr) => [...rr, { objet, date: addDays(today, jours), personne: persDefaut, entite: ent }]);
  };
  // Personnes à proposer pour « qui doit s'occuper de… » : UNIQUEMENT les membres
  // du groupement (équipe interne). Un prospect externe ne « s'occupe » jamais
  // d'une relance — il en est la cible, pas le responsable.
  const candidatsPersonne = Array.from(new Set(membres.filter(Boolean)));
  // Opérations nouvelles sans commune : on demande où se situe le projet (la
  // ville est un signet à part entière, et complète le titre « Client - Ville - … »).
  // On demande la commune pour : les affaires NOUVELLES sans ville, ET les
  // affaires EXISTANTES dont le libellé porte encore « ✕ » (ville jamais saisie).
  const opsSansVille = rattachements
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.kind === "operation" && r.name.trim() && !(r.ville && r.ville.trim()) &&
      (!ratEnBase(r) || r.name.includes("✕")));
  // Le lien contact ↔ affaire proposé par l'IA est appliqué directement (via
  // contactsPayload) : plus de confirmation par signet à cocher au débrief — on
  // n'en avait pas le besoin.
  const aCompleter = structAPreciser.length > 0 || persAPreciser.length > 0 || opsSansStruct || relSansPersonne.length > 0 || opsSansRelance.length > 0 || pasDeRelanceGenerique || opsSansVille.length > 0;

  // Mises à jour des blocs.
  const majRat = (i: number, patch: Partial<Rattach>) =>
    setRattachements((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  // Renseigne la ville d'une opération ET remplace le « ✕ » de la ville dans son
  // libellé « Client - Ville - Nature » (la ville est la 2ᵉ partie).
  const majVille = (i: number, ville: string) =>
    setRattachements((prev) =>
      prev.map((x, j) => {
        if (j !== i) return x;
        const v = ville.trim();
        let name = x.name;
        // Opération EXISTANTE (en base) : on NE renomme PAS le rattachement (son
        // libellé sert à retrouver l'affaire par son id) — la ville est envoyée à
        // part (changements_ville) et le titre est complété côté serveur.
        const existant = x.kind === "operation" && opNameSet.has(x.name.trim().toLowerCase());
        if (v && !existant) {
          const parts = x.name.split(" - ");
          if (parts.length === 3) { parts[1] = v; name = parts.join(" - "); }
          else if (x.name.includes("✕")) name = x.name.replace("✕", v);
        }
        return { ...x, ville: v || null, name };
      }),
    );
  const majPers = (i: number, patch: Partial<PersonneEdit>) =>
    setPersonnes((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const majRel = (i: number, patch: Partial<RelanceEdit>) =>
    setRelances((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // Une relance peut concerner PLUSIEURS personnes : le champ « personne » est une
  // liste de noms séparés par des virgules.
  const listePersonnes = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
  const aPersonne = (v: string, name: string) => listePersonnes(v).some((x) => x.toLowerCase() === name.trim().toLowerCase());
  const basculerPersonne = (i: number, name: string) =>
    setRelances((prev) => prev.map((r, j) => {
      if (j !== i) return r;
      const list = listePersonnes(r.personne);
      const k = list.findIndex((x) => x.toLowerCase() === name.trim().toLowerCase());
      if (k >= 0) list.splice(k, 1);
      else if (name.trim()) list.push(name.trim());
      return { ...r, personne: list.join(", ") };
    }));
  const retirerPersonne = (i: number, name: string) =>
    setRelances((prev) => prev.map((r, j) => (j === i ? { ...r, personne: listePersonnes(r.personne).filter((x) => x.toLowerCase() !== name.trim().toLowerCase()).join(", ") } : r)));

  // Petit signet cliquable, réutilisé dans les cartes pour les éléments associés.
  const opsRat = rattachements.map((r, idx) => ({ r, idx })).filter((x) => x.r.kind === "operation");
  const structRat = rattachements.map((r, idx) => ({ r, idx })).filter((x) => x.r.kind === "structure");
  // Rattachement affaire ↔ structure pour l'AFFICHAGE : chaque opération n'affiche
  // QUE sa/ses structure(s) (via l'entite du rattachement + les liens de l'IA), au
  // lieu de toutes. Miroir de la logique d'enregistrement (fini les 2 promoteurs).
  const normLbl = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
  const opStructNames = new Map<string, Set<string>>();
  const addAssoc = (op?: string, ent?: string) => {
    if (!op?.trim() || !ent?.trim()) return;
    const k = normLbl(op);
    if (!opStructNames.has(k)) opStructNames.set(k, new Set());
    opStructNames.get(k)!.add(ent.trim());
  };
  rattachements.filter((r) => r.kind === "operation" && r.entite).forEach((r) => addAssoc(r.name, r.entite));
  (((synthese as any)?.liens ?? []) as { operation: string; entite: string }[]).forEach((l) => addAssoc(l?.operation, l?.entite));
  const structsDeLop = (opName: string) => {
    const names = opStructNames.get(normLbl(opName));
    if (names && names.size) return structRat.filter((s) => [...names].some((n) => normLbl(n) === normLbl(s.r.name)));
    return structRat.length === 1 ? structRat : [];
  };
  const opsDeLaStruct = (structName: string) => {
    const matched = opsRat.filter((o) => {
      const names = opStructNames.get(normLbl(o.r.name));
      return names && [...names].some((n) => normLbl(n) === normLbl(structName));
    });
    return matched.length ? matched : structRat.length === 1 ? opsRat : [];
  };
  function AssocSignet({ label, kind, onClick }: { label: string; kind: string; onClick: () => void }) {
    return <button type="button" className={`sig-d ${kind}`} onClick={onClick}><span className="sig-lbl">{label || "—"}</span></button>;
  }
  function SectionAssoc({ titre, icon, children }: { titre: string; icon: any; children: React.ReactNode }) {
    return (
      <div className="carte-sect">
        <div className="carte-sect-h"><Icon name={icon} /> {titre}</div>
        <div className="sig-wrap">{children}</div>
      </div>
    );
  }

  // Contenu de la carte : affichage d'abord, édition via « Modifier ».
  function carteContenu() {
    if (!openCard) return null;
    const { cat, i } = openCard;
    const edit = cardMode === "edit";

    // --- Repères (uniquement en édition, pas de vue). ---
    if (cat === "reperes") {
      return (
        <>
          <div className="carte-top"><h2>Repères</h2></div>
          <div className="carte-body">
            <label className="field"><span className="lab">Date du rendez-vous</span>
              <input type="date" value={dateRdv} max={today} onChange={(e) => setDateRdv(e.target.value)} /></label>
            <label className="field"><span className="lab">Type de rendez-vous</span>
              <select value={typeRdv} onChange={(e) => setTypeRdv(e.target.value)}>
                {TYPES_RDV.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select></label>
            <div className="carte-foot"><button type="button" className="btn" onClick={fermerCarte}>OK</button></div>
          </div>
        </>
      );
    }

    // --- Structure / Opération. ---
    if (cat === "rat") {
      const r = rattachements[i];
      if (!r) return null;
      const enBase = ratEnBase(r);
      const structure = r.kind === "structure";
      const typeLbl = LABEL_TYPE[(enBase ? entTypeByNom.get(r.name.trim().toLowerCase()) : r.type) ?? "autre"];
      const persLiees = structure
        ? personnes.map((p, idx) => ({ p, idx })).filter((x) => x.p.entite.trim().toLowerCase() === r.name.trim().toLowerCase())
        : [];
      const head = (
        <div className="carte-top">
          <span className={`carte-cat ${structure ? "struct" : "op"}`}>
            <Icon name={structure ? "structure" : "operation"} /> {structure ? "Structure" : "Opération"}{structure ? ` · ${typeLbl}` : ""} · {enBase ? "en base" : "à créer"}
          </span>
          <h2 className="carte-nom-view">{r.name.trim() || "(à nommer)"}</h2>
        </div>
      );
      if (!edit) {
        return (
          <>{head}
            <div className="carte-body">
              {structure && persLiees.length > 0 && (
                <SectionAssoc titre="Personnes" icon="personne">
                  {persLiees.map(({ p, idx }) => (
                    <AssocSignet key={idx} kind="pers" label={[p.prenom, p.nom].filter(Boolean).join(" ")} onClick={() => ouvrirCarte("pers", idx)} />
                  ))}
                </SectionAssoc>
              )}
              {structure && opsDeLaStruct(r.name).length > 0 && (
                <SectionAssoc titre="Opérations" icon="operation">
                  {opsDeLaStruct(r.name).map(({ r: o, idx }) => <AssocSignet key={idx} kind="op" label={o.name} onClick={() => ouvrirCarte("rat", idx)} />)}
                </SectionAssoc>
              )}
              {!structure && structsDeLop(r.name).length > 0 && (
                <SectionAssoc titre="Structure" icon="structure">
                  {structsDeLop(r.name).map(({ r: s, idx }) => <AssocSignet key={idx} kind="struct" label={s.name} onClick={() => ouvrirCarte("rat", idx)} />)}
                </SectionAssoc>
              )}
              {/* Ville (commune) de l'affaire : signet à part entière ; ✕ si à compléter. */}
              {!structure && (
                <div className="carte-sect">
                  <div className="carte-sect-h"><Icon name="structure" /> Ville</div>
                  <div className="sig-wrap">
                    <span className={`sig-d ville${r.ville && r.ville.trim() ? "" : " vide"}`}>
                      <span className="sig-lbl">{r.ville && r.ville.trim() ? r.ville : "✕ à compléter"}</span>
                    </span>
                  </div>
                </div>
              )}
              {/* Phase de l'affaire : proposée par l'IA, modifiable avant de consolider.
                  Pour une affaire EXISTANTE, n'apparaît que si l'IA propose un
                  changement (« a été chiffrée » → nouvelle phase). */}
              {!structure && (!enBase || !!r.statut) && (
                <div className="carte-sect">
                  <div className="carte-sect-h"><Icon name="operation" /> {enBase ? "Changement de phase (proposé)" : "Phase de l'affaire"}</div>
                  <label className="phase-signet" style={{ ["--cat" as string]: `var(${STATUT_VAR_CR[r.statut ?? "piste"] ?? "--s-piste"})` }}>
                    <span className="phase-signet-dot" />
                    <span className="phase-signet-lbl">{STATUT_LABELS[(r.statut ?? "piste") as keyof typeof STATUT_LABELS]}</span>
                    <span className="phase-signet-chev">▾</span>
                    <select value={r.statut ?? "piste"} onChange={(e) => majRat(i, { statut: e.target.value })}>
                      {STATUT_ORDRE.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <p className="hint">L'historique complet de cette fiche (toutes ses opérations) apparaîtra dans le Réseau / Pipeline.</p>
              <div className="carte-foot">
                <button type="button" className="btn ghost mini danger" onClick={() => { setRattachements((p) => p.filter((_, j) => j !== i)); fermerCarte(); }}>Supprimer</button>
                <button type="button" className="btn" onClick={() => setCardMode("edit")}>Modifier</button>
              </div>
            </div>
          </>
        );
      }
      return (
        <>{head}
          <div className="carte-body">
            <input className="carte-nom" list={structure ? "dl-structures" : "dl-operations"} value={r.name} placeholder="Nom…" onChange={(e) => majRat(i, { name: e.target.value })} />
            <button type="button" className="btn ghost mini" onClick={() => majRat(i, { kind: structure ? "operation" : "structure" })}>Basculer en {structure ? "opération" : "structure"}</button>
            {structure && !enBase && (
              <label className="field"><span className="lab">Type de structure</span>
                <select value={r.type ?? "autre"} onChange={(e) => majRat(i, { type: e.target.value })}>
                  {TYPE_STRUCTURE.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select></label>
            )}
            {!structure && (
              <label className="field"><span className="lab">Ville (commune du projet)</span>
                <input value={r.ville ?? ""} placeholder="Ex. Poitiers, Roncq…" onChange={(e) => majVille(i, e.target.value)} /></label>
            )}
            <div className="carte-foot"><button type="button" className="btn" onClick={() => setCardMode("view")}>OK</button></div>
          </div>
        </>
      );
    }

    // --- Personne. ---
    if (cat === "pers") {
      const p = personnes[i];
      if (!p) return null;
      const enBase = persEnBase(p);
      const nomComplet = [p.prenom, p.nom].filter(Boolean).join(" ") || "(à nommer)";
      const head = (
        <div className="carte-top">
          <span className="carte-cat pers"><Icon name="personne" /> Personne · {enBase ? "en base" : "à créer"}</span>
          <h2 className="carte-nom-view">{nomComplet}</h2>
          {p.fonction.trim() && <div className="carte-meta">{p.fonction}</div>}
        </div>
      );
      if (!edit) {
        return (
          <>{head}
            <div className="carte-body">
              {p.entite.trim() && (() => {
                const si = structRat.find((x) => x.r.name.trim().toLowerCase() === p.entite.trim().toLowerCase());
                return (
                  <SectionAssoc titre="Structure" icon="structure">
                    {si
                      ? <AssocSignet kind="struct" label={p.entite} onClick={() => ouvrirCarte("rat", si.idx)} />
                      : <span className="sig-d struct" style={{ cursor: "default" }}><span className="sig-lbl">{p.entite}</span></span>}
                  </SectionAssoc>
                );
              })()}
              {opsRat.length > 0 && (
                <SectionAssoc titre="Opérations évoquées" icon="operation">
                  {opsRat.map(({ r: o, idx }) => <AssocSignet key={idx} kind="op" label={o.name} onClick={() => ouvrirCarte("rat", idx)} />)}
                </SectionAssoc>
              )}
              <div className="carte-foot">
                <button type="button" className="btn ghost mini danger" onClick={() => { setPersonnes((pp) => pp.filter((_, j) => j !== i)); fermerCarte(); }}>Supprimer</button>
                <button type="button" className="btn" onClick={() => setCardMode("edit")}>Modifier</button>
              </div>
            </div>
          </>
        );
      }
      return (
        <>{head}
          <div className="carte-body">
            <div className="carte-fields">
              <input className="pf" placeholder="Prénom" value={p.prenom} onChange={(e) => majPers(i, { prenom: e.target.value })} />
              <input className="pf" placeholder="Nom" value={p.nom} onChange={(e) => majPers(i, { nom: e.target.value })} />
            </div>
            <label className="field"><span className="lab">Fonction</span>
              <input value={p.fonction} placeholder="Fonction…" onChange={(e) => majPers(i, { fonction: e.target.value })} /></label>
            <label className="field"><span className="lab">Structure</span>
              <input list="dl-structures" value={p.entite} placeholder="Sa structure…" onChange={(e) => majPers(i, { entite: e.target.value })} /></label>
            <div className="carte-foot"><button type="button" className="btn" onClick={() => setCardMode("view")}>OK</button></div>
          </div>
        </>
      );
    }

    // --- Relance. ---
    if (cat === "rel") {
      const r = relances[i];
      if (!r) return null;
      const head = (
        <div className="carte-top">
          <span className="carte-cat rel"><Icon name="relance" /> Relance</span>
          <h2 className="carte-nom-view">{r.objet.trim() || "(à préciser)"}</h2>
          <div className="carte-meta">Échéance : {dateCourt(r.date)}</div>
        </div>
      );
      if (!edit) {
        return (
          <>{head}
            <div className="carte-body">
              {r.personne.trim() && (
                <SectionAssoc titre={listePersonnes(r.personne).length > 1 ? "Personnes concernées" : "Personne concernée"} icon="personne">
                  {listePersonnes(r.personne).map((nom) => {
                    const pi = personnes.findIndex((p) => [p.prenom, p.nom].filter(Boolean).join(" ").trim().toLowerCase() === nom.toLowerCase());
                    return pi >= 0
                      ? <AssocSignet key={nom} kind="pers" label={nom} onClick={() => ouvrirCarte("pers", pi)} />
                      : <span key={nom} className="sig-d pers" style={{ cursor: "default" }}><span className="sig-lbl">{nom}</span></span>;
                  })}
                </SectionAssoc>
              )}
              {(() => {
                // La relance n'affiche QUE l'affaire (et sa structure) qu'elle
                // concerne — pas toutes les opérations du compte rendu.
                const relOps = r.operation?.trim() ? opsRat.filter((o) => normLbl(o.r.name) === normLbl(r.operation!)) : [];
                const relStructs = relOps.length
                  ? structsDeLop(r.operation!)
                  : r.entite?.trim()
                    ? structRat.filter((s) => normLbl(s.r.name) === normLbl(r.entite!))
                    : [];
                return (
                  <>
                    {relStructs.length > 0 && (
                      <SectionAssoc titre="Structure" icon="structure">
                        {relStructs.map(({ r: s, idx }) => <AssocSignet key={idx} kind="struct" label={s.name} onClick={() => ouvrirCarte("rat", idx)} />)}
                      </SectionAssoc>
                    )}
                    {relOps.length > 0 && (
                      <SectionAssoc titre="Opération" icon="operation">
                        {relOps.map(({ r: o, idx }) => <AssocSignet key={idx} kind="op" label={o.name} onClick={() => ouvrirCarte("rat", idx)} />)}
                      </SectionAssoc>
                    )}
                  </>
                );
              })()}
              <div className="carte-foot">
                <button type="button" className="btn ghost mini danger" onClick={() => { setRelances((rr) => rr.filter((_, j) => j !== i)); fermerCarte(); }}>Supprimer</button>
                <button type="button" className="btn" onClick={() => setCardMode("edit")}>Modifier</button>
              </div>
            </div>
          </>
        );
      }
      return (
        <>{head}
          <div className="carte-body">
            <label className="field"><span className="lab">Action de suivi (sans le nom de la personne)</span>
              <input value={r.objet} placeholder="Ex. Rappeler pour la remise de l'offre" onChange={(e) => majRel(i, { objet: e.target.value })} /></label>
            <div className="field"><span className="lab">Personnes concernées</span>
              {listePersonnes(r.personne).length > 0 && (
                <div className="pers-chips">
                  {listePersonnes(r.personne).map((n) => (
                    <button type="button" className="sig-d pers on" key={n} onClick={() => retirerPersonne(i, n)}>
                      <span className="sig-lbl">{n} ✕</span>
                    </button>
                  ))}
                </div>
              )}
              <select
                value=""
                onChange={(e) => { const v = e.target.value; if (v && !aPersonne(r.personne, v)) basculerPersonne(i, v); }}
              >
                <option value="">＋ Ajouter une personne…</option>
                {candidatsPersonne.filter((n) => !aPersonne(r.personne, n)).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <label className="field"><span className="lab">Échéance</span>
              <input type="date" value={r.date} onChange={(e) => majRel(i, { date: e.target.value })} /></label>
            <div className="carte-foot"><button type="button" className="btn" onClick={() => setCardMode("view")}>OK</button></div>
          </div>
        </>
      );
    }
    return null;
  }

  return (
    <>
      {/* Listes de suggestions (choix OU saisie libre). */}
      <datalist id="dl-structures">{entites.map((e) => <option key={e.id} value={e.nom} />)}</datalist>
      <datalist id="dl-operations">{operations.map((o) => <option key={o.id} value={o.nom} />)}</datalist>
      <datalist id="dl-personnes">
        {Array.from(new Set([
          ...personnes.map((p) => [p.prenom, p.nom].filter(Boolean).join(" ").trim()),
          ...membres,
          ...contactsBase.map((c) => [c.prenom, c.nom].filter(Boolean).join(" ").trim()),
        ].filter(Boolean))).map((n, i) => <option key={i} value={n} />)}
      </datalist>

      {/* Capture vocale — masquée en mode brouillon. */}
      {!draftId && (
        <div className="card recorder">
          <div className="eyebrow">Dicter</div>
          {phase === "idle" && (
            <button type="button" className="rec-btn" onClick={startRecording}>
              <span className="rec-dot" /> Démarrer l'enregistrement
            </button>
          )}
          {phase === "recording" && (
            <div className="rec-live">
              <button type="button" className="rec-btn stop" onClick={stopRecording}>
                <span className="rec-sq" /> Terminé
              </button>
              <span className="rec-time tnum">● {mmss(seconds)}</span>
            </div>
          )}
          {phase === "recorded" && (
            <div className="rec-done">
              {busy === "transcribe" && <p className="proc">Transcription en cours…</p>}
              {busy === "synth" && <p className="proc">L'IA structure le compte rendu…</p>}
              {!busy && synthese && <p className="proc ok">✓ Analysé — relisez les blocs ci-dessous.</p>}
              <div className="rec-acts">
                {!busy && error && audioBlob && (
                  <button type="button" className="btn" onClick={() => runPipeline(audioBlob)}>Réessayer l'analyse</button>
                )}
                <button type="button" className="btn ghost" onClick={resetAudio} disabled={busy !== null}>Recommencer</button>
              </div>
            </div>
          )}
          <p className="hint">Vous pouvez aussi ignorer le micro et écrire directement le compte rendu ci-dessous.</p>
        </div>
      )}

      {error && <div className="card notice err">{error}</div>}

      <form action={draftId ? finaliserBrouillon : createCr} className="form">
        {relanceId && <input type="hidden" name="relance_id" value={relanceId} />}
        {draftId && <input type="hidden" name="cr_id" value={draftId} />}

        {/* Champs postés (dérivés des blocs). */}
        {entiteIds.map((id) => <input key={`e${id}`} type="hidden" name="entite_ids" value={id} />)}
        {operationIds.map((id) => <input key={`o${id}`} type="hidden" name="operation_ids" value={id} />)}
        <input type="hidden" name="nouvelles_entites_json" value={JSON.stringify(nouvellesEntites)} />
        <input type="hidden" name="nouvelles_operations_json" value={JSON.stringify(nouvellesOperations)} />
        <input type="hidden" name="liens_json" value={JSON.stringify(liensPayload)} />
        <input type="hidden" name="referents_json" value={JSON.stringify((synthese as any)?.referents ?? [])} />
        <input type="hidden" name="changements_phase_json" value={JSON.stringify(changementsPhase)} />
        <input type="hidden" name="changements_ville_json" value={JSON.stringify(changementsVille)} />
        <input type="hidden" name="contacts_json" value={JSON.stringify(contactsPayload)} />
        <input type="hidden" name="synthese_json" value={JSON.stringify(syntheseOut)} />
        <input type="hidden" name="brouillon_synthese_json" value={JSON.stringify(brouillonSnapshot)} />

        {/* Bloc — le compte rendu (texte). */}
        <div className="bloc">
          <h3>Compte rendu</h3>
          <textarea
            name="transcription"
            rows={draftId ? 6 : 7}
            required
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Le texte dicté apparaîtra ici — corrigez-le librement, ou écrivez directement."
          />
          <div className="synth-row">
            <button type="button" className="btn ia" onClick={synthesizeManuel} disabled={busy !== null || (!transcription.trim() && !(piecesInfo && piecesInfo.count > 0))}>
              {busy === "synth" ? "L'IA structure…" : synthese ? "✦ Relancer l'analyse" : "✦ Analyser avec l'IA"}
            </button>
          </div>
          {piecesInfo && (
            <p className="hint" style={{ marginTop: 8 }}>
              {piecesInfo.count > 0
                ? <>{piecesInfo.count} pièce(s) jointe(s) conservée(s) et transmise(s) à l'IA lors de l'analyse.</>
                : <>Aucune pièce jointe lisible n'a pu être conservée. Reçu de l'e-mail&nbsp;: {piecesInfo.journal.join(" · ") || "aucune pièce"}.</>}
            </p>
          )}
          {synthese?.resume && (
            <div className="resume">
              <p className="s-resume">{synthese.resume}</p>
              {synthese.points_cles.length > 0 && (
                <ul className="s-points">{synthese.points_cles.map((p, i) => <li key={i}>{p}</li>)}</ul>
              )}
            </div>
          )}
        </div>

        {/* Encart — repères (date + type). */}
        <div className="bloc">
          <div className="encart-h reperes">Repères</div>
          <div className="sig-wrap">
            <button type="button" className={`sig-d date${openCard?.cat === "reperes" ? " on" : ""}`} onClick={() => basculerCarte("reperes", 0)}>{dateCourt(dateRdv)}</button>
            <button type="button" className={`sig-d type${openCard?.cat === "reperes" ? " on" : ""}`} onClick={() => basculerCarte("reperes", 0)}>{TYPES_RDV.find((t) => t.v === typeRdv)?.l ?? "Type"}</button>
          </div>
          {openCard?.cat === "reperes" && editeurEnPlace()}
        </div>

        {/* Encart — structures. */}
        <div className="bloc">
          <div className="encart-h struct"><Icon name="structure" /> Structures</div>
          <div className="sig-wrap">
            {rattachements.map((r, i) => {
              if (r.kind !== "structure") return null;
              const enBase = ratEnBase(r);
              const typeLbl = LABEL_TYPE[(enBase ? entTypeByNom.get(r.name.trim().toLowerCase()) : r.type) ?? "autre"];
              return (
                <button type="button" className={`sig-d struct${openCard?.cat === "rat" && openCard.i === i ? " on" : ""}`} key={i} onClick={() => basculerCarte("rat", i)}>
                  <span className="sig-lbl">{r.name.trim() || "(à nommer)"}</span>
                  {typeLbl && <span className="sig-sub">{typeLbl}</span>}
                  <span className={`sig-badge ${enBase ? "base" : "new"}`}>{enBase ? "en base" : "à créer"}</span>
                </button>
              );
            })}
            <button type="button" className="sig-add" onClick={() => { setRattachements((p) => [...p, { kind: "structure", name: "" }]); ouvrirCarte("rat", rattachements.length, "edit"); }}>＋ Ajouter</button>
          </div>
          {openCard?.cat === "rat" && rattachements[openCard.i]?.kind === "structure" && editeurEnPlace()}
        </div>

        {/* Encart — opérations. */}
        <div className="bloc">
          <div className="encart-h op"><Icon name="operation" /> Opérations</div>
          <div className="sig-wrap">
            {rattachements.map((r, i) => {
              if (r.kind !== "operation") return null;
              const enBase = ratEnBase(r);
              return (
                <button type="button" className={`sig-d op${openCard?.cat === "rat" && openCard.i === i ? " on" : ""}`} key={i} onClick={() => basculerCarte("rat", i)}>
                  <span className="sig-lbl">{r.name.trim() || "(à nommer)"}</span>
                  <span className={`sig-badge ${enBase ? "base" : "new"}`}>{enBase ? "en base" : "à créer"}</span>
                </button>
              );
            })}
            <button type="button" className="sig-add" onClick={() => { setRattachements((p) => [...p, { kind: "operation", name: "" }]); ouvrirCarte("rat", rattachements.length, "edit"); }}>＋ Ajouter</button>
          </div>
          {openCard?.cat === "rat" && rattachements[openCard.i]?.kind === "operation" && editeurEnPlace()}
        </div>

        {/* Encart — personnes. */}
        <div className="bloc">
          <div className="encart-h pers"><Icon name="personne" /> Personnes</div>
          <div className="sig-wrap">
            {personnes.map((p, i) => {
              const nomComplet = [p.prenom, p.nom].filter(Boolean).join(" ") || "(à nommer)";
              const enBase = persEnBase(p);
              return (
                <button type="button" className={`sig-d pers${openCard?.cat === "pers" && openCard.i === i ? " on" : ""}`} key={i} onClick={() => basculerCarte("pers", i)}>
                  <span className="sig-lbl">{nomComplet}</span>
                  {p.entite.trim() && <span className="mini-sig">{p.entite}</span>}
                  <span className={`sig-badge ${enBase ? "base" : "new"}`}>{enBase ? "en base" : "à créer"}</span>
                </button>
              );
            })}
            <button type="button" className="sig-add" onClick={() => { setPersonnes((pp) => [...pp, { prenom: "", nom: "", fonction: "", entite: "" }]); ouvrirCarte("pers", personnes.length, "edit"); }}>＋ Ajouter</button>
          </div>
          {openCard?.cat === "pers" && editeurEnPlace()}
        </div>

        {/* Bloc — suites à donner. Une relance est une ACTION à faire, pas un
            signet (elle ne se recoupe pas d'une fiche à l'autre) : liste dédiée. */}
        <div className="bloc">
          <div className="encart-h rel"><Icon name="relance" /> Suites à donner</div>
          <ul className="rel-list">
            {relances.map((r, i) => (
              <li key={i} className="rel-item-wrap">
                <div className={`rel-item${openCard?.cat === "rel" && openCard.i === i ? " on" : ""}`}>
                  <button type="button" className="rel-item-main" onClick={() => basculerCarte("rel", i)}>
                    <span className="rel-item-obj">{r.objet.trim() || "(à préciser)"}</span>
                    {r.personne.trim() && <span className="rel-item-pers">{r.personne}</span>}
                  </button>
                  {/* Date cliquable : ouvre le calendrier natif pour la modifier. */}
                  <label className="rel-item-date" title="Modifier la date de la relance">
                    <span className="rel-item-date-lbl">{dateCourt(r.date)}</span>
                    <input type="date" value={r.date} onChange={(e) => majRel(i, { date: e.target.value })} />
                  </label>
                </div>
                {openCard?.cat === "rel" && openCard.i === i && editeurEnPlace()}
              </li>
            ))}
            <li>
              <button type="button" className="rel-add" onClick={() => { setRelances((rr) => [...rr, { objet: "", date: addDays(today, 30), personne: "" }]); ouvrirCarte("rel", relances.length, "edit"); }}>＋ Ajouter une relance</button>
            </li>
          </ul>
        </div>

        {/* Débrief — questions pour compléter les signets avant d'enregistrer. */}
        {synthese && aCompleter && (
          <div className="bloc apreciser">
            <div className="encart-h">À préciser</div>
            <p className="hint" style={{ marginTop: 0 }}>Quelques informations manquent pour des signets complets — vous pouvez répondre ici, ou enregistrer tel quel.</p>
            {opsSansRelance.map((nom) => (
              <div className="precise-row" key={` or-${nom}`}>
                <span className="precise-q">Quelle suite pour <strong>{nom}</strong> ? (chaque affaire doit avoir une relance)</span>
                <div className="precise-answer">
                  <button type="button" className="sig-d rel" onClick={() => ajouterRelancePourOp(nom, 7)}><span className="sig-lbl">Dans 1 semaine</span></button>
                  <button type="button" className="sig-d rel" onClick={() => ajouterRelancePourOp(nom, 15)}><span className="sig-lbl">Dans 15 jours</span></button>
                  <button type="button" className="sig-d rel" onClick={() => ajouterRelancePourOp(nom, 30)}><span className="sig-lbl">Dans 1 mois</span></button>
                  <button type="button" className="sig-d rel" onClick={() => ajouterRelancePourOp(nom, 90)}><span className="sig-lbl">Dans 3 mois</span></button>
                  <button type="button" className="btn ghost mini" onClick={() => ignorerRelance(nom.toLowerCase())}>Pas nécessaire</button>
                </div>
              </div>
            ))}
            {pasDeRelanceGenerique && (
              <div className="precise-row">
                <span className="precise-q">Aucune suite à donner. Quand faut-il recontacter{sujetGenerique ? <> <strong>{sujetGenerique}</strong></> : null} ?</span>
                <div className="precise-answer">
                  <button type="button" className="sig-d rel" onClick={() => ajouterRelanceGenerique(7)}><span className="sig-lbl">Dans 1 semaine</span></button>
                  <button type="button" className="sig-d rel" onClick={() => ajouterRelanceGenerique(15)}><span className="sig-lbl">Dans 15 jours</span></button>
                  <button type="button" className="sig-d rel" onClick={() => ajouterRelanceGenerique(30)}><span className="sig-lbl">Dans 1 mois</span></button>
                  <button type="button" className="sig-d rel" onClick={() => ajouterRelanceGenerique(90)}><span className="sig-lbl">Dans 3 mois</span></button>
                  <button type="button" className="btn ghost mini" onClick={() => ignorerRelance("__generique__")}>Pas nécessaire</button>
                </div>
              </div>
            )}
            {structAPreciser.map(({ r, i }) => (
              <label className="precise-row" key={`s${i}`}>
                <span className="precise-q">Quel type de structure est <strong>{r.name}</strong> ?</span>
                <select value={r.type ?? "autre"} onChange={(e) => majRat(i, { type: e.target.value })}>
                  {TYPE_STRUCTURE.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </label>
            ))}
            {opsSansStruct && (
              <div className="precise-row">
                <span className="precise-q">Cette opération n'a pas de structure (porte d'entrée).</span>
                <button type="button" className="btn ghost mini" onClick={() => { setRattachements((p) => [...p, { kind: "structure", name: "" }]); ouvrirCarte("rat", rattachements.length, "edit"); }}>Ajouter une structure</button>
              </div>
            )}
            {opsSansVille.map(({ r, i }) => (
              <label className="precise-row" key={`v${r.name}`}>
                <span className="precise-q">Où se situe <strong>{r.name}</strong> ? <em className="precise-hint">(commune du projet)</em></span>
                <input defaultValue={r.ville ?? ""} placeholder="Ex. Poitiers, Roncq…" onBlur={(e) => majVille(i, e.target.value)} />
              </label>
            ))}
            {relancesAvecObjet.map(({ r, i }) => (
              <div className="precise-row" key={`r${i}`}>
                <span className="precise-q">Qui doit s'occuper de <strong>{r.objet || "cette relance"}</strong> ? <em className="precise-hint">(plusieurs possibles)</em></span>
                <div className="precise-answer">
                  {candidatsPersonne.slice(0, 6).map((n) => (
                    <button type="button" className={`sig-d pers${aPersonne(r.personne, n) ? " on" : ""}`} key={n} onClick={() => basculerPersonne(i, n)}>
                      <span className="sig-lbl">{n}</span>
                    </button>
                  ))}
                  {listePersonnes(r.personne)
                    .filter((n) => !candidatsPersonne.some((c) => c.toLowerCase() === n.toLowerCase()))
                    .map((n) => (
                      <button type="button" className="sig-d pers on" key={n} onClick={() => retirerPersonne(i, n)}>
                        <span className="sig-lbl">{n} ✕</span>
                      </button>
                    ))}
                  <input
                    list="dl-personnes"
                    placeholder="ajouter un nom…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v) { if (!aPersonne(r.personne, v)) basculerPersonne(i, v); (e.target as HTMLInputElement).value = ""; }
                      }
                    }}
                  />
                </div>
              </div>
            ))}
            {persAPreciser.map(({ p, i }) => (
              <label className="precise-row" key={`p${i}`}>
                <span className="precise-q">Fonction de <strong>{[p.prenom, p.nom].filter(Boolean).join(" ")}</strong> ?</span>
                {/* Champ NON contrôlé (defaultValue + onBlur) : sinon, dès la 1ʳᵉ
                    lettre saisie la personne quitte la liste « sans fonction » et
                    le champ disparaît — impossible de taper la suite. */}
                <input defaultValue={p.fonction} placeholder="Ex. directeur, responsable aménagement…" onBlur={(e) => majPers(i, { fonction: e.target.value })} />
              </label>
            ))}
          </div>
        )}

        {/* Bloc — corriger en parlant. */}
        {synthese && (
          <div className="correct-box">
            <span className="lab">Corriger en parlant (ou en écrivant)</span>
            <div className="correct-row">
              <input
                className="correct-input"
                type="text"
                value={instr}
                onChange={(e) => setInstr(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCorrection(instr); } }}
                placeholder="Ex. « la date c'est mardi dernier », « enlève SIGH »…"
                disabled={correcting || instrRec === "recording"}
              />
              {instrRec === "recording" ? (
                <button type="button" className="btn mic on" onClick={stopInstrRec}>● Stop</button>
              ) : (
                <button type="button" className="btn ghost mic" onClick={startInstrRec} disabled={correcting} aria-label="Dicter la correction"></button>
              )}
              <button type="button" className="btn ia" onClick={() => applyCorrection(instr)} disabled={correcting || instrRec === "recording" || !instr.trim()}>Corriger</button>
            </div>
            {instrRec === "recording" && <p className="proc">J'écoute… tapez « Stop » quand c'est dit.</p>}
            {correcting && <p className="proc">Je corrige la fiche…</p>}
          </div>
        )}

        {draftId ? (
          <div className="form-foot">
            <SubmitButton className="btn ghost" formAction={supprimerBrouillon} formNoValidate pendingLabel="…">Supprimer</SubmitButton>
            <Link className="btn ghost" href="/crs/vocal">Passer (plus tard)</Link>
            <SubmitButton className="btn" disabled={!canSave} pendingLabel="Consolidation…">Valider et consolider</SubmitButton>
          </div>
        ) : (
          <div className="form-foot">
            {/* statut=valide : le bouton principal publie (createCr matérialise) ;
                « Mettre en brouillon » enregistre sans rien matérialiser. */}
            <input type="hidden" name="statut" value="valide" />
            <Link className="btn ghost" href={prefillOperation ? `/operations/${prefillOperation}` : "/tableau"}>Annuler</Link>
            <SubmitButton className="btn ghost" formAction={enregistrerBrouillonDictee} formNoValidate disabled={!transcription.trim()} pendingLabel="Brouillon…">Mettre en brouillon</SubmitButton>
            <SubmitButton className="btn" disabled={!canSave} pendingLabel="Enregistrement…">Enregistrer le compte rendu</SubmitButton>
          </div>
        )}
      </form>
    </>
  );
}
