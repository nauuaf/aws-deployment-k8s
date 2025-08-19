'use client';

import { useEffect, useState } from 'react';
import { 
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Database,
  Upload,
  BarChart3,
  Terminal,
  Zap,
  Settings,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  Shield,
  Clock,
  Server,
  GitBranch,
  ExternalLink,
  Info
} from 'lucide-react';
import Link from 'next/link';

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'loading';
  service: string;
  timestamp: string;
  responseTime?: number;
}

interface SystemStatus {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: {
    [key: string]: ServiceHealth;
  };
  timestamp: string;
}


export default function HomePage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        // Check actual service health using proper endpoints
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const healthChecks = await Promise.allSettled([
          // Frontend health check (always healthy if we can run this code)
          Promise.resolve({ status: 'healthy', service: 'frontend' }),
          
          // API service health check
          fetch(`${baseUrl}/api/status`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          }).then(async r => {
            if (!r.ok) throw new Error(`${r.status}`);
            return await r.json();
          }).catch(e => {
            throw new Error(`API service: ${e.message}`);
          }),
          
          // Auth service health check
          fetch(`${baseUrl}/api/auth/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          }).then(async r => {
            if (!r.ok) throw new Error(`${r.status}`);
            return await r.json();
          }).catch(e => {
            throw new Error(`Auth service: ${e.message}`);
          }),
          
          // Image service health check
          fetch(`${baseUrl}/api/images/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          }).then(async r => {
            if (!r.ok) throw new Error(`${r.status}`);
            return await r.json();
          }).catch(e => {
            throw new Error(`Image service: ${e.message}`);
          }),
        ]);

        // Log health check results for debugging
        healthChecks.forEach((result, index) => {
          const services = ['Frontend', 'API', 'Auth', 'Image'];
          if (result.status === 'rejected') {
            console.log(`${services[index]} health check failed:`, result.reason);
          } else {
            console.log(`${services[index]} health check succeeded:`, result.value);
          }
        });

        // Determine service statuses based on health check results
        const frontendHealthy = healthChecks[0].status === 'fulfilled';
        const apiHealthy = healthChecks[1].status === 'fulfilled';
        const authHealthy = healthChecks[2].status === 'fulfilled';
        const imageHealthy = healthChecks[3].status === 'fulfilled';

        const status: SystemStatus = {
          overall: 'degraded', // Will be calculated below
          services: {
            frontend: {
              status: frontendHealthy ? 'healthy' : 'unhealthy',
              service: 'واجهة المستخدم',
              timestamp: new Date().toISOString(),
            },
            api: {
              status: apiHealthy ? 'healthy' : 'unhealthy',
              service: 'خدمة الواجهة البرمجية',
              timestamp: new Date().toISOString(),
            },
            auth: {
              status: authHealthy ? 'healthy' : 'unhealthy',
              service: 'خدمة المصادقة',
              timestamp: new Date().toISOString(),
            },
            image: {
              status: imageHealthy ? 'healthy' : 'unhealthy',
              service: 'خدمة معالجة الصور',
              timestamp: new Date().toISOString(),
            },
          },
          timestamp: new Date().toISOString(),
        };

        // Update overall status
        const healthyCount = Object.values(status.services).filter(s => s.status === 'healthy').length;
        if (healthyCount === 4) status.overall = 'healthy';
        else if (healthyCount === 0) status.overall = 'unhealthy';
        else status.overall = 'degraded';

        setSystemStatus(status);
      } catch (error) {
        console.error('Failed to fetch system status:', error);
        // Set all services as unhealthy if there's a global error
        setSystemStatus({
          overall: 'unhealthy',
          services: {
            frontend: {
              status: 'unhealthy',
              service: 'واجهة المستخدم',
              timestamp: new Date().toISOString(),
            },
            api: {
              status: 'unhealthy',
              service: 'خدمة الواجهة البرمجية',
              timestamp: new Date().toISOString(),
            },
            auth: {
              status: 'unhealthy',
              service: 'خدمة المصادقة',
              timestamp: new Date().toISOString(),
            },
            image: {
              status: 'unhealthy',
              service: 'خدمة معالجة الصور',
              timestamp: new Date().toISOString(),
            },
          },
          timestamp: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: ServiceHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: ServiceHealth['status']) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'unhealthy':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-saudi-green mx-auto"></div>
          <p className="mt-4 text-gray-700">جاري تحميل حالة النظام...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                منصة هندسة الموثوقية السحابية
              </h1>
              <p className="text-gray-600 mt-2">
                إرشاد الإعداد، مراقبة النظام، ومحاكاة الأعطال
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* System Status */}
        <section className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">حالة النظام العامة</h2>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-600">تحديثات مباشرة</span>
                <div className={`h-2 w-2 rounded-full ${
                  systemStatus?.overall === 'healthy' ? 'bg-green-500' :
                  systemStatus?.overall === 'unhealthy' ? 'bg-red-500' : 'bg-yellow-500'
                } animate-pulse`}></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {systemStatus && Object.entries(systemStatus.services).map(([key, service]) => (
                <div 
                  key={key} 
                  className={`flex items-center justify-between p-4 rounded-lg border ${getStatusColor(service.status)}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <div>
                      <h3 className="font-medium">{service.service}</h3>
                      <p className="text-sm opacity-75">
                        {service.status === 'healthy' ? 'يعمل' : 
                         service.status === 'unhealthy' ? 'متوقف' : 'جاري التحميل'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture Overview */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">معمارية النظام</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">المعمارية</h3>
                <p className="mt-2 text-lg font-semibold text-gray-900">الخدمات المصغرة</p>
                <p className="text-sm text-gray-600">4 خدمات مستقلة</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">البنية التحتية</h3>
                <p className="mt-2 text-lg font-semibold text-gray-900">AWS EKS</p>
                <p className="text-sm text-gray-600">Kubernetes 1.30</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">المنطقة</h3>
                <p className="mt-2 text-lg font-semibold text-gray-900">eu-central-1</p>
                <p className="text-sm text-gray-600">فرانكفورت</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">البيئة</h3>
                <p className="mt-2 text-lg font-semibold text-gray-900">تجريبية</p>
                <p className="text-sm text-gray-600">تطوير/اختبار</p>
              </div>
            </div>
          </div>
        </section>


        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              مشروع هندسة الموثوقية - منصة البنية التحتية السحابية
            </p>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/nauuaf/aws-deployment-k8s" 
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitBranch className="h-4 w-4" />
                GitHub
              </a>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-600">الإصدار 2.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}