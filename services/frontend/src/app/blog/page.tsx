import type { Metadata } from "next";
import Link from "next/link";

import { Callout, CodeBlock, Step } from "@/components/blog";

export const metadata: Metadata = {
  title: "From zero to running — Template setup guide",
  description:
    "Step-by-step: backend, frontend, Docker, Kubernetes, Helm, Terraform, and monitoring",
};

const TOC = [
  { n: 1, title: "What you are building" },
  { n: 2, title: "Repository map" },
  { n: 3, title: "Prerequisites" },
  { n: 4, title: "Backend (FastAPI)" },
  { n: 5, title: "Frontend (Next.js)" },
  { n: 6, title: "Local Kubernetes + Helm" },
  { n: 7, title: "Open the app (ingress)" },
  { n: 8, title: "Monitoring (Prometheus + Grafana)" },
  { n: 9, title: "Ship a new image to kind" },
  { n: 10, title: "Argo CD (GitOps)" },
  { n: 11, title: "Production path (Terraform + GKE)" },
  { n: 12, title: "Rollback (Helm or kubectl)" },
  { n: 13, title: "How the pieces connect" },
] as const;

export default function BlogPage() {
  return (
    <div className="relative min-h-screen">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,#1a3d38_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,transparent_49%,#1e2d3822_50%,transparent_51%)] bg-[length:48px_48px] opacity-40"
      />

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 pt-8">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-ink transition hover:text-accent"
        >
          Template
        </Link>
        <nav className="flex gap-6 text-sm text-muted">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <a href="#toc" className="hover:text-ink">
            Contents
          </a>
        </nav>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-16">
        {/* Hero — brand first */}
        <p className="font-display text-5xl font-extrabold tracking-tight text-ink md:text-6xl">
          Template
        </p>
        <h1 className="mt-4 max-w-xl text-xl font-medium leading-snug text-ink/90 md:text-2xl">
          From zero to a running stack — backend, frontend, Kubernetes, Helm,
          and Terraform
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted">
          A practical walkthrough of this monorepo: what each layer does, why it
          exists, and the exact commands to run locally and toward GKE.
        </p>
        <p className="mt-6 font-mono text-xs text-accent">
          ~25 min read · step-by-step · copy-paste commands
        </p>

        {/* TOC */}
        <nav
          id="toc"
          className="mt-14 scroll-mt-24 border-t border-line pt-10"
          aria-label="Table of contents"
        >
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
            Contents
          </p>
          <ol className="space-y-2">
            {TOC.map((item) => (
              <li key={item.n}>
                <a
                  href={`#step-${item.n}`}
                  className="group flex gap-3 text-[15px] text-muted transition hover:text-ink"
                >
                  <span className="font-mono text-accent/80 group-hover:text-accent">
                    {String(item.n).padStart(2, "0")}
                  </span>
                  <span>{item.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Step n={1} title="What you are building">
          <p>
            This repo is a{" "}
            <strong className="font-medium text-ink">
              full-stack template
            </strong>
            : a FastAPI API, a Next.js UI, and infrastructure that can run on
            your laptop (kind / Docker Desktop) or on Google Kubernetes Engine.
          </p>
          <p>
            Traffic in production (and locally via ingress) looks like this:
          </p>
          <CodeBlock title="request path">{`Internet / localhost
   │
   ▼
ingress-nginx
   ├── /          → frontend (Next.js)  :3000
   └── /api/(.*)  → backend  (FastAPI)  :8000
                    (rewrite drops the /api prefix)`}</CodeBlock>
          <p>
            The browser calls <code className="text-accent">/api/…</code>.
            Ingress strips <code className="text-accent">/api</code> and
            forwards to FastAPI at the root. The frontend server also talks to
            the backend with an absolute URL (
            <code className="text-accent">BACKEND_URL</code>) for React Server
            Components.
          </p>
        </Step>

        <Step n={2} title="Repository map">
          <p>Everything lives in one monorepo:</p>
          <CodeBlock title="layout">{`services/
  frontend/            Next.js app + Dockerfile
  backend/             FastAPI app + Dockerfile
infra/
  config.env           NAME_PREFIX=template (rename once)
  terraform/           GCP: VPC, GKE, GAR, secrets, WIF
  helm/app/            App chart (apps.* → Deployment/Service/HPA)
  helm/monitoring/     Prometheus + Grafana values
  helm/argocd/         Argo CD GitOps`}</CodeBlock>
          <p>
            Naming is centralized: change{" "}
            <code className="text-accent">NAME_PREFIX</code> in{" "}
            <code className="text-accent">infra/config.env</code>, then keep
            Terraform <code className="text-accent">name_prefix</code> and Helm{" "}
            <code className="text-accent">global.namePrefix</code> in sync.
            Defaults become namespace{" "}
            <code className="text-accent">template</code>, release{" "}
            <code className="text-accent">template-app</code>, monitoring ns{" "}
            <code className="text-accent">template-monitoring</code>, Argo CD ns{" "}
            <code className="text-accent">template-argocd</code>.
          </p>
        </Step>

        <Step n={3} title="Prerequisites">
          <p>Install these before the steps below:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-ink">Python 3.11–3.14</strong> (3.12
              ideal; Docker uses 3.12)
            </li>
            <li>
              <strong className="text-ink">Node.js 20+</strong> (22 recommended)
              + npm
            </li>
            <li>
              <strong className="text-ink">Docker</strong> + optional{" "}
              <strong className="text-ink">kind</strong> or Docker Desktop
              Kubernetes
            </li>
            <li>
              <strong className="text-ink">kubectl</strong> and{" "}
              <strong className="text-ink">Helm ≥ 3.14</strong>
            </li>
            <li>Optional: Postgres on the host (for DB health checks)</li>
            <li>
              For cloud: <strong className="text-ink">gcloud</strong> + a GCP
              project (Terraform step)
            </li>
          </ul>
          <CodeBlock title="quick checks">{`python3 --version
node --version
docker version
kubectl version --client
helm version`}</CodeBlock>
        </Step>

        <Step n={4} title="Backend (FastAPI)">
          <p>
            The backend is a small FastAPI app under{" "}
            <code className="text-accent">services/backend/app/main.py</code>. It exposes{" "}
            <code className="text-accent">/health</code>,{" "}
            <code className="text-accent">/metrics</code> (Prometheus), and demo
            routes. Uvicorn serves it on port{" "}
            <strong className="text-ink">8000</strong>.
          </p>
          <p>
            <strong className="text-ink">What it does:</strong> HTTP API, CORS,
            structured logs, Prometheus metrics via{" "}
            <code className="text-accent">
              prometheus-fastapi-instrumentator
            </code>
            . In Kubernetes, ingress already removed{" "}
            <code className="text-accent">/api</code>, so routes are registered
            at the root.
          </p>
          <CodeBlock title="install + run">{`cd services/backend

python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\\Scripts\\activate

pip install --upgrade pip
pip install -r requirements.txt

cp .env.example .env               # edit if needed

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`}</CodeBlock>
          <p>Verify:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Health →{" "}
              <a
                className="text-accent underline-offset-2 hover:underline"
                href="http://127.0.0.1:8000/health"
              >
                http://127.0.0.1:8000/health
              </a>
            </li>
            <li>
              Docs →{" "}
              <a
                className="text-accent underline-offset-2 hover:underline"
                href="http://127.0.0.1:8000/docs"
              >
                http://127.0.0.1:8000/docs
              </a>
            </li>
            <li>
              Metrics →{" "}
              <code className="text-accent">http://127.0.0.1:8000/metrics</code>
            </li>
          </ul>
          <Callout>
            Prefer Python 3.12 if you hit wheel build errors on very new
            interpreters. Current <code>requirements.txt</code> supports 3.14
            via recent pydantic.
          </Callout>
        </Step>

        <Step n={5} title="Frontend (Next.js)">
          <p>
            The frontend is Next.js 15 (App Router) under{" "}
            <code className="text-accent">services/frontend/</code>. It renders this UI,
            checks backend health, and can probe Postgres.
          </p>
          <p>
            <strong className="text-ink">Env that matters:</strong>
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <code className="text-accent">BACKEND_URL</code> — absolute
              FastAPI base for server-side fetch (e.g.{" "}
              <code className="text-accent">http://127.0.0.1:8000</code>).
              Relative <code className="text-accent">/api</code> fails in RSC.
            </li>
            <li>
              <code className="text-accent">NEXT_PUBLIC_API_BASE_URL=/api</code>{" "}
              — browser / same-origin API prefix (ingress in cluster).
            </li>
            <li>
              <code className="text-accent">DATABASE_URL</code> — optional; use{" "}
              <code className="text-accent">localhost</code> on the host,{" "}
              <code className="text-accent">host.docker.internal</code> from
              pods.
            </li>
          </ul>
          <CodeBlock title="install + run">{`cd services/frontend

npm install
cp .env.example .env               # set BACKEND_URL + DATABASE_URL

npm run dev
# http://127.0.0.1:3000`}</CodeBlock>
          <p>
            Keep the backend running in another terminal. Open the home page —
            health widgets should show the API (and DB if Postgres is up).
          </p>
        </Step>

        <Step n={6} title="Local Kubernetes + Helm">
          <p>
            Helm packages the apps into Kubernetes. The chart under{" "}
            <code className="text-accent">infra/helm/app</code> is{" "}
            <strong className="text-ink">dynamic</strong>: every key in{" "}
            <code className="text-accent">apps.*</code> (when{" "}
            <code className="text-accent">enabled: true</code>) gets a
            Deployment, Service, and optional HPA / PDB / ServiceMonitor.
          </p>
          <p>
            <strong className="text-ink">What Helm is doing:</strong> reading{" "}
            <code className="text-accent">values.yaml</code>, rendering YAML
            templates, and applying them as release{" "}
            <code className="text-accent">template-app</code> in namespace{" "}
            <code className="text-accent">template</code>.
          </p>

          <p className="font-medium text-ink">6a — Ingress controller</p>
          <CodeBlock title="ingress-nginx">{`helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \\
  -n ingress-nginx --create-namespace`}</CodeBlock>

          <p className="font-medium text-ink">6b — Build images</p>
          <CodeBlock title="from repo root">{`docker build -t template-frontend:local \\
  --build-arg NEXT_PUBLIC_API_BASE_URL=/api \\
  services/frontend

docker build -t template-backend:local services/backend

# kind only — load images into the cluster nodes:
kind load docker-image template-frontend:local -n template
kind load docker-image template-backend:local -n template`}</CodeBlock>
          <Callout>
            Local values use <code>imagePullPolicy: Never</code> and tags{" "}
            <code>*:local</code>. The cluster must already have the image
            (Desktop shares the daemon; kind needs <code>kind load</code>).
          </Callout>

          <p className="font-medium text-ink">6c — Install the app chart</p>
          <CodeBlock title="helm install">{`cd infra/helm/app

helm upgrade --install template-app . \\
  --namespace template \\
  --create-namespace \\
  --wait`}</CodeBlock>
          <p>
            Defaults come from <code className="text-accent">values.yaml</code>.
            After the first install, day-to-day image updates are covered in step
            9 (build → kind load → restart{" "}
            <strong className="text-ink">one</strong> Deployment).
          </p>
        </Step>

        <Step n={7} title="Open the app (ingress)">
          <p>
            Services are ClusterIP (internal). To browse from your Mac,
            port-forward the ingress controller (recommended — same path routing
            as production):
          </p>
          <CodeBlock title="ingress → localhost:8080">{`kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
# open http://localhost:8080`}</CodeBlock>
          <p>Or forward a single service:</p>
          <CodeBlock>{`kubectl port-forward -n template svc/service-frontend 3000:3000
kubectl port-forward -n template svc/service-backend 8000:8000`}</CodeBlock>
          <p className="font-medium text-ink">Useful debug commands</p>
          <CodeBlock>{`kubectl -n template get pods,svc,ingress
kubectl -n template describe pod -l app.kubernetes.io/component=frontend
kubectl -n template logs -l app.kubernetes.io/component=backend --tail=100`}</CodeBlock>
        </Step>

        <Step n={8} title="Monitoring (Prometheus + Grafana)">
          <p>
            Observability is a <strong className="text-ink">separate</strong>{" "}
            Helm release so app deploys stay light. Values live in{" "}
            <code className="text-accent">infra/helm/monitoring</code> and
            install into namespace{" "}
            <code className="text-accent">template-monitoring</code>.
          </p>
          <p>
            The backend already serves{" "}
            <code className="text-accent">/metrics</code>. The app chart can add{" "}
            <code className="text-accent">prometheus.io</code> annotations and
            optional ServiceMonitor CRs for the Prometheus Operator.
          </p>
          <CodeBlock title="install kube-prometheus-stack">{`helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install template-monitoring prometheus-community/kube-prometheus-stack \\
  --namespace template-monitoring --create-namespace \\
  -f infra/helm/monitoring/values.yaml \\
  --wait --timeout 10m`}</CodeBlock>
          <CodeBlock title="enable ServiceMonitor on the backend">{`helm upgrade template-app infra/helm/app -n template \\
  --set monitoring.serviceMonitor.enabled=true \\
  --set apps.backend.monitoring.serviceMonitor=true \\
  --set apps.backend.monitoring.scrape=true`}</CodeBlock>
          <CodeBlock title="open UIs">{`# Grafana → http://localhost:3001  (admin / changeme)
kubectl -n template-monitoring port-forward svc/template-monitoring-grafana 3001:80

# Prometheus → http://localhost:9090
kubectl -n template-monitoring port-forward svc/template-monitoring-prometheus 9090:9090`}</CodeBlock>
          <Callout>
            Change Grafana’s password before any shared environment. HPA still
            uses metrics-server (CPU/memory), not Prometheus — Prom is for
            dashboards and alerts.
          </Callout>
        </Step>

        <Step n={9} title="Ship a new image to kind">
          <p>
            Local values use tag <code className="text-accent">local</code> and{" "}
            <code className="text-accent">imagePullPolicy: Never</code>. Kind
            nodes do not see host Docker images until you{" "}
            <code className="text-accent">kind load</code> them. Then restart{" "}
            <strong className="text-ink">only the Deployment you changed</strong>
            — do not use global <code className="text-accent">rolloutDate</code>{" "}
            unless you intend every app to roll.
          </p>

          <p className="font-medium text-ink">Process (frontend example)</p>
          <CodeBlock title="build → load → restart one Deployment">{`# 1) Build on the host (repo root)
docker build -t template-frontend:local \\
  --build-arg NEXT_PUBLIC_API_BASE_URL=/api \\
  services/frontend

# 2) Load into the kind cluster named "template"
kind load docker-image template-frontend:local -n template

# 3) Restart ONLY the frontend Deployment
kubectl -n template rollout restart deploy/deployment-frontend
kubectl -n template rollout status deploy/deployment-frontend`}</CodeBlock>

          <p className="font-medium text-ink">Backend only</p>
          <CodeBlock>{`docker build -t template-backend:local services/backend
kind load docker-image template-backend:local -n template
kubectl -n template rollout restart deploy/deployment-fastapi
kubectl -n template rollout status deploy/deployment-fastapi`}</CodeBlock>

          <Callout>
            Helm upgrades the whole release, but you can still target one app
            with <code>--reuse-values --set apps.frontend.image.…</code>. For the
            same <code>:local</code> tag after <code>kind load</code>,{" "}
            <code>kubectl rollout restart deploy/…</code> is the clearest
            one-Deployment path.
          </Callout>

          <p className="font-medium text-ink">Avoid (rolls every app)</p>
          <CodeBlock>{`# Restarts frontend AND backend — only when you mean it
helm upgrade template-app . -n template --set rolloutDate="$(date +%s)"`}</CodeBlock>
        </Step>

        <Step n={10} title="Argo CD (GitOps)">
          <p>
            Argo CD keeps the cluster in sync with Git. Install it into{" "}
            <code className="text-accent">template-argocd</code>, point an
            Application at <code className="text-accent">infra/helm/app</code>,
            then Sync from the UI. Full notes:{" "}
            <code className="text-accent">infra/helm/argocd/README.md</code>.
          </p>
          <CodeBlock title="install Argo CD">{`helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

helm upgrade --install template-argocd argo/argo-cd \\
  --namespace template-argocd --create-namespace \\
  -f infra/helm/argocd/values.yaml \\
  --wait --timeout 10m

# Admin password
kubectl -n template-argocd get secret argocd-initial-admin-secret \\
  -o jsonpath='{.data.password}' | base64 -d; echo

# UI → http://localhost:8081  (user: admin)
kubectl -n template-argocd port-forward svc/template-argocd-server 8081:80`}</CodeBlock>
          <CodeBlock title="register the Helm app">{`# Edit REPLACE_WITH_YOUR_GIT_REPO first
kubectl apply -f infra/helm/argocd/application-template-app.yaml
# Then Sync in the UI (or: argocd app sync template-app)`}</CodeBlock>
          <Callout>
            On kind, Argo syncs YAML from Git. It does{" "}
            <strong className="text-ink">not</strong> build images. For{" "}
            <code>:local</code> tags still run step 9 (build → kind load →
            rollout restart one Deployment).
          </Callout>
        </Step>

        <Step n={11} title="Production path (Terraform + GKE)">
          <p>
            <strong className="text-ink">Terraform</strong> under{" "}
            <code className="text-accent">infra/terraform/</code> is{" "}
            <strong className="text-ink">GCP-only</strong>. It creates the VPC,
            GKE cluster, Artifact Registry, Secret Manager wiring,
            ingress-nginx, and GitHub Actions Workload Identity.
          </p>
          <CodeBlock title="apply infrastructure">{`cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# edit: project_id, github_repository, alert_email

terraform init
terraform apply

eval "$(terraform output -raw get_credentials_command)"`}</CodeBlock>
          <p>
            Build, push to Artifact Registry, then Helm with production values (
            <code className="text-accent">secrets.provider: csi</code>, HPA on,
            backend on):
          </p>
          <CodeBlock title="deploy app to GKE">{`REGION=$(terraform output -raw region)
REGISTRY=$(terraform output -raw artifact_registry_url)
TAG=$(git rev-parse HEAD)
PROJECT=$(terraform output -raw project_id)
GCP_SA=$(terraform output -raw workload_app_service_account)

gcloud auth configure-docker "\${REGION}-docker.pkg.dev" --quiet
docker build -t "\${REGISTRY}/backend:\${TAG}" ../../services/backend && docker push "\${REGISTRY}/backend:\${TAG}"
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=/api \\
  -t "\${REGISTRY}/frontend:\${TAG}" ../../services/frontend && docker push "\${REGISTRY}/frontend:\${TAG}"

helm upgrade --install template-app ../helm/app \\
  --namespace template --create-namespace --wait --timeout 10m \\
  -f ../helm/app/values.yaml \\
  -f ../helm/app/values-production.yaml \\
  --set global.projectId="\${PROJECT}" \\
  --set global.gcpServiceAccount="\${GCP_SA}" \\
  --set apps.frontend.image.repository="\${REGISTRY}/frontend" \\
  --set apps.frontend.image.tag="\${TAG}" \\
  --set apps.backend.image.repository="\${REGISTRY}/backend" \\
  --set apps.backend.image.tag="\${TAG}"`}</CodeBlock>
          <p>
            For EKS / AKS, bring your own cluster and use{" "}
            <code className="text-accent">values-aws.yaml</code> /{" "}
            <code className="text-accent">values-azure.yaml</code> — same app
            chart, different registry and secrets provider.
          </p>
        </Step>

        <Step n={12} title="Rollback (Helm or kubectl)">
          <p>
            A bad deploy can be undone two ways. Prefer{" "}
            <strong className="text-ink">Helm</strong> when the release/values
            are wrong; use <strong className="text-ink">kubectl</strong> to undo
            a single Deployment’s pod template (for example a bad image tag).
          </p>

          <p className="font-medium text-ink">Helm rollback (full release)</p>
          <CodeBlock title="helm history + rollback">{`# See revisions for template-app
helm history template-app -n template

# Previous revision
helm rollback template-app -n template --wait

# Specific revision (example: 18)
helm rollback template-app 18 -n template --wait

helm status template-app -n template
kubectl -n template get pods`}</CodeBlock>

          <p className="font-medium text-ink">
            kubectl rollout undo (one Deployment)
          </p>
          <CodeBlock title="kubectl rollout">{`kubectl -n template rollout history deploy/deployment-frontend
kubectl -n template rollout history deploy/deployment-fastapi

# Undo last change to that Deployment
kubectl -n template rollout undo deploy/deployment-frontend
kubectl -n template rollout undo deploy/deployment-fastapi

# Or jump to a revision from history
kubectl -n template rollout undo deploy/deployment-frontend --to-revision=2

kubectl -n template rollout status deploy/deployment-frontend`}</CodeBlock>

          <Callout>
            <code>helm rollback</code> restores chart objects and values.{" "}
            <code>kubectl rollout undo</code> only rolls back that Deployment’s
            ReplicaSet. A later <code>helm upgrade</code> can overwrite a
            kubectl undo — use Helm for chart-driven releases.
          </Callout>
        </Step>

        <Step n={13} title="How the pieces connect">
          <p>Mental model of ownership:</p>
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong className="text-ink">Backend / Frontend code</strong> —
              business logic and UI. Run with uvicorn /{" "}
              <code className="text-accent">npm run dev</code> for day-to-day
              coding.
            </li>
            <li>
              <strong className="text-ink">Dockerfile</strong> — packages each
              app into an image (Chainguard bases for fewer CVEs).
            </li>
            <li>
              <strong className="text-ink">Helm (`apps.*`)</strong> — declares{" "}
              <em>how many</em> pods, env, probes, ingress paths, HPA. One
              template set; many workloads via values.
            </li>
            <li>
              <strong className="text-ink">Kubernetes</strong> — runs those
              pods, routes via Services + Ingress, restarts failed containers.
            </li>
            <li>
              <strong className="text-ink">Terraform</strong> — creates the{" "}
              <em>cloud</em> platform (cluster, registry, IAM). Not required for
              local kind.
            </li>
            <li>
              <strong className="text-ink">Argo CD</strong> — optional GitOps:
              syncs the Helm chart from Git into{" "}
              <code className="text-accent">template</code> (ns{" "}
              <code className="text-accent">template-argocd</code>).
            </li>
            <li>
              <strong className="text-ink">Prometheus / Grafana</strong> —
              scrape and visualize; optional sibling install in{" "}
              <code className="text-accent">template-monitoring</code>.
            </li>
          </ul>
          <p className="pt-2">
            Recommended order the first time:{" "}
            <strong className="text-ink">
              backend → frontend → ingress-nginx → build/load images → helm app
              → port-forward → (optional) monitoring → (optional) Argo CD →
              (optional) Terraform/GKE
            </strong>
            . Day-to-day on kind: build → kind load →{" "}
            <code className="text-accent">rollout restart</code>{" "}
            <strong className="text-ink">one</strong> Deployment.
          </p>
          <CodeBlock title="one-page checklist">{`# 1 API
cd services/backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# 2 UI
cd services/frontend && npm run dev

# 3 Cluster app
cd infra/helm/app
helm upgrade --install template-app . -n template --create-namespace --wait
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80

# 4 New frontend image on kind (one Deployment only)
docker build -t template-frontend:local --build-arg NEXT_PUBLIC_API_BASE_URL=/api services/frontend
kind load docker-image template-frontend:local -n template
kubectl -n template rollout restart deploy/deployment-frontend

# 5 Metrics (optional)
helm upgrade --install template-monitoring prometheus-community/kube-prometheus-stack \\
  -n template-monitoring --create-namespace -f ../monitoring/values.yaml --wait

# 6 Argo CD (optional)
helm upgrade --install template-argocd argo/argo-cd \\
  -n template-argocd --create-namespace -f ../argocd/values.yaml --wait

# 7 Rollback if needed
helm history template-app -n template
helm rollback template-app -n template --wait
# or: kubectl -n template rollout undo deploy/deployment-frontend`}</CodeBlock>
        </Step>

        <footer className="mt-8 border-t border-line pt-10 text-sm text-muted">
          <p>
            Deeper reference:{" "}
            <code className="text-accent">services/backend/README.md</code>,{" "}
            <code className="text-accent">services/frontend/README.md</code>,{" "}
            <code className="text-accent">infra/helm/app/README.md</code>,{" "}
            <code className="text-accent">infra/helm/monitoring/README.md</code>,{" "}
            <code className="text-accent">infra/helm/argocd/README.md</code>.
          </p>
          <p className="mt-6">
            <Link href="/" className="text-accent hover:underline">
              ← Back to home
            </Link>
          </p>
        </footer>
      </article>
    </div>
  );
}
