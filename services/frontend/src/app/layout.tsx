import type { Metadata } from 'next';
import './globals.css';
import Layout from '@/components/ui/Layout';

export const metadata: Metadata = {
  title: 'منصة مهام هندسة الموثوقية',
  description: 'منصة شاملة لعرض هندسة الموثوقية مع بنية الخدمات الصغيرة والمراقبة والتوثيق الشامل.',
  keywords: 'SRE, DevOps, الخدمات الصغيرة, Kubernetes, المراقبة, التوثيق',
  authors: [{ name: 'فريق مهام هندسة الموثوقية' }],
  openGraph: {
    title: 'منصة مهام هندسة الموثوقية',
    description: 'منصة هندسة موثوقية على مستوى المؤسسة تُظهر أفضل الممارسات',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="arabic-text">
        <Layout>
          {children}
        </Layout>
      </body>
    </html>
  );
}
