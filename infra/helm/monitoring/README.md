# Monitoring stack (Prometheus + Grafana)

Installs [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) into namespace `template-monitoring`.

App metrics:

- FastAPI: `/metrics` (backend)
- Pod annotations from the app chart (`prometheus.io/scrape`) when `monitoring.scrapeAnnotations: true`
- Optional `ServiceMonitor` CRs from the app chart when `monitoring.serviceMonitor.enabled: true`

> GKE also has **Google Managed Prometheus** (`PodMonitoring` in the app chart). This stack is for **local / kind / any cluster** (and optional on GKE if you want in-cluster Grafana).

---



## Install

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

cd infra/helm/monitoring

helm upgrade --install template-monitoring prometheus-community/kube-prometheus-stack \
  --namespace template-monitoring \
  --create-namespace \
  -f values.yaml \
  --wait --timeout 10m
```

Change the Grafana password (do not leave `changeme` in shared environments):

```bash
helm upgrade template-monitoring prometheus-community/kube-prometheus-stack \
  -n template-monitoring -f values.yaml \
  --set grafana.adminPassword='YOUR_STRONG_PASSWORD'
```

---



## Open UIs (port-forward)

**Grafana** (dashboards):

```bash
kubectl -n template-monitoring port-forward svc/template-monitoring-grafana 8888:80
# http://localhost:8888
# user: admin  /  password: changeme  (or what you set)
```

**Prometheus** (targets / query):

```bash
kubectl -n template-monitoring port-forward \
  svc/template-monitoring-prometheus 9090:9090
# http://localhost:9090
# Status → Targets — look for kubernetes-pods-annotations and ServiceMonitors
```

> List services anytime with: `kubectl -n template-monitoring get svc`

---



## Wire the app chart

In `../app/values.yaml` (or via `--set`):

```yaml
monitoring:
  scrapeAnnotations: true
  serviceMonitor:
    enabled: true          # needs Prometheus Operator CRDs (this stack)
    interval: 30s

apps:
  backend:
    enabled: true
    monitoring:
      scrape: true
      path: /metrics
      serviceMonitor: true # create ServiceMonitor for this app
  frontend:
    monitoring:
      scrape: false        # Next.js has no /metrics by default
      serviceMonitor: false
```

Then upgrade the app:

```bash
cd ../app
helm upgrade template-app . -n template --reuse-values \
  --set monitoring.serviceMonitor.enabled=true \
  --set apps.backend.monitoring.serviceMonitor=true
```

Example PromQL once scraped:

```promql
# Request rate (FastAPI / instrumentator)
rate(http_requests_total{namespace="template"}[5m])
```

---



## Verify

```bash
kubectl -n template-monitoring get pods
kubectl -n template-monitoring get prometheus,servicemonitor -A
kubectl -n template get servicemonitor   # after enabling app ServiceMonitors
```

---



## Uninstall

```bash
helm uninstall template-monitoring -n template-monitoring
kubectl delete namespace template-monitoring

# Optional: remove CRDs (affects any other Operator installs)
# kubectl get crd | grep monitoring.coreos.com
```

## Rollback

Same pattern as the app release:

```bash
helm history template-monitoring -n template-monitoring
helm rollback template-monitoring -n template-monitoring --wait

# Grafana Deployment only (if needed):
kubectl -n template-monitoring rollout undo deploy/template-monitoring-grafana
```

---



## Files

```text
helm/monitoring/
├── values.yaml   # kube-prometheus-stack overrides
└── README.md
```

