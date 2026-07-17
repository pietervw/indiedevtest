"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  size = "lg",
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: ButtonProps["variant"];
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size={size} variant={variant} disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
