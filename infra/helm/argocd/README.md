# Argo CD (GitOps)

Installs [Argo CD](https://argo-cd.readthedocs.io/) into namespace **`template-argocd`**.
Argo CD watches Git (or a local path via a repo) and syncs the Helm chart into
`template` so cluster state matches the repo.

> Local kind still needs **`docker build` + `kind load`** for `*:local` images
> (`imagePullPolicy: Never`). Argo syncs manifests; it does not build images.

---

## Install

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update

cd infra/helm/argocd

helm upgrade --install template-argocd argo/argo-cd \
  --namespace template-argocd \
  --create-namespace \
  -f values.yaml \
  --wait --timeout 10m
```

Initial admin password:

```bash
kubectl -n template-argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d; echo
# user: admin
```

---

## Open the UI

Browsers often force **HTTPS** on `localhost`. Keep Argo TLS on (no `--insecure`)
and port-forward the HTTPS service port:

```bash
kubectl -n template-argocd port-forward svc/template-argocd-server 8081:443
# https://127.0.0.1:8081  (accept the self-signed cert warning)
# user: admin  /  password from secret above
```

Do **not** open `http://` after this change — use `https://`.

Optional CLI:

```bash
brew install argocd   # or see Argo CD install docs
argocd login 127.0.0.1:8081 --username admin --password '<password>' --insecure
```

---

## Register the app (Application CR)

From repo root, apply an Application that points at `infra/helm/app`:

```bash
kubectl apply -f infra/helm/argocd/application-template-app.yaml
```

Or create it in the UI: **New App** →

| Field | Value |
|-------|--------|
| Application Name | `template-app` |
| Project | `default` |
| Sync Policy | Manual (local) or Automatic |
| Repository URL | your Git remote (HTTPS/SSH) |
| Path | `infra/helm/app` |
| Cluster | `https://kubernetes.default.svc` |
| Namespace | `template` |
| Helm values files | `values.yaml` |

For a **private repo**, add credentials under Settings → Repositories (or
`argocd repo add …`).

### Local-only (no Git remote yet)

You can still use Helm/kubectl as before. Argo CD shines once the chart is in
Git. Until then, sync from CLI against a file repo is advanced; prefer Git.

---

## Day-2 with Argo CD

1. Push chart/values changes to Git.
2. In UI: **Refresh** → **Sync** (or rely on auto-sync).
3. For a new **local** image on kind (same tag `local`):

```bash
# Build + load (Argo does not do this)
docker build -t template-frontend:local --build-arg NEXT_PUBLIC_API_BASE_URL=/api services/frontend
kind load docker-image template-frontend:local -n template

# Restart only that Deployment (do not use global rolloutDate)
kubectl -n template rollout restart deploy/deployment-frontend
```

Or bump an annotation via a Git change / Application parameter so Argo syncs a
new pod template for **one** app only (`apps.frontend…`), not a global
`rolloutDate`.

---

## Verify

```bash
kubectl -n template-argocd get pods
kubectl get applications -A
argocd app get template-app    # if CLI logged in
```

---

## Uninstall

```bash
kubectl delete -f infra/helm/argocd/application-template-app.yaml --ignore-not-found
helm uninstall template-argocd -n template-argocd
kubectl delete namespace template-argocd
```

---

## Files

```text
helm/argocd/
├── values.yaml                      # argo-cd chart overrides
├── application-template-app.yaml    # Application CR example
└── README.md
```
