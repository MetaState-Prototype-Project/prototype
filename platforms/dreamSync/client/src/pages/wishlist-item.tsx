import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import Navigation from "@/components/navigation";
import UserCard from "@/components/user-card";
import WishUserCard from "@/components/wish-user-card";
import GroupCard from "@/components/group-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Users, Calendar } from "lucide-react";
import type { WishlistItem } from "@shared/schema";

export default function WishlistItemPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [match, params] = useRoute("/wishlist/:id");
  const [location, setLocation] = useLocation();
  const wishlistItemId = params?.id;

  // Check for authentication
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

  // Fetch wishlist item details
  const { data: wishlistItem, isLoading: itemLoading } = useQuery({
    queryKey: ["/api/wishlist", wishlistItemId],
    enabled: !!wishlistItemId && !!isAuthenticated,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return false;
      }
      return failureCount < 3;
    },
  });

  // Fetch AI-generated suggestions for this wish
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["/api/wishlist", wishlistItemId, "suggestions"],
    enabled: !!wishlistItemId && !!isAuthenticated,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent": return "🔥 Urgent!";
      case "high": return "High Priority";
      case "medium": return "Medium Priority";
      case "low": return "Low Priority";
      default: return "Unknown Priority";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-700 border-red-200";
      case "high": return "bg-orange-100 text-orange-700 border-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low": return "bg-green-100 text-green-700 border-green-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const isNewItem = (item: WishlistItem) => {
    const createdAt = new Date(item.createdAt!);
    const now = new Date();
    const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    return diffInMinutes <= 5; // 5-minute window for "new" items
  };

  const handleGoBack = () => {
    setLocation("/wishlist");
  };

  if (!match) {
    return <div>Page not found</div>;
  }

  if (!isAuthenticated || isLoading) {
    return <div>Loading...</div>;
  }

  if (itemLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-48 bg-gray-200 rounded mb-8"></div>
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!wishlistItem) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Wishlist Item Not Found</h2>
            <p className="text-gray-600 mb-6">The wishlist item you're looking for doesn't exist or has been removed.</p>
            <Button onClick={handleGoBack} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Wishlist
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={handleGoBack}
          className="mb-6 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Wishlist
        </Button>

        {/* Wishlist Item Header Card - Softer Design */}
        <Card className="mb-8 border-0 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="relative">
              {/* Soft gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50"></div>
              
              {/* Content */}
              <div className="relative p-8">
                <div className="flex items-start justify-between mb-4">
                  <h1 className="text-3xl font-bold text-gray-900 leading-tight">
                    {wishlistItem.title}
                  </h1>
                  <div className="flex items-center gap-3">
                    <Badge className={`${getPriorityColor(wishlistItem.priority)} border`}>
                      {getPriorityLabel(wishlistItem.priority)}
                    </Badge>
                    {isNewItem(wishlistItem) && (
                      <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
                        New!
                      </Badge>
                    )}
                  </div>
                </div>
                
                {wishlistItem.description && (
                  <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                    <p className="text-gray-700 leading-relaxed text-lg">
                      {wishlistItem.description}
                    </p>
                  </div>
                )}
                
                <div className="flex items-center gap-4 mt-6 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Added {new Date(wishlistItem.createdAt!).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI-Generated Suggestions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* People Who Can Help */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              People Who Can Help
            </h3>
            <div className="space-y-4">
              {suggestionsLoading ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-32 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : suggestions?.users?.length > 0 ? (
                suggestions.users.map((userSuggestion: any) => (
                  <WishUserCard 
                    key={userSuggestion.id}
                    user={userSuggestion}
                    matchPercentage={userSuggestion.relevanceScore}
                    matchReason={userSuggestion.reason}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No user suggestions found for this wish yet.</p>
                  <p className="text-sm mt-2">Our AI is analyzing the platform to find the best matches.</p>
                </div>
              )}
            </div>
          </div>

          {/* Relevant Groups */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-500" />
              Relevant Groups
            </h3>
            <div className="space-y-4">
              {suggestionsLoading ? (
                <div className="space-y-4">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-32 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : suggestions?.groups?.length > 0 ? (
                suggestions.groups.map((groupSuggestion: any) => (
                  <GroupCard 
                    key={groupSuggestion.id}
                    group={groupSuggestion}
                    matchPercentage={groupSuggestion.relevanceScore}
                    matchReason={groupSuggestion.reason}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Eye className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No group suggestions found for this wish yet.</p>
                  <p className="text-sm mt-2">Our AI is analyzing available groups to find relevant matches.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}