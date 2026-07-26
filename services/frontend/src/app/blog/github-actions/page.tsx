import type { Metadata } from "next";
import Link from "next/link";

import { DocsShell, DocSection, DocCode } from "@/components/docs-shell";
import { GITHUB_ACTIONS_PAGES } from "@/lib/docs/github-actions";

export const metadata: Metadata = {
  title: "GitHub Actions (CI/CD) — Blog",
  description:
    "Step-by-step CI and deploy workflows with full workflow YAML",
};

export default function BlogGithubActionsIndexPage() {
  return (
    <DocsShell
      title="GitHub Actions (CI/CD)"
      subtitle="Quality gates on every PR, then path-filtered image builds and Helm upgrades to GKE — with full workflow source."
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/blog", label: "Blog" },
        { href: "/blog/github-actions", label: "GitHub Actions" },
      ]}
      nav={GITHUB_ACTIONS_PAGES.map((p) => ({
        href: `/blog/github-actions/${p.slug}`,
        label: p.title,
        blurb: p.blurb,
      }))}
    >
      <DocSection title="End-to-end flow">
        <DocCode title="CI → deploy">{`# 1) Open PR or push → CI always runs
#    .github/workflows/ci.yml
#    frontend: lint · test · build
#    backend:  lint · test

# 2) Merge to main
#    services/frontend/** → Deploy Frontend
#    services/backend/**  → Deploy Backend
#    (or Actions → Run workflow)

# 3) Deploy job
#    WIF auth → docker build/push GAR → helm upgrade --reuse-values

# 4) Verify
#    Actions job summary + kubectl rollout status / Argo CD`}</DocCode>
      </DocSection>

      <DocSection title="Wire GCP (before first deploy)">
        <DocCode title="after terraform apply">{`cd infra/terraform

# Copy outputs into GitHub → Settings → Variables
terraform output -raw wif_provider
terraform output -raw wif_service_account
terraform output -raw project_id
terraform output -raw region
# also set: GAR_REPOSITORY, GKE_CLUSTER_*, HELM_*

# Smoke test
gh workflow run "Deploy Frontend"
gh workflow run "Deploy Backend"`}</DocCode>
        <p>
          Full variable map and WIF notes:{" "}
          <Link
            href="/blog/github-actions/setup"
            className="text-accent hover:underline"
          >
            Wire GCP vars + WIF
          </Link>
          .
        </p>
      </DocSection>

      <DocSection title="Layout">
        <DocCode title=".github/workflows">{`.github/workflows/
  ├── ci.yml                 # always-on lint / test / build
  ├── deploy-frontend.yml    # GAR + Helm (frontend image)
  └── deploy-backend.yml     # GAR + Helm (backend image)

# GitHub ignores workflows under services/*/.github/`}</DocCode>
      </DocSection>
    </DocsShell>
  );
}
