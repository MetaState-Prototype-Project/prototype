import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { X, Search, ChevronDown } from "lucide-react";
import { formatEName } from "@/lib/utils";

interface AddCurrencyAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddCurrencyAccountModal({ open, onOpenChange }: AddCurrencyAccountModalProps) {
  const [currencyId, setCurrencyId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: currencies } = useQuery({
    queryKey: ["currencies"],
    queryFn: async () => {
      const response = await apiClient.get("/api/currencies");
      return response.data;
    },
  });

  const { data: balances } = useQuery({
    queryKey: ["balances"],
    queryFn: async () => {
      const response = await apiClient.get("/api/ledger/balance");
      return response.data;
    },
  });

  // Filter out currencies the user already has an account for
  const existingCurrencyIds = balances?.map((b: any) => b.currency.id) || [];
  const availableCurrencies = currencies?.filter((c: any) => !existingCurrencyIds.includes(c.id)) || [];

  // Filter currencies based on search query
  const filteredCurrencies = useMemo(() => {
    if (!searchQuery.trim()) return availableCurrencies;
    const query = searchQuery.toLowerCase();
    return availableCurrencies.filter((currency: any) =>
      currency.name.toLowerCase().includes(query) ||
      currency.ename.toLowerCase().includes(query)
    );
  }, [availableCurrencies, searchQuery]);

  const selectedCurrency = availableCurrencies.find((c: any) => c.id === currencyId);

  const initializeMutation = useMutation({
    mutationFn: async (currencyId: string) => {
      const response = await apiClient.post("/api/ledger/initialize", { currencyId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      setCurrencyId("");
      setSearchQuery("");
      setIsOpen(false);
      onOpenChange(false);
    },
  });

  // Close dropdown when clicking outside
  const handleClickOutside = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.currency-selector')) return;
    setIsOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleClickOutside}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Currency Account</h2>
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
            if (currencyId) {
              initializeMutation.mutate(currencyId);
            }
          }}
          className="space-y-4"
        >
          <div className="relative currency-selector">
            <label className="block text-sm font-medium mb-1">Select Currency</label>
            <div className="relative">
              <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 border rounded-md cursor-pointer flex items-center justify-between bg-white"
              >
                <span className={selectedCurrency ? "text-foreground" : "text-muted-foreground"}>
                  {selectedCurrency
                    ? `${selectedCurrency.name} (${formatEName(selectedCurrency.ename)})`
                    : "Search or select a currency"}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>

              {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-hidden">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search currencies..."
                        className="w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCurrencies.length > 0 ? (
                      filteredCurrencies.map((currency: any) => (
                        <button
                          key={currency.id}
                          type="button"
                          onClick={() => {
                            setCurrencyId(currency.id);
                            setSearchQuery("");
                            setIsOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
                            currencyId === currency.id ? "bg-primary/10" : ""
                          }`}
                        >
                          <div className="font-medium">{currency.name}</div>
                          <div className="text-sm text-muted-foreground">{formatEName(currency.ename)}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        {searchQuery ? "No currencies found" : "No available currencies"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {availableCurrencies.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                You already have accounts for all available currencies.
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={initializeMutation.isPending || !currencyId || availableCurrencies.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {initializeMutation.isPending ? "Adding..." : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
