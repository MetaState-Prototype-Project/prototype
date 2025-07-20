import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Edit, Share, Calendar, Users, BarChart3, Save, X, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MemberAvatar from "@/components/member-avatar";
import WysiwygEditor from "@/components/wysiwyg-editor";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CharterDetail as CharterDetailType, User } from "@shared/schema";
import { PlatformBadge } from "@/components/platform-badge";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Helper function to get user's display name
const getUserDisplayName = (user: User): string => {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.lastName) {
    return user.lastName;
  }
  return user.email || "Unknown User";
};

export default function CharterDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    guidelines: [] as string[]
  });
  
  const { data: charter, isLoading } = useQuery<CharterDetailType>({
    queryKey: [`/api/charters/${id}`],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; guidelines: string[] }) => {
      const response = await apiRequest("PATCH", `/api/charters/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Charter updated successfully",
        description: "Your changes have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/charters/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/charters"] });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error updating charter",
        description: "There was an error saving your changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/charters/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Charter deleted successfully",
        description: "The charter has been permanently removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/charters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error deleting charter",
        description: "There was an error deleting the charter. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditStart = () => {
    if (charter) {
      setEditForm({
        name: charter.name,
        description: charter.description || "",
        guidelines: charter.guidelines || []
      });
      setIsEditing(true);
    }
  };

  const handleEditSave = () => {
    updateMutation.mutate(editForm);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditForm({ name: "", description: "", guidelines: [] });
  };

  const updateGuideline = (index: number, value: string) => {
    const newGuidelines = [...editForm.guidelines];
    newGuidelines[index] = value;
    setEditForm({ ...editForm, guidelines: newGuidelines });
  };

  const addGuideline = () => {
    setEditForm({ ...editForm, guidelines: [...editForm.guidelines, ""] });
  };

  const removeGuideline = (index: number) => {
    const newGuidelines = editForm.guidelines.filter((_, i) => i !== index);
    setEditForm({ ...editForm, guidelines: newGuidelines });
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-48 bg-gray-200 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  if (!charter || !charter.group || !charter.owner) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Charter not found</h2>
          <Link href="/">
            <Button className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }



  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Back Button */}
      <div className="mb-4 sm:mb-6">
        <Link href="/">
          <Button variant="ghost" className="inline-flex items-center text-gray-600 hover:text-gray-800 transition-colors duration-200 p-2 sm:p-3 hover:bg-amber-500 hover:bg-opacity-10">
            <ArrowLeft className="mr-2" size={16} />
            <span className="text-sm sm:text-base">Back to Dashboard</span>
          </Button>
        </Link>
      </div>
      
      {/* Charter Header */}
      <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow mb-6 sm:mb-8">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-3 sm:space-x-6 mb-4 sm:mb-6 lg:mb-0">
              <img 
                src={charter.group.imageUrl || "https://via.placeholder.com/120"} 
                alt={charter.group.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl object-cover shrink-0"
              />
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-3">
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="text-3xl font-bold text-gray-800 border-0 bg-transparent p-0 focus:ring-0 focus:border-0"
                      placeholder="Charter name"
                    />
                    <WysiwygEditor
                      content={editForm.description}
                      onChange={(content) => setEditForm({ ...editForm, description: content })}
                      placeholder="Charter description..."
                      className="text-gray-600 border-0 bg-transparent p-0"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">{charter.name}</h2>
                    <div className="text-gray-600 mb-2 prose prose-sm">{charter.group.name}</div>
                  </>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <PlatformBadge platform={charter.group.platform} className="text-xs" />
                  </div>
                  <span>
                    <Users className="mr-1 inline" size={14} />
                    {charter.group.memberCount} members
                  </span>
                  <span>
                    <Calendar className="mr-1 inline" size={14} />
                    Last updated {charter.updatedAt ? new Date(charter.updatedAt).toLocaleDateString() : "recently"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              {isEditing ? (
                <>
                  <Button 
                    onClick={handleEditSave}
                    disabled={updateMutation.isPending}
                    className="gradient-primary text-white px-6 py-3 rounded-2xl font-medium hover:shadow-xl transition-all duration-300"
                  >
                    <Save className="mr-2" size={18} />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button 
                    onClick={handleEditCancel}
                    variant="outline"
                    className="bg-white/70 backdrop-blur-xs text-gray-700 px-6 py-3 rounded-2xl font-medium hover:bg-white/90 transition-all duration-300 shadow-lg"
                  >
                    <X className="mr-2" size={18} />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button className="bg-white/70 backdrop-blur-xs text-gray-700 px-6 py-3 rounded-2xl font-medium hover:bg-white/90 transition-all duration-300 shadow-lg">
                    <Share className="mr-2" size={18} />
                    Share
                  </Button>
                  <Link href={`/charter/${charter.id}/edit`}>
                    <Button 
                      className="gradient-primary text-white px-6 py-3 rounded-2xl font-medium hover:shadow-xl transition-all duration-300"
                    >
                      <Edit className="mr-2" size={18} />
                      Edit Charter
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Charter Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Charter Details */}
        <div className="lg:col-span-2">
          <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow mb-6">
            <CardContent className="p-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Charter Details</h3>
              <div className="space-y-6">
                {/* Charter Description */}
                {charter.description && (
                  <div>
                    <div className="text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: charter.description }} />
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Community Guidelines</h4>
                  {isEditing ? (
                    <div className="space-y-3">
                      {editForm.guidelines.map((guideline, index) => (
                        <div key={index} className="flex items-start space-x-3">
                          <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center mt-1">
                            <span className="text-purple-600 font-medium text-sm">{index + 1}</span>
                          </div>
                          <Input
                            placeholder={`Enter guideline ${index + 1}...`}
                            className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 bg-white/80 backdrop-blur-xs"
                            value={guideline}
                            onChange={(e) => updateGuideline(index, e.target.value)}
                          />
                          {editForm.guidelines.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeGuideline(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                            >
                              <X size={16} />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={addGuideline}
                        className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm"
                      >
                        <Plus className="mr-2" size={16} />
                        Add Another Guideline
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 text-gray-600">
                      {charter.guidelines?.map((guideline: string, index: number) => (
                        <p key={index}>• {guideline}</p>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Charter Settings</h4>
                  <div className="space-y-2 text-gray-600">
                    <p>• Auto-approve new members: {charter.autoApprove ? "Enabled" : "Disabled"}</p>
                    <p>• Allow member posts: {charter.allowPosts ? "Enabled" : "Disabled"}</p>
                    <p>• Charter status: {charter.isActive ? "Active" : "Inactive"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          
          {/* Charter Owner */}
          <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Charter Owner</h3>
              <div className="space-y-4">
                <MemberAvatar name={getUserDisplayName(charter.owner)} role="owner" />
              </div>
            </CardContent>
          </Card>
          
          {/* Group Admins */}
          <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Group Admins</h3>
              <div className="space-y-4">
                {charter.admins.map((admin: User) => (
                  <MemberAvatar key={admin.id} name={getUserDisplayName(admin)} role="admin" />
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Group Members */}
          <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Group Members</h3>
                <span className="text-sm text-gray-600">{charter.members.length} members</span>
              </div>
              <div className="space-y-3">
                {charter.members.slice(0, 8).map((member: User) => (
                  <div key={member.id} className="flex items-center space-x-3">
                    <MemberAvatar name={getUserDisplayName(member)} size="sm" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{getUserDisplayName(member)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {charter.members.length > 8 && (
                <Button variant="ghost" className="w-full mt-4 text-purple-600 hover:text-purple-700 font-medium text-sm">
                  View All Members
                </Button>
              )}
            </CardContent>
          </Card>
          
          {/* Charter Stats */}
          <Card className="bg-white/70 backdrop-blur-xs rounded-3xl soft-shadow">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Charter Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">Created On</span>
                  <span className="font-medium text-gray-800 text-sm">
                    {charter.createdAt ? new Date(charter.createdAt).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">Last Updated</span>
                  <span className="font-medium text-gray-800 text-sm">
                    {charter.updatedAt ? new Date(charter.updatedAt).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">Total Views</span>
                  <span className="font-medium text-gray-800 text-sm">{charter.stats?.totalViews || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Danger Zone - Only visible to charter owner */}
      {charter.owner && user && user.id === charter.owner.id && (
        <div className="mt-8 max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50/50 backdrop-blur-xs rounded-3xl">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">Danger Zone</h3>
                  <p className="text-red-700 text-sm mb-4">
                    Once you delete a charter, there is no going back. This action cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Charter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the charter "{charter.name}" 
              and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Charter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
