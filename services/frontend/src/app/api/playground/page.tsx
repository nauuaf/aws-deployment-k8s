'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Terminal,
  Play,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  Code2,
  Server,
  Key,
  Database,
  CloudUpload,
  User,
  Shield,
  Settings,
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Zap
} from 'lucide-react';

interface APIEndpoint {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  description: string;
  service: 'api' | 'auth' | 'image';
  requiresAuth: boolean;
  headers?: Record<string, string>;
  body?: any;
  icon: any;
}

interface TestResult {
  status: number;
  statusText: string;
  data: any;
  headers: Record<string, string>;
  duration: number;
  timestamp: string;
}

export default function APIPlaygroundPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [customHeaders, setCustomHeaders] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  const router = useRouter();

  // Check authentication
  const isAuthenticated = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
      if (token && !authToken) {
        setAuthToken(token);
      }
      return token !== null;
    }
    return false;
  };

  // Update authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated();
      setIsAuth(authenticated);
    };
    
    checkAuth();
    
    // Listen for storage changes
    window.addEventListener('storage', checkAuth);
    
    return () => {
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  const endpoints: APIEndpoint[] = [
    // API Service Endpoints
    {
      id: 'api-health',
      name: 'فحص حالة API',
      method: 'GET',
      url: '/api/status',
      description: 'فحص حالة خدمة API الرئيسية (Backend)',
      service: 'api',
      requiresAuth: false,
      icon: Server,
    },
    {
      id: 'api-users',
      name: 'قائمة المستخدمين',
      method: 'GET',
      url: '/api/users',
      description: 'الحصول على قائمة بجميع المستخدمين',
      service: 'api',
      requiresAuth: true,
      icon: User,
    },
    {
      id: 'api-user-create',
      name: 'إنشاء مستخدم',
      method: 'POST',
      url: '/api/users',
      description: 'إنشاء مستخدم جديد في النظام',
      service: 'api',
      requiresAuth: true,
      icon: User,
      body: {
        name: 'Ahmed Al-Rashid',
        email: 'ahmed@example.com',
        role: 'user'
      },
    },
    
    // Auth Service Endpoints (via API Gateway)
    {
      id: 'auth-health',
      name: 'فحص حالة المصادقة',
      method: 'GET',
      url: '/api/auth/health',
      description: 'فحص حالة خدمة المصادقة عبر API Gateway',
      service: 'auth',
      requiresAuth: false,
      icon: Shield,
    },
    {
      id: 'auth-register',
      name: 'تسجيل حساب جديد',
      method: 'POST',
      url: '/api/auth/register',
      description: 'إنشاء حساب مستخدم جديد',
      service: 'auth',
      requiresAuth: false,
      icon: User,
      body: {
        name: 'Fatima Al-Zahra',
        email: 'fatima@example.com',
        password: 'securepassword123'
      },
    },
    {
      id: 'auth-login',
      name: 'تسجيل الدخول',
      method: 'POST',
      url: '/api/auth/login',
      description: 'تسجيل دخول بيانات اعتماد موجودة',
      service: 'auth',
      requiresAuth: false,
      icon: Key,
      body: {
        email: 'admin@example.com',
        password: 'demo123'
      },
    },
    {
      id: 'auth-profile',
      name: 'الملف الشخصي',
      method: 'GET',
      url: '/api/auth/profile',
      description: 'الحصول على معلومات المستخدم المحدد',
      service: 'auth',
      requiresAuth: true,
      icon: User,
    },

    // Image Service Endpoints (via API Gateway)
    {
      id: 'image-health',
      name: 'فحص حالة الصور',
      method: 'GET', 
      url: '/api/images/health',
      description: 'فحص حالة خدمة معالجة الصور عبر API Gateway',
      service: 'image',
      requiresAuth: false,
      icon: CloudUpload,
    },
    {
      id: 'image-upload',
      name: 'رفع صورة',
      method: 'POST',
      url: '/api/images/upload',
      description: 'رفع ومعالجة صورة جديدة',
      service: 'image',
      requiresAuth: true,
      icon: CloudUpload,
      headers: { 'Content-Type': 'multipart/form-data' },
    },
    {
      id: 'image-list',
      name: 'قائمة الصور',
      method: 'GET',
      url: '/api/images',
      description: 'الحصول على قائمة بالصور المرفوعة',
      service: 'image',
      requiresAuth: true,
      icon: Database,
    },
  ];

  const getServiceUrl = (service: string) => {
    // For the API playground, we want to test the actual backend services through the load balancer
    // Since all services are accessible through the same load balancer, we use relative URLs
    // but they should point to the backend API endpoints, not frontend routes
    const urls = {
      api: '',           // API gateway routes like /api/health, /api/v1/users
      auth: '',          // Auth endpoints via API gateway like /api/v1/auth/login  
      image: '',         // Image endpoints via API gateway like /api/v1/images/upload
    };
    return urls[service as keyof typeof urls];
  };

  const getServiceColor = (service: string) => {
    const colors = {
      api: 'blue',
      auth: 'green',
      image: 'purple',
    };
    return colors[service as keyof typeof colors] || 'gray';
  };

  const getMethodColor = (method: string) => {
    const colors = {
      GET: 'bg-green-100 text-green-800',
      POST: 'bg-blue-100 text-blue-800',
      PUT: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
    };
    return colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const executeRequest = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    setError('');
    setTestResult(null);

    try {
      const startTime = Date.now();
      const serviceUrl = getServiceUrl(selectedEndpoint.service);
      const fullUrl = `${serviceUrl}${selectedEndpoint.url}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...customHeaders,
        ...(selectedEndpoint.headers || {}),
      };

      // Add auth token if required
      if (selectedEndpoint.requiresAuth && authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      // Remove Content-Type for file uploads
      if (selectedEndpoint.headers?.['Content-Type'] === 'multipart/form-data') {
        delete headers['Content-Type'];
      }

      const config: RequestInit = {
        method: selectedEndpoint.method,
        headers,
      };

      // Add body for POST/PUT requests
      if (['POST', 'PUT'].includes(selectedEndpoint.method)) {
        if (selectedEndpoint.id === 'image-upload') {
          // For file upload, we'll simulate with FormData
          const formData = new FormData();
          // Create a small test image blob
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 10;
          const ctx = canvas.getContext('2d');
          ctx!.fillStyle = '#006C35';
          ctx!.fillRect(0, 0, 10, 10);
          canvas.toBlob((blob) => {
            if (blob) {
              formData.append('images', blob, 'test-image.png');
            }
          });
          config.body = formData;
        } else {
          config.body = requestBody || JSON.stringify(selectedEndpoint.body);
        }
      }

      const response = await fetch(fullUrl, config);
      const endTime = Date.now();
      
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const result: TestResult = {
        status: response.status,
        statusText: response.statusText,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        duration: endTime - startTime,
        timestamp: new Date().toISOString(),
      };

      setTestResult(result);

      // If login successful, update auth token
      if (selectedEndpoint.id === 'auth-login' && response.ok && data.token) {
        setAuthToken(data.token);
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('auth_token', data.token); // Keep for backward compatibility
      }

    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تنفيذ الطلب');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportResult = () => {
    if (!testResult || !selectedEndpoint) return;
    
    const exportData = {
      endpoint: selectedEndpoint,
      result: testResult,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-${selectedEndpoint.id}-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-saudi-green to-green-700 text-white p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Terminal className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ساحة اختبار API</h1>
          <p className="text-gray-600">
            اختبر نقاط النهاية المختلفة لجميع الخدمات المتاحة في المنصة
          </p>
        </div>

        {/* Auth Status */}
        <div className="mb-8">
          <div className={`rounded-lg p-4 ${isAuth ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isAuth ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  {isAuth ? (
                    <Shield className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {isAuth ? 'مصادق عليه' : 'غير مصادق عليه'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isAuth 
                      ? 'يمكنك اختبار جميع نقاط النهاية' 
                      : 'يمكنك اختبار نقاط النهاية العامة فقط'
                    }
                  </p>
                </div>
              </div>
              {!isAuth && (
                <button
                  onClick={() => router.push('/auth/login')}
                  className="bg-saudi-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                >
                  <Key className="h-4 w-4" />
                  تسجيل الدخول
                </button>
              )}
              {isAuth && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {showToken && (
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono max-w-32 truncate">
                      {authToken}
                    </code>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Endpoints List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">نقاط النهاية المتاحة</h2>
              
              <div className="space-y-3">
                {['api', 'auth', 'image'].map((service) => (
                  <div key={service}>
                    <h3 className="text-sm font-medium text-gray-500 mb-2 uppercase tracking-wide">
                      {service === 'api' && 'خدمة API الرئيسية'}
                      {service === 'auth' && 'خدمة المصادقة'}
                      {service === 'image' && 'خدمة الصور'}
                    </h3>
                    <div className="space-y-1">
                      {endpoints.filter(e => e.service === service).map((endpoint) => (
                        <button
                          key={endpoint.id}
                          onClick={() => {
                            setSelectedEndpoint(endpoint);
                            setRequestBody(JSON.stringify(endpoint.body || {}, null, 2));
                            setTestResult(null);
                            setError('');
                          }}
                          className={`w-full text-right p-3 rounded-lg border transition-all duration-200 ${
                            selectedEndpoint?.id === endpoint.id
                              ? 'border-saudi-green bg-green-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
                          } ${endpoint.requiresAuth && !isAuth ? 'opacity-50' : ''}`}
                          disabled={endpoint.requiresAuth && !isAuth}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-mono font-medium ${getMethodColor(endpoint.method)}`} dir="ltr">
                              {endpoint.method}
                            </span>
                            <endpoint.icon className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="text-sm font-medium text-gray-900">{endpoint.name}</div>
                          <div className="text-xs text-gray-600 mt-1">{endpoint.description}</div>
                          {endpoint.requiresAuth && (
                            <div className="flex items-center gap-1 mt-2">
                              <Key className="h-3 w-3 text-orange-500" />
                              <span className="text-xs text-orange-600">مطلوب مصادقة</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Request Configuration & Results */}
          <div className="lg:col-span-2 space-y-6">
            {selectedEndpoint ? (
              <>
                {/* Request Configuration */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">تكوين الطلب</h2>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        getServiceColor(selectedEndpoint.service) === 'blue' ? 'bg-blue-100 text-blue-800' :
                        getServiceColor(selectedEndpoint.service) === 'green' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {selectedEndpoint.service.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-mono font-medium ${getMethodColor(selectedEndpoint.method)}`} dir="ltr">
                        {selectedEndpoint.method}
                      </span>
                    </div>
                  </div>

                  {/* URL */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">URL</label>
                    <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm text-gray-800 flex items-center justify-between text-left" dir="ltr">
                      <span dir="ltr">{getServiceUrl(selectedEndpoint.service)}{selectedEndpoint.url}</span>
                      <button
                        onClick={() => copyToClipboard(`${getServiceUrl(selectedEndpoint.service)}${selectedEndpoint.url}`)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Request Body */}
                  {['POST', 'PUT'].includes(selectedEndpoint.method) && selectedEndpoint.id !== 'image-upload' && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">محتوى الطلب (JSON)</label>
                      <textarea
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-saudi-green focus:border-transparent font-mono text-sm text-gray-900 placeholder-gray-500 text-left" dir="ltr"
                        placeholder='{"key": "value"}'
                      />
                    </div>
                  )}

                  {/* File Upload Note */}
                  {selectedEndpoint.id === 'image-upload' && (
                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CloudUpload className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-medium text-blue-800">رفع الملفات</h3>
                          <p className="text-sm text-blue-700 mt-1">
                            سيتم إنشاء صورة تجريبية تلقائياً لاختبار نقطة النهاية هذه.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Execute Button */}
                  <button
                    onClick={executeRequest}
                    disabled={loading || (selectedEndpoint.requiresAuth && !isAuth)}
                    className="w-full bg-saudi-green text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-saudi-green focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        جاري التنفيذ...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        تنفيذ الطلب
                      </>
                    )}
                  </button>
                </div>

                {/* Results */}
                {(testResult || error) && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">النتائج</h2>
                      {testResult && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={exportResult}
                            className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100"
                            title="تصدير النتائج"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => copyToClipboard(JSON.stringify(testResult, null, 2))}
                            className="text-gray-600 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100"
                            title="نسخ النتائج"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <span className="text-red-700">{error}</span>
                        </div>
                      </div>
                    )}

                    {testResult && (
                      <div className="space-y-4">
                        {/* Status */}
                        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                            testResult.status >= 200 && testResult.status < 300
                              ? 'bg-green-100 text-green-800'
                              : testResult.status >= 400
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {testResult.status} {testResult.statusText}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Zap className="h-4 w-4" />
                            {testResult.duration}ms
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(testResult.timestamp).toLocaleString('ar-SA')}
                          </div>
                        </div>

                        {/* Response Data */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">محتوى الاستجابة</h3>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <pre className="text-sm text-gray-800 font-mono overflow-x-auto whitespace-pre-wrap text-left" dir="ltr">
                              {typeof testResult.data === 'object' 
                                ? JSON.stringify(testResult.data, null, 2)
                                : testResult.data
                              }
                            </pre>
                          </div>
                        </div>

                        {/* Response Headers */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 mb-2">رؤوس الاستجابة</h3>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="space-y-1 text-sm font-mono text-left" dir="ltr">
                              {Object.entries(testResult.headers).map(([key, value]) => (
                                <div key={key} dir="ltr">
                                  <span className="text-gray-600">{key}:</span> <span className="text-gray-800">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Terminal className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">اختر نقطة نهاية لاختبارها</h3>
                <p className="text-gray-600">
                  اختر إحدى نقاط النهاية من القائمة على اليسار لبدء الاختبار
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Technical Information */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">معلومات تقنية</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-blue-800">خدمة API الرئيسية:</p>
              <p className="text-blue-700 font-mono text-left" dir="ltr">{typeof window !== 'undefined' ? window.location.origin : ''}/api</p>
            </div>
            <div>
              <p className="font-medium text-blue-800">خدمة المصادقة:</p>
              <p className="text-blue-700 font-mono text-left" dir="ltr">{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth</p>
            </div>
            <div>
              <p className="font-medium text-blue-800">خدمة الصور:</p>
              <p className="text-blue-700 font-mono text-left" dir="ltr">{typeof window !== 'undefined' ? window.location.origin : ''}/api/images</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-blue-700 text-sm">
              <strong>ملاحظة:</strong> تأكد من أن الخدمات تعمل على العناوين المحددة أعلاه. 
              يمكن تخصيص هذه العناوين من خلال متغيرات البيئة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}