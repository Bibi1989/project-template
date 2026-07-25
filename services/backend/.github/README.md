# GitHub Actions only discovers workflows under the **repository root**:
#   .github/workflows/*.yml
#
# Nested `services/*/.github/workflows/` files are ignored by GitHub.
# See `../../.github/workflows/` for CI and deploy definitions.
