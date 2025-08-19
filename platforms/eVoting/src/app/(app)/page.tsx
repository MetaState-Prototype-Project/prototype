"use client";

import Link from "next/link";
import { Plus, Vote, BarChart3, LogOut, Eye, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { pollApi, type Poll } from "@/lib/pollApi";
import { useEffect, useState } from "react";

type PollOption = {
    id: string;
    label: string;
    votes: number;
};

export default function Home() {
    const { user } = useAuth();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPolls = async () => {
            try {
                const fetchedPolls = await pollApi.getAllPolls();
                setPolls(fetchedPolls);
            } catch (error) {
                console.error("Failed to fetch polls:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPolls();
    }, []);

    // Helper function to check if a poll is actually active (not expired)
    const isPollActive = (poll: Poll) => {
        if (!poll.deadline) return true;
        return new Date() < new Date(poll.deadline);
    };

    // Filter polls
    const activePolls = polls.filter((poll) => isPollActive(poll));
    const userPolls = polls.filter((poll) => poll.creatorId === user?.id);
    const expiredPolls = polls.filter((poll) => !isPollActive(poll));

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    Welcome to eVoting
                </h1>
                <p className="text-xl text-gray-600 mb-8">
                    Create votes, gather responses, and view results in
                    real-time
                </p>
            </div>

            {/* Create Vote Action - Desktop only 40% width */}
            <div className="flex justify-center">
                <Card className="w-full md:max-w-[40%]">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Plus className="mr-2 h-5 w-5" />
                            Create New Vote
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 mb-4">
                            Create a new vote with custom options and voting
                            modes
                        </p>
                        <Button
                            asChild
                            className="w-full bg-(--crimson) text-white hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border transition-colors"
                        >
                            <Link href="/create">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Vote
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Active Votes to Vote On */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Vote className="mr-2 h-5 w-5" />
                        Active Votes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--crimson)" />
                        </div>
                    ) : activePolls.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            No active votes available for voting.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {activePolls.map((poll) => {
                                const isActive = isPollActive(poll);
                                return (
                                    <Card
                                        key={poll.id}
                                        className="hover:shadow-lg transition-shadow"
                                    >
                                        <CardContent className="p-4">
                                            <div className="space-y-3">
                                                <h3 className="font-semibold text-gray-900">
                                                    {poll.title}
                                                </h3>
                                                <div className="flex items-center space-x-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-xs"
                                                    >
                                                        {poll.mode === "normal" ? "Single Choice" : 
                                                         poll.mode === "rank" ? "Ranked" : 
                                                         poll.mode === "point" ? "Points" : "Unknown"}
                                                    </Badge>
                                                    <Badge
                                                        variant={
                                                            poll.visibility ===
                                                            "public"
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {poll.visibility ===
                                                        "public" ? (
                                                            <>
                                                                <Eye className="w-3 h-3 mr-1" />
                                                                Public
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserX className="w-3 h-3 mr-1" />
                                                                Private
                                                            </>
                                                        )}
                                                    </Badge>
                                                    <Badge
                                                        variant={
                                                            isActive
                                                                ? "success"
                                                                : "warning"
                                                        }
                                                    >
                                                        {isActive
                                                            ? "Active"
                                                            : "Ended"}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {poll.mode === "rank" 
                                                        ? `${poll.votes?.length || 0} points` 
                                                        : `${poll.votes?.length || 0} votes`}
                                                </div>
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    className="w-full bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white"
                                                >
                                                    <Link
                                                        href={`/${poll.id}`}
                                                    >
                                                        View Vote
                                                    </Link>
                                                </Button>
                                                {poll.deadline && (
                                                    <div className="text-xs text-gray-500 mt-2">
                                                        Deadline: {new Date(poll.deadline).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Closed Votes */}
            {expiredPolls.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <BarChart3 className="mr-2 h-5 w-5" />
                            Closed Votes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {expiredPolls.map((poll) => {
                                const isActive = isPollActive(poll);
                                return (
                                    <Card
                                        key={poll.id}
                                        className="hover:shadow-lg transition-shadow"
                                    >
                                        <CardContent className="p-4">
                                            <div className="space-y-3">
                                                <h3 className="font-semibold text-gray-900">
                                                    {poll.title}
                                                </h3>
                                                <div className="flex items-center space-x-2">
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-xs"
                                                    >
                                                        {poll.mode === "normal" ? "Single Choice" : 
                                                         poll.mode === "rank" ? "Ranked" : 
                                                         poll.mode === "point" ? "Points" : "Unknown"}
                                                    </Badge>
                                                    <Badge
                                                        variant={
                                                            poll.visibility ===
                                                            "public"
                                                                ? "default"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {poll.visibility ===
                                                        "public" ? (
                                                            <>
                                                                <Eye className="w-3 h-3 mr-1" />
                                                                Public
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserX className="w-3 h-3 mr-1" />
                                                                Private
                                                            </>
                                                        )}
                                                    </Badge>
                                                    <Badge
                                                        variant={
                                                            isActive
                                                                ? "success"
                                                                : "warning"
                                                        }
                                                    >
                                                        {isActive
                                                            ? "Active"
                                                            : "Ended"}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {poll.votes?.length || 0} votes
                                                </div>
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    className="w-full bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white"
                                                >
                                                    <Link
                                                        href={`/${poll.id}`}
                                                    >
                                                        View Results
                                                    </Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* User's Created Polls */}
            {/* Removed "Your Votes" tab - now showing all votes upfront */}
        </div>
    );
}
