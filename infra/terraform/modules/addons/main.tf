# Cluster add-ons: Secret CSI provider + ingress-nginx

terraform {
  required_providers {
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
    helm = {
      source = "hashicorp/helm"
    }
  }
}

resource "helm_release" "csi_provider" {
  name       = "csi-secrets-store-provider-gcp"
  repository = "oci://us-docker.pkg.dev/google-samples/charts"
  chart      = "csi-secrets-store-provider-gcp"
  version    = "1.6.0"
  namespace  = "kube-system"

  wait    = true
  timeout = 300
}

resource "kubernetes_namespace" "ingress_nginx" {
  metadata {
    name = "ingress-nginx"
  }
}

resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.12.0"
  namespace  = kubernetes_namespace.ingress_nginx.metadata[0].name

  wait    = true
  timeout = 600

  values = [
    yamlencode({
      controller = {
        replicaCount = 2
        ingressClassResource = {
          name    = "nginx"
          enabled = true
          default = true
        }
        ingressClass = "nginx"
        service = {
          type = "LoadBalancer"
          annotations = {
            "cloud.google.com/load-balancer-type" = "External"
          }
        }
        metrics = {
          enabled = true
        }
      }
    })
  ]

  depends_on = [
    helm_release.csi_provider,
    kubernetes_namespace.ingress_nginx,
  ]
}
