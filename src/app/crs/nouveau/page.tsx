import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// La saisie manuelle et la dictée sont désormais réunies sur une seule page
// (/crs/vocal) : on y dicte OU on écrit, puis l'IA analyse. Cette ancienne
// adresse redirige donc vers la page unifiée, en conservant le contexte
// (opération / entité) s'il était passé dans l'URL.
export default async function NouveauCrRedirect({
  searchParams,
}: {
  searchParams: Promise<{ operation?: string; entite?: string }>;
}) {
  const { operation, entite } = await searchParams;
  const params = new URLSearchParams();
  if (operation) params.set("operation", operation);
  if (entite) params.set("entite", entite);
  const qs = params.toString();
  redirect(`/crs/vocal${qs ? `?${qs}` : ""}`);
}
