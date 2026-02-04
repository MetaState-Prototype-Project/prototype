"use client";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRightLeft } from "lucide-react";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, isLoading, isAdmin, logout } = useAuth();
    const router = useRouter();

    function handleLogout() {
        logout();
        router.push("/login");
    }

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md transform rotate-12">
                                <ArrowRightLeft className="w-6 h-6 text-white transform -rotate-12" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Emover
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                                    ADMIN
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            {children}
        </div>
    );
}

