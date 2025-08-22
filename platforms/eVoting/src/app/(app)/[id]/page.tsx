"use client";

import { useState, useEffect, use, useCallback } from "react";
import {
    Vote as VoteIcon,
    ArrowLeft,
    Eye,
    UserX,
    CheckCircle,
    Clock,
    Users,
    BarChart3,
    Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { pollApi, type Poll } from "@/lib/pollApi";
import Link from "next/link";

import BlindVotingInterface from "@/components/blind-voting-interface";
import VotingInterface from "@/components/voting-interface";
import { SigningInterface } from "@/components/signing-interface";

export default function Vote({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const pollId = id || null;
    const { toast } = useToast();
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [showMyVote, setShowMyVote] = useState(false); // For viewing private poll votes
    const [showSigningInterface, setShowSigningInterface] = useState(false);

    // Add missing variables for BlindVotingInterface
    const [hasVoted, setHasVoted] = useState(false);
    const [blindVoteResults, setBlindVoteResults] = useState<any>(null);
    const [isLoadingBlindResults, setIsLoadingBlindResults] = useState(false);

    // Add state variables for different voting modes
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [pointVotes, setPointVotes] = useState<{ [key: number]: number }>({});
    const [rankVotes, setRankVotes] = useState<{ [key: number]: number }>({});
    const [timeRemaining, setTimeRemaining] = useState<string>("");

    // Calculate total points for point voting
    const totalPoints = Object.values(pointVotes).reduce((sum, points) => sum + points, 0);

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

    // Mock onVoteSubmitted function for blind voting
    const onVoteSubmitted = () => {
        setHasVoted(true);
        // Refresh poll data after blind vote submission
        fetchPoll();
        // Also refresh blind vote results
        fetchBlindVoteResults();
    };

    // Fetch blind vote results
    const fetchBlindVoteResults = async () => {
        if (!pollId || selectedPoll?.visibility !== "private") return;
        
        try {
            setIsLoadingBlindResults(true);
            const apiBaseUrl = process.env.NEXT_PUBLIC_EVOTING_BASE_URL || 'http://localhost:7777';
            const response = await fetch(`${apiBaseUrl}/api/polls/${pollId}/blind-tally`);
            if (response.ok) {
                const results = await response.json();
                setBlindVoteResults(results);
            }
        } catch (error) {
            console.error("Failed to fetch blind vote results:", error);
        } finally {
            setIsLoadingBlindResults(false);
        }
    };

    // Fetch poll data
    const fetchPoll = async () => {
        if (!pollId) return;
        
        try {
            const poll = await pollApi.getPollById(pollId);
            setSelectedPoll(poll);
        } catch (error) {
            console.error("Failed to fetch poll:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPoll();
    }, [pollId]);

    // Fetch blind vote results when poll loads (for private polls)
    useEffect(() => {
        if (selectedPoll && selectedPoll.visibility === "private") {
            fetchBlindVoteResults();
        }
    }, [selectedPoll]);

    // Fetch blind vote results when poll expires (for private polls)
    useEffect(() => {
        if (selectedPoll && selectedPoll.visibility === "private" && timeRemaining === "Voting has ended") {
            fetchBlindVoteResults();
        }
    }, [timeRemaining, selectedPoll]);

    // Check if voting is still allowed
    const isVotingAllowed =
        selectedPoll &&
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

    const [voteStatus, setVoteStatus] = useState<{ hasVoted: boolean; vote: any } | null>(null);
    const [resultsData, setResultsData] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch vote status and results
    const fetchVoteData = async () => {
        if (!pollId || !user?.id) return;
        
        try {
            
            const [voteStatusData, resultsData] = await Promise.all([
                pollApi.getUserVote(pollId, user.id),
                pollApi.getPollResults(pollId)
            ]);
            setVoteStatus(voteStatusData);
            setResultsData(resultsData);
        } catch (error) {
            console.error("Failed to fetch vote data:", error);
        }
    };

    useEffect(() => {
        fetchVoteData();
    }, [pollId, user?.id]);



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

    const handleVoteSubmit = async () => {
        if (!selectedPoll || !pollId) return;
        
        // Validate based on voting mode
        let isValid = false;
        if (selectedPoll.mode === "normal") {
            isValid = selectedOption !== null;
        } else if (selectedPoll.mode === "rank") {
            const totalRanks = Object.keys(rankVotes).length;
            const maxRanks = Math.min(selectedPoll.options.length, 3);
            isValid = totalRanks === maxRanks;
        } else if (selectedPoll.mode === "point") {
            isValid = totalPoints === 100;
        }
        
        if (!isValid) {
            toast({
                title: "Invalid Vote",
                description: selectedPoll.mode === "rank" 
                    ? "Please rank all options" 
                    : selectedPoll.mode === "point"
                    ? "Please distribute exactly 100 points"
                    : "Please select an option",
                variant: "destructive",
            });
            return;
        }
        
        // Show signing interface instead of submitting directly
        setShowSigningInterface(true);
    };

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
                                {resultsData?.results.map((option, index) => {
                                    const percentage =
                                        resultsData.totalVotes > 0
                                            ? (
                                                  ((option.votes || 0) /
                                                      resultsData.totalVotes) *
                                                  100
                                              ).toFixed(1)
                                            : 0;
                                    const isUserChoice =
                                        option.option === selectedPoll.options[index];
                                    const isLeading = resultsData.results.every(
                                        (r) => option.votes >= r.votes
                                    );

                                    return (
                                        <div
                                            key={index}
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
                                                    {option.option}
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
                                                    {selectedPoll.mode === "rank" 
                                                        ? `${option.votes || 0} points` 
                                                        : selectedPoll.mode === "point"
                                                        ? `${option.votes || 0} points`
                                                        : `${option.votes || 0} votes`} (
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

                        {/* Show results with user's choice highlighted - HIDE for private polls */}
                        {selectedPoll.visibility !== "private" && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center">
                                    <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                                    <div>
                                        <p className="text-sm font-medium text-green-900">
                                            You voted for:{" "}
                                            {
                                                selectedPoll.options[
                                                    parseInt(voteStatus.vote?.optionId || "0")
                                                ]
                                            }
                                        </p>
                                        <p className="text-sm text-green-700">
                                            Here are the current results for this
                                            poll.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* For private polls, show a different message */}
                        {selectedPoll.visibility === "private" && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center">
                                    <Shield className="text-blue-500 h-5 w-5 mr-2" />
                                    <div>
                                        <p className="text-sm font-medium text-blue-900">
                                            Private Poll - Your vote is hidden
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            This is a private poll. Your individual vote remains hidden until revealed.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Poll Statistics */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-lg border">
                                    <div className="flex items-center">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <BarChart3 className="h-6 w-6 text-green-600" />
                                        </div>
                                        <div className="ml-4">
                                            <p className="text-sm font-medium text-gray-600">
                                                {selectedPoll.mode === "rank" ? "Points" : "Votes"}
                                            </p>
                                            <p className="text-2xl font-bold text-gray-900">
                                                {resultsData?.totalVotes || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border">
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
                                                    isVotingAllowed
                                                        ? "success"
                                                        : "warning"
                                                }
                                                className="text-lg px-4 py-2"
                                            >
                                                {isVotingAllowed
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
                                    {/* For private polls, show blind vote results */}
                                    {selectedPoll.visibility === "private" && blindVoteResults ? (
                                        <>
                                            {blindVoteResults.optionResults && blindVoteResults.optionResults.length > 0 ? (
                                                blindVoteResults.optionResults.map((result, index) => {
                                                    const isWinner = result.voteCount === Math.max(...blindVoteResults.optionResults.map(r => r.voteCount));
                                                    const percentage = blindVoteResults.totalVotes > 0 ? (result.voteCount / blindVoteResults.totalVotes) * 100 : 0;
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`p-4 rounded-lg border ${
                                                                isWinner 
                                                                    ? 'bg-green-50 border-green-300' 
                                                                    : 'bg-gray-50 border-gray-200'
                                                            }`}
                                                        >
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="font-medium text-gray-900">
                                                                        {result.optionText || `Option ${index + 1}`}
                                                                    </span>
                                                                    {isWinner && (
                                                                        <Badge variant="success" className="bg-green-500 text-white">
                                                                            🏆 Winner
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm text-gray-600">
                                                                    {result.voteCount} votes ({percentage.toFixed(1)}%)
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className={`h-2 rounded-full ${
                                                                        isWinner ? 'bg-green-500' : 'bg-red-500'
                                                                    }`}
                                                                    style={{
                                                                        width: `${percentage}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    No blind vote results available.
                                                </div>
                                            )}
                                        </>
                                    ) : resultsData ? (
                                        <>
                                            {/* For public polls, show regular results */}
                                            {resultsData.results && resultsData.results.length > 0 ? (
                                                resultsData.results.map((result, index) => {
                                                    const isWinner = result.votes === Math.max(...resultsData.results.map(r => r.votes));
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`p-4 rounded-lg border ${
                                                                isWinner 
                                                                    ? 'bg-green-50 border-green-300' 
                                                                    : 'bg-gray-50 border-gray-200'
                                                            }`}
                                                        >
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="font-medium text-gray-900">
                                                                        {result.option || `Option ${index + 1}`}
                                                                    </span>
                                                                    {isWinner && (
                                                                        <Badge variant="success" className="bg-green-500 text-white">
                                                                            🏆 Winner
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm text-gray-600">
                                                                    {selectedPoll.mode === "rank"
                                                            ? `${result.votes} points` 
                                                            : `${result.votes} votes`} ({result.percentage.toFixed(1)}%)
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className={`h-2 rounded-full ${
                                                                        isWinner ? 'bg-green-500' : 'bg-red-500'
                                                                    }`}
                                                                    style={{
                                                                        width: `${result.percentage}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    No results data available.
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            No results available yet.
                                        </div>
                                    )}
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
                        
                        {/* Check if this is a private poll that requires blind voting */}
                        {selectedPoll.visibility === "private" ? (
                            <BlindVotingInterface
                                poll={selectedPoll}
                                userId={user?.id || ""}
                                hasVoted={hasVoted}
                                onVoteSubmitted={onVoteSubmitted}
                            />
                        ) : (
                            <>
                                {/* Regular Voting Interface based on poll mode */}
                                {selectedPoll.mode === "normal" && (
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
                                                {selectedPoll.options.map((option, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center space-x-3"
                                                    >
                                                        <RadioGroupItem
                                                            value={index.toString()}
                                                            id={index.toString()}
                                                            disabled={!isVotingAllowed}
                                                        />
                                                        <Label
                                                            htmlFor={index.toString()}
                                                            className={`text-base flex-1 py-2 ${
                                                                isVotingAllowed
                                                                    ? "cursor-pointer"
                                                                    : "cursor-not-allowed opacity-50"
                                                            }`}
                                                        >
                                                            {option}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </RadioGroup>
                                    </div>
                                )}

                                {selectedPoll.mode === "point" && (
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Distribute your points
                                            </h3>
                                            <Button
                                                onClick={() => setPointVotes({})}
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 border-red-300 hover:bg-red-50"
                                            >
                                                Reset Points
                                            </Button>
                                        </div>
                                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <p className="text-sm text-blue-800">
                                                You have 100 points to distribute. Assign points to each option based on your preference.
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            {selectedPoll.options.map((option, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center space-x-4 p-4 border rounded-lg"
                                                >
                                                    <div className="flex-1">
                                                        <Label className="text-base font-medium">
                                                            {option}
                                                        </Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={pointVotes[index] || 0}
                                                            onChange={(e) => {
                                                                const value = parseInt(e.target.value) || 0;
                                                                setPointVotes(prev => ({
                                                                    ...prev,
                                                                    [index]: value
                                                                }));
                                                            }}
                                                            className="w-20 px-3 py-2 border border-gray-300 rounded-md text-center"
                                                            disabled={!isVotingAllowed}
                                                        />
                                                        <span className="text-sm text-gray-500">points</span>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-gray-700">
                                                        Total Points Used:
                                                    </span>
                                                    <span className={`text-sm font-bold ${
                                                        totalPoints === 100 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                        {totalPoints}/100
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedPoll.mode === "rank" && (
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {(() => {
                                                    const currentRank = Object.keys(rankVotes).length + 1;
                                                    const maxRanks = Math.min(selectedPoll.options.length, 3);
                                                    
                                                    if (currentRank > maxRanks) {
                                                        return "Ranking Complete";
                                                    }
                                                    
                                                    const rankText = currentRank === 1 ? "1st" : currentRank === 2 ? "2nd" : currentRank === 3 ? "3rd" : `${currentRank}th`;
                                                    return `What's your ${rankText} choice?`;
                                                })()}
                                            </h3>
                                            <Button
                                                onClick={() => setRankVotes({})}
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 border-red-300 hover:bg-red-50"
                                            >
                                                Reset Rankings
                                            </Button>
                                        </div>
                                        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <p className="text-sm text-green-800">
                                                Rank your top 3 choices from most preferred (1) to least preferred (3).
                                            </p>
                                        </div>
                                        <div className="space-y-4">
                                            {selectedPoll.options.map((option, index) => {
                                                const rank = rankVotes[index];
                                                const isRanked = rank !== undefined;
                                                return (
                                                    <div
                                                        key={index}
                                                        className={`flex items-center space-x-4 p-4 border rounded-lg ${
                                                            isRanked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                                                        }`}
                                                    >
                                                        <div className="flex-1">
                                                            <Label className="text-base font-medium">
                                                                {option}
                                                            </Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <select
                                                                value={rank || ""}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    if (value === "") {
                                                                        const newRankVotes = { ...rankVotes };
                                                                        delete newRankVotes[index];
                                                                        setRankVotes(newRankVotes);
                                                                    } else {
                                                                        setRankVotes(prev => ({
                                                                            ...prev,
                                                                            [index]: parseInt(value)
                                                                        }));
                                                                    }
                                                                }}
                                                                className="px-3 py-2 border border-gray-300 rounded-md text-center"
                                                                disabled={!isVotingAllowed}
                                                            >
                                                                <option value="">No rank</option>
                                                                <option value="1">1st</option>
                                                                <option value="2">2nd</option>
                                                                <option value="3">3rd</option>
                                                            </select>
                                                            <span className="text-sm text-gray-500">rank</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-gray-700">
                                                        Total Rankings Used:
                                                    </span>
                                                    <span className={`text-sm font-bold ${
                                                        Object.keys(rankVotes).length === Math.min(selectedPoll.options.length, 3) ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                        {Object.keys(rankVotes).length}/{Math.min(selectedPoll.options.length, 3)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Submit button for regular voting */}
                                <div className="flex justify-center">
                                    <Button
                                        onClick={handleVoteSubmit}
                                        disabled={
                                            (selectedPoll.mode === "normal" && selectedOption === null) ||
                                            (selectedPoll.mode === "point" && totalPoints !== 100) ||
                                            (selectedPoll.mode === "rank" && Object.keys(rankVotes).length < Math.min(selectedPoll.options.length, 3)) ||
                                            isSubmitting ||
                                            !isVotingAllowed
                                        }
                                        className="bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white px-8"
                                    >
                                        {isSubmitting ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                        ) : (
                                            <VoteIcon className="w-4 h-4 mr-2" />
                                        )}
                                        {!isVotingAllowed
                                            ? "Voting Ended"
                                            : "Submit Vote"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Signing Interface Modal */}
                {showSigningInterface && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-md w-full">
                            <SigningInterface
                                pollId={pollId!}
                                voteData={
                                    selectedPoll?.mode === "normal"
                                        ? { optionId: selectedOption }
                                        : selectedPoll?.mode === "rank"
                                        ? { ranks: rankVotes }
                                        : { points: pointVotes }
                                }
                                onSigningComplete={(voteId) => {
                                    setShowSigningInterface(false);
                                    
                                    // Add a small delay to ensure backend has processed the vote
                                    setTimeout(async () => {
                                        try {
                                            await fetchPoll();
                                            await fetchVoteData();
                                        } catch (error) {
                                            console.error("Error during data refresh:", error);
                                        }
                                    }, 2000); // 2 second delay
                                    
                                    toast({
                                        title: "Success!",
                                        description: "Your vote has been signed and submitted.",
                                    });
                                }}
                                onCancel={() => {
                                    setShowSigningInterface(false);
                                }}
                            />
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



                {/* View My Vote Modal for Private Polls */}
                {showMyVote && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                    <Shield className="mr-2 h-5 w-5 text-blue-500" />
                                    Your Private Vote
                                </h3>
                                <Button
                                    onClick={() => setShowMyVote(false)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ✕
                                </Button>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-blue-800">
                                        This is your private vote choice. Only you can see this information.
                                    </p>
                                </div>
                                
                                {voteStatus?.vote && (
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900">Poll: {selectedPoll?.title}</h4>
                                        
                                        {selectedPoll?.mode === "normal" && (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                <p className="text-sm text-green-800">
                                                    <strong>Your choice:</strong> {selectedPoll.options[parseInt(voteStatus.vote.optionId || "0")]}
                                                </p>
                                            </div>
                                        )}
                                        
                                        {selectedPoll?.mode === "point" && voteStatus.vote.points && (
                                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                                <p className="text-sm text-purple-800 font-medium mb-2">Your point distribution:</p>
                                                <div className="space-y-1">
                                                    {Object.entries(voteStatus.vote.points).map(([index, points]) => (
                                                        <div key={index} className="flex justify-between text-sm">
                                                            <span>Option {parseInt(index) + 1}:</span>
                                                            <span className="font-medium">{points} points</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {selectedPoll?.mode === "rank" && voteStatus.vote.ranks && (
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                                <p className="text-sm text-green-800 font-medium mb-2">Your ranking:</p>
                                                <div className="space-y-1">
                                                    {Object.entries(voteStatus.vote.ranks).map(([rank, index]) => (
                                                        <div key={rank} className="flex justify-between text-sm">
                                                            <span>{rank === "1" ? "1st" : rank === "2" ? "2nd" : rank === "3" ? "3rd" : `${rank}th`} choice:</span>
                                                            <span className="font-medium">Option {parseInt(index) + 1}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <div className="flex justify-end pt-4">
                                    <Button
                                        onClick={() => setShowMyVote(false)}
                                        variant="outline"
                                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}