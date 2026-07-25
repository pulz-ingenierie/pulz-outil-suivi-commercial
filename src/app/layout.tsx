import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getIdentite } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import MoeiaLogo from "@/components/MoeiaLogo";

// Fontes moeïa : Inter (UI), Space Grotesk (titres), JetBrains Mono (chiffres).
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "moeïa · Suivi commercial",
  description: "Suivi commercial — module moeïa.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/moeia-favicon.svg" },
  appleWebApp: { capable: true, title: "Suivi commercial", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#221F1A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { email, profil } = await getIdentite();

  // Connecté mais e-mail inconnu de l'organisation : accès refusé (autorisation).
  if (email && !profil) {
    return (
      <html lang="fr" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
        <body>
          <main className="auth-wrap">
            <div className="auth-card">
              <div className="brand" style={{ marginBottom: 16 }}>
                <MoeiaLogo /> <span className="brand-word">moeïa</span> <small>Suivi commercial</small>
              </div>
              <h1 className="auth-h">Accès non autorisé</h1>
              <p className="muted">
                L'adresse <strong>{email}</strong> n'est pas rattachée à cette organisation.
                Demandez à votre administrateur de vous ajouter, puis reconnectez-vous.
              </p>
              <form action={signOut} style={{ marginTop: 12 }}>
                <button className="btn ghost" type="submit">Se déconnecter</button>
              </form>
            </div>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="fr" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>
        {profil && (
          <header className="topbar">
            <Link className="brand" href="/tableau" style={{ textDecoration: "none", color: "inherit" }}>
              <MoeiaLogo /> <span className="brand-word">moeïa</span> <small>Suivi commercial</small>
            </Link>
            <div className="top-user">
              {profil.role === "pilote" && (
                <Link className="btn ghost mini" href="/admin/utilisateurs">Administration</Link>
              )}
              <span className="who">{profil.nom}{profil.role === "pilote" ? " · pilote" : ""}</span>
              <form action={signOut}>
                <button className="btn ghost mini" type="submit">Se déconnecter</button>
              </form>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
