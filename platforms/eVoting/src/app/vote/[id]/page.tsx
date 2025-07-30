"use client";

import { useState, useEffect, use } from "react";
import {
    Vote as VoteIcon,
    ArrowLeft,
    Eye,
    UserX,
    CheckCircle,
    Clock,
    Users,
    BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import Link from "next/link";

export default function Vote({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const pollId = id ? Number.parseInt(id) : null;
    const { toast } = useToast();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<string>("");

    // TODO: Redirect to login if not authenticated
    // useEffect(() => {
    //     if (!authLoading && !isAuthenticated) {
    //         toast({
    //             title: "Unauthorized",
    //             description: "You are logged out. Logging in again...",
    //             variant: "destructive",
    //         });
    //         setTimeout(() => {
    //             window.location.href = "/api/login";
    //         }, 500);
    //         return;
    //     }
    // }, [isAuthenticated, authLoading, toast]);

    // Redirect to home if no poll ID
    useEffect(() => {
        if (!pollId) {
            window.location.href = "/";
        }
    }, [pollId]);

    const { data: polls = [], isLoading } = { data: [], isLoading: false }; // TODO: replace with actual data fetching logic

    const selectedPoll = polls.find((p) => p.id === pollId);

    // Check if voting is still allowed
    const isVotingAllowed =
        selectedPoll?.isActive &&
        (!selectedPoll?.deadline ||
            new Date() < new Date(selectedPoll.deadline));

    // Initialize selected poll check
    const pollExists = selectedPoll !== undefined;

    // Calculate time remaining for polls with deadlines
    useEffect(() => {
        if (!pollExists || !selectedPoll?.deadline) {
            setTimeRemaining("");
            return;
        }

        const updateTimeRemaining = () => {
            const now = new Date().getTime();
            const deadline = new Date(selectedPoll.deadline).getTime();
            const difference = deadline - now;

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor(
                    (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
                );
                const minutes = Math.floor(
                    (difference % (1000 * 60 * 60)) / (1000 * 60)
                );

                if (days > 0) {
                    setTimeRemaining(
                        `${days} day${days > 1 ? "s" : ""} ${hours} hour${
                            hours > 1 ? "s" : ""
                        } remaining`
                    );
                } else if (hours > 0) {
                    setTimeRemaining(
                        `${hours} hour${
                            hours > 1 ? "s" : ""
                        } ${minutes} minute${minutes > 1 ? "s" : ""} remaining`
                    );
                } else if (minutes > 0) {
                    setTimeRemaining(
                        `${minutes} minute${minutes > 1 ? "s" : ""} remaining`
                    );
                } else {
                    setTimeRemaining("Less than a minute remaining");
                }
            } else {
                setTimeRemaining("Voting has ended");
            }
        };

        updateTimeRemaining();
        const interval = setInterval(updateTimeRemaining, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [selectedPoll?.deadline, pollExists]);

    const { data: voteStatus } = { data: null }; // TODO: replace with actual vote status fetching logic

    const { data: resultsData } = { data: null }; // TODO: replace with actual results fetching logic

    const handleVoteSubmit = () => {
        if (selectedPoll && selectedOption !== null) {
            // TODO: replace with actual vote submission logic
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--crimson)" />
            </div>
        );
    }

    if (!selectedPoll) {
        return (
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        Vote Not Found
                    </h1>
                    <p className="text-gray-600 mb-4">
                        The vote you're looking for doesn't exist or has been
                        removed.
                    </p>
                    <Link href="/">
                        <Button className="bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Home
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <Link href="/">
                    <Button className="bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white flex items-center">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Button>
                </Link>
                <Badge
                    variant={
                        selectedPoll.mode === "public" ? "default" : "secondary"
                    }
                >
                    {selectedPoll.mode === "public" ? (
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
            </div>

            <div className="card p-8">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {selectedPoll.title}
                    </h2>
                    {selectedPoll.deadline && timeRemaining && (
                        <div className="mt-3 flex justify-center">
                            <Badge
                                variant={
                                    timeRemaining.includes("ended")
                                        ? "destructive"
                                        : "default"
                                }
                                className="flex items-center"
                            >
                                <Clock className="w-3 h-3 mr-1" />
                                {timeRemaining}
                            </Badge>
                        </div>
                    )}
                </div>

                {voteStatus?.hasVoted === true ? (
                    <div className="space-y-6">
                        {/* Vote Distribution */}
                        <div>
                            <div className="space-y-3">
                                {resultsData?.results.map((option) => {
                                    const percentage =
                                        resultsData.totalVotes > 0
                                            ? (
                                                  ((option.votes || 0) /
                                                      resultsData.totalVotes) *
                                                  100
                                              ).toFixed(1)
                                            : 0;
                                    const isUserChoice =
                                        option.id === voteStatus.vote?.optionId;
                                    const isLeading = resultsData.results.every(
                                        (r) => option.votes >= r.votes
                                    );

                                    return (
                                        <div
                                            key={option.id}
                                            className={`p-4 rounded-lg border ${
                                                isLeading && option.votes > 0
                                                    ? "bg-red-50 border-red-200"
                                                    : isUserChoice
                                                    ? "bg-blue-50 border-blue-200"
                                                    : "bg-gray-50 border-gray-200"
                                            }`}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span
                                                    className={`font-medium ${
                                                        isLeading &&
                                                        option.votes > 0
                                                            ? "text-red-900"
                                                            : isUserChoice
                                                            ? "text-blue-900"
                                                            : "text-gray-900"
                                                    }`}
                                                >
                                                    {option.text}
                                                </span>
                                                <span
                                                    className={`text-sm ${
                                                        isLeading &&
                                                        option.votes > 0
                                                            ? "text-red-700"
                                                            : isUserChoice
                                                            ? "text-blue-700"
                                                            : "text-gray-600"
                                                    }`}
                                                >
                                                    {option.votes || 0} votes (
                                                    {percentage}%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${
                                                        isLeading &&
                                                        option.votes > 0
                                                            ? "bg-red-500"
                                                            : isUserChoice
                                                            ? "bg-blue-500"
                                                            : "bg-gray-400"
                                                    }`}
                                                    style={{
                                                        width: `${percentage}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Show results with user's choice highlighted */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center">
                                <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                                <div>
                                    <p className="text-sm font-medium text-green-900">
                                        You voted for:{" "}
                                        {
                                            selectedPoll.options.find(
                                                (opt) =>
                                                    opt.id ===
                                                    voteStatus.vote?.optionId
                                            )?.text
                                        }
                                    </p>
                                    <p className="text-sm text-green-700">
                                        Here are the current results for this
                                        poll.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Poll Statistics */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-lg border">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <BarChart3 className="h-6 w-6 text-green-600" />
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm font-medium text-gray-600">
                                                Votes
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900">
                                                {resultsData?.totalVotes || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <Users className="h-6 w-6 text-blue-600" />
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm font-medium text-gray-600">
                                                Turnout
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900">
                                                100%
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border col-span-2 md:col-span-1">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-purple-100 rounded-lg">
                                            <Eye className="h-6 w-6 text-purple-600" />
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm font-medium text-gray-600">
                                                Status
                                            </p>
                                            <Badge
                                                variant={
                                                    selectedPoll?.isActive
                                                        ? "success"
                                                        : "warning"
                                                }
                                                className="text-lg px-4 py-2"
                                            >
                                                {selectedPoll?.isActive
                                                    ? "Active"
                                                    : "Ended"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : !isVotingAllowed ? (
                    <div className="space-y-6">
                        {/* Show results when voting is not allowed (deadline passed) */}
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center">
                                <Clock className="text-red-500 h-5 w-5 mr-2" />
                                <div>
                                    <p className="text-sm font-medium text-red-900">
                                        Voting has ended for this poll
                                    </p>
                                    <p className="text-sm text-red-700">
                                        The voting deadline has passed. Here are
                                        the final results.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Final Results */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <BarChart3 className="mr-2 h-5 w-5" />
                                    Final Results
                                </h3>
                                <div className="space-y-3">
                                    {selectedPoll.options.map((option) => {
                                        const percentage =
                                            selectedPoll.totalVotes > 0
                                                ? (
                                                      ((option.votes || 0) /
                                                          selectedPoll.totalVotes) *
                                                      100
                                                  ).toFixed(1)
                                                : 0;

                                        return (
                                            <div
                                                key={option.id}
                                                className="p-4 rounded-lg border bg-gray-50 border-gray-200"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-medium text-gray-900">
                                                        {option.text}
                                                    </span>
                                                    <span className="text-sm text-gray-600">
                                                        {option.votes || 0}{" "}
                                                        votes ({percentage}%)
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="h-2 rounded-full bg-red-500"
                                                        style={{
                                                            width: `${percentage}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Voter Details for expired polls */}
                            {selectedPoll?.mode === "public" &&
                                selectedPoll.totalVotes > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                            <Users className="mr-2 h-5 w-5" />
                                            Voter Details
                                        </h3>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-sm text-gray-600 text-center">
                                                Voter details are available for
                                                active polls with results.
                                            </p>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Select your choice:
                            </h3>
                            <RadioGroup
                                value={selectedOption?.toString()}
                                onValueChange={(value) =>
                                    setSelectedOption(Number.parseInt(value))
                                }
                                disabled={!isVotingAllowed}
                            >
                                <div className="space-y-3">
                                    {selectedPoll.options.map((option) => (
                                        <div
                                            key={option.id}
                                            className="flex items-center space-x-3"
                                        >
                                            <RadioGroupItem
                                                value={option.id.toString()}
                                                id={option.id.toString()}
                                                disabled={!isVotingAllowed}
                                            />
                                            <Label
                                                htmlFor={option.id.toString()}
                                                className={`text-base flex-1 py-2 ${
                                                    isVotingAllowed
                                                        ? "cursor-pointer"
                                                        : "cursor-not-allowed opacity-50"
                                                }`}
                                            >
                                                {option.text}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="flex justify-center">
                            <Button
                                onClick={handleVoteSubmit}
                                disabled={
                                    selectedOption === null ||
                                    submitVoteMutation.isPending ||
                                    !isVotingAllowed
                                }
                                className="bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white px-8"
                            >
                                {submitVoteMutation.isPending ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                ) : (
                                    <VoteIcon className="w-4 h-4 mr-2" />
                                )}
                                {!isVotingAllowed
                                    ? "Voting Ended"
                                    : "Submit Vote"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* All Voters List at bottom of card */}
                {selectedPoll?.mode === "public" &&
                    resultsData?.voterDetails &&
                    resultsData.voterDetails.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <Users className="mr-2 h-5 w-5" />
                                All Voters ({resultsData.voterDetails.length})
                            </h3>
                            <div className="space-y-2">
                                {resultsData.voterDetails.map(
                                    (voter, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center p-3 bg-gray-50 rounded-lg"
                                        >
                                            <img
                                                src={
                                                    voter.profileImageUrl ||
                                                    "/default-avatar.png"
                                                }
                                                alt={voter.firstName || "Voter"}
                                                className="w-8 h-8 rounded-full mr-3"
                                                onError={(e) => {
                                                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                        voter.firstName || "U"
                                                    )}&background=dc2626&color=fff`;
                                                }}
                                            />
                                            <div className="flex-1">
                                                <span className="font-medium text-gray-900 block">
                                                    {voter.firstName &&
                                                    voter.lastName
                                                        ? `${voter.firstName} ${voter.lastName}`
                                                        : voter.email ||
                                                          "Anonymous"}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    Voted for:{" "}
                                                    {
                                                        selectedPoll.options.find(
                                                            (opt) =>
                                                                opt.id ===
                                                                voter.optionId
                                                        )?.text
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
}
