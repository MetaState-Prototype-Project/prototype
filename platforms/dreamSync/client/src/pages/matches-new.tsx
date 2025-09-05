import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Search, MoreHorizontal, Eye, UserPlus, Users, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { MatchWithUsers, GroupSuggestion, GroupWithMembers } from "@shared/schema";

export default function MatchesNew() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  // Fetch matches and group suggestions
  const { data: matches, isLoading: matchesLoading } = useQuery<MatchWithUsers[]>({
    queryKey: ["/api/matches"],
    enabled: !!user,
  });

  const { data: groupSuggestions, isLoading: groupSuggestionsLoading } = useQuery<(GroupSuggestion & { group: GroupWithMembers })[]>({
    queryKey: ["/api/group-suggestions"],
    enabled: !!user,
  });

  const getOtherUser = (match: MatchWithUsers) => {
    return match.userId1 === user?.id ? match.user2 : match.user1;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 80) return "bg-blue-500";
    if (score >= 70) return "bg-orange-500";
    return "bg-gray-500";
  };

  const isNewItem = (createdAt: string | Date) => {
    if (!createdAt) return false;
    const itemDate = new Date(createdAt);
    const now = new Date();
    const diffInMinutes = (now.getTime() - itemDate.getTime()) / (1000 * 60);
    return diffInMinutes <= 60; // Consider new if created within last hour
  };

  // Mutations for actions
  const deleteMatchMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest(`/api/matches/${itemId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/group-suggestions"] });
      toast({
        title: "Success",
        description: "Item removed successfully",
      });
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
        description: "Failed to remove item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (matchId: string) => {
      await apiRequest(`/api/matches/${matchId}/status`, "PUT", { status: "connected" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      toast({
        title: "Success",
        description: "Connection request sent!",
      });
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
        description: "Failed to connect. Please try again.",
        variant: "destructive",
      });
    },
  });

  const joinGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      await apiRequest(`/api/groups/${groupId}/join`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/group-suggestions"] });
      toast({
        title: "Success",
        description: "Successfully joined the group!",
      });
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
        description: "Failed to join group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleViewItem = (item: any) => {
    setSelectedItem(item);
    setViewModalOpen(true);
  };

  const handleConnect = (itemId: string) => {
    connectMutation.mutate(itemId);
  };

  const handleJoinGroup = (groupId: string) => {
    joinGroupMutation.mutate(groupId);
  };

  const handleDelete = (itemId: string) => {
    deleteMatchMutation.mutate(itemId);
  };

  // Combine and sort all items
  const allItems = [
    ...(matches || []).map(match => ({ ...match, type: 'user' as const })),
    ...(groupSuggestions || []).map(suggestion => ({ ...suggestion, type: 'group' as const }))
  ].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

  // Pagination logic
  const totalPages = Math.ceil(allItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = allItems.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (!isAuthenticated || isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Match History</h1>
          <p className="text-gray-600">Your complete history of matches and connections</p>
        </div>

        {/* Matches Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-80">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(matchesLoading || groupSuggestionsLoading) ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Loading matches and suggestions...
                    </td>
                  </tr>
                ) : allItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center space-y-3">
                        <Search className="h-12 w-12 text-gray-300" />
                        <div>
                          <h3 className="font-medium text-gray-900">No matches yet</h3>
                          <p className="text-gray-500 text-sm">Complete your profile to start finding matches</p>
                        </div>
                        <Button
                          onClick={() => window.location.href = "/profile"}
                          size="sm"
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                        >
                          Complete Profile
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const isNew = isNewItem(item.createdAt!);
                    
                    if (item.type === 'user') {
                      const match = item as MatchWithUsers & { type: 'user' };
                      const otherUser = getOtherUser(match);
                      
                      return (
                        <tr 
                          key={`match-${match.id}`}
                          className={`hover:bg-blue-50 transition-colors cursor-pointer ${
                            isNew 
                              ? "bg-gradient-to-r from-yellow-50 via-yellow-50/50 to-transparent border-l-4 border-l-yellow-400" 
                              : ""
                          }`}
                          onClick={() => handleViewItem(item)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={otherUser.profileImageUrl || ""} />
                                <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white text-sm">
                                  {otherUser.firstName?.[0]}{otherUser.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <div className="font-medium text-gray-900 text-sm">
                                    {`${otherUser.firstName} ${otherUser.lastName}`.length > 21 
                                      ? `${otherUser.firstName} ${otherUser.lastName}`.substring(0, 21) + '...'
                                      : `${otherUser.firstName} ${otherUser.lastName}`
                                    }
                                  </div>
                                  {isNew && (
                                    <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs px-1.5 py-0.5">
                                      New
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-blue-600">Person</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs text-gray-600 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {otherUser.profile?.location || "Unknown"}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${getScoreColor(match.compatibilityScore)}`}></div>
                              <span className="font-medium text-sm">{match.compatibilityScore}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-md">
                              <p className="text-sm text-gray-600 truncate">
                                {match.matchReason || "Compatible interests and goals"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(match.createdAt!).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-blue-50">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuItem onClick={() => handleViewItem(item)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  disabled
                                  className="text-gray-400 cursor-not-allowed"
                                >
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Connect
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(match.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    } else {
                      const suggestion = item as GroupSuggestion & { group: GroupWithMembers } & { type: 'group' };
                      
                      return (
                        <tr 
                          key={`group-${suggestion.id}`}
                          className={`hover:bg-purple-50 transition-colors cursor-pointer ${
                            isNew 
                              ? "bg-gradient-to-r from-yellow-50 via-yellow-50/50 to-transparent border-l-4 border-l-yellow-400" 
                              : ""
                          }`}
                          onClick={() => handleViewItem(item)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-500 text-white text-sm">
                                  {suggestion.group.name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <div className="font-medium text-gray-900 text-sm">
                                    {suggestion.group.name.length > 21 
                                      ? suggestion.group.name.substring(0, 21) + '...'
                                      : suggestion.group.name
                                    }
                                  </div>
                                  {isNew && (
                                    <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs px-1.5 py-0.5">
                                      New
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-purple-600">
                                  Group ({suggestion.group.memberCount} members)
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs text-gray-600 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {suggestion.group.location || "Various"}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${getScoreColor(suggestion.score)}`}></div>
                              <span className="font-medium text-sm">{suggestion.score}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-md">
                              <p className="text-sm text-gray-600 truncate">
                                {suggestion.reason || "Matches your interests"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(suggestion.createdAt!).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-purple-50">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36">
                                <DropdownMenuItem onClick={() => handleViewItem(item)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  disabled
                                  className="text-gray-400 cursor-not-allowed"
                                >
                                  <Users className="mr-2 h-4 w-4" />
                                  Join Group
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(suggestion.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    }
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center text-sm text-gray-700">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, allItems.length)} of {allItems.length} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className={
                      currentPage === pageNum
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 hover:from-blue-700 hover:to-purple-700"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                    }
                  >
                    {pageNum}
                  </Button>
                ))}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="bg-white border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View User Modal */}
      {selectedItem?.type === 'user' && (
        <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>User Match Details</DialogTitle>
              <DialogDescription>
                Detailed information about this match
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* User Info */}
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={getOtherUser(selectedItem).profileImageUrl || ""} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white text-lg">
                    {getOtherUser(selectedItem).firstName?.[0]}{getOtherUser(selectedItem).lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">
                    {getOtherUser(selectedItem).firstName} {getOtherUser(selectedItem).lastName}
                  </h3>
                  <p className="text-gray-500 flex items-center text-sm">
                    <MapPin className="h-3 w-3 mr-1" />
                    {getOtherUser(selectedItem).profile?.location || "Unknown"}
                  </p>
                </div>
              </div>

              {/* Match Score */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Compatibility Score</span>
                  <span className="text-2xl font-bold text-blue-600">{selectedItem.compatibilityScore}%</span>
                </div>
              </div>

              {/* Match Reason */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Why you match</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {selectedItem.matchReason || "Compatible interests and goals"}
                </p>
              </div>

              {/* Matched Skills */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {getOtherUser(selectedItem).skills && getOtherUser(selectedItem).skills.length > 0 ? (
                    getOtherUser(selectedItem).skills.slice(0, 6).map((skill: any, index: number) => (
                      <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                        {skill.name}
                      </Badge>
                    ))
                  ) : (
                    // Sample skills for demonstration
                    ['JavaScript', 'React', 'Python', 'UI/UX Design'].map((skill, index) => (
                      <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                        {skill}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Matched Hobbies */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Interests</h4>
                <div className="flex flex-wrap gap-2">
                  {getOtherUser(selectedItem).hobbies && getOtherUser(selectedItem).hobbies.length > 0 ? (
                    getOtherUser(selectedItem).hobbies.slice(0, 6).map((hobby: any, index: number) => (
                      <Badge key={index} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs">
                        {hobby.name}
                      </Badge>
                    ))
                  ) : (
                    // Sample hobbies for demonstration
                    ['Photography', 'Hiking', 'Tech Meetups', 'Cooking'].map((hobby, index) => (
                      <Badge key={index} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs">
                        {hobby}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Match Date */}
              <div className="text-xs text-gray-500 flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                Matched on {new Date(selectedItem.createdAt!).toLocaleDateString()}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setViewModalOpen(false)}>
                Close
              </Button>
              <Button 
                onClick={() => handleConnect(selectedItem.id)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                Connect
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* View Group Modal */}
      {selectedItem?.type === 'group' && (
        <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Group Suggestion Details</DialogTitle>
              <DialogDescription>
                Detailed information about this group suggestion
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Group Info */}
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg">
                    {selectedItem.group.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedItem.group.name}
                  </h3>
                  <p className="text-gray-600">
                    {selectedItem.group.category}
                  </p>
                  <p className="text-gray-500 flex items-center text-sm">
                    <MapPin className="h-3 w-3 mr-1" />
                    {selectedItem.group.location || "Various"}
                  </p>
                </div>
              </div>

              {/* Match Score */}
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Compatibility Score</span>
                  <span className="text-2xl font-bold text-purple-600">{selectedItem.score}%</span>
                </div>
              </div>

              {/* Group Description */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">About this group</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {selectedItem.group.description || "A vibrant community focused on connecting like-minded individuals"}
                </p>
              </div>



              {/* Match Reason */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Why this group is suggested</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {selectedItem.reason || "Matches your interests and professional goals"}
                </p>
              </div>

              {/* Group Stats */}
              <div className="flex justify-between text-sm text-gray-600">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {selectedItem.group.memberCount} members
                </div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Suggested {new Date(selectedItem.createdAt!).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setViewModalOpen(false)}>
                Close
              </Button>
              <Button 
                onClick={() => handleJoinGroup(selectedItem.group.id)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                Join Group
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}