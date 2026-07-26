# Pulumi — AWS EKS

Provisions **VPC + EKS + ECR + IRSA** for this monorepo. Pair with Helm
[`values-aws.yaml`](../helm/app/values-aws.yaml).

| Cloud | IaC |
|-------|-----|
| GCP / GKE | [`../terraform/`](../terraform/) |
| AWS / EKS | **this folder** (`pulumi-aws`) |

Keep `namePrefix` in sync with [`../config.env`](../config.env) `NAME_PREFIX`
and Helm `global.namePrefix` (default `template`).

---

## What you get

```text
VPC (2 AZs)
  ├── public subnets  → NAT, future LBs
  └── private subnets → EKS managed node group

EKS cluster  (${NAME_PREFIX}-eks)
ECR          (${NAME_PREFIX}-frontend, ${NAME_PREFIX}-backend)
IRSA role    (${NAME_PREFIX}-app) → KSA ${NAME_PREFIX}-app
```

Does **not** install the app or ingress — use Helm after `kubeconfig` is ready.

---

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- Node.js 20+
- AWS credentials (`aws configure` or env vars) with rights to create VPC/EKS/IAM/ECR
- `kubectl`, `helm`, AWS CLI v2

```bash
brew install pulumi   # or: curl -fsSL https://get.pulumi.com | sh
```

---

## Install & deploy

```bash
cd infra/pulumi-aws

npm install

# First time: create a stack (uses Pulumi.dev.yaml defaults)
pulumi stack init dev
# or: pulumi stack select dev

# Optional overrides
pulumi config set aws:region us-east-1
pulumi config set namePrefix template
pulumi config set instanceType t3.medium

pulumi preview
pulumi up
```

First apply takes **~15–20 minutes** (EKS + nodes).

---

## Connect & install the app

```bash
# Write kubeconfig (or use the printed AWS CLI command)
eval "$(pulumi stack output getCredentialsCommand)"

# ECR login
AWS_REGION=$(pulumi stack output awsRegion)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build & push (example)
FRONTEND=$(pulumi stack output ecrFrontendUrl)
BACKEND=$(pulumi stack output ecrBackendUrl)
TAG=$(git rev-parse --short HEAD)

docker build -t "${FRONTEND}:${TAG}" ../../services/frontend
docker build -t "${BACKEND}:${TAG}" ../../services/backend
docker push "${FRONTEND}:${TAG}"
docker push "${BACKEND}:${TAG}"

# Helm (IRSA annotation from Pulumi)
IRSA=$(pulumi stack output irsaAppRoleArn)

helm upgrade --install template-app ../helm/app \
  -n template --create-namespace \
  -f ../helm/app/values.yaml -f ../helm/app/values-aws.yaml \
  --set apps.frontend.image.repository="${FRONTEND}" \
  --set apps.frontend.image.tag="${TAG}" \
  --set apps.backend.image.repository="${BACKEND}" \
  --set apps.backend.image.tag="${TAG}" \
  --set serviceAccount.annotations."eks\\.amazonaws\\.com/role-arn"="${IRSA}"
```

Ingress: install **ingress-nginx** or **AWS Load Balancer Controller** separately
(same as other clouds — see [`../helm/app/README.md`](../helm/app/README.md)).

---

## Useful outputs

| Output | Use |
|--------|-----|
| `eksClusterName` | `aws eks update-kubeconfig` |
| `ecrFrontendUrl` / `ecrBackendUrl` | Docker image repos |
| `irsaAppRoleArn` | Helm ServiceAccount annotation |
| `getCredentialsCommand` | Copy-paste kubeconfig setup |
| `helmInstallHint` | Example Helm command |
| `kubeconfig` | Raw kubeconfig (secret) |

```bash
pulumi stack output
pulumi stack output kubeconfig --show-secrets
```

---

## Destroy

```bash
pulumi destroy
```

Empty ECR first if lifecycle/`forceDelete` is not enough for your account policies.

---

## Files

```text
pulumi-aws/
├── Pulumi.yaml          # project
├── Pulumi.dev.yaml      # stack defaults
├── package.json
├── config.ts            # namePrefix, sizing
├── vpc.ts               # VPC + subnets + NAT
├── eks.ts               # EKS + node group
├── ecr.ts               # frontend/backend repos
├── irsa.ts              # app IAM role for KSA
├── index.ts             # exports
└── README.md
```
