# Security Group Module

variable "name_prefix" {
  description = "Name prefix for security group"
  type        = string
}

variable "description" {
  description = "Security group description"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "ingress_rules" {
  description = "Ingress rules"
  type        = any
  default     = []
}

variable "egress_rules" {
  description = "Egress rules"
  type        = any
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Security Group
resource "aws_security_group" "main" {
  name_prefix = var.name_prefix
  description = var.description
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = var.name_prefix
  })
}

# Ingress Rules
resource "aws_security_group_rule" "ingress" {
  count = length(var.ingress_rules)

  type              = "ingress"
  from_port         = var.ingress_rules[count.index].from_port
  to_port           = var.ingress_rules[count.index].to_port
  protocol          = var.ingress_rules[count.index].protocol
  cidr_blocks       = try(var.ingress_rules[count.index].cidr_blocks, null)
  source_security_group_id = try(var.ingress_rules[count.index].source_security_group_id, null)
  description       = try(var.ingress_rules[count.index].description, "")
  security_group_id = aws_security_group.main.id
}

# Egress Rules
resource "aws_security_group_rule" "egress" {
  count = length(var.egress_rules)

  type              = "egress"
  from_port         = var.egress_rules[count.index].from_port
  to_port           = var.egress_rules[count.index].to_port
  protocol          = var.egress_rules[count.index].protocol
  cidr_blocks       = try(var.egress_rules[count.index].cidr_blocks, null)
  source_security_group_id = try(var.egress_rules[count.index].source_security_group_id, null)
  description       = try(var.egress_rules[count.index].description, "")
  security_group_id = aws_security_group.main.id
}