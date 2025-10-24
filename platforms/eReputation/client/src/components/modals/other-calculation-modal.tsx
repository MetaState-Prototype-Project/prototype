import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useDebouncedCallback } from 'use-debounce';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import ViewReputationModal from "./view-reputation-modal";


interface OtherCalculationModalProps {
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

const ANALYSIS_STEPS = [
  { label: "Analyzing post interactions", platform: "Pictique" },
  { label: "Evaluating social engagement", platform: "Blabsy" },
  { label: "Processing positive feedback", platform: "Comment Likes" },
  { label: "Processing negative feedback", platform: "Comment Dislikes" },
  { label: "Measuring social interactions", platform: "Social Interactions" },
  { label: "Finalizing eReputation score", platform: "Calculating" }
];

const ALL_VARIABLES = ["comment-history", "references", "qualifications", "profile-completeness", "engagement", "activity-frequency"];

const OTHER_VARIABLES = [
  {
    id: "comment-history",
    label: "Comment History",
    description: "Analyze past interactions and feedback"
  },
  {
    id: "references",
    label: "References",
    description: "Professional endorsements received"
  },
  {
    id: "qualifications",
    label: "Qualifications",
    description: "Educational and professional credentials"
  },
  {
    id: "profile-completeness",
    label: "Profile Completeness",
    description: "How complete your profile information is"
  },
  {
    id: "engagement",
    label: "Likes/Dislikes",
    description: "Community engagement metrics"
  },
  {
    id: "activity-frequency",
    label: "Activity Frequency",
    description: "Consistency of platform participation"
  }
];

export default function OtherCalculationModal({ open, onOpenChange }: OtherCalculationModalProps) {
  const [targetType, setTargetType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showViewModal, setShowViewModal] = useState(false);
  const [reputationResult, setReputationResult] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Progress simulation effect
  useEffect(() => {
    if (isCalculating && currentStep < ANALYSIS_STEPS.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setProgress(prev => Math.min(100, prev + (100 / ANALYSIS_STEPS.length)));
      }, 800 + Math.random() * 400); // Random delay between 800-1200ms for realism

      return () => clearTimeout(timer);
    }
  }, [isCalculating, currentStep]);

  const debouncedSearch = useDebouncedCallback((query: string) => {
    if (query.length >= 2) {
      refetch();
    }
  }, 300);

  const { data: searchResults = [], refetch } = useQuery({
    queryKey: ['/api/search', targetType, searchQuery],
    queryFn: () => {
      if (!targetType || searchQuery.length < 2) return [];
      const endpoint = `/api/search/${targetType}s?q=${encodeURIComponent(searchQuery)}`;
      return fetch(endpoint, { credentials: "include" }).then(res => res.json());
    },
    enabled: false,
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reputation/calculate", {
        targetType: targetType,
        targetId: selectedTarget?.id || '',
        targetName: selectedTarget?.name || selectedTarget?.title || 'Unknown',
        variables: ALL_VARIABLES
      });
      return response.json();
    },
    onError: (error) => {
      setIsCalculating(false);
      setCurrentStep(0);
      setProgress(0);
      
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
        title: "Calculation Failed",
        description: error instanceof Error ? error.message : "Failed to calculate reputation",
        variant: "destructive",
      });
    },
  });

  // When progress completes, wait a bit then show results
  useEffect(() => {
    if (currentStep >= ANALYSIS_STEPS.length && isCalculating && calculateMutation.data) {
      // Small delay to show 100% completion
      setTimeout(() => {
        setReputationResult(calculateMutation.data);
        setIsCalculating(false);
        setShowViewModal(true);
        
        // Update dashboard queries
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activities"] });
      }, 500);
    }
  }, [currentStep, isCalculating, calculateMutation.data, queryClient]);

  const resetForm = () => {
    setTargetType("");
    setSearchQuery("");
    setSelectedTarget(null);
    setIsCalculating(false);
    setCurrentStep(0);
    setProgress(0);
    setReputationResult(null);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Trigger search if query is long enough
    if (value.length >= 2) {
      debouncedSearch(value);
    }
    // Don't automatically set selected target, let user pick from results
    if (!value.trim()) {
      setSelectedTarget(null);
    }
  };

  const handleSelectTarget = (target: any) => {
    setSelectedTarget(target);
    setSearchQuery(target.name);
  };

  const handleStartCalculation = () => {
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
        description: "Please select a target to evaluate",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);
    setCurrentStep(0);
    setProgress(0);
    calculateMutation.mutate();
  };

  const handleCloseModal = () => {
    // Reset all states when closing
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-2xl h-screen sm:h-[90vh] mx-0 sm:mx-4 overflow-hidden bg-fig-10 border-0 sm:border-2 border-fig/20 shadow-2xl rounded-none sm:rounded-xl flex flex-col">
        <DialogHeader className="bg-transparent text-fig p-3 sm:p-6 -m-6 mb-0 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex w-12 h-12 bg-fig rounded-2xl items-center justify-center flex-shrink-0 transform rotate-12">
              <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-2xl font-black text-fig leading-tight">Evaluate Others' eReputation</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-fig/70 font-medium mt-1 leading-tight">Calculate eReputation for users, groups, or platforms throughout the W3DS</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-3 sm:p-6 flex-1 overflow-y-auto">
          <div className="space-y-3 sm:space-y-6">
            {/* Progress Bar or Ready State */}
            {isCalculating ? (
              // Calculating state - show progress
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-black text-fig mb-2">Calculating {selectedTarget?.name || 'Target'}'s eReputation</h3>
                  <p className="text-fig/70 text-sm">
                    {currentStep < ANALYSIS_STEPS.length 
                      ? ANALYSIS_STEPS[currentStep].label
                      : "Calculation complete!"
                    }
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="space-y-3">
                  <Progress value={progress} className="h-3" />
                  <div className="flex justify-between text-xs text-fig/60">
                    <span>Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>

                {/* Current Platform */}
                {currentStep < ANALYSIS_STEPS.length && (
                  <div className="bg-fig-10 rounded-2xl p-4 border-2 border-fig/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-fig rounded-lg flex items-center justify-center">
                        <div className="w-2 h-2 bg-swiss-cheese rounded-full animate-pulse"></div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-fig">
                          {ANALYSIS_STEPS[currentStep].platform}
                        </div>
                        <div className="text-xs text-fig/70">
                          {ANALYSIS_STEPS[currentStep].label}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Steps completed */}
                <div className="space-y-2">
                  {ANALYSIS_STEPS.slice(0, currentStep).map((step, index) => (
                    <div key={index} className="flex items-center gap-3 text-sm text-fig/60">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedTarget ? (
              // Ready to calculate state  
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-fig rounded-2xl flex items-center justify-center mx-auto transform rotate-12">
                  <svg className="w-8 h-8 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-fig mb-2">Ready to Calculate</h3>
                  <p className="text-fig/70 text-sm leading-relaxed">
                    We'll analyze {selectedTarget.name}'s eReputation across multiple post-platforms including likes, dislikes, and engagement metrics.
                  </p>
                </div>

                <div className="bg-fig-10 rounded-2xl p-3 border-2 border-fig/20">
                  <div className="flex items-center gap-2 text-sm text-fig font-medium justify-center">
                    <svg className="w-4 h-4 text-swiss-cheese flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="leading-tight">Analysis includes all eReputation factors automatically</span>
                  </div>
                </div>
              </div>
            ) : (
              // Default placeholder state when no target selected
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-fig-10 border-2 border-fig/20 rounded-2xl flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-fig/40" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-fig mb-2">Select Target to Evaluate</h3>
                  <p className="text-fig/70 text-sm leading-relaxed">
                    Choose a target type below and search for a user, group, or platform to calculate their eReputation across multiple post-platforms.
                  </p>
                </div>

                <div className="bg-fig-10 rounded-2xl p-3 border-2 border-fig/20">
                  <div className="flex items-center gap-2 text-sm text-fig font-medium justify-center">
                    <svg className="w-4 h-4 text-swiss-cheese flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="leading-tight">Analysis includes all eReputation factors automatically</span>
                  </div>
                </div>
              </div>
            )}

            {/* Target Selection */}
            <div>
              <h4 className="text-base sm:text-lg font-black text-fig mb-3 sm:mb-4">Select Target Type</h4>
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
                Search Target
              </Label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search for user, group, or platform..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 border-2 border-fig/20 focus:border-fig/40 focus:ring-fig/20 rounded-2xl"
                  disabled={!targetType}
                />
                <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-swiss-cheese" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                
                {/* Search Results Dropdown - Absolute positioned overlay */}
                {searchQuery.length >= 2 && searchResults.length > 0 && !selectedTarget && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border-2 border-fig/20 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                    {searchResults.map((result: any, index: number) => (
                      <button
                        key={result.id}
                        onClick={() => handleSelectTarget(result)}
                        className="w-full text-left px-4 py-3 hover:bg-fig-10 transition-colors border-b border-fig/10 last:border-b-0 first:rounded-t-2xl last:rounded-b-2xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-fig/10 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-fig" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-bold text-fig">{result.name}</div>
                            <div className="text-xs text-fig/70 capitalize">{result.type}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Manual Entry Option */}
                {searchQuery.length >= 2 && !selectedTarget && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border-2 border-fig/20 rounded-2xl shadow-xl">
                    <button
                      onClick={() => handleSelectTarget({ id: searchQuery.trim(), name: searchQuery.trim() })}
                      className="w-full text-left px-4 py-3 hover:bg-fig-10 transition-colors rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-fig/10 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-fig" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-bold text-fig">Add "{searchQuery}"</div>
                          <div className="text-xs text-fig/70">Use custom name</div>
                        </div>
                      </div>
                    </button>
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
          </div>
        </div>
        
        <div className="border-t-2 border-fig/20 p-3 sm:p-6 bg-fig-10 -m-6 mt-0 rounded-b-xl flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={handleCloseModal}
              disabled={isCalculating}
              className="order-2 sm:order-1 flex-1 border-2 border-fig/30 text-fig/70 hover:bg-fig-10 hover:border-fig/40 font-bold h-11 sm:h-12 opacity-80"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStartCalculation}
              disabled={isCalculating || !targetType || !selectedTarget}
              className="order-1 sm:order-2 flex-1 bg-fig hover:bg-fig/90 text-white font-bold h-11 sm:h-12 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isCalculating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Calculating...
                </>
              ) : (
                "Calculate eReputation"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* View Reputation Modal */}
      <ViewReputationModal
        open={showViewModal}
        onOpenChange={(open) => {
          setShowViewModal(open);
          if (!open) {
            handleCloseModal();
          }
        }}
        reputationData={reputationResult}
      />
    </Dialog>
  );
}
