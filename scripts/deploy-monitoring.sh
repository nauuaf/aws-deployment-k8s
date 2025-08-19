#!/bin/bash

# Deploy Monitoring Stack via GitOps
# Usage: ./scripts/deploy-monitoring.sh

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
    echo -e "${BLUE}[MONITORING]${NC} $1"
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

log "Deploying monitoring stack via GitOps..."

# Function to check if monitoring is already healthy
check_monitoring_health() {
    log "Checking if monitoring stack is already healthy..."
    
    # Check if Helm release exists and is deployed
    if helm status kube-prometheus-stack -n monitoring >/dev/null 2>&1; then
        local helm_status=$(helm status kube-prometheus-stack -n monitoring -o json | jq -r '.info.status')
        
        if [ "$helm_status" = "deployed" ]; then
            # Check if all pods are running
            local ready_pods=$(kubectl get pods -n monitoring --no-headers | grep -E "(Running|Ready)" | wc -l)
            local total_pods=$(kubectl get pods -n monitoring --no-headers | wc -l)
            
            if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
                log_success "Monitoring stack is already healthy and running"
                log "Pods running: $ready_pods/$total_pods"
                return 0
            fi
        elif [ "$helm_status" = "pending-upgrade" ]; then
            log_warning "Monitoring stack is stuck in pending-upgrade state"
            
            # Check if all pods are actually running despite Helm being stuck
            local ready_pods=$(kubectl get pods -n monitoring --no-headers | grep -E "(Running|Ready)" | wc -l)
            local total_pods=$(kubectl get pods -n monitoring --no-headers | wc -l)
            
            if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
                log_success "All monitoring pods are healthy despite Helm pending-upgrade status"
                log "Pods running: $ready_pods/$total_pods"
                log_warning "Helm is stuck but monitoring is functional - skipping deployment"
                return 0  # Monitoring is functional, no need to deploy
            else
                log "Attempting to resolve stuck deployment..."
                
                # Clean up stuck admission jobs
                kubectl delete job -n monitoring -l app.kubernetes.io/name=kube-prometheus-stack --ignore-not-found=true
                
                # Try to rollback to previous working state
                if helm rollback kube-prometheus-stack -n monitoring >/dev/null 2>&1; then
                    log "Successfully rolled back stuck deployment"
                    sleep 10  # Wait for rollback to complete
                    return 1  # Continue with normal deployment
                else
                    log_warning "Rollback failed and pods not healthy - manual intervention needed"
                    log_error "Please run: kubectl get pods -n monitoring"
                    log_error "And: helm uninstall kube-prometheus-stack -n monitoring"
                    exit 1
                fi
            fi
        fi
    fi
    
    return 1  # Monitoring needs to be deployed
}

# Function to temporarily handle resource quota issues
handle_quota_conflicts() {
    log "Checking for resource quota conflicts..."
    
    # Check if monitoring quota is blocking Helm operations
    if kubectl get resourcequota monitoring-quota -n monitoring >/dev/null 2>&1; then
        # Check configmap quota
        local quota_configmaps=$(kubectl get resourcequota monitoring-quota -n monitoring -o jsonpath='{.status.hard.configmaps}' 2>/dev/null || echo "0")
        local used_configmaps=$(kubectl get resourcequota monitoring-quota -n monitoring -o jsonpath='{.status.used.configmaps}' 2>/dev/null || echo "0")
        
        if [ "$used_configmaps" = "$quota_configmaps" ] && [ "$quota_configmaps" != "0" ]; then
            log_warning "ConfigMap quota limit reached ($used_configmaps/$quota_configmaps), updating quota..."
            
            # Update the configmap quota to allow kube-prometheus-stack installation
            kubectl patch resourcequota monitoring-quota -n monitoring --type='json' \
                -p='[{"op": "replace", "path": "/spec/hard/configmaps", "value": "50"}]' >/dev/null 2>&1 || true
            
            # Wait a moment for quota update to take effect
            sleep 2
            
            log_success "ConfigMap quota updated to 50 to accommodate monitoring stack"
            return 0  # Quota was adjusted
        fi
        
        # Check if quota is preventing job creation
        local quota_jobs=$(kubectl get resourcequota monitoring-quota -n monitoring -o jsonpath='{.status.hard.count/jobs\.batch}' 2>/dev/null || echo "0")
        local used_jobs=$(kubectl get resourcequota monitoring-quota -n monitoring -o jsonpath='{.status.used.count/jobs\.batch}' 2>/dev/null || echo "0")
        
        if [ "$used_jobs" = "$quota_jobs" ] && [ "$quota_jobs" != "0" ]; then
            log_warning "Job quota may block Helm operations, temporarily adjusting..."
            
            # Temporarily increase job quota for Helm operations
            kubectl patch resourcequota monitoring-quota -n monitoring --type='json' \
                -p='[{"op": "replace", "path": "/spec/hard/count~1jobs.batch", "value": "'$((quota_jobs + 2))'"}]' >/dev/null 2>&1 || true
            
            return 0  # Quota was adjusted
        fi
    fi
    
    return 1  # No quota issues
}

# Function to restore quota after deployment
restore_quota() {
    local quota_adjusted="$1"
    if [ "$quota_adjusted" = "true" ]; then
        log "Restoring original resource quota..."
        kubectl patch resourcequota monitoring-quota -n monitoring --type='json' \
            -p='[{"op": "replace", "path": "/spec/hard/count~1jobs.batch", "value": "5"}]' >/dev/null 2>&1 || true
    fi
}

# Check if monitoring is already healthy
if check_monitoring_health; then
    # Get Grafana admin password
    log "Retrieving Grafana admin password..."
    GRAFANA_PASSWORD=$(kubectl get secret --namespace monitoring kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 --decode 2>/dev/null || echo "Unable to retrieve")
    
    # Display setup completion
    log_success "Monitoring stack is already healthy and running!"
    
    cat << EOF

╔══════════════════════════════════════════════════════════════╗
║                 MONITORING ALREADY DEPLOYED                 ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ✅ All monitoring components are healthy and running        ║
║                                                              ║
║  🎯 Access services via port-forward:                       ║
║                                                              ║
║  Prometheus:                                                 ║
║  kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
║                                                              ║
║  Grafana:                                                    ║
║  kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
║                                                              ║
║  AlertManager:                                               ║
║  kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
║                                                              ║
║  🔐 Grafana Credentials:                                    ║
║  Username: admin                                             ║
║  Password: $GRAFANA_PASSWORD
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

EOF
    
    log_success "No deployment needed - monitoring stack is already operational!"
    exit 0
fi

# Handle quota conflicts before deployment
quota_adjusted="false"
if handle_quota_conflicts; then
    quota_adjusted="true"
fi

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

# Check if jq is available (for JSON parsing)
if ! command -v jq >/dev/null 2>&1; then
    log_error "jq is not installed or not in PATH"
    log "Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info >/dev/null 2>&1; then
    log_error "Unable to connect to Kubernetes cluster"
    exit 1
fi

# Add Prometheus Helm repository
log "Adding Prometheus community Helm repository..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update >/dev/null

# Create monitoring namespace if it doesn't exist
log "Ensuring monitoring namespace exists..."
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Deploy kube-prometheus-stack via Helm (version compatible with K8s 1.30)
log "Deploying kube-prometheus-stack..."
if ! helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
    --version "61.9.0" \
    --namespace monitoring \
    --values "$PROJECT_ROOT/manifests/monitoring/helm-values.yaml" \
    --wait \
    --timeout 10m; then
    log_error "Helm deployment failed"
    restore_quota "$quota_adjusted"
    exit 1
fi

# Wait for operator to be ready
log "Waiting for Prometheus operator to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/kube-prometheus-stack-operator -n monitoring

# Apply our custom monitoring manifests
log "Applying custom ServiceMonitors and PrometheusRules..."
kubectl apply -f "$PROJECT_ROOT/manifests/monitoring/prometheusrule.yaml"
kubectl apply -f "$PROJECT_ROOT/manifests/monitoring/servicemonitor.yaml"

# Wait for Prometheus to be ready
log "Waiting for Prometheus to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/kube-prometheus-stack-prometheus -n monitoring 2>/dev/null || \
kubectl wait --for=condition=ready --timeout=300s statefulset/prometheus-kube-prometheus-stack-prometheus -n monitoring || true

# Wait for Grafana to be ready
log "Waiting for Grafana to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/kube-prometheus-stack-grafana -n monitoring

# Get Grafana admin password
log "Retrieving Grafana admin password..."
GRAFANA_PASSWORD=$(kubectl get secret --namespace monitoring kube-prometheus-stack-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)

# Display setup completion
# Restore quota if it was adjusted
restore_quota "$quota_adjusted"

log_success "Monitoring stack deployed successfully!"

cat << EOF

╔══════════════════════════════════════════════════════════════╗
║                   MONITORING DEPLOYMENT COMPLETE            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  🎯 Access services via port-forward:                       ║
║                                                              ║
║  Prometheus:                                                 ║
║  kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
║                                                              ║
║  Grafana:                                                    ║
║  kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80
║                                                              ║
║  AlertManager:                                               ║
║  kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093
║                                                              ║
║  🔐 Grafana Credentials:                                    ║
║  Username: admin                                             ║
║  Password: $GRAFANA_PASSWORD
║                                                              ║
║  📊 Configured Components:                                  ║
║  - Prometheus with custom alerts                             ║
║  - Grafana with persistence                                  ║
║  - AlertManager for notifications                            ║
║  - ServiceMonitors for backend/frontend                      ║
║                                                              ║
║  🚨 Alert Rules:                                            ║
║  - Application: Error rates, latency, service down          ║
║  - Infrastructure: Pod crashes, resource usage              ║
║  - Node: Memory, disk, CPU usage                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

EOF

log_success "Run 'kubectl get all -n monitoring' to see all monitoring components"
log "View Prometheus targets: http://localhost:9090/targets (after port-forward)"
log "View Grafana: http://localhost:3000 (after port-forward)"