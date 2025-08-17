'use client';

import {
  Layers,
  Server,
  Database,
  Cloud,
  Shield,
  BarChart3,
  Globe,
  Users,
  Camera,
  Terminal,
  GitBranch,
  Lock,
  Zap,
  ExternalLink,
  Container,
  Network,
  Settings,
  HardDrive,
  AlertTriangle,
  Box,
  Cpu,
  Monitor
} from 'lucide-react';

export default function ArchitecturePage() {
  const architectureComponents = [
    {
      category: 'الواجهة الأمامية',
      icon: Globe,
      color: 'bg-blue-100 text-blue-600',
      components: [
        { name: 'Next.js Frontend', description: 'واجهة المستخدم التفاعلية', port: 'Internal: 3000' },
        { name: 'React Components', description: 'مكونات قابلة لإعادة الاستخدام', port: '-' },
        { name: 'Tailwind CSS', description: 'تصميم متجاوب', port: '-' },
      ]
    },
    {
      category: 'الخدمات الخلفية',
      icon: Server,
      color: 'bg-green-100 text-green-600',
      components: [
        { name: 'API Service', description: 'واجهة برمجية رئيسية', port: 'Internal: 3000' },
        { name: 'Auth Service', description: 'خدمة المصادقة والتخويل', port: 'Internal: 8080' },
        { name: 'Image Service', description: 'معالجة ورفع الصور', port: 'Internal: 5000' },
      ]
    },
    {
      category: 'قواعد البيانات',
      icon: Database,
      color: 'bg-purple-100 text-purple-600',
      components: [
        { name: 'PostgreSQL', description: 'قاعدة البيانات الرئيسية', port: 'Internal: 5432' },
        { name: 'Redis', description: 'ذاكرة التخزين المؤقت', port: 'Internal: 6379' },
        { name: 'S3 Bucket', description: 'تخزين الملفات', port: 'HTTPS/443' },
      ]
    },
    {
      category: 'البنية التحتية',
      icon: Cloud,
      color: 'bg-orange-100 text-orange-600',
      components: [
        { name: 'AWS EKS', description: 'إدارة Kubernetes', port: 'HTTPS/443' },
        { name: 'VPC', description: 'شبكة خاصة افتراضية', port: '-' },
        { name: 'ECR', description: 'مستودع صور Docker', port: 'HTTPS/443' },
      ]
    },
    {
      category: 'المراقبة',
      icon: BarChart3,
      color: 'bg-yellow-100 text-yellow-600',
      components: [
        { name: 'Prometheus', description: 'جمع المقاييس', port: 'Internal: 9090' },
        { name: 'Grafana', description: 'لوحات المراقبة', port: 'Internal: 3000' },
        { name: 'AlertManager', description: 'إدارة التنبيهات', port: 'Internal: 9093' },
      ]
    },
    {
      category: 'الأمان',
      icon: Shield,
      color: 'bg-red-100 text-red-600',
      components: [
        { name: 'RBAC', description: 'التحكم في الوصول', port: '-' },
        { name: 'Security Groups', description: 'جدران الحماية', port: '-' },
        { name: 'SSL/TLS', description: 'تشفير الاتصالات', port: 'HTTPS/443' },
      ]
    },
  ];

  const dataFlow = [
    { step: 1, from: 'المستخدم', to: 'AWS ALB', description: 'طلبات HTTPS' },
    { step: 2, from: 'AWS ALB', to: 'NGINX Ingress', description: 'توجيه الطلبات' },
    { step: 3, from: 'NGINX Ingress', to: 'Frontend/API', description: 'توزيع الحمولة' },
    { step: 4, from: 'API Service', to: 'Auth Service', description: 'التحقق من الهوية' },
    { step: 5, from: 'API Service', to: 'Image Service', description: 'معالجة الصور' },
    { step: 6, from: 'Services', to: 'PostgreSQL', description: 'استعلامات البيانات' },
    { step: 7, from: 'Services', to: 'Redis', description: 'ذاكرة التخزين المؤقت' },
  ];

  const deploymentStrategy = [
    {
      phase: 'المرحلة 1',
      title: 'البنية التحتية',
      description: 'إنشاء AWS EKS، VPC، RDS',
      icon: Cloud,
      items: ['EKS Cluster', 'VPC وSubnets', 'RDS PostgreSQL', 'Security Groups', 'IAM Roles']
    },
    {
      phase: 'المرحلة 2',
      title: 'الخدمات الأساسية',
      description: 'نشر الخدمات المصغرة',
      icon: Server,
      items: ['Auth Service', 'API Service', 'Image Service', 'Redis Cache', 'Frontend']
    },
    {
      phase: 'المرحلة 3',
      title: 'المراقبة والأمان',
      description: 'تفعيل المراقبة والحماية',
      icon: Shield,
      items: ['Prometheus', 'Grafana', 'NGINX Ingress', 'SSL Certificates', 'RBAC']
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-saudi-green to-green-700 text-white p-3 rounded-xl">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">البنية المعمارية</h1>
              <p className="text-gray-600">تصميم شامل لمنصة هندسة الموثوقية السحابية</p>
            </div>
          </div>
        </div>

        {/* Infrastructure Diagram */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">مخطط البنية التحتية التفصيلي</h2>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-8 overflow-x-auto">
            
            {/* Title */}
            <div className="text-center mb-8">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Frontend Infrastructure - AWS EKS Deployment</h3>
              <p className="text-gray-600">البنية التحتية للواجهة الأمامية على منصة AWS</p>
            </div>

            {/* Users */}
            <div className="flex justify-center mb-8">
              <div className="bg-white rounded-xl border-2 border-gray-300 px-6 py-4 shadow-lg">
                <div className="flex flex-col items-center">
                  <Users className="h-8 w-8 text-gray-600 mb-2" />
                  <span className="font-semibold text-gray-800">المستخدمون</span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center mb-6">
              <div className="w-1 h-8 bg-gray-400"></div>
            </div>

            {/* AWS Region Container */}
            <div className="border border-dashed border-blue-500 rounded-2xl p-6 bg-blue-50/50">
              <div className="flex items-center gap-2 mb-6">
                <Cloud className="h-6 w-6 text-blue-600" />
                <span className="font-bold text-blue-800 text-lg">AWS Region (eu-central-1)</span>
              </div>

              {/* VPC Container */}
              <div className="border border-purple-400 rounded-xl p-6 bg-purple-50/50">
                <div className="flex items-center gap-2 mb-6">
                  <Network className="h-6 w-6 text-purple-600" />
                  <span className="font-bold text-purple-800">Amazon VPC (sre-task-vpc)</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Public Subnet */}
                  <div className="border border-green-400 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800">Public Subnet</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="bg-blue-600 text-white rounded-lg p-3 text-center">
                        <BarChart3 className="h-6 w-6 mx-auto mb-1" />
                        <div className="font-semibold text-sm">AWS ALB</div>
                        <div className="text-xs opacity-90">Load Balancer</div>
                      </div>
                      
                      <div className="bg-gray-600 text-white rounded-lg p-3 text-center">
                        <Network className="h-6 w-6 mx-auto mb-1" />
                        <div className="font-semibold text-sm">NAT Gateway</div>
                      </div>
                    </div>
                  </div>

                  {/* Private Subnet - EKS */}
                  <div className="lg:col-span-2 border border-green-400 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center gap-2 mb-4">
                      <Lock className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800">Private Subnet</span>
                    </div>
                    
                    {/* EKS Cluster */}
                    <div className="border border-orange-400 rounded-lg p-4 bg-orange-50">
                      <div className="flex items-center gap-2 mb-4">
                        <Container className="h-5 w-5 text-orange-600" />
                        <span className="font-semibold text-orange-800">EKS Cluster (sre-task-poc)</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* Frontend Namespace */}
                        <div className="border border-red-300 border-dashed rounded-lg p-3 bg-red-50">
                          <div className="flex items-center gap-2 mb-3">
                            <Box className="h-4 w-4 text-red-600" />
                            <span className="font-semibold text-red-800 text-sm">frontend namespace</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="bg-purple-600 text-white rounded p-2 text-center text-xs">
                              <Terminal className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">NGINX Ingress</div>
                            </div>
                            
                            <div className="bg-saudi-green text-white rounded p-2 text-center text-xs">
                              <Globe className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">Frontend Service</div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-1">
                              <div className="bg-saudi-green text-white rounded p-2 text-center text-xs">
                                <Box className="h-3 w-3 mx-auto mb-1" />
                                <div className="font-semibold">Pod 1</div>
                                <div className="text-xs opacity-90">Next.js</div>
                              </div>
                              <div className="bg-saudi-green text-white rounded p-2 text-center text-xs">
                                <Box className="h-3 w-3 mx-auto mb-1" />
                                <div className="font-semibold">Pod 2</div>
                                <div className="text-xs opacity-90">Next.js</div>
                              </div>
                            </div>
                            
                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <BarChart3 className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">HPA</div>
                            </div>

                            <div className="grid grid-cols-2 gap-1">
                              <div className="bg-gray-500 text-white rounded p-2 text-center text-xs">
                                <Settings className="h-3 w-3 mx-auto mb-1" />
                                <div className="font-semibold">ConfigMap</div>
                              </div>
                              <div className="bg-gray-700 text-white rounded p-2 text-center text-xs">
                                <Lock className="h-3 w-3 mx-auto mb-1" />
                                <div className="font-semibold">Secrets</div>
                              </div>
                            </div>

                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <HardDrive className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">PV (Logs)</div>
                            </div>
                          </div>
                        </div>

                        {/* Backend Namespace */}
                        <div className="border border-red-300 border-dashed rounded-lg p-3 bg-red-50">
                          <div className="flex items-center gap-2 mb-3">
                            <Box className="h-4 w-4 text-red-600" />
                            <span className="font-semibold text-red-800 text-sm">backend namespace</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <Server className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">API Gateway</div>
                            </div>
                            
                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <Shield className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">Auth Service</div>
                            </div>
                            
                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <Camera className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">Image Service</div>
                            </div>
                          </div>
                        </div>

                        {/* Monitoring Namespace */}
                        <div className="border border-red-300 border-dashed rounded-lg p-3 bg-red-50">
                          <div className="flex items-center gap-2 mb-3">
                            <Box className="h-4 w-4 text-red-600" />
                            <span className="font-semibold text-red-800 text-sm">monitoring namespace</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <BarChart3 className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">Prometheus</div>
                            </div>
                            
                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <Monitor className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">Grafana</div>
                            </div>
                            
                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <AlertTriangle className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">AlertManager</div>
                            </div>

                            <div className="bg-gray-600 text-white rounded p-2 text-center text-xs">
                              <Settings className="h-4 w-4 mx-auto mb-1" />
                              <div className="font-semibold">Service Monitor</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AWS Managed Services */}
                <div className="mt-6 border border-green-400 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center gap-2 mb-4">
                    <Cloud className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800">AWS Managed Services</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="bg-gray-600 text-white rounded-lg p-3 text-center">
                      <Container className="h-5 w-5 mx-auto mb-1" />
                      <div className="font-semibold text-xs">Amazon ECR</div>
                      <div className="text-xs opacity-90">Container Registry</div>
                    </div>
                    
                    <div className="bg-gray-600 text-white rounded-lg p-3 text-center">
                      <Database className="h-5 w-5 mx-auto mb-1" />
                      <div className="font-semibold text-xs">Amazon RDS</div>
                      <div className="text-xs opacity-90">PostgreSQL</div>
                    </div>
                    
                    <div className="bg-gray-600 text-white rounded-lg p-3 text-center">
                      <HardDrive className="h-5 w-5 mx-auto mb-1" />
                      <div className="font-semibold text-xs">Amazon S3</div>
                      <div className="text-xs opacity-90">Image Storage</div>
                    </div>
                    
                    <div className="bg-gray-600 text-white rounded-lg p-3 text-center">
                      <Monitor className="h-5 w-5 mx-auto mb-1" />
                      <div className="font-semibold text-xs">CloudWatch</div>
                      <div className="text-xs opacity-90">Logs & Metrics</div>
                    </div>
                    
                    <div className="bg-gray-600 text-white rounded-lg p-3 text-center">
                      <Shield className="h-5 w-5 mx-auto mb-1" />
                      <div className="font-semibold text-xs">AWS IAM</div>
                      <div className="text-xs opacity-90">RBAC</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Traffic Flow */}
            <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                مسار تدفق البيانات
              </h4>
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="bg-gray-100 text-gray-900 px-3 py-1 rounded-full">👥 Users</span>
                <span className="text-gray-600">→</span>
                <span className="bg-blue-100 text-blue-900 px-3 py-1 rounded-full">⚖️ AWS ALB</span>
                <span className="text-gray-600">→</span>
                <span className="bg-purple-100 text-purple-900 px-3 py-1 rounded-full">🚪 NGINX Ingress</span>
                <span className="text-gray-600">→</span>
                <span className="bg-green-100 text-green-900 px-3 py-1 rounded-full">🌐 Frontend Service</span>
                <span className="text-gray-600">→</span>
                <span className="bg-saudi-green/20 text-green-900 px-3 py-1 rounded-full">📦 Frontend Pods</span>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-bold text-gray-800 mb-3">المفاتيح</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-saudi-green rounded"></div>
                  <span className="text-gray-800">Frontend Services</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded"></div>
                  <span className="text-gray-800">Load Balancer</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-600 rounded"></div>
                  <span className="text-gray-800">Ingress Controller</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-600 rounded"></div>
                  <span className="text-gray-800">Supporting Services</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Components Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">مكونات النظام</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {architectureComponents.map((category, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${category.color}`}>
                    <category.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{category.category}</h3>
                </div>
                <div className="space-y-3">
                  {category.components.map((component, idx) => (
                    <div key={idx} className="border-r-2 border-gray-200 pr-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-800">{component.name}</p>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {component.port}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{component.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>


        {/* Deployment Strategy */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">استراتيجية النشر</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {deploymentStrategy.map((phase, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-gradient-to-br from-saudi-green to-green-700 text-white p-2 rounded-lg">
                    <phase.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">{phase.phase}</div>
                    <h3 className="font-semibold text-gray-900">{phase.title}</h3>
                  </div>
                </div>
                <p className="text-gray-600 mb-4">{phase.description}</p>
                <ul className="space-y-2">
                  {phase.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-saudi-green rounded-full"></div>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Specifications */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">المواصفات التقنية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">البنية التحتية</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• AWS EKS (Kubernetes 1.30)</li>
                <li>• Multi-AZ Deployment</li>
                <li>• Auto Scaling Groups</li>
                <li>• Managed Node Groups</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">قواعد البيانات</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• RDS PostgreSQL 15</li>
                <li>• Redis 7.0</li>
                <li>• Multi-AZ RDS</li>
                <li>• Automated Backups</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">الأمان</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• RBAC (Role-Based Access)</li>
                <li>• Security Groups</li>
                <li>• SSL/TLS Encryption</li>
                <li>• Private Subnets</li>
              </ul>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">المراقبة</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Prometheus Metrics</li>
                <li>• Grafana Dashboards</li>
                <li>• AlertManager</li>
                <li>• CloudWatch Integration</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Additional Resources */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">مراجع إضافية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">التوثيق التقني</h4>
              <ul className="space-y-1">
                <li>
                  <a href="/docs/getting-started" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                    دليل البدء السريع
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a href="/api/playground" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                    ساحة اختبار API
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800 mb-2">أدوات المراقبة</h4>
              <ul className="space-y-1">
                <li>
                  <a href="/monitoring" className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                    لوحة المراقبة
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <span className="text-blue-600">Grafana Dashboard (Port-forward required)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}