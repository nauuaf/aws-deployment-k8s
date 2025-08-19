#!/bin/bash

# Cleanup Resources Script
# This script cleans up existing AWS resources that might conflict with new deployments

set -e

# Disable AWS CLI pager to prevent interactive prompts
export AWS_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[INFO]${NC} AWS Resource Cleanup"
echo

# Check if running in automatic mode (non-interactive)
AUTO_MODE=false
if [[ "$1" == "--auto" ]]; then
    AUTO_MODE=true
    echo -e "${YELLOW}[INFO]${NC} Running in automatic mode (non-interactive)"
fi

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform/environments/poc"

# Get project name
PROJECT_NAME="sre-task"
ENVIRONMENT="poc"

if [ -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
    PROJECT_NAME=$(grep 'project_name' "$TERRAFORM_DIR/terraform.tfvars" | cut -d'=' -f2 | tr -d ' "' || echo "sre-task")
fi

echo -e "${YELLOW}[INFO]${NC} Project: $PROJECT_NAME"
echo -e "${YELLOW}[INFO]${NC} Environment: $ENVIRONMENT"
echo

# Function to safely delete resources
safe_delete() {
    local resource_type="$1"
    local resource_name="$2"
    local check_command="$3"
    local delete_command="$4"
    
    echo -e "${BLUE}[INFO]${NC} Checking $resource_type: $resource_name"
    
    # Use the check command to see if resource exists
    if eval "$check_command" >/dev/null 2>&1; then
        echo -e "${YELLOW}[WARNING]${NC} $resource_type exists: $resource_name"
        
        if [ "$AUTO_MODE" = true ]; then
            echo -e "${YELLOW}[AUTO]${NC} Automatically deleting $resource_type: $resource_name"
            if eval "$delete_command" >/dev/null 2>&1; then
                echo -e "${GREEN}[SUCCESS]${NC} Deleted $resource_type: $resource_name"
            else
                echo -e "${RED}[ERROR]${NC} Failed to delete $resource_type: $resource_name"
            fi
        else
            read -p "Delete $resource_type? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if eval "$delete_command" >/dev/null 2>&1; then
                    echo -e "${GREEN}[SUCCESS]${NC} Deleted $resource_type: $resource_name"
                else
                    echo -e "${RED}[ERROR]${NC} Failed to delete $resource_type: $resource_name"
                fi
            fi
        fi
    else
        echo -e "${GREEN}[OK]${NC} $resource_type does not exist: $resource_name"
    fi
}

# 1. Clean up ECR Repositories
echo -e "${BLUE}[SECTION]${NC} ECR Repositories"
for service in "api-service" "auth-service" "image-service" "frontend"; do
    safe_delete "ECR Repository" "$PROJECT_NAME/$service" \
        "aws ecr describe-repositories --repository-names $PROJECT_NAME/$service 2>/dev/null" \
        "aws ecr delete-repository --repository-name $PROJECT_NAME/$service --force"
done

# 2. Clean up CloudWatch Log Groups
echo -e "${BLUE}[SECTION]${NC} CloudWatch Log Groups"
safe_delete "CloudWatch Log Group" "/aws/eks/$PROJECT_NAME-$ENVIRONMENT/cluster" \
    "aws logs describe-log-groups --log-group-name-prefix /aws/eks/$PROJECT_NAME-$ENVIRONMENT/cluster --query 'logGroups[?logGroupName==\`/aws/eks/$PROJECT_NAME-$ENVIRONMENT/cluster\`]' --output text" \
    "aws logs delete-log-group --log-group-name /aws/eks/$PROJECT_NAME-$ENVIRONMENT/cluster"

# 3. Clean up KMS Aliases
echo -e "${BLUE}[SECTION]${NC} KMS Aliases"
safe_delete "KMS Alias" "alias/eks/$PROJECT_NAME-$ENVIRONMENT" \
    "aws kms list-aliases --query 'Aliases[?AliasName==\`alias/eks/$PROJECT_NAME-$ENVIRONMENT\`]' --output text 2>/dev/null | grep -q 'alias/eks/$PROJECT_NAME-$ENVIRONMENT'" \
    "aws kms delete-alias --alias-name alias/eks/$PROJECT_NAME-$ENVIRONMENT"

safe_delete "KMS Alias" "alias/$PROJECT_NAME-$ENVIRONMENT-eks" \
    "aws kms list-aliases --query 'Aliases[?AliasName==\`alias/$PROJECT_NAME-$ENVIRONMENT-eks\`]' --output text 2>/dev/null | grep -q 'alias/$PROJECT_NAME-$ENVIRONMENT-eks'" \
    "aws kms delete-alias --alias-name alias/$PROJECT_NAME-$ENVIRONMENT-eks"

# 4. Clean up KMS Keys (after aliases are deleted)
echo -e "${BLUE}[SECTION]${NC} KMS Keys"
# Get key IDs for the aliases we just deleted
KMS_KEY_1=$(aws kms list-aliases --query 'Aliases[?AliasName==`alias/eks/'$PROJECT_NAME-$ENVIRONMENT'`].TargetKeyId' --output text 2>/dev/null || echo "")
KMS_KEY_2=$(aws kms list-aliases --query 'Aliases[?AliasName==`alias/'$PROJECT_NAME-$ENVIRONMENT'-eks`].TargetKeyId' --output text 2>/dev/null || echo "")

if [ -n "$KMS_KEY_1" ] && [ "$KMS_KEY_1" != "None" ]; then
    echo -e "${BLUE}[INFO]${NC} Scheduling deletion of KMS Key: $KMS_KEY_1"
    if [ "$AUTO_MODE" = true ]; then
        aws kms schedule-key-deletion --key-id "$KMS_KEY_1" --pending-window-in-days 7 2>/dev/null || echo -e "${YELLOW}[WARNING]${NC} Key may already be scheduled for deletion"
    fi
fi

if [ -n "$KMS_KEY_2" ] && [ "$KMS_KEY_2" != "None" ]; then
    echo -e "${BLUE}[INFO]${NC} Scheduling deletion of KMS Key: $KMS_KEY_2"
    if [ "$AUTO_MODE" = true ]; then
        aws kms schedule-key-deletion --key-id "$KMS_KEY_2" --pending-window-in-days 7 2>/dev/null || echo -e "${YELLOW}[WARNING]${NC} Key may already be scheduled for deletion"
    fi
fi

# 5. Clean up IAM Roles with better error handling
echo -e "${BLUE}[SECTION]${NC} IAM Roles"

# Function to clean up IAM role with attached policies and instance profiles
cleanup_iam_role() {
    local role_name="$1"
    echo -e "${BLUE}[INFO]${NC} Cleaning up IAM Role: $role_name"
    
    if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
        echo -e "${YELLOW}[WARNING]${NC} IAM Role exists: $role_name"
        
        if [ "$AUTO_MODE" = true ]; then
            echo -e "${YELLOW}[AUTO]${NC} Automatically cleaning up IAM Role: $role_name"
            
            # Detach managed policies
            aws iam list-attached-role-policies --role-name "$role_name" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null | tr '\t' '\n' | while read -r policy_arn; do
                if [ -n "$policy_arn" ] && [ "$policy_arn" != "None" ]; then
                    echo -e "${BLUE}[INFO]${NC} Detaching policy: $(basename "$policy_arn")"
                    aws iam detach-role-policy --role-name "$role_name" --policy-arn "$policy_arn" >/dev/null 2>&1 || true
                fi
            done
            
            # Delete inline policies
            aws iam list-role-policies --role-name "$role_name" --query 'PolicyNames' --output text 2>/dev/null | tr '\t' '\n' | while read -r policy_name; do
                if [ -n "$policy_name" ] && [ "$policy_name" != "None" ]; then
                    echo -e "${BLUE}[INFO]${NC} Deleting inline policy: $policy_name"
                    aws iam delete-role-policy --role-name "$role_name" --policy-name "$policy_name" >/dev/null 2>&1 || true
                fi
            done
            
            # Remove from instance profiles
            aws iam list-instance-profiles-for-role --role-name "$role_name" --query 'InstanceProfiles[].InstanceProfileName' --output text 2>/dev/null | tr '\t' '\n' | while read -r profile_name; do
                if [ -n "$profile_name" ] && [ "$profile_name" != "None" ]; then
                    echo -e "${BLUE}[INFO]${NC} Removing role from instance profile: $profile_name"
                    aws iam remove-role-from-instance-profile --instance-profile-name "$profile_name" --role-name "$role_name" >/dev/null 2>&1 || true
                fi
            done
            
            # Delete the role
            if aws iam delete-role --role-name "$role_name" >/dev/null 2>&1; then
                echo -e "${GREEN}[SUCCESS]${NC} Deleted IAM Role: $role_name"
            else
                echo -e "${RED}[ERROR]${NC} Failed to delete IAM Role: $role_name"
            fi
        fi
    else
        echo -e "${GREEN}[OK]${NC} IAM Role does not exist: $role_name"
    fi
}

# Clean up common EKS roles
cleanup_iam_role "$PROJECT_NAME-$ENVIRONMENT-node-group-role"
cleanup_iam_role "$PROJECT_NAME-$ENVIRONMENT-cluster-service-role"
cleanup_iam_role "$PROJECT_NAME-$ENVIRONMENT-eks-cluster-role"

# 6. Clean up RDS instances (before subnet groups)
echo -e "${BLUE}[SECTION]${NC} RDS Databases"
safe_delete "RDS Database" "$PROJECT_NAME-$ENVIRONMENT-db" \
    "aws rds describe-db-instances --db-instance-identifier $PROJECT_NAME-$ENVIRONMENT-db 2>/dev/null" \
    "aws rds delete-db-instance --db-instance-identifier $PROJECT_NAME-$ENVIRONMENT-db --skip-final-snapshot --delete-automated-backups"

# Wait for database deletion to complete if it was deleted
if [ "$AUTO_MODE" = true ]; then
    echo -e "${BLUE}[INFO]${NC} Checking if database deletion is in progress..."
    DB_STATUS=$(aws rds describe-db-instances --db-instance-identifier "$PROJECT_NAME-$ENVIRONMENT-db" --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null || echo "")
    
    if [ "$DB_STATUS" = "deleting" ]; then
        echo -e "${YELLOW}[INFO]${NC} Database deletion in progress - please wait..."
        WAIT_TIME=0
        MAX_WAIT=300  # 5 minutes max wait
        
        while [ "$DB_STATUS" = "deleting" ] && [ $WAIT_TIME -lt $MAX_WAIT ]; do
            sleep 10
            WAIT_TIME=$((WAIT_TIME + 10))
            echo -n "."
            DB_STATUS=$(aws rds describe-db-instances --db-instance-identifier "$PROJECT_NAME-$ENVIRONMENT-db" --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null || echo "")
        done
        echo ""
        
        if [ "$DB_STATUS" = "deleting" ]; then
            echo -e "${YELLOW}[WARNING]${NC} Database still deleting. Continuing..."
        else
            echo -e "${GREEN}[SUCCESS]${NC} Database deletion completed"
        fi
    fi
fi

# 7. Clean up DB Subnet Groups
echo -e "${BLUE}[SECTION]${NC} DB Subnet Groups"
safe_delete "DB Subnet Group" "$PROJECT_NAME-$ENVIRONMENT-subnet-group" \
    "aws rds describe-db-subnet-groups --db-subnet-group-name $PROJECT_NAME-$ENVIRONMENT-subnet-group 2>/dev/null" \
    "aws rds delete-db-subnet-group --db-subnet-group-name $PROJECT_NAME-$ENVIRONMENT-subnet-group"

safe_delete "DB Subnet Group" "$PROJECT_NAME-$ENVIRONMENT-db-subnet-group" \
    "aws rds describe-db-subnet-groups --db-subnet-group-name $PROJECT_NAME-$ENVIRONMENT-db-subnet-group 2>/dev/null" \
    "aws rds delete-db-subnet-group --db-subnet-group-name $PROJECT_NAME-$ENVIRONMENT-db-subnet-group"

# 8. Release unused Elastic IPs
echo -e "${BLUE}[SECTION]${NC} Elastic IPs"
echo -e "${BLUE}[INFO]${NC} Checking for unassociated Elastic IPs..."

UNASSOCIATED_EIPS=$(aws ec2 describe-addresses --query 'Addresses[?AssociationId==null].AllocationId' --output text)

if [ -n "$UNASSOCIATED_EIPS" ] && [ "$UNASSOCIATED_EIPS" != "None" ]; then
    echo -e "${YELLOW}[INFO]${NC} Found unassociated Elastic IPs:"
    echo "$UNASSOCIATED_EIPS"
    
    if [ "$AUTO_MODE" = true ]; then
        echo -e "${YELLOW}[AUTO]${NC} Automatically releasing unassociated Elastic IPs"
        for eip in $UNASSOCIATED_EIPS; do
            if aws ec2 release-address --allocation-id "$eip" >/dev/null 2>&1; then
                echo -e "${GREEN}[SUCCESS]${NC} Released EIP: $eip"
            else
                echo -e "${RED}[ERROR]${NC} Failed to release EIP: $eip"
            fi
        done
    else
        read -p "Release unassociated Elastic IPs? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for eip in $UNASSOCIATED_EIPS; do
                if aws ec2 release-address --allocation-id "$eip" >/dev/null 2>&1; then
                    echo -e "${GREEN}[SUCCESS]${NC} Released EIP: $eip"
                else
                    echo -e "${RED}[ERROR]${NC} Failed to release EIP: $eip"
                fi
            done
        fi
    fi
else
    echo -e "${GREEN}[OK]${NC} No unassociated Elastic IPs found"
fi

echo
echo -e "${GREEN}[COMPLETE]${NC} Resource cleanup finished!"