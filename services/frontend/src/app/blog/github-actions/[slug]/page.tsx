import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocsShell, DocSection, DocCode } from "@/components/docs-shell";
import {
  allGithubActionsSlugs,
  getGithubActionsPage,
} from "@/lib/docs/github-actions";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return allGithubActionsSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getGithubActionsPage(slug);
  return {
    title: page ? `${page.title} — Blog` : "GitHub Actions — Blog",
    description: page?.blurb,
  };
}

export default async function BlogGithubActionsDocPage({ params }: Props) {
  const { slug } = await params;
  const page = getGithubActionsPage(slug);
  if (!page) notFound();

  return (
    <DocsShell
      title={page.title}
      subtitle={page.blurb}
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/blog", label: "Blog" },
        { href: "/blog/github-actions", label: "GitHub Actions" },
        { href: `/blog/github-actions/${page.slug}`, label: page.slug },
      ]}
    >
      <p className="font-mono text-xs text-accent">{page.path}</p>

      <DocSection title="What it does">
        <p>{page.what}</p>
      </DocSection>

      <DocSection title="Why it exists">
        <p>{page.why}</p>
      </DocSection>

      <DocSection title="What it covers">
        <ul className="list-disc space-y-1 pl-5">
          {page.provisions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DocSection>

      <DocSection title="Step by step">
        <ol className="list-decimal space-y-4 pl-5">
          {page.steps.map((step) => (
            <li key={step.title} className="pl-1">
              <p className="font-medium text-ink">{step.title}</p>
              <p className="mt-1 text-[15px] leading-7 text-muted">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </DocSection>

      {page.examples.map((ex) => (
        <DocSection key={ex.title} title={ex.title}>
          <DocCode title={ex.title}>{ex.code}</DocCode>
        </DocSection>
      ))}

      {page.notes && page.notes.length > 0 ? (
        <DocSection title="Notes">
          <ul className="list-disc space-y-1 pl-5">
            {page.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </DocSection>
      ) : null}

      <p className="flex flex-wrap gap-4 pt-4">
        <Link
          href="/blog/github-actions"
          className="text-accent hover:underline"
        >
          ← All GitHub Actions pages
        </Link>
        <Link href="/blog" className="text-accent hover:underline">
          Blog home
        </Link>
      </p>
    </DocsShell>
  );
}
