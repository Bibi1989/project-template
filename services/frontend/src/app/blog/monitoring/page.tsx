import type { Metadata } from "next";
import Link from "next/link";

import { Callout, CodeBlock, Step } from "@/components/blog";

export const metadata: Metadata = {
  title: "Monitoring, logging & observability — Template",
  description:
    "Step-by-step: FastAPI /metrics, structured logs, kube-prometheus-stack with Helm, ServiceMonitor, and GKE Managed Prometheus",
};

const TOC = [
  { n: 1, title: "What this stack covers" },
  { n: 2, title: "How the pieces connect" },
  { n: 3, title: "Instrument the backend (code)" },
  { n: 4, title: "Structured logging (code + Helm)" },
  { n: 5, title: "App chart: scrape wiring" },
  { n: 6, title: "Install Prometheus + Grafana" },
  { n: 7, title: "Enable ServiceMonitors" },
  { n: 8, title: "Verify scrape targets" },
  { n: 9, title: "Query metrics (PromQL + Grafana)" },
  { n: 10, title: "Read and filter logs" },
  { n: 11, title: "GKE: GMP, Cloud Logging, alerts" },
  { n: 12, title: "AWS / Azure notes" },
  { n: 13, title: "Troubleshoot & uninstall" },
] as const;

export default function MonitoringBlogPage() {
  return (
    <div className="relative min-h-screen">
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
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/blog" className="hover:text-ink">
            Setup guide
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
          <a href="#toc" className="hover:text-ink">
            Contents
          </a>
        </nav>
      </header>

      <article className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-16">
        <p className="font-display text-5xl font-extrabold tracking-tight text-ink md:text-6xl">
          Template
        </p>
        <h1 className="mt-4 max-w-xl text-xl font-medium leading-snug text-ink/90 md:text-2xl">
          Monitoring, logging, and observability — from code to Helm to GKE
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted">
          A thorough walkthrough of how this monorepo exposes metrics and logs,
          scrapes them with Prometheus (local) or Google Managed Prometheus
          (GKE), and surfaces them in Grafana and Cloud Logging.
        </p>
        <p className="mt-6 font-mono text-xs text-accent">
          ~20 min read · Helm + FastAPI · copy-paste commands
        </p>

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

        <Step n={1} title="What this stack covers">
          <p>
            In this template,{" "}
            <strong className="font-medium text-ink">observability</strong>{" "}
            means three practical layers — not a full APM suite:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-ink">Metrics</strong> — FastAPI exposes{" "}
              <code className="text-accent">/metrics</code>; Prometheus (or GMP
              on GKE) scrapes them; Grafana graphs them.
            </li>
            <li>
              <strong className="text-ink">Logs</strong> — stdout JSON from the
              backend;{" "}
              <code className="text-accent">kubectl logs</code> locally, Cloud
              Logging on GKE, optional GCS sink via Terraform.
            </li>
            <li>
              <strong className="text-ink">Alerts</strong> — Alertmanager in the
              monitoring Helm release locally; Cloud Monitoring email alerts
              from Terraform{" "}
              <code className="text-accent">modules/ops</code> on GKE.
            </li>
          </ul>
          <Callout>
            There is no Loki, Tempo, OpenTelemetry collector, or Datadog in this
            repo. Distributed tracing is out of scope — add it later if you need
            request spans across services.
          </Callout>
          <p>
            Prerequisite: a running cluster with the app chart installed (see the{" "}
            <Link href="/blog#step-6" className="text-accent hover:underline">
              setup guide
            </Link>
            ). Monitoring is a{" "}
            <strong className="text-ink">separate Helm release</strong> so app
            deploys stay light.
          </p>
        </Step>

        <Step n={2} title="How the pieces connect">
          <CodeBlock title="observability path">{`FastAPI  /metrics
    │
    ├── prometheus.io/* annotations  ──► kube-prometheus-stack (local / any)
    ├── ServiceMonitor CR            ──► same (Prometheus Operator)
    └── PodMonitoring CR (GKE only)  ──► Google Managed Prometheus

stdout JSON logs
    ├── kubectl logs                 (local / any)
    └── GKE → Cloud Logging → optional GCS sink (terraform/modules/ops)

Grafana ◄── Prometheus (in-cluster)
Cloud Monitoring alerts ◄── terraform ops (pod restarts)`}</CodeBlock>
          <p>
            Key paths:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <code className="text-accent">infra/helm/monitoring/</code> —
              values overlay for{" "}
              <code className="text-accent">kube-prometheus-stack</code>
            </li>
            <li>
              <code className="text-accent">infra/helm/app/templates/</code> —{" "}
              <code className="text-accent">servicemonitor.yaml</code>,{" "}
              <code className="text-accent">podmonitoring.yaml</code>,{" "}
              <code className="text-accent">logging-configmap.yaml</code>,
              scrape annotations on Deployments
            </li>
            <li>
              <code className="text-accent">services/backend/app/main.py</code> —{" "}
              Instrumentator + structured logging
            </li>
          </ul>
        </Step>

        <Step n={3} title="Instrument the backend (code)">
          <p>
            Metrics come from{" "}
            <code className="text-accent">prometheus-fastapi-instrumentator</code>{" "}
            in{" "}
            <code className="text-accent">services/backend/requirements.txt</code>
            . The app instruments HTTP handlers and exposes Prometheus text at{" "}
            <code className="text-accent">/metrics</code> (excluded from OpenAPI
            and from self-scrape noise).
          </p>
          <CodeBlock title="services/backend/app/main.py (metrics)">{`from prometheus_fastapi_instrumentator import Instrumentator

# Prometheus metrics at /metrics (scraped by annotations / ServiceMonitor / GMP)
Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    excluded_handlers=["/metrics", "/health"],
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)`}</CodeBlock>
          <p>
            Try it locally before Kubernetes:
          </p>
          <CodeBlock title="smoke-test /metrics">{`# with the API running on :8000
curl -s http://127.0.0.1:8000/metrics | head
# expect lines like: http_requests_total{...} 1.0`}</CodeBlock>
          <Callout>
            The Next.js frontend has no{" "}
            <code className="text-accent">/metrics</code> endpoint. Keep{" "}
            <code className="text-accent">apps.frontend.monitoring.scrape</code>{" "}
            and{" "}
            <code className="text-accent">serviceMonitor</code> off (or you will
            get scrape failures / empty targets).
          </Callout>
        </Step>

        <Step n={4} title="Structured logging (code + Helm)">
          <p>
            Logging is configured at process start from env vars. With{" "}
            <code className="text-accent">STRUCTURED_LOGS=true</code>, each line
            is JSON-ish so Cloud Logging can parse severity and message.
          </p>
          <CodeBlock title="services/backend/app/main.py (logging)">{`def _configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "info").upper()
    level = getattr(logging, level_name, logging.INFO)
    structured = os.getenv("STRUCTURED_LOGS", "true").lower() in {"1", "true", "yes"}

    handler = logging.StreamHandler(sys.stdout)
    if structured:
        handler.setFormatter(
            logging.Formatter(
                '{"severity":"%(levelname)s","message":"%(message)s",'
                '"logger":"%(name)s","time":"%(asctime)s"}'
            )
        )
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )
    # ... attach to root logger`}</CodeBlock>
          <p>
            The app chart injects those env vars from{" "}
            <code className="text-accent">values.yaml</code> and an optional
            ConfigMap that also documents a Cloud Logging filter:
          </p>
          <CodeBlock title="infra/helm/app/values.yaml (logging)">{`logging:
  level: debug          # production overlay uses info
  structured: "true"
  configMap:
    enabled: true`}</CodeBlock>
          <CodeBlock title="Deployment env (from chart)">{`# deployment.yaml injects:
- name: LOG_LEVEL
  value: {{ .Values.logging.level | quote }}
- name: STRUCTURED_LOGS
  valueFrom:
    configMapKeyRef:
      name: template-app-logging   # release-name-logging
      key: STRUCTURED_LOGS`}</CodeBlock>
        </Step>

        <Step n={5} title="App chart: scrape wiring">
          <p>
            Three independent mechanisms — turn on what your cluster supports:
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <strong className="text-ink">Pod annotations</strong> — when{" "}
              <code className="text-accent">monitoring.scrapeAnnotations</code>{" "}
              and <code className="text-accent">apps.*.monitoring.scrape</code>{" "}
              are true, the Deployment gets{" "}
              <code className="text-accent">prometheus.io/scrape</code>,{" "}
              <code className="text-accent">port</code>, and{" "}
              <code className="text-accent">path</code>. The monitoring values
              file adds a scrape job that discovers pods in the{" "}
              <code className="text-accent">template</code> namespace.
            </li>
            <li>
              <strong className="text-ink">ServiceMonitor</strong> — Prometheus
              Operator CR; needs kube-prometheus-stack CRDs. Global gate{" "}
              <code className="text-accent">monitoring.serviceMonitor.enabled</code>{" "}
              plus per-app{" "}
              <code className="text-accent">apps.backend.monitoring.serviceMonitor</code>.
            </li>
            <li>
              <strong className="text-ink">PodMonitoring</strong> — GKE Google
              Managed Prometheus only (
              <code className="text-accent">monitoring.googleapis.com/v1</code>
              ). Global{" "}
              <code className="text-accent">monitoring.podMonitoring.enabled</code>{" "}
              plus per-app{" "}
              <code className="text-accent">apps.backend.monitoring.podMonitoring</code>.
            </li>
          </ol>
          <CodeBlock title="recommended local values (backend only)">{`monitoring:
  scrapeAnnotations: true
  serviceMonitor:
    enabled: true
    interval: 30s
  podMonitoring:
    enabled: true      # harmless on kind; CR only renders when per-app is true
    interval: 30s

apps:
  backend:
    monitoring:
      scrape: true
      path: /metrics
      serviceMonitor: true
      podMonitoring: false   # enable on GKE production
  frontend:
    monitoring:
      scrape: false
      serviceMonitor: false
      podMonitoring: false`}</CodeBlock>
          <p>
            Rendered ServiceMonitor shape (from{" "}
            <code className="text-accent">templates/servicemonitor.yaml</code>):
          </p>
          <CodeBlock title="ServiceMonitor (conceptual)">{`apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: service-backend
spec:
  selector:
    matchLabels:
      app.kubernetes.io/instance: template-app
      app.kubernetes.io/component: backend
  namespaceSelector:
    matchNames: ["template"]
  endpoints:
    - port: http
      path: /metrics
      interval: 30s`}</CodeBlock>
        </Step>

        <Step n={6} title="Install Prometheus + Grafana">
          <p>
            Values live in{" "}
            <code className="text-accent">infra/helm/monitoring/values.yaml</code>
            . Important defaults for kind / small clusters: no PVC (empty{" "}
            <code className="text-accent">storageSpec</code>), 7-day retention,
            Grafana password{" "}
            <code className="text-accent">changeme</code>, and Prometheus
            selectors that discover ServiceMonitors in{" "}
            <strong className="text-ink">any</strong> namespace (not only the
            monitoring release).
          </p>
          <CodeBlock title="install kube-prometheus-stack">{`helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install template-monitoring prometheus-community/kube-prometheus-stack \\
  --namespace template-monitoring \\
  --create-namespace \\
  -f infra/helm/monitoring/values.yaml \\
  --wait --timeout 10m`}</CodeBlock>
          <CodeBlock title="set a real Grafana password">{`helm upgrade template-monitoring prometheus-community/kube-prometheus-stack \\
  -n template-monitoring \\
  -f infra/helm/monitoring/values.yaml \\
  --set grafana.adminPassword='YOUR_STRONG_PASSWORD'`}</CodeBlock>
          <CodeBlock title="open UIs (port-forward)">{`# Grafana → http://localhost:3001  (admin / changeme or your password)
kubectl -n template-monitoring port-forward svc/template-monitoring-grafana 3001:80

# Prometheus → http://localhost:9090
kubectl -n template-monitoring port-forward svc/template-monitoring-prometheus 9090:9090`}</CodeBlock>
          <Callout>
            HPA still uses metrics-server (CPU/memory), not Prometheus.
            Prometheus is for dashboards, PromQL, and Alertmanager — not for
            autoscaling in this template.
          </Callout>
        </Step>

        <Step n={7} title="Enable ServiceMonitors">
          <p>
            After the Operator CRDs exist, upgrade the app chart so the backend
            gets a ServiceMonitor (and keep scrape annotations on for the
            annotation-based job).
          </p>
          <CodeBlock title="wire the app chart">{`helm upgrade template-app infra/helm/app -n template \\
  --reuse-values \\
  --set monitoring.serviceMonitor.enabled=true \\
  --set monitoring.scrapeAnnotations=true \\
  --set apps.backend.monitoring.scrape=true \\
  --set apps.backend.monitoring.serviceMonitor=true \\
  --set apps.backend.monitoring.path=/metrics \\
  --set apps.frontend.monitoring.scrape=false \\
  --set apps.frontend.monitoring.serviceMonitor=false`}</CodeBlock>
          <CodeBlock title="confirm CRs">{`kubectl -n template get servicemonitor
kubectl -n template-monitoring get prometheus
kubectl get crd | grep monitoring.coreos.com`}</CodeBlock>
        </Step>

        <Step n={8} title="Verify scrape targets">
          <p>
            In Prometheus UI → <strong className="text-ink">Status → Targets</strong>.
            Look for:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <code className="text-accent">kubernetes-pods-annotations</code> —
              pods with <code className="text-accent">prometheus.io/scrape=true</code>{" "}
              in namespace <code className="text-accent">template</code>
            </li>
            <li>
              ServiceMonitor-derived jobs for{" "}
              <code className="text-accent">service-backend</code>
            </li>
          </ul>
          <CodeBlock title="CLI checks">{`# pods healthy?
kubectl -n template-monitoring get pods

# hit metrics through the Service
kubectl -n template port-forward svc/service-backend 8000:8000
curl -s http://127.0.0.1:8000/metrics | grep http_requests_total | head

# generate traffic then re-check
curl -s http://127.0.0.1:8000/health
curl -s -X POST http://127.0.0.1:8000/echo -H 'content-type: application/json' -d '{"message":"hi"}'`}</CodeBlock>
        </Step>

        <Step n={9} title="Query metrics (PromQL + Grafana)">
          <p>
            Grafana ships with default Kubernetes dashboards from the chart.
            Add a panel (or use Explore) against the pre-provisioned Prometheus
            datasource.
          </p>
          <CodeBlock title="useful PromQL">{`# HTTP request rate (instrumentator)
rate(http_requests_total{namespace="template"}[5m])

# Error-ish status codes (grouped by instrumentator)
rate(http_requests_total{namespace="template",status=~"5.."}[5m])

# Latency if histogram series are present
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="template"}[5m])) by (le))`}</CodeBlock>
          <p>
            Exact metric names can vary slightly by instrumentator version —
            browse <code className="text-accent">/metrics</code> or Prometheus
            autocomplete if a query returns empty.
          </p>
        </Step>

        <Step n={10} title="Read and filter logs">
          <p>
            Locally, logs are just container stdout:
          </p>
          <CodeBlock title="kubectl logs">{`kubectl -n template logs -l app.kubernetes.io/component=backend --tail=100 -f

# one pod
kubectl -n template logs deploy/deployment-fastapi --tail=50`}</CodeBlock>
          <p>
            On GKE, the logging ConfigMap documents a starting filter (also
            usable in Logs Explorer):
          </p>
          <CodeBlock title="Cloud Logging filter example">{`resource.type="k8s_container"
resource.labels.namespace_name="template"
labels."k8s-pod/app_kubernetes_io/instance"="template-app"`}</CodeBlock>
          <p>
            Dump the helper ConfigMap anytime:
          </p>
          <CodeBlock title="inspect logging ConfigMap">{`kubectl -n template get configmap template-app-logging -o yaml`}</CodeBlock>
        </Step>

        <Step n={11} title="GKE: GMP, Cloud Logging, alerts">
          <p>
            Terraform turns on Managed Prometheus on the cluster and a minimal
            ops baseline (email alerts, log sink to GCS, Backup for GKE). In-cluster
            Grafana remains optional — install the same monitoring chart if you
            want dashboards inside the cluster.
          </p>
          <CodeBlock title="enable GMP PodMonitoring for backend">{`# values-production.yaml already sets:
#   apps.backend.monitoring.podMonitoring: true
#   monitoring.podMonitoring.enabled: true
#   logging.level: info

helm upgrade template-app infra/helm/app -n template \\
  -f infra/helm/app/values.yaml \\
  -f infra/helm/app/values-production.yaml`}</CodeBlock>
          <CodeBlock title="PodMonitoring (conceptual)">{`apiVersion: monitoring.googleapis.com/v1
kind: PodMonitoring
metadata:
  name: backend
spec:
  selector:
    matchLabels:
      app.kubernetes.io/component: backend
  endpoints:
    - port: http
      path: /metrics
      interval: 15s   # production interval`}</CodeBlock>
          <p>
            Terraform{" "}
            <code className="text-accent">infra/terraform/modules/ops</code>{" "}
            (when <code className="text-accent">alert_email</code> is set)
            creates:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Email notification channel</li>
            <li>Alert policy on elevated container restart rate</li>
            <li>GCS bucket + Logging sink for GKE container/cluster/node logs (90-day lifecycle)</li>
          </ul>
          <Callout>
            See{" "}
            <Link href="/blog/terraform" className="text-accent hover:underline">
              Terraform docs
            </Link>{" "}
            for the ops module and GKE logging/monitoring API enablement. Argo
            CD syncs the <strong className="text-ink">app</strong> chart only —
            install monitoring separately (or add an Application) if you want
            in-cluster Prometheus on GKE.
          </Callout>
        </Step>

        <Step n={12} title="AWS / Azure notes">
          <p>
            Use the same{" "}
            <code className="text-accent">kube-prometheus-stack</code> path for
            metrics. Cloud-specific overlays turn GMP off:
          </p>
          <CodeBlock title="values-aws.yaml / values-azure.yaml">{`monitoring:
  podMonitoring:
    enabled: false`}</CodeBlock>
          <p>
            Pulumi AWS provisions VPC / EKS / ECR / IRSA — not CloudWatch agents
            or AMP. Pair{" "}
            <code className="text-accent">values-aws.yaml</code> with the
            monitoring Helm release in{" "}
            <code className="text-accent">template-monitoring</code> (or your
            preferred AWS metrics backend).
          </p>
        </Step>

        <Step n={13} title="Troubleshoot & uninstall">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong className="text-ink">Target down</strong> — confirm{" "}
              <code className="text-accent">/metrics</code> works via
              port-forward; check annotations on the pod; ensure frontend scrape
              is false.
            </li>
            <li>
              <strong className="text-ink">No ServiceMonitor</strong> — Operator
              CRDs missing? Install monitoring first. Chart only renders when{" "}
              <code className="text-accent">monitoring.coreos.com/v1</code> is
              present.
            </li>
            <li>
              <strong className="text-ink">Empty PromQL</strong> — wrong
              namespace label, or series not scraped yet; hit the API a few
              times and wait one scrape interval (~30s).
            </li>
            <li>
              <strong className="text-ink">PodMonitoring ignored</strong> — only
              on GKE with Managed Prometheus enabled; AWS/Azure overlays disable
              it.
            </li>
          </ul>
          <CodeBlock title="uninstall monitoring stack">{`helm uninstall template-monitoring -n template-monitoring
kubectl delete namespace template-monitoring

# Optional: remove Operator CRDs (affects any other monitoring.coreos.com installs)
# kubectl get crd | grep monitoring.coreos.com`}</CodeBlock>
          <CodeBlock title="rollback monitoring release">{`helm history template-monitoring -n template-monitoring
helm rollback template-monitoring -n template-monitoring --wait`}</CodeBlock>
          <p className="pt-2">
            More detail:{" "}
            <code className="text-accent">infra/helm/monitoring/README.md</code>{" "}
            and the short overview in the{" "}
            <Link href="/blog#step-8" className="text-accent hover:underline">
              setup guide · step 8
            </Link>
            .
          </p>
        </Step>

        <footer className="mt-8 border-t border-line pt-10 text-sm text-muted">
          <Link href="/blog" className="text-accent hover:underline">
            ← Back to setup guide
          </Link>
          <span className="mx-3 text-line">·</span>
          <Link href="/blog/terraform" className="text-accent hover:underline">
            Terraform
          </Link>
          <span className="mx-3 text-line">·</span>
          <Link href="/blog/pulumi" className="text-accent hover:underline">
            Pulumi
          </Link>
          <span className="mx-3 text-line">·</span>
          <Link
            href="/blog/github-actions"
            className="text-accent hover:underline"
          >
            GitHub Actions
          </Link>
        </footer>
      </article>
    </div>
  );
}
