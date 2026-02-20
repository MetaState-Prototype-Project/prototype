"use client";

import { useState, useEffect } from "react";
import { Vote, Users, ChevronDown, ChevronUp, CheckCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { pollApi, type Poll, type Delegation } from "@/lib/pollApi";

interface DelegatedVotingInterfaceProps {
  poll: Poll;
  userId: string;
  onVoteSubmitted: () => void;
}

interface DelegatedVote {
  delegationId: string;
  delegatorId: string;
  delegatorName: string;
  delegatorAvatar?: string;
  selectedOption: number | null;
  pointVotes: Record<number, number>;
  rankVotes: Record<number, number>;
  isSubmitted: boolean;
}

export function DelegatedVotingInterface({ poll, userId, onVoteSubmitted }: DelegatedVotingInterfaceProps) {
  const { toast } = useToast();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [delegatedVotes, setDelegatedVotes] = useState<DelegatedVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDelegations, setExpandedDelegations] = useState<Set<string>>(new Set());
  const [submittingFor, setSubmittingFor] = useState<string | null>(null);

  useEffect(() => {
    fetchDelegations();
  }, [poll.id, userId]);

  const fetchDelegations = async () => {
    try {
      setIsLoading(true);
      const received = await pollApi.getReceivedDelegations(poll.id);
      setDelegations(received);
      
      setDelegatedVotes(
        received.map((d) => ({
          delegationId: d.id,
          delegatorId: d.delegatorId,
          delegatorName: d.delegator?.name || d.delegator?.ename || "Unknown",
          delegatorAvatar: d.delegator?.avatarUrl,
          selectedOption: null,
          pointVotes: {},
          rankVotes: {},
          isSubmitted: d.status === "used",
        }))
      );
    } catch (error) {
      console.error("Failed to fetch delegations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = (delegationId: string) => {
    setExpandedDelegations((prev) => {
      const next = new Set(prev);
      if (next.has(delegationId)) {
        next.delete(delegationId);
      } else {
        next.add(delegationId);
      }
      return next;
    });
  };

  const updateNormalVoteSelection = (delegationId: string, optionIndex: number) => {
    setDelegatedVotes((prev) =>
      prev.map((v) =>
        v.delegationId === delegationId ? { ...v, selectedOption: optionIndex } : v
      )
    );
  };

  const updatePointVote = (delegationId: string, optionIndex: number, points: number) => {
    setDelegatedVotes((prev) =>
      prev.map((v) =>
        v.delegationId === delegationId
          ? { ...v, pointVotes: { ...v.pointVotes, [optionIndex]: points } }
          : v
      )
    );
  };

  const updateRankVote = (delegationId: string, optionIndex: number, rank: number) => {
    setDelegatedVotes((prev) =>
      prev.map((v) => {
        if (v.delegationId !== delegationId) return v;
        const newRanks = { ...v.rankVotes };
        Object.keys(newRanks).forEach((key) => {
          if (newRanks[parseInt(key)] === rank) {
            delete newRanks[parseInt(key)];
          }
        });
        if (rank > 0) {
          newRanks[optionIndex] = rank;
        } else {
          delete newRanks[optionIndex];
        }
        return { ...v, rankVotes: newRanks };
      })
    );
  };

  const resetPointVotes = (delegationId: string) => {
    setDelegatedVotes((prev) =>
      prev.map((v) =>
        v.delegationId === delegationId ? { ...v, pointVotes: {} } : v
      )
    );
  };

  const resetRankVotes = (delegationId: string) => {
    setDelegatedVotes((prev) =>
      prev.map((v) =>
        v.delegationId === delegationId ? { ...v, rankVotes: {} } : v
      )
    );
  };

  const getTotalPoints = (pointVotes: Record<number, number>) => {
    return Object.values(pointVotes).reduce((sum, pts) => sum + pts, 0);
  };

  const isVoteReady = (delegatedVote: DelegatedVote): boolean => {
    if (poll.mode === "normal") {
      return delegatedVote.selectedOption !== null;
    } else if (poll.mode === "point") {
      return getTotalPoints(delegatedVote.pointVotes) === 100;
    } else if (poll.mode === "rank") {
      const minRanks = Math.min(poll.options.length, 3);
      return Object.keys(delegatedVote.rankVotes).length >= minRanks;
    }
    return false;
  };

  const getVoteStatusText = (delegatedVote: DelegatedVote): string => {
    if (poll.mode === "normal") {
      return delegatedVote.selectedOption !== null
        ? `Selected: ${poll.options[delegatedVote.selectedOption]}`
        : "No selection yet";
    } else if (poll.mode === "point") {
      const total = getTotalPoints(delegatedVote.pointVotes);
      return total > 0 ? `${total}/100 points distributed` : "No points distributed yet";
    } else if (poll.mode === "rank") {
      const rankedCount = Object.keys(delegatedVote.rankVotes).length;
      const minRanks = Math.min(poll.options.length, 3);
      return rankedCount > 0 ? `${rankedCount}/${minRanks} options ranked` : "No options ranked yet";
    }
    return "";
  };

  const submitDelegatedVote = async (delegatedVote: DelegatedVote) => {
    if (!isVoteReady(delegatedVote)) return;

    try {
      setSubmittingFor(delegatedVote.delegationId);
      
      let voteData: any;
      if (poll.mode === "normal") {
        voteData = { optionId: delegatedVote.selectedOption };
      } else if (poll.mode === "point") {
        voteData = { points: delegatedVote.pointVotes };
      } else if (poll.mode === "rank") {
        voteData = delegatedVote.rankVotes;
      }

      await pollApi.castDelegatedVote(
        poll.id,
        delegatedVote.delegatorId,
        voteData,
        poll.mode
      );

      toast({
        title: "Vote Submitted",
        description: `Vote cast on behalf of ${delegatedVote.delegatorName}`,
      });

      setDelegatedVotes((prev) =>
        prev.map((v) =>
          v.delegationId === delegatedVote.delegationId ? { ...v, isSubmitted: true } : v
        )
      );

      onVoteSubmitted();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit delegated vote",
        variant: "destructive",
      });
    } finally {
      setSubmittingFor(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeDelegations = delegatedVotes.filter((v) => !v.isSubmitted);
  const completedDelegations = delegatedVotes.filter((v) => v.isSubmitted);

  if (delegatedVotes.length === 0) {
    return null;
  }

  const renderVotingInterface = (delegatedVote: DelegatedVote) => {
    if (poll.mode === "normal") {
      return (
        <RadioGroup
          value={delegatedVote.selectedOption?.toString()}
          onValueChange={(value) =>
            updateNormalVoteSelection(delegatedVote.delegationId, parseInt(value))
          }
          className="space-y-2"
        >
          {poll.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem
                value={index.toString()}
                id={`${delegatedVote.delegationId}-option-${index}`}
              />
              <Label
                htmlFor={`${delegatedVote.delegationId}-option-${index}`}
                className="flex-1 p-2 text-sm cursor-pointer hover:bg-gray-50 rounded"
              >
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    } else if (poll.mode === "point") {
      const totalPoints = getTotalPoints(delegatedVote.pointVotes);
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className={totalPoints === 100 ? "text-green-600 font-medium" : "text-gray-600"}>
                {totalPoints}/100 points
              </span>
              {totalPoints !== 100 && (
                <span className="text-gray-400 ml-2">
                  ({100 - totalPoints} remaining)
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetPointVotes(delegatedVote.delegationId)}
              className="text-xs h-7"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
          {poll.options.map((option, index) => {
            const currentPoints = delegatedVote.pointVotes[index] || 0;
            const maxAvailable = 100 - totalPoints + currentPoints;
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{option}</Label>
                  <span className="text-sm font-medium w-12 text-right">{currentPoints}</span>
                </div>
                <Slider
                  value={[currentPoints]}
                  onValueChange={([value]) => updatePointVote(delegatedVote.delegationId, index, value)}
                  max={maxAvailable}
                  step={1}
                  className="w-full"
                />
              </div>
            );
          })}
        </div>
      );
    } else if (poll.mode === "rank") {
      const minRanks = Math.min(poll.options.length, 3);
      const rankedCount = Object.keys(delegatedVote.rankVotes).length;
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Rank at least {minRanks} options ({rankedCount}/{minRanks} done)
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetRankVotes(delegatedVote.delegationId)}
              className="text-xs h-7"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
          {poll.options.map((option, index) => {
            const currentRank = delegatedVote.rankVotes[index];
            const usedRanks = Object.values(delegatedVote.rankVotes);
            return (
              <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                <span className="text-sm">{option}</span>
                <select
                  value={currentRank || ""}
                  onChange={(e) => {
                    const rank = parseInt(e.target.value) || 0;
                    updateRankVote(delegatedVote.delegationId, index, rank);
                  }}
                  className="px-2 py-1 border rounded text-sm min-w-[80px]"
                >
                  <option value="">No rank</option>
                  {[1, 2, 3].map((rank) => {
                    const isUsed = usedRanks.includes(rank) && currentRank !== rank;
                    return (
                      <option key={rank} value={rank} disabled={isUsed}>
                        {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
                        {isUsed ? " (used)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Delegated Votes
          {activeDelegations.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeDelegations.length} to cast
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Vote on behalf of users who delegated their vote to you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeDelegations.map((delegatedVote) => (
          <Collapsible
            key={delegatedVote.delegationId}
            open={expandedDelegations.has(delegatedVote.delegationId)}
            onOpenChange={() => toggleExpanded(delegatedVote.delegationId)}
          >
            <div className="border rounded-lg bg-white">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={delegatedVote.delegatorAvatar} />
                      <AvatarFallback>{delegatedVote.delegatorName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-medium">{delegatedVote.delegatorName}</p>
                      <p className="text-xs text-gray-500">
                        {getVoteStatusText(delegatedVote)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isVoteReady(delegatedVote) && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Ready</Badge>
                    )}
                    {expandedDelegations.has(delegatedVote.delegationId) ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 pt-1 border-t">
                  <p className="text-xs text-gray-500 mb-3">
                    Voting for {delegatedVote.delegatorName} ({poll.mode === "normal" ? "Simple" : poll.mode === "point" ? "Points" : "Ranked"} voting)
                  </p>
                  {renderVotingInterface(delegatedVote)}
                  <Button
                    onClick={() => submitDelegatedVote(delegatedVote)}
                    disabled={!isVoteReady(delegatedVote) || submittingFor === delegatedVote.delegationId}
                    className="w-full mt-4"
                    size="sm"
                  >
                    {submittingFor === delegatedVote.delegationId ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Vote className="h-3 w-3 mr-2" />
                        Submit Vote for {delegatedVote.delegatorName}
                      </>
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}

        {completedDelegations.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Completed delegated votes
            </p>
            {completedDelegations.map((delegatedVote) => (
              <div
                key={delegatedVote.delegationId}
                className="flex items-center gap-3 p-2 bg-green-50 rounded-lg mb-1"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={delegatedVote.delegatorAvatar} />
                  <AvatarFallback className="text-xs">{delegatedVote.delegatorName[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-gray-600">{delegatedVote.delegatorName}</span>
                <Badge variant="outline" className="ml-auto text-xs bg-green-100 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Voted
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
