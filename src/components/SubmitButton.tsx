"use client";

import { useFormStatus } from "react-dom";

// Bouton d'envoi qui se désactive pendant la soumission : empêche les doublons
// dus à un double-clic (latence réseau).
export default function SubmitButton({
  children,
  className = "btn",
  disabled = false,
  pendingLabel = "Enregistrement…",
  formAction,
  formNoValidate,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  pendingLabel?: string;
  formAction?: (formData: FormData) => void;
  formNoValidate?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      formAction={formAction}
      formNoValidate={formNoValidate}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
