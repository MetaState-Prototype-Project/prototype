import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { X, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import CustomNumberInput from "@/components/ui/custom-number-input";
import { formatEName } from "@/lib/utils";

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromCurrencyId?: string;
  accountContext?: { type: "user" | "group"; id: string } | null;
}

export default function TransferModal({ open, onOpenChange, fromCurrencyId, accountContext }: TransferModalProps) {
  const { user } = useAuth();
  const [fromCurrency, setFromCurrency] = useState(fromCurrencyId || "");
  const [toAccountId, setToAccountId] = useState("");
  const [toAccountType, setToAccountType] = useState<"user" | "group">("user");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  // Determine from account based on context
  const fromAccountId = accountContext?.type === "group" ? accountContext.id : (user?.id || "");
  const fromAccountType = accountContext?.type === "group" ? "group" : "user";

  // Reset form when modal opens/closes or currency changes
  useEffect(() => {
    if (open && fromCurrencyId) {
      setFromCurrency(fromCurrencyId);
    }
    if (!open) {
      setAmount("");
      setDescription("");
      setToAccountId("");
      setSearchQuery("");
      setIsSearchOpen(false);
      setError("");
    }
  }, [open, fromCurrencyId]);

  const { data: balances } = useQuery({
    queryKey: ["balances", accountContext],
    queryFn: async () => {
      const params = accountContext?.type === "group"
        ? `?accountType=group&accountId=${accountContext.id}`
        : "";
      const response = await apiClient.get(`/api/ledger/balance${params}`);
      return response.data;
    },
  });

  const { data: currencies } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const response = await apiClient.get("/api/currencies");
      return response.data;
    },
  });

  const { data: searchResults } = useQuery({
    queryKey: ["search", toAccountType, searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      if (toAccountType === "user") {
        const response = await apiClient.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        return response.data || [];
      } else {
        const response = await apiClient.get(`/api/groups/search?q=${encodeURIComponent(searchQuery)}`);
        return response.data || [];
      }
    },
    enabled: searchQuery.length >= 2 && isSearchOpen,
  });

  const fromCurrencyData = currencies?.find((c: any) => c.id === fromCurrency);
  const fromBalance = balances?.find((b: any) => b.currency.id === fromCurrency);

  const transferMutation = useMutation({
    mutationFn: async (data: {
      currencyId: string;
      fromAccountId: string;
      fromAccountType: "user" | "group";
      toAccountId: string;
      toAccountType: "user" | "group";
      amount: number;
      description?: string;
    }) => {
      const response = await apiClient.post("/api/ledger/transfer", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      setAmount("");
      setDescription("");
      setToAccountId("");
      setSearchQuery("");
      setError("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      setError(error?.response?.data?.error || error?.message || "An error occurred while processing the transfer");
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsSearchOpen(false)}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header with currency name and balance (hidden for allowNegative currencies) */}
        {fromCurrencyData && fromBalance && !fromCurrencyData.allowNegative && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              {fromCurrencyData.name} - {Number(fromBalance.balance).toLocaleString()} available
            </h2>
            <p className="text-sm text-muted-foreground">
              Balance: {Number(fromBalance.balance).toLocaleString()} {fromCurrencyData.name}.
            </p>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Make a transfer</h2>
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
            setError("");

            if (!fromCurrency || !toAccountId || !amount) {
              setError("Please fill in all required fields");
              return;
            }

            const transferAmount = parseFloat(amount.replace(/,/g, ''));
            if (isNaN(transferAmount) || transferAmount <= 0) {
              setError("Please enter a valid amount greater than 0");
              return;
            }

            // Prevent self transfers
            if (fromAccountId === toAccountId && fromAccountType === toAccountType) {
              setError("Cannot transfer to the same account");
              return;
            }

            // Only check balance if negative balances are not allowed
            if (fromCurrencyData && !fromCurrencyData.allowNegative && fromBalance) {
              const currentBalance = Number(fromBalance.balance);
              if (currentBalance < transferAmount) {
                setError("Insufficient balance. This currency does not allow negative balances.");
                return;
              }
            }

            transferMutation.mutate({
              currencyId: fromCurrency,
              fromAccountId,
              fromAccountType,
              toAccountId,
              toAccountType,
              amount: transferAmount,
              description,
            });
          }}
          className="space-y-4"
        >
          {/* From Currency Selector */}
          {!fromCurrencyId && (
            <div>
              <label className="block text-sm font-medium mb-2">From</label>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg"
                required
              >
                <option value="">Select currency</option>
                {balances?.map((balance: any) => (
                  <option key={balance.currency.id} value={balance.currency.id}>
                    {balance.currency.name} - {Number(balance.balance).toLocaleString()} available
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount Input - Big */}
          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <div className="border rounded-lg p-4">
              <CustomNumberInput
                value={amount}
                onChange={(value) => {
                  // The value here is already cleaned by CustomNumberInput (no thousand separators)
                  // Just validate and format with thousand separators
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    // Split into integer and decimal parts
                    const parts = value.split('.');
                    const intPart = parts[0] || '';
                    const decimalPart = parts[1];

                    // Format integer part with thousand separators
                    // Handle empty string and '0' cases
                    const formattedInt = intPart === '' ? '' : intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

                    // Preserve decimal point and decimal part
                    // This is crucial for iOS - we must preserve the trailing decimal point
                    if (parts.length > 1) {
                      // User has typed a decimal point
                      setAmount(`${formattedInt}.${decimalPart !== undefined ? decimalPart : ''}`);
                    } else {
                      setAmount(formattedInt);
                    }
                  }
                }}
                placeholder="0"
                className="w-full text-3xl font-bold focus:outline-none border-0 p-0"
                required
              />
              <div className="text-sm text-muted-foreground mt-1">
                {fromCurrencyData?.name || ""}
              </div>
            </div>
            {fromBalance && amount && fromCurrencyData && !fromCurrencyData.allowNegative && parseFloat(amount.replace(/,/g, '')) > Number(fromBalance.balance) && (
              <p className="text-sm text-destructive mt-1">
                Insufficient balance. Available: {Number(fromBalance.balance).toLocaleString()}
              </p>
            )}
            {fromCurrencyData && fromCurrencyData.allowNegative && (
              <p className="text-sm text-muted-foreground mt-1">
                Negative balances are allowed for this currency
              </p>
            )}
          </div>

          {/* To Account */}
          <div>
            <label className="block text-sm font-medium mb-2">To</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setToAccountType("user");
                    setToAccountId("");
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  className={`px-4 py-2 rounded-lg border transition-colors ${toAccountType === "user"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setToAccountType("group");
                    setToAccountId("");
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  className={`px-4 py-2 rounded-lg border transition-colors ${toAccountType === "group"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  Group
                </button>
              </div>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder={`Search ${toAccountType === "user" ? "users" : "groups"}...`}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {isSearchOpen && (searchQuery.length >= 2 || searchResults) && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      {searchResults && searchResults.length > 0 ? (
                        searchResults.map((result: any) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => {
                              setToAccountId(result.id);
                              setSearchQuery(result.name || result.handle || "");
                              setIsSearchOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0"
                          >
                            <div className="font-medium">{result.name || result.handle || formatEName(result.ename)}</div>
                            {result.ename && (
                              <div className="text-sm text-muted-foreground">{formatEName(result.ename)}</div>
                            )}
                          </button>
                        ))
                      ) : searchQuery.length >= 2 ? (
                        <div className="px-4 py-4 text-center text-sm text-muted-foreground">
                          No {toAccountType === "user" ? "users" : "groups"} found
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
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

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Mutation Error */}
          {transferMutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {transferMutation.error instanceof Error
                ? transferMutation.error.message
                : "An error occurred while processing the transfer"}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                transferMutation.isPending ||
                !fromCurrency ||
                !toAccountId ||
                !amount ||
                parseFloat(amount.replace(/,/g, '')) <= 0 ||
                (fromBalance && fromCurrencyData && !fromCurrencyData.allowNegative && parseFloat(amount.replace(/,/g, '')) > Number(fromBalance.balance))
              }
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {transferMutation.isPending ? "Transferring..." : "Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

