#!/bin/bash

# Quick deployment info script
# Gets the essential information users need to access their deployment

echo "🚀 Quick Deployment Information"
echo "==============================="

# Get load balancer URL
LB_URL=$(kubectl get ingress -n default main-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)

if [ -z "$LB_URL" ]; then
    echo "❌ Load balancer not ready yet. Please wait a few minutes."
    echo "Check status with: kubectl get ingress -n default"
    exit 1
fi

echo ""
echo "🌐 Your Application URLs:"
echo "------------------------"
echo "Frontend:       https://$LB_URL"
echo "API Playground: https://$LB_URL/api/playground"
echo "Documentation:  https://$LB_URL/docs"
echo ""

echo "🔐 Demo Login Credentials:"
echo "-------------------------"
echo "Email:    admin@example.com"
echo "Password: demo123"
echo ""

echo "📊 Monitoring (Port Forward Required):"
echo "-------------------------------------"
echo "Grafana:    kubectl port-forward -n monitoring svc/grafana 3000:80"
echo "            Then visit: http://localhost:3000"
echo "            Username: admin | Password: admin"
echo ""

echo "🛠️  Quick Commands:"
echo "------------------"
echo "Check status:  kubectl get pods -A"
echo "View logs:     kubectl logs -f deployment/frontend -n default"
echo "Cleanup:       cd terraform/environments/poc && terraform destroy"
echo ""

echo "✅ Your deployment is ready at: https://$LB_URL"