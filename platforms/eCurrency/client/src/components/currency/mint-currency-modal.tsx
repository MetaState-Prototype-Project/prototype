import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { X } from "lucide-react";
import CustomNumberInput from "@/components/ui/custom-number-input";

interface MintCurrencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencyId: string;
}

export default function MintCurrencyModal({
  open,
  onOpenChange,
  currencyId,
}: MintCurrencyModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const mintMutation = useMutation({
    mutationFn: async (data: { amount: number; description?: string }) => {
      const response = await apiClient.post(`/api/currencies/${currencyId}/mint`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      queryClient.invalidateQueries({ queryKey: ["currency", currencyId] });
      setAmount("");
      setDescription("");
      onOpenChange(false);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Mint Currency</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (amount && parseFloat(amount) > 0) {
              mintMutation.mutate({
                amount: parseFloat(amount),
                description: description || undefined,
              });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <CustomNumberInput
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
              className="w-full px-4 py-3 border rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              Currency will be minted to the group's account for this currency.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this for?"
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mintMutation.isPending || !amount || parseFloat(amount) <= 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {mintMutation.isPending ? "Minting..." : "Mint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

