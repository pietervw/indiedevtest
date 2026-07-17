import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center font-display font-semibold border-2 border-ink",
  {
    variants: {
      variant: {
        brand: "bg-brand text-brand-ink",
        muted: "bg-paper-muted text-ink",
        outline: "bg-paper text-ink",
        dark: "bg-ink text-paper",
      },
      size: {
        sm: "px-2.5 py-0.5 text-xs rounded-md",
        md: "px-3 py-1 text-sm rounded-lg",
      },
    },
    defaultVariants: {
      variant: "brand",
      size: "sm",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}
