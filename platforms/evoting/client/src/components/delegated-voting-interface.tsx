"use client";

import { useState, useEffect } from "react";
import { Vote, Users, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

  const updateVoteSelection = (delegationId: string, optionIndex: number) => {
    setDelegatedVotes((prev) =>
      prev.map((v) =>
        v.delegationId === delegationId ? { ...v, selectedOption: optionIndex } : v
      )
    );
  };

  const submitDelegatedVote = async (delegatedVote: DelegatedVote) => {
    if (delegatedVote.selectedOption === null) return;

    try {
      setSubmittingFor(delegatedVote.delegationId);
      
      await pollApi.castDelegatedVote(
        poll.id,
        delegatedVote.delegatorId,
        { optionId: delegatedVote.selectedOption },
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

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Delegated Votes
          <Badge variant="secondary" className="ml-2">
            {activeDelegations.length} pending
          </Badge>
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
                        {delegatedVote.selectedOption !== null
                          ? `Selected: ${poll.options[delegatedVote.selectedOption]}`
                          : "No selection yet"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {delegatedVote.selectedOption !== null && (
                      <Badge variant="outline" className="text-xs">Ready</Badge>
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
                    Voting for {delegatedVote.delegatorName}
                  </p>
                  <RadioGroup
                    value={delegatedVote.selectedOption?.toString()}
                    onValueChange={(value) =>
                      updateVoteSelection(delegatedVote.delegationId, parseInt(value))
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
                  <Button
                    onClick={() => submitDelegatedVote(delegatedVote)}
                    disabled={delegatedVote.selectedOption === null || submittingFor === delegatedVote.delegationId}
                    className="w-full mt-3"
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
