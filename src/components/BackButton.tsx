"use client";

import { useRouter } from "next/navigation";

// Bouton « Précédent » : revient à la page d'avant (historique du navigateur),
// pas systématiquement au tableau de bord. Repli sur une adresse donnée si on
// est arrivé directement (pas d'historique).
export default function BackButton({ fallback = "/tableau" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="back"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      ← Précédent
    </button>
  );
}
