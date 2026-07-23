"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createCr } from "@/lib/actions";

type Opt = { id: string; nom: string };
type Synthese = {
  type_rdv: string;
  date_rdv: string | null;
  resume: string;
  points_cles: string[];
  entites: string[];
  operations: string[];
  relances: { objet: string; dans_jours: number }[];
};

const TYPES_RDV = [
  { v: "dejeuner", l: "Déjeuner" },
  { v: "appel", l: "Appel" },
  { v: "visite", l: "Visite" },
  { v: "salon", l: "Salon" },
  { v: "autre", l: "Autre" },
];

// Choisit un format audio réellement supporté par le navigateur (iOS inclus).
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

export default function VoiceCr({
  entites,
  operations,
  today,
  prefillEntite,
  prefillOperation,
}: {
  entites: Opt[];
  operations: Opt[];
  today: string;
  prefillEntite?: string;
  prefillOperation?: string;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const [busy, setBusy] = useState<null | "transcribe" | "synth">(null);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState("");
  const [synthese, setSynthese] = useState<Synthese | null>(null);

  const [typeRdv, setTypeRdv] = useState("autre");
  const [dateRdv, setDateRdv] = useState(today);
  const [statut, setStatut] = useState("valide");
  const [selEnt, setSelEnt] = useState<Set<string>>(new Set(prefillEntite ? [prefillEntite] : []));
  const [selOp, setSelOp] = useState<Set<string>>(new Set(prefillOperation ? [prefillOperation] : []));
  // La liste de rattachement à la main est masquée par défaut : on ne coche
  // rien au préalable. L'IA propose, et on ouvre ce volet pour corriger.
  const [rattachOpen, setRattachOpen] = useState<boolean>(Boolean(prefillEntite || prefillOperation));

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Réf vers la dernière version du traitement auto, pour l'appeler depuis
  // l'événement d'arrêt du micro sans capturer un état périmé.
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
        // Enchaînement automatique : transcription → structuration.
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

  // --- Appels IA (fonctions « pures » : renvoient le résultat, gèrent l'erreur).
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
      const s = data.synthese as Synthese;
      setSynthese(s);
      setTypeRdv(s.type_rdv || "autre");
      if (s.date_rdv) setDateRdv(s.date_rdv);
      // Pré-coche les entités / opérations reconnues par l'IA (par libellé).
      const entByName = new Map(entites.map((e) => [e.nom, e.id]));
      const opByName = new Map(operations.map((o) => [o.nom, o.id]));
      const matched =
        s.entites.filter((n) => entByName.has(n)).length +
        s.operations.filter((n) => opByName.has(n)).length;
      setSelEnt((prev) => {
        const next = new Set(prev);
        s.entites.forEach((n) => { const id = entByName.get(n); if (id) next.add(id); });
        return next;
      });
      setSelOp((prev) => {
        const next = new Set(prev);
        s.operations.forEach((n) => { const id = opByName.get(n); if (id) next.add(id); });
        return next;
      });
      if (matched === 0) setRattachOpen(true);
    } catch {
      setError("Synthèse indisponible.");
    }
  }

  // Traitement automatique complet après un enregistrement.
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

  // Structuration manuelle (chemin « j'écris à la main »).
  async function synthesizeManuel() {
    if (!transcription.trim() || busy) return;
    setError(null);
    setBusy("synth");
    await doSynth(transcription);
    setBusy(null);
  }

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const entName = new Map(entites.map((e) => [e.id, e.nom]));
  const opName = new Map(operations.map((o) => [o.id, o.nom]));
  const selEntNames = [...selEnt].map((id) => ({ id, nom: entName.get(id) ?? "?" }));
  const selOpNames = [...selOp].map((id) => ({ id, nom: opName.get(id) ?? "?" }));

  const canSave = transcription.trim().length > 0 && (selEnt.size > 0 || selOp.size > 0);

  return (
    <>
      {/* Capture vocale — dès l'arrêt, l'outil transcrit puis structure tout seul. */}
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
            {!busy && synthese && <p className="proc ok">✓ Compte rendu analysé — relisez et corrigez ci-dessous.</p>}
            <div className="rec-acts">
              {!busy && error && audioBlob && (
                <button type="button" className="btn" onClick={() => runPipeline(audioBlob)}>
                  Réessayer l'analyse
                </button>
              )}
              <button type="button" className="btn ghost" onClick={resetAudio} disabled={busy !== null}>
                Recommencer
              </button>
            </div>
          </div>
        )}
        <p className="hint">
          Vous pouvez aussi ignorer le micro et écrire directement le compte rendu ci-dessous.
        </p>
      </div>

      {error && <div className="card notice err">{error}</div>}

      {/* Formulaire — posté au serveur (action validée) */}
      <form action={createCr} className="form">
        <input type="hidden" name="synthese_json" value={synthese ? JSON.stringify(synthese) : ""} />

        <label className="field">
          <span className="lab">Compte rendu <em>*</em></span>
          <textarea
            name="transcription"
            rows={7}
            required
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="Le texte dicté apparaîtra ici — corrigez-le librement, ou écrivez directement."
          />
        </label>

        <div className="synth-row">
          <button
            type="button"
            className="btn ghost"
            onClick={synthesizeManuel}
            disabled={busy !== null || !transcription.trim()}
          >
            {busy === "synth" ? "L'IA structure…" : synthese ? "✨ Relancer l'analyse" : "✨ Structurer avec l'IA"}
          </button>
          <span className="hint">L'IA propose la date, un résumé, les rattachements et les suites — vous gardez la main.</span>
        </div>

        {synthese && (
          <div className="card synth-preview">
            <div className="eyebrow">Proposition de l'IA</div>
            {synthese.resume && <p className="s-resume">{synthese.resume}</p>}
            {synthese.points_cles.length > 0 && (
              <ul className="s-points">{synthese.points_cles.map((p, i) => <li key={i}>{p}</li>)}</ul>
            )}
            {synthese.relances.length > 0 && (
              <div className="s-relances">
                <span className="lab">Suites suggérées</span>
                {synthese.relances.map((r, i) => (
                  <span className="pill auto" key={i}>{r.objet} · sous {r.dans_jours} j</span>
                ))}
                <p className="hint">Les relances seront créables à l'étape « relances » (brique suivante).</p>
              </div>
            )}
          </div>
        )}

        <div className="row2">
          <label className="field">
            <span className="lab">Date du rendez-vous</span>
            <input
              type="date"
              name="date_rdv"
              value={dateRdv}
              max={today}
              onChange={(e) => setDateRdv(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="lab">Type de rendez-vous</span>
            <select name="type_rdv" value={typeRdv} onChange={(e) => setTypeRdv(e.target.value)}>
              {TYPES_RDV.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>
        </div>

        <div className="field">
          <span className="lab">Rattachements</span>
          {selEntNames.length + selOpNames.length === 0 ? (
            <p className="hint" style={{ marginTop: 0 }}>
              {synthese
                ? "L'IA n'a rien reconnu automatiquement — rattachez à la main ci-dessous."
                : "Après l'analyse, les entités et opérations concernées seront proposées ici. Vous pourrez toujours ajuster."}
            </p>
          ) : (
            <div className="rattach-chips">
              {selEntNames.map((e) => (
                <span className="chip ent rm" key={e.id}>
                  {e.nom}
                  <button type="button" aria-label={`Retirer ${e.nom}`} onClick={() => toggle(selEnt, setSelEnt, e.id)}>×</button>
                </span>
              ))}
              {selOpNames.map((o) => (
                <span className="chip rm" key={o.id}>
                  {o.nom}
                  <button type="button" aria-label={`Retirer ${o.nom}`} onClick={() => toggle(selOp, setSelOp, o.id)}>×</button>
                </span>
              ))}
            </div>
          )}

          {/* Champs réellement postés au serveur (cachés) */}
          {[...selEnt].map((id) => <input key={id} type="hidden" name="entite_ids" value={id} />)}
          {[...selOp].map((id) => <input key={id} type="hidden" name="operation_ids" value={id} />)}

          <button
            type="button"
            className="btn ghost mini"
            onClick={() => setRattachOpen((o) => !o)}
            style={{ marginTop: 4 }}
          >
            {rattachOpen ? "Masquer" : "Rattacher / corriger à la main"}
          </button>

          {rattachOpen && (
            <div className="row2" style={{ marginTop: 12 }}>
              <fieldset className="field pickset">
                <legend className="lab">Entités</legend>
                {entites.length ? (
                  <div className="picklist">
                    {entites.map((e) => (
                      <label className="check" key={e.id}>
                        <input type="checkbox" checked={selEnt.has(e.id)} onChange={() => toggle(selEnt, setSelEnt, e.id)} />
                        <span>{e.nom}</span>
                      </label>
                    ))}
                  </div>
                ) : <div className="empty">Aucune entité. <Link href="/entites/nouvelle">En créer une.</Link></div>}
              </fieldset>

              <fieldset className="field pickset">
                <legend className="lab">Opérations</legend>
                {operations.length ? (
                  <div className="picklist">
                    {operations.map((o) => (
                      <label className="check" key={o.id}>
                        <input type="checkbox" checked={selOp.has(o.id)} onChange={() => toggle(selOp, setSelOp, o.id)} />
                        <span>{o.nom}</span>
                      </label>
                    ))}
                  </div>
                ) : <div className="empty">Aucune opération.</div>}
              </fieldset>
            </div>
          )}
        </div>

        <label className="field">
          <span className="lab">État</span>
          <select name="statut" value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="valide">Validé (visible dans les fiches)</option>
            <option value="brouillon">Brouillon (masqué pour l'instant)</option>
          </select>
        </label>

        <div className="form-foot">
          <Link className="btn ghost" href={prefillOperation ? `/operations/${prefillOperation}` : "/"}>Annuler</Link>
          <button className="btn" type="submit" disabled={!canSave}>Enregistrer le compte rendu</button>
        </div>
      </form>
    </>
  );
}
