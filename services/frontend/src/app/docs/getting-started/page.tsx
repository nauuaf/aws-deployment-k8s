'use client';

import Link from 'next/link';
import {
  CheckCircle,
  Terminal,
  Cloud,
  Settings,
  ExternalLink,
  Book,
  Zap,
  Server,
  Copy,
  ArrowRight,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useState } from 'react';

export default function GettingStartedPage() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (text: string, commandName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(commandName);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const prerequisites = [
    {
      title: 'AWS CLI',
      description: 'مكون وجاهز للاستخدام',
      command: 'aws --version',
      icon: Cloud,
    },
    {
      title: 'Docker',
      description: 'قيد التشغيل على النظام',
      command: 'docker --version',
      icon: Server,
    },
    {
      title: 'kubectl',
      description: 'للتفاعل مع Kubernetes',
      command: 'kubectl version --client',
      icon: Settings,
    },
    {
      title: 'Terraform',
      description: 'لإدارة البنية التحتية',
      command: 'terraform --version',
      icon: Terminal,
    },
  ];

  const quickStartSteps = [
    {
      step: 1,
      title: 'استنساخ المستودع',
      command: 'git clone https://github.com/nauuaf/aws-deployment-k8s.git\ncd aws-deployment-k8s',
      description: 'احصل على الكود المصدري للمشروع',
    },
    {
      step: 2,
      title: 'تكوين AWS',
      command: 'aws configure\n# أدخل access key وsecret key',
      description: 'تكوين بيانات الاعتماد لخدمات AWS',
    },
    {
      step: 3,
      title: 'إنشاء البنية التحتية',
      command: './scripts/clean-deploy.sh',
      description: 'النشر الكامل للبنية التحتية والخدمات (نهج موصى به)',
    },
    {
      step: 4,
      title: 'نشر التطبيقات (اختياري)',
      command: './scripts/deploy.sh',
      description: 'إذا كنت تريد نشر التطبيقات فقط بدون البنية التحتية',
    },
    {
      step: 5,
      title: 'التحقق من النشر',
      command: './scripts/verify-deployment.sh',
      description: 'التأكد من عمل جميع الخدمات',
    },
    {
      step: 6,
      title: 'الحصول على معلومات النشر',
      command: './scripts/get-deployment-info.sh',
      description: 'عرض جميع روابط التطبيق وبيانات الوصول والمراقبة',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-gradient-to-br from-saudi-green to-green-700 text-white p-3 rounded-xl">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">دليل البدء السريع والنشر</h1>
              <p className="text-gray-600">دليل شامل لتشغيل ونشر منصة هندسة الموثوقية على AWS</p>
            </div>
          </div>
        </div>

        {/* Quick Overview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">نظرة عامة</h2>
          <p className="text-blue-700 mb-4">
            هذا الدليل سيساعدك على تشغيل منصة هندسة الموثوقية السحابية في بيئة AWS باستخدام:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="bg-blue-100 p-2 rounded-lg mb-2 inline-block">
                <Cloud className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-blue-800">AWS EKS</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 p-2 rounded-lg mb-2 inline-block">
                <Server className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-blue-800">Kubernetes</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 p-2 rounded-lg mb-2 inline-block">
                <Terminal className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-blue-800">Terraform</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 p-2 rounded-lg mb-2 inline-block">
                <Settings className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-blue-800">Docker</p>
            </div>
          </div>
        </div>

        {/* Prerequisites */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">المتطلبات الأساسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prerequisites.map((req, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <req.icon className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{req.title}</h3>
                    <p className="text-sm text-gray-600">{req.description}</p>
                  </div>
                </div>
                <div className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-sm flex items-center justify-between text-left" dir="ltr">
                  <span>$ {req.command}</span>
                  <button
                    onClick={() => copyToClipboard(req.command, req.title)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {copiedCommand === req.title ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recommended Approach */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-green-800 mb-4">النهج الموصى به</h3>
          <p className="text-green-700 mb-4">
            استخدم <code className="bg-green-100 px-2 py-1 rounded text-green-800" dir="ltr">clean-deploy.sh</code> للنشر الكامل في خطوة واحدة. 
            هذا السكريبت يتضمن جميع الخطوات المطلوبة:
          </p>
          <ul className="text-green-700 space-y-1 text-sm">
            <li>• إنشاء البنية التحتية (Terraform)</li>
            <li>• بناء ورفع صور Docker</li>
            <li>• نشر جميع الخدمات</li>
            <li>• تشغيل أدوات المراقبة</li>
            <li>• التحقق من حالة النشر</li>
          </ul>
        </div>

        {/* Quick Start Steps */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">خطوات البدء السريع</h2>
          <div className="space-y-6">
            {quickStartSteps.map((step, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-saudi-green text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600 mb-4">{step.description}</p>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto text-left" dir="ltr">
                      <div className="flex items-start justify-between">
                        <pre className="whitespace-pre-wrap">{step.command}</pre>
                        <button
                          onClick={() => copyToClipboard(step.command, `step-${step.step}`)}
                          className="text-gray-400 hover:text-white transition-colors ml-4 flex-shrink-0"
                        >
                          {copiedCommand === `step-${step.step}` ? (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Detailed Deployment Phases */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">مراحل النشر التفصيلية</h2>
          <p className="text-gray-600 mb-6">
            فهم تفصيلي لما يحدث خلال عملية النشر باستخدام clean-deploy.sh:
          </p>
          
          <div className="space-y-8">
            {/* Infrastructure Phase */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-saudi-green text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  1
                </div>
                <div className="flex items-center gap-3">
                  <Cloud className="h-6 w-6 text-saudi-green" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">البنية التحتية</h3>
                    <p className="text-gray-600">إنشاء EKS cluster والموارد الأساسية</p>
                  </div>
                </div>
                <div className="mr-auto bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  15-20 دقيقة
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Steps */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">الخطوات:</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">تحضير ملفات Terraform</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">تكوين متغيرات البيئة</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">إنشاء VPC وSubnets</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">نشر EKS cluster</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">تكوين Node Groups</span>
                    </li>
                  </ul>
                </div>

                {/* Commands */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">الأوامر:</h4>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm text-left" dir="ltr">
                    <div className="space-y-1">
                      <div>$ cd terraform/environments/poc</div>
                      <div>$ terraform init</div>
                      <div>$ terraform plan -var-file="terraform.tfvars"</div>
                      <div>$ terraform apply -auto-approve</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Applications Phase */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-saudi-green text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  2
                </div>
                <div className="flex items-center gap-3">
                  <Server className="h-6 w-6 text-saudi-green" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">تطبيقات النظام</h3>
                    <p className="text-gray-600">نشر الخدمات المصغرة والتطبيقات</p>
                  </div>
                </div>
                <div className="mr-auto bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  10-15 دقيقة
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Steps */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">الخطوات:</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">بناء صور Docker</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">دفع الصور إلى ECR</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">نشر Kubernetes manifests</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">تكوين Load Balancers</span>
                    </li>
                  </ul>
                </div>

                {/* Commands */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">الأوامر:</h4>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm text-left" dir="ltr">
                    <div className="space-y-1">
                      <div>$ ./scripts/build-images.sh</div>
                      <div>$ ./scripts/push-to-ecr.sh</div>
                      <div>$ ./scripts/deploy.sh</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Monitoring Phase */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-saudi-green text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  3
                </div>
                <div className="flex items-center gap-3">
                  <Settings className="h-6 w-6 text-saudi-green" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">المراقبة والتحليل</h3>
                    <p className="text-gray-600">تشغيل أدوات المراقبة والتحليل</p>
                  </div>
                </div>
                <div className="mr-auto bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  5-10 دقائق
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Steps */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">الخطوات:</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">نشر Prometheus Operator</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">تكوين Grafana</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">إعداد AlertManager</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-gray-700">تشغيل Log Aggregation</span>
                    </li>
                  </ul>
                </div>

                {/* Commands */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">الأوامر:</h4>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm text-left" dir="ltr">
                    <div className="space-y-1">
                      <div>$ ./scripts/deploy-monitoring.sh</div>
                      <div>$ kubectl apply -f monitoring/</div>
                      <div>$ ./scripts/configure-grafana.sh</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Time Estimate */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-green-800 mb-4">تقدير الوقت</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-green-800">الإعداد الأولي:</p>
              <p className="text-green-700">10-15 دقيقة</p>
            </div>
            <div>
              <p className="font-medium text-green-800">نشر البنية التحتية:</p>
              <p className="text-green-700">15-20 دقيقة</p>
            </div>
            <div>
              <p className="font-medium text-green-800">نشر التطبيقات:</p>
              <p className="text-green-700">5-10 دقائق</p>
            </div>
          </div>
        </div>

        {/* Deployment Information Scripts */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">الحصول على معلومات النشر</h2>
          
          <p className="text-gray-600 mb-6">
            بعد اكتمال النشر، استخدم هذه السكريبتات للحصول على جميع المعلومات التي تحتاجها للوصول لتطبيقك:
          </p>

          <div className="space-y-6">
            {/* Comprehensive Info Script */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 text-blue-600 rounded-lg p-2 flex-shrink-0">
                  <Terminal className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">معلومات النشر الشاملة</h3>
                  <p className="text-gray-600 mb-4">
                    يعرض جميع المعلومات التفصيلية: الروابط، بيانات المراقبة، قواعد البيانات، والأوامر المفيدة
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-4 text-left" dir="ltr">
                    <div className="flex items-start justify-between">
                      <pre>./scripts/get-deployment-info.sh</pre>
                      <button
                        onClick={() => copyToClipboard('./scripts/get-deployment-info.sh', 'full-info')}
                        className="text-gray-400 hover:text-white transition-colors ml-4 flex-shrink-0"
                      >
                        {copiedCommand === 'full-info' ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 text-sm font-medium mb-2">ما يعرضه هذا السكريبت:</p>
                    <ul className="text-blue-700 text-sm space-y-1">
                      <li>• رابط الـ Load Balancer وجميع عناوين الخدمات</li>
                      <li>• بيانات تسجيل الدخول التجريبية</li>
                      <li>• معلومات الوصول إلى Grafana وPrometheus</li>
                      <li>• تفاصيل قواعد البيانات والـ Redis</li>
                      <li>• أوامر مفيدة للمراقبة والاستكشاف</li>
                      <li>• حفظ المعلومات في ملف deployment-info.txt</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info Script */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="bg-green-100 text-green-600 rounded-lg p-2 flex-shrink-0">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">المعلومات السريعة</h3>
                  <p className="text-gray-600 mb-4">
                    عرض سريع للمعلومات الأساسية فقط - مثالي للاستخدام اليومي
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto mb-4 text-left" dir="ltr">
                    <div className="flex items-start justify-between">
                      <pre>./scripts/quick-deployment-info.sh</pre>
                      <button
                        onClick={() => copyToClipboard('./scripts/quick-deployment-info.sh', 'quick-info')}
                        className="text-gray-400 hover:text-white transition-colors ml-4 flex-shrink-0"
                      >
                        {copiedCommand === 'quick-info' ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 text-sm font-medium mb-2">المعلومات الأساسية:</p>
                    <ul className="text-green-700 text-sm space-y-1">
                      <li>• روابط التطبيق الرئيسية</li>
                      <li>• بيانات تسجيل الدخول التجريبية</li>
                      <li>• أوامر المراقبة الأساسية</li>
                      <li>• أوامر سريعة للصيانة</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-4">نصائح الاستخدام</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-yellow-800 mb-2">متى تستخدم السكريبت الشامل:</p>
                <ul className="text-yellow-700 space-y-1">
                  <li>• بعد النشر للمرة الأولى</li>
                  <li>• عند الحاجة لمعلومات قواعد البيانات</li>
                  <li>• للحصول على جميع الأوامر المفيدة</li>
                  <li>• لحفظ معلومات النشر في ملف</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-yellow-800 mb-2">متى تستخدم السكريبت السريع:</p>
                <ul className="text-yellow-700 space-y-1">
                  <li>• للحصول على الروابط بسرعة</li>
                  <li>• عند الحاجة لبيانات تسجيل الدخول</li>
                  <li>• للمراجعة اليومية السريعة</li>
                  <li>• لمشاركة المعلومات الأساسية</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Port Forwarding Guide */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">الوصول للخدمات (Port Forwarding)</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-800 mb-2">نصيحة مهمة</h3>
                <p className="text-blue-700">
                  للوصول إلى الخدمات المراقبة مثل Grafana وPrometheus، استخدم port forwarding. 
                  يجب تشغيل كل أمر في terminal منفصل أو في الخلفية.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Grafana */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gray-100 p-2 rounded-lg">
                  <Settings className="h-5 w-5 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Grafana</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">الأمر:</p>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-xs overflow-x-auto text-left" dir="ltr">
                    <div className="flex items-center justify-between">
                      <span className="flex-1 text-left">kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80</span>
                      <button
                        onClick={() => copyToClipboard('kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80', 'pf-grafana')}
                        className="text-gray-400 hover:text-white transition-colors mr-2 flex-shrink-0"
                      >
                        {copiedCommand === 'pf-grafana' ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">الرابط:</p>
                  <a 
                    href="http://localhost:3000" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-saudi-green hover:text-green-700 transition-colors inline-flex items-center gap-1 text-sm"
                  >
                    http://localhost:3000
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">بيانات الدخول:</p>
                  <p className="text-sm text-gray-600">admin / prom-operator</p>
                </div>
              </div>
            </div>

            {/* Prometheus */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gray-100 p-2 rounded-lg">
                  <Settings className="h-5 w-5 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Prometheus</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">الأمر:</p>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-xs overflow-x-auto text-left" dir="ltr">
                    <div className="flex items-center justify-between">
                      <span className="flex-1 text-left">kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090</span>
                      <button
                        onClick={() => copyToClipboard('kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090', 'pf-prometheus')}
                        className="text-gray-400 hover:text-white transition-colors mr-2 flex-shrink-0"
                      >
                        {copiedCommand === 'pf-prometheus' ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">الرابط:</p>
                  <a 
                    href="http://localhost:9090" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-saudi-green hover:text-green-700 transition-colors inline-flex items-center gap-1 text-sm"
                  >
                    http://localhost:9090
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">بيانات الدخول:</p>
                  <p className="text-sm text-gray-600">لا يحتاج</p>
                </div>
              </div>
            </div>

            {/* AlertManager */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gray-100 p-2 rounded-lg">
                  <Settings className="h-5 w-5 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-900">AlertManager</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">الأمر:</p>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-xs overflow-x-auto text-left" dir="ltr">
                    <div className="flex items-center justify-between">
                      <span className="flex-1 text-left">kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093</span>
                      <button
                        onClick={() => copyToClipboard('kubectl port-forward -n monitoring svc/kube-prometheus-stack-alertmanager 9093:9093', 'pf-alertmanager')}
                        className="text-gray-400 hover:text-white transition-colors mr-2 flex-shrink-0"
                      >
                        {copiedCommand === 'pf-alertmanager' ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">الرابط:</p>
                  <a 
                    href="http://localhost:9093" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-saudi-green hover:text-green-700 transition-colors inline-flex items-center gap-1 text-sm"
                  >
                    http://localhost:9093
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">بيانات الدخول:</p>
                  <p className="text-sm text-gray-600">لا يحتاج</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Environment Destruction */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">إزالة البيئة</h2>
          
          {/* Safety Notice */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-orange-800 mb-2">إشعار أمان</h3>
                <p className="text-orange-700 mb-3">
                  عند الانتهاء من الاختبار والتقييم، يمكنك إزالة البيئة بأمان باستخدام Terraform destroy. 
                  هذا الأمر سيقوم بإزالة <strong>فقط</strong> الموارد التي تم إنشاؤها بواسطة هذا المشروع.
                </p>
                <div className="bg-orange-100 border border-orange-300 rounded-lg p-3">
                  <p className="text-sm text-orange-800">
                    <strong>ما سيتم حذفه:</strong> جميع الموارد التي تم إنشاؤها بواسطة Terraform في هذا المشروع فقط، 
                    ولن يؤثر على أي موارد أخرى في حسابك على AWS.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Destruction Steps */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="bg-red-100 text-red-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">إزالة البيئة الكاملة</h3>
                  <p className="text-gray-600 mb-4">
                    استخدم هذا الأمر لإزالة جميع الموارد التي تم إنشاؤها (البنية التحتية والتطبيقات)
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto text-left" dir="ltr">
                    <div className="flex items-start justify-between">
                      <pre className="whitespace-pre-wrap">cd terraform/environments/poc{'\n'}terraform destroy --auto-approve</pre>
                      <button
                        onClick={() => copyToClipboard('cd terraform/environments/poc\nterraform destroy --auto-approve', 'destroy-all')}
                        className="text-gray-400 hover:text-white transition-colors ml-4 flex-shrink-0"
                      >
                        {copiedCommand === 'destroy-all' ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <div className="bg-yellow-100 text-yellow-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Terminal className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">مراجعة التغييرات قبل الحذف (اختياري)</h3>
                  <p className="text-gray-600 mb-4">
                    لمراجعة ما سيتم حذفه قبل التنفيذ الفعلي
                  </p>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto text-left" dir="ltr">
                    <div className="flex items-start justify-between">
                      <pre className="whitespace-pre-wrap">cd terraform/environments/poc{'\n'}terraform plan -destroy</pre>
                      <button
                        onClick={() => copyToClipboard('cd terraform/environments/poc\nterraform plan -destroy', 'plan-destroy')}
                        className="text-gray-400 hover:text-white transition-colors ml-4 flex-shrink-0"
                      >
                        {copiedCommand === 'plan-destroy' ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Destruction Time Estimate */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-red-800 mb-4">تقدير وقت الإزالة</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-red-800">إزالة التطبيقات:</p>
                <p className="text-red-700">2-5 دقائق</p>
              </div>
              <div>
                <p className="font-medium text-red-800">إزالة البنية التحتية:</p>
                <p className="text-red-700">10-15 دقيقة</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-red-200">
              <p className="text-red-700 text-sm">
                <strong>تنبيه:</strong> تأكد من أنك لا تحتاج البيئة قبل تنفيذ الإزالة، لأنه لا يمكن التراجع عن هذه العملية.
              </p>
            </div>
          </div>
        </section>

        {/* Next Steps */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">الخطوات التالية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              href="/docs/architecture"
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3 mb-3">
                <Book className="h-6 w-6 text-saudi-green" />
                <h3 className="font-semibold text-gray-900">البنية المعمارية</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">تعرف على تصميم النظام والمكونات</p>
              <div className="flex items-center text-saudi-green text-sm group-hover:gap-2 transition-all">
                <span>اقرأ المزيد</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/monitoring"
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3 mb-3">
                <Settings className="h-6 w-6 text-saudi-green" />
                <h3 className="font-semibold text-gray-900">لوحة المراقبة</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">مراقبة حالة النظام والخدمات</p>
              <div className="flex items-center text-saudi-green text-sm group-hover:gap-2 transition-all">
                <span>افتح اللوحة</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link
              href="/docs/troubleshooting"
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-3 mb-3">
                <Terminal className="h-6 w-6 text-saudi-green" />
                <h3 className="font-semibold text-gray-900">استكشاف الأخطاء</h3>
              </div>
              <p className="text-gray-600 text-sm mb-3">حلول للمشاكل الشائعة</p>
              <div className="flex items-center text-saudi-green text-sm group-hover:gap-2 transition-all">
                <span>عرض الحلول</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </section>

        {/* Support Links */}
        <div className="bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">تحتاج مساعدة؟</h3>
          <div className="flex flex-wrap gap-4">
            <a
              href="https://docs.aws.amazon.com/eks/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-saudi-green hover:text-green-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>وثائق AWS EKS</span>
            </a>
            <a
              href="https://kubernetes.io/docs/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-saudi-green hover:text-green-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>وثائق Kubernetes</span>
            </a>
            <a
              href="https://terraform.io/docs/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-saudi-green hover:text-green-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>وثائق Terraform</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}