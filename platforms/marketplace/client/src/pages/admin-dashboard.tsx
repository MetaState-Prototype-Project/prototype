import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { App, InsertApp } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings, ExternalLink, LogOut, Edit, Trash2, Star, Eye, TrendingUp, BarChart3 } from "lucide-react";

export default function AdminDashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState<Partial<InsertApp>>({
    name: "",
    description: "",
    fullDescription: "",
    category: "",
    link: "",
    logoUrl: "",
    screenshots: [],
    status: "active",
  });

  const itemsPerPage = 10;

  const { data: apps = [], isLoading: isLoadingApps } = useQuery<App[]>({
    queryKey: ["/api/admin/apps"],
  });

  const createAppMutation = useMutation({
    mutationFn: async (appData: InsertApp) => {
      const res = await apiRequest("POST", "/api/admin/apps", appData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/apps"] });
      setShowAddModal(false);
      resetForm();
      toast({
        title: "App created successfully!",
        description: "The app has been added to the marketplace.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create app",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAppMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertApp> }) => {
      const res = await apiRequest("PUT", `/api/admin/apps/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/apps"] });
      setEditingApp(null);
      resetForm();
      toast({
        title: "App updated successfully!",
        description: "The app has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update app",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/apps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/apps"] });
      toast({
        title: "App deleted successfully!",
        description: "The app has been removed from the marketplace.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete app",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      fullDescription: "",
      category: "",
      link: "",
      logoUrl: "",
      screenshots: [],
      status: "active",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.description || !formData.category || !formData.link) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (editingApp) {
      updateAppMutation.mutate({ id: editingApp.id, data: formData as InsertApp });
    } else {
      createAppMutation.mutate(formData as InsertApp);
    }
  };

  const handleEdit = (app: App) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      description: app.description,
      fullDescription: app.fullDescription || "",
      category: app.category,
      link: app.link,
      logoUrl: app.logoUrl || "",
      screenshots: app.screenshots || [],
      status: app.status,
    });
  };

  const handleLogoUpload = async () => {
    try {
      const res = await apiRequest("POST", "/api/objects/upload");
      const { uploadURL } = await res.json();
      return { method: "PUT" as const, url: uploadURL };
    } catch (error) {
      toast({
        title: "Failed to get upload URL",
        description: "Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleLogoComplete = async (result: any) => {
    if (result.successful && result.successful[0]) {
      try {
        const res = await apiRequest("PUT", "/api/objects/finalize", {
          fileURL: result.successful[0].uploadURL,
        });
        const { objectPath } = await res.json();
        setFormData(prev => ({ ...prev, logoUrl: objectPath }));
        toast({
          title: "Logo uploaded successfully!",
        });
      } catch (error) {
        toast({
          title: "Failed to finalize upload",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
        ))}
        {hasHalfStar && (
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" style={{
            clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)"
          }} />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={i} className="w-3 h-3 text-slate-300" />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "inactive":
        return <Badge className="bg-slate-100 text-slate-800">Inactive</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      productivity: "bg-blue-100 text-blue-800",
      design: "bg-purple-100 text-purple-800",
      development: "bg-green-100 text-green-800",
      communication: "bg-indigo-100 text-indigo-800",
      marketing: "bg-pink-100 text-pink-800",
    };
    
    const colorClass = colors[category.toLowerCase() as keyof typeof colors] || "bg-slate-100 text-slate-800";
    
    return <Badge className={colorClass}>{category}</Badge>;
  };

  const stats = {
    totalApps: apps.length,
    totalReviews: apps.reduce((sum, app) => sum + app.totalReviews, 0),
    avgRating: apps.length > 0 
      ? (apps.reduce((sum, app) => sum + parseFloat(app.averageRating || "0"), 0) / apps.length).toFixed(1)
      : "0",
    activeApps: apps.filter(app => app.status === "active").length,
  };

  // Pagination logic
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedApps = apps.slice(startIndex, endIndex);
  const totalPages = Math.ceil(apps.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b-2 border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                <Settings className="w-6 h-6 text-black" />
              </div>
              <h1 className="text-3xl font-black text-black">W3DS Admin Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <a href="/" target="_blank" rel="noopener noreferrer">
                <Button className="text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-all duration-200 border-2 border-gray-200 bg-white hover:border-black">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Public Site
                </Button>
              </a>
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">{user?.email}</span>
                <Button
                  className="text-black font-bold px-4 py-3 rounded-full hover:scale-105 transition-all duration-200 border-2 border-gray-200 bg-white hover:border-black"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-3xl p-6 border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                <BarChart3 className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-3xl font-black text-black">{stats.totalApps}</p>
                <p className="text-sm font-medium text-gray-600">Total Apps</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
                <Star className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-3xl font-black text-black">{stats.totalReviews}</p>
                <p className="text-sm font-medium text-gray-600">Total Reviews</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'hsl(270, 100%, 85%)' }}>
                <TrendingUp className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-3xl font-black text-black">{stats.avgRating}</p>
                <p className="text-sm font-medium text-gray-600">Avg Rating</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-6 border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}>
                <Eye className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-3xl font-black text-black">{stats.activeApps}</p>
                <p className="text-sm font-medium text-gray-600">Active Apps</p>
              </div>
            </div>
          </div>
        </div>

        {/* Post-Platforms Management */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100">
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-black text-black">Post-Platforms</h2>
              <Dialog open={showAddModal || !!editingApp} onOpenChange={(open) => {
                if (!open) {
                  setShowAddModal(false);
                  setEditingApp(null);
                  resetForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => setShowAddModal(true)}
                    className="text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-all duration-200"
                    style={{ backgroundColor: 'hsl(85, 100%, 85%)' }}
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add New App
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingApp ? "Edit App" : "Add New App"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Logo Upload */}
                    <div>
                      <Label>App Logo</Label>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="w-20 h-20 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                          {formData.logoUrl ? (
                            <img src={formData.logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                          ) : (
                            <BarChart3 className="w-8 h-8 text-slate-400" />
                          )}
                        </div>
                        <ObjectUploader
                          onGetUploadParameters={handleLogoUpload}
                          onComplete={handleLogoComplete}
                          maxNumberOfFiles={1}
                          maxFileSize={5242880} // 5MB
                        >
                          Choose File
                        </ObjectUploader>
                      </div>
                    </div>

                    {/* App Name */}
                    <div>
                      <Label htmlFor="name">App Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter app name"
                        required
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <Label>Category *</Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="productivity">Productivity</SelectItem>
                          <SelectItem value="design">Design</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="communication">Communication</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Short Description */}
                    <div>
                      <Label htmlFor="description">Short Description *</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description (max 100 characters)"
                        maxLength={100}
                        required
                      />
                    </div>

                    {/* Full Description */}
                    <div>
                      <Label htmlFor="fullDescription">Full Description</Label>
                      <Textarea
                        id="fullDescription"
                        value={formData.fullDescription || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullDescription: e.target.value }))}
                        placeholder="Detailed description of the app..."
                        rows={4}
                      />
                    </div>

                    {/* App Link */}
                    <div>
                      <Label htmlFor="link">App Website/Link *</Label>
                      <Input
                        id="link"
                        type="url"
                        value={formData.link}
                        onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                        placeholder="https://example.com"
                        required
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <Label>Status</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending Review</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Form Actions */}
                    <div className="flex space-x-4 pt-4">
                      <Button 
                        type="submit" 
                        className="flex-1"
                        disabled={createAppMutation.isPending || updateAppMutation.isPending}
                      >
                        {(createAppMutation.isPending || updateAppMutation.isPending) 
                          ? "Saving..." 
                          : editingApp ? "Update App" : "Save App"
                        }
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => {
                          setShowAddModal(false);
                          setEditingApp(null);
                          resetForm();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Apps Table */}
          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingApps ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="animate-pulse flex items-center space-x-3">
                            <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                            <div>
                              <div className="h-4 bg-slate-200 rounded w-24 mb-1"></div>
                              <div className="h-3 bg-slate-200 rounded w-16"></div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><div className="h-4 bg-slate-200 rounded w-16"></div></TableCell>
                        <TableCell><div className="h-4 bg-slate-200 rounded w-12"></div></TableCell>
                        <TableCell><div className="h-4 bg-slate-200 rounded w-8"></div></TableCell>
                        <TableCell><div className="h-4 bg-slate-200 rounded w-16"></div></TableCell>
                        <TableCell><div className="h-4 bg-slate-200 rounded w-16"></div></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedApps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="text-slate-600">
                          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                          <p>No apps found. Create your first app to get started!</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedApps.map((app) => (
                      <TableRow key={app.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            {app.logoUrl ? (
                              <img 
                                src={app.logoUrl} 
                                alt={`${app.name} logo`} 
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                <BarChart3 className="w-5 h-5 text-white" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-slate-800">{app.name}</p>
                              <p className="text-xs text-slate-500 truncate max-w-[200px]">{app.description}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getCategoryBadge(app.category)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {renderStars(parseFloat(app.averageRating || "0"))}
                            <span className="text-sm text-slate-600 ml-1">
                              {parseFloat(app.averageRating || "0").toFixed(1)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {app.totalReviews}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(app.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(app)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete App</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{app.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => deleteAppMutation.mutate(app.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, apps.length)} of {apps.length} apps
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1"
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 p-0 ${
                        currentPage === page 
                          ? "text-black font-bold" 
                          : "text-gray-600"
                      }`}
                      style={
                        currentPage === page 
                          ? { backgroundColor: 'hsl(85, 100%, 85%)' }
                          : {}
                      }
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
