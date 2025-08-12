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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { pollApi, type Poll } from "@/lib/pollApi";
import Link from "next/link";
import { SigningInterface } from "@/components/signing-interface";

export default function Vote({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const pollId = id || null;
    const { toast } = useToast();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [selectedOption, setSelectedOption] = useState<number | null>(null);

    const [rankVotes, setRankVotes] = useState<{ [key: number]: number }>({});
    const [pointVotes, setPointVotes] = useState<{ [key: number]: number }>({});
    const [timeRemaining, setTimeRemaining] = useState<string>("");

    // Calculate total points for points-based voting
    const totalPoints = Object.values(pointVotes).reduce((sum, points) => sum + (points || 0), 0);

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

    const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showSigningInterface, setShowSigningInterface] = useState(false);

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
        if (!pollId) return;
        
        try {
            
            const [voteStatusData, resultsData] = await Promise.all([
                pollApi.getUserVote(pollId),
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
    }, [pollId]);

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

                        {/* Show results with user's choice highlighted */}
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
                                    {resultsData ? (
                                        <>

                                            
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
                        
                        {/* Voting Interface based on poll mode */}
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
                                        Reset Ranking
                                    </Button>
                                </div>
                                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-800">
                                        Select your choices one by one, starting with your most preferred option.
                                    </p>
                                </div>
                                <RadioGroup
                                    value={selectedOption?.toString()}
                                    onValueChange={(value) => {
                                        const optionIndex = parseInt(value);
                                        const currentRank = Object.keys(rankVotes).length + 1;
                                        setRankVotes(prev => ({
                                            ...prev,
                                            [currentRank]: optionIndex
                                        }));
                                        setSelectedOption(optionIndex);
                                    }}
                                    disabled={!isVotingAllowed}
                                >
                                    <div className="space-y-4">
                                        {selectedPoll.options.map((option, index) => {
                                            const isRanked = Object.values(rankVotes).includes(index);
                                            const rank = Object.entries(rankVotes).find(([_, optionIndex]) => optionIndex === index)?.[0];
                                            
                                            return (
                                                <div
                                                    key={index}
                                                    className={`flex items-center space-x-4 p-4 border rounded-lg ${
                                                        isRanked ? 'bg-green-50 border-green-300' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        {!isRanked ? (
                                                            <RadioGroupItem
                                                                value={index.toString()}
                                                                id={`rank-${index}`}
                                                                disabled={!isVotingAllowed}
                                                            />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                                                <span className="text-white text-xs font-bold">{rank}</span>
                                                            </div>
                                                        )}
                                                        <Label
                                                            htmlFor={`rank-${index}`}
                                                            className={`font-medium text-gray-900 ${
                                                                isRanked ? 'text-green-700' : ''
                                                            }`}
                                                        >
                                                            {option}
                                                        </Label>
                                                    </div>
                                                    {isRanked && (
                                                        <Badge variant="secondary" className="ml-auto">
                                                            {rank === "1" ? "1st Choice" : rank === "2" ? "2nd Choice" : rank === "3" ? "3rd Choice" : `${rank}th Choice`}
                                                        </Badge>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </RadioGroup>
                            </div>
                        )}

                        <div className="flex justify-center">
                            <Button
                                onClick={handleVoteSubmit}
                                                                    disabled={
                                        (selectedPoll.mode === "normal" && selectedOption === null) ||
                                    
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
                                    : "Sign & Submit Vote"}
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
            </div>
        </div>
    );
}
