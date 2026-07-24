"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createCr, finaliserBrouillon, supprimerBrouillon } from "@/lib/actions";
import type { Synthese } from "@/lib/synthese";

type Opt = { id: string; nom: string };
type Ent = { id: string; nom: string; type?: string };
type ContactBase = { nom: string; prenom: string | null };

// Rattachement unifié : une structure OU une opération (bascule possible).
// `type` = type de structure (MOA/archi/promoteur/confrere/autre), pour une
// nouvelle structure à créer.
type Rattach = { kind: "structure" | "operation"; name: string; type?: string };

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
type PersonneEdit = { prenom: string; nom: string; fonction: string; entite: string };
type RelanceEdit = { objet: string; date: string };

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
  prefillEntite,
  prefillOperation,
  relanceId,
  draftId,
  initialTranscription,
  initialSynthese,
}: {
  entites: Ent[];
  operations: Opt[];
  today: string;
  contactsBase?: ContactBase[];
  prefillEntite?: string;
  prefillOperation?: string;
  relanceId?: string;
  draftId?: string;
  initialTranscription?: string;
  initialSynthese?: Synthese | null;
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
  const [statut, setStatut] = useState("valide");

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
  // Carte ouverte au clic sur un signet (overlay). S'ouvre en AFFICHAGE ;
  // on passe en édition via le bouton « Modifier ».
  const [openCard, setOpenCard] = useState<{ cat: "rat" | "pers" | "rel" | "reperes"; i: number } | null>(null);
  const [cardMode, setCardMode] = useState<"view" | "edit">("view");
  const fermerCarte = () => setOpenCard(null);
  const ouvrirCarte = (cat: "rat" | "pers" | "rel" | "reperes", i: number, mode: "view" | "edit" = "view") => {
    setCardMode(mode);
    setOpenCard({ cat, i });
  };

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
    const rats: Rattach[] = [
      ...(s.entites ?? []).map((n) => ({ kind: "structure" as const, name: n })),
      ...(s.operations ?? []).map((n) => ({ kind: "operation" as const, name: n })),
      ...(s.nouvelles_entites ?? []).map((e) => ({ kind: "structure" as const, name: e.nom, type: e.type })),
      ...(s.nouvelles_operations ?? []).map((o) => ({ kind: "operation" as const, name: o.nom })),
    ];
    setRattachements((prev) => dedupRattach(authoritative ? rats : [...prev, ...rats]));
    setPersonnes(
      (s.contacts ?? []).map((c) => ({
        prenom: c.prenom ?? "",
        nom: c.nom,
        fonction: c.fonction ?? "",
        entite: c.entite ?? "",
      })),
    );
    setRelances((s.relances ?? []).map((r) => ({ objet: r.objet, date: addDays(today, r.dans_jours) })));
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
          today,
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
    .map((r) => ({ nom: r.name.trim() }));
  const contactsPayload = personnes
    .filter((p) => p.nom.trim())
    .map((p) => ({
      nom: p.nom.trim(),
      prenom: p.prenom.trim() || null,
      fonction: p.fonction.trim() || null,
      entite: p.entite.trim() || null,
    }));
  const relancesPayload = relances
    .filter((r) => r.objet.trim())
    .map((r) => ({ objet: r.objet.trim(), dans_jours: diffDays(today, r.date) }));
  const syntheseOut = { ...(synthese ?? {}), relances: relancesPayload };

  const canSave = transcription.trim().length > 0 && ratsNets.length > 0;

  // Mises à jour des blocs.
  const majRat = (i: number, patch: Partial<Rattach>) =>
    setRattachements((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const majPers = (i: number, patch: Partial<PersonneEdit>) =>
    setPersonnes((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const majRel = (i: number, patch: Partial<RelanceEdit>) =>
    setRelances((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // Petit signet cliquable, réutilisé dans les cartes pour les éléments associés.
  const opsRat = rattachements.map((r, idx) => ({ r, idx })).filter((x) => x.r.kind === "operation");
  const structRat = rattachements.map((r, idx) => ({ r, idx })).filter((x) => x.r.kind === "structure");
  function AssocSignet({ label, kind, onClick }: { label: string; kind: string; onClick: () => void }) {
    return <button type="button" className={`sig-d ${kind}`} onClick={onClick}>{label || "—"}</button>;
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
              {structure && opsRat.length > 0 && (
                <SectionAssoc titre="Opérations évoquées" icon="operation">
                  {opsRat.map(({ r: o, idx }) => <AssocSignet key={idx} kind="op" label={o.name} onClick={() => ouvrirCarte("rat", idx)} />)}
                </SectionAssoc>
              )}
              {!structure && structRat.length > 0 && (
                <SectionAssoc titre="Structures" icon="structure">
                  {structRat.map(({ r: s, idx }) => <AssocSignet key={idx} kind="struct" label={s.name} onClick={() => ouvrirCarte("rat", idx)} />)}
                </SectionAssoc>
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
              {p.entite.trim() && (
                <SectionAssoc titre="Structure" icon="structure">
                  <span className="sig-d struct" style={{ cursor: "default" }}>{p.entite}</span>
                </SectionAssoc>
              )}
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
            <label className="field"><span className="lab">Action de suivi</span>
              <input value={r.objet} placeholder="Ex. Rappeler…" onChange={(e) => majRel(i, { objet: e.target.value })} /></label>
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
              {audioUrl && <audio className="player" src={audioUrl} controls />}
              {busy === "transcribe" && <p className="proc">✍️ Transcription en cours…</p>}
              {busy === "synth" && <p className="proc">✨ L'IA structure le compte rendu…</p>}
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
        <input type="hidden" name="contacts_json" value={JSON.stringify(contactsPayload)} />
        <input type="hidden" name="synthese_json" value={JSON.stringify(syntheseOut)} />

        {/* Bloc — le compte rendu (texte). */}
        <div className="bloc">
          <h3>📝 Compte rendu</h3>
          <textarea
            name="transcription"
            rows={draftId ? 6 : 7}
            required
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Le texte dicté apparaîtra ici — corrigez-le librement, ou écrivez directement."
          />
          <div className="synth-row">
            <button type="button" className="btn ghost" onClick={synthesizeManuel} disabled={busy !== null || !transcription.trim()}>
              {busy === "synth" ? "L'IA structure…" : synthese ? "✨ Relancer l'analyse" : "✨ Analyser avec l'IA"}
            </button>
          </div>
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
          <div className="encart-h reperes">📌 Repères</div>
          <div className="sig-wrap">
            <button type="button" className="sig-d date" onClick={() => ouvrirCarte("reperes", 0, "edit")}>{dateCourt(dateRdv)}</button>
            <button type="button" className="sig-d type" onClick={() => ouvrirCarte("reperes", 0, "edit")}>{TYPES_RDV.find((t) => t.v === typeRdv)?.l ?? "Type"}</button>
          </div>
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
                <button type="button" className="sig-d struct" key={i} onClick={() => ouvrirCarte("rat", i)}>
                  {r.name.trim() || "(à nommer)"}
                  {typeLbl && <span className="sig-sub">{typeLbl}</span>}
                  <span className={`sig-badge ${enBase ? "base" : "new"}`}>{enBase ? "en base" : "à créer"}</span>
                </button>
              );
            })}
            <button type="button" className="sig-add" onClick={() => { setRattachements((p) => [...p, { kind: "structure", name: "" }]); ouvrirCarte("rat", rattachements.length, "edit"); }}>＋ Ajouter</button>
          </div>
        </div>

        {/* Encart — opérations. */}
        <div className="bloc">
          <div className="encart-h op"><Icon name="operation" /> Opérations</div>
          <div className="sig-wrap">
            {rattachements.map((r, i) => {
              if (r.kind !== "operation") return null;
              const enBase = ratEnBase(r);
              return (
                <button type="button" className="sig-d op" key={i} onClick={() => ouvrirCarte("rat", i)}>
                  {r.name.trim() || "(à nommer)"}
                  <span className={`sig-badge ${enBase ? "base" : "new"}`}>{enBase ? "en base" : "à créer"}</span>
                </button>
              );
            })}
            <button type="button" className="sig-add" onClick={() => { setRattachements((p) => [...p, { kind: "operation", name: "" }]); ouvrirCarte("rat", rattachements.length, "edit"); }}>＋ Ajouter</button>
          </div>
        </div>

        {/* Encart — personnes. */}
        <div className="bloc">
          <div className="encart-h pers"><Icon name="personne" /> Personnes</div>
          <div className="sig-wrap">
            {personnes.map((p, i) => {
              const nomComplet = [p.prenom, p.nom].filter(Boolean).join(" ") || "(à nommer)";
              const enBase = persEnBase(p);
              return (
                <button type="button" className="sig-d pers" key={i} onClick={() => ouvrirCarte("pers", i)}>
                  {nomComplet}
                  {p.entite.trim() && <span className="mini-sig">{p.entite}</span>}
                  <span className={`sig-badge ${enBase ? "base" : "new"}`}>{enBase ? "en base" : "à créer"}</span>
                </button>
              );
            })}
            <button type="button" className="sig-add" onClick={() => { setPersonnes((pp) => [...pp, { prenom: "", nom: "", fonction: "", entite: "" }]); ouvrirCarte("pers", personnes.length, "edit"); }}>＋ Ajouter</button>
          </div>
        </div>

        {/* Encart — relances. */}
        <div className="bloc">
          <div className="encart-h rel"><Icon name="relance" /> Relances</div>
          <div className="sig-wrap">
            {relances.map((r, i) => (
              <button type="button" className="sig-d rel" key={i} onClick={() => ouvrirCarte("rel", i)}>
                {r.objet.trim() || "(à préciser)"}
                <span className="sig-sub">{dateCourt(r.date)}</span>
              </button>
            ))}
            <button type="button" className="sig-add" onClick={() => { setRelances((rr) => [...rr, { objet: "", date: addDays(today, 30) }]); ouvrirCarte("rel", relances.length, "edit"); }}>＋ Ajouter</button>
          </div>
        </div>

        {/* Bloc — corriger en parlant. */}
        {synthese && (
          <div className="correct-box">
            <span className="lab">🎙️ Corriger en parlant (ou en écrivant)</span>
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
                <button type="button" className="btn ghost mic" onClick={startInstrRec} disabled={correcting} aria-label="Dicter la correction">🎤</button>
              )}
              <button type="button" className="btn" onClick={() => applyCorrection(instr)} disabled={correcting || instrRec === "recording" || !instr.trim()}>Corriger</button>
            </div>
            {instrRec === "recording" && <p className="proc">🎤 J'écoute… tapez « Stop » quand c'est dit.</p>}
            {correcting && <p className="proc">✨ Je corrige la fiche…</p>}
          </div>
        )}

        {!draftId && (
          <label className="field">
            <span className="lab">État</span>
            <select name="statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="valide">Validé (visible dans les fiches)</option>
              <option value="brouillon">Brouillon (masqué pour l'instant)</option>
            </select>
          </label>
        )}

        {draftId ? (
          <div className="form-foot">
            <button className="btn ghost" type="submit" formAction={supprimerBrouillon} formNoValidate>Supprimer</button>
            <Link className="btn ghost" href="/crs/vocal">Passer (plus tard)</Link>
            <button className="btn" type="submit" disabled={!canSave}>Valider et consolider</button>
          </div>
        ) : (
          <div className="form-foot">
            <Link className="btn ghost" href={prefillOperation ? `/operations/${prefillOperation}` : "/tableau"}>Annuler</Link>
            <button className="btn" type="submit" disabled={!canSave}>Enregistrer le compte rendu</button>
          </div>
        )}
      </form>

      {/* Carte ouverte au clic sur un signet (overlay, sans saut d'écran). */}
      {openCard && (
        <div className="cardovl" onClick={fermerCarte}>
          <div className="carte" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="carte-close" aria-label="Fermer" onClick={fermerCarte}>×</button>
            {carteContenu()}
          </div>
        </div>
      )}
    </>
  );
}
