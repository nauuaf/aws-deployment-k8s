# Additional EKS Addons deployed after node group is ready

# CoreDNS addon - deployed after nodes are ready
resource "aws_eks_addon" "coredns" {
  cluster_name             = module.eks.cluster_name
  addon_name               = "coredns"
  addon_version            = "v1.11.4-eksbuild.20"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  
  # Wait for node group to be ready
  depends_on = [
    aws_eks_node_group.main,
    module.eks
  ]
  
  tags = var.tags
}

# EBS CSI Driver addon - deployed after nodes are ready
resource "aws_eks_addon" "ebs_csi_driver" {
  cluster_name             = module.eks.cluster_name
  addon_name               = "aws-ebs-csi-driver"
  addon_version            = "v1.47.0-eksbuild.1"
  service_account_role_arn = aws_iam_role.ebs_csi_driver.arn
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  
  # Wait for node group to be ready
  depends_on = [
    aws_eks_node_group.main,
    module.eks
  ]
  
  tags = var.tags
}