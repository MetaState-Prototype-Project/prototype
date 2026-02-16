import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Calendar, Users } from "lucide-react";
import type { GroupWithMembers, GroupSuggestion } from "@shared/schema";

interface GroupCardProps {
  group: GroupWithMembers;
  suggestion?: GroupSuggestion;
  showSuggestionInfo?: boolean;
  isUserMember?: boolean;
}

export default function GroupCard({ 
  group, 
  suggestion, 
  showSuggestionInfo = false, 
  isUserMember = false 
}: GroupCardProps) {
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);
  
  const joinGroupMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/groups/${group.id}/join`);
    },
    onSuccess: () => {
      toast({
        title: "Joined Group",
        description: `You have successfully joined ${group.name}!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/groups"] });
      if (suggestion) {
        queryClient.invalidateQueries({ queryKey: ["/api/group-suggestions"] });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to join group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateSuggestionStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (suggestion) {
        await apiRequest("PUT", `/api/group-suggestions/${suggestion.id}/status`, { status });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/group-suggestions"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
        return;
      }
    },
  });

  const handleJoinGroup = async () => {
    setIsJoining(true);
    try {
      await joinGroupMutation.mutateAsync();
      if (suggestion) {
        await updateSuggestionStatusMutation.mutateAsync("joined");
      }
    } catch (error) {
      // Error handling is done in the mutations
    } finally {
      setIsJoining(false);
    }
  };

  const handleDismissSuggestion = async () => {
    if (suggestion) {
      await updateSuggestionStatusMutation.mutateAsync("dismissed");
      toast({
        title: "Suggestion Dismissed",
        description: "This group suggestion has been removed.",
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "technical":
      case "coding":
      case "programming":
        return "💻";
      case "creative":
      case "photography":
      case "art":
        return "🎨";
      case "fitness":
      case "sports":
        return "🏃";
      case "social":
      case "networking":
        return "🤝";
      case "business":
        return "💼";
      default:
        return "👥";
    }
  };

  return (
    <Card className="hover:shadow-lg hover:border-purple-200 transition-all duration-200 bg-gradient-to-r from-white to-purple-50/20 border-purple-100/50 h-full">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center shadow-sm">
            <Users className="h-6 w-6 text-purple-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate">{group.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-sm text-gray-500">{group.memberCount} members</span>
              {group.location && false && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-500 truncate">{group.location}</span>
                </>
              )}
            </div>
          </div>
          
          {showSuggestionInfo && suggestion && (
            <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-1 rounded-full shrink-0">
              {suggestion.score}% match
            </span>
          )}
        </div>
        
        <div className="mb-3 min-h-[3rem] flex items-end justify-between gap-3">
          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed flex-1 self-start">
            {group.description}
          </p>
          <div className="flex items-end space-x-2 shrink-0">
            {showSuggestionInfo && suggestion && false && (
              <Button
                variant="outline"
                size="sm"
                className="text-gray-600 border-gray-300 hover:bg-gray-50"
                onClick={handleDismissSuggestion}
                disabled={updateSuggestionStatusMutation.isPending}
              >
                Dismiss
              </Button>
            )}
            {!isUserMember ? (
              <Button
                className="bg-gradient-to-r from-purple-200 to-purple-300 hover:from-purple-300 hover:to-purple-400 text-purple-900 border-purple-300 hover:border-purple-400 shadow-sm transition-all duration-200"
                size="sm"
                onClick={handleJoinGroup}
                disabled={isJoining || joinGroupMutation.isPending}
              >
                {isJoining ? "Joining..." : "Join Group"}
              </Button>
            ) : (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Member
              </Badge>
            )}
          </div>
        </div>
        
        {showSuggestionInfo && suggestion?.reason && false && (
          <p className="text-xs text-purple-600 mb-3 italic line-clamp-1 flex-grow">
            {suggestion?.reason}
          </p>
        )}
        
        <div className="flex-grow"></div>
      </CardContent>
    </Card>
  );
}
