import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Vote, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Poll } from "@shared/schema";

interface VotingInterfaceProps {
  poll: Poll;
  userId: string;
  hasVoted: boolean;
  onVoteSubmitted: () => void;
}

export default function VotingInterface({ poll, userId, hasVoted, onVoteSubmitted }: VotingInterfaceProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitVoteMutation = useMutation({
    mutationFn: async (optionId: number) => {
      return await apiRequest("POST", "/api/votes", {
        pollId: poll.id,
        userId,
        optionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/polls"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/polls", poll.id, "vote-status", userId] 
      });
      toast({
        title: "Success!",
        description: "Your vote has been submitted",
      });
      onVoteSubmitted();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit vote",
        variant: "destructive",
      });
    },
  });

  const handleSubmitVote = () => {
    if (selectedOption === null) return;
    submitVoteMutation.mutate(selectedOption);
  };

  if (hasVoted) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="text-green-500 h-16 w-16 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Already Voted</h3>
        <p className="text-gray-600">You have already voted on this poll</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RadioGroup
        value={selectedOption?.toString()}
        onValueChange={(value) => setSelectedOption(parseInt(value))}
        className="space-y-3"
      >
        {(poll.options as Array<{id: number, text: string}>).map((option) => (
          <div key={option.id} className="flex items-center space-x-2">
            <RadioGroupItem
              value={option.id.toString()}
              id={`option-${option.id}`}
            />
            <Label
              htmlFor={`option-${option.id}`}
              className="flex-1 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-900">{option.text}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>

      <Button
        onClick={handleSubmitVote}
        disabled={selectedOption === null || submitVoteMutation.isPending}
        className="w-full btn-primary"
      >
        {submitVoteMutation.isPending ? (
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
