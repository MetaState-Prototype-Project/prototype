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
    ChartLine,
    CircleUser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { pollApi, type Poll, type PollResults, type BlindVoteResults, type VoteData, type PointVoteData, type VoterDetail, type PollResultOption, type SigningDelegationContext } from "@/lib/pollApi";
import Link from "next/link";

import BlindVotingInterface from "@/components/blind-voting-interface";
import { SigningInterface } from "@/components/signing-interface";
import { DelegationPanel } from "@/components/delegation-panel";
import { DelegatedVotingInterface } from "@/components/delegated-voting-interface";
import { VotingContextSelector, type VotingContext } from "@/components/voting-context-selector";

export default function Vote({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const pollId = id || null;
    const { toast } = useToast();
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [showMyVote, setShowMyVote] = useState(false); // For viewing private poll votes
    const [showSigningInterface, setShowSigningInterface] = useState(false);
    const [showMobileVoterActivity, setShowMobileVoterActivity] = useState(false); // For mobile vote activity drawer

    // Add missing variables for BlindVotingInterface
    const [hasVoted, setHasVoted] = useState(false);
    const [blindVoteResults, setBlindVoteResults] = useState<BlindVoteResults | null>(null);
    const [isLoadingBlindResults, setIsLoadingBlindResults] = useState(false);

    // Add state variables for different voting modes
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [pointVotes, setPointVotes] = useState<{ [key: number]: number }>({});
    
    // Voting context state for delegated voting
    const [votingContext, setVotingContext] = useState<VotingContext>({ type: "self" });
    const [delegationRefreshKey, setDelegationRefreshKey] = useState(0);
    const [activeDelegationCount, setActiveDelegationCount] = useState(0);
    const [hasDelegationHistory, setHasDelegationHistory] = useState(false);
    const [rankVotes, setRankVotes] = useState<{ [key: number]: number }>({});
    const [signingVoteData, setSigningVoteData] = useState<any | null>(null);
    const [signingDelegationContext, setSigningDelegationContext] = useState<SigningDelegationContext | undefined>(undefined);
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

    // Re-fetch results when poll expires (for all poll types)
    useEffect(() => {
        if (selectedPoll && timeRemaining === "Voting has ended") {
            // Re-fetch fresh results when deadline expires
            fetchVoteData();
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
            const deadline = new Date(selectedPoll.deadline!).getTime();
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
                        `${days} day${days > 1 ? "s" : ""} ${hours} hour${hours > 1 ? "s" : ""
                        } remaining`
                    );
                } else if (hours > 0) {
                    setTimeRemaining(
                        `${hours} hour${hours > 1 ? "s" : ""
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
    const [delegatedVoteStatus, setDelegatedVoteStatus] = useState<{ hasVoted: boolean; vote: any } | null>(null);
    const [resultsData, setResultsData] = useState<PollResults | null>(null);
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

            // Update hasVoted state based on the fetched vote status
            if (voteStatusData && voteStatusData.hasVoted) {
                setHasVoted(true);
            }
        } catch (error) {
            console.error("Failed to fetch vote data:", error);
        }
    };

    useEffect(() => {
        fetchVoteData();
    }, [pollId, user?.id]);

    // Sync hasVoted state with voteStatus when it changes
    useEffect(() => {
        if (voteStatus) {
            setHasVoted(voteStatus.hasVoted);
        }
    }, [voteStatus]);

    useEffect(() => {
        const fetchDelegatedVoteStatus = async () => {
            if (!pollId || votingContext.type !== "delegated" || !votingContext.delegatorId) {
                setDelegatedVoteStatus(null);
                return;
            }

            try {
                const delegatedStatus = await pollApi.getUserVote(pollId, votingContext.delegatorId);
                setDelegatedVoteStatus(delegatedStatus);
            } catch (error) {
                console.error("Failed to fetch delegated vote status:", error);
                setDelegatedVoteStatus(null);
            }
        };

        fetchDelegatedVoteStatus();
    }, [pollId, votingContext, delegationRefreshKey]);

    const isDelegatedContextVoted =
        votingContext.type === "delegated" &&
        (votingContext.delegationStatus === "used" || delegatedVoteStatus?.hasVoted === true);



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

        if (votingContext.type === "self" && hasVoted) {
            toast({
                title: "Already Voted for Yourself",
                description: "Switch to a delegated voter in 'Voting as' to cast votes on their behalf.",
                variant: "destructive",
            });
            return;
        }

        if (isDelegatedContextVoted) {
            toast({
                title: "Delegated Vote Already Submitted",
                description: `A vote was already submitted for ${votingContext.delegatorName}. Switch context to continue.`,
                variant: "destructive",
            });
            return;
        }

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

        const voteData = selectedPoll.mode === "normal"
            ? { optionId: selectedOption }
            : selectedPoll.mode === "rank"
                ? rankVotes
                : { points: pointVotes };

        setSigningVoteData(voteData);
        setSigningDelegationContext(
            votingContext.type === "delegated" && votingContext.delegatorId
                ? {
                    delegatorId: votingContext.delegatorId,
                    delegatorName: votingContext.delegatorName,
                }
                : undefined
        );
        setIsSubmitting(true);
        setShowSigningInterface(true);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <Link href="/">
                    <Button className="bg-(--crimson) hover:bg-(--crimson-50) hover:text-(--crimson) hover:border-(--crimson) border text-white flex items-center">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Button>
                </Link>
                <div className="flex items-center gap-2">
                    <Badge
                        variant={
                            selectedPoll.visibility === "public" ? "default" : "secondary"
                        }
                    >
                        {selectedPoll.visibility === "public" ? (
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
                            selectedPoll.votingWeight === "ereputation" ? "default" : "secondary"
                        }
                    >
                        {selectedPoll.votingWeight === "ereputation" ? (
                            <>
                                <ChartLine className="w-3 h-3 mr-1" />
                                eReputation Weighted
                            </>
                        ) : (
                            <>
                                <CircleUser className="w-3 h-3 mr-1" />
                                1P 1V
                            </>
                        )}
                    </Badge>
                </div>
            </div>

            <div className="flex gap-6 items-start">
                <div className="card p-8 flex-1 min-w-0">
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

                    {/* Keep selector mounted in a stable top slot for all group polls */}
                    {selectedPoll.groupId && (
                        <VotingContextSelector
                            pollId={selectedPoll.id}
                            userId={user?.id || ""}
                            currentUserName={user?.name || user?.ename || "You"}
                            currentUserAvatar={user?.avatarUrl}
                            onContextChange={setVotingContext}
                            onDelegationStateChange={(state) => {
                                setActiveDelegationCount(state.activeCount);
                                setHasDelegationHistory(state.hasHistory);
                            }}
                            disabled={!isVotingAllowed}
                            refreshTrigger={delegationRefreshKey}
                            hasVotedForSelf={hasVoted}
                        />
                    )}

                    {isDelegatedContextVoted && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800 font-medium">
                                Vote already submitted for {votingContext.delegatorName}.
                            </p>
                            {delegatedVoteStatus?.vote?.data && (
                                <p className="text-xs text-blue-700 mt-1">
                                    You can still switch contexts to review this delegated vote or select another delegator.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Show results if poll has ended, regardless of user's vote status */}
                    {!isVotingAllowed ? (
                        <div className="space-y-6">

                            {/* For private polls that have ended, show final results */}
                            {selectedPoll.visibility === "private" ? (
                                <div className="space-y-6">
                                    {/* Final Results for Private Polls */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                            <BarChart3 className="mr-2 h-5 w-5" />
                                            Final Results
                                        </h3>

                                        {/* Voting Turnout Information */}
                                        {blindVoteResults?.totalEligibleVoters && (
                                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Users className="h-4 w-4 text-blue-600" />
                                                        <span className="text-sm font-medium text-blue-900">Voting Turnout</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-blue-900">
                                                            {blindVoteResults.turnout?.toFixed(1) || 0}%
                                                        </div>
                                                        <div className="text-xs text-blue-600">
                                                            {blindVoteResults.totalVotes || 0} of {blindVoteResults.totalEligibleVoters} eligible voters
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {blindVoteResults?.optionResults && blindVoteResults.optionResults.length > 0 ? (
                                                blindVoteResults.optionResults.map((result, index) => {
                                                    const isWinner = result.voteCount === Math.max(...blindVoteResults.optionResults.map(r => r.voteCount));
                                                    const percentage = blindVoteResults.totalVotes > 0 ? (result.voteCount / blindVoteResults.totalVotes) * 100 : 0;
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`p-4 rounded-lg border ${isWinner
                                                                ? 'bg-green-50 border-green-300'
                                                                : 'bg-gray-50 border-gray-200'
                                                                }`}
                                                        >
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="font-medium text-gray-900">
                                                                        {result.optionText || `Option ${index + 1}`}
                                                                    </span>
                                                                    {result.isTied && blindVoteResults.totalVotes > 0 && (
                                                                        <Badge variant="success" className="bg-blue-500 text-white">
                                                                            🏆 Tied
                                                                        </Badge>
                                                                    )}
                                                                    {isWinner && !result.isTied && blindVoteResults.totalVotes > 0 && (
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
                                                                    className={`h-2 rounded-full ${result.isTied ? 'bg-blue-500' : isWinner ? 'bg-green-500' : 'bg-red-500'
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
                                                    No blind vote results available for this private poll.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (selectedPoll.visibility as string) !== "private" ? (
                                /* For public polls that have ended, show final results */
                                <div className="space-y-6">
                                    {/* Final Results for Public Polls */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                            <BarChart3 className="mr-2 h-5 w-5" />
                                            Final Results
                                        </h3>

                                        {/* Voting Turnout Information */}
                                        {resultsData?.totalEligibleVoters && (
                                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <Users className="h-4 w-4 text-blue-600" />
                                                        <span className="text-sm font-medium text-blue-900">Voting Turnout</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-blue-900">
                                                            {resultsData.turnout?.toFixed(1) || 0}%
                                                        </div>
                                                        <div className="text-xs text-blue-600">
                                                            {resultsData.totalVotes || 0} of {resultsData.totalEligibleVoters} eligible voters
                                                            {(resultsData.mode === "ereputation" || selectedPoll?.votingWeight === "ereputation") && resultsData.pointsVoted !== undefined && resultsData.totalEligiblePoints !== undefined && (
                                                                <> ({resultsData.pointsVoted} points of {resultsData.totalEligiblePoints} total eligible points)</>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-3">
                                            {resultsData?.results && resultsData.results.length > 0 ? (
                                                resultsData.results.map((result, index) => {
                                                    // Handle different voting modes
                                                    let displayValue: string;
                                                    let isWinner: boolean;
                                                    let percentage: number;

                                                    if (resultsData.mode === "rank") {
                                                        // Rank-based voting: show winner status instead of misleading vote counts
                                                        if (result.isTied) {
                                                            displayValue = "🏆 Tied Winner";
                                                        } else if (result.isWinner) {
                                                            displayValue = "🏆 Winner";
                                                        } else {
                                                            displayValue = "Eliminated";
                                                        }
                                                        isWinner = result.isWinner || result.isTied || false; // Both winners and tied winners are "winners"
                                                        percentage = result.percentage || 0; // Use the percentage from backend

                                                        // Check if there might have been a tie situation
                                                        if (resultsData.irvDetails && resultsData.irvDetails.rounds.length > 1) {
                                                            // If multiple rounds, there might have been ties
                                                            console.log(`[IRV Debug] Poll had ${resultsData.irvDetails.rounds.length} rounds, check console for tie warnings`);
                                                        }
                                                    } else if (resultsData.mode === "point" || (resultsData.mode === "ereputation" && result.totalPoints !== undefined)) {
                                                        // Point-based voting: show total points and average
                                                        // For eReputation mode, only treat as points if totalPoints exists
                                                        const totalPoints = result.totalPoints || 0;
                                                        displayValue = `${totalPoints} points${result.averagePoints !== undefined ? ` (avg: ${result.averagePoints})` : ''}`;
                                                        isWinner = totalPoints === Math.max(...resultsData.results.map(r => r.totalPoints || 0));
                                                        const totalAllPoints = resultsData.results.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
                                                        percentage = totalAllPoints > 0 ? (totalPoints / totalAllPoints) * 100 : 0;
                                                    } else {
                                                        // Normal voting (including eReputation weighted normal voting): show votes and percentage
                                                        const voteCount = result.votes || 0;
                                                        // For eReputation mode, show "Points" instead of "votes"
                                                        displayValue = resultsData.mode === "ereputation" ? `${voteCount} Points` : `${voteCount} votes`;
                                                        // Calculate total from results array for percentage (handles both weighted and non-weighted)
                                                        const totalVotesForPercentage = resultsData.results.reduce((sum, r) => sum + (r.votes || 0), 0);
                                                        isWinner = voteCount === Math.max(...resultsData.results.map(r => r.votes || 0));
                                                        percentage = totalVotesForPercentage > 0 ? (voteCount / totalVotesForPercentage) * 100 : 0;
                                                    }

                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`p-4 rounded-lg border ${isWinner
                                                                ? 'bg-green-50 border-green-300'
                                                                : 'bg-gray-50 border-gray-200'
                                                                }`}
                                                        >
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="font-medium text-gray-900">
                                                                        {result.option}
                                                                    </span>
                                                                    {result.isTied && resultsData.totalVotes > 0 && (
                                                                        <Badge variant="success" className="bg-blue-500 text-white">
                                                                            🏆 Tied
                                                                        </Badge>
                                                                    )}
                                                                    {isWinner && !result.isTied && resultsData.totalVotes > 0 && (
                                                                        <Badge variant="success" className="bg-green-500 text-white">
                                                                            🏆 Winner
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm text-gray-600">
                                                                    {resultsData.mode === "rank" ? displayValue : `${displayValue} (${percentage.toFixed(1)}%)`}
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className={`h-2 rounded-full ${result.isTied ? 'bg-blue-500' : isWinner ? 'bg-green-500' : 'bg-red-500'
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
                                                    No results available for this poll.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* For active polls, show user's vote choice */}
                                    {(selectedPoll.visibility as string) !== "private" && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="flex items-center">
                                                <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                                                <div>
                                                    <p className="text-sm font-medium text-green-900">
                                                        You voted:{" "}
                                                        {
                                                            (() => {
                                                                const voteData = voteStatus?.vote?.data;
                                                                if (!voteData) return "Unknown option";

                                                                if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                                    const optionIndex = parseInt(voteData.data[0] || "0");
                                                                    return selectedPoll.options[optionIndex] || "Unknown option";
                                                                } else if (voteData.mode === "point" && typeof voteData.data === "object" && !Array.isArray(voteData.data)) {
                                                                    // Point voting stores data as { "0": 50, "1": 50 } format
                                                                    const totalPoints = Object.values(voteData.data as Record<string, number>).reduce((sum, points) => sum + (points || 0), 0);
                                                                    return `distributed ${totalPoints} points across options`;
                                                                } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                                    const rawRankPoints = voteData.data[0]?.points;
                                                                    // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                                    const rankPoints = rawRankPoints?.ranks && typeof rawRankPoints.ranks === 'object' 
                                                                        ? rawRankPoints.ranks 
                                                                        : rawRankPoints;
                                                                    if (rankPoints && typeof rankPoints === "object") {
                                                                        const sortedRanks = Object.entries(rankPoints)
                                                                            .filter(([, rank]) => typeof rank === 'number')
                                                                            .sort(([, a], [, b]) => (a as number) - (b as number));
                                                                        const topChoiceIndex = sortedRanks[0]?.[0];
                                                                        const topChoice = topChoiceIndex ? selectedPoll.options[parseInt(topChoiceIndex)] : "Unknown";
                                                                        return `ranked options (${topChoice} as 1st choice)`;
                                                                    }
                                                                    return "ranked options";
                                                                }
                                                                return "Unknown option";
                                                            })()
                                                        }
                                                    </p>
                                                    <p className="text-sm text-green-700">
                                                        {isVotingAllowed
                                                            ? "Your vote has been submitted. Results will be shown when the poll ends."
                                                            : "Here are the final results for this poll."
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Show voting options with user's choice highlighted (grayed out, no results) */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            Voting Options:
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedPoll.options.map((option, index) => {
                                                const isUserChoice = (() => {
                                                    const voteData = voteStatus?.vote?.data;
                                                    if (!voteData) return false;

                                                    if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                        return voteData.data.includes(index.toString());
                                                    } else if (voteData.mode === "point" && typeof voteData.data === "object" && !Array.isArray(voteData.data)) {
                                                        // Point voting stores data as { "0": 50, "1": 50 } format
                                                        const points = (voteData.data as Record<string, number>)[index.toString()];
                                                        return points > 0;
                                                    } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                        const rawRankPoints = voteData.data[0]?.points;
                                                        // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                        const rankPoints = rawRankPoints?.ranks && typeof rawRankPoints.ranks === 'object' 
                                                            ? rawRankPoints.ranks 
                                                            : rawRankPoints;
                                                        return rankPoints && typeof rankPoints[index.toString()] === 'number';
                                                    }
                                                    return false;
                                                })();

                                                const userChoiceDetails = (() => {
                                                    const voteData = voteStatus?.vote?.data;
                                                    if (!voteData) return null;

                                                    if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                        return voteData.data.includes(index.toString()) ? "← You voted for this option" : null;
                                                    } else if (voteData.mode === "point" && typeof voteData.data === "object" && !Array.isArray(voteData.data)) {
                                                        // Point voting stores data as { "0": 50, "1": 50 } format
                                                        const points = (voteData.data as Record<string, number>)[index.toString()];
                                                        return points > 0 ? `← You gave ${points} points` : null;
                                                    } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                        const rawRankPoints = voteData.data[0]?.points;
                                                        // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                        const rankPoints = rawRankPoints?.ranks && typeof rawRankPoints.ranks === 'object' 
                                                            ? rawRankPoints.ranks 
                                                            : rawRankPoints;
                                                        const rank = rankPoints?.[index.toString()];
                                                        return typeof rank === 'number' ? `← You ranked this ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}` : null;
                                                    }
                                                    return null;
                                                })();

                                                return (
                                                    <div
                                                        key={index}
                                                        className={`flex items-center space-x-3 p-3 border rounded-lg ${isUserChoice
                                                            ? 'bg-green-50 border-green-200'
                                                            : 'bg-gray-50 border-gray-200 opacity-60'
                                                            }`}
                                                    >
                                                        <div className="flex-1">
                                                            <Label className={`text-base ${isUserChoice ? 'text-green-900 font-medium' : 'text-gray-500'
                                                                }`}>
                                                                {option}
                                                            </Label>
                                                            {userChoiceDetails && (
                                                                <div className="mt-1 text-sm text-green-600">
                                                                    <span className="font-medium">{userChoiceDetails}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : voteStatus?.hasVoted === true && activeDelegationCount === 0 && votingContext.type === "self" ? (
                        // Show voting interface for active polls where user has already voted
                        <>
                            {/* Show that user has voted with detailed vote information for public polls */}
                            {selectedPoll.visibility === "public" ? (
                                <div className="space-y-6">
                                    {/* Show that user has voted with detailed vote information */}
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <div className="flex items-center mb-3">
                                            <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                                            <div>
                                                <h3 className="text-lg font-semibold text-green-900">Your Vote Details</h3>
                                                <p className="text-sm text-green-700">
                                                    Your vote has been submitted. Results will be shown when the poll ends.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Display vote details based on mode */}
                                        {(() => {
                                            const voteData = voteStatus?.vote?.data;
                                            if (!voteData) return null;

                                            if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                // Simple vote - show selected options
                                                const selectedOptions = (voteData.data as string[]).map(index => selectedPoll.options[parseInt(index)]).filter(Boolean);
                                                return (
                                                    <div className="bg-white rounded-lg p-3 border border-green-200">
                                                        <p className="text-sm font-medium text-green-800 mb-2">Selected Options:</p>
                                                        <div className="space-y-1">
                                                            {selectedOptions.map((option, i) => (
                                                                <div key={i} className="flex items-center space-x-2">
                                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                    <span className="text-sm text-green-700">{option}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            } else if (voteData.mode === "point" && typeof voteData.data === "object") {
                                                // Point vote - show point distribution
                                                const pointEntries = Object.entries(voteData.data as Record<string, number>);
                                                return (
                                                    <div className="bg-white rounded-lg p-3 border border-green-200">
                                                        <p className="text-sm font-medium text-green-800 mb-2">Your Point Distribution:</p>
                                                        <div className="space-y-2">
                                                            {pointEntries.map(([optionIndex, points]) => {
                                                                const option = selectedPoll.options[parseInt(optionIndex)];
                                                                return (
                                                                    <div key={optionIndex} className="flex items-center justify-between">
                                                                        <span className="text-sm text-green-700">{option}</span>
                                                                        <span className="text-sm font-medium text-green-800 bg-green-100 px-2 py-1 rounded">
                                                                            {points} points
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-green-200">
                                                            <span className="text-xs text-green-600">
                                                                Total: {Object.values(voteData.data).reduce((sum: number, points: any) => sum + points, 0)} points
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                // Rank vote - show ranking
                                                const rawRankData = voteData.data[0]?.points;
                                                // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                const rankData = rawRankData?.ranks && typeof rawRankData.ranks === 'object' 
                                                    ? rawRankData.ranks 
                                                    : rawRankData;
                                                if (rankData && typeof rankData === "object") {
                                                    const sortedRanks = Object.entries(rankData)
                                                        .filter(([, rank]) => typeof rank === 'number')
                                                        .sort(([, a], [, b]) => (a as number) - (b as number))
                                                        .map(([optionIndex, rank]) => ({
                                                            option: selectedPoll.options[parseInt(optionIndex)],
                                                            rank: rank as number
                                                        }));

                                                    return (
                                                        <div className="bg-white rounded-lg p-3 border border-green-200">
                                                            <p className="text-sm font-medium text-green-800 mb-2">Your Ranking:</p>
                                                            <div className="space-y-2">
                                                                {sortedRanks.map((item, i) => (
                                                                    <div key={i} className="flex items-center justify-between">
                                                                        <span className="text-sm text-green-700">{item.option}</span>
                                                                        <span className="text-sm font-medium text-green-800 bg-green-100 px-2 py-1 rounded">
                                                                            {item.rank === 1 ? '1st' : item.rank === 2 ? '2nd' : item.rank === 3 ? '3rd' : `${item.rank}th`} choice
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                            }
                                            return null;
                                        })()}
                                    </div>

                                    {/* Show voting options with user's choice highlighted */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                            Voting Options:
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedPoll.options.map((option, index) => {
                                                const isUserChoice = (() => {
                                                    const voteData = voteStatus?.vote?.data;
                                                    if (!voteData) return false;

                                                    if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                        return voteData.data.includes(index.toString());
                                                    } else if (voteData.mode === "point" && typeof voteData.data === "object") {
                                                        return voteData.data[index] > 0;
                                                    } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                        const rawRankData = voteData.data[0]?.points;
                                                        // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                        const rankData = rawRankData?.ranks && typeof rawRankData.ranks === 'object' 
                                                            ? rawRankData.ranks 
                                                            : rawRankData;
                                                        return rankData && typeof rankData[index] === 'number';
                                                    }
                                                    return false;
                                                })();

                                                const userChoiceDetails = (() => {
                                                    const voteData = voteStatus?.vote?.data;
                                                    if (!voteData) return null;

                                                    if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                        return voteData.data.includes(index.toString()) ? "← You voted for this option" : null;
                                                    } else if (voteData.mode === "point" && typeof voteData.data === "object") {
                                                        const points = voteData.data[index];
                                                        return points > 0 ? `← You gave ${points} points` : null;
                                                    } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                        const rawRankData = voteData.data[0]?.points;
                                                        // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                        const rankData = rawRankData?.ranks && typeof rawRankData.ranks === 'object' 
                                                            ? rawRankData.ranks 
                                                            : rawRankData;
                                                        const rank = rankData?.[index];
                                                        return typeof rank === 'number' ? `← You ranked this ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}` : null;
                                                    }
                                                    return null;
                                                })();

                                                return (
                                                    <div
                                                        key={index}
                                                        className={`flex items-center space-x-3 p-3 border rounded-lg ${isUserChoice
                                                            ? 'bg-green-50 border-green-200'
                                                            : 'bg-gray-50 border-gray-200 opacity-60'
                                                            }`}
                                                    >
                                                        <div className="flex-1">
                                                            <Label className={`text-base ${isUserChoice ? 'text-green-900 font-medium' : 'text-gray-500'
                                                                }`}>
                                                                {option}
                                                            </Label>
                                                            {userChoiceDetails && (
                                                                <div className="mt-1 text-sm text-green-600">
                                                                    <span className="font-medium">{userChoiceDetails}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : selectedPoll.visibility === "private" && selectedPoll.mode === "normal" ? (
                                // For private simple polls, show BlindVotingInterface (cryptographically protected)
                                <BlindVotingInterface
                                    poll={selectedPoll}
                                    userId={user?.id || ""}
                                    hasVoted={hasVoted}
                                    onVoteSubmitted={onVoteSubmitted}
                                />
                            ) : selectedPoll.visibility === "private" && (selectedPoll.mode === "point" || selectedPoll.mode === "rank") ? (
                                // For private PBV/RBV polls that user has voted on, show vote details with privacy info
                                <div className="space-y-6">
                                    {/* Privacy limitation warning for private PBV/RBV */}
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="flex items-start">
                                            <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <div>
                                                <h4 className="text-sm font-semibold text-amber-800">Limited Privacy Mode</h4>
                                                <p className="text-sm text-amber-700 mt-1">
                                                    This {selectedPoll.mode === "point" ? "point-based" : "rank-based"} vote hides voter information in the UI.
                                                    Unlike simple blind voting, it is <strong>not cryptographically protected</strong>.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vote submitted confirmation */}
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <div className="flex items-center">
                                            <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                                            <div>
                                                <h3 className="text-lg font-semibold text-green-900">Vote Submitted</h3>
                                                <p className="text-sm text-green-700">
                                                    Your vote has been submitted. Your identity is hidden in results. Results will be shown when the poll ends.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="space-y-6">

                            {/* Check if this is a private poll that requires blind voting */}
                            {selectedPoll.visibility === "private" && selectedPoll.mode === "normal" ? (
                                // Only use BlindVotingInterface for private simple (normal) polls - these are cryptographically protected
                                <BlindVotingInterface
                                    poll={selectedPoll}
                                    userId={user?.id || ""}
                                    hasVoted={hasVoted}
                                    onVoteSubmitted={onVoteSubmitted}
                                />
                            ) : selectedPoll.visibility === "private" && (selectedPoll.mode === "point" || selectedPoll.mode === "rank") ? (
                                // For private PBV/RBV polls, show standard voting UI with privacy warning (NOT cryptographically protected)
                                <>
                                    {/* Delegation Panel - for private point/rank polls (not cryptographically protected) */}
                                    {selectedPoll.groupId && (
                                        <div className="mb-6">
                                            <DelegationPanel
                                                poll={selectedPoll}
                                                userId={user?.id || ""}
                                                hasVoted={hasVoted}
                                                onDelegationChange={() => {
                                                    fetchPoll();
                                                    fetchVoteData();
                                                    setDelegationRefreshKey(k => k + 1);
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Privacy limitation warning for private PBV/RBV */}
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="flex items-start">
                                            <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <div>
                                                <h4 className="text-sm font-semibold text-amber-800">Limited Privacy Notice</h4>
                                                <p className="text-sm text-amber-700 mt-1">
                                                    This {selectedPoll.mode === "point" ? "point-based" : "rank-based"} blind vote hides voter information in the UI only.
                                                    Unlike simple blind voting, it is <strong>not cryptographically protected</strong> — a server administrator
                                                    could potentially see who voted for what.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {hasVoted && activeDelegationCount === 0 && votingContext.type === "self" ? (
                                        // User has already voted on private PBV/RBV and has no delegations
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="flex items-center">
                                                <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                                                <div>
                                                    <h3 className="text-lg font-semibold text-green-900">Vote Submitted</h3>
                                                    <p className="text-sm text-green-700">
                                                        Your vote has been submitted. Your identity is hidden in results. Results will be shown when the poll ends.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Show voting interface for private PBV/RBV (or if user has pending delegations)
                                        <>
                                            {/* Show that user has voted when they still have delegations */}
                                            {hasVoted && activeDelegationCount > 0 && (
                                                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                                    <CheckCircle className="text-green-500 h-4 w-4 shrink-0" />
                                                    <p className="text-sm text-green-700">
                                                        Your vote has been submitted. You can still vote on behalf of users who delegated their vote to you.
                                                    </p>
                                                </div>
                                            )}

                                            {selectedPoll.mode === "point" && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="text-lg font-semibold text-gray-900">
                                                            {votingContext.type === "delegated"
                                                                ? `Distribute points for ${votingContext.delegatorName}`
                                                                : "Distribute your points"}
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
                                                            {votingContext.type === "delegated"
                                                                ? `Distribute 100 points on behalf of ${votingContext.delegatorName}.`
                                                                : "You have 100 points to distribute. Assign points to each option based on your preference."}
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
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={pointVotes[index] || 0}
                                                                        onChange={(e) => {
                                                                            const input = e.target.value;
                                                                            const numericValue = input.replace(/\D/g, '');
                                                                            const value = numericValue ? Math.min(Math.max(parseInt(numericValue, 10), 0), 100) : 0;
                                                                            setPointVotes(prev => ({
                                                                                ...prev,
                                                                                [index]: value
                                                                            }));
                                                                        }}
                                                                        onInput={(e) => {
                                                                            const target = e.target as HTMLInputElement;
                                                                            const cleaned = target.value.replace(/\D/g, '');
                                                                            const value = cleaned ? Math.min(Math.max(parseInt(cleaned, 10), 0), 100) : 0;
                                                                            target.value = value.toString();
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
                                                                <span className={`text-sm font-bold ${totalPoints === 100 ? 'text-green-600' : 'text-red-600'}`}>
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
                                                                const forText = votingContext.type === "delegated" ? ` for ${votingContext.delegatorName}` : "";
                                                                if (currentRank > maxRanks) {
                                                                    return `Ranking Complete${forText}`;
                                                                }
                                                                return `Rank ${currentRank} of ${maxRanks}${forText}`;
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
                                                            {votingContext.type === "delegated"
                                                                ? `Rank the top 3 choices for ${votingContext.delegatorName} from most preferred (1) to least preferred (3).`
                                                                : "Rank your top 3 choices from most preferred (1) to least preferred (3)."}
                                                        </p>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {selectedPoll.options.map((option, index) => {
                                                            const rank = rankVotes[index];
                                                            const isRanked = rank !== undefined;
                                                            const usedRanks = Object.values(rankVotes);
                                                            const maxRanks = Math.min(selectedPoll.options.length, 3);

                                                            return (
                                                                <div
                                                                    key={index}
                                                                    className={`flex items-center space-x-4 p-4 border rounded-lg ${isRanked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'}`}
                                                                >
                                                                    <div className="flex-1">
                                                                        <Label className="text-base font-medium">
                                                                            {option}
                                                                        </Label>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        {isRanked ? (
                                                                            <div className="flex items-center space-x-2">
                                                                                <span className="text-lg font-bold text-green-600">
                                                                                    #{rank}
                                                                                </span>
                                                                                <Button
                                                                                    onClick={() => {
                                                                                        const newRankVotes = { ...rankVotes };
                                                                                        delete newRankVotes[index];
                                                                                        setRankVotes(newRankVotes);
                                                                                    }}
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                                                                >
                                                                                    Remove
                                                                                </Button>
                                                                            </div>
                                                                        ) : (
                                                                            <Button
                                                                                onClick={() => {
                                                                                    const nextRank = usedRanks.length + 1;
                                                                                    if (nextRank <= maxRanks) {
                                                                                        setRankVotes(prev => ({
                                                                                            ...prev,
                                                                                            [index]: nextRank
                                                                                        }));
                                                                                    }
                                                                                }}
                                                                                disabled={usedRanks.length >= maxRanks || !isVotingAllowed}
                                                                                variant="outline"
                                                                                size="sm"
                                                                            >
                                                                                Select as #{usedRanks.length + 1}
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm font-medium text-gray-700">
                                                                    Options Ranked:
                                                                </span>
                                                                <span className={`text-sm font-bold ${Object.keys(rankVotes).length === Math.min(selectedPoll.options.length, 3) ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {Object.keys(rankVotes).length}/{Math.min(selectedPoll.options.length, 3)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Submit button for private PBV/RBV */}
                                            <div className="flex justify-center">
                                                <Button
                                                    onClick={handleVoteSubmit}
                                                    disabled={
                                                        (selectedPoll.mode === "point" && totalPoints !== 100) ||
                                                        (selectedPoll.mode === "rank" && Object.keys(rankVotes).length < Math.min(selectedPoll.options.length, 3)) ||
                                                        isSubmitting ||
                                                        !isVotingAllowed ||
                                                        (votingContext.type === "self" && hasVoted) ||
                                                        isDelegatedContextVoted
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
                                                        : isDelegatedContextVoted
                                                            ? `Already Voted for ${votingContext.delegatorName}`
                                                        : votingContext.type === "delegated"
                                                            ? `Submit Vote for ${votingContext.delegatorName}`
                                                            : "Submit Vote"}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Delegation Panel - only for public polls and non-blind voting */}
                                    {selectedPoll.visibility === "public" && selectedPoll.groupId && (
                                        <div className="mb-6">
                                            <DelegationPanel
                                                poll={selectedPoll}
                                                userId={user?.id || ""}
                                                hasVoted={hasVoted}
                                                onDelegationChange={() => {
                                                    fetchPoll();
                                                    fetchVoteData();
                                                    setDelegationRefreshKey(k => k + 1);
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* For public polls, show different interface based on voting status */}
                                    {/* Show voting UI if user hasn't voted OR if they have pending delegations */}
                                    {hasVoted && activeDelegationCount === 0 && votingContext.type === "self" ? (
                                        <div className="space-y-6">
                                            {/* Show that user has voted with detailed vote information */}
                                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                <div className="flex items-center mb-3">
                                                    <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                                                    <div>
                                                        <h3 className="text-lg font-semibold text-green-900">Your Vote Details</h3>
                                                        <p className="text-sm text-green-700">
                                                            Your vote has been submitted. Results will be shown when the poll ends.
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Display vote details based on mode */}
                                                {(() => {
                                                    const voteData = voteStatus?.vote?.data;
                                                    if (!voteData) return null;

                                                    if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                        // Simple vote - show selected options
                                                        const selectedOptions = (voteData.data as string[]).map(index => selectedPoll.options[parseInt(index)]).filter(Boolean);
                                                        return (
                                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                                <p className="text-sm font-medium text-green-800 mb-2">Selected Options:</p>
                                                                <div className="space-y-1">
                                                                    {selectedOptions.map((option, i) => (
                                                                        <div key={i} className="flex items-center space-x-2">
                                                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                            <span className="text-sm text-green-700">{option}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (voteData.mode === "point" && typeof voteData.data === "object") {
                                                        // Point vote - show point distribution
                                                        const pointEntries = Object.entries(voteData.data as Record<string, number>);
                                                        return (
                                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                                <p className="text-sm font-medium text-green-800 mb-2">Your Point Distribution:</p>
                                                                <div className="space-y-2">
                                                                    {pointEntries.map(([optionIndex, points]) => {
                                                                        const option = selectedPoll.options[parseInt(optionIndex)];
                                                                        return (
                                                                            <div key={optionIndex} className="flex items-center justify-between">
                                                                                <span className="text-sm text-green-700">{option}</span>
                                                                                <span className="text-sm font-medium text-green-800 bg-green-100 px-2 py-1 rounded">
                                                                                    {points} points
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="mt-2 pt-2 border-t border-green-200">
                                                                    <span className="text-xs text-green-600">
                                                                        Total: {Object.values(voteData.data).reduce((sum: number, points: any) => sum + points, 0)} points
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                        // Rank vote - show ranking
                                                        const rawRankData = voteData.data[0]?.points;
                                                        // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                        const rankData = rawRankData?.ranks && typeof rawRankData.ranks === 'object' 
                                                            ? rawRankData.ranks 
                                                            : rawRankData;
                                                        if (rankData && typeof rankData === "object") {
                                                            const sortedRanks = Object.entries(rankData)
                                                                .filter(([, rank]) => typeof rank === 'number')
                                                                .sort(([, a], [, b]) => (a as number) - (b as number))
                                                                .map(([optionIndex, rank]) => ({
                                                                    option: selectedPoll.options[parseInt(optionIndex)],
                                                                    rank: rank as number
                                                                }));

                                                            return (
                                                                <div className="bg-white rounded-lg p-3 border border-green-200">
                                                                    <p className="text-sm font-medium text-green-800 mb-2">Your Ranking:</p>
                                                                    <div className="space-y-2">
                                                                        {sortedRanks.map((item, i) => (
                                                                            <div key={i} className="flex items-center justify-between">
                                                                                <span className="text-sm text-green-700">{item.option}</span>
                                                                                <span className="text-sm font-medium text-green-800 bg-green-100 px-2 py-1 rounded">
                                                                                    {item.rank === 1 ? '1st' : item.rank === 2 ? '2nd' : item.rank === 3 ? '3rd' : `${item.rank}th`} choice
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    }
                                                    return null;
                                                })()}
                                            </div>

                                            {/* Show voting options with user's choice highlighted */}
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                                    Voting Options:
                                                </h3>
                                                <div className="space-y-3">
                                                    {selectedPoll.options.map((option, index) => {
                                                        const isUserChoice = (() => {
                                                            const voteData = voteStatus?.vote?.data;
                                                            if (!voteData) return false;

                                                            if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                                return voteData.data.includes(index.toString());
                                                            } else if (voteData.mode === "point" && typeof voteData.data === "object") {
                                                                return voteData.data[index] > 0;
                                                            } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                                const rawRankData = voteData.data[0]?.points;
                                                                // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                                const rankData = rawRankData?.ranks && typeof rawRankData.ranks === 'object' 
                                                                    ? rawRankData.ranks 
                                                                    : rawRankData;
                                                                return rankData && typeof rankData[index] === 'number';
                                                            }
                                                            return false;
                                                        })();

                                                        const userChoiceDetails = (() => {
                                                            const voteData = voteStatus?.vote?.data;
                                                            if (!voteData) return null;

                                                            if (voteData.mode === "normal" && Array.isArray(voteData.data)) {
                                                                return voteData.data.includes(index.toString()) ? "← You voted for this option" : null;
                                                            } else if (voteData.mode === "point" && typeof voteData.data === "object") {
                                                                const points = voteData.data[index];
                                                                return points > 0 ? `← You gave ${points} points` : null;
                                                            } else if (voteData.mode === "rank" && Array.isArray(voteData.data)) {
                                                                const rawRankData = voteData.data[0]?.points;
                                                                // Handle both formats: { "0": 1 } or { "ranks": { "0": 1 } }
                                                                const rankData = rawRankData?.ranks && typeof rawRankData.ranks === 'object' 
                                                                    ? rawRankData.ranks 
                                                                    : rawRankData;
                                                                const rank = rankData?.[index];
                                                                return typeof rank === 'number' ? `← You ranked this ${rank}${rank === 1 ? 'st' : rank === 2 ? '2nd' : rank === 3 ? 'rd' : 'th'}` : null;
                                                            }
                                                            return null;
                                                        })();

                                                        return (
                                                            <div
                                                                key={index}
                                                                className={`flex items-center space-x-3 p-3 border rounded-lg ${isUserChoice
                                                                    ? 'bg-green-50 border-green-200'
                                                                    : 'bg-gray-50 border-gray-200 opacity-60'
                                                                    }`}
                                                            >
                                                                <div className="flex-1">
                                                                    <Label className={`text-base ${isUserChoice ? 'text-green-900 font-medium' : 'text-gray-500'
                                                                        }`}>
                                                                        {option}
                                                                    </Label>
                                                                    {userChoiceDetails && (
                                                                        <div className="mt-1 text-sm text-green-600">
                                                                            <span className="font-medium">{userChoiceDetails}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Show that user has voted when they still have delegations */}
                                            {hasVoted && activeDelegationCount > 0 && (
                                                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                                    <CheckCircle className="text-green-500 h-4 w-4 shrink-0" />
                                                    <p className="text-sm text-green-700">
                                                        Your vote has been submitted. You can still vote on behalf of users who delegated their vote to you.
                                                    </p>
                                                </div>
                                            )}
                                            
                                            {/* Regular Voting Interface based on poll mode */}
                                            {selectedPoll.mode === "normal" && (
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                                        {votingContext.type === "delegated" 
                                                            ? `Select choice for ${votingContext.delegatorName}:`
                                                            : "Select your choice:"}
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
                                                                        className={`text-base flex-1 py-2 ${isVotingAllowed
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
                                                            {votingContext.type === "delegated"
                                                                ? `Distribute points for ${votingContext.delegatorName}`
                                                                : "Distribute your points"}
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
                                                            {votingContext.type === "delegated"
                                                                ? `Distribute 100 points on behalf of ${votingContext.delegatorName}.`
                                                                : "You have 100 points to distribute. Assign points to each option based on your preference."}
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
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={pointVotes[index] || 0}
                                                                        onChange={(e) => {
                                                                            const input = e.target.value;
                                                                            // Allow only digits
                                                                            const numericValue = input.replace(/\D/g, '');
                                                                            const value = numericValue ? Math.min(Math.max(parseInt(numericValue, 10), 0), 100) : 0;
                                                                            setPointVotes(prev => ({
                                                                                ...prev,
                                                                                [index]: value
                                                                            }));
                                                                        }}
                                                                        onInput={(e) => {
                                                                            const target = e.target as HTMLInputElement;
                                                                            // Remove non-numeric characters and leading zeros
                                                                            const cleaned = target.value.replace(/\D/g, '');
                                                                            const value = cleaned ? Math.min(Math.max(parseInt(cleaned, 10), 0), 100) : 0;
                                                                            target.value = value.toString();
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
                                                                <span className={`text-sm font-bold ${totalPoints === 100 ? 'text-green-600' : 'text-red-600'
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

                                                                return `Rank ${currentRank} of ${maxRanks}`;
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
                                                            {votingContext.type === "delegated"
                                                                ? `Rank top 3 choices on behalf of ${votingContext.delegatorName}.`
                                                                : "Rank your top 3 choices from most preferred (1) to least preferred (3)."}
                                                        </p>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {selectedPoll.options.map((option, index) => {
                                                            const rank = rankVotes[index];
                                                            const isRanked = rank !== undefined;
                                                            const usedRanks = Object.values(rankVotes);
                                                            const maxRanks = Math.min(selectedPoll.options.length, 3);

                                                            return (
                                                                <div
                                                                    key={index}
                                                                    className={`flex items-center space-x-4 p-4 border rounded-lg ${isRanked ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
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
                                                                            {[1, 2, 3].map(rankNum => {
                                                                                const isRankUsed = usedRanks.includes(rankNum);
                                                                                const isCurrentOptionRank = rank === rankNum;
                                                                                return (
                                                                                    <option
                                                                                        key={rankNum}
                                                                                        value={rankNum}
                                                                                        disabled={isRankUsed && !isCurrentOptionRank}
                                                                                    >
                                                                                        {rankNum === 1 ? '1st' : rankNum === 2 ? '2nd' : '3rd'}
                                                                                    </option>
                                                                                );
                                                                            })}
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
                                                                <span className={`text-sm font-bold ${Object.keys(rankVotes).length === Math.min(selectedPoll.options.length, 3) ? 'text-green-600' : 'text-red-600'
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
                                                        !isVotingAllowed ||
                                                        isDelegatedContextVoted
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
                                                        : isDelegatedContextVoted
                                                            ? `Already Voted for ${votingContext.delegatorName}`
                                                        : votingContext.type === "delegated"
                                                            ? `Submit Vote for ${votingContext.delegatorName}`
                                                            : "Submit Vote"}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Signing Interface Modal */}
                    {showSigningInterface && signingVoteData && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg max-w-md w-full">
                                <SigningInterface
                                    pollId={pollId!}
                                    voteData={signingVoteData}
                                    delegationContext={signingDelegationContext}
                                    onSigningComplete={async (voteId) => {
                                        setShowSigningInterface(false);
                                        setIsSubmitting(false);
                                        setSigningVoteData(null);
                                        setSigningDelegationContext(undefined);

                                        toast({
                                            title: "Success!",
                                            description: signingDelegationContext?.delegatorName
                                                ? `Your vote has been signed and submitted for ${signingDelegationContext.delegatorName}.`
                                                : "Your vote has been signed and submitted.",
                                        });

                                        // Immediately try to fetch vote data, then retry after a short delay if needed
                                        const fetchWithRetry = async (retries = 3, delay = 1000) => {
                                            for (let i = 0; i < retries; i++) {
                                                try {
                                                    await fetchPoll();
                                                    await fetchVoteData();
                                                    // If successful, break out of retry loop
                                                    break;
                                                } catch (error) {
                                                    console.error(`Error during data refresh (attempt ${i + 1}/${retries}):`, error);
                                                    if (i < retries - 1) {
                                                        // Wait before retrying
                                                        await new Promise(resolve => setTimeout(resolve, delay));
                                                    }
                                                }
                                            }
                                        };

                                        // Try immediately, then retry if needed
                                        await fetchWithRetry();
                                        setDelegationRefreshKey(k => k + 1);

                                        // Clear current selections after successful signing
                                        setSelectedOption(null);
                                        setPointVotes({});
                                        setRankVotes({});
                                    }}
                                    onCancel={() => {
                                        setShowSigningInterface(false);
                                        setIsSubmitting(false);
                                        setSigningVoteData(null);
                                        setSigningDelegationContext(undefined);
                                    }}
                                />
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
                                                        {Object.entries(voteStatus.vote.points as Record<string, number>).map(([index, points]) => (
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
                                                        {Object.entries(voteStatus.vote.ranks as Record<string, string>).map(([rank, index]) => (
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

                    {/* Voter Activity Button - shows count always, opens details only after voting or poll ended (mobile only) */}
                    {(selectedPoll?.visibility as string) === "public" &&
                        resultsData?.voterDetails &&
                        resultsData.voterDetails.length > 0 && (
                            <div className="lg:hidden mt-6 pt-6 border-t border-gray-200">
                                <button
                                    onClick={() => {
                                        if (voteStatus?.hasVoted || hasVoted || !isVotingAllowed) {
                                            setShowMobileVoterActivity(true);
                                        } else {
                                            toast({
                                                title: "Vote first to see details",
                                                description: "You need to submit your vote before viewing who voted for what.",
                                                variant: "default"
                                            });
                                        }
                                    }}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                >
                                    <div className="flex items-center">
                                        <Users className="mr-2 h-5 w-5 text-gray-600" />
                                        <span className="text-sm font-medium text-gray-900">
                                            {voteStatus?.hasVoted || hasVoted || !isVotingAllowed ? "View Vote Activity" : "Vote Activity"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">
                                            {resultsData.voterDetails.length} {resultsData.voterDetails.length === 1 ? "vote" : "votes"}
                                        </span>
                                        {(voteStatus?.hasVoted || hasVoted || !isVotingAllowed) ? (
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            </div>
                        )}
                </div>

                {/* Vote Activity Sidebar — only for public polls with votes AND (user has voted OR poll ended) */}
                {(selectedPoll?.visibility as string) === "public" &&
                    resultsData?.voterDetails &&
                    resultsData.voterDetails.length > 0 &&
                    (voteStatus?.hasVoted || hasVoted || !isVotingAllowed) && (
                        <aside className="hidden lg:block w-80 shrink-0">
                            <div className="sticky top-6 card p-4 max-h-[calc(100vh-3rem)] overflow-y-auto">
                                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                                    <Users className="mr-2 h-4 w-4" />
                                    Vote Activity ({resultsData.voterDetails.length})
                                </h3>
                                <div className="space-y-2">
                                    {resultsData.voterDetails.map(
                                        (voter, index) => (
                                            <div
                                                key={voter.id || index}
                                                className="flex items-start p-2.5 bg-gray-50 rounded-lg"
                                            >
                                                <img
                                                    src={
                                                        voter.profileImageUrl ||
                                                        "/default-avatar.png"
                                                    }
                                                    alt={voter.firstName || "Voter"}
                                                    className="w-7 h-7 rounded-full mr-2.5 shrink-0 mt-0.5"
                                                    onError={(e) => {
                                                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                            voter.firstName || "U"
                                                        )}&background=dc2626&color=fff&size=28`;
                                                    }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1 min-w-0">
                                                            <span className="text-sm font-medium text-gray-900 truncate">
                                                                {voter.firstName &&
                                                                    voter.lastName
                                                                    ? `${voter.firstName} ${voter.lastName}`
                                                                    : voter.firstName || voter.email ||
                                                                    "Anonymous"}
                                                            </span>
                                                            {voter.castById && voter.castByName && voter.castById !== voter.id && (
                                                                <span className="text-xs text-blue-600 shrink-0" title={`Vote cast by ${voter.castByName} via delegation`}>
                                                                    (via {voter.castByName})
                                                                </span>
                                                            )}
                                                        </div>
                                                        {voter.createdAt && (
                                                            <span className="text-xs text-gray-400 ml-1.5 shrink-0">
                                                                {(() => {
                                                                    const diff = Date.now() - new Date(voter.createdAt).getTime();
                                                                    const mins = Math.floor(diff / 60000);
                                                                    if (mins < 1) return "now";
                                                                    if (mins < 60) return `${mins}m`;
                                                                    const hrs = Math.floor(mins / 60);
                                                                    if (hrs < 24) return `${hrs}h`;
                                                                    const days = Math.floor(hrs / 24);
                                                                    return `${days}d`;
                                                                })()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {voter.mode === "point" && voter.pointData ? (
                                                        <div className="mt-1.5 space-y-1">
                                                            {Object.entries(voter.pointData)
                                                                .filter(([, pts]) => (pts as number) > 0)
                                                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                                                .slice(0, 3)
                                                                .map(([idx, pts]) => (
                                                                    <div key={idx} className="flex items-center gap-1.5">
                                                                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-blue-500 rounded-full"
                                                                                style={{ width: `${pts}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] text-gray-500 w-14 text-right truncate" title={selectedPoll.options[parseInt(idx)]}>
                                                                            {pts}pts
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            {Object.entries(voter.pointData).filter(([, pts]) => (pts as number) > 0).length > 3 && (
                                                                <span className="text-[10px] text-gray-400">
                                                                    +{Object.entries(voter.pointData).filter(([, pts]) => (pts as number) > 0).length - 3} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : voter.mode === "rank" && voter.rankData ? (
                                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                                            {(() => {
                                                                // Handle both formats: { "0": 1, "1": 2 } or { "ranks": { "0": 1, "1": 2 } }
                                                                const actualRankData = voter.rankData.ranks && typeof voter.rankData.ranks === 'object' 
                                                                    ? voter.rankData.ranks 
                                                                    : voter.rankData;
                                                                return Object.entries(actualRankData)
                                                                    .filter(([, rank]) => typeof rank === 'number')
                                                                    .sort(([, a], [, b]) => (a as number) - (b as number))
                                                                    .map(([idx, rank]) => (
                                                                        <span
                                                                            key={idx}
                                                                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                                rank === 1
                                                                                    ? "bg-yellow-100 text-yellow-800"
                                                                                    : rank === 2
                                                                                    ? "bg-gray-100 text-gray-700"
                                                                                    : "bg-orange-50 text-orange-700"
                                                                            }`}
                                                                            title={selectedPoll.options[parseInt(idx)]}
                                                                        >
                                                                            #{rank} {(selectedPoll.options[parseInt(idx)] || "").slice(0, 8)}{(selectedPoll.options[parseInt(idx)] || "").length > 8 ? "..." : ""}
                                                                        </span>
                                                                    ));
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-500">
                                                            Voted: {selectedPoll.options[parseInt(voter.optionId)] || "Unknown"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </aside>
                    )}
            </div>

            {/* Mobile Vote Activity Drawer */}
            {showMobileVoterActivity &&
                (selectedPoll?.visibility as string) === "public" &&
                resultsData?.voterDetails &&
                resultsData.voterDetails.length > 0 &&
                (voteStatus?.hasVoted || hasVoted || !isVotingAllowed) && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="lg:hidden fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
                            onClick={() => setShowMobileVoterActivity(false)}
                        />
                        {/* Drawer */}
                        <div className="lg:hidden fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white shadow-xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
                            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                    <Users className="mr-2 h-5 w-5" />
                                    Vote Activity ({resultsData.voterDetails.length})
                                </h3>
                                <button
                                    onClick={() => setShowMobileVoterActivity(false)}
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                    aria-label="Close"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="p-4 space-y-2">
                                {resultsData.voterDetails.map(
                                    (voter, index) => (
                                        <div
                                            key={voter.id || index}
                                            className="flex items-start p-3 bg-gray-50 rounded-lg"
                                        >
                                            <img
                                                src={
                                                    voter.profileImageUrl ||
                                                    "/default-avatar.png"
                                                }
                                                alt={voter.firstName || "Voter"}
                                                className="w-8 h-8 rounded-full mr-3 shrink-0 mt-0.5"
                                                onError={(e) => {
                                                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                        voter.firstName || "U"
                                                    )}&background=dc2626&color=fff&size=32`;
                                                }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        <span className="text-sm font-medium text-gray-900 truncate">
                                                            {voter.firstName &&
                                                                voter.lastName
                                                                ? `${voter.firstName} ${voter.lastName}`
                                                                : voter.firstName || voter.email ||
                                                                "Anonymous"}
                                                        </span>
                                                        {voter.castById && voter.castByName && voter.castById !== voter.id && (
                                                            <span className="text-xs text-blue-600 shrink-0" title={`Vote cast by ${voter.castByName} via delegation`}>
                                                                (via {voter.castByName})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {voter.createdAt && (
                                                        <span className="text-xs text-gray-400 ml-2 shrink-0">
                                                            {(() => {
                                                                const diff = Date.now() - new Date(voter.createdAt).getTime();
                                                                const mins = Math.floor(diff / 60000);
                                                                if (mins < 1) return "now";
                                                                if (mins < 60) return `${mins}m`;
                                                                const hrs = Math.floor(mins / 60);
                                                                if (hrs < 24) return `${hrs}h`;
                                                                const days = Math.floor(hrs / 24);
                                                                return `${days}d`;
                                                            })()}
                                                        </span>
                                                    )}
                                                </div>
                                                {voter.mode === "point" && voter.pointData ? (
                                                    <div className="mt-1.5 space-y-1.5">
                                                        {Object.entries(voter.pointData)
                                                            .filter(([, pts]) => (pts as number) > 0)
                                                            .sort(([, a], [, b]) => (b as number) - (a as number))
                                                            .slice(0, 4)
                                                            .map(([idx, pts]) => (
                                                                <div key={idx} className="flex items-center gap-2">
                                                                    <span className="text-xs text-gray-600 w-20 truncate" title={selectedPoll.options[parseInt(idx)]}>
                                                                        {selectedPoll.options[parseInt(idx)] || `#${idx}`}
                                                                    </span>
                                                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-blue-500 rounded-full"
                                                                            style={{ width: `${pts}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs text-gray-500 w-8 text-right">
                                                                        {pts}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        {Object.entries(voter.pointData).filter(([, pts]) => (pts as number) > 0).length > 4 && (
                                                            <span className="text-xs text-gray-400">
                                                                +{Object.entries(voter.pointData).filter(([, pts]) => (pts as number) > 0).length - 4} more options
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : voter.mode === "rank" && voter.rankData ? (
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {(() => {
                                                            // Handle both formats: { "0": 1, "1": 2 } or { "ranks": { "0": 1, "1": 2 } }
                                                            const actualRankData = voter.rankData.ranks && typeof voter.rankData.ranks === 'object' 
                                                                ? voter.rankData.ranks 
                                                                : voter.rankData;
                                                            return Object.entries(actualRankData)
                                                                .filter(([, rank]) => typeof rank === 'number')
                                                                .sort(([, a], [, b]) => (a as number) - (b as number))
                                                                .map(([idx, rank]) => (
                                                                    <span
                                                                        key={idx}
                                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                                            rank === 1
                                                                                ? "bg-yellow-100 text-yellow-800"
                                                                                : rank === 2
                                                                                ? "bg-gray-100 text-gray-700"
                                                                                : "bg-orange-50 text-orange-700"
                                                                        }`}
                                                                    >
                                                                        #{rank} {(selectedPoll.options[parseInt(idx)] || "Option").slice(0, 12)}{(selectedPoll.options[parseInt(idx)] || "").length > 12 ? "..." : ""}
                                                                    </span>
                                                                ));
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-500">
                                                        Voted: {selectedPoll.options[parseInt(voter.optionId)] || "Unknown"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </>
                )}
        </div>
    );
}