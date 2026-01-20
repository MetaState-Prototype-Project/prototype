import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { clearAuth } from "@/lib/authUtils";
import { apiClient } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import OtherCalculationModal from "@/components/modals/other-calculation-modal";
import ReferenceModal from "@/components/modals/reference-modal";
import ReferenceViewModal from "@/components/modals/reference-view-modal";

export default function Dashboard() {
    const { user, isAuthenticated, isLoading } = useAuth();
    const [otherModalOpen, setOtherModalOpen] = useState(false);
    const [referenceModalOpen, setReferenceModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [referenceViewModal, setReferenceViewModal] = useState<any>(null);
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);

    // This page is only rendered when authenticated, no need for redirect logic

    const { data: stats } = useQuery<{ totalReferences: string }>({
        queryKey: ["/api/dashboard/stats"],
        queryFn: async () => {
            const response = await apiClient.get("/api/dashboard/stats");
            return response.data;
        },
        enabled: isAuthenticated,
    });

    const { data: activitiesResponse, refetch: refetchActivities } = useQuery<{
        activities: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>({
        queryKey: ["/api/dashboard/activities", currentPage, activeFilter],
        queryFn: async () => {
            const response = await apiClient.get(`/api/dashboard/activities?page=${currentPage}&filter=${activeFilter}`);
            return response.data;
        },
        enabled: isAuthenticated,
        refetchOnWindowFocus: true,
        refetchInterval: 5000, // Poll every 5 seconds for updates
        staleTime: 0, // Always consider data stale
    });

    const activities = activitiesResponse?.activities || [];
    const pagination = activitiesResponse?.pagination;

    const handleLogout = () => {
        clearAuth();
        window.location.href = "/auth";
    };

    const handleViewActivity = (activity: any) => {
        // For reference activities, show reference details modal
        if (activity.type === 'reference' || activity.activity === 'Reference Provided' || activity.activity === 'Reference Received') {
            const referenceData = activity.data; // This contains the full reference object
            setReferenceViewModal({
                id: activity.id,
                type: activity.activity === 'Reference Received' ? 'Received' : 'Sent',
                forFrom: activity.activity === 'Reference Received'
                    ? (activity.data?.author?.name || activity.data?.author?.ename || activity.data?.author?.handle || 'Unknown')
                    : activity.target,
                date: new Date(activity.date).toLocaleDateString(),
                status: activity.status || 'Signed',
                referenceType: referenceData?.referenceType || 'general',
                content: referenceData?.content || 'Reference content not available',
                targetType: referenceData?.targetType || 'user'
            });
            return;
        }

        // For calculation activities, show the original details modal
        // Double-check this is not a reference (shouldn't happen, but safety check)
        if (activity.type === 'reference' || activity.activity === 'Reference Provided' || activity.activity === 'Reference Received') {
            // This shouldn't happen, but if it does, show reference modal instead
            const referenceData = activity.data;
            setReferenceViewModal({
                id: activity.id,
                type: activity.activity === 'Reference Received' ? 'Received' : 'Sent',
                forFrom: activity.activity === 'Reference Received'
                    ? (activity.data?.author?.name || activity.data?.author?.ename || activity.data?.author?.handle || 'Unknown')
                    : activity.target,
                date: new Date(activity.date).toLocaleDateString(),
                status: activity.status || 'Signed',
                referenceType: referenceData?.referenceType || 'general',
                content: referenceData?.content || 'Reference content not available',
                targetType: referenceData?.targetType || 'user'
            });
            return;
        }

        setSelectedActivity(activity);
        setViewModalOpen(true);
    };


    // Number counting animation hook
    const useCountUp = (end: number, duration: number = 2000) => {
        const [count, setCount] = useState(0);

        useEffect(() => {
            if (end === 0) return;

            let startTime: number;
            let animationFrame: number;

            const animate = (currentTime: number) => {
                if (!startTime) startTime = currentTime;
                const progress = Math.min((currentTime - startTime) / duration, 1);

                setCount(Math.floor(progress * end));

                if (progress < 1) {
                    animationFrame = requestAnimationFrame(animate);
                }
            };

            animationFrame = requestAnimationFrame(animate);

            return () => {
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                }
            };
        }, [end, duration]);

        return count;
    };

    const totalReferences = parseInt(stats?.totalReferences || "0");
    const animatedReferences = useCountUp(totalReferences, 600);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "complete":
                return <Badge className="bg-green-100 text-green-800">Complete</Badge>;
            case "processing":
                return <Badge className="bg-yellow-100 text-yellow-800">Processing</Badge>;
            case "submitted":
                return <Badge className="bg-green-100 text-green-800">Submitted</Badge>;
            case "error":
                return <Badge className="bg-red-100 text-red-800">Error</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
        }
    };

    // Helper function to get the display result from an activity
    const getActivityResult = (activity: any): string => {
        if (activity.result && activity.result !== 'Calculating...') {
            return activity.result;
        }

        // If status is complete and we have calculatedScore in data (including 0)
        if (activity.status === 'complete' && activity.data?.calculatedScore !== undefined) {
            return `Score: ${activity.data.calculatedScore}/5`;
        }

        return 'Calculating...';
    };

    // Helper function to get score color based on percentage
    const getScoreTheme = (result: string | undefined | null) => {
        // 1. Handle empty states early
        if (!result) {
            return {
                text: 'text-gray-500',
                border: '#6b7280',
                bg: '#f9fafb',
                label: 'Calculating...'
            };
        }

        // 2. Parse score
        const score = parseFloat(result.replace('Score: ', '')) || 0;
        const percentage = (score / 5) * 100;

        // 3. Define theme mapping
        if (percentage <= 25) return { text: 'text-red-500', border: '#ef4444', bg: '#fef2f2', label: result };
        if (percentage <= 50) return { text: 'text-orange-500', border: '#f97316', bg: '#fff7ed', label: result };
        if (percentage <= 75) return { text: 'text-yellow-600', border: '#eab308', bg: '#fefce8', label: result };

        return { text: 'text-green-500', border: '#22c55e', bg: '#f0fdf4', label: result };
    };

    const getActivityIconClass = (activity: any) => {
        const activityType = activity.activity || activity;
        const type = activity.type;

        if (activityType === 'Self eReputation' || activityType === 'Self Calculation' || activityType === 'Self Evaluation') {
            return 'bg-gradient-to-br from-orange-500/15 to-orange-500/10 border-orange-500/20 text-orange-600';
        }
        if (activityType === 'Other Evaluation' || activityType === 'User Evaluation') {
            return 'bg-gradient-to-br from-green-500/15 to-green-500/10 border-green-500/20 text-green-600';
        }
        if (activityType === 'Group Evaluation') {
            return 'bg-gradient-to-br from-blue-500/15 to-blue-500/10 border-blue-500/20 text-blue-600';
        }
        if (activityType === 'Platform Analysis' || activityType === 'Post-Platform Evaluation') {
            return 'bg-gradient-to-br from-purple-500/15 to-purple-500/10 border-purple-500/20 text-purple-600';
        }
        if (activityType === 'Reference Provided' || activityType === 'Reference Received' || type === 'reference') {
            return 'bg-gradient-to-br from-green-500/15 to-green-500/10 border-green-500/20 text-green-600';
        }
        return 'bg-gradient-to-br from-gray-500/15 to-gray-500/10 border-gray-500/20 text-gray-600';
    };

    const getActivityIcon = (activity: string) => {
        switch (activity) {
            case "Self Calculation":
            case "Self eReputation":
            case "Self Evaluation":
                return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4-3a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z" clipRule="evenodd" /></svg>;
            case "Other Evaluation":
            case "User Evaluation":
                return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>;
            case "Group Evaluation":
                return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>;
            case "Platform Analysis":
            case "Post-Platform Evaluation":
                return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" /></svg>;
            case "Reference Provided":
                return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;
            case "Reference Received":
                return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>;
            default:
                return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-fig border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
            {/* Navigation Header */}
            <nav className="bg-gradient-to-br from-white via-gray-50 to-white text-gray-900 shadow-xl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 flex items-center gap-3">
                                <div className="w-10 h-10 bg-fig rounded-xl flex items-center justify-center shadow-lg transform rotate-12 border-2 border-swiss-cheese/30">
                                    <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                </div>
                                <div className="flex flex-col">
                                    <h1 className="text-xl font-black tracking-tight text-gray-900">eReputation</h1>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                                        <div className="hidden sm:block text-left">
                                            <div className="font-semibold text-sm text-gray-900">
                                                {user?.name || user?.handle || user?.ename || 'User'}
                                            </div>
                                            {user?.ename && user.name && (
                                                <div className="text-xs text-gray-500">@{user.ename}</div>
                                            )}
                                        </div>
                                        <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem onClick={handleLogout}>
                                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                                        </svg>
                                        Logout
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* Dashboard Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-gray-900">Dashboard</h2>
                        <p className="text-gray-700 mt-2 text-sm sm:text-base font-medium">Manage and monitor your W3DS eReputation</p>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 gap-3 sm:gap-4 w-full lg:w-auto">
                        <div className="!bg-fig rounded-xl p-4 sm:p-6 shadow-lg border border-fig/20 w-full h-24 sm:h-28 flex flex-col justify-between overflow-hidden" style={{ backgroundColor: '#4C3F54' }}>
                            <div className="text-xs sm:text-sm text-white/80 font-medium">Total eReferences</div>
                            <div className="text-xl sm:text-3xl font-black text-white">
                                {animatedReferences}
                            </div>
                            <div className="flex items-center">
                                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-white/20 rounded-lg flex items-center justify-center shadow-sm transform rotate-12 border border-swiss-cheese/30 mr-1">
                                    <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                </div>
                                <span className="text-xs text-white/70">received</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 sm:gap-6 mb-8 items-center">
                    <button
                        onClick={() => setOtherModalOpen(true)}
                        className="group bg-secondary hover:bg-fig/30 border-2 border-secondary/40 hover:border-fig p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 h-32 w-full max-w-sm sm:max-w-none"
                    >
                        <div className="flex items-center gap-3 h-full">
                            <div className="w-12 h-12 bg-fig rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 transform rotate-12">
                                <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="text-left min-w-0 flex-1">
                                <h3 className="font-black text-lg mb-1 text-fig leading-tight">Calculate Others eReputation</h3>
                                <p className="text-fig/70 text-sm font-medium leading-tight">Calculate the eReputation of users, groups, and post-platforms</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => setReferenceModalOpen(true)}
                        className="group bg-secondary hover:bg-fig/30 border-2 border-secondary/40 hover:border-fig p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 h-32 w-full max-w-sm sm:max-w-none"
                    >
                        <div className="flex items-center gap-3 h-full">
                            <div className="w-12 h-12 bg-fig rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 transform rotate-12">
                                <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="text-left min-w-0 flex-1">
                                <h3 className="font-black text-lg mb-1 text-fig leading-tight">Send an eReference</h3>
                                <p className="text-fig/70 text-sm font-medium leading-tight">Provide a signed eReference to a user, group, or post-platform</p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Activity History Table */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 sm:px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-fig/5 to-white">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-fig">Recent Activity</h3>
                                <p className="text-gray-700 text-sm mt-2 font-medium">Your latest eReputation activities and calculations</p>
                            </div>

                            {/* Quick Filters */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => {
                                        setActiveFilter('all');
                                        setCurrentPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === 'all'
                                        ? 'bg-fig text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveFilter('sent-references');
                                        setCurrentPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === 'sent-references'
                                        ? 'bg-fig text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Sent References
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveFilter('received-references');
                                        setCurrentPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === 'received-references'
                                        ? 'bg-fig text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Received
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveFilter('analysis');
                                        setCurrentPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === 'analysis'
                                        ? 'bg-fig text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Analysis
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveFilter('self-evaluation');
                                        setCurrentPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === 'self-evaluation'
                                        ? 'bg-fig text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Self Evaluation
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveFilter('other-evaluations');
                                        setCurrentPage(1);
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeFilter === 'other-evaluations'
                                        ? 'bg-fig text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Other Evaluations
                                </button>
                            </div>
                        </div>
                    </div>

                    {activities.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-24 h-24 bg-gradient-to-br from-fig/10 to-apple-red/10 rounded-2xl flex items-center justify-center">
                                    <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-gray-700 mb-2">
                                        {activeFilter !== 'all' ? 'No activities match this filter' : 'No activities yet'}
                                    </p>
                                    <p className="text-gray-500">
                                        {activeFilter !== 'all'
                                            ? 'Try selecting a different filter or clear filters to see all activities'
                                            : 'Start by calculating your reputation or providing a reference'}
                                    </p>
                                </div>
                                {activeFilter !== 'all' ? (
                                    <button
                                        onClick={() => {
                                            setActiveFilter('all');
                                            setCurrentPage(1);
                                        }}
                                        className="px-4 py-2 bg-fig text-white rounded-lg font-medium hover:bg-fig/90 transition-colors"
                                    >
                                        Show All Activities
                                    </button>
                                ) : (
                                    <div className="flex flex-wrap gap-3 mt-4">
                                        <button
                                            onClick={() => setReferenceModalOpen(true)}
                                            className="px-4 py-2 bg-basil text-white rounded-lg font-medium hover:bg-basil/90 transition-colors"
                                        >
                                            Provide Reference
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gradient-to-r from-fig/10 to-fig/5">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/3">Evaluation Type</th>
                                            <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/4">Context</th>
                                            <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/6">Date</th>
                                            <th className="px-6 py-4 text-left text-xs font-black text-fig uppercase tracking-wider w-1/6">Status</th>
                                            <th className="px-6 py-4 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {activities.map((activity: any) => (
                                            <tr key={`${activity.type}-${activity.id}`} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${getActivityIconClass(activity)}`}>
                                                            {getActivityIcon(activity.activity)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-fig">{activity.activity}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                    {activity.activity === 'Reference Received'
                                                        ? `From ${activity.target || 'Unknown'}`
                                                        : activity.activity === 'Reference Provided'
                                                            ? `To ${activity.target || 'Unknown'}`
                                                            : activity.target || 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(activity.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {activity.type === 'reference' || activity.activity === 'Reference Provided' || activity.activity === 'Reference Received' ? (
                                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black bg-white border-2 w-20 h-7"
                                                            style={{
                                                                borderColor: activity.status === 'Revoked' ? '#ef4444' : '#22c55e',
                                                                backgroundColor: activity.status === 'Revoked' ? '#fef2f2' : '#f0fdf4',
                                                                color: activity.status === 'Revoked' ? '#dc2626' : '#15803d'
                                                            }}>
                                                            {activity.status === 'Revoked' ? 'revoked' : activity.status === 'Signed' ? 'signed' : 'signed'}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black w-20 h-7 border-2 ${getScoreTheme(getActivityResult(activity)).text}`}
                                                            style={{
                                                                borderColor: getScoreTheme(getActivityResult(activity)).border,
                                                                backgroundColor: getScoreTheme(getActivityResult(activity)).bg
                                                            }}
                                                        >
                                                            {getActivityResult(activity)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="text-gray-400 hover:text-gray-500 p-1 rounded">
                                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                                </svg>
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleViewActivity(activity)}>
                                                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                                </svg>
                                                                View Details
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="sm:hidden space-y-4 px-4 py-4">
                                {activities.map((activity: any) => (
                                    <div key={`${activity.type}-${activity.id}`} className="bg-white rounded-xl p-4 shadow-lg ring-1 ring-black ring-opacity-5">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3 flex-1">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${getActivityIconClass(activity)}`}>
                                                    {getActivityIcon(activity.activity)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-fig mb-1">{activity.activity}</div>
                                                    <div className="text-xs text-gray-600 font-medium">
                                                        {activity.activity === 'Reference Received'
                                                            ? `From ${activity.target || 'Unknown'}`
                                                            : activity.activity === 'Reference Provided'
                                                                ? `To ${activity.target || 'Unknown'}`
                                                                : activity.target || 'Unknown'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                            </svg>
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleViewActivity(activity)}>
                                                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                            </svg>
                                                            View Details
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-xs text-gray-500">{new Date(activity.date).toLocaleDateString()}</div>
                                                    {activity.type === 'reference' || activity.activity === 'Reference Provided' || activity.activity === 'Reference Received' ? (
                                                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-black bg-white border-2"
                                                            style={{
                                                                borderColor: activity.status === 'Revoked' ? '#ef4444' : '#22c55e',
                                                                backgroundColor: activity.status === 'Revoked' ? '#fef2f2' : '#f0fdf4',
                                                                color: activity.status === 'Revoked' ? '#dc2626' : '#15803d'
                                                            }}>
                                                            {activity.status === 'Revoked' ? 'revoked' : activity.status === 'Signed' ? 'signed' : 'signed'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-black bg-white border-2"
                                                            style={{
                                                                borderColor: getScoreTheme(getActivityResult(activity)).border,
                                                                backgroundColor: getScoreTheme(getActivityResult(activity)).bg
                                                            }}>
                                                            {getActivityResult(activity).replace('Score: ', '')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {pagination && pagination.totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-gray-200">
                                    <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
                                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(pagination.page - 1)}
                                            disabled={!pagination.hasPrev}
                                            className="border-fig/30 text-fig hover:bg-fig-10 text-xs sm:text-sm px-2 sm:px-3"
                                        >
                                            Previous
                                        </Button>
                                        <span className="text-xs sm:text-sm text-gray-600 px-1 sm:px-2">
                                            Page {pagination.page} of {pagination.totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(pagination.page + 1)}
                                            disabled={!pagination.hasNext}
                                            className="border-fig/30 text-fig hover:bg-fig-10 text-xs sm:text-sm px-2 sm:px-3"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            <OtherCalculationModal open={otherModalOpen} onOpenChange={setOtherModalOpen} />
            <ReferenceModal open={referenceModalOpen} onOpenChange={setReferenceModalOpen} />

            {/* Reference View Modal */}
            <ReferenceViewModal
                open={!!referenceViewModal}
                onOpenChange={(open) => !open && setReferenceViewModal(null)}
                reference={referenceViewModal}
            />

            {/* Activity Details Modal - Only for calculations, not references */}
            <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
                <DialogContent className="sm:max-w-lg bg-gradient-to-br from-white to-gray-50 border-2 border-fig/20 max-h-[85vh] flex flex-col">
                    <DialogHeader className="text-center pb-6 flex-shrink-0">
                        <DialogTitle className="flex items-center justify-center gap-3 text-fig text-xl font-black">
                            <div className="w-8 h-8 bg-fig rounded-lg flex items-center justify-center transform rotate-12">
                                <svg className="w-5 h-5 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            </div>
                            {selectedActivity
                                ? ((selectedActivity as any).target === 'Personal Profile'
                                    ? "Your eReputation"
                                    : `${(selectedActivity as any).target} eReputation`)
                                : "Activity Details"}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedActivity && (selectedActivity as any).type !== 'reference' && (selectedActivity as any).activity !== 'Reference Provided' && (selectedActivity as any).activity !== 'Reference Received' ? (
                        <div className="space-y-6 overflow-y-auto flex-1">

                            {/* Score Visualization */}
                            <div className="bg-gradient-to-br from-fig/5 to-apple-red/5 rounded-2xl p-6 border border-fig/10">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-black text-fig">Reputation Score</h3>
                                    <span className="text-2xl font-black text-fig">
                                        {getActivityResult(selectedActivity as any)}
                                    </span>
                                </div>

                                {/* Animated Circle Progress with Dynamic Gradient */}
                                <div className="relative w-32 h-32 mx-auto mb-4">
                                    {(() => {
                                        const resultStr = getActivityResult(selectedActivity as any);
                                        const score = parseFloat(resultStr.replace('Score: ', '')) || 0;
                                        const percentage = (score / 5) * 100; // Scores are out of 5, not 10
                                        const circumference = 314;
                                        const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

                                        // Create dynamic gradient ID based on score
                                        const gradientId = `scoreGradient${Math.round(percentage)}`;

                                        // Determine gradient stops based on score percentage - ALWAYS starts with red
                                        let gradientStops = [];
                                        if (percentage <= 25) {
                                            // 0-25%: Red only
                                            gradientStops = [
                                                { offset: "0%", color: "#ef4444" },
                                                { offset: "100%", color: "#ef4444" }
                                            ];
                                        } else if (percentage <= 50) {
                                            // 25-50%: Red to orange
                                            gradientStops = [
                                                { offset: "0%", color: "#ef4444" },
                                                { offset: "100%", color: "#f97316" }
                                            ];
                                        } else if (percentage <= 75) {
                                            // 50-75%: Red to orange to yellow
                                            gradientStops = [
                                                { offset: "0%", color: "#ef4444" },
                                                { offset: "50%", color: "#f97316" },
                                                { offset: "100%", color: "#eab308" }
                                            ];
                                        } else {
                                            // 75-100%: Red to orange to yellow to green
                                            gradientStops = [
                                                { offset: "0%", color: "#ef4444" },
                                                { offset: "33%", color: "#f97316" },
                                                { offset: "66%", color: "#eab308" },
                                                { offset: "100%", color: "#22c55e" }
                                            ];
                                        }

                                        // Calculate the path coordinates for the arc
                                        const radius = 50;
                                        const centerX = 60;
                                        const centerY = 60;
                                        const startAngle = -90; // Start at top (12 o'clock)
                                        const endAngle = startAngle + (percentage * 3.6); // 3.6 degrees per percent

                                        // Convert to radians
                                        const startRad = (startAngle * Math.PI) / 180;
                                        const endRad = (endAngle * Math.PI) / 180;

                                        // Calculate arc path
                                        const startX = centerX + radius * Math.cos(startRad);
                                        const startY = centerY + radius * Math.sin(startRad);
                                        const endX = centerX + radius * Math.cos(endRad);
                                        const endY = centerY + radius * Math.sin(endRad);

                                        const largeArcFlag = percentage > 50 ? 1 : 0;

                                        return (
                                            <svg className="w-32 h-32" viewBox="0 0 120 120">
                                                {/* Background circle */}
                                                <circle
                                                    cx="60"
                                                    cy="60"
                                                    r="50"
                                                    stroke="#e5e7eb"
                                                    strokeWidth="12"
                                                    fill="transparent"
                                                    className="opacity-30"
                                                />

                                                <defs>
                                                    {/* Path-following gradient using coordinates */}
                                                    <linearGradient
                                                        id={gradientId}
                                                        x1={startX}
                                                        y1={startY}
                                                        x2={endX}
                                                        y2={endY}
                                                        gradientUnits="userSpaceOnUse"
                                                    >
                                                        {percentage <= 25 ? (
                                                            // Red only
                                                            <>
                                                                <stop offset="0%" stopColor="#ef4444" />
                                                                <stop offset="100%" stopColor="#ef4444" />
                                                            </>
                                                        ) : percentage <= 50 ? (
                                                            // Red to orange
                                                            <>
                                                                <stop offset="0%" stopColor="#ef4444" />
                                                                <stop offset="100%" stopColor="#f97316" />
                                                            </>
                                                        ) : percentage <= 75 ? (
                                                            // Red to orange to yellow
                                                            <>
                                                                <stop offset="0%" stopColor="#ef4444" />
                                                                <stop offset="50%" stopColor="#f97316" />
                                                                <stop offset="100%" stopColor="#eab308" />
                                                            </>
                                                        ) : (
                                                            // Full gradient - red to orange to yellow to green
                                                            <>
                                                                <stop offset="0%" stopColor="#ef4444" />
                                                                <stop offset="25%" stopColor="#f97316" />
                                                                <stop offset="75%" stopColor="#eab308" />
                                                                <stop offset="100%" stopColor="#22c55e" />
                                                            </>
                                                        )}
                                                    </linearGradient>
                                                </defs>

                                                {/* Progress arc with gradient following the path */}
                                                <path
                                                    d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`}
                                                    stroke={`url(#${gradientId})`}
                                                    strokeWidth="12"
                                                    fill="transparent"
                                                    strokeLinecap="round"
                                                    className="transition-all duration-2000 ease-out drop-shadow-lg"
                                                    style={{
                                                        strokeDasharray: viewModalOpen ? 'none' : `0 ${circumference}`,
                                                        animation: viewModalOpen ? 'drawArc 2s ease-out forwards' : 'none',
                                                    }}
                                                />
                                            </svg>
                                        );
                                    })()}

                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-black text-fig">
                                            {Math.round(((parseFloat(((selectedActivity as any).result || '').replace('Score: ', '')) || 0) / 5) * 100)}%
                                        </span>
                                        <span className="text-xs font-medium text-gray-500 mt-1">SCORE</span>
                                    </div>
                                </div>
                            </div>

                            {/* AI Explanation/Justification */}
                            {(selectedActivity as any).explanation && (
                                <div className="bg-fig-10 rounded-xl p-4 border-2 border-fig/20">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 bg-fig/20 rounded-lg flex items-center justify-center">
                                            <svg className="w-3 h-3 text-fig" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <label className="text-xs font-bold text-fig uppercase tracking-wider">Score Justification</label>
                                    </div>
                                    <p className="text-sm text-fig/90 leading-relaxed whitespace-pre-wrap">
                                        {(selectedActivity as any).explanation}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-gray-200">
                                <Button
                                    onClick={() => setViewModalOpen(false)}
                                    className="w-full bg-fig hover:bg-fig/90 text-white font-bold"
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    ) : selectedActivity ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500">This activity is a reference, not a calculation.</p>
                            <Button
                                onClick={() => {
                                    setViewModalOpen(false);
                                    setSelectedActivity(null);
                                }}
                                className="mt-4"
                            >
                                Close
                            </Button>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}
