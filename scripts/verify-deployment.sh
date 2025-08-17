#!/bin/bash

# Verify Deployment Health and Configuration
# Usage: ./scripts/verify-deployment.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[VERIFY]${NC} $1"
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

log "🔍 Verifying SRE Assignment Deployment State"
echo ""

# Check kubectl connection
log "Checking Kubernetes connection..."
if ! kubectl cluster-info >/dev/null 2>&1; then
    log_error "Unable to connect to Kubernetes cluster"
    exit 1
fi
log_success "Connected to Kubernetes cluster"

# Check namespaces
log "Checking required namespaces..."
REQUIRED_NAMESPACES=("backend" "frontend" "monitoring")
for namespace in "${REQUIRED_NAMESPACES[@]}"; do
    if kubectl get namespace "$namespace" >/dev/null 2>&1; then
        log_success "Namespace '$namespace' exists"
    else
        log_error "Namespace '$namespace' missing"
        exit 1
    fi
done

# Check pod status
log "Checking pod health..."
echo ""

# Backend services
echo -e "${BLUE}Backend Services:${NC}"
kubectl get pods -n backend --no-headers | while read line; do
    POD_NAME=$(echo $line | awk '{print $1}')
    READY=$(echo $line | awk '{print $2}')
    STATUS=$(echo $line | awk '{print $3}')
    
    if [[ "$READY" == "1/1" ]] && [[ "$STATUS" == "Running" ]]; then
        echo -e "  ${GREEN}✅${NC} $POD_NAME ($READY $STATUS)"
    else
        echo -e "  ${RED}❌${NC} $POD_NAME ($READY $STATUS)"
    fi
done

echo ""

# Frontend services  
echo -e "${BLUE}Frontend Services:${NC}"
kubectl get pods -n frontend --no-headers | while read line; do
    POD_NAME=$(echo $line | awk '{print $1}')
    READY=$(echo $line | awk '{print $2}')
    STATUS=$(echo $line | awk '{print $3}')
    
    if [[ "$READY" == "1/1" ]] && [[ "$STATUS" == "Running" ]]; then
        echo -e "  ${GREEN}✅${NC} $POD_NAME ($READY $STATUS)"
    else
        echo -e "  ${RED}❌${NC} $POD_NAME ($READY $STATUS)"
    fi
done

echo ""

# Check service health endpoints
log "Checking service health endpoints..."

# Test auth-service health
log "Testing auth-service health..."
if kubectl exec -n backend deployment/auth-service -- curl -sf http://localhost:8080/health >/dev/null 2>&1; then
    log_success "Auth-service health check passed"
else
    log_error "Auth-service health check failed"
fi

# Test image-service health
log "Testing image-service health..."
if kubectl exec -n backend deployment/image-service -- python -c "import requests; requests.get('http://localhost:5000/health').raise_for_status()" 2>/dev/null; then
    log_success "Image-service health check passed"
else
    log_warning "Image-service health check failed (requests module may not be available)"
fi

# Check database connectivity
log "Testing database connectivity..."
DB_TEST=$(kubectl exec -n backend deployment/image-service -- python -c "
import asyncio
import asyncpg
import os
from urllib.parse import urlparse, unquote

async def test_db():
    try:
        db_url = os.getenv('DATABASE_URL')
        parsed = urlparse(db_url)
        conn = await asyncpg.connect(
            host=parsed.hostname,
            port=parsed.port,
            database=parsed.path.lstrip('/'),
            user=unquote(parsed.username),
            password=unquote(parsed.password),
            ssl='require'
        )
        result = await conn.fetchval('SELECT 1')
        await conn.close()
        print('SUCCESS')
    except Exception as e:
        print(f'FAILED: {e}')

asyncio.run(test_db())
" 2>/dev/null)

if [[ "$DB_TEST" == "SUCCESS" ]]; then
    log_success "Database connectivity test passed"
else
    log_error "Database connectivity test failed: $DB_TEST"
fi

# Check image versions
log "Checking deployed image versions..."
echo ""
echo -e "${BLUE}Deployed Images:${NC}"

# Get image versions for each deployment
for deployment in api-service auth-service image-service; do
    IMAGE=$(kubectl get deployment -n backend $deployment -o jsonpath='{.spec.template.spec.containers[0].image}')
    echo "  $deployment: $IMAGE"
done

IMAGE=$(kubectl get deployment -n frontend frontend -o jsonpath='{.spec.template.spec.containers[0].image}')
echo "  frontend: $IMAGE"

echo ""

# Check services
log "Checking Kubernetes services..."
kubectl get svc -n backend --no-headers | while read line; do
    SVC_NAME=$(echo $line | awk '{print $1}')
    SVC_TYPE=$(echo $line | awk '{print $2}')
    echo "  Backend: $SVC_NAME ($SVC_TYPE)"
done

kubectl get svc -n frontend --no-headers | while read line; do
    SVC_NAME=$(echo $line | awk '{print $1}')
    SVC_TYPE=$(echo $line | awk '{print $2}')
    echo "  Frontend: $SVC_NAME ($SVC_TYPE)"
done

echo ""
log_success "🎉 Deployment verification completed!"
echo ""
echo -e "${BLUE}Access Information:${NC}"
echo "  • Frontend: kubectl port-forward -n frontend service/frontend 8080:3000"
echo "  • API Gateway: kubectl port-forward -n backend service/api-service 3000:3000"
echo "  • Auth Service: kubectl port-forward -n backend service/auth-service 8080:8080"
echo "  • Image Service: kubectl port-forward -n backend service/image-service 5000:5000"
echo ""
echo "For monitoring (if deployed):"
echo "  • Grafana: kubectl port-forward -n monitoring svc/grafana 3000:3000"
echo "  • Prometheus: kubectl port-forward -n monitoring svc/prometheus 9090:9090"