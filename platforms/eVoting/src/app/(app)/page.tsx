"use client";

import Link from "next/link";
import { Plus, Vote, BarChart3, LogOut, Eye, UserX, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { pollApi, type Poll, type PollsResponse } from "@/lib/pollApi";
import { useEffect, useState } from "react";

export default function Home() {
    const { user } = useAuth();
    const [pollsData, setPollsData] = useState<PollsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [sortField, setSortField] = useState<string>("deadline");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const itemsPerPage = 15;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const fetchPolls = async () => {
            try {
                setIsLoading(true);
                const data = await pollApi.getAllPolls(currentPage, itemsPerPage, debouncedSearchTerm, sortField, sortDirection);
                setPollsData(data);
            } catch (error) {
                console.error("Failed to fetch polls:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPolls();
    }, [currentPage, debouncedSearchTerm, sortField, sortDirection]);

    // Helper function to check if a poll is actually active (not expired)
    const isPollActive = (poll: Poll) => {
        if (!poll.deadline) return true;
        return new Date() < new Date(poll.deadline);
    };

    // Filter polls by status
    const activePolls = pollsData?.polls.filter((poll) => isPollActive(poll)) || [];
    const userPolls = pollsData?.polls.filter((poll) => poll.creatorId === user?.id) || [];
    const expiredPolls = pollsData?.polls.filter((poll) => !isPollActive(poll)) || [];

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reset to first page when searching
    };

    const getSortIcon = (field: string) => {
        if (sortField !== field) return null;
        return sortDirection === "asc" ? "↑" : "↓";
    };

    const getPollStatus = (poll: Poll) => {
        return isPollActive(poll) ? "active" : "ended";
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Welcome to eVoting
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                    Create votes, gather responses, and view results in
                    real-time
                </p>
            </div>

            {/* All Polls Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                            <Vote className="mr-2 h-5 w-5" />
                            All Polls
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                asChild
                                className="bg-(--crimson) text-white hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border transition-colors"
                            >
                                <Link href="/create">
                                    + Create New Poll
                                </Link>
                            </Button>
                            <Input
                                placeholder="Search poll titles..."
                                value={searchTerm}
                                onChange={handleSearch}
                                className="w-64"
                            />
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--crimson)" />
                        </div>
                    ) : !pollsData || pollsData.polls.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No polls available.
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th 
                                                className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                                                onClick={() => handleSort("title")}
                                            >
                                                Title {getSortIcon("title")}
                                            </th>
                                            <th 
                                                className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                                                onClick={() => handleSort("mode")}
                                            >
                                                Mode {getSortIcon("mode")}
                                            </th>
                                            <th 
                                                className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                                                onClick={() => handleSort("visibility")}
                                            >
                                                Visibility {getSortIcon("visibility")}
                                            </th>
                                            <th 
                                                className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                                            >
                                                Group
                                            </th>
                                            <th 
                                                className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                                                onClick={() => handleSort("status")}
                                            >
                                                Status {getSortIcon("status")}
                                            </th>
                                            <th 
                                                className="text-left py-3 px-4 font-medium text-gray-700 cursor-pointer hover:bg-gray-50"
                                                onClick={() => handleSort("deadline")}
                                            >
                                                Deadline {getSortIcon("deadline")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pollsData.polls.map((poll) => {
                                            const isActive = isPollActive(poll);
                                            return (
                                                <tr key={poll.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                    <td className="py-3 px-4">
                                                        <Link 
                                                            href={`/${poll.id}`}
                                                            className="font-medium text-gray-900 hover:text-(--crimson) transition-colors cursor-pointer"
                                                        >
                                                            {poll.title}
                                                        </Link>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {poll.mode === "normal" ? "Single Choice" : 
                                                             poll.mode === "rank" ? "Ranked" : 
                                                             poll.mode === "point" ? "Points" : "Unknown"}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant={poll.visibility === "public" ? "default" : "secondary"}>
                                                            {poll.visibility === "public" ? (
                                                                <><Eye className="w-3 h-3 mr-1" />Public</>
                                                            ) : (
                                                                <><UserX className="w-3 h-3 mr-1" />Private</>
                                                            )}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {poll.group ? (
                                                            <Badge variant="outline" className="text-xs">
                                                                {poll.group.name}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">No group</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge variant={isActive ? "success" : "warning"}>
                                                            {isActive ? "Active" : "Ended"}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-600">
                                                        {poll.deadline ? new Date(poll.deadline).toLocaleDateString() : "No deadline"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {pollsData && pollsData.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-6">
                                    <div className="text-sm text-gray-700">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pollsData.total)} of {pollsData.total} results
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="w-4 h-4 mr-1" />
                                            Previous
                                        </Button>
                                        <span className="text-sm text-gray-700">
                                            Page {currentPage} of {pollsData.totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === pollsData.totalPages}
                                        >
                                            Next
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
