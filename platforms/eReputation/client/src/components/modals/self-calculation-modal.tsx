import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ViewReputationModal from "./view-reputation-modal";

interface SelfCalculationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ANALYSIS_STEPS = [
  { label: "Analyzing post interactions", platform: "Pictique" },
  { label: "Evaluating social engagement", platform: "Blabsy" },
  { label: "Processing positive feedback", platform: "Comment Likes" },
  { label: "Processing negative feedback", platform: "Comment Dislikes" },
  { label: "Measuring social interactions", platform: "Social Interactions" },
  { label: "Finalizing eReputation score", platform: "Calculating" }
];

const ALL_VARIABLES = ["comment-history", "references", "qualifications", "profile-completeness", "engagement", "activity-frequency"];

export default function SelfCalculationModal({ open, onOpenChange }: SelfCalculationModalProps) {
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

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reputation/calculate", {
        targetType: "self",
        targetId: null,
        targetName: null,
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

  const handleStartCalculation = () => {
    setIsCalculating(true);
    setCurrentStep(0);
    setProgress(0);
    calculateMutation.mutate();
  };

  const handleCloseModal = () => {
    // Reset all states when closing
    setIsCalculating(false);
    setCurrentStep(0);
    setProgress(0);
    setReputationResult(null);
    onOpenChange(false);
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-2xl max-h-screen sm:max-h-[90vh] mx-0 sm:mx-4 overflow-hidden bg-fig-10 border-0 sm:border-2 border-fig/20 shadow-2xl rounded-none sm:rounded-xl">
        <DialogHeader className="bg-transparent text-fig p-3 sm:p-6 -m-6 mb-0 rounded-t-xl">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex w-12 h-12 bg-fig rounded-2xl items-center justify-center flex-shrink-0 transform rotate-12">
              <svg className="w-6 h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-2xl font-black text-fig leading-tight">Calculate My eReputation</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-fig/70 font-medium mt-1 leading-tight">Calculate your current eReputation throughout the W3DS</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-3 sm:p-6 max-h-[calc(100vh-200px)] sm:max-h-[calc(90vh-200px)] overflow-y-auto">
          {!isCalculating ? (
            // Initial state - ready to start calculation
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-fig rounded-2xl flex items-center justify-center mx-auto transform rotate-12">
                <svg className="w-10 h-10 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-xl font-black text-fig mb-2">Ready to Calculate</h3>
                <p className="text-fig/70 text-sm leading-relaxed max-w-md mx-auto">
                  We'll analyze your eReputation across multiple post-platforms including likes, dislikes, and engagement metrics.
                </p>
              </div>

              <div className="bg-fig-10 rounded-2xl p-4 border-2 border-fig/20">
                <div className="flex items-center gap-2 text-sm text-fig font-medium justify-center">
                  <svg className="w-4 h-4 text-swiss-cheese flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="leading-tight">Analysis includes all eReputation factors automatically</span>
                </div>
              </div>
            </div>
          ) : (
            // Calculating state - show progress
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-black text-fig mb-2">Calculating Your eReputation</h3>
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
          )}
        </div>
        
        <div className="border-t-2 border-fig/20 p-4 sm:p-6 bg-fig-10 -m-6 mt-0 rounded-b-xl flex-shrink-0">
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
              disabled={isCalculating}
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
