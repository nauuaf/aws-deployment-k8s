#!/bin/bash

# Clean deployment script for SRE Assignment
# This script ensures a clean deployment from scratch

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/environments/poc"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

cd "$TERRAFORM_DIR"

# Step 1: Check for existing resources
print_status "Checking for existing resources..."
if [ -f terraform.tfstate ]; then
    print_warning "Found existing terraform state"
    echo "Do you want to destroy existing resources first? (y/n)"
    read -r response
    
    if [ "$response" = "y" ]; then
        print_status "Destroying existing resources..."
        terraform destroy -auto-approve || {
            print_error "Destroy failed. Trying targeted destroy..."
            
            # Try to destroy in reverse order
            terraform destroy -target=module.pod_disruption_budgets -auto-approve || true
            terraform destroy -target=module.network_policies -auto-approve || true
            terraform destroy -target=module.kubernetes -auto-approve || true
            terraform destroy -target=aws_ecr_lifecycle_policy -auto-approve || true
            terraform destroy -target=aws_ecr_repository -auto-approve || true
            terraform destroy -target=module.s3 -auto-approve || true
            terraform destroy -target=module.rds -auto-approve || true
            terraform destroy -target=module.eks -auto-approve || true
            terraform destroy -target=module.security_group -auto-approve || true
            terraform destroy -target=module.vpc -auto-approve || true
            terraform destroy -auto-approve || true
        }
        
        # Clean up state file
        print_status "Cleaning up state files..."
        rm -f terraform.tfstate terraform.tfstate.backup
    fi
fi

# Step 2: Ensure cert-manager is disabled for initial deployment
print_status "Ensuring cert-manager is disabled for initial deployment..."
cd "$PROJECT_ROOT"
./scripts/toggle-cert-manager.sh disable
cd "$TERRAFORM_DIR"

# Step 3: Initialize Terraform
print_status "Initializing Terraform..."
terraform init -upgrade

# Step 4: Create deployment plan
print_status "Creating deployment plan..."
terraform plan -out=tfplan

# Step 5: Show summary
echo ""
print_status "Deployment plan created. Review the plan above."
echo ""
echo "Resources to be created:"
terraform show -json tfplan 2>/dev/null | jq -r '.resource_changes[] | select(.change.actions[] == "create") | .address' | wc -l | xargs echo "  Total:"

echo ""
print_warning "The deployment will take approximately 15-20 minutes"
echo ""
echo "Do you want to proceed with the deployment? (y/n)"
read -r response

if [ "$response" != "y" ]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Step 6: Apply the plan
print_status "Starting deployment..."
terraform apply tfplan

# Step 7: Verify deployment
print_success "Infrastructure deployed successfully!"
echo ""
print_status "Cluster information:"
echo "  Cluster Name: $(terraform output -raw cluster_name)"
echo "  Region: $(terraform output -raw cluster_region)"
echo ""

# Step 8: Configure kubectl
print_status "Configuring kubectl..."
CLUSTER_NAME=$(terraform output -raw cluster_name)
REGION=$(terraform output -raw cluster_region)
aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME"

# Step 9: Verify cluster access
print_status "Verifying cluster access..."
kubectl get nodes

print_success "Deployment complete!"
echo ""
print_status "Next steps:"
echo "  1. Deploy applications: cd $PROJECT_ROOT && ./scripts/deploy.sh"
echo "  2. (Optional) Enable cert-manager:"
echo "     - cd $PROJECT_ROOT"
echo "     - ./scripts/toggle-cert-manager.sh enable"
echo "     - cd terraform/environments/poc"
echo "     - terraform apply"
echo ""
print_status "Access information:"
terraform output access_info