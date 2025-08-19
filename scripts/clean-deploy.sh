#!/bin/bash

# Clean deployment script for SRE Assignment
# This script ensures a clean deployment from scratch

set -e

# Disable AWS CLI pager to prevent interactive prompts
export AWS_PAGER=""

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

# Check prerequisites
command -v terraform >/dev/null 2>&1 || { print_error "terraform is required but not installed. Aborting."; exit 1; }
command -v aws >/dev/null 2>&1 || { print_error "aws cli is required but not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1 || { print_error "jq is required but not installed. Aborting."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { print_error "kubectl is required but not installed. Aborting."; exit 1; }

# Check AWS configuration
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    print_error "AWS CLI is not configured or credentials are invalid. Please run 'aws configure'."
    exit 1
fi

# Validate directories exist
if [ ! -d "$TERRAFORM_DIR" ]; then
    print_error "Terraform directory not found: $TERRAFORM_DIR"
    print_error "Please ensure you're running this script from the project root directory"
    exit 1
fi

if [ ! -f "$TERRAFORM_DIR/main.tf" ]; then
    print_error "Terraform main.tf not found in: $TERRAFORM_DIR"
    print_error "Please ensure the terraform configuration exists"
    exit 1
fi

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
            
            # Try to destroy in proper dependency order
            print_status "Destroying Kubernetes resources first..."
            terraform destroy -target=module.pod_disruption_budgets -auto-approve || true
            terraform destroy -target=module.network_policies -auto-approve || true
            terraform destroy -target=module.kubernetes -auto-approve || true
            
            print_status "Destroying ECR resources..."
            terraform destroy -target=aws_ecr_lifecycle_policy -auto-approve || true
            terraform destroy -target=aws_ecr_repository -auto-approve || true
            
            print_status "Destroying S3 resources..."
            terraform destroy -target=module.s3 -auto-approve || true
            
            print_status "Destroying RDS resources..."
            terraform destroy -target=module.rds -auto-approve || true
            
            print_status "Destroying EKS cluster - please wait..."
            terraform destroy -target=module.eks -auto-approve || true
            
            print_status "Destroying IAM roles..."
            terraform destroy -target=module.iam_roles -auto-approve || true
            
            print_status "Destroying security groups..."
            terraform destroy -target=module.security_group -auto-approve || true
            
            print_status "Destroying VPC (this should be last)..."
            terraform destroy -target=module.vpc -auto-approve || true
            
            print_status "Final cleanup attempt..."
            terraform destroy -auto-approve || {
                print_warning "Some resources may still exist. Running cleanup script..."
                cd "$PROJECT_ROOT"
                bash scripts/cleanup-resources.sh --auto || true
                cd "$TERRAFORM_DIR"
            }
        }
        
        # Clean up state file
        print_status "Cleaning up state files..."
        rm -f terraform.tfstate terraform.tfstate.backup
    fi
else
    # No terraform state but may have orphaned AWS resources
    print_status "No terraform state found. Checking for orphaned AWS resources..."
    echo "Do you want to run resource cleanup to handle potential conflicts? (y/n)"
    read -r response
    
    if [ "$response" = "y" ]; then
        print_status "Running AWS resource cleanup..."
        cd "$PROJECT_ROOT"
        if [ -f scripts/cleanup-resources.sh ]; then
            bash scripts/cleanup-resources.sh --auto
        else
            print_warning "Cleanup script not found. You may encounter resource conflicts."
        fi
        cd "$TERRAFORM_DIR"
    fi
fi

# Step 2: Ensure cert-manager is disabled for initial deployment
print_status "Ensuring cert-manager is disabled for initial deployment..."
cd "$PROJECT_ROOT"
./scripts/toggle-cert-manager.sh disable
cd "$TERRAFORM_DIR"

# Step 3: Initialize Terraform
print_status "Initializing Terraform..."
if ! terraform init -upgrade; then
    print_error "Terraform initialization failed"
    print_error "Common causes:"
    print_error "  1. Invalid AWS credentials"
    print_error "  2. Network connectivity issues"
    print_error "  3. Terraform configuration errors"
    exit 1
fi

# Step 4: Create deployment plan
print_status "Creating deployment plan..."
if ! terraform plan -out=tfplan; then
    print_error "Terraform plan failed"
    print_error "Check the errors above and ensure:"
    print_error "  1. All required variables are set"
    print_error "  2. AWS permissions are sufficient"
    print_error "  3. No resource naming conflicts exist"
    exit 1
fi

# Step 5: Show summary
echo ""
print_status "Deployment plan created. Review the plan above."
echo ""
echo "Resources to be created:"
RESOURCE_COUNT=$(terraform show -json tfplan 2>/dev/null | jq -r '.resource_changes[] | select(.change.actions[] == "create") | .address' 2>/dev/null | wc -l | tr -d ' ')
echo "  Total: ${RESOURCE_COUNT:-0}"

echo ""
echo "Do you want to proceed with the deployment? (y/n)"
read -r response

if [ "$response" != "y" ]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Step 6: Apply the plan (first pass - infrastructure only)
print_status "Starting infrastructure deployment (Phase 1)..."
print_warning "Creating EKS cluster - please wait..."

# First, apply only the infrastructure resources (not K8s resources)
terraform apply tfplan || {
    print_error "Deployment failed. This might be due to resource conflicts."
    print_status "Attempting to resolve conflicts and retry..."
    
    # Run cleanup script if deployment fails
    cd "$PROJECT_ROOT"
    if [ -f scripts/cleanup-resources.sh ]; then
        print_status "Running resource cleanup to resolve conflicts..."
        bash scripts/cleanup-resources.sh --auto
        cd "$TERRAFORM_DIR"
        
        # Refresh and try again
        print_status "Refreshing terraform state and retrying deployment..."
        terraform refresh
        terraform plan -out=tfplan-retry
        
        # Check if we have EKS resources and configure access if needed
        if terraform state list | grep -q "module.eks"; then
            print_status "EKS cluster detected. Configuring access for retry..."
            CLUSTER_NAME=$(terraform output -raw cluster_name 2>/dev/null || echo "sre-task-poc")
            REGION=$(terraform output -raw cluster_region 2>/dev/null || echo "eu-central-1")
            
            # Update kubeconfig
            aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME" 2>/dev/null || true
            
            # Configure EKS access entry for current user
            CURRENT_USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
            aws eks create-access-entry --cluster-name "$CLUSTER_NAME" --principal-arn "$CURRENT_USER_ARN" --region "$REGION" 2>/dev/null || true
            aws eks associate-access-policy --cluster-name "$CLUSTER_NAME" --principal-arn "$CURRENT_USER_ARN" --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy --access-scope type=cluster --region "$REGION" 2>/dev/null || true
            
            # Wait a moment for access to propagate
            sleep 10
        fi
        
        terraform apply tfplan-retry || {
            print_error "Deployment failed again. Manual intervention required."
            print_error "Common issues:"
            print_error "  1. Check AWS resource limits (EIPs, VPCs, etc.)"
            print_error "  2. Verify IAM permissions"
            print_error "  3. Check for existing resources with same names"
            print_error "  4. EKS cluster authentication (try: kubectl get nodes)"
            exit 1
        }
    else
        print_error "Cleanup script not found. Manual intervention required."
        exit 1
    fi
}

# Step 7: Verify deployment
print_success "Infrastructure deployed successfully!"
echo ""
print_status "Cluster information:"
CLUSTER_NAME=$(terraform output -raw cluster_name 2>/dev/null || echo "")
REGION=$(terraform output -raw cluster_region 2>/dev/null || echo "")
echo "  Cluster Name: $CLUSTER_NAME"
echo "  Region: $REGION"
echo ""

# Step 8: Configure kubectl and cluster authentication
print_status "Configuring kubectl and cluster authentication..."

# Update kubeconfig
if [ -n "$CLUSTER_NAME" ] && [ -n "$REGION" ]; then
    print_status "Updating kubeconfig for cluster: $CLUSTER_NAME"
    if ! aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME"; then
        print_error "Failed to update kubeconfig"
        exit 1
    fi
    
    # Configure EKS access entry for current user
    print_status "Configuring cluster access permissions..."
    CURRENT_USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    aws eks create-access-entry --cluster-name "$CLUSTER_NAME" --principal-arn "$CURRENT_USER_ARN" --region "$REGION" 2>/dev/null || true
    aws eks associate-access-policy --cluster-name "$CLUSTER_NAME" --principal-arn "$CURRENT_USER_ARN" --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy --access-scope type=cluster --region "$REGION" 2>/dev/null || true
    
    # Wait for cluster to be fully ready
    print_status "Waiting for EKS cluster to be fully ready..."
    RETRIES=30
    for i in $(seq 1 $RETRIES); do
        if kubectl get nodes >/dev/null 2>&1; then
            print_success "Cluster is ready!"
            kubectl get nodes
            break
        else
            if [ $i -eq $RETRIES ]; then
                print_error "Cluster is not accessible after $RETRIES attempts"
                print_error "Please check cluster status and authentication"
                exit 1
            fi
            echo -n "."
            sleep 10
        fi
    done
    echo ""
    
    # Wait a bit more for nodes to stabilize
    print_status "Waiting for nodes to stabilize..."
    sleep 20
else
    print_error "Could not get cluster information from Terraform outputs"
    exit 1
fi

# Step 9: Apply Kubernetes resources (Phase 2)
print_status "Deploying Kubernetes resources (Phase 2)..."

# Apply Kubernetes resources with retry logic
MAX_RETRIES=3
RETRY_COUNT=0
APPLY_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$APPLY_SUCCESS" = "false" ]; do
    if terraform apply -auto-approve -refresh=false; then
        APPLY_SUCCESS=true
        print_success "Kubernetes resources deployed successfully!"
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            print_warning "Deployment attempt $RETRY_COUNT failed. Retrying..."
            
            # Check if it's a job-related error
            if terraform plan 2>&1 | grep -q "job.*is not in complete state"; then
                print_status "Cleaning up old jobs..."
                kubectl delete jobs --all -n backend 2>/dev/null || true
                sleep 5
            fi
            
            sleep 30
        else
            print_error "Failed to apply Kubernetes resources after $MAX_RETRIES attempts"
            print_status "Retry manually: terraform apply"
            exit 1
        fi
    fi
done

# Step 10: Final verification
print_status "Verifying final deployment..."
kubectl get nodes
kubectl get namespaces

# Check database initialization status
print_status "Checking database initialization..."
if kubectl get jobs -n backend 2>/dev/null | grep -q "db-init"; then
    JOB_STATUS=$(kubectl get jobs -n backend -o jsonpath='{.items[?(@.metadata.labels.app=="db-init")].status.conditions[0].type}' 2>/dev/null || echo "Unknown")
    if [ "$JOB_STATUS" = "Complete" ]; then
        print_success "Database initialization completed successfully"
    elif [ "$JOB_STATUS" = "Failed" ]; then
        print_warning "Database initialization job failed. Check logs: kubectl logs -n backend -l app=db-init"
    else
        print_status "Database initialization status: $JOB_STATUS"
    fi
fi

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