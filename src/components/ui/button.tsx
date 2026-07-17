import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-display font-bold transition-[transform,box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-brand-ink border-2 border-ink shadow-brutal hover:bg-brand-hover hover:shadow-brutal-lg hover:-translate-x-px hover:-translate-y-px",
        secondary:
          "bg-paper text-ink border-2 border-ink shadow-brutal hover:bg-paper-muted hover:shadow-brutal-lg hover:-translate-x-px hover:-translate-y-px",
        dark: "bg-ink text-paper border-2 border-ink shadow-brutal-brand hover:bg-ink/90 hover:shadow-brutal-brand-lg hover:-translate-x-px hover:-translate-y-px",
        ghost:
          "bg-transparent text-ink border-2 border-transparent hover:border-ink hover:bg-paper-muted shadow-none active:translate-x-0 active:translate-y-0",
      },
      size: {
        sm: "h-10 px-4 text-sm rounded-lg",
        md: "h-12 px-6 text-base rounded-xl",
        lg: "h-14 px-8 text-lg rounded-xl",
        xl: "h-16 px-10 text-xl rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ButtonProps = ButtonVariantProps &
  (
    | (React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
    | (React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
  );

export function Button({ className, variant, size, href, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      />
    );
  }

  return (
    <button
      className={classes}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    />
  );
}
