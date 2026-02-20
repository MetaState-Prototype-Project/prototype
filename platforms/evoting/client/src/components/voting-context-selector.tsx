"use client";

import { useState, useEffect } from "react";
import { Users, User, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pollApi, type Delegation } from "@/lib/pollApi";

interface VotingContextSelectorProps {
  pollId: string;
  userId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  onContextChange: (context: VotingContext) => void;
  onDelegationsLoaded?: (delegations: Delegation[]) => void;
  onDelegationStateChange?: (state: {
    activeCount: number;
    usedCount: number;
    hasHistory: boolean;
  }) => void;
  disabled?: boolean;
  refreshTrigger?: number;
  hasVotedForSelf?: boolean;
}

export interface VotingContext {
  type: "self" | "delegated";
  delegatorId?: string;
  delegatorName?: string;
  delegationId?: string;
}

export function VotingContextSelector({
  pollId,
  userId,
  currentUserName,
  currentUserAvatar,
  onContextChange,
  onDelegationsLoaded,
  onDelegationStateChange,
  disabled = false,
  refreshTrigger = 0,
  hasVotedForSelf = false,
}: VotingContextSelectorProps) {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>("self");
  const [isLoading, setIsLoading] = useState(true);
  const activeDelegations = delegations.filter((d) => d.status === "active");
  const usedDelegations = delegations.filter((d) => d.status === "used");

  useEffect(() => {
    fetchDelegations();
  }, [pollId, userId, refreshTrigger]);

  useEffect(() => {
    // If self vote is already cast, ensure context never stays on "self".
    // This also handles the "" state used by Select before a delegation is chosen.
    if (
      hasVotedForSelf &&
      activeDelegations.length > 0 &&
      (selectedContext === "self" || selectedContext === "")
    ) {
      const firstDelegation = activeDelegations[0];
      onContextChange({
        type: "delegated",
        delegatorId: firstDelegation.delegatorId,
        delegatorName: firstDelegation.delegator?.name || firstDelegation.delegator?.ename || "Unknown",
        delegationId: firstDelegation.id,
      });
      setSelectedContext(firstDelegation.id);
    }
  }, [hasVotedForSelf, activeDelegations, selectedContext, onContextChange]);

  useEffect(() => {
    if (selectedContext === "self" || selectedContext === "") {
      return;
    }

    const selectedDelegation = delegations.find((d) => d.id === selectedContext);
    if (!selectedDelegation || selectedDelegation.status !== "active") {
      if (activeDelegations.length > 0) {
        const nextActiveDelegation = activeDelegations[0];
        setSelectedContext(nextActiveDelegation.id);
        onContextChange({
          type: "delegated",
          delegatorId: nextActiveDelegation.delegatorId,
          delegatorName: nextActiveDelegation.delegator?.name || nextActiveDelegation.delegator?.ename || "Unknown",
          delegationId: nextActiveDelegation.id,
        });
      } else {
        setSelectedContext("self");
        onContextChange({ type: "self" });
      }
    }
  }, [selectedContext, delegations, activeDelegations, onContextChange]);

  const fetchDelegations = async () => {
    try {
      setIsLoading(true);
      const receivedDelegations = await pollApi.getReceivedDelegations(pollId, true);
      const activeCount = receivedDelegations.filter((d) => d.status === "active").length;
      const usedCount = receivedDelegations.filter((d) => d.status === "used").length;
      setDelegations(receivedDelegations);
      onDelegationsLoaded?.(receivedDelegations.filter((d) => d.status === "active"));
      onDelegationStateChange?.({
        activeCount,
        usedCount,
        hasHistory: receivedDelegations.length > 0,
      });
    } catch (error) {
      console.error("Failed to fetch delegations:", error);
      onDelegationStateChange?.({
        activeCount: 0,
        usedCount: 0,
        hasHistory: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContextChange = (value: string) => {
    setSelectedContext(value);

    if (value === "self") {
      onContextChange({ type: "self" });
    } else {
      const delegation = delegations.find((d) => d.id === value && d.status === "active");
      if (delegation) {
        onContextChange({
          type: "delegated",
          delegatorId: delegation.delegatorId,
          delegatorName:
            delegation.delegator?.name || delegation.delegator?.ename || "Unknown",
          delegationId: delegation.id,
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse h-12 bg-gray-100 rounded-lg" />
    );
  }

  // Hide the selector only when the user has never received any delegation.
  // If they have current or past delegations, keep it visible for context/history.
  if (delegations.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Voting as:</span>
        </div>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          {activeDelegations.length} active
          {usedDelegations.length > 0 ? `, ${usedDelegations.length} used` : ""}
        </Badge>
      </div>

      <Select
        value={selectedContext}
        onValueChange={handleContextChange}
        disabled={disabled}
      >
        <SelectTrigger className="mt-3 bg-white">
          <SelectValue>
            {selectedContext === "self" ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={currentUserAvatar} />
                  <AvatarFallback className="text-xs">
                    {currentUserName[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span>Myself ({currentUserName})</span>
              </div>
            ) : (
              (() => {
                const delegation = activeDelegations.find(
                  (d) => d.id === selectedContext
                );
                const usedDelegation = usedDelegations.find((d) => d.id === selectedContext);
                if (!delegation && usedDelegation) {
                  const usedName =
                    usedDelegation.delegator?.name ||
                    usedDelegation.delegator?.ename ||
                    "Unknown";
                  return `On behalf of ${usedName} (already voted)`;
                }
                if (!delegation) return "Select...";
                const name =
                  delegation.delegator?.name ||
                  delegation.delegator?.ename ||
                  "Unknown";
                return (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={delegation.delegator?.avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {name[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span>On behalf of {name}</span>
                  </div>
                );
              })()
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="self" disabled={hasVotedForSelf}>
            <div className="flex items-center gap-2">
              <User className={`h-4 w-4 ${hasVotedForSelf ? "text-gray-300" : "text-gray-500"}`} />
              <span className={hasVotedForSelf ? "text-gray-400" : ""}>
                {hasVotedForSelf ? "Myself (already voted)" : "Vote for myself"}
              </span>
            </div>
          </SelectItem>
          {activeDelegations.map((delegation) => {
            const name =
              delegation.delegator?.name ||
              delegation.delegator?.ename ||
              "Unknown";
            return (
              <SelectItem key={delegation.id} value={delegation.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={delegation.delegator?.avatarUrl} />
                    <AvatarFallback className="text-[10px]">
                      {name[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span>On behalf of {name}</span>
                </div>
              </SelectItem>
            );
          })}
          {usedDelegations.map((delegation) => {
            const name =
              delegation.delegator?.name ||
              delegation.delegator?.ename ||
              "Unknown";
            return (
              <SelectItem key={delegation.id} value={delegation.id} disabled>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={delegation.delegator?.avatarUrl} />
                    <AvatarFallback className="text-[10px]">
                      {name[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-gray-500">On behalf of {name} (already voted)</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {selectedContext !== "self" && activeDelegations.some((d) => d.id === selectedContext) && (
        <p className="mt-2 text-xs text-blue-700">
          You are voting on behalf of someone who delegated their vote to you.
        </p>
      )}
      {hasVotedForSelf && (
        <p className="mt-2 text-xs text-green-700 flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
          You have already voted for yourself. Select a delegator above to cast their vote.
        </p>
      )}
      {activeDelegations.length === 0 && (
        <p className="mt-2 text-xs text-gray-600">
          No active delegations remain for this poll.
        </p>
      )}
    </div>
  );
}
