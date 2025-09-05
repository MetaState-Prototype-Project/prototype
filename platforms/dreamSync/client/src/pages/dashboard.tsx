import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import FindMatchesModal from "@/components/find-matches-modal";
import AddWishlistModal from "@/components/add-wishlist-modal";

import UserCard from "@/components/user-card";
import GroupCard from "@/components/group-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Plus, Lightbulb } from "lucide-react";
import type { UserWithProfile, MatchWithUsers, GroupSuggestion, GroupWithMembers } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [findMatchesOpen, setFindMatchesOpen] = useState(false);
  const [addWishlistOpen, setAddWishlistOpen] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const handleAddWishlist = () => {
    setAddWishlistOpen(true);
  };

  // Fetch user profile
  const { data: userProfile, isLoading: profileLoading } = useQuery<UserWithProfile>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch user stats
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalMatches: number;
    newMatches: number;
    suggestedGroups: number;
  }>({
    queryKey: ["/api/stats"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch recent matches
  const { data: matches, isLoading: matchesLoading } = useQuery<MatchWithUsers[]>({
    queryKey: ["/api/matches"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch AI-powered suggestions (both users and groups)
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<
    Array<{
      id: string;
      targetType: 'user' | 'group';
      reason: string;
      score: number;
      user?: UserWithProfile;
      group?: GroupWithMembers;
    }>
  >({
    queryKey: ["/api/suggestions"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Initialize dashboard on first load (auto-generate suggestions if none exist)
  const initializeDashboard = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/dashboard/initialize");
    },
    onSuccess: () => {
      // Silently refresh data after initialization
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
    },
    onError: (error) => {
      // Silently handle errors for initialization
      console.log("Dashboard initialization completed or skipped");
    },
  });

  // Auto-initialize dashboard on first authenticated load
  useEffect(() => {
    if (isAuthenticated && userProfile && !initializeDashboard.data) {
      initializeDashboard.mutate();
    }
  }, [isAuthenticated, userProfile]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  // COMPLETELY SEPARATE data - no mixing!
  const latestMatchesData = matches?.slice(0, 3) || [];  // Manual search results only
  const latestSuggestionsData = suggestions?.slice(0, 3) || [];  // AI recommendations only

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {/* Quick Actions - Top of Page */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div 
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/50 p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-blue-200/25 hover:border-blue-300/60 hover:bg-gradient-to-br hover:from-blue-100 hover:via-indigo-100 hover:to-purple-100 hover:scale-[1.02]"
            onClick={() => setFindMatchesOpen(true)}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex items-center justify-center group-hover:from-blue-200 group-hover:via-indigo-200 group-hover:to-purple-200 transition-all duration-300 group-hover:scale-110">
                <Search className="h-6 w-6 text-blue-600 group-hover:text-blue-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-900 transition-colors">
                  Find New Matches
                </h3>
                <p className="text-sm text-gray-600 group-hover:text-blue-700/80 transition-colors">Discover people who share your interests</p>
              </div>
            </div>
          </div>

          <div 
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/50 p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-emerald-200/25 hover:border-emerald-300/60 hover:bg-gradient-to-br hover:from-emerald-100 hover:via-teal-100 hover:to-cyan-100 hover:scale-[1.02]"
            onClick={() => window.location.href = "/suggestions"}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-100 via-teal-100 to-cyan-100 flex items-center justify-center group-hover:from-emerald-200 group-hover:via-teal-200 group-hover:to-cyan-200 transition-all duration-300 group-hover:scale-110">
                <Users className="h-6 w-6 text-emerald-600 group-hover:text-emerald-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-emerald-900 transition-colors">Explore Suggestions</h3>
                <p className="text-sm text-gray-600 group-hover:text-emerald-700/80 transition-colors">Discover people and groups tailored for you</p>
              </div>
            </div>
          </div>

          <div 
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border border-amber-200/50 p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-amber-200/25 hover:border-amber-300/60 hover:bg-gradient-to-br hover:from-amber-100 hover:via-orange-100 hover:to-yellow-100 hover:scale-[1.02]"
            onClick={handleAddWishlist}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-100 flex items-center justify-center group-hover:from-amber-200 group-hover:via-orange-200 group-hover:to-yellow-200 transition-all duration-300 group-hover:scale-110">
                <Plus className="h-6 w-6 text-amber-600 group-hover:text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-amber-900 transition-colors">Add Wishlist Item</h3>
                <p className="text-sm text-gray-600 group-hover:text-amber-700/80 transition-colors">Share what you're looking to achieve</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid - Mixed Users and Groups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Latest Matches - User searched results (both users and groups) */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Latest Matches</h2>
                  <p className="text-sm text-gray-500">Your search results</p>
                </div>
                <Button 
                  className="btn-dreamy text-white hover:opacity-90 transition-opacity"
                  size="sm"
                  onClick={() => setLocation("/matches")}
                >
                  View All
                </Button>
              </div>
              
              {matchesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-xl">
                      <div className="flex items-center space-x-3 mb-3">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-full mb-2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : latestMatchesData.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No matches yet</h3>
                  <p className="text-gray-600 mb-4">
                    Complete your profile and find your first matches
                  </p>
                  <Button onClick={() => setFindMatchesOpen(true)}>
                    Find Matches
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestMatchesData.map((match, index) => (
                    <UserCard key={match.id} match={match} currentUserId={user?.id || ""} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest Suggestions - AI-powered recommendations (both users and groups) */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Latest Suggestions</h2>
                  <p className="text-sm text-gray-500">AI-powered recommendations</p>
                </div>
                <Button 
                  className="btn-dreamy text-white hover:opacity-90 transition-opacity"
                  size="sm"
                  onClick={() => setLocation("/suggestions")}
                >
                  View All
                </Button>
              </div>

              {suggestionsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-xl">
                      <div className="flex items-center space-x-3 mb-3">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-full mb-2" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : latestSuggestionsData.length === 0 ? (
                <div className="text-center py-12">
                  <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions yet</h3>
                  <p className="text-gray-600 mb-4">
                    Complete your profile to get AI-powered recommendations
                  </p>
                  <Button 
                    onClick={() => setLocation("/profile")}
                    className="btn-dreamy text-white hover:opacity-90 transition-opacity"
                  >
                    Complete Profile
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestSuggestionsData.map((suggestion, index) => {
                    if (suggestion.targetType === 'user' && suggestion.user) {
                      // User suggestion (AI recommendation for learning/growth)
                      return (
                        <UserCard 
                          key={suggestion.id} 
                          match={{ 
                            id: suggestion.id,
                            userId1: user?.id || "",
                            userId2: suggestion.user.id,
                            user1: user as UserWithProfile,
                            user2: suggestion.user,
                            compatibilityScore: suggestion.score,
                            status: 'active',
                            createdAt: new Date()
                          } as MatchWithUsers} 
                          currentUserId={user?.id || ""} 
                        />
                      );
                    } else if (suggestion.targetType === 'group' && suggestion.group) {
                      // Group suggestion
                      return (
                        <GroupCard 
                          key={suggestion.id} 
                          group={suggestion.group} 
                          suggestion={{
                            id: suggestion.id,
                            createdAt: new Date(),
                            status: 'pending',
                            userId: user?.id || "",
                            reason: suggestion.reason,
                            targetType: 'group',
                            targetId: suggestion.group.id,
                            score: suggestion.score
                          }}
                          showSuggestionInfo={true}
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Find Matches Modal */}
      <FindMatchesModal
        open={findMatchesOpen}
        onOpenChange={setFindMatchesOpen}
      />

      {/* Add Wishlist Modal */}
      <AddWishlistModal
        open={addWishlistOpen}
        onOpenChange={setAddWishlistOpen}
        editingItem={null}
      />
    </div>
  );
}
