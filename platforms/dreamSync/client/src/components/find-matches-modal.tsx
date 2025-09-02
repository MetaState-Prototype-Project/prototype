import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Search, MapPin, Users, Lightbulb, ChevronDown, X, Star } from "lucide-react";
import type { UserWithProfile } from "@shared/schema";

interface FindMatchesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FindMatchesModal({ open, onOpenChange }: FindMatchesModalProps) {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [searchRadius, setSearchRadius] = useState([25]);
  const [useRadius, setUseRadius] = useState(true);
  const [minCompatibility, setMinCompatibility] = useState([50]);
  
  // Multi-select state for skills and interests
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [interestsOpen, setInterestsOpen] = useState(false);

  // Fetch user profile for current preferences
  const { data: userProfile } = useQuery<UserWithProfile>({
    queryKey: ["/api/profile"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Use user's actual skills and interests from their profile
  const userSkills = userProfile?.skills || [];
  const userInterests = userProfile?.interests || [];

  // Find new matches mutation
  const findMatchesMutation = useMutation({
    mutationFn: async () => {
      const searchParams = {
        radius: useRadius ? searchRadius[0] : undefined,
        selectedSkills: selectedSkills.length > 0 ? selectedSkills : undefined,
        selectedInterests: selectedInterests.length > 0 ? selectedInterests : undefined,
        minCompatibility: minCompatibility[0],
      };
      
      await apiRequest("POST", "/api/matches/find", searchParams);
    },
    onSuccess: (data: any) => {
      const matchCount = data?.matchCount || 0;
      toast({
        title: "Success",
        description: `Found ${matchCount} new matches for you!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
      
      // Redirect to matches page to show results
      setLocation("/matches");
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
        description: "Failed to find new matches. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFindMatches = () => {
    findMatchesMutation.mutate();
  };

  const handleSkillToggle = (skill: string) => {
    if (skill === "All Skills") {
      setSelectedSkills(selectedSkills.length === userSkills.length ? [] : userSkills.map((s: any) => s.name));
    } else {
      setSelectedSkills(prev => 
        prev.includes(skill) 
          ? prev.filter(s => s !== skill)
          : [...prev, skill]
      );
    }
  };

  const handleInterestToggle = (interest: string) => {
    if (interest === "All Interests") {
      setSelectedInterests(selectedInterests.length === userInterests.length ? [] : userInterests.map((i: any) => i.name));
    } else {
      setSelectedInterests(prev => 
        prev.includes(interest) 
          ? prev.filter(i => i !== interest)
          : [...prev, interest]
      );
    }
  };

  const removeSkill = (skill: string) => {
    setSelectedSkills(prev => prev.filter(s => s !== skill));
  };

  const removeInterest = (interest: string) => {
    setSelectedInterests(prev => prev.filter(i => i !== interest));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 border-0 shadow-2xl fixed">
        <DialogHeader className="text-center pb-1">
          <DialogTitle className="flex items-center justify-center space-x-3 text-lg">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <Search className="h-4 w-4 text-blue-600" />
            </div>
            <span className="bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent font-semibold">Find New Matches</span>
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-sm">
            Customize your search preferences to find the most compatible people
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Matching Criteria */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <Label className="text-sm font-medium text-gray-900">Match Based On</Label>
            </div>
            <div className="bg-gradient-to-r from-blue-50/40 to-purple-50/40 rounded-xl p-4 space-y-6">
              
              {/* Skills Selection */}
              <div className="space-y-3">
                <Label className="text-sm text-gray-700 font-medium">Skills & Expertise</Label>
                <Popover open={skillsOpen} onOpenChange={setSkillsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={skillsOpen}
                      className="w-full justify-between bg-white/60 border-gray-200 hover:bg-white/80"
                    >
                      <span className="text-gray-600">
                        {selectedSkills.length === 0 
                          ? "Select skills..." 
                          : selectedSkills.length === userSkills.length
                          ? "All Skills"
                          : `${selectedSkills.length} selected`
                        }
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search skills..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>No skills found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            key="all-skills"
                            onSelect={() => handleSkillToggle("All Skills")}
                            className="flex items-center gap-2"
                          >
                            <div className={`flex h-4 w-4 items-center justify-center rounded border ${selectedSkills.length === userSkills.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                              {selectedSkills.length === userSkills.length && <div className="h-2 w-2 bg-white rounded-sm" />}
                            </div>
                            <Star className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">All Skills</span>
                          </CommandItem>
                          {userSkills.map((skill: any) => (
                            <CommandItem
                              key={skill.name}
                              onSelect={() => handleSkillToggle(skill.name)}
                              className="flex items-center gap-2"
                            >
                              <div className={`flex h-4 w-4 items-center justify-center rounded border ${selectedSkills.includes(skill.name) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                {selectedSkills.includes(skill.name) && <div className="h-2 w-2 bg-white rounded-sm" />}
                              </div>
                              <span>{skill.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSkills.slice(0, 15).map((skill) => (
                      <Badge 
                        key={skill} 
                        variant="secondary" 
                        className="bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 pr-1"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkill(skill)}
                          className="ml-1 hover:bg-blue-300 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {selectedSkills.length > 15 && (
                      <Badge 
                        variant="secondary" 
                        className="bg-gray-100 text-gray-600 border border-gray-200"
                      >
                        +{selectedSkills.length - 15} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Interests Selection */}
              <div className="space-y-3">
                <Label className="text-sm text-gray-700 font-medium">Hobbies & Interests</Label>
                <Popover open={interestsOpen} onOpenChange={setInterestsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={interestsOpen}
                      className="w-full justify-between bg-white/60 border-gray-200 hover:bg-white/80"
                    >
                      <span className="text-gray-600">
                        {selectedInterests.length === 0 
                          ? "Select interests..." 
                          : selectedInterests.length === userInterests.length
                          ? "All Interests"
                          : `${selectedInterests.length} selected`
                        }
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search interests..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>No interests found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            key="all-interests"
                            onSelect={() => handleInterestToggle("All Interests")}
                            className="flex items-center gap-2"
                          >
                            <div className={`flex h-4 w-4 items-center justify-center rounded border ${selectedInterests.length === userInterests.length ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                              {selectedInterests.length === userInterests.length && <div className="h-2 w-2 bg-white rounded-sm" />}
                            </div>
                            <Star className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">All Interests</span>
                          </CommandItem>
                          {userInterests.map((interest: any) => (
                            <CommandItem
                              key={interest.name}
                              onSelect={() => handleInterestToggle(interest.name)}
                              className="flex items-center gap-2"
                            >
                              <div className={`flex h-4 w-4 items-center justify-center rounded border ${selectedInterests.includes(interest.name) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                                {selectedInterests.includes(interest.name) && <div className="h-2 w-2 bg-white rounded-sm" />}
                              </div>
                              <span>{interest.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedInterests.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedInterests.slice(0, 15).map((interest) => (
                      <Badge 
                        key={interest} 
                        variant="secondary" 
                        className="bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200 pr-1"
                      >
                        {interest}
                        <button
                          onClick={() => removeInterest(interest)}
                          className="ml-1 hover:bg-purple-300 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {selectedInterests.length > 15 && (
                      <Badge 
                        variant="secondary" 
                        className="bg-gray-100 text-gray-600 border border-gray-200"
                      >
                        +{selectedInterests.length - 15} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search Distance */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                <MapPin className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <Label className="text-sm font-medium text-gray-900">Search Radius</Label>
            </div>
            <div className="bg-gradient-to-r from-blue-50/40 to-purple-50/40 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="use-radius" className="text-sm text-gray-700 font-medium">Enable distance filter</Label>
                <Switch
                  id="use-radius"
                  checked={useRadius}
                  onCheckedChange={setUseRadius}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-500 data-[state=checked]:to-purple-500"
                />
              </div>
              {useRadius && (
                <>
                  <div className="space-y-2">
                    <Slider
                      value={searchRadius}
                      onValueChange={setSearchRadius}
                      max={500}
                      min={1}
                      step={5}
                      className="w-full [&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-blue-400/70 [&_[role=slider]]:to-purple-400/70 [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-sm [&>.relative]:bg-gradient-to-r [&>.relative]:from-blue-100/50 [&>.relative]:to-purple-100/50"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>1 km</span>
                      <span className="font-medium text-blue-600">{searchRadius[0]} km</span>
                      <span>500 km</span>
                    </div>
                  </div>
                  {userProfile?.profile?.location && (
                    <div className="flex items-center space-x-2 text-xs text-gray-600 bg-white/60 rounded-lg px-3 py-1.5">
                      <MapPin className="h-3 w-3 text-blue-500" />
                      <span>Searching around {userProfile.profile.location}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Minimum Compatibility */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <Label className="text-sm font-medium text-gray-900">Minimum Compatibility</Label>
            </div>
            <div className="bg-gradient-to-r from-blue-50/40 to-purple-50/40 rounded-xl p-4 space-y-3">
              <Slider
                value={minCompatibility}
                onValueChange={setMinCompatibility}
                max={100}
                min={50}
                step={5}
                className="w-full [&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-blue-400/70 [&_[role=slider]]:to-purple-400/70 [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-sm [&>.relative]:bg-gradient-to-r [&>.relative]:from-blue-100/50 [&>.relative]:to-purple-100/50"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>50%</span>
                <span className="font-medium text-blue-600">{minCompatibility[0]}% or higher</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center sm:justify-end space-x-3 pt-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="px-6 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleFindMatches}
            disabled={findMatchesMutation.isPending}
            className="px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {findMatchesMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding Matches...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Find Matches
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}