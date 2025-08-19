# S3 Module for SRE Assignment

variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}

variable "versioning_enabled" {
  description = "Enable versioning"
  type        = bool
  default     = true
}

variable "encryption_enabled" {
  description = "Enable encryption"
  type        = bool
  default     = true
}

variable "block_public_acls" {
  description = "Block public ACLs"
  type        = bool
  default     = true
}

variable "block_public_policy" {
  description = "Block public policy"
  type        = bool
  default     = true
}

variable "ignore_public_acls" {
  description = "Ignore public ACLs"
  type        = bool
  default     = true
}

variable "restrict_public_buckets" {
  description = "Restrict public buckets"
  type        = bool
  default     = true
}

variable "lifecycle_rules" {
  description = "Lifecycle rules for S3 bucket"
  type = list(object({
    id     = string
    status = string
    prefix = optional(string, "")
    expiration = optional(object({
      days = number
    }), null)
    noncurrent_version_expiration = optional(object({
      days = number
    }), null)
  }))
  default = []
  
  validation {
    condition = alltrue([
      for rule in var.lifecycle_rules : 
      contains(["Enabled", "Disabled"], rule.status)
    ])
    error_message = "Lifecycle rule status must be either 'Enabled' or 'Disabled'."
  }
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "force_destroy" {
  description = "Allow bucket to be destroyed even if it contains objects"
  type        = bool
  default     = true
}

variable "create_new_bucket" {
  description = "Create a new bucket with random suffix if original name exists"
  type        = bool
  default     = false
}

# Random suffix for bucket name if needed
resource "random_string" "bucket_suffix" {
  count   = var.create_new_bucket ? 1 : 0
  length  = 8
  special = false
  upper   = false
}

# S3 Bucket - handle existing bucket scenario
resource "aws_s3_bucket" "main" {
  bucket = var.create_new_bucket ? "${var.bucket_name}-${random_string.bucket_suffix[0].result}" : var.bucket_name
  force_destroy = var.force_destroy

  tags = merge(var.tags, {
    Name = var.create_new_bucket ? "${var.bucket_name}-${random_string.bucket_suffix[0].result}" : var.bucket_name
    OriginalName = var.bucket_name
  })
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = var.versioning_enabled ? "Enabled" : "Disabled"
  }
}

# S3 Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  count  = var.encryption_enabled ? 1 : 0
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = var.block_public_acls
  block_public_policy     = var.block_public_policy
  ignore_public_acls      = var.ignore_public_acls
  restrict_public_buckets = var.restrict_public_buckets
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "main" {
  count  = length(var.lifecycle_rules) > 0 ? 1 : 0
  bucket = aws_s3_bucket.main.id

  dynamic "rule" {
    for_each = var.lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.status

      filter {
        prefix = lookup(rule.value, "prefix", "")
      }

      dynamic "expiration" {
        for_each = lookup(rule.value, "expiration", null) != null ? [rule.value.expiration] : []
        content {
          days = expiration.value.days
        }
      }

      dynamic "noncurrent_version_expiration" {
        for_each = lookup(rule.value, "noncurrent_version_expiration", null) != null ? [rule.value.noncurrent_version_expiration] : []
        content {
          noncurrent_days = noncurrent_version_expiration.value.days
        }
      }
    }
  }
}