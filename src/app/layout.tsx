import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getIdentite } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Suivi commercial",
  description: "Suivi commercial de l'organisation — module moeïa.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Suivi commercial", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0F7B8A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { email, profil } = await getIdentite();

  // Connecté mais e-mail inconnu de l'organisation : accès refusé (autorisation).
  if (email && !profil) {
    return (
      <html lang="fr">
        <body>
          <main className="auth-wrap">
            <div className="auth-card">
              <div className="brand" style={{ marginBottom: 16 }}>
                <span className="mark">◈</span>Suivi commercial <small>· moeïa</small>
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
    <html lang="fr">
      <body>
        {profil && (
          <header className="topbar">
            <Link className="brand" href="/tableau" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="mark">◈</span>Suivi commercial <small>· moeïa</small>
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
