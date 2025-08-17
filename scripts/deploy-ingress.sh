#!/bin/bash

# Deploy NGINX Ingress Controller
# Usage: ./scripts/deploy-ingress.sh

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[INGRESS]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if kubectl is available
if ! command -v kubectl >/dev/null 2>&1; then
    log_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if helm is available
if ! command -v helm >/dev/null 2>&1; then
    log_error "helm is not installed or not in PATH"
    exit 1
fi

# Check Kubernetes connectivity
if ! kubectl cluster-info >/dev/null 2>&1; then
    log_error "Unable to connect to Kubernetes cluster"
    exit 1
fi

log "Deploying NGINX Ingress Controller..."

# Add NGINX ingress Helm repository
log "Adding NGINX ingress Helm repository..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo update >/dev/null

# Create ingress-nginx namespace if it doesn't exist
log "Ensuring ingress-nginx namespace exists..."
kubectl create namespace ingress-nginx --dry-run=client -o yaml | kubectl apply -f -

# Deploy NGINX ingress controller (version compatible with K8s 1.30)
log "Deploying NGINX Ingress Controller..."
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --version "4.11.2" \
    --namespace ingress-nginx \
    --set controller.replicaCount=2 \
    --set controller.resources.requests.cpu=100m \
    --set controller.resources.requests.memory=90Mi \
    --set controller.service.type=LoadBalancer \
    --set controller.metrics.enabled=true \
    --wait \
    --timeout 10m

# Wait for ingress controller to be ready
log "Waiting for NGINX Ingress Controller to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/ingress-nginx-controller -n ingress-nginx

# Check if LoadBalancer got external IP
log "Checking LoadBalancer status..."
EXTERNAL_IP=""
for i in {1..30}; do
    EXTERNAL_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    if [ -n "$EXTERNAL_IP" ]; then
        break
    fi
    log "Waiting for LoadBalancer external IP... ($i/30)"
    sleep 10
done

if [ -n "$EXTERNAL_IP" ]; then
    log_success "NGINX Ingress Controller deployed successfully!"
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                 NGINX INGRESS CONTROLLER                     ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║                                                              ║"
    echo "║  External URL: http://$EXTERNAL_IP"
    echo "║                                                              ║"
    echo "║  To access your services, add to /etc/hosts:                ║"
    echo "║  $EXTERNAL_IP sre-task.local"
    echo "║                                                              ║"
    echo "║  Then access: https://sre-task.local                        ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
else
    log_warning "LoadBalancer external IP not ready yet"
    log_warning "Run: kubectl get svc ingress-nginx-controller -n ingress-nginx"
fi

log_success "NGINX Ingress Controller setup complete!"