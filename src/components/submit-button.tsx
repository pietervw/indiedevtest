"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  size = "lg",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size={size} disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
