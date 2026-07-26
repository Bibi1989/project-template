import type { Metadata } from "next";

import { DocsShell, DocSection, DocCode } from "@/components/docs-shell";
import { PULUMI_PAGES } from "@/lib/docs/pulumi";

export const metadata: Metadata = {
  title: "Pulumi (AWS) — Blog",
  description: "EKS Pulumi TypeScript — every file explained with examples",
};

export default function BlogPulumiIndexPage() {
  return (
    <DocsShell
      title="Pulumi setup (AWS)"
      subtitle="TypeScript IaC for VPC, EKS, ECR, and IRSA. Pair with Helm values-aws.yaml. Part of the Template blog series."
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/blog", label: "Blog" },
        { href: "/blog/pulumi", label: "Pulumi" },
      ]}
      nav={PULUMI_PAGES.map((p) => ({
        href: `/blog/pulumi/${p.slug}`,
        label: p.title,
        blurb: p.blurb,
      }))}
    >
      <DocSection title="Commands (day-0 → day-2)">
        <DocCode title="from infra/pulumi-aws">{`# 1) Install deps + CLI
npm install
# brew install pulumi   # if needed
# aws configure         # credentials

# 2) Create / select stack
pulumi stack init dev
# or: pulumi stack select dev

# 3) Config (optional — Pulumi.dev.yaml has defaults)
pulumi config set aws:region us-east-1
pulumi config set namePrefix template
pulumi config set instanceType t3.medium

# 4) Preview
pulumi preview

# 5) Create / update infrastructure (~15–20 min first time)
pulumi up
# or: pulumi up --yes

# 6) Connect kubectl to EKS
eval "$(pulumi stack output getCredentialsCommand)"
# same as: aws eks update-kubeconfig --region … --name …

# 7) Useful outputs
pulumi stack output
pulumi stack output ecrFrontendUrl
pulumi stack output ecrBackendUrl
pulumi stack output irsaAppRoleArn
pulumi stack output getCredentialsCommand
pulumi stack output helmInstallHint

# 8) Tear down (careful)
pulumi destroy`}</DocCode>
      </DocSection>

      <DocSection title="After up — deploy the app">
        <DocCode title="ECR + Helm">{`AWS_REGION=$(pulumi stack output awsRegion)
FRONTEND=$(pulumi stack output ecrFrontendUrl)
BACKEND=$(pulumi stack output ecrBackendUrl)
IRSA=$(pulumi stack output irsaAppRoleArn)
TAG=$(git rev-parse --short HEAD)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

aws ecr get-login-password --region "$AWS_REGION" \\
  | docker login --username AWS --password-stdin "\${ACCOUNT}.dkr.ecr.\${AWS_REGION}.amazonaws.com"

docker build -t "\${FRONTEND}:\${TAG}" ../../services/frontend && docker push "\${FRONTEND}:\${TAG}"
docker build -t "\${BACKEND}:\${TAG}" ../../services/backend && docker push "\${BACKEND}:\${TAG}"

helm upgrade --install template-app ../helm/app \\
  -n template --create-namespace --wait \\
  -f ../helm/app/values.yaml -f ../helm/app/values-aws.yaml \\
  --set apps.frontend.image.repository="\${FRONTEND}" \\
  --set apps.frontend.image.tag="\${TAG}" \\
  --set apps.backend.image.repository="\${BACKEND}" \\
  --set apps.backend.image.tag="\${TAG}" \\
  --set serviceAccount.annotations."eks\\.amazonaws\\.com/role-arn"="\${IRSA}"`}</DocCode>
      </DocSection>

      <DocSection title="File map">
        <DocCode title="layout">{`pulumi-aws/
  Pulumi.yaml / Pulumi.dev.yaml
  config.ts     # namePrefix, sizing, tags
  vpc.ts        # VPC + subnets + NAT
  eks.ts        # cluster + node group + OIDC
  ecr.ts        # frontend/backend repos
  irsa.ts       # IAM role for KSA
  index.ts      # stack outputs`}</DocCode>
      </DocSection>
    </DocsShell>
  );
}
