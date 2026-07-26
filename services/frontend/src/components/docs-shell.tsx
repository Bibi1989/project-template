import type { ReactNode } from "react";
import Link from "next/link";

import { CodeBlock } from "@/components/code-block";

export type DocLink = { href: string; label: string; blurb?: string };

export type DocSection = {
  title: string;
  body: ReactNode;
  code?: { title: string; content: string }[];
};

export function DocsShell({
  title,
  subtitle,
  crumbs,
  children,
  nav,
}: {
  title: string;
  subtitle?: string;
  crumbs: { href: string; label: string }[];
  children: ReactNode;
  nav?: DocLink[];
}) {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[50vh] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,#1a3d38_0%,transparent_55%)]"
      />

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 pt-8">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-ink transition hover:text-accent"
        >
          Template
        </Link>
        <nav className="flex gap-5 text-sm text-muted">
          <Link href="/blog" className="hover:text-ink">
            Blog
          </Link>
          <Link href="/blog/terraform" className="hover:text-ink">
            Terraform
          </Link>
          <Link href="/blog/pulumi" className="hover:text-ink">
            Pulumi
          </Link>
          <Link href="/blog/github-actions" className="hover:text-ink">
            Actions
          </Link>
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
        </nav>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-12">
        <nav className="mb-6 flex flex-wrap gap-2 font-mono text-xs text-muted">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-2">
              {i > 0 ? <span className="text-line">/</span> : null}
              <Link href={c.href} className="hover:text-accent">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>

        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted">
            {subtitle}
          </p>
        ) : null}

        {nav && nav.length > 0 ? (
          <ul className="mt-10 space-y-3 border-t border-line pt-8">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group block transition hover:text-ink"
                >
                  <span className="font-medium text-accent group-hover:underline">
                    {item.label}
                  </span>
                  {item.blurb ? (
                    <span className="mt-0.5 block text-sm text-muted">
                      {item.blurb}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-10 space-y-10 text-[15px] leading-7 text-muted">
          {children}
        </div>
      </article>
    </div>
  );
}

export function DocSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="mb-3 font-display text-xl font-bold tracking-tight text-ink md:text-2xl">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function DocCode({
  title,
  children,
}: {
  title?: string;
  children: string;
}) {
  return <CodeBlock title={title}>{children}</CodeBlock>;
}
