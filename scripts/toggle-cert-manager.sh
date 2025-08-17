#!/bin/bash

# Toggle cert-manager deployment in Terraform configuration
# Usage: ./scripts/toggle-cert-manager.sh [enable|disable|status]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/environments/poc"
MAIN_TF_FILE="$TERRAFORM_DIR/main.tf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to check if cert-manager is currently enabled
check_cert_manager_status() {
    if grep -q "^module \"cert_manager\"" "$MAIN_TF_FILE"; then
        echo "enabled"
    else
        echo "disabled"
    fi
}

# Function to enable cert-manager
enable_cert_manager() {
    print_status "Enabling cert-manager module..."
    
    # Check if cert-manager block exists (commented or uncommented)
    if ! grep -q "cert_manager" "$MAIN_TF_FILE"; then
        print_error "cert-manager module block not found in $MAIN_TF_FILE"
        exit 1
    fi
    
    # Uncomment cert-manager module block
    sed -i.bak '/^# module "cert_manager"/,/^# }/ s/^# //' "$MAIN_TF_FILE"
    
    if [ $? -eq 0 ]; then
        print_success "cert-manager module has been enabled"
        print_warning "Remember to run 'terraform plan && terraform apply' to deploy cert-manager"
    else
        print_error "Failed to enable cert-manager module"
        exit 1
    fi
}

# Function to disable cert-manager
disable_cert_manager() {
    print_status "Disabling cert-manager module..."
    
    # Check if cert-manager block exists
    if ! grep -q "cert_manager" "$MAIN_TF_FILE"; then
        print_error "cert-manager module block not found in $MAIN_TF_FILE"
        exit 1
    fi
    
    # Comment out cert-manager module block
    sed -i.bak '/^module "cert_manager"/,/^}/ s/^/# /' "$MAIN_TF_FILE"
    
    if [ $? -eq 0 ]; then
        print_success "cert-manager module has been disabled"
        print_warning "Remember to run 'terraform plan && terraform apply' to remove cert-manager resources"
    else
        print_error "Failed to disable cert-manager module"
        exit 1
    fi
}

# Function to show current status
show_status() {
    local status=$(check_cert_manager_status)
    print_status "Current cert-manager status: $status"
    
    if [ "$status" = "enabled" ]; then
        echo -e "  ${GREEN}✓${NC} cert-manager module is active (Phase 1B)"
        echo -e "  ${BLUE}ℹ${NC} TLS certificates will be managed automatically"
    else
        echo -e "  ${YELLOW}✗${NC} cert-manager module is disabled (Phase 1A)"
        echo -e "  ${BLUE}ℹ${NC} TLS certificates will not be managed"
    fi
}

# Function to show help
show_help() {
    echo "Toggle cert-manager deployment in Terraform configuration"
    echo ""
    echo "Usage: $0 [enable|disable|status|help]"
    echo ""
    echo "Commands:"
    echo "  enable    Enable cert-manager module (Phase 1B)"
    echo "  disable   Disable cert-manager module (Phase 1A)"
    echo "  status    Show current cert-manager status"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 enable     # Enable cert-manager for TLS management"
    echo "  $0 disable    # Disable cert-manager for initial deployment"
    echo "  $0 status     # Check current configuration"
    echo ""
    echo "Note: After toggling, run 'terraform plan && terraform apply' to apply changes"
}

# Validate terraform directory exists
if [ ! -f "$MAIN_TF_FILE" ]; then
    print_error "Terraform main.tf file not found at: $MAIN_TF_FILE"
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Main script logic
case "${1:-status}" in
    "enable")
        current_status=$(check_cert_manager_status)
        if [ "$current_status" = "enabled" ]; then
            print_warning "cert-manager is already enabled"
            show_status
        else
            enable_cert_manager
            echo ""
            show_status
            echo ""
            print_status "Next steps:"
            echo "  1. cd terraform/environments/poc"
            echo "  2. terraform plan"
            echo "  3. terraform apply"
        fi
        ;;
    "disable")
        current_status=$(check_cert_manager_status)
        if [ "$current_status" = "disabled" ]; then
            print_warning "cert-manager is already disabled"
            show_status
        else
            disable_cert_manager
            echo ""
            show_status
            echo ""
            print_status "Next steps:"
            echo "  1. cd terraform/environments/poc"
            echo "  2. terraform plan"
            echo "  3. terraform apply"
        fi
        ;;
    "status")
        show_status
        echo ""
        print_status "To toggle cert-manager:"
        echo "  Enable:  $0 enable"
        echo "  Disable: $0 disable"
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Invalid command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac