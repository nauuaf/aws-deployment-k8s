# Outputs for IAM Roles Module

output "image_service_role_arn" {
  description = "ARN of the IAM role for image service"
  value       = aws_iam_role.image_service_role.arn
}

output "s3_access_policy_arn" {
  description = "ARN of the S3 access policy"
  value       = aws_iam_policy.s3_access_policy.arn
}