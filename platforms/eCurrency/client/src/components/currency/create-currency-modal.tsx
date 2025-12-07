import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { X } from "lucide-react";

interface CreateCurrencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Array<{ id: string; name: string; isAdmin: boolean }>;
}

export default function CreateCurrencyModal({ open, onOpenChange, groups }: CreateCurrencyModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const queryClient = useQueryClient();

  const adminGroups = groups.filter(g => g.isAdmin);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; groupId: string; allowNegative: boolean }) => {
      const response = await apiClient.post("/api/currencies", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      setName("");
      setDescription("");
      setGroupId("");
      setAllowNegative(false);
      onOpenChange(false);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create Currency</h2>
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
            if (name && groupId) {
              createMutation.mutate({ name, description, groupId, allowNegative });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Currency Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="e.g., USD, EUR, Credits"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-md min-h-[80px] resize-y"
              placeholder="Describe what this currency is used for..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Group</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">Select a group</option>
              {adminGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Negative Balance Policy</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAllowNegative(false)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  !allowNegative
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                }`}
              >
                <div className="font-medium mb-1">No Negative Balances</div>
                <div className="text-sm text-muted-foreground">
                  Users cannot go below zero balance
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAllowNegative(true)}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  allowNegative
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                }`}
              >
                <div className="font-medium mb-1">Allow Negative Balances</div>
                <div className="text-sm text-muted-foreground">
                  Users can have negative balances
                </div>
              </button>
            </div>
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
              disabled={createMutation.isPending || !name || !groupId}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

