import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MapPin, UserPlus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface WishUserCardProps {
  user: any;
  matchPercentage: number;
  matchReason: string;
}

export default function WishUserCard({ user, matchPercentage, matchReason }: WishUserCardProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  
  const getCompatibilityColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-blue-600";
    if (score >= 70) return "text-purple-600";
    return "text-gray-600";
  };

  const connectMutation = useMutation({
    mutationFn: async () => {
      // This would typically create a connection request or match
      await apiRequest("POST", `/api/connections`, { 
        targetUserId: user.id,
        type: "wish_suggestion"
      });
    },
    onSuccess: () => {
      toast({
        title: "Connection Request Sent",
        description: `Your connection request has been sent to ${user.firstName}!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send connection request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectMutation.mutateAsync();
    } catch (error) {
      // Error handling is done in the mutation
    } finally {
      setIsConnecting(false);
    }
  };

  const topSkills = user.skills?.slice(0, 3) || [];
  const topInterests = user.interests?.slice(0, 2) || [];

  return (
    <Card className="hover:shadow-lg hover:border-blue-200 transition-all duration-200 bg-gradient-to-r from-white to-blue-50/20 border-blue-100/50 h-full">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center space-x-3 mb-4">
          <Avatar className="w-12 h-12 ring-2 ring-blue-100 ring-offset-1">
            <AvatarImage src={user.profileImageUrl || ""} alt={`${user.firstName}'s profile`} />
            <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base truncate">
              {user.firstName} {user.lastName}
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              {user.profile?.location && (
                <>
                  <MapPin className="h-3 w-3 text-gray-400" />
                  <span className="text-sm text-gray-500 truncate">{user.profile.location}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className={`text-lg font-bold ${getCompatibilityColor(matchPercentage)}`}>
              {matchPercentage}%
            </div>
            <div className="text-xs text-gray-500">Match</div>
          </div>
        </div>

        {/* Bio */}
        {user.profile?.bio && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {user.profile.bio}
          </p>
        )}

        {/* Match Reason */}
        <div className="bg-blue-50/50 rounded-lg p-3 mb-4 border border-blue-100/50">
          <p className="text-sm text-gray-700 leading-relaxed">
            {matchReason}
          </p>
        </div>

        {/* Skills and Interests */}
        <div className="flex-1 space-y-3">
          {topSkills.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Skills</p>
              <div className="flex flex-wrap gap-1">
                {topSkills.map((skill: any, index: number) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                  >
                    {skill.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {topInterests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Interests</p>
              <div className="flex flex-wrap gap-1">
                {topInterests.map((interest: any, index: number) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    {interest.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Connect Button */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <Button 
            onClick={handleConnect}
            disabled={isConnecting || connectMutation.isPending}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0"
            size="sm"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {isConnecting || connectMutation.isPending ? "Connecting..." : "Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}