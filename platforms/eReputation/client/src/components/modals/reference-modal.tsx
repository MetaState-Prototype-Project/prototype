import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiClient } from "@/lib/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/ui/file-upload";
import { useDebouncedCallback } from "use-debounce";

interface ReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TARGET_TYPES = [
  { 
    value: "user", 
    label: "User", 
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    )
  },
  { 
    value: "group", 
    label: "Group", 
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
    )
  },
  { 
    value: "platform", 
    label: "Platform", 
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
      </svg>
    )
  }
];

const REFERENCE_TYPES = [
  { value: "professional", label: "Professional Work" },
  { value: "academic", label: "Academic Achievement" },
  { value: "character", label: "Character Reference" },
  { value: "skill", label: "Skill Endorsement" },
  { value: "leadership", label: "Leadership Qualities" }
];

export default function ReferenceModal({ open, onOpenChange }: ReferenceModalProps) {
  const [targetType, setTargetType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [referenceText, setReferenceText] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();


  const { data: searchResults = [], refetch, isLoading: isSearching } = useQuery({
    queryKey: ['search', targetType, searchQuery],
    queryFn: async () => {
      if (!targetType || searchQuery.length < 2) return [];
      
      if (targetType === 'platform') {
        // Search platforms using the new platform endpoint
        const response = await apiClient.get(`/api/platforms/search?q=${encodeURIComponent(searchQuery)}`);
        return response.data.platforms || response.data || [];
      } else if (targetType === 'user') {
        // Search users using existing endpoint
        const response = await apiClient.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        return response.data;
      } else if (targetType === 'group') {
        // Search groups using new endpoint
        const response = await apiClient.get(`/api/groups/search?q=${encodeURIComponent(searchQuery)}`);
        return response.data;
      }
      return [];
    },
    enabled: targetType !== "" && searchQuery.length >= 2,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/api/references', data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Reference Submitted",
        description: "Your professional reference has been successfully submitted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      onOpenChange(false);
      resetForm();
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
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Failed to submit reference",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTargetType("");
    setSearchQuery("");
    setSelectedTarget(null);
    setReferenceText("");
    setReferenceType("");
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Don't automatically set selected target, let user pick from results
    if (!value.trim()) {
      setSelectedTarget(null);
    }
  };

  const handleSelectTarget = (target: any) => {
    setSelectedTarget(target);
    setSearchQuery(target.name);
  };

  const handleSubmit = () => {
    if (!targetType) {
      toast({
        title: "Invalid Selection",
        description: "Please select a target type",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTarget) {
      toast({
        title: "Invalid Selection",
        description: "Please select who you want to reference",
        variant: "destructive",
      });
      return;
    }

    if (!referenceText.trim()) {
      toast({
        title: "Missing Information",
        description: "Please write a reference text",
        variant: "destructive",
      });
      return;
    }



    if (referenceText.length > 500) {
      toast({
        title: "Text Too Long",
        description: "Please keep your reference under 500 characters",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate({
      targetType,
      targetId: selectedTarget.id,
      targetName: selectedTarget.name,
      content: referenceText,
      referenceType: 'general'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-2xl h-screen sm:h-[90vh] mx-0 sm:mx-4 overflow-hidden bg-fig-10 border-0 sm:border-2 border-fig/20 shadow-2xl rounded-none sm:rounded-xl flex flex-col">
        <DialogHeader className="bg-transparent text-fig p-3 sm:p-6 -m-6 mb-0 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex w-12 h-12 bg-fig rounded-2xl items-center justify-center flex-shrink-0 transform rotate-12">
              <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-2xl font-black text-fig leading-tight">Send an eReference</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-fig/70 font-medium mt-1 leading-tight">Provide professional eReferences throughout the W3DS</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto">
          <div className="space-y-4 sm:space-y-6">
            {/* Target Selection */}
            <div>
              <h4 className="text-base sm:text-lg font-black text-fig mb-3 sm:mb-4">Select eReference Target</h4>
              <RadioGroup value={targetType} onValueChange={setTargetType}>
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
                  {TARGET_TYPES.map((type) => (
                    <Label
                      key={type.value}
                      className={`flex flex-col items-center gap-1 sm:gap-2 p-2 sm:p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                        targetType === type.value
                          ? 'border-fig/40 bg-fig-30'
                          : 'border-fig/20 hover:border-fig/30 hover:bg-fig-10'
                      }`}
                    >
                      <RadioGroupItem value={type.value} className="sr-only" />
                      <div className="w-8 h-8 sm:w-12 sm:h-12 bg-fig rounded-2xl flex items-center justify-center text-swiss-cheese">
                        {type.icon}
                      </div>
                      <span className="font-black text-fig text-xs sm:text-sm">{type.label}</span>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            </div>
            
            {/* Search Target */}
            <div>
              <Label className="block text-sm font-black text-fig mb-2">
                Find eReference Target
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search for who you want to reference..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-2 border-fig/20 focus:border-fig/40 focus:ring-fig/20 rounded-2xl"
                  disabled={!targetType}
                />
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-swiss-cheese" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                
                {/* Search Results Dropdown - Absolute positioned overlay */}
                {searchQuery.length >= 2 && !selectedTarget && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border-2 border-fig/20 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                    {isSearching ? (
                      <div className="px-4 py-3 text-center text-fig/70">
                        <div className="w-4 h-4 border-2 border-fig border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((result: any, index: number) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectTarget(result)}
                          className="w-full text-left px-4 py-3 hover:bg-fig-10 transition-colors border-b border-fig/10 last:border-b-0 first:rounded-t-2xl last:rounded-b-2xl"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-fig/10 rounded-lg flex items-center justify-center">
                              {targetType === 'platform' ? (
                                <svg className="w-4 h-4 text-fig" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-fig" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-fig">{result.name}</div>
                              <div className="text-xs text-fig/70 capitalize">{result.type || result.category}</div>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-center text-fig/70">
                        No {targetType}s found for "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Selected Target Display */}
              {selectedTarget && (
                <div className="mt-2 p-3 border-2 border-fig/20 rounded-2xl bg-fig-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-swiss-cheese" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-black text-fig">{selectedTarget.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTarget(null);
                        setSearchQuery("");
                      }}
                      className="text-fig/50 hover:text-fig"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Reference Text */}
            <div>
              <Label className="block text-sm font-black text-fig mb-2">
                eReference Text
              </Label>
              <Textarea
                placeholder="Write your professional eReference here. Include specific examples of work quality, collaboration, achievements, and professional character..."
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                className="h-32 resize-none border-2 border-fig/20 focus:border-fig/40 focus:ring-fig/20 rounded-2xl"
                maxLength={500}
              />
              <div className={`text-right text-sm mt-1 font-medium ${referenceText.length > 500 ? 'text-apple-red' : 'text-fig/70'}`}>
                {referenceText.length} / 500 characters
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t-2 border-fig/20 p-4 sm:p-6 bg-fig-10 -m-6 mt-0 rounded-b-xl flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={submitMutation.isPending}
              className="order-2 sm:order-1 flex-1 border-2 border-fig/30 text-fig/70 hover:bg-fig-10 hover:border-fig/40 font-bold h-11 sm:h-12 opacity-80"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={submitMutation.isPending || !targetType || !selectedTarget || !referenceText.trim()}
              className="order-1 sm:order-2 flex-1 bg-fig hover:bg-fig/90 text-white font-bold h-11 sm:h-12 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  Sign & Submit eReference
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
