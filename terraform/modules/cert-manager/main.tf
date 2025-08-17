# Cert-Manager for automatic TLS certificate management

# Install cert-manager via Helm
resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = "v1.15.3"
  namespace  = "cert-manager"
  
  create_namespace = true
  
  set {
    name  = "installCRDs"
    value = "true"
  }
  
  set {
    name  = "global.leaderElection.namespace"
    value = "cert-manager"
  }
  
  # Enable Prometheus metrics (only if monitoring CRDs are available)
  set {
    name  = "prometheus.enabled"
    value = "true"
  }
  
  set {
    name  = "prometheus.servicemonitor.enabled"
    value = "false"  # Disable ServiceMonitor by default to avoid CRD dependencies
  }
  
  # Security context
  set {
    name  = "securityContext.runAsNonRoot"
    value = "true"
  }
  
  # Resource limits
  set {
    name  = "resources.requests.cpu"
    value = "100m"
  }
  
  set {
    name  = "resources.requests.memory"
    value = "128Mi"
  }
  
  set {
    name  = "resources.limits.cpu"
    value = "200m"
  }
  
  set {
    name  = "resources.limits.memory"
    value = "256Mi"
  }
  
  depends_on = [var.eks_cluster]
}

# Create ClusterIssuers after cert-manager is deployed
resource "null_resource" "create_cluster_issuers" {
  depends_on = [helm_release.cert_manager]
  
  provisioner "local-exec" {
    command = <<-EOT
      # Wait for cert-manager to be ready
      echo "Waiting for cert-manager to be ready..."
      kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
      kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
      kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
      
      # Wait for CRDs to be established
      kubectl wait --for=condition=established --timeout=120s crd/clusterissuers.cert-manager.io
      
      # Apply ClusterIssuers
      cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned-issuer
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: ${var.letsencrypt_email}
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
    - http01:
        ingress:
          class: nginx
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${var.letsencrypt_email}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    EOT
  }
  
  triggers = {
    letsencrypt_email = var.letsencrypt_email
    cert_manager_deployed = helm_release.cert_manager.id
  }
}