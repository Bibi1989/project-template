export type GithubActionsDocPage = {
  slug: string;
  title: string;
  blurb: string;
  path: string;
  what: string;
  why: string;
  provisions: string[];
  steps: { title: string; detail: string }[];
  examples: { title: string; code: string }[];
  notes?: string[];
};

export const GITHUB_ACTIONS_PAGES: GithubActionsDocPage[] = [
  {
    slug: "overview",
    title: "CI/CD pipeline overview",
    blurb: "How PR CI and main-branch deploys fit together.",
    path: ".github/workflows",
    what: "Three workflows live at the repo root under .github/workflows (the only path GitHub Actions runs). CI validates every push and pull request. Deploy Frontend / Deploy Backend authenticate with Workload Identity Federation, build and push images to Artifact Registry, then Helm-upgrade GKE when paths under services/* change.",
    why: "Keeping Actions at the monorepo root (not under services/*) means one place for variables, WIF, and path filters. CI guards every change; deploys ship only the service that changed.",
    provisions: [
      "ci.yml — lint, unit test, frontend build on push/PR",
      "deploy-frontend.yml — GAR push + Helm (frontend image)",
      "deploy-backend.yml — GAR push + Helm (backend image)",
      "Workload Identity Federation — keyless GCP auth from GitHub",
    ],
    steps: [
      {
        title: "1. Open a PR or push to main",
        detail: "GitHub starts CI immediately. Path filters do not apply to CI — both frontend and backend jobs run so regressions do not slip through.",
      },
      {
        title: "2. CI jobs run in parallel",
        detail: "Frontend: Node from .nvmrc → npm ci → lint → test → build. Backend: Python 3.12 → pip install → ruff → pytest. Concurrency cancels older runs on the same ref.",
      },
      {
        title: "3. Merge / push to main (service paths)",
        detail: "If services/frontend/** (or the frontend workflow file) changed, Deploy Frontend runs. Same for backend. workflow_dispatch lets you re-run a deploy manually.",
      },
      {
        title: "4. Authenticate to GCP",
        detail: "google-github-actions/auth uses WIF (vars.WIF_PROVIDER + vars.WIF_SERVICE_ACCOUNT). No long-lived JSON keys. Needs permissions.id-token: write.",
      },
      {
        title: "5. Build & push image",
        detail: "Docker build tags :$GITHUB_SHA and :latest, then pushes to REGION-docker.pkg.dev/PROJECT/REPO/{frontend|backend}.",
      },
      {
        title: "6. Helm upgrade",
        detail: "helm upgrade --install with --reuse-values and --set only the changed image repository/tag. --atomic --wait rolls back on failure.",
      },
      {
        title: "7. Verify",
        detail: "Job summary shows image ref + release. On the cluster: kubectl rollout status / Argo CD sync health.",
      },
    ],
    examples: [
      {
        title: "Pipeline map",
        code: "pull_request / push → CI (ci.yml)\n  ├── job: frontend  (lint · test · build)\n  └── job: backend   (lint · test)\n\npush main + path filter → Deploy Frontend | Deploy Backend\n  └── WIF → gcloud → docker build/push → helm upgrade\n\nTerraform github_wif module → WIF provider + SA\n  → GitHub repo vars: WIF_PROVIDER, WIF_SERVICE_ACCOUNT, GCP_*, GKE_*, HELM_*",
      },
      {
        title: "Where workflows must live",
        code: "# GitHub only loads this path:\n.github/workflows/\n  ├── ci.yml\n  ├── deploy-frontend.yml\n  └── deploy-backend.yml\n\n# Do NOT rely on:\n# services/frontend/.github/workflows/…\n# services/backend/.github/workflows/…",
      },
    ],
    notes: [
      "Set the GitHub repository variables listed on the setup page before running deploys.",
      "Keep Node 22 for lockfile/CI parity (.nvmrc).",
    ],
  },
  {
    slug: "ci",
    title: "ci.yml — lint, test, build",
    blurb: "Always-on quality gate for frontend and backend.",
    path: ".github/workflows/ci.yml",
    what: "Runs on every push to main and every pull request. Two parallel jobs under services/frontend and services/backend. No deploy, no GCP credentials.",
    why: "Catch type errors, lint, and unit failures before images ship. Uses contents: read only — least privilege for a validation workflow.",
    provisions: [
      "Frontend: setup-node + npm ci + lint + vitest + next build",
      "Backend: setup-python 3.12 + pip + ruff + pytest",
      "Concurrency group cancels in-progress runs on the same ref",
    ],
    steps: [
      {
        title: "Trigger",
        detail: "on.push.branches: [main] and on.pull_request (all branches). No path filters — full gate every time.",
      },
      {
        title: "Concurrency",
        detail: "group: ci-${{ github.workflow }}-${{ github.ref }} with cancel-in-progress: true so a new push supersedes an older CI run.",
      },
      {
        title: "Frontend — Checkout",
        detail: "actions/checkout@v4 clones the monorepo at the commit SHA under test.",
      },
      {
        title: "Frontend — Setup Node",
        detail: "actions/setup-node@v4 reads services/frontend/.nvmrc (Node 22), caches npm via package-lock.json.",
      },
      {
        title: "Frontend — Install",
        detail: "npm ci in services/frontend — clean install from the lockfile (required for reproducible CI).",
      },
      {
        title: "Frontend — Lint / Test / Build",
        detail: "npm run lint, npm test, then npm run build with BACKEND_URL and NEXT_PUBLIC_* so Next can compile without a live API.",
      },
      {
        title: "Backend — Setup Python",
        detail: "actions/setup-python@v5 with 3.12 and pip cache on requirements.txt + requirements-dev.txt.",
      },
      {
        title: "Backend — Install / Lint / Test",
        detail: "pip install runtime + dev deps, ruff check app tests, pytest -q with ENVIRONMENT=test.",
      },
    ],
    examples: [
      {
        title: "ci.yml (full)",
        code: "# Lint, unit test, and build for frontend + backend.\n# GitHub only runs workflows from the repo-root `.github/workflows/` directory\n# (not from services/*/.github/).\nname: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\nconcurrency:\n  group: ci-${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true\n\npermissions:\n  contents: read\n\njobs:\n  frontend:\n    name: Frontend (lint · test · build)\n    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: services/frontend\n\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          # Match services/frontend/.nvmrc and packageManager (npm 10).\n          # Regenerating the lockfile on Node 23/npm 11 (macOS) can omit\n          # @emnapi/* entries that Linux CI expects — always use Node 22.\n          node-version-file: services/frontend/.nvmrc\n          cache: npm\n          cache-dependency-path: services/frontend/package-lock.json\n\n      - name: Install\n        run: npm ci\n\n      - name: Lint\n        run: npm run lint\n\n      - name: Unit tests\n        run: npm test\n\n      - name: Build\n        run: npm run build\n        env:\n          BACKEND_URL: http://127.0.0.1:8000\n          NEXT_PUBLIC_API_BASE_URL: /api\n          NEXT_PUBLIC_APP_URL: http://127.0.0.1:3000\n\n  backend:\n    name: Backend (lint · test)\n    runs-on: ubuntu-latest\n    defaults:\n      run:\n        working-directory: services/backend\n\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Python\n        uses: actions/setup-python@v5\n        with:\n          python-version: \"3.12\"\n          cache: pip\n          cache-dependency-path: |\n            services/backend/requirements.txt\n            services/backend/requirements-dev.txt\n\n      - name: Install\n        run: |\n          python -m pip install --upgrade pip\n          pip install -r requirements.txt -r requirements-dev.txt\n\n      - name: Lint\n        run: ruff check app tests\n\n      - name: Unit tests\n        run: pytest -q\n        env:\n          APP_NAME: template-api\n          ENVIRONMENT: test\n          STRUCTURED_LOGS: \"false\"\n",
      },
    ],
    notes: [
      "working-directory defaults keep every run step inside the service folder.",
      "If npm ci fails on @emnapi/*, regenerate the lockfile under Node 22 — not Node 23/npm 11.",
    ],
  },
  {
    slug: "deploy-frontend",
    title: "deploy-frontend.yml — GAR + Helm",
    blurb: "Build frontend image, push to Artifact Registry, upgrade Helm.",
    path: ".github/workflows/deploy-frontend.yml",
    what: "Path-filtered deploy for services/frontend. Authenticates with WIF, builds and pushes the frontend image to Artifact Registry, then Helm-upgrades apps.frontend.image only.",
    why: "Ship UI changes independently of the API. --reuse-values preserves backend image and chart config while swapping the frontend tag.",
    provisions: [
      "Trigger: push main + paths services/frontend/** or this workflow; workflow_dispatch",
      "Image: REGION-docker.pkg.dev/PROJECT/GAR_REPOSITORY/frontend:$SHA",
      "Helm --set apps.frontend.image.repository / tag",
    ],
    steps: [
      {
        title: "Trigger & concurrency",
        detail: "Only when frontend paths change (or manual dispatch). cancel-in-progress: false so overlapping deploys finish instead of canceling mid-Helm.",
      },
      {
        title: "Auth (WIF)",
        detail: "google-github-actions/auth@v2 with workload_identity_provider + service_account from repo vars. permissions.id-token: write is required.",
      },
      {
        title: "gcloud + Docker + GKE + Helm",
        detail: "setup-gcloud, configure-docker for Artifact Registry, get-gke-credentials, azure/setup-helm.",
      },
      {
        title: "Compute image coordinates",
        detail: "Writes image, tag (= full GITHUB_SHA), short_sha, image_ref to GITHUB_OUTPUT.",
      },
      {
        title: "Build",
        detail: "docker build in services/frontend with NEXT_PUBLIC_API_BASE_URL=/api; tags SHA + latest; OCI labels for revision/source.",
      },
      {
        title: "Push",
        detail: "docker push both tags to Artifact Registry.",
      },
      {
        title: "Helm upgrade",
        detail: "helm upgrade --install release ./infra/helm/app with --atomic --wait --timeout 10m, --set frontend image fields, --reuse-values.",
      },
      {
        title: "Summary",
        detail: "Writes image/release/namespace to $GITHUB_STEP_SUMMARY for the Actions UI.",
      },
    ],
    examples: [
      {
        title: "deploy-frontend.yml (full)",
        code: "# =============================================================================\n# Deploy Frontend → Google Artifact Registry → Helm upgrade on GKE\n# Triggers on pushes to main that touch services/frontend/ (or this workflow).\n#\n# Required GitHub repository variables:\n#   vars.GCP_PROJECT_ID\n#   vars.GCP_REGION                 (e.g. us-central1)\n#   vars.GAR_REPOSITORY             (e.g. template-containers)\n#   vars.GKE_CLUSTER_NAME\n#   vars.GKE_CLUSTER_LOCATION       (region or zone)\n#   vars.HELM_RELEASE_NAME          (e.g. template-app)\n#   vars.HELM_NAMESPACE             (e.g. template)\n#   vars.WIF_PROVIDER               (//iam.googleapis.com/projects/.../providers/...)\n#   vars.WIF_SERVICE_ACCOUNT        (github-actions@PROJECT.iam.gserviceaccount.com)\n# =============================================================================\nname: Deploy Frontend\n\non:\n  push:\n    branches: [main]\n    paths:\n      - \"services/frontend/**\"\n      - \".github/workflows/deploy-frontend.yml\"\n  workflow_dispatch:\n\nconcurrency:\n  group: deploy-frontend-${{ github.ref }}\n  cancel-in-progress: false\n\npermissions:\n  contents: read\n  id-token: write  # required for GCP Workload Identity Federation\n\nenv:\n  SERVICE: frontend\n  IMAGE_NAME: frontend\n  WORKING_DIR: services/frontend\n\njobs:\n  build-and-deploy:\n    name: Build, Push & Helm Upgrade\n    runs-on: ubuntu-latest\n    environment: production\n\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Authenticate to Google Cloud (Workload Identity Federation)\n        id: auth\n        uses: google-github-actions/auth@v2\n        with:\n          workload_identity_provider: ${{ vars.WIF_PROVIDER }}\n          service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}\n          token_format: access_token\n\n      - name: Set up Cloud SDK\n        uses: google-github-actions/setup-gcloud@v2\n        with:\n          project_id: ${{ vars.GCP_PROJECT_ID }}\n\n      - name: Configure Docker for Artifact Registry\n        run: |\n          gcloud auth configure-docker \"${{ vars.GCP_REGION }}-docker.pkg.dev\" --quiet\n\n      - name: Get GKE credentials\n        uses: google-github-actions/get-gke-credentials@v2\n        with:\n          cluster_name: ${{ vars.GKE_CLUSTER_NAME }}\n          location: ${{ vars.GKE_CLUSTER_LOCATION }}\n          project_id: ${{ vars.GCP_PROJECT_ID }}\n\n      - name: Set up Helm\n        uses: azure/setup-helm@v4\n        with:\n          version: v3.16.3\n\n      - name: Compute image coordinates\n        id: meta\n        run: |\n          REGION=\"${{ vars.GCP_REGION }}\"\n          PROJECT=\"${{ vars.GCP_PROJECT_ID }}\"\n          REPO=\"${{ vars.GAR_REPOSITORY }}\"\n          SHA=\"${GITHUB_SHA}\"\n          SHORT_SHA=\"${SHA:0:7}\"\n          IMAGE=\"${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${{ env.IMAGE_NAME }}\"\n          {\n            echo \"image=${IMAGE}\"\n            echo \"tag=${SHA}\"\n            echo \"short_sha=${SHORT_SHA}\"\n            echo \"image_ref=${IMAGE}:${SHA}\"\n          } >> \"$GITHUB_OUTPUT\"\n\n      - name: Build container image\n        working-directory: ${{ env.WORKING_DIR }}\n        run: |\n          docker build \\\n            --build-arg NEXT_PUBLIC_API_BASE_URL=/api \\\n            --tag \"${{ steps.meta.outputs.image_ref }}\" \\\n            --tag \"${{ steps.meta.outputs.image }}:latest\" \\\n            --label \"org.opencontainers.image.revision=${{ github.sha }}\" \\\n            --label \"org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}\" \\\n            .\n\n      - name: Push container image to Artifact Registry\n        run: |\n          docker push \"${{ steps.meta.outputs.image_ref }}\"\n          docker push \"${{ steps.meta.outputs.image }}:latest\"\n\n      - name: Helm upgrade (frontend image only)\n        run: |\n          helm upgrade --install \"${{ vars.HELM_RELEASE_NAME }}\" ./infra/helm/app \\\n            --namespace \"${{ vars.HELM_NAMESPACE }}\" \\\n            --create-namespace \\\n            --atomic \\\n            --wait \\\n            --timeout 10m \\\n            --set \"apps.frontend.image.repository=${{ steps.meta.outputs.image }}\" \\\n            --set \"apps.frontend.image.tag=${{ steps.meta.outputs.tag }}\" \\\n            --set \"apps.frontend.image.pullPolicy=IfNotPresent\" \\\n            --set \"global.projectId=${{ vars.GCP_PROJECT_ID }}\" \\\n            --set \"global.region=${{ vars.GCP_REGION }}\" \\\n            --reuse-values\n\n      - name: Summary\n        run: |\n          {\n            echo \"## Frontend deploy\"\n            echo \"- Image: \\`${{ steps.meta.outputs.image_ref }}\\`\"\n            echo \"- Release: \\`${{ vars.HELM_RELEASE_NAME }}\\`\"\n            echo \"- Namespace: \\`${{ vars.HELM_NAMESPACE }}\\`\"\n          } >> \"$GITHUB_STEP_SUMMARY\"\n",
      },
    ],
    notes: [
      "Requires the GitHub repository variables listed in the workflow header (see setup page).",
      "environment: production can require GitHub Environment protection rules.",
    ],
  },
  {
    slug: "deploy-backend",
    title: "deploy-backend.yml — GAR + Helm",
    blurb: "Build backend image, push to Artifact Registry, upgrade Helm.",
    path: ".github/workflows/deploy-backend.yml",
    what: "Same shape as the frontend deploy, for services/backend. Path filter isolates API changes. The job swaps apps.backend.image only.",
    why: "Decouple API and UI rollouts. Same WIF and Helm release; different image name and --set keys.",
    provisions: [
      "Trigger: push main + paths services/backend/** or this workflow; workflow_dispatch",
      "Image: …/backend:$SHA",
      "Helm --set apps.backend.image.repository / tag",
    ],
    steps: [
      {
        title: "Trigger & concurrency",
        detail: "deploy-backend-${{ github.ref }}; no cancel-in-progress so Helm finishes.",
      },
      {
        title: "Auth → tooling",
        detail: "Identical WIF / gcloud / docker / GKE / Helm setup as frontend.",
      },
      {
        title: "Build & push",
        detail: "docker build in services/backend (no Next build-args). Push :SHA and :latest.",
      },
      {
        title: "Helm upgrade",
        detail: "--set apps.backend.image.repository and tag; --reuse-values keeps frontend and other chart values.",
      },
    ],
    examples: [
      {
        title: "deploy-backend.yml (full)",
        code: "# =============================================================================\n# Deploy Backend → Google Artifact Registry → Helm upgrade on GKE\n# Triggers on pushes to main that touch services/backend/ (or this workflow).\n#\n# Required GitHub repository variables:\n#   vars.GCP_PROJECT_ID\n#   vars.GCP_REGION                 (e.g. us-central1)\n#   vars.GAR_REPOSITORY             (e.g. template-containers)\n#   vars.GKE_CLUSTER_NAME\n#   vars.GKE_CLUSTER_LOCATION       (region or zone)\n#   vars.HELM_RELEASE_NAME          (e.g. template-app)\n#   vars.HELM_NAMESPACE             (e.g. template)\n#   vars.WIF_PROVIDER               (//iam.googleapis.com/projects/.../providers/...)\n#   vars.WIF_SERVICE_ACCOUNT        (github-actions@PROJECT.iam.gserviceaccount.com)\n# =============================================================================\nname: Deploy Backend\n\non:\n  push:\n    branches: [main]\n    paths:\n      - \"services/backend/**\"\n      - \".github/workflows/deploy-backend.yml\"\n  workflow_dispatch:\n\nconcurrency:\n  group: deploy-backend-${{ github.ref }}\n  cancel-in-progress: false\n\npermissions:\n  contents: read\n  id-token: write  # required for GCP Workload Identity Federation\n\nenv:\n  SERVICE: backend\n  IMAGE_NAME: backend\n  WORKING_DIR: services/backend\n\njobs:\n  build-and-deploy:\n    name: Build, Push & Helm Upgrade\n    runs-on: ubuntu-latest\n    environment: production\n\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Authenticate to Google Cloud (Workload Identity Federation)\n        id: auth\n        uses: google-github-actions/auth@v2\n        with:\n          workload_identity_provider: ${{ vars.WIF_PROVIDER }}\n          service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}\n          token_format: access_token\n\n      - name: Set up Cloud SDK\n        uses: google-github-actions/setup-gcloud@v2\n        with:\n          project_id: ${{ vars.GCP_PROJECT_ID }}\n\n      - name: Configure Docker for Artifact Registry\n        run: |\n          gcloud auth configure-docker \"${{ vars.GCP_REGION }}-docker.pkg.dev\" --quiet\n\n      - name: Get GKE credentials\n        uses: google-github-actions/get-gke-credentials@v2\n        with:\n          cluster_name: ${{ vars.GKE_CLUSTER_NAME }}\n          location: ${{ vars.GKE_CLUSTER_LOCATION }}\n          project_id: ${{ vars.GCP_PROJECT_ID }}\n\n      - name: Set up Helm\n        uses: azure/setup-helm@v4\n        with:\n          version: v3.16.3\n\n      - name: Compute image coordinates\n        id: meta\n        run: |\n          REGION=\"${{ vars.GCP_REGION }}\"\n          PROJECT=\"${{ vars.GCP_PROJECT_ID }}\"\n          REPO=\"${{ vars.GAR_REPOSITORY }}\"\n          SHA=\"${GITHUB_SHA}\"\n          SHORT_SHA=\"${SHA:0:7}\"\n          IMAGE=\"${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${{ env.IMAGE_NAME }}\"\n          {\n            echo \"image=${IMAGE}\"\n            echo \"tag=${SHA}\"\n            echo \"short_sha=${SHORT_SHA}\"\n            echo \"image_ref=${IMAGE}:${SHA}\"\n          } >> \"$GITHUB_OUTPUT\"\n\n      - name: Build container image\n        working-directory: ${{ env.WORKING_DIR }}\n        run: |\n          docker build \\\n            --tag \"${{ steps.meta.outputs.image_ref }}\" \\\n            --tag \"${{ steps.meta.outputs.image }}:latest\" \\\n            --label \"org.opencontainers.image.revision=${{ github.sha }}\" \\\n            --label \"org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}\" \\\n            .\n\n      - name: Push container image to Artifact Registry\n        run: |\n          docker push \"${{ steps.meta.outputs.image_ref }}\"\n          docker push \"${{ steps.meta.outputs.image }}:latest\"\n\n      - name: Helm upgrade (backend image only)\n        run: |\n          helm upgrade --install \"${{ vars.HELM_RELEASE_NAME }}\" ./infra/helm/app \\\n            --namespace \"${{ vars.HELM_NAMESPACE }}\" \\\n            --create-namespace \\\n            --atomic \\\n            --wait \\\n            --timeout 10m \\\n            --set \"apps.backend.image.repository=${{ steps.meta.outputs.image }}\" \\\n            --set \"apps.backend.image.tag=${{ steps.meta.outputs.tag }}\" \\\n            --set \"apps.backend.image.pullPolicy=IfNotPresent\" \\\n            --set \"global.projectId=${{ vars.GCP_PROJECT_ID }}\" \\\n            --set \"global.region=${{ vars.GCP_REGION }}\" \\\n            --reuse-values\n\n      - name: Summary\n        run: |\n          {\n            echo \"## Backend deploy\"\n            echo \"- Image: \\`${{ steps.meta.outputs.image_ref }}\\`\"\n            echo \"- Release: \\`${{ vars.HELM_RELEASE_NAME }}\\`\"\n            echo \"- Namespace: \\`${{ vars.HELM_NAMESPACE }}\\`\"\n          } >> \"$GITHUB_STEP_SUMMARY\"\n",
      },
    ],
    notes: [
      "Same repository variables as the frontend deploy workflow.",
    ],
  },
  {
    slug: "setup",
    title: "Wire GCP vars + WIF",
    blurb: "Map Terraform outputs into GitHub repository variables.",
    path: ".github/workflows + infra/terraform/modules/github_wif",
    what: "After terraform apply, copy WIF and cluster outputs into GitHub Actions repository variables so the deploy workflows can authenticate and push to GKE.",
    why: "Keyless CI (Workload Identity Federation) avoids storing GCP JSON keys in GitHub secrets.",
    provisions: [
      "Terraform module github_wif — pool, provider, SA, IAM",
      "GitHub repository variables for project, cluster, Helm, and WIF IDs",
      "permissions.id-token: write on deploy workflows",
    ],
    steps: [
      {
        title: "Apply Terraform (incl. github_wif)",
        detail: "Set github_repository in terraform.tfvars (org/repo). Apply so WIF provider and GitHub Actions SA exist.",
      },
      {
        title: "Read outputs",
        detail: "terraform output -raw wif_provider, wif_service_account, artifact_registry_url, project_id, region, plus cluster name/location.",
      },
      {
        title: "Set GitHub repository variables",
        detail: "Settings → Secrets and variables → Actions → Variables. Add GCP_PROJECT_ID, GCP_REGION, GAR_REPOSITORY, GKE_CLUSTER_NAME, GKE_CLUSTER_LOCATION, HELM_RELEASE_NAME, HELM_NAMESPACE, WIF_PROVIDER, WIF_SERVICE_ACCOUNT.",
      },
      {
        title: "Smoke test",
        detail: "Actions → Deploy Frontend → Run workflow (workflow_dispatch), or push a change under services/frontend.",
      },
    ],
    examples: [
      {
        title: "Map Terraform → GitHub vars",
        code: "# From infra/terraform after apply:\n\n# WIF_PROVIDER          ← terraform output -raw wif_provider\n# WIF_SERVICE_ACCOUNT   ← terraform output -raw wif_service_account\n# GCP_PROJECT_ID        ← terraform output -raw project_id\n# GCP_REGION            ← terraform output -raw region\n# GAR_REPOSITORY        ← name of AR repo (e.g. template-containers)\n# GKE_CLUSTER_NAME      ← cluster name (e.g. template)\n# GKE_CLUSTER_LOCATION  ← same as region (or zone)\n# HELM_RELEASE_NAME     ← e.g. template-app\n# HELM_NAMESPACE        ← e.g. template\n\n# Optional: gh CLI\ngh variable set GCP_PROJECT_ID --body \"$(terraform output -raw project_id)\"\ngh variable set GCP_REGION --body \"$(terraform output -raw region)\"\ngh variable set WIF_PROVIDER --body \"$(terraform output -raw wif_provider)\"\ngh variable set WIF_SERVICE_ACCOUNT --body \"$(terraform output -raw wif_service_account)\"\n# …set GAR_REPOSITORY, GKE_*, HELM_* the same way",
      },
      {
        title: "Deploy workflow permissions",
        code: "permissions:\n  contents: read\n  id-token: write  # required for Workload Identity Federation",
      },
    ],
    notes: [
      "Prefer repository Variables for these IDs; reserve Secrets for true secrets.",
      "github_repository in tfvars must match the repo that runs Actions (org/name).",
    ],
  },
];

export function getGithubActionsPage(
  slug: string,
): GithubActionsDocPage | undefined {
  return GITHUB_ACTIONS_PAGES.find((p) => p.slug === slug);
}

export function allGithubActionsSlugs(): string[] {
  return GITHUB_ACTIONS_PAGES.map((p) => p.slug);
}
