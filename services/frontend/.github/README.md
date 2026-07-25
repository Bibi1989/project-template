# GitHub Actions only discovers workflows under the **repository root**:
#   .github/workflows/*.yml
#
# Putting workflows under `services/frontend/.github/` or
# `services/backend/.github/` does **not** run them on GitHub.
# Keep CI/deploy YAML in the root `.github/workflows/` directory and point
# `working-directory` / path filters at `services/*`.
#
# Deploy (GCP) workflows live at:
#   ../../.github/workflows/deploy-frontend.yml
#   ../../.github/workflows/deploy-backend.yml
# CI (lint / test / build):
#   ../../.github/workflows/ci.yml
