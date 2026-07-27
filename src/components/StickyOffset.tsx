"use client";

import { useEffect } from "react";

// Mesure la hauteur réelle de la barre du haut (qui varie avec la safe-area iOS)
// et l'expose en variable CSS --topbar-h, pour épingler les onglets secondaires
// juste sous elle sans hauteur codée en dur.
export default function StickyOffset() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".topbar");
    if (!bar) return;
    const set = () =>
      document.documentElement.style.setProperty("--topbar-h", `${bar.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    window.addEventListener("resize", set);
    window.addEventListener("orientationchange", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
      window.removeEventListener("orientationchange", set);
    };
  }, []);
  return null;
}
