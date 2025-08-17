#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}       DEPLOYMENT INFORMATION           ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed or not in PATH${NC}"
    exit 1
fi

# Check if we can connect to cluster
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    echo "Please ensure you have:"
    echo "1. AWS CLI configured with proper credentials"
    echo "2. kubectl configured to connect to your EKS cluster"
    echo "3. Run: aws eks update-kubeconfig --region eu-central-1 --name your-cluster-name"
    exit 1
fi

echo -e "${BLUE}📋 CLUSTER INFORMATION${NC}"
echo "-------------------"
CLUSTER_NAME=$(kubectl config current-context | cut -d'/' -f2)
echo -e "Cluster: ${YELLOW}${CLUSTER_NAME}${NC}"
echo -e "Region: ${YELLOW}eu-central-1${NC}"
echo ""

echo -e "${BLUE}🌐 LOAD BALANCER INFORMATION${NC}"
echo "-------------------------"

# Get the load balancer URL
LB_URL=$(kubectl get ingress -n default main-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)

if [ -z "$LB_URL" ]; then
    echo -e "${RED}❌ Load balancer URL not found${NC}"
    echo "The ingress might still be provisioning. Please wait a few minutes and try again."
    echo ""
    echo "You can check the status with:"
    echo "kubectl get ingress -n default"
else
    echo -e "📍 Load Balancer URL: ${GREEN}https://${LB_URL}${NC}"
    echo -e "🌐 Frontend URL: ${GREEN}https://${LB_URL}${NC}"
    echo -e "🔌 API URL: ${GREEN}https://${LB_URL}/api${NC}"
    echo -e "🔐 Auth Service: ${GREEN}https://${LB_URL}/api/v1/auth${NC}"
    echo -e "🖼️  Image Service: ${GREEN}https://${LB_URL}/api/v1/images${NC}"
    echo -e "🧪 API Playground: ${GREEN}https://${LB_URL}/api/playground${NC}"
fi
echo ""

echo -e "${BLUE}🔐 AUTHENTICATION INFORMATION${NC}"
echo "----------------------------"
echo -e "Demo Credentials:"
echo -e "  📧 Email: ${YELLOW}admin@example.com${NC}"
echo -e "  🔑 Password: ${YELLOW}demo123${NC}"
echo ""
echo -e "Additional Test Users:"
echo -e "  📧 Email: ${YELLOW}user@example.com${NC}"
echo -e "  🔑 Password: ${YELLOW}password123${NC}"
echo ""

echo -e "${BLUE}📊 MONITORING INFORMATION${NC}"
echo "-----------------------"

# Check if monitoring namespace exists
if kubectl get namespace monitoring &> /dev/null; then
    echo -e "✅ Monitoring stack is deployed"
    
    # Check Grafana service
    GRAFANA_SERVICE=$(kubectl get svc -n monitoring grafana -o name 2>/dev/null)
    if [ ! -z "$GRAFANA_SERVICE" ]; then
        echo -e "📈 Grafana Dashboard:"
        echo -e "  🔗 Access via port-forward: ${YELLOW}kubectl port-forward -n monitoring svc/grafana 3000:80${NC}"
        echo -e "  🌐 Then visit: ${GREEN}http://localhost:3000${NC}"
        
        # Try to get Grafana credentials
        GRAFANA_PASSWORD=$(kubectl get secret -n monitoring grafana -o jsonpath='{.data.admin-password}' 2>/dev/null | base64 -d 2>/dev/null)
        if [ ! -z "$GRAFANA_PASSWORD" ]; then
            echo -e "  👤 Username: ${YELLOW}admin${NC}"
            echo -e "  🔑 Password: ${YELLOW}${GRAFANA_PASSWORD}${NC}"
        else
            echo -e "  👤 Username: ${YELLOW}admin${NC}"
            echo -e "  🔑 Password: ${YELLOW}admin${NC} (default)"
        fi
    fi
    
    # Check Prometheus
    PROMETHEUS_SERVICE=$(kubectl get svc -n monitoring prometheus-server -o name 2>/dev/null)
    if [ ! -z "$PROMETHEUS_SERVICE" ]; then
        echo -e "📊 Prometheus:"
        echo -e "  🔗 Access via port-forward: ${YELLOW}kubectl port-forward -n monitoring svc/prometheus-server 9090:80${NC}"
        echo -e "  🌐 Then visit: ${GREEN}http://localhost:9090${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Monitoring stack not found${NC}"
    echo "To deploy monitoring, run: ./scripts/deploy-monitoring.sh"
fi
echo ""

echo -e "${BLUE}🗄️  DATABASE INFORMATION${NC}"
echo "----------------------"

# Check for RDS information
if command -v aws &> /dev/null; then
    RDS_ENDPOINT=$(aws rds describe-db-instances --region eu-central-1 --query 'DBInstances[0].Endpoint.Address' --output text 2>/dev/null)
    if [ "$RDS_ENDPOINT" != "None" ] && [ ! -z "$RDS_ENDPOINT" ]; then
        echo -e "🗄️  PostgreSQL RDS:"
        echo -e "  📍 Endpoint: ${YELLOW}${RDS_ENDPOINT}${NC}"
        echo -e "  🔌 Port: ${YELLOW}5432${NC}"
        echo -e "  🗃️  Database: ${YELLOW}sre_assignment${NC}"
        echo -e "  👤 Username: ${YELLOW}sre_user${NC}"
        echo -e "  🔑 Password: ${YELLOW}[Check AWS Secrets Manager]${NC}"
    else
        echo -e "${YELLOW}⚠️  RDS instance not found or AWS CLI not configured${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  AWS CLI not found - cannot fetch RDS information${NC}"
fi

# Check Redis
REDIS_SERVICE=$(kubectl get svc -n backend redis -o name 2>/dev/null)
if [ ! -z "$REDIS_SERVICE" ]; then
    echo -e "⚡ Redis Cache:"
    echo -e "  🔗 Access via port-forward: ${YELLOW}kubectl port-forward -n backend svc/redis 6379:6379${NC}"
    echo -e "  🔌 Port: ${YELLOW}6379${NC}"
else
    echo -e "${YELLOW}⚠️  Redis service not found${NC}"
fi
echo ""

echo -e "${BLUE}🛠️  USEFUL COMMANDS${NC}"
echo "-----------------"
echo -e "🔍 Check all services status:"
echo -e "  ${YELLOW}kubectl get pods -A${NC}"
echo ""
echo -e "📋 Check ingress status:"
echo -e "  ${YELLOW}kubectl get ingress -A${NC}"
echo ""
echo -e "📊 Check service logs:"
echo -e "  ${YELLOW}kubectl logs -f deployment/frontend -n default${NC}"
echo -e "  ${YELLOW}kubectl logs -f deployment/api-service -n backend${NC}"
echo -e "  ${YELLOW}kubectl logs -f deployment/auth-service -n backend${NC}"
echo -e "  ${YELLOW}kubectl logs -f deployment/image-service -n backend${NC}"
echo ""
echo -e "🔧 Port forward for local access:"
echo -e "  ${YELLOW}kubectl port-forward -n default svc/frontend 3000:3000${NC}"
echo ""
echo -e "🗑️  Clean up deployment:"
echo -e "  ${YELLOW}cd terraform/environments/poc && terraform destroy${NC}"
echo ""

echo -e "${BLUE}📁 IMPORTANT FILES${NC}"
echo "-----------------"
echo -e "🔧 Terraform config: ${YELLOW}terraform/environments/poc/${NC}"
echo -e "📋 Kubernetes manifests: ${YELLOW}manifests/${NC}"
echo -e "🚀 Deployment scripts: ${YELLOW}scripts/${NC}"
echo -e "📊 Monitoring config: ${YELLOW}manifests/monitoring/${NC}"
echo ""

echo -e "${BLUE}📞 SUPPORT${NC}"
echo "----------"
echo -e "📖 Documentation: ${GREEN}https://${LB_URL:-your-load-balancer-url}/docs${NC}"
echo -e "🐛 Issues: ${GREEN}https://github.com/nauuaf/aws-deployment-k8s/issues${NC}"
echo -e "📚 Repository: ${GREEN}https://github.com/nauuaf/aws-deployment-k8s${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}        END OF DEPLOYMENT INFO          ${NC}"
echo -e "${GREEN}========================================${NC}"

# Save this information to a file
cat > deployment-info.txt << EOF
DEPLOYMENT INFORMATION
======================

Load Balancer URL: https://${LB_URL:-your-load-balancer-url}
Frontend URL: https://${LB_URL:-your-load-balancer-url}
API URL: https://${LB_URL:-your-load-balancer-url}/api
Auth Service: https://${LB_URL:-your-load-balancer-url}/api/v1/auth
Image Service: https://${LB_URL:-your-load-balancer-url}/api/v1/images
API Playground: https://${LB_URL:-your-load-balancer-url}/api/playground

Demo Credentials:
- Email: admin@example.com
- Password: demo123

Grafana Access:
- Command: kubectl port-forward -n monitoring svc/grafana 3000:80
- URL: http://localhost:3000
- Username: admin
- Password: ${GRAFANA_PASSWORD:-admin}

Generated on: $(date)
EOF

echo -e "${GREEN}💾 Deployment information saved to: deployment-info.txt${NC}"