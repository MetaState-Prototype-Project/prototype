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
  disabled?: boolean;
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
  disabled = false,
}: VotingContextSelectorProps) {
  const [activeDelegations, setActiveDelegations] = useState<Delegation[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>("self");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDelegations();
  }, [pollId, userId]);

  const fetchDelegations = async () => {
    try {
      setIsLoading(true);
      const delegations = await pollApi.getReceivedDelegations(pollId);
      setActiveDelegations(delegations);
    } catch (error) {
      console.error("Failed to fetch delegations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContextChange = (value: string) => {
    setSelectedContext(value);

    if (value === "self") {
      onContextChange({ type: "self" });
    } else {
      const delegation = activeDelegations.find((d) => d.id === value);
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

  if (activeDelegations.length === 0) {
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
          {activeDelegations.length} delegation{activeDelegations.length !== 1 ? "s" : ""} received
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
          <SelectItem value="self">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span>Vote for myself</span>
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
        </SelectContent>
      </Select>

      {selectedContext !== "self" && (
        <p className="mt-2 text-xs text-blue-700">
          You are voting on behalf of someone who delegated their vote to you.
        </p>
      )}
    </div>
  );
}
