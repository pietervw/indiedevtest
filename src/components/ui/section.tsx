import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-5xl px-4 sm:px-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Section({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("py-16 md:py-24", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionHeading({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto mb-12 max-w-2xl text-center", className)}>
      <h2 className="font-display text-3xl font-extrabold text-ink md:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-lg text-ink-muted md:text-xl">{description}</p>
      ) : null}
    </div>
  );
}
