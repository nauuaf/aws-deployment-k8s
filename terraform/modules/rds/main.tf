# Simplified RDS Module for SRE Task

variable "identifier_prefix" {
  description = "Identifier prefix for RDS instance"
  type        = string
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Name of the database"
  type        = string
}

variable "username" {
  description = "Username for the database"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for RDS"
  type        = list(string)
}

variable "vpc_security_group_ids" {
  description = "Security group IDs"
  type        = list(string)
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 1
}

variable "multi_az" {
  description = "Enable Multi-AZ"
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when destroying"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Generate random password
resource "random_password" "db_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()_+-=[]{}|;:,.<>?"
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.identifier_prefix}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, {
    Name = "${var.identifier_prefix}-subnet-group"
  })

  lifecycle {
    ignore_changes = [
      name,
    ]
  }
}

# RDS Instance - Simplified
resource "aws_db_instance" "main" {
  identifier = "${var.identifier_prefix}-db"

  # Engine
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  # Storage
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = true

  # Database
  db_name  = var.db_name
  username = var.username
  password = random_password.db_password.result

  # Network
  vpc_security_group_ids = var.vpc_security_group_ids
  db_subnet_group_name   = aws_db_subnet_group.main.name

  # Minimal backup - just 1 day retention
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # High Availability
  multi_az = var.multi_az

  # Performance
  performance_insights_enabled = false  # Disabled for cost savings
  monitoring_interval         = 0       # Disabled for simplicity

  # Deletion
  skip_final_snapshot = var.skip_final_snapshot
  deletion_protection = false

  tags = merge(var.tags, {
    Name = "${var.identifier_prefix}-db"
  })
}

# Outputs
output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "db_name" {
  value = aws_db_instance.main.db_name
}

output "db_username" {
  value     = aws_db_instance.main.username
  sensitive = true
}

output "db_password" {
  value     = random_password.db_password.result
  sensitive = true
}

output "db_port" {
  value = aws_db_instance.main.port
}