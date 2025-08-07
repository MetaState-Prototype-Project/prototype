import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, BarChart3, User, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { CertificateRibbon } from "@/components/icons/certificate-ribbon";

export default function Navbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <nav className="glass-morphism sticky top-0 z-50 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
              <CertificateRibbon className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-800 hidden sm:block">Group Charter</h1>
            <h1 className="text-lg font-bold text-gray-800 sm:hidden">Charter</h1>
          </div>
          
          {/* Mobile & Desktop User Section */}
          <div className="flex items-center space-x-2">
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-1 bg-white/20 backdrop-blur-sm rounded-2xl p-1">
              {!isActive("/") && (
                <Link href="/">
                  <button className="px-6 py-2 rounded-xl font-medium transition-all duration-300 text-gray-600 hover:text-gray-800 hover:bg-white/40">
                    <BarChart3 className="w-4 h-4 mr-2 inline" />
                    Dashboard
                  </button>
                </Link>
              )}
              <Link href="/create">
                <button className={`px-6 py-2 rounded-xl font-medium transition-all duration-300 ${
                  isActive("/create") 
                    ? "nav-active" 
                    : "gradient-primary text-white hover:shadow-lg hover:scale-105"
                }`}>
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Create Charter
                </button>
              </Link>
            </div>
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-600 hover:text-gray-800 hover:bg-white/40 rounded-xl p-2"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            
            {/* User Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3 bg-white/20 backdrop-blur-sm rounded-2xl p-2">
              <div className="w-8 h-8 gradient-secondary rounded-full flex items-center justify-center">
                <User className="text-white text-sm" />
              </div>
              <span className="hidden sm:block text-gray-700 font-medium text-sm lg:text-base">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email?.split('@')[0] || 'User'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800 hover:bg-white/40 rounded-xl p-1.5 sm:p-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline ml-1">Logout</span>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/20">
            <div className="flex flex-col space-y-2">
              {!isActive("/") && (
                <Link href="/">
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-300 text-gray-600 hover:text-gray-800 hover:bg-white/20"
                  >
                    <BarChart3 className="w-4 h-4 mr-3 inline" />
                    Dashboard
                  </button>
                </Link>
              )}
              <Link href="/create">
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all duration-300 ${
                    isActive("/create") 
                      ? "bg-white/30 text-gray-800" 
                      : "gradient-primary text-white hover:shadow-lg"
                  }`}
                >
                  <Plus className="w-4 h-4 mr-3 inline" />
                  Create Charter
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
