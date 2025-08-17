variable "eks_cluster" {
  description = "EKS cluster dependency"
  type        = any
}

variable "letsencrypt_email" {
  description = "Email for Let's Encrypt certificate registration"
  type        = string
  default     = "admin@sre-task.local"
}

variable "enable_tls" {
  description = "Enable TLS certificate generation"
  type        = bool
  default     = true
}

variable "use_letsencrypt" {
  description = "Use Let's Encrypt instead of self-signed certificates"
  type        = bool
  default     = false  # Default to self-signed for POC
}

variable "frontend_domain" {
  description = "Domain name for frontend service"
  type        = string
  default     = ""
}