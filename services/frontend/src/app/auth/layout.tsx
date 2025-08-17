import type { Metadata } from 'next';
import Link from 'next/link';
import { Server, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'تسجيل الدخول - منصة هندسة الموثوقية السحابية',
  description: 'تسجيل الدخول إلى منصة هندسة الموثوقية السحابية',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      {/* Simple Header */}
      <div className="absolute top-6 left-6 z-10">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-gray-600 hover:text-saudi-green transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>

      {/* Brand Logo */}
      <div className="absolute top-6 right-6 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-saudi-green to-green-700 text-white p-2 rounded-xl shadow-sm">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 font-arabic">منصة SRE</h1>
            <p className="text-xs text-gray-500">هندسة الموثوقية السحابية</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen px-4 py-12">
        {children}
      </div>
    </div>
  );
}