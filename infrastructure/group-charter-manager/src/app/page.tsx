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

interface DashboardStats {
    totalCharters: number;
    activeGroups: number;
    totalMembers: number;
}

export default function Dashboard() {
    const { toast } = useToast();

    const { data: stats, isLoading: statsLoading } = {
        data: null,
        isLoading: false,
    }; // TODO: Replace with api call to get dashboard stats

    const { data: charters, isLoading: chartersLoading } = {
        data: null,
        isLoading: false,
    }; // TODO: Replace with api call to get charters

    const { data: groups, isLoading: groupsLoading } = {
        data: null,
        isLoading: false,
    }; // TODO: Replace with api call to get groups

    if (statsLoading || chartersLoading || groupsLoading) {
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
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 sm:mb-6">
                    <div className="mb-4 lg:mb-0">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                            Your Dashboard
                        </h2>
                        <p className="text-gray-600 text-sm sm:text-base">
                            Manage all your group charters in one place
                        </p>
                    </div>
                </div>
            </div>

            {/* Your Charters */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-6">
                    Your Charters
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {charters?.map((charter) => (
                        <CharterCard key={charter.id} charter={charter} />
                    ))}
                </div>
            </div>

            {/* Your Groups */}
            <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-6">
                    Your Groups
                </h3>
                <Card className="bg-white/70 backdrop-blur-sm rounded-3xl soft-shadow">
                    <CardContent className="p-6">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                                            Group Name
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                                            Platform
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                                            Charter Status
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {groups?.map((group) => (
                                        <tr
                                            key={group.id}
                                            className="hover:bg-gray-50/50 transition-colors duration-200"
                                        >
                                            <td className="py-3 px-4">
                                                <p className="font-medium text-gray-800">
                                                    {group.name}
                                                </p>
                                            </td>
                                            <td className="py-3 px-4">
                                                <PlatformBadge
                                                    platform={group.platform}
                                                />
                                            </td>
                                            <td className="py-3 px-4">
                                                {group.charter ? (
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                                                        <Badge className="bg-green-100 text-green-700 font-medium">
                                                            Live
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                                        <Badge className="bg-gray-100 text-gray-600 font-medium">
                                                            No Charter
                                                        </Badge>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <span className="sr-only">
                                                                Open menu
                                                            </span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {group.charter ? (
                                                            <>
                                                                <DropdownMenuItem
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        href={`/charter/${group.charter.id}`}
                                                                    >
                                                                        <Eye className="mr-2 h-4 w-4" />
                                                                        View
                                                                        Charter
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit Charter
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="text-red-600">
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                    Charter
                                                                </DropdownMenuItem>
                                                            </>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                asChild
                                                            >
                                                                <Link href="/create">
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    Create
                                                                    Charter
                                                                </Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
