"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  ListChecks,
  Table2,
  User,
  LogOut,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// Define a basic type for the user object
interface UserProfile {
  id: string;
  username?: string;
  role: string;
}

export function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const noNavPaths = ["/", "/login"];

  // useEffect to check auth status on component mount
  useEffect(() => {
    // Define the async function inside useEffect to capture the correct state setters
    // and to avoid ESLint exhaustive-deps issues if it were defined outside without useCallback.
    const performCheckAuthStatus = async () => {
      setIsLoading(true);
      try {
        // Using /api/auth/verify as per your provided code.
        // Ensure this endpoint correctly checks the cookie and returns { isAuthenticated, user }
        const response = await fetch("/api/auth/verify");
        if (!response.ok) {
          // e.g., 401 means not authenticated
          setUser(null);
          setIsAuthenticated(false);
          return;
        }
        const data = await response.json();
        if (data.isAuthenticated && data.user) {
          setUser(data.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Error fetching auth status:", error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (!noNavPaths.includes(pathname)) {
      // Only check auth if navbar is supposed to be visible
      performCheckAuthStatus();
    } else {
      setIsLoading(false); // If navbar is hidden, no auth check needed, stop loading.
      setUser(null); // Ensure user state is null if navbar is hidden.
      setIsAuthenticated(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Re-run if pathname changes, to re-evaluate if auth check is needed or navbar shown.
  // This also means if user navigates from /login to /dashboard, auth status is checked.

  // --- Conditional rendering based on path BEFORE other logic if navbar is hidden ---
  if (noNavPaths.includes(pathname)) {
    return null;
  }

  // --- Functions for logout (defined fresh on each render as useCallback is removed) ---
  const localLogout = async () => {
    setIsLoading(true); // You might use a more specific loading state for logout action
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Error during logout in NavigationBar:", error);
      // Even if server call fails, update client state to reflect logout attempt
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    await localLogout();
    router.push("/"); // Redirect to the root page after logout
  };

  // --- Component constants and JSX ---
  const navItems = [
    {
      href: "/dashboard",
      label: "대시보드",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    { href: "/table", label: "테이블", icon: <Table2 className="h-5 w-5" /> },
    {
      href: "/todo",
      label: "투두리스트",
      icon: <ListChecks className="h-5 w-5" />,
    },
    {
      href: "/calendar",
      label: "캘린더",
      icon: <CalendarDays className="h-5 w-5" />,
    },
  ];

  return (
    <nav className="bg-gray-800 text-white p-4 shadow-md sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link
          href="/dashboard"
          className="text-xl font-bold hover:text-gray-300 transition-colors flex items-center gap-2"
        >
          <Home className="h-6 w-6" />
          <span>골프프렌드 기획관리부</span>
        </Link>

        <div className="flex items-center space-x-6">
          <ul className="flex space-x-4 md:space-x-6">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(item.href) &&
                        item.href !== "/")
                        ? "bg-gray-900 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center space-x-4">
            {isLoading ? ( // This isLoading is for the initial auth check
              <div className="flex items-center space-x-3">
                <div className="h-6 w-6 bg-gray-700 rounded-full animate-pulse"></div>
                <div className="h-4 w-12 bg-gray-700 rounded-md animate-pulse"></div>
                <div className="h-8 w-24 bg-gray-700 rounded-md animate-pulse"></div>
              </div>
            ) : isAuthenticated && user ? (
              <>
                <div
                  className="flex items-center space-x-2"
                  title={user.role ? `User Role: ${user.role}` : "User"}
                >
                  <User className="h-6 w-6 text-gray-300" />
                  {user.role && (
                    <span className="text-sm font-medium text-gray-300 hidden sm:inline">
                      {user.role}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-red-600 hover:text-white transition-colors"
                  title="로그아웃"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
