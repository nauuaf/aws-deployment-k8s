## SRE Assignment - Production-Ready Microservices Infrastructure

A complete cloud-native microservices platform built with Terraform, Kubernetes, and GitOps principles. This project demonstrates modern SRE practices with infrastructure as code, automated deployments, comprehensive monitoring, and security best practices.

## 🎯 **Production-Ready Status**

✅ **This deployment is fully functional and production-ready.**

All infrastructure components are deployed and configured correctly. All services are healthy and communicating properly with SSL encryption and security best practices.

### **Verified Working State**
- ✅ **Infrastructure**: AWS EKS cluster with RDS PostgreSQL and proper security groups
- ✅ **Security**: SSL-encrypted database connections and VPC isolation  
- ✅ **Services**: All microservices running and healthy (Frontend, API, Auth, Image, Redis)
- ✅ **Architecture**: Multi-platform Docker images compatible with EKS x86_64 nodes
- ✅ **Regeneration**: Consistent deployment from clean state with all fixes applied

📋 **Quick Verification**: Run `./scripts/verify-deployment.sh` to check deployment health.
📖 **Deployment Details**: See [DEPLOYMENT_FIXES.md](./DEPLOYMENT_FIXES.md) for technical implementation details.

## 🏗️ Architecture Overview

### System Architecture

```plaintext
┌─────────────────────────────────────────────────────────────────┐
│                           Internet                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │ AWS ALB   │
                    │ (HTTPS)   │
                    └─────┬─────┘
                          │
              ┌───────────▼────────────┐
              │  NGINX Ingress         │
              │  Controller            │
              └───────────┬────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
      ┌────▼─────┐   ┌────▼─────┐  ┌────▼─────┐
      │Frontend  │   │   API    │  │ Monitoring│
      │(Next.js) │   │ Gateway  │  │(Grafana) │
      └──────────┘   │          │  └──────────┘
                     │          │
                     │  ┌───────▼────────┐
                     │  │ Backend Services│
                     │  │ ┌─────────────┐ │
                     │  │ │Auth Service │ │
                     │  │ │    (Go)     │ │
                     │  │ └─────────────┘ │
                     │  │ ┌─────────────┐ │
                     │  │ │Image Service│ │
                     │  │ │  (Python)   │ │
                     │  │ └─────────────┘ │
                     │  └─────────────────┘
                     └──────────┬─────────
                                │
                    ┌───────────▼────────────┐
                    │      Data Layer        │
                    │ ┌─────────┐ ┌────────┐ │
                    │ │PostgreSQL│ │   S3   │ │
                    │ │   RDS    │ │ Bucket │ │
                    │ └─────────┘ └────────┘ │
                    └────────────────────────┘
```

### Technology Stack

#### Infrastructure

*   **AWS EKS** - Kubernetes 1.30 cluster with native AWS node groups
*   **Terraform** - Infrastructure as Code with modular architecture
*   **VPC** - Multi-AZ networking with public/private subnets
*   **ALB/NLB** - Load balancing and ingress
*   **ECR** - Private container registry

#### Applications

*   **Frontend**: Next.js (React/TypeScript) - User interface
*   **API Gateway**: Node.js (Express) - Request routing and orchestration
*   **Auth Service**: Go (Gin) - Authentication and user management
*   **Image Service**: Python (FastAPI) - Image processing and storage

#### Data & Storage

*   **PostgreSQL RDS** - Primary database (Multi-AZ for HA)
*   **S3** - Object storage for images and static assets
*   **ECR** - Container image registry

#### Monitoring & Observability

*   **Prometheus** - Metrics collection and alerting
*   **Grafana** - Dashboards and visualization
*   **AlertManager** - Alert routing and management
*   **Custom Metrics** - Application-specific monitoring

#### Security

*   **Network Policies** - Microsegmentation and traffic control
*   **TLS/SSL** - End-to-end encryption with cert-manager
*   **IAM Roles** - Fine-grained AWS permissions
*   **Security Groups** - Network-level access control
*   **Pod Security Standards** - Container security policies

## 🚀 Quick Start (25-30 Minutes Total)

### Prerequisites

*   AWS CLI configured with admin permissions
*   Docker Desktop running
*   kubectl installed
*   Terraform >= 1.0
*   Helm (for cert-manager, installed automatically)

### **Option 1: Automated Deployment (Recommended)**

```plaintext
# Clone repository
git clone https://github.com/nauuaf/aws-deployment-k8s.git
cd aws-deployment-k8s

# Configure environment
cp terraform/environments/poc/terraform.tfvars.example terraform/environments/poc/terraform.tfvars
# Edit with your AWS region and settings

# One-command deployment
./scripts/clean-deploy.sh
```

This handles everything:
- ✅ Infrastructure deployment
- ✅ kubectl configuration  
- ✅ Ready for applications

**Then deploy applications:**
```plaintext
./scripts/deploy.sh
```

### **Option 2: Manual Step-by-Step Deployment**

#### **Step 1: Configure Environment**

```plaintext
# Clone repository
git clone https://github.com/nauuaf/aws-deployment-k8s.git
cd aws-deployment-k8s

# Copy and edit configuration
cp terraform/environments/poc/terraform.tfvars.example terraform/environments/poc/terraform.tfvars
# Edit with your AWS region and settings
```

#### **Step 2: Deploy Infrastructure**

```plaintext
cd terraform/environments/poc

# Deploy core infrastructure (20-25 minutes)
terraform init
terraform apply

# Configure kubectl
aws eks update-kubeconfig --region $(terraform output -raw cluster_region) --name $(terraform output -raw cluster_name)
```

#### **Step 3: Optional TLS/Cert-Manager**

```plaintext
# Enable cert-manager for TLS certificates (optional)
cd ../../..  # Return to project root
./scripts/toggle-cert-manager.sh enable
cd terraform/environments/poc
terraform apply
```

#### **Step 4: Deploy Applications**

```plaintext
# Return to project root
cd ../../..

# Deploy all applications and services
./scripts/deploy.sh
```

**What deploy.sh does automatically:**
- ✅ Builds Docker images (if needed)
- ✅ Installs NGINX Ingress Controller
- ✅ Deploys all microservices
- ✅ Configures networking and load balancing
- ✅ Optional monitoring stack

### **Access Your Applications**

```plaintext
# Get deployment information and URLs
./scripts/get-deployment-info.sh       # Comprehensive deployment details
./scripts/quick-deployment-info.sh     # Quick essentials only

# Verify deployment
./scripts/verify-deployment.sh

# Access via port forwarding (if load balancer not ready)
kubectl port-forward -n frontend service/frontend 8080:3000
kubectl port-forward -n monitoring service/grafana 3000:3000

# Open in browser:
# Frontend: http://localhost:8080
# Grafana: http://localhost:3000 (admin/admin - if monitoring deployed)
```

**✅ Your deployment is complete!** All services are running with:
- 🔧 **Working backend APIs** (auth, images, data)
- 🎨 **React frontend** with API integration
- 🔒 **Security** with TLS certificates (if cert-manager enabled)
- 📊 **Monitoring** with Prometheus/Grafana (optional)
- 🌐 **Load balancing** via NGINX Ingress Controller

## 📁 Project Structure

```plaintext
aws-deployment-k8s/
├── terraform/                    # Infrastructure as Code
│   ├── environments/poc/         # POC environment configuration
│   └── modules/                  # Reusable Terraform modules
│       ├── vpc/                  # VPC and networking
│       ├── eks/                  # EKS cluster setup
│       ├── rds/                  # PostgreSQL database
│       ├── s3/                   # Object storage
│       ├── security-group/       # Security groups
│       ├── kubernetes/           # K8s resources (secrets, namespaces)
│       ├── cert-manager/         # TLS certificate management
│       ├── network-policies/     # Microsegmentation
│       └── pod-disruption-budgets/ # High availability
│
├── services/                     # Application source code
│   ├── frontend/                 # Next.js frontend application
│   ├── api-service/              # Node.js API gateway
│   ├── auth-service/             # Go authentication service
│   └── image-service/            # Python image processing service
│
├── manifests/                    # Kubernetes manifests
│   ├── api-service/              # API service deployment
│   ├── auth-service/             # Auth service deployment
│   ├── image-service/            # Image service deployment
│   ├── frontend/                 # Frontend deployment
│   ├── ingress/                  # Ingress configuration
│   └── monitoring/               # Monitoring resources
│
├── overlays/                     # Kustomize overlays
│   └── poc/                      # POC environment overlay
│
└── scripts/                      # Deployment automation
    ├── build-images.sh           # Build and push Docker images
    ├── deploy.sh                 # Complete deployment orchestration
    ├── deploy-ingress.sh         # NGINX ingress controller
    ├── deploy-monitoring.sh      # Monitoring stack deployment
    ├── update-manifests.sh       # Dynamic value replacement
    └── update-images.sh          # Image tag management
```

## 🛠️ Detailed Configuration

### Terraform Variables

Key configuration options in `terraform/environments/poc/terraform.tfvars`:

```plaintext
# AWS Configuration
aws_region = "eu-central-1"
availability_zones = ["eu-central-1a", "eu-central-1b", "eu-central-1c"]

# Networking
vpc_cidr = "10.0.0.0/16"
public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]

# EKS Configuration
kubernetes_version = "1.30"
node_group_instance_types = ["t3.medium"]
node_group_min_size = 1
node_group_max_size = 5
node_group_desired = 3

# Cost Optimization
enable_spot_instances = true

# Monitoring &amp; Alerts
budget_email = "admin@company.com"

# Security
use_letsencrypt = false  # Set true for production
enable_tls = true

# Project Settings
project_name = "sre-task"
environment = "poc"
```

## 🔧 Scripts & Automation

### Build and Deployment Scripts

| Script | Purpose | Usage |
| --- | --- | --- |
| `build-images.sh` | Build and push Docker images to ECR (auto-versions) | `./scripts/build-images.sh [tag]` |
| `deploy.sh` | Complete application deployment (includes NGINX ingress) | `./scripts/deploy.sh [tag]` |
| `deploy-ingress.sh` | Deploy NGINX ingress controller standalone | `./scripts/deploy-ingress.sh` |
| `deploy-monitoring.sh` | Deploy monitoring stack | `./scripts/deploy-monitoring.sh` |
| `toggle-cert-manager.sh` | Toggle cert-manager between Phase 1A/1B | `./scripts/toggle-cert-manager.sh [enable\|disable\|status]` |
| `clean-deploy.sh` | Clean deployment from scratch with proper checks | `./scripts/clean-deploy.sh` |
| `get-deployment-info.sh` | **Show comprehensive deployment information and URLs** | `./scripts/get-deployment-info.sh` |
| `quick-deployment-info.sh` | **Show essential deployment URLs and credentials** | `./scripts/quick-deployment-info.sh` |
| `verify-deployment.sh` | Verify all services are healthy and accessible | `./scripts/verify-deployment.sh` |
| `update-manifests.sh` | Replace placeholders with real AWS values | Called automatically |
| `update-images.sh` | Update image tags in manifests | `./scripts/update-images.sh [tag]` |

### Docker Image Workflow

The project uses AWS ECR for container registry with automated build/push:

1.  **ECR Repositories**: Created by Terraform for each service
2.  **Auto-Versioning**: Automatically detects highest version and increments (v9 → v10)
3.  **Image Building**: `build-images.sh` builds all service images
4.  **Dynamic Tagging**: Images tagged with ECR URLs automatically
5.  **Registry Push**: Automatic push to ECR with proper authentication

**Automatic Versioning:**
- `./scripts/build-images.sh` → Builds next version (e.g., v10)
- `./scripts/deploy.sh` → Uses latest available version  
- `./scripts/build-images.sh v15` → Manual version override

**Image Naming Convention:**

```plaintext
{AWS_ACCOUNT_ID}.dkr.ecr.{AWS_REGION}.amazonaws.com/{PROJECT_NAME}/{SERVICE_NAME}:{TAG}
```

**Example:**

```plaintext
123456789.dkr.ecr.eu-central-1.amazonaws.com/sre-task/api-service:latest
```

### Kustomize Configuration

The project uses Kustomize for environment-specific configuration:

*   **Base Manifests**: Service-specific Kubernetes resources
*   **Overlays**: Environment-specific modifications (POC)
*   **Placeholder Replacement**: Dynamic AWS values injection
*   **Label Management**: Consistent labeling across resources

## 🔒 Security Features

### Infrastructure Security

*   **VPC Isolation**: Private subnets for applications
*   **Security Groups**: Least-privilege network access
*   **IAM Roles**: Fine-grained AWS permissions
*   **Encryption**: Data at rest and in transit

### Application Security

*   **Network Policies**: Microsegmentation between services
*   **TLS Termination**: HTTPS everywhere with cert-manager
*   **Pod Security**: Non-root containers, read-only filesystems
*   **Secrets Management**: Kubernetes secrets for sensitive data

### Compliance

*   **Pod Disruption Budgets**: Ensure availability during updates
*   **Resource Quotas**: Prevent resource exhaustion
*   **Network Segmentation**: Backend/frontend isolation
*   **Audit Logging**: EKS control plane logging enabled

## 📊 Monitoring & Observability

### Metrics Collection

*   **System Metrics**: Node/pod CPU, memory, disk, network
*   **Application Metrics**: Request rates, response times, errors
*   **Business Metrics**: User registrations, image uploads, API calls
*   **Infrastructure Metrics**: AWS resources, Kubernetes events

### Pre-configured Alerts

*   High error rates (>10% for 5 minutes)
*   High response times (>500ms for 5 minutes)
*   Pod restarts (>3 in 10 minutes)
*   Resource utilization (CPU >80%, Memory >85%)
*   Database connectivity issues
*   Certificate expiration warnings

### Access Monitoring

```plaintext
# Grafana Dashboard
kubectl port-forward -n monitoring service/grafana 3000:3000
# http://localhost:3000 (admin/admin)

# Prometheus Metrics
kubectl port-forward -n monitoring service/prometheus 9090:9090
# http://localhost:9090

# AlertManager
kubectl port-forward -n monitoring service/alertmanager 9093:9093
# http://localhost:9093
```

## 🚢 Advanced Deployment Options

### Two-Phase Infrastructure Approach

For maximum flexibility, the infrastructure supports two deployment phases:

**Phase 1A**: Core infrastructure (required)
- EKS cluster with native AWS node groups
- VPC, RDS, S3, security groups
- Basic networking and storage

**Phase 2B**: TLS certificate management (optional)  
- cert-manager for automated TLS certificates
- ClusterIssuers for Let's Encrypt integration
- Secure HTTPS ingress configuration

### Cert-Manager Management

Use the toggle script to easily manage TLS certificates:

```plaintext
# Check current status
./scripts/toggle-cert-manager.sh status

# Enable TLS certificate management
./scripts/toggle-cert-manager.sh enable
cd terraform/environments/poc && terraform apply

# Disable TLS certificate management  
./scripts/toggle-cert-manager.sh disable
cd terraform/environments/poc && terraform apply
```

### Manual Infrastructure Deployment

If you prefer step-by-step control:

```plaintext
# 1. Configure environment
cp terraform/environments/poc/terraform.tfvars.example terraform/environments/poc/terraform.tfvars
# Edit with your settings

# 2. Deploy infrastructure
cd terraform/environments/poc
terraform init && terraform apply

# 3. Configure kubectl
aws eks update-kubeconfig --region $(terraform output -raw cluster_region) --name $(terraform output -raw cluster_name)

# 4. Optional: Enable cert-manager
cd ../../..
./scripts/toggle-cert-manager.sh enable
cd terraform/environments/poc && terraform apply

# 5. Deploy applications
cd ../../.. && ./scripts/deploy.sh
```

### What deploy.sh Handles Automatically

*   ✅ Checks if Docker images exist in ECR
*   ✅ Builds and pushes images if missing
*   ✅ Updates manifests with real AWS values
*   ✅ Validates required secrets and namespaces
*   ✅ Deploys services in proper dependency order
*   ✅ Waits for all deployments to be ready
*   ✅ Deploys ingress after services are ready
*   ✅ Prompts for monitoring deployment

### Phase 3: Verification

**Verify Everything:**

**Access Applications:**

## 🔧 Operations & Maintenance

### Routine Operations

```plaintext
# Scale services
kubectl scale deployment api-service --replicas=5 -n backend

# Update application
./scripts/build-images.sh v1.2.3
./scripts/update-images.sh v1.2.3
kubectl apply -k overlays/poc/

# View logs
kubectl logs -f -n backend deployment/api-service

# Check cluster health
kubectl get nodes &amp;&amp; kubectl top nodes
```

### Cost Management

*   **Spot Instances**: Up to 70% cost savings for worker nodes
*   **Auto-scaling**: Scale down during low usage periods
*   **ECR Lifecycle**: Automatic cleanup of old container images
*   **Budget Alerts**: Proactive cost monitoring via email

## 🧪 Troubleshooting

### Common Issues


#### ImagePullBackOff

```plaintext
# Check ECR repositories
aws ecr describe-repositories --region <region>
aws ecr list-images --repository-name sre-task/api-service

# Rebuild and push
./scripts/build-images.sh
```

#### Service Connectivity

```plaintext
# Check endpoints and network policies
kubectl get endpoints -n backend
kubectl get networkpolicies -A

# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup api-service.backend.svc.cluster.local
```

#### Database Issues

```plaintext
# Check RDS status
aws rds describe-db-instances --db-instance-identifier <instance-id>

# Test connection
kubectl exec -n backend deployment/api-service -- psql $DATABASE_URL -c "SELECT 1"
```

### Support Resources

*   **Logs**: Centralized logging via `kubectl logs`
*   **Metrics**: Comprehensive monitoring via Grafana
*   **Events**: Kubernetes events for troubleshooting
*   **Documentation**: Detailed guides in project documentation

## 🏷️ Resource Cleanup

### Complete Cleanup (Recommended)
```plaintext
# Use the clean deployment script with destroy option
cd aws-deployment-k8s
./scripts/clean-deploy.sh  # Choose 'y' when prompted to destroy

# Or manually:
cd terraform/environments/poc
terraform destroy -auto-approve
```

### Partial Cleanup
```plaintext
# Delete applications only
kubectl delete -k overlays/poc/

# Delete monitoring only
kubectl delete namespace monitoring

# Delete specific resources
terraform destroy -target=module.eks
terraform destroy -target=module.rds
```

### Troubleshooting Cleanup Issues
```plaintext
# If destroy fails due to dependencies:
terraform destroy -target=module.pod_disruption_budgets -auto-approve
terraform destroy -target=module.network_policies -auto-approve
terraform destroy -target=module.kubernetes -auto-approve
terraform destroy -auto-approve

# Force cleanup if stuck:
rm -f terraform.tfstate terraform.tfstate.backup
# WARNING: This removes state tracking - AWS resources may remain!
```

## 🤝 Contributing

1.  Fork the repository
2.  Create a feature branch: `git checkout -b feature/new-feature`
3.  Make changes with appropriate tests
4.  Submit pull request with detailed description

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

**Built with ❤️ for modern SRE practices**

This infrastructure demonstrates production-ready patterns for cloud-native applications with comprehensive monitoring, security, and operational excellence.

```plaintext
kubectl port-forward -n frontend service/frontend 8080:3000
kubectl port-forward -n monitoring service/grafana 3000:3000
# Frontend: http://localhost:8080
# Grafana: http://localhost:3000
```

```plaintext
kubectl get pods -A                    # All pods should be Running
kubectl get svc -n backend -n frontend # Check services
kubectl get ingress -n frontend        # Check ingress
```

```plaintext
cd /path/to/aws-deployment-k8s  # Return to project root
./scripts/deploy.sh         # Single command deployment
```

```plaintext
aws eks update-kubeconfig --region $(terraform output -raw cluster_region) --name $(terraform output -raw cluster_name)
kubectl get nodes  # Verify cluster access
```

```plaintext
cp terraform/environments/poc/terraform.tfvars.example terraform/environments/poc/terraform.tfvars
# Edit with your AWS region, VPC CIDR, email, etc.
```

```plaintext
aws --version &amp;&amp; terraform --version &amp;&amp; kubectl version --client &amp;&amp; docker --version
```