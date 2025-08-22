import { useState } from "react";
import { Vote, CheckCircle, Eye, UserX, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/apiClient";
import type { Poll } from "@/lib/pollApi";
import BlindVotingInterface from "./blind-voting-interface";

interface VotingInterfaceProps {
  poll: Poll;
  userId: string;
  hasVoted: boolean;
  onVoteSubmitted: () => void;
}

export default function VotingInterface({ poll, userId, hasVoted, onVoteSubmitted }: VotingInterfaceProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Check if this is a private poll that requires blind voting
  const isPrivatePoll = poll.visibility === "private";

  const handleSubmitVote = async () => {
    if (selectedOption === null) return;
    
    try {
      setIsSubmitting(true);
      await apiClient.post("/api/votes", {
        pollId: poll.id,
        userId,
        voteData: [selectedOption.toString()], // Send as array of strings as expected by NormalVoteData
        mode: "normal"
      });
      
      toast({
        title: "Success!",
        description: "Your vote has been submitted",
      });
      onVoteSubmitted();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit vote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasVoted) {
    // Show different content based on poll type
    if (isPrivatePoll) {
      return (
        <div className="text-center py-8">
          <Shield className="text-blue-500 h-16 w-16 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Blind Vote Submitted</h3>
          <p className="text-gray-600">Your private vote has been submitted successfully</p>
          <p className="text-sm text-gray-500 mt-2">This is a blind vote - your choice remains hidden until revealed</p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Your vote cannot be revealed and you can check back for results once they are declared.
            </p>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-6">
          {/* Show that user has voted */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="text-green-500 h-5 w-5 mr-2" />
              <div>
                <h3 className="text-lg font-semibold text-green-900 mb-2">Vote Submitted</h3>
                <p className="text-gray-600">You have already voted on this poll</p>
                <p className="text-sm text-gray-500 mt-2">Results will be shown when the poll ends</p>
              </div>
            </div>
          </div>

          {/* Show voting options with user's choice highlighted (grayed out, non-interactive) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Voting Options:
            </h3>
            <div className="space-y-3">
              {poll.options.map((option, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50 border-gray-200 opacity-60"
                >
                  <div className="flex-1">
                    <Label className="text-base text-gray-500">
                      {option}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  // For private polls, show the blind voting interface
  if (isPrivatePoll) {
    return (
      <BlindVotingInterface
        poll={poll}
        userId={userId}
        hasVoted={hasVoted}
        onVoteSubmitted={onVoteSubmitted}
      />
    );
  }

  return (
    <div className="space-y-6">
      <RadioGroup
        value={selectedOption?.toString()}
        onValueChange={(value) => setSelectedOption(parseInt(value))}
        className="space-y-3"
      >
        {poll.options.map((option, index) => (
          <div key={index} className="flex items-center space-x-2">
            <RadioGroupItem
              value={index.toString()}
              id={`option-${index}`}
            />
            <Label
              htmlFor={`option-${index}`}
              className="flex-1 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{option}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>

      <Button
        onClick={handleSubmitVote}
        disabled={selectedOption === null || isSubmitting}
        className="w-full btn-primary"
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Submitting...
          </>
        ) : (
          <>
            <Vote className="w-4 h-4 mr-2" />
            Submit Vote
          </>
        )}
      </Button>
    </div>
  );
}
