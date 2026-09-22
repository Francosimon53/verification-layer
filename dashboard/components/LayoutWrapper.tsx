'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  // The AWS funnel owns its header and footer in app/aws/layout.tsx.
  const isAwsFunnel = pathname === '/aws' || pathname.startsWith('/aws/');
  const isPublicPage = pathname.startsWith('/legal') ||
    pathname.startsWith('/github') ||
    pathname === '/pricing';

  // Auth pages and the AWS funnel: no sidebar, no global footer
  if (isAuthPage || isAwsFunnel) {
    return <>{children}</>;
  }

  // Public pages (legal, github callback, pricing): no sidebar, has footer
  if (isPublicPage) {
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }

  // Authenticated pages: sidebar + footer
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
