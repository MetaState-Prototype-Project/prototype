import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Navigation from "@/components/navigation";
import AddWishlistModal from "@/components/add-wishlist-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { Plus, Star, Trash2, Edit2, Search, MoreHorizontal, Eye, Share2, ChevronDown } from "lucide-react";
import type { Profile, WishlistItem } from "@shared/schema";

export default function Wishlist() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [highlightNew, setHighlightNew] = useState(false);


  // Check if we should highlight new items
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    if (urlParams.get('highlight') === 'new') {
      setHighlightNew(true);
      // Remove highlight after 3 seconds
      setTimeout(() => setHighlightNew(false), 3000);
      // Clean up URL
      window.history.replaceState({}, '', '/wishlist');
    }
  }, [location]);

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

  const { data: profile, isLoading: profileLoading } = useQuery<Profile & { wishlistItems?: WishlistItem[] }>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
    retry: false,
  });

  const wishlistItems = profile?.wishlistItems || [];

  // Filter items
  const filteredItems = wishlistItems.filter((item: WishlistItem) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = categoryFilter === "all" || item.priority === categoryFilter;
    return matchesSearch && matchesPriority;
  });

  // Get unique priorities for filtering
  const priorities = Array.from(new Set(wishlistItems.map((item: WishlistItem) => item.priority))).filter((priority): priority is string => Boolean(priority));

  // Sort items to show newest first, then by priority
  const sortedItems = [...filteredItems].sort((a, b) => {
    // First sort by creation date (newest first)
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    
    // Then by priority
    const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
    return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
  });

  const deleteWishlistMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/wishlist/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Success", description: "Wishlist item removed successfully!" });
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
        description: "Failed to remove wishlist item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (item: WishlistItem) => {
    setEditingItem(item);
    setShowAddModal(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setShowAddModal(true);
  };

  const handleViewWish = (item: WishlistItem) => {
    setLocation(`/wishlist/${item.id}`);
  };

  const handleShare = (item: WishlistItem) => {
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: item.description || item.title,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(`${item.title}: ${item.description || ''}`);
      toast({
        title: "Copied to clipboard",
        description: "Wishlist item copied to clipboard"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 font-medium";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-blue-100 text-blue-800";
      case "low": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent": return "🔥 Urgent!";
      case "high": return "High Priority";
      case "medium": return "Medium Priority";
      case "low": return "Low Priority";
      default: return priority;
    }
  };

  // Check if an item is new (created in last 5 minutes)
  const isNewItem = (item: WishlistItem) => {
    if (!item.createdAt) return false;
    const itemTime = new Date(item.createdAt).getTime();
    const now = Date.now();
    return (now - itemTime) < (5 * 60 * 1000); // 5 minutes
  };

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-muted/30" />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Wishlist</h1>
              <p className="text-gray-600">
                Keep track of things you want to learn, achieve, or acquire.
              </p>
            </div>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              onClick={handleAddNew}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          {/* Search and Filters */}
          <Card className="mb-6 border-0 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search wishlist items..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between border border-gray-200 hover:bg-gray-50">
                        {categoryFilter === "all" ? "All Priorities" : getPriorityLabel(categoryFilter)}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48">
                      <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
                        All Priorities
                      </DropdownMenuItem>
                      {priorities.map((priority: string) => (
                        <DropdownMenuItem key={priority} onClick={() => setCategoryFilter(priority)}>
                          {getPriorityLabel(priority)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>



        {/* Wishlist Items */}
        <div className="space-y-4">
          {profileLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {wishlistItems.length === 0 ? "No wishlist items yet" : "No items match your search"}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {wishlistItems.length === 0 
                  ? "Start adding things you want to learn, achieve, or acquire to help others understand what you're looking for."
                  : "Try adjusting your search terms or category filter."
                }
              </p>
              {wishlistItems.length === 0 && (
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  onClick={handleAddNew}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Item
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedItems.map((item: WishlistItem) => (
                <Card 
                  key={item.id} 
                  className={`relative hover:shadow-lg transition-all duration-300 border border-blue-200/50 shadow-sm bg-gradient-to-br from-blue-100/80 via-blue-50/60 to-purple-100/70 ${
                    highlightNew && isNewItem(item) ? 
                    'ring-2 ring-blue-400 bg-gradient-to-br from-blue-50/80 to-purple-50/80 shadow-lg animate-pulse' : 
                    ''
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 flex-1 pr-2">{item.title}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-white">
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare(item)}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteWishlistMutation.mutate(item.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className={getPriorityColor(item.priority)}>
                        {getPriorityLabel(item.priority)}
                      </Badge>
                      {isNewItem(item) && (
                        <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                          New!
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                        {item.description}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleViewWish(item)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs px-3 py-1"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Wishlist Modal */}
      <AddWishlistModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal}
        editingItem={editingItem}
      />


    </div>
  );
}