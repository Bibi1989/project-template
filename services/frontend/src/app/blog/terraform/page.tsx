import type { Metadata } from "next";

import { DocsShell, DocSection, DocCode } from "@/components/docs-shell";
import {
  TERRAFORM_MODULE_PAGES,
  TERRAFORM_ROOT_PAGES,
} from "@/lib/docs/terraform";

export const metadata: Metadata = {
  title: "Terraform (GCP) — Blog",
  description: "Modular Terraform for GKE — root files and every module explained",
};

export default function BlogTerraformIndexPage() {
  return (
    <DocsShell
      title="Terraform setup (GCP)"
      subtitle="What each root file and module does, with copyable examples. Part of the Template blog series."
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/blog", label: "Blog" },
        { href: "/blog/terraform", label: "Terraform" },
      ]}
      nav={[
        ...TERRAFORM_ROOT_PAGES.map((p) => ({
          href: `/blog/terraform/${p.slug}`,
          label: p.title,
          blurb: p.blurb,
        })),
        ...TERRAFORM_MODULE_PAGES.map((p) => ({
          href: `/blog/terraform/${p.slug}`,
          label: p.title,
          blurb: p.blurb,
        })),
      ]}
    >
      <DocSection title="Commands (day-0 → day-2)">
        <DocCode title="from infra/terraform">{`# 1) Configure
cp terraform.tfvars.example terraform.tfvars
# edit: project_id, github_repository, alert_email, name_prefix

# 2) Init providers / modules
terraform init

# 3) Format + validate (optional but recommended)
terraform fmt -recursive
terraform validate

# 4) Preview changes
terraform plan

# 5) Create / update infrastructure
terraform apply
# or non-interactive: terraform apply -auto-approve

# 6) Connect kubectl to GKE
eval "$(terraform output -raw get_credentials_command)"
# same as: gcloud container clusters get-credentials …

# 7) Useful outputs for CI / Helm
terraform output
terraform output -raw artifact_registry_url
terraform output -raw workload_app_service_account
terraform output -raw wif_provider
terraform output -raw wif_service_account

# 8) Tear down (careful)
terraform destroy`}</DocCode>
      </DocSection>

      <DocSection title="After apply — deploy the app">
        <DocCode title="images + Helm">{`REGION=$(terraform output -raw region)
REGISTRY=$(terraform output -raw artifact_registry_url)
TAG=$(git rev-parse --short HEAD)
PROJECT=$(terraform output -raw project_id)
GCP_SA=$(terraform output -raw workload_app_service_account)

gcloud auth configure-docker "\${REGION}-docker.pkg.dev" --quiet
docker build -t "\${REGISTRY}/backend:\${TAG}" ../../services/backend && docker push "\${REGISTRY}/backend:\${TAG}"
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=/api \\
  -t "\${REGISTRY}/frontend:\${TAG}" ../../services/frontend && docker push "\${REGISTRY}/frontend:\${TAG}"

helm upgrade --install template-app ../helm/app \\
  -n template --create-namespace --wait \\
  -f ../helm/app/values.yaml -f ../helm/app/values-production.yaml \\
  --set global.projectId="\${PROJECT}" \\
  --set global.gcpServiceAccount="\${GCP_SA}" \\
  --set apps.frontend.image.repository="\${REGISTRY}/frontend" \\
  --set apps.frontend.image.tag="\${TAG}" \\
  --set apps.backend.image.repository="\${REGISTRY}/backend" \\
  --set apps.backend.image.tag="\${TAG}"`}</DocCode>
      </DocSection>

      <DocSection title="Dependency graph">
        <DocCode title="order">{`apis
  └── network
        └── gke ─────────────────┬── secrets
              │                  ├── ops
              │                  └── addons (Helm)
              ├── registry
              └── github_wif`}</DocCode>
        <p>
          Start with root files (<code className="text-accent">main.tf</code>,{" "}
          <code className="text-accent">variables.tf</code>, …), then open each
          module page for what it provisions.
        </p>
      </DocSection>
    </DocsShell>
  );
}
