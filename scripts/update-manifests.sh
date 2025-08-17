#!/bin/bash

# Update Kubernetes manifests with dynamic values
# Usage: ./scripts/update-manifests.sh

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
    echo -e "${BLUE}[UPDATE-MANIFESTS]${NC} $1"
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

log "Updating Kubernetes manifests with dynamic values..."

# Check if we're in a Terraform environment
if [ ! -f "$PROJECT_ROOT/terraform/environments/poc/terraform.tfstate" ]; then
    log_warning "No Terraform state found. Using AWS CLI to get values..."
    USE_AWS_CLI=true
else
    USE_AWS_CLI=false
fi

# Get AWS Account ID
log "Getting AWS Account ID..."
if ! AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null); then
    log_error "Failed to get AWS Account ID. Make sure AWS CLI is configured."
    exit 1
fi

# Get AWS Region
log "Getting AWS Region..."
if [ "$USE_AWS_CLI" = true ]; then
    AWS_REGION=$(aws configure get region)
    if [ -z "$AWS_REGION" ]; then
        log_warning "No region configured in AWS CLI. Using default: eu-central-1"
        AWS_REGION="eu-central-1"
    fi
else
    # Try to get from Terraform outputs
    cd "$PROJECT_ROOT/terraform/environments/poc"
    AWS_REGION=$(terraform output -raw cluster_region 2>/dev/null || echo "eu-central-1")
    cd "$PROJECT_ROOT"
fi

# Get project name from Terraform or use default
PROJECT_NAME="sre-task"
if [ "$USE_AWS_CLI" = false ]; then
    cd "$PROJECT_ROOT/terraform/environments/poc"
    # Get project name from terraform output
    PROJECT_NAME=$(terraform output -raw project_name 2>/dev/null || echo "sre-task")
    cd "$PROJECT_ROOT"
fi

log "Using values:"
log "  AWS Account ID: $AWS_ACCOUNT_ID"
log "  AWS Region: $AWS_REGION"
log "  Project Name: $PROJECT_NAME"

# Create backup directory
BACKUP_DIR="$PROJECT_ROOT/manifests/.backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Function to update manifest files
update_manifest_file() {
    local file="$1"
    local backup_file="$BACKUP_DIR/$(basename "$file")"
    
    # Create backup
    cp "$file" "$backup_file"
    
    # Update placeholders - be careful to only replace in image names and specific contexts
    sed -i.tmp \
        -e "s|ACCOUNT_ID\.dkr\.ecr|$AWS_ACCOUNT_ID.dkr.ecr|g" \
        -e "s|\.AWS_REGION\.amazonaws|.$AWS_REGION.amazonaws|g" \
        -e "s|/PROJECT_NAME/|/$PROJECT_NAME/|g" \
        -e "s|name: PROJECT_NAME|name: $PROJECT_NAME|g" \
        -e "s|app: PROJECT_NAME|app: $PROJECT_NAME|g" \
        -e "s|- PROJECT_NAME\.|- $PROJECT_NAME.|g" \
        "$file"
    
    # Remove sed backup file
    rm -f "$file.tmp"
    
    log "Updated: $(basename "$file")"
}

# Find and update all manifest files with placeholders
log "Searching for manifest files with placeholders..."

UPDATED_COUNT=0
while IFS= read -r -d '' file; do
    if grep -q "ACCOUNT_ID\|AWS_REGION\|PROJECT_NAME" "$file"; then
        update_manifest_file "$file"
        ((UPDATED_COUNT++))
    fi
done < <(find "$PROJECT_ROOT/manifests" \( -name "*.yaml" -o -name "*.yml" \) -print0)

if [ $UPDATED_COUNT -eq 0 ]; then
    log_warning "No manifest files with placeholders found."
else
    log_success "Updated $UPDATED_COUNT manifest files"
    log "Backup created at: $BACKUP_DIR"
fi

# Update poc overlay if it exists
OVERLAY_FILE="$PROJECT_ROOT/overlays/poc/kustomization.yaml"
if [ -f "$OVERLAY_FILE" ]; then
    if grep -q "ACCOUNT_ID" "$OVERLAY_FILE"; then
        log "Updating poc overlay..."
        cp "$OVERLAY_FILE" "$BACKUP_DIR/overlay-kustomization.yaml"
        
        sed -i.tmp \
            -e "s/ACCOUNT_ID/$AWS_ACCOUNT_ID/g" \
            -e "s/AWS_REGION/$AWS_REGION/g" \
            -e "s/PROJECT_NAME/$PROJECT_NAME/g" \
            "$OVERLAY_FILE"
        
        rm -f "$OVERLAY_FILE.tmp"
        log_success "Updated poc overlay"
    fi
fi

log_success "Manifest update completed!"
log "Next steps:"
log "  1. Review the updated files"
log "  2. Run: kubectl apply -k overlays/poc/"
log "  3. Or run: ./scripts/deploy.sh"