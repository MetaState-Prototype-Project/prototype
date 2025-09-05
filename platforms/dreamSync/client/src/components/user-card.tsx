import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, MapPin } from "lucide-react";
import type { MatchWithUsers } from "@shared/schema";

interface UserCardProps {
  match: MatchWithUsers;
  currentUserId: string;
  showFullDetails?: boolean;
}

export default function UserCard({ match, currentUserId, showFullDetails = false }: UserCardProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Determine which user is the match (not the current user)
  const matchedUser = match.userId1 === currentUserId ? match.user2 : match.user1;
  
  const updateMatchStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PUT", `/api/matches/${match.id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update match status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await updateMatchStatusMutation.mutateAsync("connected");
      toast({
        title: "Connection Request Sent",
        description: `Your connection request has been sent to ${matchedUser.firstName}!`,
      });
    } catch (error) {
      // Error handling is done in the mutation
    } finally {
      setIsConnecting(false);
    }
  };

  const getCompatibilityColor = (score: number) => {
    if (score >= 90) return "text-accent";
    if (score >= 80) return "text-primary";
    if (score >= 70) return "text-secondary";
    return "text-gray-600";
  };

  const topSkills = matchedUser.skills?.slice(0, 3) || [];
  const topHobbies = matchedUser.hobbies?.slice(0, 2) || [];

  return (
    <Card className="hover:shadow-lg hover:border-blue-200 transition-all duration-200 bg-gradient-to-r from-white to-blue-50/20 border-blue-100/50 h-full">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center space-x-3 mb-4">
          <Avatar className="w-12 h-12 ring-2 ring-blue-100 ring-offset-1">
            <AvatarImage src={matchedUser.profileImageUrl || ""} alt={`${matchedUser.firstName}'s profile`} />
            <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700">
              {matchedUser.firstName?.[0]}{matchedUser.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate">{matchedUser.firstName} {matchedUser.lastName}</h3>
            <div className="flex items-center space-x-2 mt-1">
              {matchedUser.profile?.location && (
                <>
                  <MapPin className="h-3 w-3" />
                  <span className="text-sm text-gray-500 truncate">{matchedUser.profile.location}</span>
                </>
              )}
            </div>
          </div>
          
          <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full shrink-0">
            {match.compatibilityScore}% match
          </span>
        </div>
        
        <div className="mb-3 min-h-[3rem] flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1 flex-1">
            {topSkills.map((skill) => (
              <Badge key={skill.id} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
                {skill.name}
              </Badge>
            ))}
            {topHobbies.map((hobby) => (
              <Badge key={hobby.id} variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-300">
                {hobby.name}
              </Badge>
            ))}
          </div>
          <div className="flex items-end space-x-2 shrink-0">
            {match.status === "pending" ? (
              <>
                {false && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-gray-600 border-gray-300 hover:bg-gray-50"
                    onClick={() => updateMatchStatusMutation.mutate("dismissed")}
                    disabled={updateMatchStatusMutation.isPending}
                  >
                    Pass
                  </Button>
                )}
                <Button
                  className="bg-gradient-to-r from-blue-200 to-blue-300 hover:from-blue-300 hover:to-blue-400 text-blue-900 border-blue-300 hover:border-blue-400 shadow-sm transition-all duration-200"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </Button>
              </>
            ) : (
              <div className="text-sm text-gray-500 italic">
                {match.status === "connected" ? "Connection sent" : 
                 match.status === "dismissed" ? "Dismissed" : 
                 "Status unknown"}
              </div>
            )}
          </div>
        </div>
        
        {showFullDetails && match.matchReason && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2 flex-grow">
            {match.matchReason}
          </p>
        )}
        
        {!showFullDetails && false && (
          <p className="text-xs text-blue-600 mb-3 italic flex-grow">
            Looking for: {matchedUser.wishlistItems?.slice(0, 2).map(w => w.title).join(", ") || "Mutual connections"}
          </p>
        )}
        
        <div className="flex-grow"></div>
      </CardContent>
    </Card>
  );
}
