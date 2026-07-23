import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// « Voix d'abord » : la page d'accueil de l'outil EST la saisie d'un compte
// rendu (dicter ou écrire). Le tableau de bord (pilotage) vit sur /tableau,
// accessible en un tap depuis le logo en haut.
export default function Home() {
  redirect("/crs/vocal");
}
