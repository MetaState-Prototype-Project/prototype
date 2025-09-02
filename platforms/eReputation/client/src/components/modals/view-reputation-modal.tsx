import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ViewReputationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reputationData: {
    score: string;
    confidence: string;
    analysis: string;
    targetName?: string;
  } | null;
}

export default function ViewReputationModal({ 
  open, 
  onOpenChange, 
  reputationData 
}: ViewReputationModalProps) {
  if (!reputationData) return null;

  const score = parseFloat(reputationData.score);
  const confidence = parseFloat(reputationData.confidence);
  
  // Score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  // Score gradient for circle
  const getScoreGradient = (score: number) => {
    if (score >= 8) return "from-green-500 to-green-600";
    if (score >= 6) return "from-yellow-500 to-yellow-600";
    return "from-red-500 to-red-600";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-2xl max-h-screen sm:max-h-[90vh] mx-0 sm:mx-4 overflow-hidden bg-fig-10 border-0 sm:border-2 border-fig/20 shadow-2xl rounded-none sm:rounded-xl">
        <DialogHeader className="bg-transparent text-fig p-3 sm:p-6 -m-6 mb-0 rounded-t-xl">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-fig rounded-2xl flex items-center justify-center flex-shrink-0 transform rotate-12">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-swiss-cheese transform -rotate-12" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-2xl font-black text-fig leading-tight">
                eReputation Results
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="p-3 sm:p-6 max-h-[calc(100vh-200px)] sm:max-h-[calc(90vh-200px)] overflow-y-auto">
          {/* Score Display */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-32 h-32 mb-4">
              {/* Background circle */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-200 to-gray-300"></div>
              
              {/* Score circle with gradient */}
              <div 
                className={`absolute inset-2 rounded-full bg-gradient-to-br ${getScoreGradient(score)} flex items-center justify-center shadow-lg`}
              >
                <div className="text-center">
                  <div className={`text-3xl font-black text-white ${getScoreColor(score)}`}>
                    {score.toFixed(1)}
                  </div>
                  <div className="text-xs text-white/80 font-medium">
                    out of 10
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-fig mb-1">
                {reputationData.targetName ? `${reputationData.targetName}'s eReputation` : "Your eReputation"}
              </div>
              <div className="text-sm text-fig/70">
                Confidence: {Math.round(confidence * 100)}%
              </div>
            </div>
          </div>

          {/* Analysis */}
          <div className="bg-fig-10 rounded-2xl p-4 border-2 border-fig/20">
            <h4 className="text-base font-black text-fig mb-3">Analysis</h4>
            <p className="text-sm text-fig/80 leading-relaxed">
              {reputationData.analysis}
            </p>
          </div>
        </div>
        
        <div className="border-t-2 border-fig/20 p-3 sm:p-6 bg-fig-10 -m-6 mt-0 rounded-b-xl flex-shrink-0">
          <div className="flex justify-end">
            <Button 
              onClick={() => onOpenChange(false)}
              className="bg-fig hover:bg-fig/90 text-white font-bold h-11 sm:h-12 px-8 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}