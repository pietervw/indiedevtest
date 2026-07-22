"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel,
  disabled = false,
  className,
  size = "lg",
  variant = "primary",
  ...props
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: ButtonProps["variant"];
} & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "disabled"
>) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size={size}
      variant={variant}
      disabled={pending || disabled}
      className={className}
      {...props}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
