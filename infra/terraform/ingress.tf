# Ingress — edge reverse proxy
#
# 1) GCP Secret Manager CSI provider (lets pods mount secrets)
# 2) ingress-nginx → creates an external Load Balancer automatically

resource "helm_release" "csi_provider" {
  name       = "csi-secrets-store-provider-gcp"
  repository = "oci://us-docker.pkg.dev/google-samples/charts"
  chart      = "csi-secrets-store-provider-gcp"
  version    = "1.6.0"
  namespace  = "kube-system"

  wait    = true
  timeout = 300

  depends_on = [google_container_node_pool.primary]
}

resource "kubernetes_namespace" "ingress_nginx" {
  metadata {
    name = "ingress-nginx"
  }

  depends_on = [google_container_node_pool.primary]
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
