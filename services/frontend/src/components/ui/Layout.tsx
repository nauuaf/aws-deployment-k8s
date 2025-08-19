'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  BookOpen,
  Code,
  Shield,
  BarChart3,
  Terminal,
  Users,
  Settings,
  Menu,
  X,
  ChevronDown,
  FileText,
  GitBranch,
  Database,
  Cloud,
  Package,
  AlertTriangle,
  HelpCircle,
  DollarSign,
  Zap,
  Lock,
  Server,
  Layers,
  CloudUpload,
  LogOut,
  User as UserIcon
} from 'lucide-react';

interface NavItem {
  title: string;
  href?: string;
  icon?: any;
  children?: NavItem[];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Check authentication status
  useEffect(() => {
    const checkAuth = () => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
        const user = localStorage.getItem('user_data');
        
        setIsAuthenticated(!!token);
        if (user) {
          try {
            setUserData(JSON.parse(user));
          } catch (e) {
            console.error('Failed to parse user data');
          }
        }
      }
    };

    checkAuth();
    
    // Listen for storage changes
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    setIsAuthenticated(false);
    setUserData(null);
    router.push('/');
  };

  const navigation: NavItem[] = [
    {
      title: 'الرئيسية',
      href: '/',
      icon: Home,
    },
    {
      title: 'الوثائق',
      icon: BookOpen,
      children: [
        { title: 'دليل البدء السريع والنشر', href: '/docs/getting-started', icon: Zap },
        { title: 'البنية المعمارية', href: '/docs/architecture', icon: Layers },
      ],
    },
    {
      title: 'ساحة اختبار API',
      href: '/api/playground',
      icon: Terminal,
    },
    {
      title: 'رفع الصور',
      href: '/images/upload',
      icon: CloudUpload,
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-saudi-green to-green-700 text-white p-2.5 rounded-xl shadow-sm">
                  <Server className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 font-arabic">منصة SRE</h1>
                  <p className="text-xs text-gray-500">هندسة الموثوقية السحابية</p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <div key={item.title} className="relative">
                  {item.children ? (
                    <button
                      onClick={() => setOpenDropdown(openDropdown === item.title ? null : item.title)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 inline-flex items-center gap-2 ${
                        openDropdown === item.title
                          ? 'bg-green-50 text-saudi-green shadow-sm'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-saudi-green'
                      }`}
                    >
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.title}
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${
                        openDropdown === item.title ? 'rotate-180' : ''
                      }`} />
                    </button>
                  ) : (
                    <Link
                      href={item.href!}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 inline-flex items-center gap-2 ${
                        isActive(item.href!)
                          ? 'bg-saudi-green text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-saudi-green'
                      }`}
                    >
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.title}
                    </Link>
                  )}

                  {/* Dropdown Menu */}
                  {item.children && openDropdown === item.title && (
                    <div className="absolute top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                      {item.children.map((child) => (
                        <Link
                          key={child.title}
                          href={child.href!}
                          onClick={() => setOpenDropdown(null)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-saudi-green transition-colors"
                        >
                          {child.icon && <child.icon className="h-4 w-4" />}
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Auth Section */}
            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <UserIcon className="h-4 w-4" />
                    <span>مرحباً، {userData?.firstName || userData?.name || 'مستخدم'}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors inline-flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    تسجيل الخروج
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="bg-saudi-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                >
                  <UserIcon className="h-4 w-4" />
                  تسجيل الدخول
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-2">
              {!isAuthenticated && (
                <Link
                  href="/auth/login"
                  className="bg-saudi-green text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  دخول
                </Link>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 shadow-lg">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <div key={item.title}>
                  {item.children ? (
                    <>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === item.title ? null : item.title)}
                        className="w-full text-right px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-saudi-green flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {item.icon && <item.icon className="h-4 w-4" />}
                          {item.title}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${
                          openDropdown === item.title ? 'rotate-180' : ''
                        }`} />
                      </button>
                      {openDropdown === item.title && (
                        <div className="ps-4 space-y-1 mt-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.title}
                              href={child.href!}
                              onClick={() => {
                                setMobileMenuOpen(false);
                                setOpenDropdown(null);
                              }}
                              className="block px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-saudi-green transition-colors"
                            >
                              <span className="flex items-center gap-2">
                                {child.icon && <child.icon className="h-4 w-4" />}
                                {child.title}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href!}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href!)
                          ? 'bg-saudi-green text-white'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-saudi-green'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {item.icon && <item.icon className="h-4 w-4" />}
                        {item.title}
                      </span>
                    </Link>
                  )}
                </div>
              ))}
              
              {/* Mobile Auth Section */}
              <div className="px-3 py-4 border-t border-gray-200 mt-4">
                {isAuthenticated ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 px-3 py-2">
                      <UserIcon className="h-4 w-4" />
                      <span>مرحباً، {userData?.firstName || userData?.name || 'مستخدم'}</span>
                    </div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      تسجيل الخروج
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full bg-saudi-green text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors text-center"
                  >
                    تسجيل الدخول
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-gray-900 to-gray-800 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* About */}
            <div>
              <h3 className="text-lg font-semibold mb-4 font-arabic">عن المشروع</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                منصة هندسة الموثوقية السحابية - نظام متكامل لإدارة البنية التحتية 
                باستخدام أحدث التقنيات السحابية وأفضل ممارسات DevOps.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold mb-4 font-arabic">روابط سريعة</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/docs/getting-started" className="text-gray-400 hover:text-white transition-colors">
                    دليل البدء السريع والنشر
                  </Link>
                </li>
                <li>
                  <Link href="/docs/architecture" className="text-gray-400 hover:text-white transition-colors">
                    البنية المعمارية
                  </Link>
                </li>
                <li>
                  <span className="text-gray-400 cursor-help" title="استخدم port-forward للوصول إلى أدوات المراقبة">
                    لوحة المراقبة (port-forward)
                  </span>
                </li>
              </ul>
            </div>

            {/* Technologies */}
            <div>
              <h3 className="text-lg font-semibold mb-4 font-arabic">التقنيات المستخدمة</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="ltr">Kubernetes (EKS)</li>
                <li className="ltr">Terraform</li>
                <li className="ltr">PostgreSQL</li>
                <li className="ltr">AWS Services</li>
                <li className="ltr">Prometheus & Grafana</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-semibold mb-4 font-arabic">معلومات إضافية</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="https://github.com/nauuaf/aws-deployment-k8s" className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    الكود المصدري
                  </Link>
                </li>
                <li>
                  <Link href="/api/playground" className="text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    ساحة اختبار API
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm text-gray-400">
            <p>© 2025 منصة هندسة الموثوقية السحابية. جميع الحقوق محفوظة.</p>
            <p className="mt-2">
              تم التطوير كجزء من مهام SRE - نظام توضيحي للبنية التحتية السحابية
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}