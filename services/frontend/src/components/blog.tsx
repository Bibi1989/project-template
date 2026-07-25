import type { ReactNode } from "react";

export { CodeBlock } from "@/components/code-block";

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={`step-${n}`} className="scroll-mt-24 border-t border-line py-12">
      <div className="mb-4 flex items-baseline gap-4">
        <span className="font-mono text-sm text-accent">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {title}
        </h2>
      </div>
      <div className="space-y-4 text-[15px] leading-7 text-muted">{children}</div>
    </section>
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <aside className="my-5 border-l-2 border-accent/70 bg-surface-2/80 px-4 py-3 text-sm leading-6 text-ink/90">
      {children}
    </aside>
  );
}
