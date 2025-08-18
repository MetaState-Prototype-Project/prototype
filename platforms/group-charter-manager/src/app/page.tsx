"use client";

import Link from "next/link";
import {
    Plus,
    Eye,
    Edit,
    Scroll,
    Users,
    UserPlus,
    Download,
    MoreHorizontal,
    Trash2,
    LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import StatsCard from "@/components/stats-card";
import CharterCard from "@/components/charter-card";
import { PlatformBadge } from "@/components/platform-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";

interface DashboardStats {
    totalCharters: number;
    activeGroups: number;
    totalMembers: number;
}

interface Group {
    id: string;
    name: string;
    description: string;
    owner: string;
    admins: string[];
    participants: any[];
    charter?: string; // Add charter field
    createdAt: string;
    updatedAt: string;
}

export default function Dashboard() {
    const { toast } = useToast();
    const { user, logout } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [groupsLoading, setGroupsLoading] = useState(true);
    const [groupsError, setGroupsError] = useState<string | null>(null);

    // Fetch groups on component mount
    useEffect(() => {
        if (user) {
            fetchGroups();
        }
    }, [user]);

    const fetchGroups = async () => {
        try {
            setGroupsLoading(true);
            setGroupsError(null);
            const response = await apiClient.get('/api/groups/my');
            setGroups(response.data);
        } catch (error) {
            console.error('Failed to fetch groups:', error);
            setGroupsError('Failed to load groups');
            toast({
                title: "Error",
                description: "Failed to load groups",
                variant: "destructive",
            });
        } finally {
            setGroupsLoading(false);
        }
    };

    // Filter groups that have charters
    const charters = groups.filter(group => group.charter && group.charter.trim() !== '');
    const chartersLoading = groupsLoading;

    // Calculate stats from groups data
    const stats = {
        totalCharters: charters.length,
        activeGroups: groups.length,
        totalMembers: groups.reduce((total, group) => total + (group.participants?.length || 0), 0)
    };
    const statsLoading = groupsLoading;

    if (statsLoading || chartersLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-black bg-opacity-10 rounded w-1/4" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-24 bg-black bg-opacity-10 rounded-3xl"
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case "instagram":
                return "fab fa-instagram";
            case "facebook":
                return "fab fa-facebook";
            case "discord":
                return "fab fa-discord";
            default:
                return "fas fa-globe";
        }
    };

    const getPlatformColor = (platform: string) => {
        switch (platform) {
            case "instagram":
                return "bg-pink-100 text-pink-700";
            case "facebook":
                return "bg-blue-100 text-blue-700";
            case "discord":
                return "bg-purple-100 text-purple-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header Section */}
            <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                            Group Charter Manager
                        </h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Welcome back, {user?.name || user?.ename || 'User'}! Manage your group charters and memberships.
                        </p>
                    </div>
                    <div className="mt-4 sm:mt-0 flex items-center gap-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Users className="h-4 w-4 mr-2" />
                                    {user?.name || user?.ename || 'User'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={logout}>
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link href="/create">
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                New Charter
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatsCard
                    title="Total Charters"
                    value={stats?.totalCharters || 0}
                    icon={Scroll}
                    trend="+12%"
                    trendDirection="up"
                />
                <StatsCard
                    title="Active Groups"
                    value={groups.length}
                    icon={Users}
                    trend="+5%"
                    trendDirection="up"
                />
                <StatsCard
                    title="Total Members"
                    value={stats?.totalMembers || 0}
                    icon={UserPlus}
                    trend="+8%"
                    trendDirection="up"
                />
            </div>

            {/* Charters Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Your Charters
                    </h2>
                    <Link href="/create">
                        <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Create Charter
                        </Button>
                    </Link>
                </div>

                {charters && charters.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {charters.map((group) => (
                            <Card key={group.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 mb-1">
                                                {group.name || 'Unnamed Group'}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {group.description || 'No description'}
                                            </p>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                            Charter
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">
                                            {group.participants?.length || 0} members
                                        </span>
                                        <Link href={`/charter/${group.id}`}>
                                            <Button variant="outline" size="sm">
                                                <Eye className="h-4 w-4 mr-2" />
                                                View Charter
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Scroll className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No charters yet
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Create your first group charter to get started.
                        </p>
                        <Link href="/create">
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Your First Charter
                            </Button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Groups Section */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Your Groups
                    </h2>
                </div>

                {groupsLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-6">
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : groupsError ? (
                    <div className="text-center py-12">
                        <div className="text-red-500 mb-4">
                            <Users className="h-12 w-12 mx-auto" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Error loading groups
                        </h3>
                        <p className="text-gray-600 mb-4">{groupsError}</p>
                        <Button onClick={fetchGroups} variant="outline">
                            Try Again
                        </Button>
                    </div>
                ) : groups && groups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups.map((group) => (
                            <Card key={group.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 mb-1">
                                                {group.name || 'Unnamed Group'}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {group.description || 'No description'}
                                            </p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600">
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <Users className="h-4 w-4 text-gray-400" />
                                            <span className="text-sm text-gray-600">
                                                {group.participants?.length || 0} members
                                            </span>
                                        </div>
                                        <Badge variant="secondary">
                                            {group.owner === user?.id ? 'Owner' : 'Member'}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No groups yet
                        </h3>
                        <p className="text-gray-600">
                            You haven't joined any groups yet.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
