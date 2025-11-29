import React, { useState } from "react";
import Sidebar from "./usersidebar";
import { useLanguage } from "@/hooks/use-language";
import AppHeader from "./app-header";
import { Menu, X, Search } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
interface UserLayoutProps {
  children: React.ReactNode;
}

const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLanguage();
  const [location] = useLocation();
  const { user } = useAuth();

  const isAuthPage =
    location === "/auth" ||
    location === "/signin" ||
    location === "/signup" ||
    location === "/login";

  return (
    <div className="flex h-screen bg-[#111318] text-white overflow-hidden">
      {/* Sidebar for desktop */}
      <div className="hidden md:block bg-gradient-to-b from-blue-100 to-gray-100">
        <Sidebar />
      </div>

      {/* ✅ Sidebar overlay for mobile (slides in from the right) */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity md:hidden ${
          mobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div
          className={`absolute right-0 top-0 h-full w-64 bg-[#1C1F26] shadow-lg p-4 transform transition-transform duration-300 ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile sidebar content same as desktop */}
          <Sidebar isMobile />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden bg-[#2f343a]">
        {/* ✅ Mobile Header */}
        <div className="md:hidden flex justify-between items-center p-4 bg-[#2f343a]">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/images/trend-logo.png"
              alt="Trend Logo"
              className="h-9 w-9 object-contain"
            />
            <h1 className="font-semibold text-2xl text-white">Trend</h1>
          </div>

          {/* Right: Login (only if not logged in) + Menu */}
          {!isAuthPage && (
            <div className="flex items-center gap-3">
              {!user && (
                <Button
                  asChild
                  className="!bg-white !text-black border-0 px-6 h-9 text-sm sm:h-10 sm:text-base"
                >
                  <Link href="/auth">{t("nav.login")}</Link>
                </Button>
              )}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 bg-[#2B2E34] rounded-full hover:bg-[#35383F] transition"
              >
                <Menu className="h-5 w-5 text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block">
          <AppHeader />
        </div>

        {/* Body bg-[#2f343a] */}
        <main className="flex-1 overflow-y-auto py-6 md:py-8 bg-white">
          {children}
        </main>
      </div>
    </div>
  );
};

export default UserLayout;
