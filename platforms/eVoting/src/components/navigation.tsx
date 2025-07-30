import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
    Vote,
    Plus,
    BarChart3,
    Home,
    Menu,
    X,
    LogOut,
    User,
    ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navigation() {
    const [location] = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isAuthenticated, user } = useAuth();

    const navItems = [
        { path: "/", label: "Home", icon: Home },
        { path: "/create", label: "Create Vote", icon: Plus },
    ];

    const isActive = (path: string) => location === path;

    return (
        <nav className="bg-white shadow-lg border-b-2 border-(--crimson)">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center">
                        <div className="shrink-0 flex items-center">
                            <div className="bg-(--crimson) p-2 rounded-md mr-3">
                                <Vote
                                    className="h-6 w-6 text-white font-bold"
                                    strokeWidth={2.5}
                                />
                            </div>
                            <span className="text-xl font-bold text-gray-900">
                                eVoting
                            </span>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            {isAuthenticated ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-(--crimson) transition-colors cursor-pointer">
                                        {user?.profileImageUrl && (
                                            <img
                                                src={user.profileImageUrl}
                                                alt="Profile"
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                        )}
                                        <span className="text-sm text-gray-700">
                                            {user?.firstName ||
                                                user?.email ||
                                                "User"}
                                        </span>
                                        <ChevronDown className="w-4 h-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-48"
                                    >
                                        <DropdownMenuItem asChild>
                                            <Link
                                                href="/"
                                                className="flex items-center w-full"
                                            >
                                                <Home className="w-4 h-4 mr-2" />
                                                Home
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link
                                                href="/create"
                                                className="flex items-center w-full"
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                Create Vote
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a
                                                href="/api/logout"
                                                className="flex items-center w-full"
                                            >
                                                <LogOut className="w-4 h-4 mr-2" />
                                                Logout
                                            </a>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <a
                                    href="/api/login"
                                    className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-white bg-(--crimson) hover:bg-(--crimson-700) transition-colors"
                                >
                                    <User className="w-4 h-4 mr-1" />
                                    Sign In
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-gray-700 hover:text-(--crimson) p-2"
                        >
                            {mobileMenuOpen ? (
                                <X className="h-6 w-6" />
                            ) : (
                                <Menu className="h-6 w-6" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Overlay */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50"
                        onClick={() => setMobileMenuOpen(false)}
                    />

                    {/* Menu Content */}
                    <div className="fixed top-16 left-0 right-0 bg-white border-b shadow-lg">
                        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                            {isAuthenticated ? (
                                <>
                                    {navItems.map(
                                        ({ path, label, icon: Icon }) => (
                                            <Link key={path} href={path}>
                                                <div
                                                    className={`flex items-center px-3 py-2 rounded-md text-base font-medium w-full text-left cursor-pointer ${
                                                        isActive(path)
                                                            ? "text-(--crimson) bg-(--crimson-50)"
                                                            : "text-gray-700 hover:text-(--crimson)"
                                                    }`}
                                                    onClick={() =>
                                                        setMobileMenuOpen(false)
                                                    }
                                                >
                                                    <Icon className="w-5 h-5 mr-2" />
                                                    {label}
                                                </div>
                                            </Link>
                                        )
                                    )}
                                    <div className="border-t pt-2">
                                        <div className="flex items-center px-3 py-2">
                                            {user?.profileImageUrl && (
                                                <img
                                                    src={user.profileImageUrl}
                                                    alt="Profile"
                                                    className="w-8 h-8 rounded-full object-cover mr-2"
                                                />
                                            )}
                                            <span className="text-sm text-gray-700">
                                                {user?.firstName ||
                                                    user?.email ||
                                                    "User"}
                                            </span>
                                        </div>
                                        <a
                                            href="/api/logout"
                                            className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-(--crimson) w-full text-left"
                                            onClick={() =>
                                                setMobileMenuOpen(false)
                                            }
                                        >
                                            <LogOut className="w-5 h-5 mr-2" />
                                            Logout
                                        </a>
                                    </div>
                                </>
                            ) : (
                                <a
                                    href="/api/login"
                                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-white bg-(--crimson) hover:bg-(--crimson-700) w-full text-left"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    <User className="w-5 h-5 mr-2" />
                                    Sign In
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
