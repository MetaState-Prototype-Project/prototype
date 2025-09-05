import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Star, Plus, Loader2, ChevronDown } from "lucide-react";
import type { WishlistItem } from "@shared/schema";

interface AddWishlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: WishlistItem | null;
}

export default function AddWishlistModal({ open, onOpenChange, editingItem }: AddWishlistModalProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Form state
  const [title, setTitle] = useState(editingItem?.title || "");
  const [description, setDescription] = useState(editingItem?.description || "");
  const [priority, setPriority] = useState(editingItem?.priority || "medium");

  // Reset form when modal opens/closes or editing item changes
  useEffect(() => {
    if (open) {
      setTitle(editingItem?.title || "");
      setDescription(editingItem?.description || "");
      setPriority(editingItem?.priority || "medium");
    }
  }, [open, editingItem]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
  };

  // Add/Update wishlist item mutation
  const wishlistMutation = useMutation({
    mutationFn: async () => {
      const itemData = { title, description, priority };
      
      if (editingItem) {
        await apiRequest("PUT", `/api/wishlist/${editingItem.id}`, itemData);
      } else {
        await apiRequest("POST", "/api/wishlist", itemData);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ 
        title: "Success", 
        description: editingItem ? "Wishlist item updated successfully!" : "Wishlist item added successfully!" 
      });
      resetForm();
      onOpenChange(false);
      
      // Redirect to wishlist page with new item highlighted
      if (!editingItem) {
        setLocation("/wishlist?highlight=new");
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
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: `Failed to ${editingItem ? 'update' : 'add'} wishlist item. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in the title field.",
        variant: "destructive",
      });
      return;
    }
    wishlistMutation.mutate();
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl mx-auto bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border-0 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8 pt-2">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Star className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent">
            {editingItem ? "Edit Wishlist Item" : "Add Wishlist Item"}
          </h2>
          <p className="text-gray-600 mt-2">
            {editingItem ? "Update your wishlist item details" : "Share what you're looking to achieve or acquire"}
          </p>
        </div>

        {/* Form Content */}
        <div className="space-y-6">
          {/* Title and Priority Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <Star className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <Label htmlFor="title" className="text-sm font-medium text-gray-900">Title</Label>
              </div>
              <div className="bg-gradient-to-r from-blue-50/40 to-purple-50/40 rounded-xl p-4">
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Learn Spanish, Find a mentor..."
                  className="border-0 bg-white/70 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-blue-200 focus:bg-white transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <Star className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <Label className="text-sm font-medium text-gray-900">Priority Level</Label>
              </div>
              <div className="bg-gradient-to-r from-blue-50/40 to-purple-50/40 rounded-xl p-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between border border-gray-200 hover:bg-gray-50">
                      {priority === "urgent" && "🔥 Urgent!"}
                      {priority === "high" && "High Priority"}
                      {priority === "medium" && "Medium Priority"}
                      {priority === "low" && "Low Priority"}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuItem onClick={() => setPriority("urgent")}>
                      🔥 Urgent!
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPriority("high")}>
                      High Priority
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPriority("medium")}>
                      Medium Priority
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPriority("low")}>
                      Low Priority
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                <Star className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <Label htmlFor="description" className="text-sm font-medium text-gray-900">Description</Label>
            </div>
            <div className="bg-gradient-to-r from-blue-50/40 to-purple-50/40 rounded-xl p-4">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what you're looking for and why it matters to you..."
                rows={4}
                className="border-0 bg-white/70 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-blue-200 focus:bg-white transition-all duration-200 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center sm:justify-end space-x-3 pt-3">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="px-6 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={wishlistMutation.isPending}
            className="px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {wishlistMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editingItem ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <Star className="mr-2 h-4 w-4" />
                {editingItem ? "Update Item" : "Add to Wishlist"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}