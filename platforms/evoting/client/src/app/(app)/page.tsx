"use client";

import Link from "next/link";
import { Plus, Vote, BarChart3, LogOut, Eye, UserX, Search, ChevronLeft, ChevronRight, ChartLine, CircleUser } from "lucide-react";
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
    const [sortField, setSortField] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("evoting_sortField") || "createdAt";
        }
        return "createdAt";
    });
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">(() => {
        if (typeof window !== "undefined") {
            return (localStorage.getItem("evoting_sortDirection") as "asc" | "desc") || "desc";
        }
        return "desc";
    });
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
            const newDirection = sortDirection === "asc" ? "desc" : "asc";
            setSortDirection(newDirection);
            if (typeof window !== "undefined") {
                localStorage.setItem("evoting_sortDirection", newDirection);
            }
        } else {
            setSortField(field);
            setSortDirection("asc");
            if (typeof window !== "undefined") {
                localStorage.setItem("evoting_sortField", field);
                localStorage.setItem("evoting_sortDirection", "asc");
            }
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 px-4">
            <div className="text-center px-4">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                    Welcome to eVoting
                </h1>
                <p className="text-lg md:text-xl text-gray-600 mb-8">
                    Create votes, gather responses, and view results in
                    real-time
                </p>
            </div>

            {/* All Polls Table */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <Vote className="mr-2 h-5 w-5" />
                                All Polls
                            </div>
                            <Button
                                asChild
                                size="sm"
                                className="text-white border transition-colors md:hidden"
                                style={{ backgroundColor: 'var(--crimson)' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--crimson-50)';
                                    e.currentTarget.style.color = 'var(--crimson)';
                                    e.currentTarget.style.borderColor = 'var(--crimson)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--crimson)';
                                    e.currentTarget.style.color = 'white';
                                }}
                            >
                                <Link href="/create">
                                    <Plus className="w-4 h-4" />
                                </Link>
                            </Button>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-2">
                            <Input
                                placeholder="Search poll titles..."
                                value={searchTerm}
                                onChange={handleSearch}
                                className="flex-1 md:max-w-xs"
                            />
                            <Button
                                asChild
                                className="hidden md:flex text-white border transition-colors"
                                style={{ backgroundColor: 'var(--crimson)' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--crimson-50)';
                                    e.currentTarget.style.color = 'var(--crimson)';
                                    e.currentTarget.style.borderColor = 'var(--crimson)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--crimson)';
                                    e.currentTarget.style.color = 'white';
                                }}
                            >
                                <Link href="/create">
                                    + Create New Poll
                                </Link>
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--crimson)' }} />
                        </div>
                    ) : !pollsData || pollsData.polls.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No polls available.
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                                {pollsData.polls.map((poll) => {
                                    const isActive = isPollActive(poll);
                                    return (
                                        <Link
                                            key={poll.id}
                                            href={`/${poll.id}`}
                                            className="block p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="font-medium text-gray-900 flex-1 pr-2">
                                                    {poll.title}
                                                </h3>
                                                <Badge variant={isActive ? "success" : "warning"} className="shrink-0">
                                                    {isActive ? "Active" : "Ended"}
                                                </Badge>
                                            </div>

                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {poll.mode === "normal" ? "Single Choice" :
                                                        poll.mode === "rank" ? "Ranked" :
                                                            poll.mode === "point" ? "Points" : "Unknown"}
                                                </Badge>
                                                <Badge variant={poll.visibility === "public" ? "default" : "secondary"}>
                                                    {poll.visibility === "public" ? (
                                                        <><Eye className="w-3 h-3 mr-1" />Public</>
                                                    ) : (
                                                        <><UserX className="w-3 h-3 mr-1" />Private</>
                                                    )}
                                                </Badge>
                                                <Badge variant={poll.votingWeight === "ereputation" ? "default" : "secondary"} className="text-xs">
                                                    {poll.votingWeight === "ereputation" ? (
                                                        <><ChartLine className="w-3 h-3 mr-1" />eRep</>
                                                    ) : (
                                                        <><CircleUser className="w-3 h-3 mr-1" />1P1V</>
                                                    )}
                                                </Badge>
                                                {poll.group && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {poll.group.name}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="text-xs text-gray-500">
                                                {poll.deadline ? `Deadline: ${new Date(poll.deadline).toLocaleDateString()}` : "No deadline"}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
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
                                                Voting Weight
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
                                                            className="font-medium text-gray-900 transition-colors cursor-pointer hover:text-[var(--crimson)]"
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
                                                        <Badge variant={poll.votingWeight === "ereputation" ? "default" : "secondary"} className="text-xs">
                                                            {poll.votingWeight === "ereputation" ? (
                                                                <><ChartLine className="w-3 h-3 mr-1" />eReputation Weighted</>
                                                            ) : (
                                                                <><CircleUser className="w-3 h-3 mr-1" />1P 1V</>
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
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
                                    <div className="text-sm text-gray-700 text-center md:text-left">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pollsData.total)} of {pollsData.total} results
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="w-4 h-4 md:mr-1" />
                                            <span className="hidden md:inline">Previous</span>
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
                                            <span className="hidden md:inline">Next</span>
                                            <ChevronRight className="w-4 h-4 md:ml-1" />
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
