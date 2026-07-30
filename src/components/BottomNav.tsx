"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Navigation primaire, en bas, à portée de pouce (app-shell full-screen).
// 4 destinations + le bouton central « Nouveau CR » (action-phare, encre).

const I = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "ic", viewBox: "0 0 24 24" };

function IcOperations() { return <svg {...I}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>; }
function IcRelances() { return <svg {...I}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.5 21a1.5 1.5 0 0 0 3 0" /></svg>; }
function IcReseau() { return <svg {...I}><path d="M4 21V4h9v17M13 9h7v12M7 8h1M7 12h1M7 16h1M16 13h1M16 17h1" /></svg>; }
function IcEmails() { return <svg {...I}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>; }
function IcPlus() { return <svg {...I} strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>; }

export default function BottomNav() {
  const path = usePathname() || "";
  const on = (h: string) => path === h || path.startsWith(h + "/");
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      <Link className={`bn-item${on("/tableau") ? " on" : ""}`} href="/tableau"><IcOperations /><span>Opérations</span></Link>
      <Link className={`bn-item${on("/entites") ? " on" : ""}`} href="/entites"><IcReseau /><span>Réseau</span></Link>
      <Link className="bn-cr" href="/crs/vocal" aria-label="Nouveau compte rendu"><IcPlus /></Link>
      <Link className={`bn-item${on("/relances") ? " on" : ""}`} href="/relances"><IcRelances /><span>Relances</span></Link>
      <Link className={`bn-item${on("/brouillons") ? " on" : ""}`} href="/brouillons"><IcEmails /><span>Brouillons</span></Link>
    </nav>
  );
}
