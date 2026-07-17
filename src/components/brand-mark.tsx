import Link from "next/link";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg" | "hero";
}) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl md:text-3xl",
    hero: "text-4xl sm:text-5xl md:text-6xl",
  };

  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} home`}
      className={cn(
        "font-display font-extrabold text-ink inline-flex items-baseline gap-0.5",
        sizes[size],
        className
      )}
    >
      IndieDev
      <span className="bg-brand px-1.5 text-brand-ink rounded-md border-2 border-ink">
        Test
      </span>
    </Link>
  );
}
