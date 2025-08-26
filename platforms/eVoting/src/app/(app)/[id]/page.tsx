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
                                                No blind vote results available for this private poll.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : selectedPoll.visibility !== "private" ? (
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
                                                
                                                if (resultsData.mode === "point") {
                                                    // Point-based voting: show total points and average
                                                    displayValue = `${result.totalPoints} points (avg: ${result.averagePoints})`;
                                                    isWinner = result.totalPoints === Math.max(...resultsData.results.map(r => r.totalPoints));
                                                    percentage = resultsData.totalVotes > 0 ? (result.totalPoints / resultsData.results.reduce((sum, r) => sum + r.totalPoints, 0)) * 100 : 0;
                                                } else if (resultsData.mode === "rank") {
                                                    // Rank-based voting: show percentage only
                                                    displayValue = `${result.totalScore} points`;
                                                    isWinner = result.totalScore === Math.max(...resultsData.results.map(r => r.totalScore));
                                                    percentage = resultsData.totalVotes > 0 ? (result.totalScore / resultsData.results.reduce((sum, r) => sum + r.totalScore, 0)) * 100 : 0;
                                                    // For rank voting, just show the percentage in the display
                                                    displayValue = `${percentage.toFixed(1)}%`;
                                                } else {
                                                    // Normal voting: show votes and percentage
                                                    displayValue = `${result.votes} votes`;
                                                    isWinner = result.votes === Math.max(...resultsData.results.map(r => r.votes));
                                                    percentage = resultsData.totalVotes > 0 ? (result.votes / resultsData.totalVotes) * 100 : 0;
                                                }
                                                
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
                                                                    {result.option}
                                                                </span>
                                                                {isWinner && (
                                                                    <Badge variant="success" className="bg-green-500 text-white">
                                                                        🏆 Winner
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <span className="text-sm text-gray-600">
                                                                {displayValue} ({percentage.toFixed(1)}%)
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
                                                No results available for this poll.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* For active polls, show user's vote choice */}
                                {selectedPoll.visibility !== "private" && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <div className="flex items-center">
                                            <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
                                            <div>
                                                <p className="text-sm font-medium text-green-900">
                                                    You voted:{" "}
                                                    {
                                                        (() => {
                                                            if (voteStatus?.vote?.data?.mode === "normal" && Array.isArray(voteStatus.vote.data.data)) {
                                                                const optionIndex = parseInt(voteStatus.vote.data.data[0] || "0");
                                                                return selectedPoll.options[optionIndex] || "Unknown option";
                                                            } else if (voteStatus?.vote?.data?.mode === "point" && Array.isArray(voteStatus.vote.data.data)) {
                                                                const pointData = voteStatus.vote.data.data;
                                                                const totalPoints = pointData.reduce((sum, item) => sum + (item.points || 0), 0);
                                                                return `distributed ${totalPoints} points across options`;
                                                            } else if (voteStatus?.vote?.data?.mode === "rank" && Array.isArray(voteStatus.vote.data.data)) {
                                                                const rankData = voteStatus.vote.data.data;
                                                                const sortedRanks = [...rankData].sort((a, b) => a.points - b.points);
                                                                const topChoice = selectedPoll.options[parseInt(sortedRanks[0]?.option || "0")];
                                                                return `ranked options (${topChoice} as 1st choice)`;
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
                                                if (voteStatus?.vote?.data?.mode === "normal" && Array.isArray(voteStatus.vote.data.data)) {
                                                    return voteStatus.vote.data.data.includes(index.toString());
                                                } else if (voteStatus?.vote?.data?.mode === "point" && Array.isArray(voteStatus.vote.data.data)) {
                                                    const pointData = voteStatus.vote.data.data;
                                                    const optionPoints = pointData.find(item => item.option === index.toString())?.points || 0;
                                                    return optionPoints > 0;
                                                } else if (voteStatus?.vote?.data?.mode === "rank" && Array.isArray(voteStatus.vote.data.data)) {
                                                    const rankData = voteStatus.vote.data.data;
                                                    return rankData.some(item => item.option === index.toString());
                                                }
                                                return false;
                                            })();
                                            
                                            const userChoiceDetails = (() => {
                                                if (voteStatus?.vote?.data?.mode === "normal" && Array.isArray(voteStatus.vote.data.data)) {
                                                    return voteStatus.vote.data.data.includes(index.toString()) ? "← You voted for this option" : null;
                                                } else if (voteStatus?.vote?.data?.mode === "point" && Array.isArray(voteStatus.vote.data.data)) {
                                                    const pointData = voteStatus.vote.data.data;
                                                    const optionPoints = pointData.find(item => item.option === index.toString())?.points || 0;
                                                    return optionPoints > 0 ? `← You gave ${optionPoints} points` : null;
                                                } else if (voteStatus?.vote?.data?.mode === "rank" && Array.isArray(voteStatus.vote.data.data)) {
                                                    const rankData = voteStatus.vote.data.data;
                                                    const optionRank = rankData.find(item => item.option === index.toString())?.points;
                                                    return optionRank ? `← You ranked this ${optionRank}${optionRank === 1 ? 'st' : optionRank === 2 ? 'nd' : optionRank === 3 ? 'rd' : 'th'}` : null;
                                                }
                                                return null;
                                            })();
                                            
                                            return (
                                                <div
                                                    key={index}
                                                    className={`flex items-center space-x-3 p-3 border rounded-lg ${
                                                        isUserChoice 
                                                            ? 'bg-green-50 border-green-200' 
                                                            : 'bg-gray-50 border-gray-200 opacity-60'
                                                    }`}
                                                >
                                                    <div className="flex-1">
                                                        <Label className={`text-base ${
                                                            isUserChoice ? 'text-green-900 font-medium' : 'text-gray-500'
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
                ) : voteStatus?.hasVoted === true ? (
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
                                            const selectedOptions = voteData.data.map(index => selectedPoll.options[parseInt(index)]).filter(Boolean);
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
                                            const pointEntries = Object.entries(voteData.data);
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
                                            const rankData = voteData.data[0]?.points;
                                            if (rankData && typeof rankData === "object") {
                                                const sortedRanks = Object.entries(rankData)
                                                    .sort(([,a], [,b]) => (a as number) - (b as number))
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
                                                    const rankData = voteData.data[0]?.points;
                                                    return rankData && rankData[index];
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
                                                    const rankData = voteData.data[0]?.points;
                                                    const rank = rankData?.[index];
                                                    return rank ? `← You ranked this ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}` : null;
                                                }
                                                return null;
                                            })();
                                            
                                            return (
                                                <div
                                                    key={index}
                                                    className={`flex items-center space-x-3 p-3 border rounded-lg ${
                                                        isUserChoice 
                                                            ? 'bg-green-50 border-green-200' 
                                                            : 'bg-gray-50 border-gray-200 opacity-60'
                                                    }`}
                                                >
                                                    <div className="flex-1">
                                                        <Label className={`text-base ${
                                                            isUserChoice ? 'text-green-900 font-medium' : 'text-gray-500'
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
                            // For private polls, show BlindVotingInterface (which handles both voting and reveal)
                            <BlindVotingInterface
                                poll={selectedPoll}
                                userId={user?.id || ""}
                                hasVoted={hasVoted}
                                onVoteSubmitted={onVoteSubmitted}
                            />
                        )}
                    </>
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
                                {/* For public polls, show different interface based on voting status */}
                                {hasVoted ? (
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
                                                    const selectedOptions = voteData.data.map(index => selectedPoll.options[parseInt(index)]).filter(Boolean);
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
                                                    const pointEntries = Object.entries(voteData.data);
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
                                                    const rankData = voteData.data[0]?.points;
                                                    if (rankData && typeof rankData === "object") {
                                                        const sortedRanks = Object.entries(rankData)
                                                            .sort(([,a], [,b]) => (a as number) - (b as number))
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
                                                            const rankData = voteData.data[0]?.points;
                                                            return rankData && rankData[index];
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
                                                            const rankData = voteData.data[0]?.points;
                                                            const rank = rankData?.[index];
                                                            return rank ? `← You ranked this ${rank}${rank === 1 ? 'st' : rank === 2 ? '2nd' : rank === 3 ? 'rd' : 'th'}` : null;
                                                        }
                                                        return null;
                                                    })();
                                                    
                                                    return (
                                                        <div
                                                            key={index}
                                                            className={`flex items-center space-x-3 p-3 border rounded-lg ${
                                                                isUserChoice 
                                                                    ? 'bg-green-50 border-green-200' 
                                                                    : 'bg-gray-50 border-gray-200 opacity-60'
                                                            }`}
                                                        >
                                                            <div className="flex-1">
                                                                <Label className={`text-base ${
                                                                    isUserChoice ? 'text-green-900 font-medium' : 'text-gray-500'
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
                                                        Rank your top 3 choices from most preferred (1) to least preferred (3).
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