#!/bin/bash

# Chaos Engineering Script for SRE Task
# Simulates various failure scenarios for testing system resilience
# Usage: ./scripts/chaos-engineering.sh [scenario] [duration]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[CHAOS]${NC} $1"
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

log_scenario() {
    echo -e "${MAGENTA}[SCENARIO]${NC} $1"
}

# Available scenarios
show_help() {
    cat << EOF
Chaos Engineering Scenarios

Usage: $0 [scenario] [duration_seconds]

Available scenarios:
  1. pod-killer       - Randomly kill pods in backend namespace
  2. memory-stress     - Apply memory stress to random pods
  3. cpu-stress        - Apply CPU stress to random pods
  4. network-partition - Simulate network partitioning
  5. service-delay     - Add artificial latency to services
  6. database-outage   - Simulate database connectivity issues
  7. traffic-surge     - Generate high traffic load
  8. storage-failure   - Simulate storage issues
  9. node-drain        - Drain random nodes
  10. all              - Run all scenarios sequentially

Examples:
  $0 pod-killer 300        # Kill pods for 5 minutes
  $0 memory-stress 60      # Memory stress for 1 minute
  $0 all 120               # Run all scenarios for 2 minutes each
  $0 list                  # List current chaos experiments

Options:
  list     - Show currently running chaos experiments
  stop     - Stop all running experiments
  status   - Show system health status
EOF
}

# Check prerequisites
check_prerequisites() {
    if ! command -v kubectl >/dev/null 2>&1; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi

    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Unable to connect to Kubernetes cluster"
        exit 1
    fi
}

# Get system baseline metrics
get_baseline_metrics() {
    log "Collecting baseline metrics..."
    
    echo "=== BASELINE METRICS ==="
    echo "Timestamp: $(date)"
    echo
    
    echo "--- Pod Status ---"
    kubectl get pods -n backend -n frontend --no-headers | awk '{print $1, $2, $3}' | column -t
    echo
    
    echo "--- Resource Usage ---"
    kubectl top pods -n backend -n frontend 2>/dev/null || echo "Metrics server not available"
    echo
    
    echo "--- Service Endpoints ---"
    kubectl get endpoints -n backend -n frontend
    echo
    
    echo "--- HPA Status ---"
    kubectl get hpa -n backend -n frontend
    echo "========================"
}

# Pod Killer Scenario
pod_killer_scenario() {
    local duration=${1:-300}
    log_scenario "Starting Pod Killer scenario for ${duration}s"
    
    local end_time=$(($(date +%s) + duration))
    local chaos_file="/tmp/chaos_pod_killer_$$"
    
    echo $$ > "$chaos_file"
    
    while [ $(date +%s) -lt $end_time ]; do
        # Get random pod from backend namespace (macOS compatible)
        local pods_array=($(kubectl get pods -n backend --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}'))
        if [ ${#pods_array[@]} -gt 0 ]; then
            local random_index=$((RANDOM % ${#pods_array[@]}))
            local pod=${pods_array[$random_index]}
        else
            local pod=""
        fi
        
        if [ ! -z "$pod" ]; then
            log_warning "Killing pod: $pod"
            kubectl delete pod "$pod" -n backend --grace-period=0 &
            
            # Wait and monitor recovery
            sleep $((30 + RANDOM % 60))
            
            log "Checking system recovery..."
            kubectl get pods -n backend | grep -E "(Pending|ContainerCreating|CrashLoopBackOff)"
        fi
    done
    
    rm -f "$chaos_file"
    log_success "Pod Killer scenario completed"
}

# Memory Stress Scenario
memory_stress_scenario() {
    local duration=${1:-300}
    log_scenario "Starting Memory Stress scenario for ${duration}s"
    
    # Create stress test pod
    cat << EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: memory-stress-chaos
  namespace: backend
  labels:
    chaos-type: memory-stress
spec:
  containers:
  - name: stress
    image: polinux/stress
    command: ["stress"]
    args: ["--vm", "2", "--vm-bytes", "512M", "--timeout", "${duration}s"]
    resources:
      requests:
        memory: "100Mi"
        cpu: "100m"
      limits:
        memory: "1Gi"
        cpu: "500m"
  restartPolicy: Never
EOF

    log "Memory stress pod created, monitoring for ${duration}s..."
    sleep "$duration"
    
    # Cleanup
    kubectl delete pod memory-stress-chaos -n backend --ignore-not-found=true
    log_success "Memory Stress scenario completed"
}

# CPU Stress Scenario
cpu_stress_scenario() {
    local duration=${1:-300}
    log_scenario "Starting CPU Stress scenario for ${duration}s"
    
    # Create CPU stress test pod
    cat << EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: cpu-stress-chaos
  namespace: backend
  labels:
    chaos-type: cpu-stress
spec:
  containers:
  - name: stress
    image: polinux/stress
    command: ["stress"]
    args: ["--cpu", "4", "--timeout", "${duration}s"]
    resources:
      requests:
        cpu: "100m"
        memory: "100Mi"
      limits:
        cpu: "2"
        memory: "512Mi"
  restartPolicy: Never
EOF

    log "CPU stress pod created, monitoring for ${duration}s..."
    sleep "$duration"
    
    # Cleanup
    kubectl delete pod cpu-stress-chaos -n backend --ignore-not-found=true
    log_success "CPU Stress scenario completed"
}

# Network Partition Scenario
network_partition_scenario() {
    local duration=${1:-300}
    log_scenario "Starting Network Partition scenario for ${duration}s"
    
    # Apply restrictive network policy
    cat << EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: chaos-network-partition
  namespace: backend
spec:
  podSelector:
    matchLabels:
      app: api-service
  policyTypes:
  - Ingress
  - Egress
  ingress: []
  egress: []
EOF

    log "Network partition applied to api-service for ${duration}s..."
    sleep "$duration"
    
    # Cleanup
    kubectl delete networkpolicy chaos-network-partition -n backend --ignore-not-found=true
    log_success "Network Partition scenario completed"
}

# Traffic Surge Scenario
traffic_surge_scenario() {
    local duration=${1:-300}
    log_scenario "Starting Traffic Surge scenario for ${duration}s"
    
    # Create load generator
    cat << EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chaos-load-generator
  namespace: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chaos-load-generator
  template:
    metadata:
      labels:
        app: chaos-load-generator
    spec:
      containers:
      - name: load-generator
        image: busybox
        command: ["/bin/sh"]
        args:
        - -c
        - |
          while true; do
            wget -q -O- http://api-service.backend.svc.cluster.local:3000/health || true
            wget -q -O- http://auth-service.backend.svc.cluster.local:8080/health || true
            sleep 0.1
          done
EOF

    log "Load generators deployed, generating traffic for ${duration}s..."
    sleep "$duration"
    
    # Cleanup
    kubectl delete deployment chaos-load-generator -n backend --ignore-not-found=true
    log_success "Traffic Surge scenario completed"
}

# List running chaos experiments
list_experiments() {
    log "Current chaos experiments:"
    echo
    
    echo "--- Chaos Pods ---"
    kubectl get pods -l chaos-type -A
    echo
    
    echo "--- Chaos Network Policies ---"
    kubectl get networkpolicy -l chaos-type -A
    echo
    
    echo "--- Load Generators ---"
    kubectl get deployments -l app=chaos-load-generator -A
}

# Stop all experiments
stop_experiments() {
    log "Stopping all chaos experiments..."
    
    kubectl delete pods -l chaos-type -A --ignore-not-found=true
    kubectl delete networkpolicy -l chaos-type -A --ignore-not-found=true
    kubectl delete deployment chaos-load-generator -n backend --ignore-not-found=true
    
    log_success "All chaos experiments stopped"
}

# System health status
system_status() {
    log "System Health Status:"
    echo
    
    echo "=== SYSTEM HEALTH ==="
    echo "Timestamp: $(date)"
    echo
    
    echo "--- Pod Health ---"
    kubectl get pods -n backend -n frontend
    echo
    
    echo "--- Service Health ---"
    kubectl get svc -n backend -n frontend
    echo
    
    echo "--- HPA Status ---"
    kubectl get hpa -n backend -n frontend
    echo
    
    echo "--- Resource Usage ---"
    kubectl top pods -n backend -n frontend 2>/dev/null || echo "Metrics server not available"
    echo
    
    echo "--- Recent Events ---"
    kubectl get events --sort-by='.lastTimestamp' -n backend -n frontend | tail -10
    echo "===================="
}

# Run all scenarios
run_all_scenarios() {
    local duration=${1:-120}
    
    log_scenario "Running ALL chaos scenarios with ${duration}s duration each"
    
    get_baseline_metrics
    
    pod_killer_scenario "$duration"
    sleep 30
    
    memory_stress_scenario "$duration"
    sleep 30
    
    cpu_stress_scenario "$duration"
    sleep 30
    
    network_partition_scenario "$duration"
    sleep 30
    
    traffic_surge_scenario "$duration"
    
    log_success "All chaos scenarios completed"
    system_status
}

# Main script logic
main() {
    check_prerequisites
    
    case "${1:-help}" in
        "pod-killer")
            get_baseline_metrics
            pod_killer_scenario "${2:-300}"
            system_status
            ;;
        "memory-stress")
            get_baseline_metrics
            memory_stress_scenario "${2:-300}"
            system_status
            ;;
        "cpu-stress")
            get_baseline_metrics
            cpu_stress_scenario "${2:-300}"
            system_status
            ;;
        "network-partition")
            get_baseline_metrics
            network_partition_scenario "${2:-300}"
            system_status
            ;;
        "traffic-surge")
            get_baseline_metrics
            traffic_surge_scenario "${2:-300}"
            system_status
            ;;
        "all")
            run_all_scenarios "${2:-120}"
            ;;
        "list")
            list_experiments
            ;;
        "stop")
            stop_experiments
            ;;
        "status")
            system_status
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Execute main function
main "$@"