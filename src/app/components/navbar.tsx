'use client'

import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, ListChecks, Table2 } from 'lucide-react';
import Link from 'next/link';

// Navigation Bar Component
export function NavigationBar() {
    const pathname = usePathname();
  
    // Define paths where the navbar should NOT be shown
    const noNavPaths = ['/', '/login'];
  
    if (noNavPaths.includes(pathname)) {
      return null; // Don't render navbar on specified paths
    }
  
    const navItems = [
      { href: '/dashboard', label: '대시보드', icon: <LayoutDashboard className="h-5 w-5" /> },
      { href: '/table', label: '테이블', icon: <Table2 className="h-5 w-5" /> },
      { href: '/todo', label: '투두리스트', icon: <ListChecks className="h-5 w-5" /> },
    ];
  
    return (
        <nav className="bg-gray-800 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/dashboard" className="text-xl font-bold hover:text-gray-300 transition-colors flex items-center gap-2">
            <Home className="h-6 w-6" />
            <span>관리 시스템</span>
          </Link>
          <ul className="flex space-x-4 md:space-x-6">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${pathname === item.href
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    );
  }