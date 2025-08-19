# Simplified SRE Task POC Environment Configuration

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# Local values
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  azs         = slice(data.aws_availability_zones.available.names, 0, 3)
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr             = var.vpc_cidr
  private_subnets      = var.private_subnet_cidrs
  public_subnets       = var.public_subnet_cidrs
  database_subnets     = var.database_subnet_cidrs
  azs                  = local.azs
  name_prefix          = local.name_prefix
  enable_nat_gateway   = var.enable_nat_gateway
  single_nat_gateway   = true  # Use single NAT gateway to avoid EIP limits
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = var.tags
}

# Security Group Module
module "security_group" {
  source = "../../modules/security-group"

  name_prefix = local.name_prefix
  description = "Security group for ${local.name_prefix}"
  vpc_id      = module.vpc.vpc_id

  # Add ingress rules for RDS PostgreSQL access from VPC
  ingress_rules = [
    {
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = [module.vpc.vpc_cidr_block]
      description = "PostgreSQL access from VPC"
    }
  ]

  # Add egress rules for general outbound access
  egress_rules = [
    {
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
      description = "All outbound traffic"
    }
  ]

  tags = var.tags
}

# EKS Module
module "eks" {
  source = "../../modules/eks"

  cluster_name    = local.name_prefix
  cluster_version = var.eks_cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  node_group_name        = "${local.name_prefix}-nodes"
  node_instance_types    = var.node_group_instance_types
  node_group_min_size    = var.node_group_min_size
  node_group_max_size    = var.node_group_max_size
  node_group_desired     = var.node_group_desired
  node_group_capacity_type = var.enable_spot_instances ? "SPOT" : "ON_DEMAND"

  # Enable cluster autoscaler
  enable_cluster_autoscaler = var.enable_cluster_autoscaler

  tags = var.tags
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  identifier_prefix    = local.name_prefix
  engine_version      = var.db_engine_version
  instance_class      = var.db_instance_class
  allocated_storage   = var.db_allocated_storage
  max_allocated_storage = var.db_max_storage

  db_name  = var.db_name
  username = var.db_username

  vpc_id                 = module.vpc.vpc_id
  subnet_ids            = module.vpc.database_subnets
  vpc_security_group_ids = [module.security_group.security_group_id]

  backup_retention_period = var.db_backup_retention
  multi_az               = var.db_multi_az
  skip_final_snapshot    = var.db_skip_final_snapshot

  tags = var.tags
}

# S3 Module
module "s3" {
  source = "../../modules/s3"

  bucket_name = "${local.name_prefix}-storage"
  
  versioning_enabled = var.s3_versioning_enabled
  encryption_enabled = true
  create_new_bucket  = true  # Create new bucket with suffix if original exists
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
  
  lifecycle_rules = [{
    id     = "cleanup"
    status = "Enabled"
    expiration = {
      days = var.s3_lifecycle_days
    }
  }]

  tags = var.tags
}

# Random passwords for services
resource "random_password" "redis_password" {
  length  = 32
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

# Configure Kubernetes Provider
provider "kubernetes" {
  host                   = try(module.eks.cluster_endpoint, "")
  cluster_ca_certificate = try(base64decode(module.eks.cluster_certificate_authority_data), "")
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = compact([
      "eks",
      "get-token",
      "--cluster-name",
      coalesce(try(module.eks.cluster_name, null), local.name_prefix),
      "--region",
      var.aws_region
    ])
  }
}

# IAM Roles Module for IRSA
module "iam_roles" {
  source = "../../modules/iam-roles"
  
  cluster_name           = local.name_prefix
  cluster_oidc_issuer_url = module.eks.cluster_oidc_issuer_url
  s3_bucket_arn         = module.s3.bucket_arn
  namespace             = "backend"
  service_account_name  = "backend-service-account"
  
  tags = var.tags
  
  depends_on = [module.eks, module.s3]
}

# Kubernetes Resources Module
module "kubernetes" {
  source = "../../modules/kubernetes"
  
  
  postgres_password = module.rds.db_password
  redis_password    = random_password.redis_password.result
  jwt_secret        = random_password.jwt_secret.result
  
  # Additional variables for secrets
  s3_bucket_name = module.s3.bucket_id
  aws_region     = var.aws_region
  db_endpoint    = split(":", module.rds.db_endpoint)[0]
  db_name        = module.rds.db_name
  db_username    = module.rds.db_username
  
  # IAM role for service account
  image_service_role_arn = module.iam_roles.image_service_role_arn
  
  depends_on = [module.eks, module.iam_roles]
}

# Network Policies Module
module "network_policies" {
  source = "../../modules/network-policies"
  
  namespaces = module.kubernetes.namespaces
  
  depends_on = [module.kubernetes]
}

# Cert-Manager Module - Commented out for initial deployment
# Uncomment after EKS cluster is created and running
# module "cert_manager" {
#   source = "../../modules/cert-manager"
#   
#   eks_cluster       = module.eks
#   letsencrypt_email = var.letsencrypt_email
#   enable_tls        = var.enable_tls
#   use_letsencrypt   = var.use_letsencrypt
#   frontend_domain   = var.frontend_domain
#   
#   depends_on = [module.kubernetes]
# }

# Pod Disruption Budgets Module
module "pod_disruption_budgets" {
  source = "../../modules/pod-disruption-budgets"
  
  namespaces = module.kubernetes.namespaces
  
  depends_on = [module.kubernetes]
}

# ECR Repositories
resource "aws_ecr_repository" "repositories" {
  for_each = toset(["api-service", "auth-service", "image-service", "frontend"])
  
  name                 = "${var.project_name}/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  lifecycle {
    ignore_changes = [
      name,
    ]
  }

  tags = var.tags
}

resource "aws_ecr_lifecycle_policy" "repositories" {
  for_each = aws_ecr_repository.repositories

  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus     = "tagged"
        tagPrefixList = ["v", "latest"]
        countType     = "imageCountMoreThan"
        countNumber   = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}