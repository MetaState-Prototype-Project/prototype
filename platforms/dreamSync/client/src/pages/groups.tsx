import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import GroupCard from "@/components/group-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, Plus, Lightbulb, Star } from "lucide-react";
import type { GroupWithMembers, GroupSuggestion } from "@shared/schema";

export default function Groups() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  // Fetch all groups
  const { data: allGroups, isLoading: groupsLoading } = useQuery<GroupWithMembers[]>({
    queryKey: ["/api/groups"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch user's groups
  const { data: userGroups, isLoading: userGroupsLoading } = useQuery<GroupWithMembers[]>({
    queryKey: ["/api/user/groups"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch group suggestions
  const { data: groupSuggestions, isLoading: suggestionsLoading } = useQuery<
    (GroupSuggestion & { group: GroupWithMembers })[]
  >({
    queryKey: ["/api/group-suggestions"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Generate group suggestions mutation
  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/group-suggestions/generate");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Generated new group suggestions for you!",
      });
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to generate group suggestions. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-muted/30" />;
  }

  // Get user's group IDs for checking membership
  const userGroupIds = userGroups?.map(group => group.id) || [];

  // Filter groups based on search and category
  const filteredGroups = allGroups?.filter((group) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = group.name.toLowerCase().includes(searchLower);
      const descMatch = group.description?.toLowerCase().includes(searchLower);
      const categoryMatch = group.category.toLowerCase().includes(searchLower);
      
      if (!nameMatch && !descMatch && !categoryMatch) return false;
    }
    
    // Category filter
    if (categoryFilter !== "all" && group.category !== categoryFilter) {
      return false;
    }
    
    return true;
  }) || [];

  // Get unique categories for filter
  const categories = Array.from(new Set(allGroups?.map(group => group.category) || []));

  const renderGroupGrid = (groupList: GroupWithMembers[], showSuggestionInfo = false) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {groupList.map((group) => (
        <GroupCard 
          key={group.id} 
          group={group}
          isUserMember={userGroupIds.includes(group.id)}
          showSuggestionInfo={showSuggestionInfo}
        />
      ))}
    </div>
  );

  const renderSuggestionGrid = (suggestions: (GroupSuggestion & { group: GroupWithMembers })[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {suggestions.map((suggestion) => (
        <GroupCard 
          key={suggestion.id} 
          group={suggestion.group}
          suggestion={suggestion}
          isUserMember={userGroupIds.includes(suggestion.group.id)}
          showSuggestionInfo={true}
        />
      ))}
    </div>
  );

  const renderEmptyState = (title: string, description: string, showGenerateButton = false) => (
    <div className="text-center py-12">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Users className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="text-xl font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
      {showGenerateButton && (
        <Button 
          className="btn-dreamy text-white hover:opacity-90 transition-opacity"
          onClick={() => generateSuggestionsMutation.mutate()}
          disabled={generateSuggestionsMutation.isPending}
        >
          <Lightbulb className="h-4 w-4 mr-2" />
          {generateSuggestionsMutation.isPending ? "Generating..." : "Generate Suggestions"}
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Groups</h1>
              <p className="text-gray-600">
                Discover and join communities that match your interests and goals.
              </p>
            </div>
            <Button 
              className="btn-dreamy text-white hover:opacity-90 transition-opacity"
              onClick={() => generateSuggestionsMutation.mutate()}
              disabled={generateSuggestionsMutation.isPending}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              {generateSuggestionsMutation.isPending ? "Generating..." : "Get Suggestions"}
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {groupsLoading ? <Skeleton className="h-6 w-8" /> : allGroups?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Available Groups</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center mr-3">
                    <Plus className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {userGroupsLoading ? <Skeleton className="h-6 w-8" /> : userGroups?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Your Groups</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center mr-3">
                    <Star className="h-5 w-5 text-secondary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {suggestionsLoading ? <Skeleton className="h-6 w-8" /> : groupSuggestions?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Suggestions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search groups by name, description, or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Groups Content */}
        <Tabs defaultValue="suggested" className="space-y-6">
          <TabsList>
            <TabsTrigger value="suggested">
              Suggested ({groupSuggestions?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="all">
              All Groups ({filteredGroups.length})
            </TabsTrigger>
            <TabsTrigger value="my-groups">
              My Groups ({userGroups?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggested">
            {suggestionsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-10 w-full mt-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : groupSuggestions?.length === 0 ? (
              renderEmptyState(
                "No group suggestions yet",
                "Complete your profile to get personalized group recommendations based on your interests and skills.",
                true
              )
            ) : (
              renderSuggestionGrid(groupSuggestions || [])
            )}
          </TabsContent>

          <TabsContent value="all">
            {groupsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-10 w-full mt-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              renderEmptyState(
                "No groups found",
                "Try adjusting your search filters or check back later for new groups."
              )
            ) : (
              renderGroupGrid(filteredGroups)
            )}
          </TabsContent>

          <TabsContent value="my-groups">
            {userGroupsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-10 w-full mt-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : userGroups?.length === 0 ? (
              renderEmptyState(
                "You haven't joined any groups yet",
                "Browse the suggested or all groups tabs to find communities that match your interests."
              )
            ) : (
              renderGroupGrid(userGroups || [])
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
