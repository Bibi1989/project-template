import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocsShell, DocSection, DocCode } from "@/components/docs-shell";
import {
  allTerraformSlugs,
  getTerraformPage,
} from "@/lib/docs/terraform";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return allTerraformSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getTerraformPage(slug);
  return {
    title: page ? `${page.title} — Blog` : "Terraform — Blog",
    description: page?.blurb,
  };
}

export default async function BlogTerraformDocPage({ params }: Props) {
  const { slug } = await params;
  const page = getTerraformPage(slug);
  if (!page) notFound();

  return (
    <DocsShell
      title={page.title}
      subtitle={page.blurb}
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/blog", label: "Blog" },
        { href: "/blog/terraform", label: "Terraform" },
        { href: `/blog/terraform/${page.slug}`, label: page.slug },
      ]}
    >
      <p className="font-mono text-xs text-accent">{page.path}</p>

      <DocSection title="What it does">
        <p>{page.what}</p>
      </DocSection>

      <DocSection title="Why it exists">
        <p>{page.why}</p>
      </DocSection>

      <DocSection title="What gets provisioned">
        <ul className="list-disc space-y-1 pl-5">
          {page.provisions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
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
        <Link href="/blog/terraform" className="text-accent hover:underline">
          ← All Terraform pages
        </Link>
        <Link href="/blog" className="text-accent hover:underline">
          Blog home
        </Link>
      </p>
    </DocsShell>
  );
}
