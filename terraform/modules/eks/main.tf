# EKS Module - Placeholder that uses AWS EKS Terraform module

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.30"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for EKS cluster"
  type        = list(string)
}

variable "node_groups" {
  description = "Node group configurations"
  type        = any
  default     = {}
}

# Individual node group variables for backwards compatibility
variable "node_group_name" {
  description = "Name of the node group"
  type        = string
  default     = "main"
}

variable "node_instance_types" {
  description = "Instance types for node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_group_min_size" {
  description = "Minimum number of nodes"
  type        = number
  default     = 1
}

variable "node_group_max_size" {
  description = "Maximum number of nodes"
  type        = number
  default     = 3
}

variable "node_group_desired" {
  description = "Desired number of nodes"
  type        = number
  default     = 2
}

variable "node_group_capacity_type" {
  description = "Capacity type for node group"
  type        = string
  default     = "ON_DEMAND"
}

variable "enable_cluster_autoscaler" {
  description = "Enable cluster autoscaler tags"
  type        = bool
  default     = true
}

variable "cluster_enabled_log_types" {
  description = "List of cluster log types to enable"
  type        = list(string)
  default     = ["api", "audit"]
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "manage_aws_auth_configmap" {
  description = "Whether to manage aws-auth ConfigMap"
  type        = bool
  default     = true
}

variable "cloudwatch_log_retention_days" {
  description = "Number of days to retain log events in CloudWatch logs"
  type        = number
  default     = 7
}

# Use the official AWS EKS Terraform module - compatible with AWS Provider 5.x
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = var.vpc_id
  subnet_ids = var.subnet_ids

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  cluster_enabled_log_types                 = var.cluster_enabled_log_types
  cloudwatch_log_group_retention_in_days   = var.cloudwatch_log_retention_days

  # Enable cluster encryption - v19 format
  cluster_encryption_config = {
    provider_key_arn = aws_kms_key.eks.arn
    resources        = ["secrets"]
  }

  # Authentication mode removed - using default for v19

  # Temporarily disable node groups to avoid for_each issue
  # Node groups will be created separately using native AWS resources
  eks_managed_node_groups = {}
  self_managed_node_groups = {}
  
  # Enable IRSA (IAM Roles for Service Accounts)
  enable_irsa = true
  
  # Cluster addons - will be deployed after node group is ready
  # Start with minimal addons to avoid timeouts
  cluster_addons = {
    vpc-cni = {
      addon_version = "v1.20.1-eksbuild.1"
      before_compute = true  # This addon should be deployed before compute
    }
    kube-proxy = {
      addon_version = "v1.30.14-eksbuild.6"
    }
  }

  tags = var.tags

  depends_on = [
    aws_kms_key.eks
  ]
}

# Data source for EKS optimized AMI
data "aws_ami" "eks_default" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amazon-eks-node-${var.cluster_version}-v*"]
  }
}

# Node Group IAM Role (separate to avoid for_each issues)
resource "aws_iam_role" "node_group" {
  name = "${var.cluster_name}-node-group-role"

  assume_role_policy = jsonencode({
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
    Version = "2012-10-17"
  })

  tags = var.tags

  lifecycle {
    ignore_changes = [
      name,
    ]
  }
}

resource "aws_iam_instance_profile" "node_group" {
  name = "${var.cluster_name}-node-group-profile"
  role = aws_iam_role.node_group.name
  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "node_group_AmazonEKSWorkerNodePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node_group.name
}

resource "aws_iam_role_policy_attachment" "node_group_AmazonEKS_CNI_Policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node_group.name
}

resource "aws_iam_role_policy_attachment" "node_group_AmazonEC2ContainerRegistryReadOnly" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node_group.name
}

# Native AWS EKS Node Group (outside the module to avoid for_each issues)
resource "aws_eks_node_group" "main" {
  cluster_name    = module.eks.cluster_name
  node_group_name = var.node_group_name
  node_role_arn   = aws_iam_role.node_group.arn
  subnet_ids      = var.subnet_ids
  
  instance_types = var.node_instance_types
  capacity_type  = var.node_group_capacity_type
  
  scaling_config {
    desired_size = var.node_group_desired
    max_size     = var.node_group_max_size
    min_size     = var.node_group_min_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    role = "worker"
  }

  tags = merge(var.tags, var.enable_cluster_autoscaler ? {
    "k8s.io/cluster-autoscaler/enabled" = "true"
    "k8s.io/cluster-autoscaler/${var.cluster_name}" = "owned"
  } : {})

  depends_on = [
    aws_iam_role_policy_attachment.node_group_AmazonEKSWorkerNodePolicy,
    aws_iam_role_policy_attachment.node_group_AmazonEKS_CNI_Policy,
    aws_iam_role_policy_attachment.node_group_AmazonEC2ContainerRegistryReadOnly,
    module.eks
  ]
}

# KMS key for EKS cluster encryption
resource "aws_kms_key" "eks" {
  description             = "EKS Secret Encryption Key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  # KMS key policy for EKS
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow EKS Service"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey*",
          "kms:ReEncrypt*"
        ]
        Resource = "*"
      }
    ]
  })

  tags = var.tags
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

resource "aws_kms_alias" "eks" {
  name          = "alias/${var.cluster_name}-eks"
  target_key_id = aws_kms_key.eks.key_id

  lifecycle {
    ignore_changes = [
      name,
    ]
  }
}

# IAM role for EBS CSI Driver
resource "aws_iam_role" "ebs_csi_driver" {
  name = "${var.cluster_name}-ebs-csi-driver"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = module.eks.oidc_provider_arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${replace(module.eks.cluster_oidc_issuer_url, "https://", "")}:sub" = "system:serviceaccount:kube-system:ebs-csi-controller-sa"
          "${replace(module.eks.cluster_oidc_issuer_url, "https://", "")}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "ebs_csi_driver" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
  role       = aws_iam_role.ebs_csi_driver.name
}

# Note: EKS module v17 handles all necessary security group rules internally
# Custom security group rules should be added to worker_groups_defaults or via variables
# rather than as separate resources to avoid conflicts

# Note: aws-auth ConfigMap is automatically managed by the EKS module
# when using managed node groups. Manual configuration may be needed
# for self-managed node groups or specific access requirements.