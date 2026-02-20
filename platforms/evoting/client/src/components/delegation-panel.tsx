"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, UserMinus, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { pollApi, type Poll, type Delegation, type DelegationEligibility } from "@/lib/pollApi";
import { DelegatePickerDialog } from "./delegate-picker-dialog";

interface DelegationPanelProps {
  poll: Poll;
  userId: string;
  hasVoted: boolean;
  onDelegationChange?: () => void;
}

export function DelegationPanel({ poll, userId, hasVoted, onDelegationChange }: DelegationPanelProps) {
  const { toast } = useToast();
  const [canDelegate, setCanDelegate] = useState<DelegationEligibility | null>(null);
  const [myDelegation, setMyDelegation] = useState<Delegation | null>(null);
  const [receivedDelegations, setReceivedDelegations] = useState<Delegation[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Delegation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDelegatePicker, setShowDelegatePicker] = useState(false);

  useEffect(() => {
    fetchDelegationData();
  }, [poll.id, userId]);

  const fetchDelegationData = async () => {
    try {
      setIsLoading(true);
      const [eligibility, delegation, received, pending] = await Promise.all([
        pollApi.canPollHaveDelegation(poll.id),
        pollApi.getMyDelegation(poll.id),
        pollApi.getReceivedDelegations(poll.id),
        pollApi.getPendingDelegationsForPoll(poll.id),
      ]);
      
      setCanDelegate(eligibility);
      setMyDelegation(delegation);
      setReceivedDelegations(received);
      setPendingRequests(pending);
    } catch (error) {
      console.error("Failed to fetch delegation data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeDelegation = async () => {
    try {
      await pollApi.revokeDelegation(poll.id);
      toast({
        title: "Delegation Revoked",
        description: "Your vote delegation has been revoked.",
      });
      fetchDelegationData();
      onDelegationChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke delegation",
        variant: "destructive",
      });
    }
  };

  const handleAcceptDelegation = async (delegationId: string) => {
    try {
      await pollApi.acceptDelegation(delegationId);
      toast({
        title: "Delegation Accepted",
        description: "You can now vote on behalf of this user.",
      });
      fetchDelegationData();
      onDelegationChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept delegation",
        variant: "destructive",
      });
    }
  };

  const handleRejectDelegation = async (delegationId: string) => {
    try {
      await pollApi.rejectDelegation(delegationId);
      toast({
        title: "Delegation Declined",
        description: "The delegation request has been declined.",
      });
      fetchDelegationData();
      onDelegationChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject delegation",
        variant: "destructive",
      });
    }
  };

  const handleDelegateSelected = async (delegateId: string) => {
    try {
      await pollApi.requestDelegation(poll.id, delegateId);
      toast({
        title: "Delegation Requested",
        description: "Your delegation request has been sent.",
      });
      setShowDelegatePicker(false);
      fetchDelegationData();
      onDelegationChange?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request delegation",
        variant: "destructive",
      });
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

  if (!canDelegate?.canDelegate) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Delegation Not Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700">{canDelegate?.reason || "Delegation is not available for this poll."}</p>
        </CardContent>
      </Card>
    );
  }

  const statusBadge = (status: Delegation["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "active":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case "used":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle className="h-3 w-3 mr-1" />Vote Cast</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
      case "revoked":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><XCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* My Delegation Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Vote Delegation
          </CardTitle>
          <CardDescription>Delegate your vote to another group member</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {myDelegation ? (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={myDelegation.delegate?.avatarUrl} />
                  <AvatarFallback>{myDelegation.delegate?.name?.[0] || myDelegation.delegate?.ename?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{myDelegation.delegate?.name || myDelegation.delegate?.ename}</p>
                  <p className="text-xs text-gray-500">Your delegate</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(myDelegation.status)}
                {(myDelegation.status === "pending" || myDelegation.status === "active") && (
                  <Button variant="outline" size="sm" onClick={handleRevokeDelegation}>
                    <UserMinus className="h-3 w-3 mr-1" />
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ) : hasVoted ? (
            <p className="text-sm text-gray-500">You have already voted on this poll.</p>
          ) : receivedDelegations.length > 0 ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                You have received {receivedDelegations.length} delegation{receivedDelegations.length !== 1 ? "s" : ""}. 
                Use the "Voting as" selector above to vote on behalf of others.
              </p>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowDelegatePicker(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Delegate My Vote
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pending Requests (as delegate) */}
      {pendingRequests.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-800">
              <Clock className="h-4 w-4" />
              Pending Delegation Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((delegation) => (
              <div key={delegation.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={delegation.delegator?.avatarUrl} />
                    <AvatarFallback>{delegation.delegator?.name?.[0] || delegation.delegator?.ename?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{delegation.delegator?.name || delegation.delegator?.ename}</p>
                    <p className="text-xs text-gray-500">Wants to delegate their vote to you</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleAcceptDelegation(delegation.id)}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRejectDelegation(delegation.id)}>
                    <XCircle className="h-3 w-3 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Received Delegations (active) */}
      {receivedDelegations.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-800">
              <Users className="h-4 w-4" />
              Delegated Votes ({receivedDelegations.length})
            </CardTitle>
            <CardDescription>You can vote on behalf of these users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {receivedDelegations.map((delegation) => (
              <div key={delegation.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={delegation.delegator?.avatarUrl} />
                    <AvatarFallback>{delegation.delegator?.name?.[0] || delegation.delegator?.ename?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium">{delegation.delegator?.name || delegation.delegator?.ename}</p>
                </div>
                {statusBadge(delegation.status)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <DelegatePickerDialog
        open={showDelegatePicker}
        onOpenChange={setShowDelegatePicker}
        groupId={poll.groupId || ""}
        currentUserId={userId}
        onSelect={handleDelegateSelected}
      />
    </div>
  );
}
