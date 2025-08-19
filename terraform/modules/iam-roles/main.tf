# IAM Roles Module for EKS Service Accounts

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_oidc_issuer_url" {
  description = "The URL of the OpenID Connect identity provider"
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 bucket for images"
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "backend"
}

variable "service_account_name" {
  description = "Name of the Kubernetes service account"
  type        = string
  default     = "backend-service-account"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Extract OIDC issuer from URL
locals {
  oidc_issuer = replace(var.cluster_oidc_issuer_url, "https://", "")
}

# IAM role for image service with S3 access
resource "aws_iam_role" "image_service_role" {
  name = "${var.cluster_name}-image-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRoleWithWebIdentity"
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${local.oidc_issuer}"
        }
        Condition = {
          StringEquals = {
            "${local.oidc_issuer}:sub" = "system:serviceaccount:${var.namespace}:${var.service_account_name}"
            "${local.oidc_issuer}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = var.tags
}

# IAM policy for S3 access
resource "aws_iam_policy" "s3_access_policy" {
  name        = "${var.cluster_name}-s3-access-policy"
  description = "Policy for S3 access from image service"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion",
          "s3:PutObjectAcl",
          "s3:GetObjectAcl"
        ]
        Resource = [
          "${var.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:ListBucketVersions"
        ]
        Resource = [
          var.s3_bucket_arn
        ]
      }
    ]
  })

  tags = var.tags
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "image_service_s3_access" {
  role       = aws_iam_role.image_service_role.name
  policy_arn = aws_iam_policy.s3_access_policy.arn
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}