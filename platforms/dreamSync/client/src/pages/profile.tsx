import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { X, User, MapPin, Target, Heart } from "lucide-react";
import { 
  insertProfileSchema, 
  insertSkillSchema, 
  insertInterestSchema, 
  type UserWithProfile,
  type Skill,
  type Interest
} from "@shared/schema";

const profileFormSchema = insertProfileSchema.omit({ userId: true }).extend({
  searchRadius: z.number().min(1).max(20000),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
});

const skillFormSchema = insertSkillSchema.omit({ userId: true });
const interestFormSchema = insertInterestSchema.omit({ userId: true });

export default function Profile() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("basic");

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

  // Fetch user profile
  const { data: userProfile, isLoading: profileLoading } = useQuery<UserWithProfile>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Profile form
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      bio: "",
      location: "",
      searchRadius: 25,
      jobTitle: "",
      company: "",
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (userProfile?.profile) {
      profileForm.reset({
        bio: userProfile.profile.bio || "",
        location: userProfile.profile.location || "",
        searchRadius: userProfile.profile.searchRadius || 25,
        jobTitle: userProfile.profile.jobTitle || "",
        company: userProfile.profile.company || "",
      });
    }
  }, [userProfile, profileForm]);

  // Profile mutation
  const profileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileFormSchema>) => {
      console.log("Submitting profile data:", data);
      const response = await apiRequest("POST", "/api/profile", data);
      console.log("Profile save response:", response.status);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Profile Saved! ✓",
        description: "Your profile has been updated successfully!",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: (error) => {
      console.error("Profile save error:", error);
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
        description: `Failed to update profile: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Skills section
  const skillForm = useForm<z.infer<typeof skillFormSchema>>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      name: "",
      proficiency: "beginner",
    },
  });

  const skillMutation = useMutation({
    mutationFn: async (data: z.infer<typeof skillFormSchema>) => {
      await apiRequest("POST", "/api/skills", data);
    },
    onSuccess: () => {
      skillForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Success", description: "Skill added successfully!" });
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
        description: "Failed to add skill. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: async (skillId: string) => {
      await apiRequest("DELETE", `/api/skills/${skillId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Success", description: "Skill removed successfully!" });
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
        description: "Failed to remove skill. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Interests section (similar structure to skills)
  const interestForm = useForm<z.infer<typeof interestFormSchema>>({
    resolver: zodResolver(interestFormSchema),
    defaultValues: {
      name: "",
      frequency: "weekly",
    },
  });

  const interestMutation = useMutation({
    mutationFn: async (data: z.infer<typeof interestFormSchema>) => {
      console.log("Adding interest with data:", data);
      const response = await apiRequest("POST", "/api/interests", data);
      console.log("Interest added successfully:", response);
      return response;
    },
    onSuccess: () => {
      interestForm.reset();
      // Force refresh of profile data
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.refetchQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Success", description: "Interest added successfully!" });
    },
    onError: (error) => {
      console.error("Interest add error:", error);
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
        description: "Failed to add interest. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteInterestMutation = useMutation({
    mutationFn: async (interestId: string) => {
      await apiRequest("DELETE", `/api/interests/${interestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Success", description: "Interest removed successfully!" });
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
        description: "Failed to remove interest. Please try again.",
        variant: "destructive",
      });
    },
  });



  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-muted/30" />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
          <p className="text-gray-600">
            Complete your profile to get better matches and group suggestions.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Basic Info</span>
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Skills</span>
            </TabsTrigger>
            <TabsTrigger value="interests" className="flex items-center space-x-2">
              <Heart className="h-4 w-4" />
              <span>Interests</span>
            </TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Basic Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {profileLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit((data) => {
                      console.log("Form handleSubmit triggered with data:", data);
                      profileMutation.mutate(data);
                    })} className="space-y-6">
                      <FormField
                        control={profileForm.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bio</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Tell us about yourself..."
                                className="min-h-[100px]"
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input placeholder="San Francisco, CA" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="jobTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Job Title (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Software Engineer, Designer, etc." {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Tech Corp, Freelance, etc." {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={profileForm.control}
                        name="searchRadius"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Search Radius (miles)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="20000"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 25)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          className="btn-dreamy text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                          disabled={profileMutation.isPending}
                          onClick={(e) => {
                            console.log("Save button clicked");
                            console.log("Form values:", profileForm.getValues());
                            console.log("Form errors:", profileForm.formState.errors);
                          }}
                        >
                          {profileMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            "Save Profile"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Skill</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...skillForm}>
                    <form onSubmit={skillForm.handleSubmit((data) => skillMutation.mutate(data))} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={skillForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Skill Name</FormLabel>
                              <FormControl>
                                <Input placeholder="React, Photography, etc." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={skillForm.control}
                          name="proficiency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Level</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select level" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="beginner">Beginner</SelectItem>
                                  <SelectItem value="intermediate">Intermediate</SelectItem>
                                  <SelectItem value="advanced">Advanced</SelectItem>
                                  <SelectItem value="expert">Expert</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={skillMutation.isPending}
                          className="btn-dreamy text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {skillMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Adding...
                            </>
                          ) : (
                            "Add Skill"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Your Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  {profileLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-8 w-32" />
                      ))}
                    </div>
                  ) : userProfile?.skills?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {userProfile.skills.map((skill) => (
                        <Badge key={skill.id} variant="outline" className="px-3 py-1.5 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors">
                          <span className="font-medium">{skill.name}</span>
                          <span className="ml-1 text-xs opacity-75">({skill.proficiency})</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-auto p-0 text-blue-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => deleteSkillMutation.mutate(skill.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No skills added yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Interests Tab */}
          <TabsContent value="interests">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Interest</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...interestForm}>
                    <form onSubmit={interestForm.handleSubmit((data) => interestMutation.mutate(data))} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={interestForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Interest Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Photography, Hiking, etc." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={interestForm.control}
                          name="frequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Frequency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="How often?" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="occasionally">Occasionally</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={interestMutation.isPending}
                          className="btn-dreamy text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {interestMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Adding...
                            </>
                          ) : (
                            "Add Interest"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Your Interests</CardTitle>
                </CardHeader>
                <CardContent>
                  {profileLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-8 w-32" />
                      ))}
                    </div>
                  ) : userProfile?.interests?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {userProfile.interests.map((interest: Interest) => (
                        <Badge key={interest.id} variant="outline" className="px-3 py-1.5 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors">
                          <span className="font-medium">{interest.name}</span>
                          <span className="ml-1 text-xs opacity-75">({interest.frequency})</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-auto p-0 text-purple-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => deleteInterestMutation.mutate(interest.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No interests added yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>


        </Tabs>
      </div>
    </div>
  );
}
