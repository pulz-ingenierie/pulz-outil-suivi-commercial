"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import MoeiaLogo from "@/components/MoeiaLogo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const configured =
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setState("sending");
    try {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError("Envoi impossible. Vérifiez l'adresse et réessayez.");
        setState("idle");
      } else {
        setState("sent");
      }
    } catch {
      setError("Service de connexion indisponible pour le moment.");
      setState("idle");
    }
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <MoeiaLogo size={24} /> <span className="brand-word">moeïa</span> <small>Suivi commercial</small>
        </div>

        {!configured ? (
          <div className="notice card" style={{ marginTop: 8 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Connexion à configurer</h2>
            <p className="muted" style={{ margin: 0 }}>
              La connexion n'est pas encore activée (clés Supabase manquantes). Renseignez
              <code> NEXT_PUBLIC_SUPABASE_URL </code> et <code> NEXT_PUBLIC_SUPABASE_ANON_KEY </code>
              dans Vercel, puis rechargez.
            </p>
          </div>
        ) : state === "sent" ? (
          <div>
            <h1 className="auth-h">Regardez vos e-mails</h1>
            <p className="muted">
              Un lien de connexion vient d'être envoyé à <strong>{email.trim().toLowerCase()}</strong>.
              Ouvrez-le sur cet appareil pour entrer. Le lien est valable un court instant.
            </p>
            <button className="btn ghost" onClick={() => setState("idle")} style={{ marginTop: 10 }}>
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <>
            <h1 className="auth-h">Se connecter</h1>
            <p className="muted" style={{ marginTop: 0 }}>
              Entrez votre adresse professionnelle : vous recevrez un lien pour entrer, sans mot de passe.
            </p>
            <form onSubmit={submit} className="form" style={{ marginTop: 6 }}>
              <label className="field">
                <span className="lab">Adresse e-mail</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@votre-societe.fr"
                />
              </label>
              {error && <div className="notice card err" style={{ padding: "10px 14px" }}>{error}</div>}
              <button className="btn" type="submit" disabled={state === "sending"}>
                {state === "sending" ? "Envoi…" : "Recevoir le lien de connexion"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
